import { chromium } from "playwright";
import { navegarAteProduto } from "./navigator.js";

export async function abrirPagina(url) {

    const browser = await chromium.launch({
        headless: true
    });

    const page = await browser.newPage({
        viewport: {
            width: 1366,
            height: 768
        }
    });

    await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60000
    });

    const finalUrl = await navegarAteProduto(page);

    await page.waitForLoadState("networkidle").catch(() => {});

    if (finalUrl.includes("amazon.")) {

        await page.waitForSelector("#productTitle", {
            timeout: 15000
        }).catch(() => {});

    }

    let titulo = null;
    let imagem = null;

    if (finalUrl.includes("amazon.")) {

        titulo = await page.locator("#productTitle")
            .textContent()
            .catch(() => null);

        titulo = titulo?.trim() || null;

        imagem =
            await page.locator("#landingImage")
            .getAttribute("src")
            .catch(() => null);

        if (!imagem) {

            imagem =
                await page.locator("#imgTagWrapperId img")
                .getAttribute("src")
                .catch(() => null);

        }

    }

    if (!titulo) {

        titulo =
            await page.locator('meta[property="og:title"]')
            .getAttribute("content")
            .catch(() => null);

    }

    if (!imagem) {

        imagem =
            await page.locator('meta[property="og:image"]')
            .getAttribute("content")
            .catch(() => null);

    }

    await browser.close();

    return {

        url: finalUrl,
        titulo,
        imagem

    };

}
