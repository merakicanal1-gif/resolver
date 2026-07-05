import AmazonExtractor from "./amazon/AmazonExtractor.js";
import MercadoLivreExtractor from "./mercadolivre/MercadoLivreExtractor.js";
import ShopeeExtractor from "./shopee/ShopeeExtractor.js";

class ExtractorRegistry {
  constructor() {
    this._extractors = [
      {
        marketplace: "amazon",
        extractor: AmazonExtractor,
        supportedDomains: AmazonExtractor.supportedDomains,
        priority: 100
      },
      {
        marketplace: "mercadolivre",
        extractor: MercadoLivreExtractor,
        supportedDomains: MercadoLivreExtractor.supportedDomains,
        priority: 100
      },
      {
        marketplace: "shopee",
        extractor: ShopeeExtractor,
        supportedDomains: ShopeeExtractor.supportedDomains,
        priority: 100
      }
    ];
  }

  /**
   * Encontra a definição do marketplace e do extrator correspondente à URL.
   * @param {string} url - A URL do produto ou redirect.
   * @returns {object|null} A definição cadastrada ou null.
   */
  find(url) {
    if (!url) return null;
    
    // Procura o extrator que suporta a URL dada
    for (const entry of this._extractors) {
      if (entry.extractor.supports(url)) {
        return entry;
      }
    }
    
    return null;
  }

  /**
   * Retorna todos os extratores cadastrados.
   * @returns {object[]}
   */
  list() {
    return this._extractors;
  }
}

export default new ExtractorRegistry();
