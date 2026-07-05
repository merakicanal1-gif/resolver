import BrowserManager from "../core/browser/BrowserManager.js";
import SessionManager from "../core/browser/SessionManager.js";
import LinkResolver from "../domain/LinkResolver.js";
import ExtractorRegistry from "../market-extractors/ExtractorRegistry.js";
import logger from "../utils/logger.js";
import config from "../config/index.js";
import DiagnosticManager from "../utils/DiagnosticManager.js";

class ResolveLinkUseCase {
  /**
   * Executa o caso de uso de resolução de link em 2 fases desacopladas.
   * @param {string} rawUrl - A URL enviada pelo cliente.
   * @returns {Promise<object>} O resultado JSON estruturado.
   */
  async execute(rawUrl) {
    if (!rawUrl) {
      return {
        success: false,
        code: "INVALID_URL",
        message: "URL não enviada."
      };
    }

    const startTotalTime = Date.now();
    logger.startStep("total_execution");
    
    if (config.diagnostics.logLevel === "debug") {
      console.log("Request iniciado");
      console.log("↓");
    }
    logger.structured("total_execution", "request_initiated", { url: rawUrl });

    try {
      return await this._runPipeline(rawUrl, startTotalTime);
    } catch (error) {
      const isConnectionError = 
        error.message.includes("closed") || 
        error.message.includes("CDP") || 
        error.message.includes("connect") || 
        error.message.includes("WebSocket") ||
        error.message.includes("Target page");

      if (isConnectionError) {
        logger.warn(`⚠️ [ResolveLinkUseCase] Erro de conexão do navegador detectado: "${error.message}". Tentando recriar sessão e executar retry...`);
        await SessionManager.forceRecreate().catch(() => {});
        
        try {
          if (config.diagnostics.logLevel === "debug") {
            console.log("Reconectando navegador...");
            console.log("↓");
          }
          return await this._runPipeline(rawUrl, startTotalTime);
        } catch (retryError) {
          logger.error("❌ [ResolveLinkUseCase] Erro crítico persistente após retry:", retryError);
          return {
            success: false,
            code: "BROWSER_CONNECTION_ERROR",
            message: "Não foi possível conectar ao provedor de navegador.",
            chain: [rawUrl]
          };
        }
      }

      logger.error("❌ [ResolveLinkUseCase] Erro de execução na etapa do pipeline:", error);
      return {
        success: false,
        code: "INTERNAL_ERROR",
        message: error.message,
        chain: [rawUrl]
      };
    } finally {
      logger.endStep("total_execution");
    }
  }

  /**
   * Executa o pipeline de 2 fases.
   * @private
   */
  async _runPipeline(rawUrl, startTotalTime) {
    let context = null;
    let page1 = null;
    let page2 = null;

    // Métricas
    let tempoConexaoMs = 0;
    let tempoResolucaoMs = 0;
    let tempoExtracaoMs = 0;

    try {
      // -------------------------------------------------------------
      // INICIALIZAÇÃO
      // -------------------------------------------------------------
      const startConnect = Date.now();
      context = await BrowserManager.createContext();
      
      const providerName = config.browser.provider === "chrome" ? "Chrome" : "Browserless";
      if (config.diagnostics.logLevel === "debug") {
        console.log(`${providerName} conectado`);
        console.log("↓");
      }
      
      tempoConexaoMs = Date.now() - startConnect;
      logger.structured("initialization", "browser_connected", { provider: config.browser.provider });

      // -------------------------------------------------------------
      // FASE 1: RESOLUÇÃO DE LINKS (LinkResolver)
      // -------------------------------------------------------------
      logger.startStep("link_resolution");
      page1 = await BrowserManager.createPage(context);
      
      if (config.diagnostics.logLevel === "debug") {
        console.log("Nova URL");
        console.log("↓");
      }

      // Escuta eventos e imprime logs específicos da Fase 1
      page1.on("request", (req) => {
        if (req.isNavigationRequest() && req.frame() === page1.mainFrame()) {
          const redirectedFrom = req.redirectedFrom();
          if (redirectedFrom) {
            if (config.diagnostics.logLevel === "debug") {
              console.log("Redirect HTTP");
              console.log("↓");
            }
            logger.structured("resolver", "redirect_http", { from: redirectedFrom.url(), to: req.url() });
          }
        }
      });

      // Registrar redirects JS
      await page1.exposeFunction("__onLogJsRedirect", (type, url) => {
        if (config.diagnostics.logLevel === "debug") {
          console.log("Redirect JavaScript");
          console.log("↓");
        }
        logger.structured("resolver", "redirect_javascript", { type, url });
      });

      await page1.addInitScript(() => {
        const origPushState = window.history.pushState;
        window.history.pushState = function(...args) {
          const res = origPushState.apply(this, args);
          window.__onLogJsRedirect("pushState", window.location.href);
          return res;
        };
        const origReplaceState = window.history.replaceState;
        window.history.replaceState = function(...args) {
          const res = origReplaceState.apply(this, args);
          window.__onLogJsRedirect("replaceState", window.location.href);
          return res;
        };
        window.addEventListener("hashchange", () => {
          window.__onLogJsRedirect("hashchange", window.location.href);
        });
      });

      const resolution = await LinkResolver.resolve(page1, rawUrl, config.timeouts.resolution);
      tempoResolucaoMs = resolution.tempoResolucao;
      
      logger.endStep("link_resolution");
      logger.structured("resolver", "resolution_finished", { urlFinal: resolution.urlFinal, chain: resolution.chain });

      // Fecha Aba 1 imediatamente
      await BrowserManager.closePage(page1);
      page1 = null;

      // -------------------------------------------------------------
      // FASE 2: EXTRAÇÃO DE METADADOS
      // -------------------------------------------------------------
      // Consulta unificada ao ExtractorRegistry
      const registryMatch = ExtractorRegistry.find(resolution.urlFinal);
      if (!registryMatch) {
        logger.warn(`⚠️ [ResolveLinkUseCase] Marketplace não suportado para URL: ${resolution.urlFinal}`);
        return {
          success: false,
          code: "UNSUPPORTED_MARKETPLACE",
          message: "Marketplace ainda não suportado.",
          url_final: resolution.urlFinal,
          chain: resolution.chain
        };
      }

      const { marketplace, extractor } = registryMatch;
      
      if (config.diagnostics.logLevel === "debug") {
        console.log("Marketplace identificado");
        console.log("↓");
        console.log("Extrator escolhido");
        console.log("↓");
      }
      
      logger.structured("detector", "marketplace_matched", { marketplace });

      page2 = await BrowserManager.createPage(context);
      
      const startExtract = Date.now();
      
      let requestHeaders = {};
      let responseHeaders = {};

      page2.on("request", (req) => {
        if (req.isNavigationRequest() && req.frame() === page2.mainFrame()) {
          requestHeaders = req.headers();
        }
      });
      page2.on("response", (res) => {
        if (res.frame() === page2.mainFrame()) {
          responseHeaders = res.headers();
        }
      });

      let extractionResult = null;
      let extractionError = null;

      try {
        extractionResult = await extractor.extract(page2, resolution.urlFinal);
      } catch (err) {
        extractionError = err;
        logger.error(`❌ [ResolveLinkUseCase] Falha ao extrair metadados: ${err.message}`);
      }

      tempoExtracaoMs = Date.now() - startExtract;
      logger.endStep("metadata_extraction");

      // Salva diagnósticos em caso de falha de metadados
      if (extractionError || !extractionResult || !extractionResult.titulo || !extractionResult.imagem) {
        const requestId = logger.requestStorage?.getStore()?.requestId || "unknown-request";
        await DiagnosticManager.saveFailure(page2, requestId, {
          urlOriginal: rawUrl,
          urlFinal: resolution.urlFinal,
          marketplace,
          chain: resolution.chain,
          requestHeaders,
          responseHeaders,
          error: extractionError ? extractionError.message : "Metadados incompletos"
        }).catch(() => {});
      }

      await BrowserManager.closePage(page2);
      page2 = null;

      if (extractionError) {
        if (extractionError.name === "ExtractorError") {
          return extractionError.toJSON();
        }
        throw extractionError;
      }

      if (config.diagnostics.logLevel === "debug") {
        if (extractionResult.titulo) {
          console.log("Título encontrado");
          console.log("↓");
        }
        if (extractionResult.imagem) {
          console.log("Imagem encontrada");
          console.log("↓");
        }
        console.log("Finalizado");
      }
      
      const tempoTotalMs = Date.now() - startTotalTime;

      logger.structured("extraction", "extraction_finished", {
        marketplace,
        produto_id: extractionResult.produto_id,
        titulo: extractionResult.titulo
      });

      return {
        success: true,
        marketplace,
        produto_id: extractionResult.produto_id,
        shop_id: extractionResult.shop_id || null,
        url_original: rawUrl,
        url_encontrada: resolution.urlFinal,
        url_final: extractionResult.url_final,
        titulo: extractionResult.titulo,
        imagem: extractionResult.imagem,
        preco: extractionResult.preco || null,
        vendedor: extractionResult.vendedor || null,
        avaliacao: extractionResult.avaliacao || null,
        chain: resolution.chain,
        metricas: {
          tempoConexaoMs,
          tempoResolucaoMs,
          tempoExtracaoMs,
          tempoTotalMs,
          redirectsCount: resolution.estatisticas.redirectsHttp + resolution.estatisticas.redirectsJavascript
        },
        estatisticas: resolution.estatisticas
      };

    } finally {
      if (page1) await BrowserManager.closePage(page1).catch(() => {});
      if (page2) await BrowserManager.closePage(page2).catch(() => {});
      if (context) await BrowserManager.closeContext(context).catch(() => {});
    }
  }
}

export default new ResolveLinkUseCase();
