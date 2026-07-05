import { chromium } from "playwright";

async function run() {
  const cdpUrl = "http://127.0.0.1:9222";
  console.log(`Connecting to Chrome via CDP: ${cdpUrl}`);
  const browser = await chromium.connectOverCDP(cdpUrl);
  
  const contexts = browser.contexts();
  const context = contexts[0];
  const page = await context.newPage();
  
  try {
    console.log("Searching Google for meli.la product links...");
    // Let's search site:youtube.com "meli.la" "produto" "MLB"
    await page.goto("https://www.google.com/search?q=site:youtube.com+%22meli.la%22+%22MLB%22", { waitUntil: "domcontentloaded", timeout: 20000 });
    
    const text = await page.innerText("body");
    const meliMatches = text.match(/meli\.la\/[a-zA-Z0-9]+/g) || [];
    console.log("Found meli.la product links in search results:", [...new Set(meliMatches)]);
  } catch (error) {
    console.error("Error during search:", error);
  } finally {
    await page.close();
    await browser.close();
  }
}

run();
