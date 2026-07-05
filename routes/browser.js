import { Router } from "express";
import BrowserManager from "../src/core/browser/BrowserManager.js";
import config from "../src/config/index.js";

const router = Router();

router.get("/inspect", async (req, res) => {
  const inicio = Date.now();
  let browser = null;

  try {
    browser = await BrowserManager.getBrowser();
    const health = await BrowserManager.checkHealth();
    const browserVersion = health.connected ? health.version : "N/A";
    
    // Contagem de contextos e abas
    const contextsCount = browser.contexts().length;
    let pagesCount = 0;
    let urlFinal = "N/A";
    let title = "N/A";
    let authenticated = false;
    
    if (contextsCount > 0) {
      const context = browser.contexts()[0];
      const pages = context.pages();
      pagesCount = pages.length;
      if (pagesCount > 0) {
        const page = pages[pages.length - 1]; // Última página aberta
        urlFinal = page.url();
        title = await page.title().catch(() => "N/A");
        
        // Verifica autenticação (ex: no Mercado Livre)
        const usernameSelectorExists = await page.$(".nav-header-username").then(el => !!el).catch(() => false);
        const userMenuExists = await page.$(".nav-header-user-menu").then(el => !!el).catch(() => false);
        authenticated = usernameSelectorExists || userMenuExists;
      }
    }

    const capabilities = BrowserManager.provider.capabilities;
    const elapsedMs = Date.now() - inicio;

    res.json({
      success: true,
      provider: config.browser.provider,
      connected: health.connected,
      version: browserVersion,
      contexts: contextsCount,
      pages: pagesCount,
      pagina_atual: {
        url: urlFinal,
        title,
        authenticated
      },
      perfil_utilizado: capabilities.supportsPersistentContext ? "Physical Chrome Profile" : "Incognito (Browserless)",
      tempo_conexao_ms: elapsedMs,
      saude_conexao: {
        connected: health.connected,
        lastPingMs: health.lastPingMs,
        lastPingTimestamp: health.lastPingTimestamp,
        error: health.error || null
      }
    });

  } catch (e) {
    res.status(500).json({
      success: false,
      provider: config.browser.provider,
      connected: false,
      error: e.message,
      stack: e.stack,
      tempo_conexao_ms: Date.now() - inicio
    });
  }
});

export default router;
