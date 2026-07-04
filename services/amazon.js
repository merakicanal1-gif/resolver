export async function extrairAmazon(page) {

    let titulo = null;
    let imagem = null;

    // TÍTULO

    titulo =
        await page.locator("#productTitle")
            .textContent()
            .catch(() => null);

    if (titulo)
        titulo = titulo.trim();

    if (!titulo) {

        titulo =
            await page.locator("title")
                .textContent()
                .catch(() => null);

        if (titulo)
            titulo = titulo.trim();

    }

    // IMAGEM

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

    if (!imagem) {

        imagem =
            await page.locator('meta[property="og:image"]')
                .getAttribute("content")
                .catch(() => null);

    }

    return {
        titulo,
        imagem
    };

}
