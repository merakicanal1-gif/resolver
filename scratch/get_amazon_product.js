import { chromium } from "playwright";

async function run() {
  const cdpUrl = "http://127.0.0.1:9222";
  console.log(`Connecting to Chrome via CDP: ${cdpUrl}`);
  const browser = await chromium.connectOverCDP(cdpUrl);
  
  const contexts = browser.contexts();
  const context = contexts[0];
  const page = await context.newPage();
  
  try {
    console.log("Navigating to Amazon Home Page...");
    await page.goto("https://www.amazon.com.br/", { waitUntil: "domcontentloaded", timeout: 20000 });
    
    // Find all links containing "/dp/"
    const productLinks = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a"));
      return anchors
        .map(a => a.href)
        .filter(href => href && href.includes("/dp/"));
    });
    
    console.log("Found product links:", [...new Set(productLinks)].slice(0, 5));
    
  } catch (error) {
    console.error("Error during extraction:", error);
  } finally {
    await page.close();
    await browser.close();
  }
}

run();
