export function detectarMarketplace(url) {

    const host = new URL(url).hostname.toLowerCase();

    if (host.includes("amazon"))
        return "amazon";

    if (host.includes("mercadolivre"))
        return "mercadolivre";

    if (host.includes("shopee"))
        return "shopee";

    if (host.includes("magalu") || host.includes("magazineluiza"))
        return "magalu";

    if (host.includes("kabum"))
        return "kabum";

    if (host.includes("casasbahia"))
        return "casasbahia";

    if (host.includes("extra"))
        return "extra";

    if (host.includes("pontofrio"))
        return "pontofrio";

    if (host.includes("carrefour"))
        return "carrefour";

    if (host.includes("terabyteshop"))
        return "terabyteshop";

    if (host.includes("pichau"))
        return "pichau";

    return "desconhecido";

}
