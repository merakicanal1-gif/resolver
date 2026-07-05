import { chromium } from "playwright";

async function run() {
  console.log("Searching for live links...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto("https://html.duckduckgo.com/html/?q=site:youtube.com+%22meli.la%22", { waitUntil: "domcontentloaded" });
    const text = await page.innerText("body");
    const meliMatches = text.match(/meli\.la\/[a-zA-Z0-9]+/g) || [];
    console.log("Found meli.la matches:", [...new Set(meliMatches)]);

    await page.goto("https://html.duckduckgo.com/html/?q=site:youtube.com+%22shope.ee%22", { waitUntil: "domcontentloaded" });
    const textShopee = await page.innerText("body");
    const shopeeMatches = textShopee.match(/shope\.ee\/[a-zA-Z0-9]+/g) || [];
    console.log("Found shope.ee matches:", [...new Set(shopeeMatches)]);
  } catch (error) {
    console.error("Error finding links:", error);
  } finally {
    await browser.close();
  }
}

run();
