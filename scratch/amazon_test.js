import { chromium } from "playwright";

async function run() {
  const cdpUrl = "http://127.0.0.1:9222";
  console.log(`Connecting to Chrome via CDP: ${cdpUrl}`);
  const browser = await chromium.connectOverCDP(cdpUrl);
  
  // Reuses the default context
  const contexts = browser.contexts();
  if (contexts.length === 0) {
    console.error("No contexts found!");
    await browser.close();
    return;
  }
  const context = contexts[0];
  const page = await context.newPage();
  
  try {
    console.log("Navigating to Amazon Home Page...");
    const response = await page.goto("https://www.amazon.com.br/", {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });
    
    console.log(`Response status: ${response ? response.status() : "no response"}`);
    
    const title = await page.title();
    console.log(`Page title: ${title}`);
    
    const isCaptcha = title.includes("CAPTCHA") || title.includes("Bot") || title.includes("Robot") || title.includes("Desculpe") || title.includes("Estamos com problemas");
    console.log(`Is CAPTCHA or error page: ${isCaptcha}`);
    
    // Take a screenshot to inspect
    const screenshotPath = "/home/emerson/Documentos/Meus Desenvolvimentos/resolver-main/scratch/amazon_screenshot.png";
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot saved to ${screenshotPath}`);
    
  } catch (error) {
    console.error("Error during navigation:", error);
  } finally {
    await page.close();
    await browser.close();
  }
}

run();
