import SessionManager from "./SessionManager.js";
import ContextFactory from "./ContextFactory.js";

class BrowserManager {
  /**
   * Cria um novo contexto de navegação isolado.
   * @returns {Promise<import('playwright').BrowserContext>}
   */
  async createContext() {
    const browser = await SessionManager.getBrowser();
    return await ContextFactory.createContext(browser);
  }

  /**
   * Abre uma nova aba (página) dentro de um contexto específico ou cria um novo contexto.
   * @param {import('playwright').BrowserContext} [context] - Contexto de navegação opcional.
   * @returns {Promise<{ page: import('playwright').Page, context: import('playwright').BrowserContext }>}
   */
  async createPage(context = null) {
    let activeContext = context;
    if (!activeContext) {
      activeContext = await this.createContext();
    }
    
    try {
      const page = await activeContext.newPage();
      return { page, context: activeContext };
    } catch (error) {
      console.error("❌ Erro ao criar nova aba no BrowserManager:", error);
      throw error;
    }
  }

  /**
   * Fecha uma aba (página) de forma segura.
   * @param {import('playwright').Page} page - A página a ser fechada.
   */
  async closePage(page) {
    if (page) {
      try {
        if (!page.isClosed()) {
          await page.close();
        }
      } catch (error) {
        console.error("❌ Erro ao fechar aba no BrowserManager:", error);
      }
    }
  }

  /**
   * Fecha um contexto de navegação e todas as suas abas de forma segura.
   * @param {import('playwright').BrowserContext} context - O contexto a ser fechado.
   */
  async closeContext(context) {
    if (context) {
      try {
        await context.close();
      } catch (error) {
        console.error("❌ Erro ao fechar contexto no BrowserManager:", error);
      }
    }
  }

  /**
   * Fecha o navegador completamente.
   */
  async shutdown() {
    await SessionManager.close();
  }
}

export default new BrowserManager();
