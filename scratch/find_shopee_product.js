import { chromium } from "playwright";

async function run() {
  const cdpUrl = "http://127.0.0.1:9222";
  console.log(`Connecting to Chrome via CDP: ${cdpUrl}`);
  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0];
  const page = await context.newPage();
  
  try {
    console.log("Searching Google for Shopee...");
    await page.goto("https://www.google.com/search?q=site:shopee.com.br+%22product-i.%22", { waitUntil: "domcontentloaded", timeout: 20000 });
    
    const text = await page.innerText("body");
    const matches = text.match(/shopee\.com\.br\/[^\s\"']+/g) || [];
    console.log("Found Shopee matches in body:", [...new Set(matches)].slice(0, 10));
    
  } catch (error) {
    console.error("Error during Shopee search:", error);
  } finally {
    await page.close();
    await browser.close();
  }
}

run();
