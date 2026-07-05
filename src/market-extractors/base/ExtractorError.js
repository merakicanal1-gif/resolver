/**
 * Classe de erro estruturado para o pipeline de extração e navegação de marketplaces.
 */
export class ExtractorError extends Error {
  /**
   * @param {object} params
   * @param {string} params.code - Código do erro (ex: 'CAPTCHA_DETECTED', 'PRODUCT_PAGE_NOT_FOUND')
   * @param {string} params.marketplace - Marketplace correspondente (ex: 'amazon')
   * @param {string} params.step - Etapa da falha (ex: 'resolveInternalNavigation')
   * @param {string} [params.strategy=null] - Estratégia específica da falha (se aplicável)
   * @param {string} params.reason - Descrição humanizada do motivo
   * @param {string} params.url - URL corrente da falha
   * @param {number} [params.elapsedMs=0] - Tempo gasto até o momento da falha
   */
  constructor({ code, marketplace, step, strategy = null, reason, url, elapsedMs = 0 }) {
    super(reason);
    this.name = "ExtractorError";
    this.code = code;
    this.marketplace = marketplace;
    this.step = step;
    this.strategy = strategy;
    this.reason = reason;
    this.url = url;
    this.elapsedMs = elapsedMs;
  }

  toJSON() {
    return {
      success: false,
      code: this.code,
      marketplace: this.marketplace,
      step: this.step,
      strategy: this.strategy,
      reason: this.reason,
      url: this.url,
      elapsedMs: this.elapsedMs
    };
  }
}
