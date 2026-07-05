import BaseExtractor from "../base/BaseExtractor.js";
import config from "../../config/index.js";
import logger from "../../utils/logger.js";

class MercadoLivreExtractor extends BaseExtractor {
  constructor() {
    super();
    this.marketplace = "mercadolivre";
    this.supportedDomains = ["mercadolivre.com.br", "mercadolivre.com", "meli.la"];
    this.mandatoryFields = ["titulo", "imagem", "preco"];
  }

  supports(url) {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return this.supportedDomains.some(domain => hostname.includes(domain));
    } catch {
      return false;
    }
  }

  normalizeUrl(url) {
    try {
      const u = new URL(url);
      u.search = "";
      u.hash = "";

      const mlbMatch = u.pathname.match(/(MLB-?\d+)/i);
      if (mlbMatch) {
        let id = mlbMatch[1].toUpperCase();
        if (!id.includes("-")) {
          id = id.slice(0, 3) + "-" + id.slice(3);
        }
        return "https://produto.mercadolivre.com.br/" + id;
      }
      return u.toString();
    } catch {
      return url;
    }
  }

  extractProductId(url) {
    try {
      const u = new URL(url);
      const mlbMatch = u.pathname.match(/(MLB-?\d+)/i);
      if (mlbMatch) {
        let id = mlbMatch[1].toUpperCase();
        if (!id.includes("-")) {
          id = id.slice(0, 3) + "-" + id.slice(3);
        }
        return {
          marketplace: this.marketplace,
          produto_id: id
        };
      }
      return {
        marketplace: this.marketplace,
        produto_id: null
      };
    } catch {
      return {
        marketplace: this.marketplace,
        produto_id: null
      };
    }
  }

  async resolveInternalNavigation(page, url, decisionTree) {
    const urlCorrente = page.url();
    
    // Estratégia 1: Canonical / OG Url Redirect
    if (config.diagnostics.logLevel === "debug") {
      decisionTree.push("resolveInternalNavigation: Verificando Canonical/OG URL");
    }
    const metaUrl = await page.evaluate(() => {
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
      const og = document.querySelector('meta[property="og:url"]')?.getAttribute("content");
      return canonical || og;
    }).catch(() => null);

    if (metaUrl) {
      const normalized = this.normalizeUrl(metaUrl);
      if (this.extractProductId(normalized).produto_id && normalized !== urlCorrente) {
        if (config.diagnostics.logLevel === "debug") {
          decisionTree.push(`Navegação Interna: Redirecionando para Canonical/OG URL: ${normalized}`);
        }
        await page.goto(normalized, { waitUntil: "domcontentloaded", timeout: config.timeouts.extraction });
        return { strategy: "CanonicalOgRedirect" };
      }
    }

    // Estratégia 2: Href Scan no DOM
    if (config.diagnostics.logLevel === "debug") {
      decisionTree.push("resolveInternalNavigation: Procurando link de produto MLB no DOM");
    }
    const productLink = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a"));
      for (const a of anchors) {
        try {
          const href = a.href;
          const u = new URL(href);
          if ((u.hostname.includes("mercadolivre.com") || u.hostname.includes("meli.la")) && 
              (u.pathname.includes("/MLB-") || u.pathname.includes("/p/MLB"))) {
            return href;
          }
        } catch (e) {}
      }
      return null;
    }).catch(() => null);

    if (productLink) {
      if (config.diagnostics.logLevel === "debug") {
        decisionTree.push(`Navegação Interna: Link MLB encontrado no DOM. Navegando para: ${productLink}`);
      }
      await page.goto(productLink, { waitUntil: "domcontentloaded", timeout: config.timeouts.extraction });
      return { strategy: "HrefDomScan" };
    }

    // Estratégia 3: Clique no primeiro produto da lista
    if (config.diagnostics.logLevel === "debug") {
      decisionTree.push("resolveInternalNavigation: Procurando card/link clicável de produto da listagem");
    }

    // Aguarda o container de listagem de produtos carregar (seletor genérico)
    await page.waitForSelector(".ui-search-layout__item, .ui-search-result, .poly-card, .ui-search-link", { 
      timeout: config.timeouts.defaultNavigation 
    }).catch(() => {});

    const cardSelectors = [
      ".ui-search-layout__item:first-of-type .poly-component__title",
      ".ui-search-layout__item:first-of-type .ui-search-item__title",
      ".ui-search-result:first-of-type .ui-search-item__title",
      ".poly-card:first-of-type .poly-component__title",
      ".ui-search-layout__item:first-of-type a.ui-search-link",
      ".ui-search-layout__item:first-of-type a",
    ].join(", ");

    const card = page.locator(cardSelectors).first();
    if (await card.count() > 0) {
      if (config.diagnostics.logLevel === "debug") {
        decisionTree.push("Navegação Interna: Card de produto localizado. Clicando...");
      }
      await card.scrollIntoViewIfNeeded().catch(() => {});
      
      // Clica no card e aguarda o seletor da página do produto (.ui-pdp-title) aparecer
      await card.click();
      await page.waitForSelector(".ui-pdp-title", { timeout: config.timeouts.defaultNavigation }).catch(() => {});
      return { strategy: "ClickProductCard" };
    }

    if (config.diagnostics.logLevel === "debug") {
      decisionTree.push("resolveInternalNavigation: Nenhuma estratégia de navegação interna funcionou.");
    }
    return null;
  }

  async extractDomFallback(page) {
    let titulo = await page.locator(".ui-pdp-title").textContent().catch(() => null);
    if (titulo) titulo = titulo.trim();

    if (!titulo) {
      titulo = await page.locator('meta[property="og:title"]').getAttribute("content").catch(() => null);
      if (titulo) titulo = titulo.trim();
    }

    let imagem = await page.locator("img.ui-pdp-image").first().getAttribute("src").catch(() => null);
    if (!imagem) {
      imagem = await page.locator(".ui-pdp-gallery__figure__image").first().getAttribute("src").catch(() => null);
    }
    if (imagem) imagem = imagem.trim();

    let preco = null;
    const priceFraction = await page.locator(".ui-pdp-price__part .andes-money-amount__fraction").first().textContent().catch(() => null);
    const priceCents = await page.locator(".ui-pdp-price__part .andes-money-amount__cents").first().textContent().catch(() => null);
    if (priceFraction) {
      preco = `R$ ${priceFraction.trim()}${priceCents ? `,${priceCents.trim()}` : ""}`;
    }

    let vendedor = await page.locator(".ui-pdp-seller__link-trigger-title").textContent().catch(() => null);
    if (!vendedor) {
      vendedor = await page.locator(".ui-pdp-seller__link-trigger").first().textContent().catch(() => null);
    }
    if (vendedor) vendedor = vendedor.trim();

    let avaliacao = await page.locator(".ui-pdp-review__rating").first().textContent().catch(() => null);
    if (!avaliacao) {
      avaliacao = await page.locator(".ui-review-capability__rating").first().textContent().catch(() => null);
    }
    if (avaliacao) avaliacao = avaliacao.trim();

    return { titulo, imagem, preco, vendedor, avaliacao };
  }
}

export default new MercadoLivreExtractor();
