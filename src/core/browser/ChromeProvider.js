import { chromium } from "playwright";
import config from "../../config/index.js";
import logger from "../../utils/logger.js";

class ChromeProvider {
  constructor() {
    this._browser = null;
    this._connectingPromise = null;
  }

  /**
   * Retorna as capacidades (capabilities) do provedor do Chrome.
   */
  get capabilities() {
    return {
      supportsPersistentContext: true,
      supportsScreenshots: true,
      closeBrowserOnShutdown: false // Não derruba o navegador local
    };
  }

  /**
   * Conecta ao Google Chrome físico via CDP.
   * Reutiliza a conexão existente se estiver ativa.
   * @returns {Promise<import('playwright').Browser>}
   */
  async getBrowser() {
    if (this._browser && this._browser.isConnected()) {
      return this._browser;
    }

    if (this._connectingPromise) {
      return this._connectingPromise;
    }

    const cdpUrl = config.chrome?.cdpUrl || "http://127.0.0.1:9222";

    this._connectingPromise = (async () => {
      try {
        logger.info(`🔌 [CHROME_PROVIDER] Conectando ao Google Chrome local via CDP: ${cdpUrl}`);
        const browser = await chromium.connectOverCDP(cdpUrl);
        this._browser = browser;

        browser.on("disconnected", () => {
          logger.warn("⚠️ [CHROME_PROVIDER] Conexão com o Google Chrome local encerrada.");
          this._browser = null;
        });

        logger.info("✅ [CHROME_PROVIDER] Conectado com sucesso ao Chrome local.");
        return browser;
      } catch (error) {
        logger.error(`❌ [CHROME_PROVIDER] Falha ao conectar ao Chrome local em ${cdpUrl}:`, error);
        throw error;
      } finally {
        this._connectingPromise = null;
      }
    })();

    return this._connectingPromise;
  }

  /**
   * Força a desconexão do browser para limpeza.
   */
  async close() {
    if (this._browser) {
      try {
        await this._browser.close();
      } catch (error) {
        logger.error("❌ [CHROME_PROVIDER] Erro ao fechar conexão:", error);
      } finally {
        this._browser = null;
      }
    }
  }
}

export default new ChromeProvider();
