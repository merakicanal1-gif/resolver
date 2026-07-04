import BaseExtractor from "./BaseExtractor.js";

/**
 * Extrator genérico que serve de fallback para sites desconhecidos ou não mapeados.
 */
class GenericExtractor extends BaseExtractor {
  async extract(page) {
    try {
      const titulo = await page.title().catch(() => null);
      
      const imagem = await page.locator('meta[property="og:image"]')
        .getAttribute("content")
        .catch(() => null);

      return {
        titulo: titulo ? titulo.trim() : null,
        imagem: imagem || null
      };
    } catch {
      return { titulo: null, imagem: null };
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
    return {};
  }
}

export default new GenericExtractor();
