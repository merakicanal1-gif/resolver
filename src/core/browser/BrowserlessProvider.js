import { chromium } from "playwright";
import config from "../../config/index.js";
import logger from "../../utils/logger.js";

class BrowserlessProvider {
  constructor() {
    this._browser = null;
    this._connectingPromise = null;
  }

  /**
   * Retorna as capacidades (capabilities) do provedor do Browserless.
   */
  get capabilities() {
    return {
      supportsPersistentContext: false,
      supportsScreenshots: true,
      closeBrowserOnShutdown: true // Fecha o browser para liberar recursos do container
    };
  }

  /**
   * Conecta ao Browserless remoto via WebSocket CDP.
   * Reutiliza a conexão se estiver ativa.
   * @returns {Promise<import('playwright').Browser>}
   */
  async getBrowser() {
    if (this._browser && this._browser.isConnected()) {
      return this._browser;
    }

    if (this._connectingPromise) {
      return this._connectingPromise;
    }

    const wsEndpoint = config.browserless.wsEndpoint;

    this._connectingPromise = (async () => {
      try {
        logger.info(`🔌 [BROWSERLESS_PROVIDER] Conectando ao Browserless via WebSocket: ${wsEndpoint}`);
        const browser = await chromium.connectOverCDP(wsEndpoint);
        this._browser = browser;

        browser.on("disconnected", () => {
          logger.warn("⚠️ [BROWSERLESS_PROVIDER] Conexão com o Browserless encerrada.");
          this._browser = null;
        });

        logger.info("✅ [BROWSERLESS_PROVIDER] Conectado com sucesso ao Browserless.");
        return browser;
      } catch (error) {
        logger.error(`❌ [BROWSERLESS_PROVIDER] Falha ao conectar ao Browserless em ${wsEndpoint}:`, error);
        throw error;
      } finally {
        this._connectingPromise = null;
      }
    })();

    return this._connectingPromise;
  }

  /**
   * Encerra a conexão com o Browserless de forma limpa.
   */
  async close() {
    if (this._browser) {
      try {
        await this._browser.close();
      } catch (error) {
        logger.error("❌ [BROWSERLESS_PROVIDER] Erro ao fechar conexão com Browserless:", error);
      } finally {
        this._browser = null;
      }
    }
  }
}

export default new BrowserlessProvider();
