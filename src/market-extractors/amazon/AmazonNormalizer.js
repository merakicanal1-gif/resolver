class AmazonNormalizer {
  /**
   * Limpa a URL da Amazon deixando no formato básico /dp/ASIN.
   * @param {string} url 
   * @returns {string} URL limpa.
   */
  normalize(url) {
    try {
      const u = new URL(url);
      u.search = "";
      u.hash = "";

      const dpMatch = u.pathname.match(/\/dp\/([A-Z0-9]{10})/i);
      if (dpMatch) {
        u.pathname = "/dp/" + dpMatch[1];
      }
      return u.toString();
    } catch {
      return url;
    }
  }

  /**
   * Extrai o ID do produto (ASIN).
   * @param {string} url 
   * @returns {object} { marketplace: 'amazon', produto_id: string } ou {}
   */
  extractId(url) {
    try {
      const u = new URL(url);
      const dpMatch = u.pathname.match(/\/dp\/([A-Z0-9]{10})/i);
      if (dpMatch) {
        return {
          marketplace: "amazon",
          produto_id: dpMatch[1]
        };
      }
      return {};
    } catch {
      return {};
    }
  }
}

export default new AmazonNormalizer();
