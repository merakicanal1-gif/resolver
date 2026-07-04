class MarketplaceDetector {
  /**
   * Detecta o marketplace a partir de uma URL.
   * @param {string} url - A URL do produto.
   * @returns {string} O identificador do marketplace (ex: 'amazon', 'mercadolivre', 'shopee') ou 'desconhecido'.
   */
  detect(url) {
    try {
      const parsedUrl = new URL(url);
      const host = parsedUrl.hostname.toLowerCase();

      if (host.includes("amazon")) return "amazon";
      if (host.includes("mercadolivre")) return "mercadolivre";
      if (host.includes("shopee")) return "shopee";
      if (host.includes("magalu") || host.includes("magazineluiza")) return "magalu";
      if (host.includes("kabum")) return "kabum";
      if (host.includes("casasbahia")) return "casasbahia";
      if (host.includes("extra")) return "extra";
      if (host.includes("pontofrio")) return "pontofrio";
      if (host.includes("carrefour")) return "carrefour";
      if (host.includes("terabyteshop")) return "terabyteshop";
      if (host.includes("pichau")) return "pichau";

      return "desconhecido";
    } catch (error) {
      console.error(`❌ Erro ao detectar marketplace para a URL [${url}]:`, error.message);
      return "desconhecido";
    }
  }
}

export default new MarketplaceDetector();
