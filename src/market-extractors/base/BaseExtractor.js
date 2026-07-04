/**
 * Classe base para todos os extratores de marketplaces.
 * Define o contrato/interface comum para extração de dados e normalização de URLs.
 */
class BaseExtractor {
  /**
   * Extrai as informações da página do produto (como título e imagem).
   * @param {import('playwright').Page} page - Página com o produto carregado.
   * @returns {Promise<{ titulo: string|null, imagem: string|null }>} Dados extraídos.
   */
  async extract(page) {
    throw new Error("O método 'extract(page)' deve ser implementado pela subclasse.");
  }

  /**
   * Limpa a URL do produto, removendo parâmetros de rastreamento e tags de afiliados.
   * @param {string} url - URL suja encontrada.
   * @returns {string} URL limpa e oficial do produto.
   */
  normalizeUrl(url) {
    throw new Error("O método 'normalizeUrl(url)' deve ser implementado pela subclasse.");
  }

  /**
   * Extrai o ID único do produto a partir da URL.
   * @param {string} url - URL do produto.
   * @returns {object} Um objeto contendo pelo menos { produto_id } e outras informações se necessário.
   */
  extractProductId(url) {
    throw new Error("O método 'extractProductId(url)' deve ser implementado pela subclasse.");
  }
}

export default BaseExtractor;
