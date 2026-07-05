/**
 * Classe base para todos os extratores de marketplaces.
 * Define a interface obrigatória e opcional comum para os extratores do pipeline.
 */
class BaseExtractor {
  constructor() {
    this.marketplace = "generic";
    this.supportedDomains = [];
  }

  /**
   * Determina se este extrator suporta uma URL específica.
   * @param {string} url - A URL do produto.
   * @returns {boolean} True se for compatível, false caso contrário.
   */
  supports(url) {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return this.supportedDomains.some(domain => hostname.includes(domain));
    } catch {
      return false;
    }
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

  /**
   * Extrai as informações da página do produto.
   * Deve obrigatoriamente retornar o esquema padronizado.
   * 
   * @param {import('playwright').Page} page - Página com o produto carregado.
   * @param {string} urlFinal - URL final estabilizada e limpa.
   * @returns {Promise<object>} Dados extraídos no formato padrão do pipeline.
   */
  async extract(page, urlFinal) {
    throw new Error("O método 'extract(page, urlFinal)' deve ser implementado pela subclasse.");
  }

  // Métodos opcionais com implementação default vazia/nula
  validate(page) {
    return true;
  }

  canExtract(page) {
    return true;
  }

  postProcess(result) {
    return result;
  }
}

export default BaseExtractor;
