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
    console.log("Navigating to diagnostic page...");
    // Let's use a public IP API to check our IP and a blank page for fingerprinting
    await page.goto("https://httpbin.org/headers", { waitUntil: "domcontentloaded", timeout: 20000 });
    const headersContent = await page.locator("body").innerText();
    console.log("\n--- Received Headers on Server ---");
    console.log(headersContent);
    
    await page.goto("https://api.ipify.org?format=json", { waitUntil: "domcontentloaded", timeout: 20000 });
    const ipContent = await page.locator("body").innerText();
    console.log("\n--- IP Address ---");
    console.log(ipContent);

    // Evaluate extensive fingerprint attributes on the page
    const fingerprint = await page.evaluate(() => {
      // WebGL parameters
      let webglVendor = "N/A";
      let webglRenderer = "N/A";
      try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (gl) {
          const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
          if (debugInfo) {
            webglVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
            webglRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          }
        }
      } catch (e) {
        // ignore
      }

      // Client hints
      let brands = null;
      let mobile = null;
      let platform = null;
      if (navigator.userAgentData) {
        brands = navigator.userAgentData.brands;
        mobile = navigator.userAgentData.mobile;
        platform = navigator.userAgentData.platform;
      }

      return {
        userAgent: navigator.userAgent,
        webdriver: navigator.webdriver,
        languages: navigator.languages,
        language: navigator.language,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: navigator.deviceMemory,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        webglVendor,
        webglRenderer,
        brands,
        mobile,
        platform,
        pluginsLength: navigator.plugins ? navigator.plugins.length : 0,
      };
    });

    console.log("\n--- Browser Fingerprint (Physical Chrome) ---");
    console.log(JSON.stringify(fingerprint, null, 2));

    // Cookies check
    const cookies = await context.cookies();
    console.log(`\nTotal cookies in context: ${cookies.length}`);
    
  } catch (error) {
    console.error("Error during diagnostics:", error);
  } finally {
    await page.close();
    await browser.close();
  }
}

run();
