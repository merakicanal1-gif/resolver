import { chromium } from "playwright";

async function run() {
  const cdpUrl = "http://127.0.0.1:9222";
  console.log(`Connecting to Chrome via CDP: ${cdpUrl}`);
  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0];
  const page = await context.newPage();
  
  try {
    const url = "https://lista.mercadolivre.com.br/adaptador-conversor-hdmi-para-vga-com-saida-de-audio-p2";
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(3000); // Wait for dynamic content
    
    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a"));
      return anchors
        .map(a => ({ text: a.innerText, href: a.href }))
        .filter(item => item.href && (item.href.includes("MLB") || item.href.includes("click")));
    });
    
    console.log("Found matches:", links.slice(0, 15));
  } finally {
    await page.close();
    await browser.close();
  }
}

run();
