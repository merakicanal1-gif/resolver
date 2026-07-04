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
        viewport: { width: 1920, height: 1080 },
        // User Agent genérico e moderno do Chrome/Chromium no Windows
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        deviceScaleFactor: 1,
        hasTouch: false,
        isMobile: false
      });

      return context;
    } catch (error) {
      console.error("❌ Erro ao criar contexto no ContextFactory:", error);
      throw error;
    }
  }
}

export default new ContextFactory();
