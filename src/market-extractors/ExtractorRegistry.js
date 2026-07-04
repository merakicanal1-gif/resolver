import GenericExtractor from "./base/GenericExtractor.js";
import AmazonExtractor from "./amazon/AmazonExtractor.js";
import MercadoLivreExtractor from "./mercadolivre/MercadoLivreExtractor.js";
import ShopeeExtractor from "./shopee/ShopeeExtractor.js";

class ExtractorRegistry {
  constructor() {
    this._registry = new Map();
    
    // Registra os extratores para cada marketplace
    this._registry.set("amazon", AmazonExtractor);
    this._registry.set("mercadolivre", MercadoLivreExtractor);
    this._registry.set("shopee", ShopeeExtractor);
  }

  /**
   * Retorna o extrator correspondente ao nome do marketplace.
   * Se o marketplace for desconhecido, retorna o GenericExtractor como fallback.
   * @param {string} marketplace - Nome do marketplace.
   * @returns {import('./base/BaseExtractor').default} A instância do extrator.
   */
  getExtractor(marketplace) {
    const extractor = this._registry.get(marketplace);
    if (extractor) {
      return extractor;
    }
    
    // Fallback para domínios genéricos
    return GenericExtractor;
  }
}

export default new ExtractorRegistry();
