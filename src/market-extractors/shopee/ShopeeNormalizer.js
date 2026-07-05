import ShopeeExtractor from "./ShopeeExtractor.js";

class ShopeeNormalizer {
  /**
   * Limpa a URL da Shopee.
   * @param {string} url 
   * @returns {string} URL limpa.
   */
  normalize(url) {
    return ShopeeExtractor.normalizeUrl(url);
  }

  /**
   * Extrai o ID do produto e o Shop ID da Shopee.
   * @param {string} url 
   * @returns {object} { marketplace: 'shopee', shop_id: string, produto_id: string } ou {}
   */
  extractId(url) {
    const result = ShopeeExtractor.extractProductId(url);
    if (result.produto_id) {
      return result;
    }
    return {};
  }
}

export default new ShopeeNormalizer();
