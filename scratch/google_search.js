import { chromium } from "playwright";

async function run() {
  const cdpUrl = "http://127.0.0.1:9222";
  console.log(`Connecting to Chrome via CDP: ${cdpUrl}`);
  const browser = await chromium.connectOverCDP(cdpUrl);
  
  const contexts = browser.contexts();
  if (contexts.length === 0) {
    console.error("No contexts found!");
    await browser.close();
    return;
  }
  const context = contexts[0];
  const page = await context.newPage();
  
  try {
    console.log("Searching Google for meli.la links using physical Chrome...");
    await page.goto("https://www.google.com/search?q=site:youtube.com+%22meli.la%2F%22", { waitUntil: "domcontentloaded", timeout: 20000 });
    
    // Extract matches from search results
    const text = await page.innerText("body");
    const meliMatches = text.match(/meli\.la\/[a-zA-Z0-9]+/g) || [];
    console.log("Found meli.la links in search results:", [...new Set(meliMatches)]);

    console.log("Searching Google for shope.ee links...");
    await page.goto("https://www.google.com/search?q=site:youtube.com+%22shope.ee%2F%22", { waitUntil: "domcontentloaded", timeout: 20000 });
    const textShopee = await page.innerText("body");
    const shopeeMatches = textShopee.match(/shope\.ee\/[a-zA-Z0-9]+/g) || [];
    console.log("Found shope.ee links in search results:", [...new Set(shopeeMatches)]);
    
  } catch (error) {
    console.error("Error during search:", error);
  } finally {
    await page.close();
    await browser.close();
  }
}

run();
