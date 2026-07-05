import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";

// Contexto assíncrono para armazenar metadados da requisição ativa (como requestId)
export const requestStorage = new AsyncLocalStorage();

class Logger {
  /**
   * Executa uma função dentro do contexto de um ID de requisição específico.
   * @param {Function} callback - A função a ser executada.
   * @param {string} [id] - ID da requisição opcional. Se não enviado, cria um UUID.
   * @returns {*} O retorno do callback.
   */
  run(callback, id = null) {
    const requestId = id || crypto.randomUUID();
    const context = {
      requestId,
      startTime: Date.now(),
      steps: {}
    };
    return requestStorage.run(context, callback);
  }

  /**
   * Registra o início de uma etapa específica da requisição no contexto atual.
   * @param {string} stepName - Nome da etapa (ex: 'resolution', 'extraction').
   */
  startStep(stepName) {
    const context = requestStorage.getStore();
    if (context) {
      context.steps[stepName] = Date.now();
    }
  }

  /**
   * Registra o fim de uma etapa e loga o tempo gasto.
   * @param {string} stepName - Nome da etapa.
   */
  endStep(stepName) {
    const context = requestStorage.getStore();
    if (context && context.steps[stepName]) {
      const duration = Date.now() - context.steps[stepName];
      this.info(`Etapa [${stepName}] concluída em ${duration}ms`);
      context.steps[stepName] = duration; // Substitui o timestamp pelo tempo gasto
    }
  }

  /**
   * Gera uma mensagem estruturada com o requestId (se disponível).
   * @param {string} level - Nível do log (INFO, WARN, ERROR).
   * @param {string} message - Mensagem.
   * @param {object} [meta] - Metadados adicionais.
   */
  _log(level, message, meta = {}) {
    const context = requestStorage.getStore();
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context ? { requestId: context.requestId } : {}),
      ...meta
    };

    const logString = JSON.stringify(logEntry);
    
    if (level === "ERROR") {
      console.error(logString);
    } else if (level === "WARN") {
      console.warn(logString);
    } else {
      console.log(logString);
    }
  }

  info(message, meta) {
    this._log("INFO", message, meta);
  }

  warn(message, meta) {
    this._log("WARN", message, meta);
  }

  error(message, errorObject, meta = {}) {
    const errorMeta = {
      ...meta,
      errorMessage: errorObject?.message || errorObject,
      errorStack: errorObject?.stack
    };
    this._log("ERROR", message, errorMeta);
  }

  /**
   * Registra um log estruturado puro no formato JSON.
   */
  structured(step, event, details = {}) {
    const context = requestStorage.getStore();
    const requestId = context ? context.requestId : "unknown-request";
    const startTime = context ? context.steps[step] || context.startTime : Date.now();
    const elapsedMs = Date.now() - startTime;

    const logEntry = {
      requestId,
      step,
      event,
      timestamp: new Date().toISOString(),
      elapsedMs,
      ...details
    };

    console.log(JSON.stringify(logEntry));
  }
}

export default new Logger();
