class ShopeeNormalizer {
  /**
   * Limpa a URL da Shopee.
   * @param {string} url 
   * @returns {string} URL limpa.
   */
  normalize(url) {
    try {
      const u = new URL(url);
      u.search = "";
      u.hash = "";
      return u.toString();
    } catch {
      return url;
    }
  }

  /**
   * Extrai o ID do produto e o Shop ID da Shopee.
   * @param {string} url 
   * @returns {object} { marketplace: 'shopee', shop_id: string, produto_id: string } ou {}
   */
  extractId(url) {
    try {
      const u = new URL(url);
      const match = u.pathname.match(/i\.(\d+)\.(\d+)/);
      if (match) {
        return {
          marketplace: "shopee",
          shop_id: match[1],
          produto_id: match[2]
        };
      }
      return {};
    } catch {
      return {};
    }
  }
}

export default new ShopeeNormalizer();
