class MercadoLivreNormalizer {
  /**
   * Limpa a URL do Mercado Livre.
   * @param {string} url 
   * @returns {string} URL limpa no formato produto.mercadolivre.com.br/MLB-ID.
   */
  normalize(url) {
    try {
      const u = new URL(url);
      u.search = "";
      u.hash = "";

      const mlbMatch = u.pathname.match(/(MLB-\d+)/i);
      if (mlbMatch) {
        return "https://produto.mercadolivre.com.br/" + mlbMatch[1];
      }
      return u.toString();
    } catch {
      return url;
    }
  }

  /**
   * Extrai o ID do produto (MLB ID).
   * @param {string} url 
   * @returns {object} { marketplace: 'mercadolivre', produto_id: string } ou {}
   */
  extractId(url) {
    try {
      const u = new URL(url);
      const mlbMatch = u.pathname.match(/(MLB-\d+)/i);
      if (mlbMatch) {
        return {
          marketplace: "mercadolivre",
          produto_id: mlbMatch[1]
        };
      }
      return {};
    } catch {
      return {};
    }
  }
}

export default new MercadoLivreNormalizer();
