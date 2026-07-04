import BaseExtractor from "../base/BaseExtractor.js";
import ShopeeNormalizer from "./ShopeeNormalizer.js";
import NavigationManager from "../../core/navigation/NavigationManager.js";
import logger from "../../utils/logger.js";

class ShopeeExtractor extends BaseExtractor {
  async extract(page) {
    logger.info("🕵️ Iniciando extração de dados da Shopee...");

    // Na Shopee, as classes de CSS mudam com frequência por serem geradas dinamicamente/ofuscadas.
    // Usaremos as meta tags OpenGraph (og:title e og:image) que são estáveis e renderizadas no lado do servidor.
    // Tentamos esperar pela meta tag de título ou pelo h1.
    const carregou = await NavigationManager.waitForSelector(page, 'meta[property="og:title"], h1', { timeout: 10000 });
    
    if (!carregou) {
      logger.warn("⚠️ Meta tags de título ou h1 não apareceram na Shopee. Possível lentidão ou CAPTCHA.");
    }

    let titulo = null;
    let imagem = null;

    try {
      // 1. Extração do Título
      // Tentativa 1: Meta tag og:title (mais estável)
      titulo = await page.locator('meta[property="og:title"]').getAttribute("content").catch(() => null);
      
      // Tentativa 2: Tag h1 da página
      if (!titulo) {
        titulo = await page.locator("h1").first().textContent().catch(() => null);
      }

      // Tentativa 3: Tag <title> do navegador
      if (!titulo) {
        titulo = await page.title().catch(() => null);
      }

      if (titulo) {
        titulo = titulo.trim();
        // A Shopee às vezes adiciona " | Shopee Brasil" ao final do título da meta tag
        titulo = titulo.replace(/\s*\|\s*Shopee\s*Brasil$/i, "");
      }

      // 2. Extração da Imagem
      // Tentativa 1: Meta tag og:image (muito estável)
      imagem = await page.locator('meta[property="og:image"]').getAttribute("content").catch(() => null);

      // Tentativa 2: Twitter Image
      if (!imagem || imagem.startsWith("data:")) {
        imagem = await page.locator('meta[name="twitter:image"]').getAttribute("content").catch(() => null);
      }

      // Tentativa 3: Imagem principal do produto no carrossel (procura por imagens com object-fit contain de tamanho grande)
      if (!imagem) {
        imagem = await page.locator("img").evaluateAll(imgs => {
          // Tenta encontrar uma imagem grande que pareça ser a do produto
          const productImg = imgs.find(img => {
            const src = img.src || "";
            return src.includes("cf.shopee.com.br") || src.includes("down-br.img.susercontent.com");
          });
          return productImg ? productImg.src : null;
        }).catch(() => null);
      }

      if (imagem) {
        imagem = imagem.trim();
      }

      logger.info("✅ Extração da Shopee concluída", { titulo, imagem });

      return {
        titulo,
        imagem
      };
    } catch (error) {
      logger.error("❌ Erro ao extrair dados do produto na Shopee:", error);
      return { titulo: null, imagem: null };
    }
  }

  normalizeUrl(url) {
    return ShopeeNormalizer.normalize(url);
  }

  extractProductId(url) {
    return ShopeeNormalizer.extractId(url);
  }
}

export default new ShopeeExtractor();
