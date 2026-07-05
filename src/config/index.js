import dotenv from "dotenv";

// Carrega as variáveis do ambiente
dotenv.config();

const provider = process.env.BROWSER_PROVIDER || "browserless";
const normalizedProvider = provider.toLowerCase().trim();

// Validações estritas baseadas no Provider ativo
if (normalizedProvider === "chrome") {
  if (!process.env.CHROME_CDP_URL) {
    throw new Error("❌ Erro crítico: BROWSER_PROVIDER está definido como 'chrome', mas a variável 'CHROME_CDP_URL' não está configurada no .env.");
  }
} else if (normalizedProvider === "browserless") {
  if (!process.env.BROWSERLESS_WS_ENDPOINT) {
    throw new Error("❌ Erro crítico: BROWSER_PROVIDER está definido como 'browserless', mas a variável 'BROWSERLESS_WS_ENDPOINT' não está configurada no .env.");
  }
} else {
  throw new Error(`❌ Erro crítico: BROWSER_PROVIDER desconhecido: "${provider}". Opções válidas: "chrome", "browserless".`);
}

const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  
  browser: {
    provider: normalizedProvider
  },
  
  chrome: {
    cdpUrl: process.env.CHROME_CDP_URL || "http://127.0.0.1:9222"
  },
  
  browserless: {
    wsEndpoint: process.env.BROWSERLESS_WS_ENDPOINT
  },

  diagnostics: {
    debug: process.env.DEBUG === "true",
    logLevel: process.env.LOG_LEVEL || "info",
    saveHtml: process.env.SAVE_HTML !== "false", // default true
    saveScreenshot: process.env.SAVE_SCREENSHOT !== "false", // default true
    saveNetwork: process.env.SAVE_NETWORK !== "false" // default true
  },
  
  timeouts: {
    resolution: parseInt(process.env.TIMEOUT_RESOLUTION || "20000", 10),
    extraction: parseInt(process.env.TIMEOUT_EXTRACTION || "15000", 10),
    defaultNavigation: parseInt(process.env.TIMEOUT_NAVIGATION || "10000", 10),
  }
};

export default Object.freeze(config);
