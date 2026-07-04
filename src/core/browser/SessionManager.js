import { chromium } from "playwright";
import config from "../../config/index.js";

class SessionManager {
  constructor() {
    this._browser = null;
    this._connectingPromise = null;
  }

  /**
   * Obtém a instância ativa do navegador conectado via CDP.
   * Se a conexão não existir ou estiver fechada, tenta estabelecer uma nova.
   * @returns {Promise<import('playwright').Browser>}
   */
  async getBrowser() {
    // Se já houver um browser conectado e ativo, retorna
    if (this._browser && this._browser.isConnected()) {
      return this._browser;
    }

    // Se já estiver em processo de conexão, retorna a promise existente
    if (this._connectingPromise) {
      return this._connectingPromise;
    }

    this._connectingPromise = (async () => {
      try {
        console.log(`🔌 Conectando ao Browserless via CDP: ${config.browserless.url}`);
        const browser = await chromium.connectOverCDP(config.browserless.url);
        this._browser = browser;
        
        // Listener para logar se a conexão com o browser for perdida
        browser.on("disconnected", () => {
          console.warn("⚠️ Conexão com o Browserless foi encerrada.");
          this._browser = null;
        });

        return browser;
      } catch (error) {
        console.error("❌ Erro ao conectar ao Browserless:", error);
        throw error;
      } finally {
        this._connectingPromise = null;
      }
    })();

    return this._connectingPromise;
  }

  /**
   * Encerra a conexão com o navegador.
   */
  async close() {
    if (this._browser) {
      try {
        await this._browser.close();
      } catch (error) {
        console.error("❌ Erro ao fechar o navegador no SessionManager:", error);
      } finally {
        this._browser = null;
      }
    }
  }
}

// Exportamos uma única instância do SessionManager (Singleton) para gerenciar a conexão globalmente
export default new SessionManager();
