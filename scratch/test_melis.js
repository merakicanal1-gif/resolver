import { chromium } from "playwright";

async function run() {
  const cdpUrl = "http://127.0.0.1:9222";
  console.log(`Connecting to Chrome via CDP: ${cdpUrl}`);
  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0];
  const page = await context.newPage();

  const links = [
    "15L9qKj",
    "1D6FSDQ",
    "2SdMA3c",
    "1UzxSRV",
    "2qX2adZ",
    "1GhmQX6",
    "1VFyp9r",
    "1dKGaKp",
    "14B1SQ5",
    "1CzVe3g",
    "1CUFnUQ",
    "11s7wJD",
    "1Y92pDW"
  ];

  try {
    for (const code of links) {
      const url = `https://meli.la/${code}`;
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
