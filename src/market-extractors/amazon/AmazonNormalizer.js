import AmazonExtractor from "./AmazonExtractor.js";

class AmazonNormalizer {
  /**
   * Limpa a URL da Amazon deixando no formato básico /dp/ASIN.
   * @param {string} url 
   * @returns {string} URL limpa.
   */
  normalize(url) {
    return AmazonExtractor.normalizeUrl(url);
  }

  /**
   * Extrai o ID do produto (ASIN).
   * @param {string} url 
   * @returns {object} { marketplace: 'amazon', produto_id: string } ou {}
   */
  extractId(url) {
    const result = AmazonExtractor.extractProductId(url);
    if (result.produto_id) {
      return result;
    }
    return {};
  }
}

export default new AmazonNormalizer();
