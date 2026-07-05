import BrowserManager from "../core/browser/BrowserManager.js";
import SessionManager from "../core/browser/SessionManager.js";
import LinkResolver from "../domain/LinkResolver.js";
import MarketplaceDetector from "../domain/MarketplaceDetector.js";
import ExtractorRegistry from "../market-extractors/ExtractorRegistry.js";
import NavigationManager from "../core/navigation/NavigationManager.js";
import logger from "../utils/logger.js";
import config from "../config/index.js";

class ResolveLinkUseCase {
  /**
   * Executa o caso de uso de resolução de link com tratamento de retry automático em caso de falha de conexão.
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

    logger.startStep("use_case_execution");
    logger.info(`[REQ_INICIADA] Processando URL original: ${rawUrl}`);

    try {
      // Primeira tentativa
      return await this._runOperation(rawUrl);
    } catch (error) {
      // Verifica se o erro está associado a falhas de conexão CDP, sockets ou navegador fechado
      const isConnectionError = 
        error.message.includes("closed") || 
        error.message.includes("CDP") || 
        error.message.includes("connect") || 
        error.message.includes("WebSocket") ||
        error.message.includes("Target page");

      if (isConnectionError) {
        logger.warn(`[CONEXAO_FALHOU] Primeira tentativa falhou por conexão: "${error.message}". Iniciando retry único...`);
        
        // Descarta ativamente a conexão corrompida do SessionManager
        await SessionManager.forceRecreate().catch(() => {});
        
        try {
          logger.info("🔄 [RECONEXAO_REALIZADA] Executando segunda tentativa (retry)...");
          const result = await this._runOperation(rawUrl);
          logger.info("✅ [RECONEXAO_SUCESSO] Operação concluída com sucesso no retry.");
          return result;
        } catch (retryError) {
          logger.error("❌ [RECONEXAO_FALHA] Falha na segunda tentativa (retry) com o Browserless:", retryError);
          
          // Retorno estruturado conforme regras do usuário (HTTP 503 no controller correspondente)
          return {
            success: false,
            code: "BROWSER_CONNECTION_ERROR",
            message: "Não foi possível conectar ao Browserless.",
            retryable: true,
            chain: [rawUrl]
          };
        }
      }

      // Erros internos que não são de conexão com o navegador (ex: bugs de lógica, etc.)
      logger.error("❌ [ERRO_ETAPA] Erro de lógica interna durante a execução do Caso de Uso:", error);
      return {
        success: false,
        code: "INTERNAL_ERROR",
        message: error.message,
        chain: [rawUrl]
      };
    } finally {
      logger.endStep("use_case_execution");
      logger.info(`[REQ_FINALIZADA] Fluxo completo encerrado.`);
    }
  }

  /**
   * Executa a operação real de resolução e extração em uma tentativa.
   * Lança erros de conexão para que o método pai gerencie o retry.
   * @param {string} rawUrl 
   * @returns {Promise<object>}
   * @private
   */
  async _runOperation(rawUrl) {
    let context = null;
    let page1 = null;
    let page2 = null;
    let urlFinal = rawUrl;
    let redirectChain = [rawUrl];

    try {
      // 1. Cria um contexto isolado para a tentativa atual
      logger.info("[CONTEXTO_CRIADO] Criando novo contexto isolado de navegação...");
      context = await BrowserManager.createContext();

      // -------------------------------------------------------------
      // ABA 1: Resolução de redirecionamentos e encurtadores
      // -------------------------------------------------------------
      logger.startStep("link_resolution");
      logger.info("[ABA1_CRIADA] Abrindo aba de resolução...");
      const page1Setup = await BrowserManager.createPage(context);
      page1 = page1Setup.page;

      logger.info("[RESOLUCAO_INICIADA] Iniciando resolvedor de links...");
      const resolution = await LinkResolver.resolve(page1, rawUrl);
      urlFinal = resolution.urlFinal;
      redirectChain = resolution.chain;

      logger.endStep("link_resolution");
      logger.info(`[RESOLUCAO_ESTABILIZADA] Resolução concluída. Fechando aba 1...`);
      
      // Fecha a Aba 1 imediatamente para liberar memória e cookies de trackers
      await BrowserManager.closePage(page1);
      page1 = null;

      // 2. Detecta o Marketplace da URL final resolvida
      const marketplace = MarketplaceDetector.detect(urlFinal);
      logger.info(`[MARKETPLACE_DETECTADO] Marketplace identificado: ${marketplace}`);

      // 3. Validação de Marketplace suportado (apenas Amazon, Mercado Livre e Shopee)
      const supportedMarkets = ["amazon", "mercadolivre", "shopee"];
      if (!supportedMarkets.includes(marketplace)) {
        logger.warn(`⚠️ [MARKETPLACE_NAO_SUPORTADO] O marketplace '${marketplace}' não é suportado para extração.`);
        return {
          success: false,
          code: "UNSUPPORTED_MARKETPLACE",
          message: "Marketplace ainda não suportado.",
          marketplace,
          url_final: urlFinal,
          chain: redirectChain
        };
      }

      // 4. Obtém o Extrator específico
      const extractor = ExtractorRegistry.getExtractor(marketplace);
      
      // 5. Normaliza a URL e extrai IDs de produto (sem usar o browser)
      const urlLimpa = extractor.normalizeUrl(urlFinal);
      const productIds = extractor.extractProductId(urlLimpa);
      logger.info(`[NORMALIZACAO_CONCLUIDA] URL limpa obtida: ${urlLimpa}`);

      // -------------------------------------------------------------
      // ABA 2: Abertura da URL limpa e extração de metadados
      // -------------------------------------------------------------
      logger.startStep("metadata_extraction");
      logger.info("[ABA2_CRIADA] Abrindo aba de extração...");
      const page2Setup = await BrowserManager.createPage(context);
      page2 = page2Setup.page;

      logger.info(`[EXTRACAO_INICIADA] Carregando URL do produto limpo na aba 2...`);
      await NavigationManager.navigateTo(page2, urlLimpa, {
        timeout: config.timeouts.extraction
      });

      // Executa a raspagem
      const metadata = await extractor.extract(page2);
      logger.endStep("metadata_extraction");
      logger.info(`[EXTRACAO_CONCLUIDA] Extração realizada com sucesso.`);

      // Fecha a Aba 2
      await BrowserManager.closePage(page2);
      page2 = null;

      // 6. Retorna a estrutura final de sucesso
      return {
        success: true,
        marketplace,
        ...productIds,
        url_original: rawUrl,
        url_encontrada: urlFinal,
        url_final: urlLimpa,
        titulo: metadata.titulo,
        imagem: metadata.imagem,
        chain: redirectChain
      };

    } finally {
      // Liberação estrita de recursos localmente por tentativa
      if (page1) await BrowserManager.closePage(page1).catch(() => {});
      if (page2) await BrowserManager.closePage(page2).catch(() => {});
      if (context) await BrowserManager.closeContext(context).catch(() => {});
    }
  }
}

export default new ResolveLinkUseCase();
