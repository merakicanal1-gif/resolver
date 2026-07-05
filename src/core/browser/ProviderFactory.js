import config from "../../config/index.js";
import ChromeProvider from "./ChromeProvider.js";
import BrowserlessProvider from "./BrowserlessProvider.js";
import logger from "../../utils/logger.js";

class ProviderFactory {
  /**
   * Instancia e retorna o provedor de browser configurado.
   * Lança erro explícito se a configuração for inválida ou desconhecida.
   * @returns {object} O provedor satisfazendo a interface BrowserProvider.
   */
  getProvider() {
    const providerName = process.env.BROWSER_PROVIDER || config.browser?.provider;

    if (!providerName) {
      const errMsg = "❌ [PROVIDER_FACTORY] A variável BROWSER_PROVIDER não está configurada no ambiente (.env).";
      logger.error(errMsg);
      throw new Error(errMsg);
    }

    const normalized = providerName.toLowerCase().trim();

    if (normalized === "chrome") {
      logger.info("🎯 [PROVIDER_FACTORY] Utilizando Provedor de Navegador: Chrome (CDP Local)");
      return ChromeProvider;
    }

    if (normalized === "browserless") {
      logger.info("🎯 [PROVIDER_FACTORY] Utilizando Provedor de Navegador: Browserless (WebSocket)");
      return BrowserlessProvider;
    }

    const errMsg = `❌ [PROVIDER_FACTORY] Provedor de navegador desconhecido: "${providerName}". Opções válidas: "chrome", "browserless".`;
    logger.error(errMsg);
    throw new Error(errMsg);
  }
}

export default new ProviderFactory();
