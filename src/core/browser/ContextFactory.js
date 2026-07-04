class ContextFactory {
  /**
   * Cria e configura um novo contexto de navegação no browser.
   * @param {import('playwright').Browser} browser - Instância do browser Playwright.
   * @returns {Promise<import('playwright').BrowserContext>}
   */
  async createContext(browser) {
    try {
      const context = await browser.newContext({
        locale: "pt-BR",
        timezoneId: "America/Sao_Paulo",
        geolocation: { latitude: -23.55052, longitude: -46.633308 }, // Coordenadas de São Paulo
        permissions: ["geolocation"],
        viewport: { width: 1366, height: 768 }, // Resolução comum de notebook
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        deviceScaleFactor: 1,
        hasTouch: false,
        isMobile: false,
        colorScheme: "light",
        extraHTTPHeaders: {
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
          "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "Upgrade-Insecure-Requests": "1"
        }
      });

      return context;
    } catch (error) {
      console.error("❌ Erro ao criar contexto no ContextFactory:", error);
      throw error;
    }
  }
}

export default new ContextFactory();
