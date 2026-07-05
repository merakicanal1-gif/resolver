import logger from "../../utils/logger.js";

class BrowserHealthManager {
  constructor() {
    this.lastPingMs = -1;
    this.lastPingTimestamp = null;
  }

  /**
   * Verifica passivamente e ativamente a saúde da conexão do navegador Playwright.
   * Não altera estado nem reconecta. Apenas reporta integridade técnica de baixo nível.
   * @param {import('playwright').Browser} browser - Instância ativa a ser validada.
   * @returns {Promise<{ connected: boolean, lastPingMs: number, lastPingTimestamp: string, version?: string, error?: string }>}
   */
  async checkHealth(browser) {
    if (!browser) {
      return {
        connected: false,
        lastPingMs: -1,
        lastPingTimestamp: new Date().toISOString(),
        error: "Nenhum navegador carregado."
      };
    }

    // Checagem passiva rápida do Playwright
    if (!browser.isConnected()) {
      return {
        connected: false,
        lastPingMs: -1,
        lastPingTimestamp: new Date().toISOString(),
        error: "Conexão CDP fechada (isConnected retornou false)."
      };
    }

    const start = Date.now();
    try {
      // Checagem ativa (ping real de rede do socket CDP do Chromium)
      const version = await browser.version();
      const duration = Date.now() - start;

      this.lastPingMs = duration;
      this.lastPingTimestamp = new Date().toISOString();

      return {
        connected: true,
        lastPingMs: duration,
        lastPingTimestamp: this.lastPingTimestamp,
        version
      };
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(`❌ [HEALTH_CHECK] Falha no ping CDP do navegador após ${duration}ms:`, error);
      
      return {
        connected: false,
        lastPingMs: duration,
        lastPingTimestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Retorna os últimos dados conhecidos de latência/saúde do ping.
   */
  getInspectionData() {
    return {
      lastPingMs: this.lastPingMs,
      lastPingTimestamp: this.lastPingTimestamp
    };
  }
}

export default new BrowserHealthManager();
