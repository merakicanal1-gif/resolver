import BaseExtractor from "../base/BaseExtractor.js";
import AmazonNormalizer from "./AmazonNormalizer.js";
import NavigationManager from "../../core/navigation/NavigationManager.js";
import logger from "../../utils/logger.js";

class AmazonExtractor extends BaseExtractor {
  async extract(page) {
    logger.info("🕵️ Iniciando extração de dados da Amazon...");

    // Aguarda de forma inteligente até que o título do produto apareça (indica que a página de fato carregou e passou pelo CAPTCHA)
    const carregou = await NavigationManager.waitForSelector(page, "#productTitle", { timeout: 10000 });
    
    if (!carregou) {
      logger.warn("⚠️ Título do produto (#productTitle) não apareceu na Amazon. Possível CAPTCHA ou página lenta.");
    }

    let titulo = null;
    let imagem = null;

    try {
      // 1. Extração do Título
      titulo = await page.locator("#productTitle").textContent().catch(() => null);
      if (titulo) {
        titulo = titulo.trim();
      }

      // Fallback para og:title se o seletor principal falhar
      if (!titulo) {
        titulo = await page.locator('meta[property="og:title"]').getAttribute("content").catch(() => null);
        if (titulo) {
          titulo = titulo.trim();
        }
      }

      // Fallback para o título da tag <title>
      if (!titulo) {
        titulo = await page.title().catch(() => null);
        if (titulo) {
          titulo = titulo.trim();
        }
      }

      // 2. Extração da Imagem
      // Tentativa 1: Atributo src direto do landingImage
      imagem = await page.locator("#landingImage").getAttribute("src").catch(() => null);

      // Tentativa 2: Extrair a imagem de maior resolução de "data-a-dynamic-image" (que é um JSON)
      if (imagem && (imagem.startsWith("data:") || imagem.includes("spinner"))) {
        const dynamicImageJson = await page.locator("#landingImage").getAttribute("data-a-dynamic-image").catch(() => null);
        if (dynamicImageJson) {
          try {
            const parsed = JSON.parse(dynamicImageJson);
            const urls = Object.keys(parsed);
            if (urls.length > 0) {
              imagem = urls[urls.length - 1]; // Pega a última imagem que geralmente é a de maior resolução
            }
          } catch {
            // Ignora erro de parser
          }
        }
      }

      // Tentativa 3: Seletor alternativo imgTagWrapperId img
      if (!imagem) {
        imagem = await page.locator("#imgTagWrapperId img").getAttribute("src").catch(() => null);
      }

      // Tentativa 4: Meta tag og:image (geralmente contém a imagem de alta resolução do produto)
      if (!imagem || imagem.startsWith("data:")) {
        imagem = await page.locator('meta[property="og:image"]').getAttribute("content").catch(() => null);
      }

      // Tentativa 5: Seletor de imagens secundárias se existirem
      if (!imagem) {
        imagem = await page.locator("#main-image-container img").first().getAttribute("src").catch(() => null);
      }

      if (imagem) {
        imagem = imagem.trim();
      }

      logger.info("✅ Extração da Amazon concluída", { titulo, imagem });

      return {
        titulo,
        imagem
      };
    } catch (error) {
      logger.error("❌ Erro ao extrair dados do produto na Amazon:", error);
      return { titulo: null, imagem: null };
    }
  }

  normalizeUrl(url) {
    return AmazonNormalizer.normalize(url);
  }

  extractProductId(url) {
    return AmazonNormalizer.extractId(url);
  }
}

export default new AmazonExtractor();
