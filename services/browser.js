import { chromium } from "playwright";
import { navegarAteProduto } from "./navigator.js";
import { extrairAmazon } from "./amazon.js";

const BROWSERLESS = "ws://browserless_browserless?token=resolver123";

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

    let titulo = null;
    let imagem = null;

    if (finalUrl.includes("amazon.")) {

        // Espera o conteúdo principal aparecer
        await page.waitForTimeout(3000);

        const dados = await extrairAmazon(page);

        titulo = dados.titulo;
        imagem = dados.imagem;
    }

    await page.close();

    return {
        url: finalUrl,
        titulo,
        imagem
    };
}
