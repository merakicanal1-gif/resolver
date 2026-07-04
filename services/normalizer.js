export function normalizar(url) {

    const u = new URL(url);

    u.hash = "";

    // AMAZON
    if (u.hostname.includes("amazon")) {

        u.search = "";

        const dp = u.pathname.match(/\/dp\/([A-Z0-9]{10})/i);

        if (dp) {
            u.pathname = "/dp/" + dp[1];
        }

        return u.toString();
    }

    // MERCADO LIVRE
    if (u.hostname.includes("mercadolivre")) {

        u.search = "";

        const mlb = u.pathname.match(/(MLB-\d+)/i);

        if (mlb) {
            u.pathname = "/" + mlb[1];
        }

        return "https://produto.mercadolivre.com.br" + u.pathname;
    }

    // SHOPEE
    if (u.hostname.includes("shopee")) {

        u.search = "";

        return u.toString();
    }

    u.search = "";

    return u.toString();

}
