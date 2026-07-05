import logger from "../../utils/logger.js";
import ContextFactory from "./ContextFactory.js";
import BrowserHealthManager from "./BrowserHealthManager.js";

class LifecycleManager {
  /**
   * Obtém a instância do browser conectada.
   * @param {object} provider - O provedor de browser ativo.
   * @returns {Promise<import('playwright').Browser>}
   */
  async getBrowser(provider) {
    logger.info("🔌 [LIFECYCLE] Requisitando instância do navegador do provedor...");
    return await provider.getBrowser();
  }

  /**
   * Cria ou obtém o contexto do browser conforme as capacidades do provedor.
   * @param {object} provider - O provedor de browser ativo.
   * @param {import('playwright').Browser} browser - Instância ativa do Playwright.
   * @returns {Promise<import('playwright').BrowserContext>}
   */
  async createContext(provider, browser) {
    const caps = provider.capabilities;

    if (caps.supportsPersistentContext) {
      logger.info("📂 [LIFECYCLE] Reutilizando contexto padrão (perfil físico do Chrome)...");
      const contexts = browser.contexts();
      if (contexts.length === 0) {
        throw new Error("Nenhum contexto de perfil físico encontrado no Chrome conectado via CDP.");
      }
      return contexts[0];
    }

    logger.info("🆕 [LIFECYCLE] Criando novo contexto incógnito isolado...");
    return await ContextFactory.createContext(browser);
  }

  /**
   * Cria uma nova página (aba) dentro do contexto.
   * @param {object} provider - O provedor de browser ativo.
   * @param {import('playwright').BrowserContext} context - Contexto ativo do Playwright.
   * @returns {Promise<import('playwright').Page>}
   */
  async createPage(provider, context) {
    logger.info("📄 [LIFECYCLE] Criando nova aba (Page) no contexto...");
    return await context.newPage();
  }

  /**
   * Fecha de forma segura uma página (aba).
   * @param {object} provider - O provedor de browser ativo.
   * @param {import('playwright').Page} page - A página a ser fechada.
   */
  async closePage(provider, page) {
    if (page) {
      try {
        if (!page.isClosed()) {
          logger.info("🧹 [LIFECYCLE] Fechando aba (Page) de forma segura...");
          await page.close();
        }
      } catch (error) {
        logger.error("❌ [LIFECYCLE] Erro ao fechar aba:", error);
      }
    }
  }

  /**
   * Fecha de forma segura um contexto de navegação.
   * Respeita as capacidades do provedor (nunca fecha o contexto persistente do Chrome físico).
   * @param {object} provider - O provedor de browser ativo.
   * @param {import('playwright').BrowserContext} context - O contexto a ser fechado.
   */
  async closeContext(provider, context) {
    if (context) {
      const caps = provider.capabilities;
      if (caps.supportsPersistentContext) {
        logger.info("🔒 [LIFECYCLE] Ignorando fechamento de contexto (mantendo perfil físico aberto)...");
        return;
      }

      try {
        logger.info("🧹 [LIFECYCLE] Fechando contexto de navegação isolado...");
        await context.close();
      } catch (error) {
        logger.error("❌ [LIFECYCLE] Erro ao fechar contexto:", error);
      }
    }
  }

  /**
   * Fecha completamente a conexão com o navegador.
   * Respeita as capacidades do provedor (não encerra o processo do Chrome físico).
   * @param {object} provider - O provedor de browser ativo.
   * @param {import('playwright').Browser} browser - O navegador a ser desconectado/fechado.
   */
  async closeBrowser(provider, browser) {
    if (browser) {
      const caps = provider.capabilities;
      if (!caps.closeBrowserOnShutdown) {
        logger.info("🔌 [LIFECYCLE] Desconectando da sessão CDP (mantendo navegador rodando)...");
        // Desconecta a sessão CDP
        try {
          await browser.close();
        } catch (error) {
          logger.error("❌ [LIFECYCLE] Erro ao desconectar do CDP:", error);
        }
        return;
      }

      try {
        logger.info("🛑 [LIFECYCLE] Fechando navegador completamente...");
        await browser.close();
      } catch (error) {
        logger.error("❌ [LIFECYCLE] Erro ao fechar navegador:", error);
      }
    }
  }
}

export default new LifecycleManager();
