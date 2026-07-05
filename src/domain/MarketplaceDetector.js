import ExtractorRegistry from "../market-extractors/ExtractorRegistry.js";

class MarketplaceDetector {
  /**
   * Detecta o marketplace a partir de uma URL usando o ExtractorRegistry centralizado.
   * @param {string} url - A URL do produto.
   * @returns {string} O identificador do marketplace (ex: 'amazon', 'mercadolivre', 'shopee') ou 'desconhecido'.
   */
  detect(url) {
    try {
      const match = ExtractorRegistry.find(url);
      if (match) {
        return match.marketplace;
      }
      return "desconhecido";
    } catch (error) {
      console.error(`❌ Erro ao detectar marketplace para a URL [${url}]:`, error.message);
      return "desconhecido";
    }
  }
}

export default new MarketplaceDetector();
