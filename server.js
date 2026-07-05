import express from "express";
import dotenv from "dotenv";
import resolveRoute from "./routes/resolve.js";
import BrowserManager from "./src/core/browser/BrowserManager.js";
import config from "./src/config/index.js";

dotenv.config();

const app = express();

app.use(express.json());

app.use("/resolve", resolveRoute);

// ROTA TEMPORÁRIA DA ETAPA 1 (Acessível na raiz em GET /debug/chrome)
app.get("/debug/chrome", async (req, res) => {
  const inicio = Date.now();
  let browser = null;
  let context = null;
  let page = null;

  try {
    // 1. Conectar ao Chrome utilizando CHROME_CDP_URL
    browser = await BrowserManager.getBrowser();
    
    // 2. Obter contexto persistente existente
    context = await BrowserManager.createContext(browser);
    
    // 3. Abrir nova Page (aba)
    page = await BrowserManager.createPage(context);
    
    // 4. Navegar para o Mercado Livre
    await page.goto("https://www.mercadolivre.com.br/", {
      waitUntil: "domcontentloaded",
      timeout: 20000
    });

    // 5. Coletar as informações solicitadas
    const urlFinal = page.url();
    const title = await page.title();

    // Verifica autenticação com elementos visíveis apenas para usuários logados
    const usernameSelectorExists = await page.$(".nav-header-username").then(el => !!el);
    const userMenuExists = await page.$(".nav-header-user-menu").then(el => !!el);
    const authenticated = usernameSelectorExists || userMenuExists;

    const capabilities = BrowserManager.provider.capabilities;
    const browserVersion = await browser.version();
    const contextsCount = browser.contexts().length;
    const pagesCount = context.pages().length;

    const elapsedMs = Date.now() - inicio;

    res.json({
      success: true,
      provider: config.browser.provider,
      browserVersion,
      contextsCount,
      pagesCount,
      url: urlFinal,
      title,
      authenticated,
      persistentContext: capabilities.supportsPersistentContext,
      elapsedMs
    });

  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message,
      stack: e.stack,
      elapsedMs: Date.now() - inicio
    });
  } finally {
    // 9. Fechar apenas a aba criada
    if (page) {
      await BrowserManager.closePage(page).catch(() => {});
    }
    // NUNCA fecha browser ou contexto persistente do Chrome
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Resolver iniciado na porta ${PORT}`);
});
