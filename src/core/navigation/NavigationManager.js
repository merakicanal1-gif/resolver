class NavigationManager {
  /**
   * Navega de forma segura para uma URL.
   * @param {import('playwright').Page} page - A página do Playwright.
   * @param {string} url - A URL para navegar.
   * @param {object} [options] - Opções de navegação do Playwright.
   * @returns {Promise<string>} A URL final após a navegação.
   */
  async navigateTo(page, url, options = {}) {
    const defaultOptions = {
      waitUntil: "domcontentloaded",
      timeout: 60000,
      ...options,
    };

    try {
      await page.goto(url, defaultOptions);
      return page.url();
    } catch (error) {
      console.error(`❌ Erro ao navegar para a URL [${url}]:`, error.message);
      // Retorna a URL atual mesmo se der erro (pode ser útil se houver redirect bloqueado ou timeout que carregou parcialmente)
      return page.url();
    }
  }

  /**
   * Aguarda um período específico em milissegundos.
   * @param {import('playwright').Page} page - A página.
   * @param {number} ms - Tempo em milissegundos.
   */
  async waitForTimeout(page, ms) {
    try {
      await page.waitForTimeout(ms);
    } catch (error) {
      console.warn("⚠️ Erro ao aguardar timeout:", error.message);
    }
  }

  /**
   * Aguarda que um seletor esteja visível na página.
   * @param {import('playwright').Page} page - A página.
   * @param {string} selector - Seletor CSS.
   * @param {object} [options] - Opções de espera.
   * @returns {Promise<boolean>} Retorna true se encontrou, false caso contrário.
   */
  async waitForSelector(page, selector, options = {}) {
    const defaultOptions = {
      state: "visible",
      timeout: 10000,
      ...options,
    };

    try {
      await page.waitForSelector(selector, defaultOptions);
      return true;
    } catch (error) {
      console.warn(`⚠️ Seletor [${selector}] não encontrado dentro do tempo limite.`);
      return false;
    }
  }

  /**
   * Obtém a URL atual da página.
   * @param {import('playwright').Page} page
   * @returns {string}
   */
  getUrl(page) {
    return page.url();
  }
}

export default new NavigationManager();
