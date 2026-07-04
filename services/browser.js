import { chromium } from "playwright";
import { navegarAteProduto } from "./navigator.js";

export async function abrirPagina(url) {

    console.log("1 - Iniciando");

    const browser = await chromium.launch({
        headless: true
    });

    console.log("2 - Browser aberto");

    const page = await browser.newPage();

    console.log("3 - Nova página");

    await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60000
    });

    console.log("4 - Página carregada");

    const finalUrl = await navegarAteProduto(page);

    console.log("5 - URL:", finalUrl);

    const titulo = await page.title();

    console.log("6 - Título:", titulo);

    await browser.close();

    console.log("7 - Finalizado");

    return {
        url: finalUrl,
        titulo,
        imagem: null
    };
}
