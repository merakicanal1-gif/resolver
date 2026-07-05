import ProviderFactory from "./ProviderFactory.js";
import LifecycleManager from "./LifecycleManager.js";
import BrowserHealthManager from "./BrowserHealthManager.js";
import config from "../../config/index.js";

class BrowserManager {
  constructor() {
    // Instancia o provedor de forma única no boot da aplicação
    this._provider = ProviderFactory.getProvider();

    // Logs temporários de auditoria solicitados pelo usuário
    console.log("--------------------------------------------------");
    console.log("🚀 [BOOT_LOGS] Auditoria de Inicialização do Browser:");
    console.log(`- BROWSER_PROVIDER no process.env: ${process.env.BROWSER_PROVIDER || "não definido"}`);
    console.log(`- BROWSER_PROVIDER no config: ${config.browser.provider}`);
    console.log(`- CHROME_CDP_URL no process.env: ${process.env.CHROME_CDP_URL || "não definido"}`);
    console.log(`- BROWSERLESS_WS_ENDPOINT no process.env: ${process.env.BROWSERLESS_WS_ENDPOINT || "não definido"}`);
    console.log(`- Provedor Escolhido: ${this._provider.constructor.name}`);
    console.log("--------------------------------------------------");
  }

  /**
   * Retorna o Provedor ativo.
   */
  get provider() {
    return this._provider;
  }

  /**
   * Obtém a instância ativa do browser do Playwright.
   * @returns {Promise<import('playwright').Browser>}
   */
  async getBrowser() {
    return await LifecycleManager.getBrowser(this._provider);
  }

  /**
   * Cria ou reutiliza o contexto de navegação.
   * Obtém a instância do browser automaticamente caso seja omitida.
   * @param {import('playwright').Browser} [browser]
   * @returns {Promise<import('playwright').BrowserContext>}
   */
  async createContext(browser = null) {
    let activeBrowser = browser;
    if (!activeBrowser) {
      activeBrowser = await this.getBrowser();
    }
    return await LifecycleManager.createContext(this._provider, activeBrowser);
  }

  /**
   * Abre uma nova aba (página).
   * @param {import('playwright').BrowserContext} context 
   * @returns {Promise<import('playwright').Page>}
   */
  async createPage(context) {
    return await LifecycleManager.createPage(this._provider, context);
  }

  /**
   * Fecha uma aba de forma segura.
   * @param {import('playwright').Page} page 
   */
  async closePage(page) {
    await LifecycleManager.closePage(this._provider, page);
  }

  /**
   * Fecha o contexto de navegação de forma segura.
   * @param {import('playwright').BrowserContext} context 
   */
  async closeContext(context) {
    await LifecycleManager.closeContext(this._provider, context);
  }

  /**
   * Realiza a verificação de saúde do navegador através de ping CDP.
   * Totalmente agnóstico ao provedor.
   * @returns {Promise<object>} Dados de saúde e conectividade.
   */
  async checkHealth() {
    try {
      const browser = await this.getBrowser();
      return await BrowserHealthManager.checkHealth(browser);
    } catch (error) {
      return {
        connected: false,
        lastPingMs: -1,
        lastPingTimestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Encerra conexões CDP ativas no desligamento da API.
   */
  async shutdown() {
    try {
      const browser = await this.getBrowser();
      await LifecycleManager.closeBrowser(this._provider, browser);
    } catch (error) {
      // Ignora falhas de desligamento se o navegador já estiver inativo
    }
  }
}

export default new BrowserManager();
