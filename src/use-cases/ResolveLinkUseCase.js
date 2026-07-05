import BrowserManager from "../core/browser/BrowserManager.js";
import LinkResolver from "../domain/LinkResolver.js";
import MarketplaceDetector from "../domain/MarketplaceDetector.js";
import ExtractorRegistry from "../market-extractors/ExtractorRegistry.js";
import NavigationManager from "../core/navigation/NavigationManager.js";
import logger from "../utils/logger.js";
import config from "../config/index.js";

class ResolveLinkUseCase {
  /**
   * Executa o caso de uso de resolução de link em duas etapas isoladas.
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

    let context = null;
    let page1 = null;
    let page2 = null;
    let urlFinal = rawUrl;
    let redirectChain = [rawUrl];

    try {
      // 1. Cria um contexto isolado para a requisição atual
      context = await BrowserManager.createContext();

      // -------------------------------------------------------------
      // ABA 1: Resolução de redirecionamentos e encurtadores
      // -------------------------------------------------------------
      logger.startStep("link_resolution");
      const page1Setup = await BrowserManager.createPage(context);
      page1 = page1Setup.page;

      const resolution = await LinkResolver.resolve(page1, rawUrl);
      urlFinal = resolution.urlFinal;
      redirectChain = resolution.chain;

      logger.endStep("link_resolution");

      // Fecha a Aba 1 imediatamente após resolver para limpar cookies/sessões de afiliados
      await BrowserManager.closePage(page1);
      page1 = null;

      // 2. Detecta o Marketplace da URL resolvida
      const marketplace = MarketplaceDetector.detect(urlFinal);
      logger.info(`🔍 Marketplace detectado: ${marketplace} para a URL: ${urlFinal}`);

      // 3. Validação de Marketplace suportado (apenas Amazon, Mercado Livre e Shopee)
      const supportedMarkets = ["amazon", "mercadolivre", "shopee"];
      if (!supportedMarkets.includes(marketplace)) {
        logger.warn(`⚠️ Marketplace não suportado: ${marketplace}`);
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
      
      // 5. Normaliza a URL e extrai IDs de produto sem necessidade do browser
      const urlLimpa = extractor.normalizeUrl(urlFinal);
      const productIds = extractor.extractProductId(urlLimpa);
      
      logger.info(`✨ URL normalizada limpa: ${urlLimpa}`, { productIds });

      // -------------------------------------------------------------
      // ABA 2: Abertura da URL limpa e extração de metadados
      // -------------------------------------------------------------
      logger.startStep("metadata_extraction");
      const page2Setup = await BrowserManager.createPage(context);
      page2 = page2Setup.page;

      // Navega na Aba 2 para a URL limpa com timeout de 15 segundos
      await NavigationManager.navigateTo(page2, urlLimpa, {
        timeout: config.timeouts.extraction // 15s de timeout padrão configurado
      });

      // Extrai título e imagem
      const metadata = await extractor.extract(page2);
      logger.endStep("metadata_extraction");

      // Fecha a Aba 2
      await BrowserManager.closePage(page2);
      page2 = null;

      logger.endStep("use_case_execution");

      // 6. Retorna o sucesso formatado
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

    } catch (error) {
      logger.error("❌ Erro fatal no caso de uso ResolveLinkUseCase:", error);
      return {
        success: false,
        code: "INTERNAL_ERROR",
        message: error.message,
        chain: redirectChain
      };
    } finally {
      // Garantia absoluta de liberação de recursos para evitar vazamentos de memória (memory leaks)
      if (page1) await BrowserManager.closePage(page1).catch(() => {});
      if (page2) await BrowserManager.closePage(page2).catch(() => {});
      if (context) await BrowserManager.closeContext(context).catch(() => {});
    }
  }
}

export default new ResolveLinkUseCase();
