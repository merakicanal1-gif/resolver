import { chromium } from "playwright";

async function run() {
  const cdpUrl = "http://127.0.0.1:9222";
  console.log(`Connecting to Chrome via CDP: ${cdpUrl}`);
  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0];
  const page = await context.newPage();

  const links = [
    "4Ae01i5wNK",
    "3ff4BvVK8A",
    "8KQRBt054c",
    "qKOC1OW6y",
    "6ABWY3Yp3Q"
  ];

  try {
    for (const code of links) {
      const url = `https://shope.ee/${code}`;
      console.log(`Testing ${url}...`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
      const finalUrl = page.url();
      console.log(`Final URL for ${code}: ${finalUrl}`);
    }
  } finally {
    await page.close();
    await browser.close();
  }
}

run();
