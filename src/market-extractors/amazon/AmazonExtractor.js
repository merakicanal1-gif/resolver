import BaseExtractor from "../base/BaseExtractor.js";
import { ExtractorError } from "../base/ExtractorError.js";
import config from "../../config/index.js";
import logger from "../../utils/logger.js";

class AmazonExtractor extends BaseExtractor {
  constructor() {
    super();
    this.marketplace = "amazon";
    this.supportedDomains = ["amazon.com.br", "amazon.com", "amzn.to"];
    this.mandatoryFields = ["titulo", "imagem", "url_final"];
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

      const dpMatch = u.pathname.match(/\/dp\/([A-Z0-9]{10})/i);
      if (dpMatch) {
        u.pathname = "/dp/" + dpMatch[1].toUpperCase();
      }
      return u.toString();
    } catch {
      return url;
    }
  }

  extractProductId(url) {
    try {
      const u = new URL(url);
      const dpMatch = u.pathname.match(/\/dp\/([A-Z0-9]{10})/i);
      if (dpMatch) {
        return {
          marketplace: this.marketplace,
          produto_id: dpMatch[1].toUpperCase()
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

  async checkForBlockScreens(page, decisionTree) {
    const url = page.url();
    
    // 1. CAPTCHA Check
    const isCaptcha = await page.locator('form[action*="/errors/validateCaptcha"], input#captchacharacters').count() > 0;
    if (isCaptcha) {
      if (config.diagnostics.logLevel === "debug") {
        decisionTree.push("Bloqueio detectado: CAPTCHA da Amazon");
      }
      throw new ExtractorError({
        code: "CAPTCHA_DETECTED",
        marketplace: this.marketplace,
        step: "checkForBlockScreens",
        strategy: "CaptchaValidation",
        reason: "CAPTCHA detectado ao acessar a Amazon.",
        url
      });
    }

    // 2. Login Check
    const isLogin = (await page.locator('form[name="signIn"], input#ap_email').count() > 0) || url.includes("/signin");
    if (isLogin) {
      if (config.diagnostics.logLevel === "debug") {
        decisionTree.push("Bloqueio detectado: Tela de Login da Amazon");
      }
      throw new ExtractorError({
        code: "LOGIN_REQUIRED",
        marketplace: this.marketplace,
        step: "checkForBlockScreens",
        strategy: "LoginValidation",
        reason: "Login obrigatório detectado na Amazon.",
        url
      });
    }
  }

  async resolveInternalNavigation(page, url, decisionTree) {
    if (config.diagnostics.logLevel === "debug") {
      decisionTree.push("resolveInternalNavigation: Procurando link de produto da Amazon no DOM");
    }

    const productLink = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a"));
      for (const a of anchors) {
        try {
          const href = a.href;
          const u = new URL(href);
          if (u.pathname.includes("/dp/") || u.pathname.includes("/gp/product/")) {
            const dpMatch = u.pathname.match(/\/dp\/([A-Z0-9]{10})/i);
            if (dpMatch) return href;
          }
        } catch (e) {}
      }
      return null;
    }).catch(() => null);

    if (productLink) {
      if (config.diagnostics.logLevel === "debug") {
        decisionTree.push(`Navegação Interna: Link de produto encontrado no DOM. Navegando para: ${productLink}`);
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
    let titulo = await page.locator("#productTitle").textContent().catch(() => null);
    if (titulo) titulo = titulo.trim();

    if (!titulo) {
      titulo = await page.locator('meta[property="og:title"]').getAttribute("content").catch(() => null);
      if (titulo) titulo = titulo.trim();
    }

    let imagem = await page.locator("#landingImage").getAttribute("src").catch(() => null);
    if (imagem && (imagem.startsWith("data:") || imagem.includes("spinner"))) {
      const dynamicImageJson = await page.locator("#landingImage").getAttribute("data-a-dynamic-image").catch(() => null);
      if (dynamicImageJson) {
        try {
          const parsed = JSON.parse(dynamicImageJson);
          const urls = Object.keys(parsed);
          if (urls.length > 0) {
            imagem = urls[urls.length - 1];
          }
        } catch {}
      }
    }
    if (!imagem) {
      imagem = await page.locator("#imgTagWrapperId img").getAttribute("src").catch(() => null);
    }
    if (imagem) imagem = imagem.trim();

    let preco = await page.locator(".a-price .a-offscreen").first().textContent().catch(() => null);
    if (!preco) {
      preco = await page.locator("#price_inside_buybox").textContent().catch(() => null);
    }
    if (preco) preco = preco.trim();

    let vendedor = await page.locator("#merchant-info").textContent().catch(() => null);
    if (vendedor) vendedor = vendedor.trim().replace(/\s+/g, " ");

    let avaliacao = await page.locator("span.a-icon-alt").first().textContent().catch(() => null);
    if (avaliacao) avaliacao = avaliacao.trim();

    return { titulo, imagem, preco, vendedor, avaliacao };
  }
}

export default new AmazonExtractor();
