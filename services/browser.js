import { chromium } from "playwright";
import { navegarAteProduto } from "./navigator.js";

const BROWSERLESS =
    "ws://browserless_browserless?token=resolver123";

export async function abrirPagina(url) {

    const browser = await chromium.connectOverCDP(BROWSERLESS);

    let context = browser.contexts()[0];

    if (!context) {
        context = await browser.newContext({
            locale: "pt-BR"
        });
    }

    const page = await context.newPage();

    await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60000
    });

    const finalUrl = await navegarAteProduto(page);

    const titulo = await page.title().catch(() => null);

    await page.close();

    return {
        url: finalUrl,
        titulo,
        imagem: null
    };
}
