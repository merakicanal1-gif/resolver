import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BROWSERLESS_WSS = "wss://browserless.mymaquina.online?token=resolver123";
const AMAZON_PRODUCT_URL = "https://www.amazon.com.br/dp/B07PFF59NC"; // Echo Dot para teste
const OUTPUT_DIR = "./scratch/debug_logs";

async function run() {
  console.log("🚀 Iniciando script de diagnóstico da Amazon...");
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let browser = null;
  let context = null;
  let page = null;

  try {
    console.log(`🔌 Conectando ao Browserless via WSS: ${BROWSERLESS_WSS}`);
    browser = await chromium.connectOverCDP(BROWSERLESS_WSS);
    console.log("✅ Conectado com sucesso!");

    context = await browser.newContext({
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
      geolocation: { latitude: -23.55052, longitude: -46.633308 },
      permissions: ["geolocation"],
      viewport: { width: 1366, height: 768 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      colorScheme: "light",
      extraHTTPHeaders: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "Upgrade-Insecure-Requests": "1"
      }
    });

    page = await context.newPage();
    console.log(`📡 Navegando para a URL da Amazon: ${AMAZON_PRODUCT_URL}`);

    const networkRequests = [];
    page.on("request", req => {
      networkRequests.push({
        url: req.url(),
        method: req.method(),
        headers: req.headers()
      });
    });

    const response = await page.goto(AMAZON_PRODUCT_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    const finalUrl = page.url();
    console.log(`🏁 Navegação finalizada. URL atual no navegador: ${finalUrl}`);

    // Captura headers da resposta
    const headers = response ? response.headers() : {};
    fs.writeFileSync(path.join(OUTPUT_DIR, "headers.json"), JSON.stringify(headers, null, 2));

    // Captura logs de rede
    fs.writeFileSync(path.join(OUTPUT_DIR, "network.json"), JSON.stringify(networkRequests, null, 2));

    // Captura HTML completo recebido
    const htmlContent = await page.content();
    fs.writeFileSync(path.join(OUTPUT_DIR, "page.html"), htmlContent);
    console.log("💾 HTML da página salvo com sucesso.");

    // Tira Screenshot da tela
    await page.screenshot({ path: path.join(OUTPUT_DIR, "screenshot.png"), fullPage: true });
    console.log("📸 Screenshot da página salvo com sucesso.");

  } catch (error) {
    console.error("❌ Ocorreu um erro durante o diagnóstico:", error);
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    console.log("🧹 Recursos limpos.");
  }
}

run();
