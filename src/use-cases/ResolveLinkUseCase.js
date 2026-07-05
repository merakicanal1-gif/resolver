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
    
    // Log inicial humanizado
    console.log("Request iniciado");
    console.log("↓");
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
          console.log("Reconectando navegador...");
          console.log("↓");
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
      console.log(`${providerName} conectado`);
      console.log("↓");
      
      tempoConexaoMs = Date.now() - startConnect;
      logger.structured("initialization", "browser_connected", { provider: config.browser.provider });

      // -------------------------------------------------------------
      // FASE 1: RESOLUÇÃO DE LINKS (LinkResolver)
      // -------------------------------------------------------------
      logger.startStep("link_resolution");
      page1 = await BrowserManager.createPage(context);
      
      console.log("Nova URL");
      console.log("↓");

      // Escuta eventos e imprime logs humanizados específicos da Fase 1
      page1.on("request", (req) => {
        if (req.isNavigationRequest() && req.frame() === page1.mainFrame()) {
          const redirectedFrom = req.redirectedFrom();
          if (redirectedFrom) {
            console.log("Redirect HTTP");
            console.log("↓");
            logger.structured("resolver", "redirect_http", { from: redirectedFrom.url(), to: req.url() });
          }
        }
      });

      // Registrar redirects JS
      await page1.exposeFunction("__onLogJsRedirect", (type, url) => {
        console.log("Redirect JavaScript");
        console.log("↓");
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
      console.log("Marketplace identificado");
      console.log("↓");
      console.log("Extrator escolhido");
      console.log("↓");
      
      logger.structured("detector", "marketplace_matched", { marketplace });

      // Normaliza URL e ID de forma offline/autônoma
      let urlLimpa = extractor.normalizeUrl(resolution.urlFinal);
      let productIds = extractor.extractProductId(urlLimpa);

      logger.startStep("metadata_extraction");
      page2 = await BrowserManager.createPage(context);
      
      const startExtract = Date.now();
      
      let requestHeaders = {};
      let responseHeaders = {};

      page2.on("request", (req) => {
        if (req.url() === urlLimpa) requestHeaders = req.headers();
      });
      page2.on("response", (res) => {
        if (res.url() === urlLimpa) responseHeaders = res.headers();
      });

      let metadata = null;
      let extractionError = null;

      try {
        logger.info(`[ResolveLinkUseCase] Carregando URL inicial: ${urlLimpa}`);
        await page2.goto(urlLimpa, {
          waitUntil: "domcontentloaded",
          timeout: config.timeouts.extraction
        });

        // Se for uma página intermediária (sem ID do produto), tentamos localizar e CLICAR no produto
        if (!productIds.produto_id) {
          logger.info(`[ResolveLinkUseCase] Identificada página intermediária para ${marketplace}. Aguardando renderização do conteúdo...`);

          if (marketplace === "mercadolivre") {
            // Aguarda a listagem de resultados aparecer
            await page2.waitForSelector(
              ".ui-search-layout__item, .ui-search-result, .poly-card, .ui-search-link",
              { timeout: 8000 }
            ).catch(() => {});

            // Folga extra para renderização completa dos cards
            await page2.waitForTimeout(2000);

            logger.info(`[ResolveLinkUseCase] Localizando e clicando no primeiro produto da listagem...`);

            // Tenta vários seletores do primeiro card de produto (da mais específica para mais genérica)
            const primeiroCardSeletor = [
              ".ui-search-layout__item:first-of-type .poly-component__title",
              ".ui-search-layout__item:first-of-type .ui-search-item__title",
              ".ui-search-result:first-of-type .ui-search-item__title",
              ".poly-card:first-of-type .poly-component__title",
              ".ui-search-layout__item:first-of-type a.ui-search-link",
              ".ui-search-layout__item:first-of-type a",
            ].join(", ");

            const elemento = await page2.$(primeiroCardSeletor);

            if (elemento) {
              // Rola a página levemente, como um humano faria ao ver a listagem
              await page2.evaluate(() => window.scrollBy(0, 300));
              await page2.waitForTimeout(800 + Math.floor(Math.random() * 600));

              // Clica no primeiro produto e aguarda a navegação para a página do produto
              await Promise.all([
                page2.waitForNavigation({ waitUntil: "domcontentloaded", timeout: config.timeouts.extraction }),
                elemento.click(),
              ]);

              // Aguarda a página do produto estabilizar antes de prosseguir
              await page2.waitForTimeout(1500);
              logger.info(`[ResolveLinkUseCase] Navegação após clique concluída. URL: ${page2.url()}`);
            } else {
              // Fallback: não encontrou elemento clicável, tenta via href direto
              logger.warn(`[ResolveLinkUseCase] Elemento clicável não encontrado. Tentando via href...`);
              const href = await page2.evaluate(() => {
                const anchors = Array.from(document.querySelectorAll("a"));
                const direct = anchors.find(a => {
                  try {
                    const u = new URL(a.href);
                    return u.hostname === "produto.mercadolivre.com.br" || u.pathname.startsWith("/p/MLB");
                  } catch(e) { return false; }
                });
                if (direct) return direct.href;
                const byPath = anchors.find(a => {
                  try {
                    const u = new URL(a.href);
                    return /\/MLB-\d+/.test(u.pathname) && !u.pathname.includes("/pagina/");
                  } catch(e) { return false; }
                });
                return byPath ? byPath.href : null;
              });

              if (href) {
                await page2.goto(href, { waitUntil: "domcontentloaded", timeout: config.timeouts.extraction });
                logger.info(`[ResolveLinkUseCase] Navegação via goto concluída. URL: ${page2.url()}`);
              } else {
                logger.warn(`[ResolveLinkUseCase] Nenhum link de produto encontrado na página intermediária.`);
              }
            }

            // Re-extrai IDs e normaliza URL após navegação para o produto
            const novaUrl = page2.url();
            urlLimpa = extractor.normalizeUrl(novaUrl);
            productIds = extractor.extractProductId(urlLimpa);

          } else {
            // Para Amazon e Shopee: estratégia via href
            const linkCandidato = await page2.evaluate((mkt) => {
              const anchors = Array.from(document.querySelectorAll("a"));
              if (mkt === "amazon") {
                const found = anchors.find(a => a.href.includes("/dp/") || a.href.includes("/gp/product/"));
                return found ? found.href : null;
              }
              if (mkt === "shopee") {
                const found = anchors.find(a => a.href.includes("-i.") || a.href.includes("/product/"));
                return found ? found.href : null;
              }
              return null;
            }, marketplace);

            if (linkCandidato) {
              logger.info(`[ResolveLinkUseCase] Link do produto encontrado: ${linkCandidato}. Navegando...`);
              await page2.goto(linkCandidato, { waitUntil: "domcontentloaded", timeout: config.timeouts.extraction });
              const novaUrl = page2.url();
              urlLimpa = extractor.normalizeUrl(novaUrl);
              productIds = extractor.extractProductId(urlLimpa);
            } else {
              logger.warn(`[ResolveLinkUseCase] Nenhum link de produto encontrado na página intermediária.`);
            }
          }
        }

        // Obtém a URL canônica se disponível no DOM da página
        const canonicalUrl = await page2.$eval('link[rel="canonical"]', el => el.href).catch(() => null);
        if (canonicalUrl) {
          logger.info(`[ResolveLinkUseCase] URL canônica obtida do DOM: ${canonicalUrl}`);
          urlLimpa = extractor.normalizeUrl(canonicalUrl);
          productIds = extractor.extractProductId(urlLimpa);
        }

        metadata = await extractor.extract(page2, urlLimpa);
      } catch (err) {
        extractionError = err;
        logger.error(`❌ [ResolveLinkUseCase] Falha ao extrair metadados: ${err.message}`);
      }

      tempoExtracaoMs = Date.now() - startExtract;
      logger.endStep("metadata_extraction");

      // Salva diagnósticos em caso de falha de metadados
      if (extractionError || !metadata || !metadata.titulo || !metadata.imagem) {
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
        throw extractionError;
      }

      if (metadata.titulo) {
        console.log("Título encontrado");
        console.log("↓");
      }
      if (metadata.imagem) {
        console.log("Imagem encontrada");
        console.log("↓");
      }

      console.log("Finalizado");
      
      const tempoTotalMs = Date.now() - startTotalTime;

      logger.structured("extraction", "extraction_finished", {
        marketplace,
        produto_id: productIds.produto_id,
        titulo: metadata.titulo
      });

      return {
        success: true,
        marketplace,
        ...productIds,
        url_original: rawUrl,
        url_encontrada: resolution.urlFinal,
        url_final: urlLimpa,
        titulo: metadata.titulo,
        imagem: metadata.imagem,
        preco: metadata.preco || null,
        vendedor: metadata.vendedor || null,
        avaliacao: metadata.avaliacao || null,
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
