import logger from "../../utils/logger.js";
import config from "../../config/index.js";

class RetryPolicy {
  constructor() {
    // Carrega padrões conforme o ambiente (development ou production)
    const isDev = process.env.NODE_ENV === "development";
    this.defaultRetries = isDev ? 1 : 2; // Menos tentativas em dev, mais resiliência em prod
    this.defaultDelayMs = 1000;
  }

  /**
   * Executa uma função assíncrona aplicando a política de retentativa sob falhas.
   * @param {Function} fn - Função assíncrona a ser executada.
   * @param {object} [options] - Parâmetros customizados.
   * @param {number} [options.retries] - Número máximo de retentativas.
   * @param {number} [options.delay] - Tempo de espera em milissegundos entre tentativas.
   * @param {Function} [options.shouldRetry] - Função de validação se o erro é elegível para retry.
   * @param {Function} [options.onRetry] - Callback executado a cada tentativa de retry.
   * @returns {Promise<any>} O resultado da função fn.
   */
  async execute(fn, options = {}) {
    const retries = options.retries ?? this.defaultRetries;
    const delay = options.delay ?? this.defaultDelayMs;
    const shouldRetry = options.shouldRetry ?? (() => true);
    const onRetry = options.onRetry ?? (() => {});

    let attempt = 0;

    while (true) {
      try {
        return await fn();
      } catch (error) {
        attempt++;

        if (attempt > retries || !shouldRetry(error)) {
          throw error;
        }

        logger.warn(`⚠️ [RETRY] Tentativa ${attempt} falhou: "${error.message}". Agendando nova tentativa em ${delay}ms...`);
        
        try {
          await onRetry(error, attempt);
        } catch (callbackError) {
          logger.error("❌ [RETRY] Erro executando callback onRetry:", callbackError);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Identifica se um erro é associado a instabilidades de conexão do navegador.
   * @param {Error} error 
   * @returns {boolean}
   */
  isConnectionError(error) {
    if (!error || !error.message) return false;
    const msg = error.message;
    return (
      msg.includes("closed") ||
      msg.includes("CDP") ||
      msg.includes("connect") ||
      msg.includes("WebSocket") ||
      msg.includes("Target page") ||
      msg.includes("socket") ||
      msg.includes("ENOTFOUND")
    );
  }
}

export default new RetryPolicy();
