import BaseExtractor from "../base/BaseExtractor.js";
import NavigationManager from "../../core/navigation/NavigationManager.js";
import logger from "../../utils/logger.js";

class AmazonExtractor extends BaseExtractor {
  constructor() {
    super();
    this.marketplace = "amazon";
    this.supportedDomains = ["amazon.com.br", "amazon.com", "amzn.to"];
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

  async extract(page, urlFinal) {
    logger.info("🕵️ [AmazonExtractor] Iniciando extração de dados da Amazon...");

    // Espera inteligente até que o título apareça
    const carregou = await NavigationManager.waitForSelector(page, "#productTitle", { timeout: 10000 });
    
    if (!carregou) {
      logger.warn("⚠️ [AmazonExtractor] Seletor #productTitle não apareceu na Amazon (possível CAPTCHA ou lentidão).");
    }

    let titulo = null;
    let imagem = null;
    let preco = null;
    let vendedor = null;
    let avaliacao = null;

    try {
      // 1. Título
      titulo = await page.locator("#productTitle").textContent().catch(() => null);
      if (titulo) titulo = titulo.trim();

      // Fallback para og:title se falhar
      if (!titulo) {
        titulo = await page.locator('meta[property="og:title"]').getAttribute("content").catch(() => null);
        if (titulo) titulo = titulo.trim();
      }

      // Fallback para tag <title>
      if (!titulo) {
        titulo = await page.title().catch(() => null);
        if (titulo) titulo = titulo.trim();
      }

      // 2. Imagem
      imagem = await page.locator("#landingImage").getAttribute("src").catch(() => null);

      if (imagem && (imagem.startsWith("data:") || imagem.includes("spinner"))) {
        const dynamicImageJson = await page.locator("#landingImage").getAttribute("data-a-dynamic-image").catch(() => null);
        if (dynamicImageJson) {
          try {
            const parsed = JSON.parse(dynamicImageJson);
            const urls = Object.keys(parsed);
            if (urls.length > 0) {
              imagem = urls[urls.length - 1]; // Maior resolução
            }
          } catch {
            // ignora parser
          }
        }
      }

      if (!imagem) {
        imagem = await page.locator("#imgTagWrapperId img").getAttribute("src").catch(() => null);
      }

      if (!imagem || imagem.startsWith("data:")) {
        imagem = await page.locator('meta[property="og:image"]').getAttribute("content").catch(() => null);
      }

      if (imagem) imagem = imagem.trim();

      // 3. Preço
      // Tentamos o buybox interno ou qualquer seletor comum de preço do produto
      preco = await page.locator(".a-price .a-offscreen").first().textContent().catch(() => null);
      if (!preco) {
        preco = await page.locator("#price_inside_buybox").textContent().catch(() => null);
      }
      if (!preco) {
        preco = await page.locator("#priceblock_ourprice").textContent().catch(() => null);
      }
      if (preco) {
        preco = preco.trim();
      }

      // 4. Vendedor
      vendedor = await page.locator("#merchant-info").textContent().catch(() => null);
      if (vendedor) {
        vendedor = vendedor.trim().replace(/\s+/g, " ");
      }

      // 5. Avaliação
      avaliacao = await page.locator("span.a-icon-alt").first().textContent().catch(() => null);
      if (avaliacao) {
        avaliacao = avaliacao.trim();
      }

      const { produto_id } = this.extractProductId(urlFinal);
      const urlLimpa = this.normalizeUrl(urlFinal);

      const result = {
        marketplace: this.marketplace,
        produto_id,
        titulo,
        imagem,
        preco,
        vendedor,
        avaliacao,
        url_final: urlLimpa
      };

      logger.info(`✅ [AmazonExtractor] Extração concluída com sucesso`, { titulo, produto_id });
      return result;
    } catch (error) {
      logger.error("❌ [AmazonExtractor] Erro ao extrair dados na Amazon:", error);
      return {
        marketplace: this.marketplace,
        produto_id: this.extractProductId(urlFinal).produto_id,
        titulo: null,
        imagem: null,
        preco: null,
        vendedor: null,
        avaliacao: null,
        url_final: this.normalizeUrl(urlFinal)
      };
    }
  }
}

export default new AmazonExtractor();
