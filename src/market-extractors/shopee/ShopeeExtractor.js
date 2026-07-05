import BaseExtractor from "../base/BaseExtractor.js";
import NavigationManager from "../../core/navigation/NavigationManager.js";
import logger from "../../utils/logger.js";

class ShopeeExtractor extends BaseExtractor {
  constructor() {
    super();
    this.marketplace = "shopee";
    this.supportedDomains = ["shopee.com.br", "shopee.com", "shope.ee"];
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

  async extract(page, urlFinal) {
    logger.info("🕵️ [ShopeeExtractor] Iniciando extração de dados da Shopee...");

    // Espera inteligente por metadados de título ou h1
    const carregou = await NavigationManager.waitForSelector(page, 'meta[property="og:title"], h1', { timeout: 10000 });
    
    if (!carregou) {
      logger.warn("⚠️ [ShopeeExtractor] Seletor og:title ou h1 não apareceu na Shopee.");
    }

    let titulo = null;
    let imagem = null;
    let preco = null;
    let vendedor = null;
    let avaliacao = null;

    try {
      // 1. Título
      titulo = await page.locator('meta[property="og:title"]').getAttribute("content").catch(() => null);
      
      if (!titulo) {
        titulo = await page.locator("h1").first().textContent().catch(() => null);
      }

      if (!titulo) {
        titulo = await page.title().catch(() => null);
      }

      if (titulo) {
        titulo = titulo.trim().replace(/\s*\|\s*Shopee\s*Brasil$/i, "");
      }

      // 2. Imagem
      imagem = await page.locator('meta[property="og:image"]').getAttribute("content").catch(() => null);

      if (!imagem || imagem.startsWith("data:")) {
        imagem = await page.locator('meta[name="twitter:image"]').getAttribute("content").catch(() => null);
      }

      if (!imagem) {
        imagem = await page.locator("img").evaluateAll(imgs => {
          const productImg = imgs.find(img => {
            const src = img.src || "";
            return src.includes("cf.shopee.com.br") || src.includes("down-br.img.susercontent.com");
          });
          return productImg ? productImg.src : null;
        }).catch(() => null);
      }

      if (imagem) imagem = imagem.trim();

      // 3. Preço (tenta ler tags de metadados ou classes do DOM)
      preco = await page.locator('meta[property="product:price:amount"]').getAttribute("content").catch(() => null);
      if (preco) {
        const currency = await page.locator('meta[property="product:price:currency"]').getAttribute("content").catch(() => "BRL");
        preco = `${currency === "BRL" ? "R$" : currency} ${preco.trim()}`;
      } else {
        // Fallback para elementos de preço visíveis na Shopee
        preco = await page.locator("div.pm52zq").first().textContent().catch(() => null);
        if (preco) preco = preco.trim();
      }

      // 4. Vendedor
      vendedor = await page.locator(".shopee-seller-portrait__name").first().textContent().catch(() => null);
      if (vendedor) {
        vendedor = vendedor.trim();
      }

      // 5. Avaliação
      // Tenta achar estrelas ou reviews no DOM
      avaliacao = await page.locator(".shopee-product-rating").first().textContent().catch(() => null);
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

      logger.info(`✅ [ShopeeExtractor] Extração concluída com sucesso`, { titulo, produto_id });
      return result;
    } catch (error) {
      logger.error("❌ [ShopeeExtractor] Erro ao extrair dados na Shopee:", error);
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

export default new ShopeeExtractor();
