export async function navegarAteProduto(page) {

    const DOMINIOS_FINAIS = [
        "amazon.",
        "mercadolivre.",
        "shopee.",
        "magazineluiza.",
        "magalu.",
        "kabum.",
        "casasbahia.",
        "aliexpress.",
        "terabyteshop.",
        "pichau.",
        "carrefour.",
        "extra.",
        "pontofrio."
    ];

    for (let tentativa = 0; tentativa < 10; tentativa++) {

        await page.waitForTimeout(2000);

        const atual = page.url();

        if (DOMINIOS_FINAIS.some(d => atual.includes(d))) {
            return atual;
        }

        const links = await page.locator("a").evaluateAll(els =>
            els.map(el => ({
                href: el.href || "",
                texto: (el.innerText || "").trim()
            }))
        );

        const candidato = links.find(link =>
            DOMINIOS_FINAIS.some(d => link.href.includes(d))
        );

        if (candidato) {

            await page.goto(candidato.href, {
                waitUntil: "domcontentloaded",
                timeout: 60000
            });

            continue;
        }

    }

    return page.url();

}
