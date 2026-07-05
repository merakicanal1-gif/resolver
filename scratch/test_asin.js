import { chromium } from "playwright";

async function run() {
  const cdpUrl = "http://127.0.0.1:9222";
  console.log(`Connecting to Chrome via CDP: ${cdpUrl}`);
  const browser = await chromium.connectOverCDP(cdpUrl);
  
  const contexts = browser.contexts();
  const context = contexts[0];
  const page = await context.newPage();
  
  try {
    const asins = ["B09WXF987D", "B0B18H86N3", "B0C522VBL6"];
    for (const asin of asins) {
      const url = `https://www.amazon.com.br/dp/${asin}`;
      console.log(`Navigating to ${url}...`);
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      console.log(`ASIN: ${asin} - Status: ${response.status()} - Title: ${await page.title()}`);
    }
  } catch (error) {
    console.error("Error during ASIN tests:", error);
  } finally {
    await page.close();
    await browser.close();
  }
}

run();
