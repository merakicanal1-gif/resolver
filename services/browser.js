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

    // Pequena espera apenas para o HTML terminar de montar
    await page.waitForTimeout(2000);

    const dados = await page.evaluate(() => {

        const meta = (nome) => {
            return document
                .querySelector(`meta[property="${nome}"], meta[name="${nome}"]`)
                ?.content || null;
        };

        return {

            titulo:
                meta("og:title") ||
                document.title ||
                null,

            imagem:
    meta("og:image") ||
    document.querySelector('img[data-old-hires]')?.getAttribute('data-old-hires') ||
    document.querySelector('#landingImage')?.getAttribute('src') ||
    document.querySelector('#imgBlkFront')?.getAttribute('src') ||
    document.querySelector('img')?.getAttribute('src') ||
    null

        };

    });

    await browser.close();

    return {

        url: finalUrl,

        titulo: dados.titulo,

        imagem: dados.imagem

    };

}
