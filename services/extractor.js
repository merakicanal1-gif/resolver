export function extrairIdProduto(url) {

    const u = new URL(url);

    // AMAZON
    if (u.hostname.includes("amazon")) {

        const match = u.pathname.match(/\/dp\/([A-Z0-9]{10})/i);

        if (match) {

            return {

                marketplace: "amazon",

                produto_id: match[1]

            };

        }

    }

    // MERCADO LIVRE

    if (u.hostname.includes("mercadolivre")) {

        const match = u.pathname.match(/(MLB-\d+)/i);

        if (match) {

            return {

                marketplace: "mercadolivre",

                produto_id: match[1]

            };

        }

    }

    // SHOPEE

    if (u.hostname.includes("shopee")) {

        const match = u.pathname.match(/i\.(\d+)\.(\d+)/);

        if (match) {

            return {

                marketplace: "shopee",

                shop_id: match[1],

                produto_id: match[2]

            };

        }

    }

    return {};

}

