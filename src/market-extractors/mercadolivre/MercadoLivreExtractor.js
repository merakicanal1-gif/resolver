import BaseExtractor from "../base/BaseExtractor.js";
import NavigationManager from "../../core/navigation/NavigationManager.js";
import logger from "../../utils/logger.js";

class MercadoLivreExtractor extends BaseExtractor {
  constructor() {
    super();
    this.marketplace = "mercadolivre";
    this.supportedDomains = ["mercadolivre.com.br", "mercadolivre.com", "meli.la"];
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
        // Formata com hífen
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

  async extract(page, urlFinal) {
    logger.info("🕵️ [MercadoLivreExtractor] Iniciando extração de dados do Mercado Livre...");

    // Espera inteligente até que o título apareça
    const carregou = await NavigationManager.waitForSelector(page, ".ui-pdp-title", { timeout: 10000 });
    
    if (!carregou) {
      logger.warn("⚠️ [MercadoLivreExtractor] Seletor .ui-pdp-title não apareceu no Mercado Livre.");
    }

    let titulo = null;
    let imagem = null;
    let preco = null;
    let vendedor = null;
    let avaliacao = null;

    try {
      // 1. Título
      titulo = await page.locator(".ui-pdp-title").textContent().catch(() => null);
      if (titulo) titulo = titulo.trim();

      if (!titulo) {
        titulo = await page.locator('meta[property="og:title"]').getAttribute("content").catch(() => null);
        if (titulo) titulo = titulo.trim();
      }

      if (!titulo) {
        titulo = await page.title().catch(() => null);
        if (titulo) titulo = titulo.trim();
      }

      // 2. Imagem
      imagem = await page.locator("img.ui-pdp-image").first().getAttribute("src").catch(() => null);
      
      if (!imagem) {
        imagem = await page.locator(".ui-pdp-gallery__figure__image").first().getAttribute("src").catch(() => null);
      }

      if (!imagem || imagem.startsWith("data:")) {
        imagem = await page.locator('meta[property="og:image"]').getAttribute("content").catch(() => null);
      }

      if (imagem) imagem = imagem.trim();

      // 3. Preço
      // Mercado Livre usa andes-money-amount para exibir preços
      const priceFraction = await page.locator(".ui-pdp-price__part .andes-money-amount__fraction").first().textContent().catch(() => null);
      const priceCents = await page.locator(".ui-pdp-price__part .andes-money-amount__cents").first().textContent().catch(() => null);
      if (priceFraction) {
        preco = `R$ ${priceFraction.trim()}${priceCents ? `,${priceCents.trim()}` : ""}`;
      }

      // 4. Vendedor
      vendedor = await page.locator(".ui-pdp-seller__link-trigger-title").textContent().catch(() => null);
      if (!vendedor) {
        vendedor = await page.locator(".ui-pdp-seller__link-trigger").first().textContent().catch(() => null);
      }
      if (vendedor) {
        vendedor = vendedor.trim();
      }

      // 5. Avaliação
      avaliacao = await page.locator(".ui-pdp-review__rating").first().textContent().catch(() => null);
      if (!avaliacao) {
        avaliacao = await page.locator(".ui-review-capability__rating").first().textContent().catch(() => null);
      }
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

      logger.info(`✅ [MercadoLivreExtractor] Extração concluída com sucesso`, { titulo, produto_id });
      return result;
    } catch (error) {
      logger.error("❌ [MercadoLivreExtractor] Erro ao extrair dados no Mercado Livre:", error);
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

export default new MercadoLivreExtractor();
