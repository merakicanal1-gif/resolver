import BaseExtractor from "../base/BaseExtractor.js";
import MercadoLivreNormalizer from "./MercadoLivreNormalizer.js";
import NavigationManager from "../../core/navigation/NavigationManager.js";
import logger from "../../utils/logger.js";

class MercadoLivreExtractor extends BaseExtractor {
  async extract(page) {
    logger.info("🕵️ Iniciando extração de dados do Mercado Livre...");

    // Aguarda o título do produto aparecer
    const carregou = await NavigationManager.waitForSelector(page, ".ui-pdp-title", { timeout: 10000 });
    
    if (!carregou) {
      logger.warn("⚠️ Título do produto (.ui-pdp-title) não apareceu no Mercado Livre. Possível bloqueio ou página lenta.");
    }

    let titulo = null;
    let imagem = null;

    try {
      // 1. Extração do Título
      titulo = await page.locator(".ui-pdp-title").textContent().catch(() => null);
      if (titulo) {
        titulo = titulo.trim();
      }

      // Fallback para og:title
      if (!titulo) {
        titulo = await page.locator('meta[property="og:title"]').getAttribute("content").catch(() => null);
        if (titulo) {
          titulo = titulo.trim();
        }
      }

      // Fallback de último caso: <title>
      if (!titulo) {
        titulo = await page.title().catch(() => null);
        if (titulo) {
          titulo = titulo.trim();
        }
      }

      // 2. Extração da Imagem
      // Tentativa 1: Imagem principal da galeria do Mercado Livre
      // costuma estar em .ui-pdp-gallery__figure__image ou img.ui-pdp-image
      imagem = await page.locator("img.ui-pdp-image").first().getAttribute("src").catch(() => null);
      
      if (!imagem) {
        imagem = await page.locator(".ui-pdp-gallery__figure__image").first().getAttribute("src").catch(() => null);
      }

      // Tentativa 2: Meta tag og:image
      if (!imagem || imagem.startsWith("data:")) {
        imagem = await page.locator('meta[property="og:image"]').getAttribute("content").catch(() => null);
      }

      // Tentativa 3: Seletor genérico da imagem principal dentro da galeria
      if (!imagem) {
        imagem = await page.locator(".ui-pdp-gallery img").first().getAttribute("src").catch(() => null);
      }

      if (imagem) {
        imagem = imagem.trim();
      }

      logger.info("✅ Extração do Mercado Livre concluída", { titulo, imagem });

      return {
        titulo,
        imagem
      };
    } catch (error) {
      logger.error("❌ Erro ao extrair dados do produto no Mercado Livre:", error);
      return { titulo: null, imagem: null };
    }
  }

  normalizeUrl(url) {
    return MercadoLivreNormalizer.normalize(url);
  }

  extractProductId(url) {
    return MercadoLivreNormalizer.extractId(url);
  }
}

export default new MercadoLivreExtractor();
