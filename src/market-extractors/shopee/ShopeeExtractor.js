import BaseExtractor from "../base/BaseExtractor.js";
import { ExtractorError } from "../base/ExtractorError.js";
import config from "../../config/index.js";
import logger from "../../utils/logger.js";

class ShopeeExtractor extends BaseExtractor {
  constructor() {
    super();
    this.marketplace = "shopee";
    this.supportedDomains = ["shopee.com.br", "shopee.com", "shope.ee"];
    this.mandatoryFields = ["titulo", "imagem"];
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
      return u.toString();
    } catch {
      return url;
    }
  }

  extractProductId(url) {
    try {
      const u = new URL(url);
      const match1 = u.pathname.match(/i\.(\d+)\.(\d+)/);
      if (match1) {
        return {
          marketplace: this.marketplace,
          shop_id: match1[1],
          produto_id: match1[2]
        };
      }
      const match2 = u.pathname.match(/product\/(\d+)\/(\d+)/);
      if (match2) {
        return {
          marketplace: this.marketplace,
          shop_id: match2[1],
          produto_id: match2[2]
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
    if (config.diagnostics.logLevel === "debug") {
      decisionTree.push("resolveInternalNavigation: Procurando link de produto da Shopee no DOM");
    }

    const productLink = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a"));
      for (const a of anchors) {
        try {
          const href = a.href;
          const u = new URL(href);
          if (/\/product\/\d+\/\d+/.test(u.pathname) || /i\.\d+\.\d+/.test(u.pathname)) {
            return href;
          }
        } catch (e) {}
      }
      return null;
    }).catch(() => null);

    if (productLink) {
      if (config.diagnostics.logLevel === "debug") {
        decisionTree.push(`Navegação Interna: Link de produto Shopee encontrado no DOM. Navegando para: ${productLink}`);
      }
      await page.goto(productLink, { waitUntil: "domcontentloaded", timeout: config.timeouts.extraction });
      return { strategy: "HrefDomScan" };
    }

    if (config.diagnostics.logLevel === "debug") {
      decisionTree.push("resolveInternalNavigation: Nenhuma estratégia de navegação interna funcionou.");
    }
    return null;
  }

  async extractDomFallback(page) {
    let titulo = await page.locator("h1").first().textContent().catch(() => null);
    if (titulo) {
      titulo = titulo.trim().replace(/\s*\|\s*Shopee\s*Brasil$/i, "");
    }

    if (!titulo) {
      titulo = await page.locator('meta[property="og:title"]').getAttribute("content").catch(() => null);
      if (titulo) {
        titulo = titulo.trim().replace(/\s*\|\s*Shopee\s*Brasil$/i, "");
      }
    }

    let imagem = await page.locator("img").evaluateAll(imgs => {
      const productImg = imgs.find(img => {
        const src = img.src || "";
        return src.includes("cf.shopee.com.br") || src.includes("down-br.img.susercontent.com");
      });
      return productImg ? productImg.src : null;
    }).catch(() => null);
    if (imagem) imagem = imagem.trim();

    let preco = await page.locator("div.pm52zq").first().textContent().catch(() => null);
    if (preco) preco = preco.trim();

    let vendedor = await page.locator(".shopee-seller-portrait__name").first().textContent().catch(() => null);
    if (vendedor) vendedor = vendedor.trim();

    let avaliacao = await page.locator(".shopee-product-rating").first().textContent().catch(() => null);
    if (avaliacao) avaliacao = avaliacao.trim();

    return { titulo, imagem, preco, vendedor, avaliacao };
  }
}

export default new ShopeeExtractor();
