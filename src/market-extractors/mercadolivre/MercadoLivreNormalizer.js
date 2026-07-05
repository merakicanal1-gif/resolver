import MercadoLivreExtractor from "./MercadoLivreExtractor.js";

class MercadoLivreNormalizer {
  /**
   * Limpa a URL do Mercado Livre.
   * @param {string} url 
   * @returns {string} URL limpa no formato produto.mercadolivre.com.br/MLB-ID.
   */
  normalize(url) {
    return MercadoLivreExtractor.normalizeUrl(url);
  }

  /**
   * Extrai o ID do produto (MLB ID).
   * @param {string} url 
   * @returns {object} { marketplace: 'mercadolivre', produto_id: string } ou {}
   */
  extractId(url) {
    const result = MercadoLivreExtractor.extractProductId(url);
    if (result.produto_id) {
      return result;
    }
    return {};
  }
}

export default new MercadoLivreNormalizer();
