import { ExtractorError } from "./ExtractorError.js";
import { JsonLdStrategy, OpenGraphStrategy, MicrodataStrategy, CssFallbackStrategy } from "./ExtractionStrategies.js";
import config from "../../config/index.js";
import logger from "../../utils/logger.js";

/**
 * Classe base para todos os extratores de marketplaces.
 * Define o orquestrador determinístico do pipeline e gerencia as estratégias de extração.
 */
class BaseExtractor {
  constructor() {
    this.marketplace = "generic";
    this.supportedDomains = [];
    this.mandatoryFields = []; // Declarativo por marketplace
    
    // Lista ordenada de estratégias de extração
    this.extractionStrategies = [
      new JsonLdStrategy(),
      new OpenGraphStrategy(),
      new MicrodataStrategy(),
      new CssFallbackStrategy()
    ];
  }

  /**
   * Determina se este extrator suporta uma URL específica.
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
   * Limpa a URL do produto (deve ser implementado pela subclasse).
   */
  normalizeUrl(url) {
    throw new Error("O método 'normalizeUrl(url)' deve ser implementado pela subclasse.");
  }

  /**
   * Extrai o ID único do produto a partir da URL (deve ser implementado pela subclasse).
   */
  extractProductId(url) {
    throw new Error("O método 'extractProductId(url)' deve ser implementado pela subclasse.");
  }

  /**
   * Hook opcional para detecção de CAPTCHA/Login na página carregada.
   */
  async checkForBlockScreens(page, decisionTree) {
    // Implementação default vazia
  }

  /**
   * Valida se a página atual é de fato uma página de produto com espera por renderização (SPA).
   */
  async validateProductPage(page) {
    const url = page.url();
    const productIdInfo = this.extractProductId(url);
    if (!productIdInfo.produto_id) return false;

    // Se o padrão da URL bater com produto, aguarda até que os seletores principais renderizem
    const productSelector = "h1, #productTitle, .ui-pdp-title";
    await page.waitForSelector(productSelector, { timeout: config.timeouts.defaultNavigation }).catch(() => {});

    const checks = await page.evaluate(() => {
      const titleEl = document.querySelector("h1, #productTitle, .ui-pdp-title");
      const title = titleEl ? titleEl.textContent : document.querySelector('meta[property="og:title"]')?.getAttribute("content");
      const hasImage = !!(
        document.querySelector("img.ui-pdp-image") || 
        document.querySelector("#landingImage") || 
        document.querySelector("#imgTagWrapperId img") ||
        document.querySelector('meta[property="og:image"]')?.getAttribute("content")
      );
      const hasPrice = !!(
        document.querySelector(".andes-money-amount") || 
        document.querySelector(".a-price") || 
        document.querySelector("div.pm52zq") ||
        document.querySelector('meta[property="product:price:amount"]')?.getAttribute("content")
      );
      return {
        hasTitle: !!(title && title.trim()),
        hasImage,
        hasPrice
      };
    }).catch(() => ({}));

    return !!(checks.hasTitle && (checks.hasImage || checks.hasPrice));
  }

  /**
   * Resolve navegações internas/intermediárias de forma autocontida (deve ser implementado pela subclasse).
   */
  async resolveInternalNavigation(page, url, decisionTree) {
    // Implementação default vazia (não faz nada)
  }

  /**
   * Hook de extração fallback via CSS seletores do DOM (deve ser implementado pela subclasse).
   */
  async extractDomFallback(page) {
    return {};
  }

  /**
   * Orquestrador determinístico unificado para o fluxo do extrator.
   * 
   * @param {import('playwright').Page} page - A aba limpa do Playwright.
   * @param {string} urlFinal - URL final estável do LinkResolver.
   * @returns {Promise<object>} JSON estruturado com metadados e métricas.
   */
  async extract(page, urlFinal) {
    const startTime = Date.now();
    const decisionTree = [];
    
    if (config.diagnostics.logLevel === "debug") {
      decisionTree.push(`[${this.marketplace.toUpperCase()}] Iniciando pipeline para: ${urlFinal}`);
    }

    // Métricas por etapa
    const metricas = {
      tempoNavegacaoInternaMs: 0,
      tempoValidacaoMs: 0,
      tempoExtracaoMs: 0,
      tempoNormalizacaoMs: 0,
      tempoTotalMs: 0
    };

    let winningNavigationStrategy = "None (Already Product Page)";
    const winningExtractionStrategies = {};
    let executedStrategiesCount = 0;
    let failedStrategiesCount = 0;

    try {
      // 1. Abrir URL
      const startOpen = Date.now();
      try {
        await page.goto(urlFinal, {
          waitUntil: "domcontentloaded",
          timeout: config.timeouts.extraction
        });
      } catch (err) {
        throw new ExtractorError({
          code: "NAVIGATION_FAILED",
          marketplace: this.marketplace,
          step: "open_url",
          reason: `Falha ao carregar URL inicial: ${err.message}`,
          url: urlFinal,
          elapsedMs: Date.now() - startTime
        });
      }

      // Detectar telas de bloqueio inicialmente
      await this.checkForBlockScreens(page, decisionTree);

      // 2. Verificar se já é produto ou navegar internamente
      const startNav = Date.now();
      const isProductInitial = await this.validateProductPage(page);
      
      if (config.diagnostics.logLevel === "debug") {
        decisionTree.push(`É página de produto inicial? ${isProductInitial ? "SIM" : "NÃO"}`);
      }

      if (!isProductInitial) {
        // Executa navegação interna autocontida
        const navResult = await this.resolveInternalNavigation(page, urlFinal, decisionTree);
        winningNavigationStrategy = navResult?.strategy || "Internal Heuristic";

        // Verifica bloqueios novamente pós-navegação
        await this.checkForBlockScreens(page, decisionTree);

        // Validação final de que chegou ao produto
        const startVal = Date.now();
        const isProductFinal = await this.validateProductPage(page);
        metricas.tempoValidacaoMs = Date.now() - startVal;

        if (config.diagnostics.logLevel === "debug") {
          decisionTree.push(`Validação final do produto após navegação: ${isProductFinal ? "SUCESSO" : "FALHA"}`);
        }

        if (!isProductFinal) {
          throw new ExtractorError({
            code: "PRODUCT_PAGE_NOT_FOUND",
            marketplace: this.marketplace,
            step: "resolveInternalNavigation",
            strategy: winningNavigationStrategy,
            reason: "Nenhuma estratégia conseguiu localizar uma página de produto válida.",
            url: page.url(),
            elapsedMs: Date.now() - startTime
          });
        }
      }
      metricas.tempoNavegacaoInternaMs = Date.now() - startNav;

      // 3. Extrair Metadados sequencialmente (Parada Prematura e Merge Inteligente)
      const startExtract = Date.now();
      const metadata = { titulo: null, imagem: null, preco: null, vendedor: null, avaliacao: null };

      for (const strategy of this.extractionStrategies) {
        // Verifica parada prematura baseada nos campos obrigatórios
        const allMandatoryFilled = this.mandatoryFields.every(field => {
          if (field === "url_final") return true; // Resolvido no final da normalização
          return metadata[field] !== null && metadata[field] !== undefined && metadata[field] !== "";
        });

        if (allMandatoryFilled) {
          if (config.diagnostics.logLevel === "debug") {
            decisionTree.push(`Parada prematura: todos os campos obrigatórios [${this.mandatoryFields.join(", ")}] foram preenchidos.`);
          }
          break;
        }

        executedStrategiesCount++;
        const stratStart = Date.now();
        try {
          const partial = await strategy.execute(page, this);
          for (const key of Object.keys(metadata)) {
            // Smart Merge: preserva o valor atual caso o novo seja nulo/vazio
            if ((metadata[key] === null || metadata[key] === undefined || metadata[key] === "") && 
                (partial[key] !== null && partial[key] !== undefined && partial[key] !== "")) {
              metadata[key] = partial[key];
              winningExtractionStrategies[key] = strategy.name;
            }
          }
          if (config.diagnostics.logLevel === "debug") {
            decisionTree.push(`Estratégia de extração ${strategy.name}: SUCESSO (${Date.now() - stratStart}ms)`);
          }
        } catch (err) {
          failedStrategiesCount++;
          if (config.diagnostics.logLevel === "debug") {
            decisionTree.push(`Estratégia de extração ${strategy.name}: FALHA - ${err.message}`);
          }
        }
      }
      metricas.tempoExtracaoMs = Date.now() - startExtract;

      // 4. Validar campos obrigatórios declarativos
      const hasMissingMandatory = this.mandatoryFields.some(field => {
        if (field === "url_final") return false; // Validado após normalização
        return metadata[field] === null || metadata[field] === undefined || metadata[field] === "";
      });

      if (hasMissingMandatory) {
        throw new ExtractorError({
          code: "EXTRACTION_FAILED",
          marketplace: this.marketplace,
          step: "validateMandatoryFields",
          reason: `Página carregou mas os elementos obrigatórios [${this.mandatoryFields.join(", ")}] não foram encontrados.`,
          url: page.url(),
          elapsedMs: Date.now() - startTime
        });
      }

      // 5. Normalização final de URLs e IDs
      const startNorm = Date.now();
      const urlCorrente = page.url();
      const urlNormalizada = this.normalizeUrl(urlCorrente);
      const productIds = this.extractProductId(urlNormalizada);
      metricas.tempoNormalizacaoMs = Date.now() - startNorm;

      // Validação da URL final obrigatória
      if (this.mandatoryFields.includes("url_final") && !urlNormalizada) {
        throw new ExtractorError({
          code: "EXTRACTION_FAILED",
          marketplace: this.marketplace,
          step: "normalize",
          reason: "Falha ao gerar URL final normalizada obrigatória.",
          url: urlCorrente,
          elapsedMs: Date.now() - startTime
        });
      }

      metricas.tempoTotalMs = Date.now() - startTime;

      if (config.diagnostics.logLevel === "debug") {
        decisionTree.push(`Pipeline finalizado com sucesso. URL Final: ${urlNormalizada}`);
        logger.info(`\n=== Árvore de Decisão [${this.marketplace.toUpperCase()}] ===\n` + decisionTree.join("\n ↓ \n") + "\n=================================");
      }

      return {
        success: true,
        marketplace: this.marketplace,
        ...productIds,
        titulo: metadata.titulo,
        imagem: metadata.imagem,
        preco: metadata.preco || null,
        vendedor: metadata.vendedor || null,
        avaliacao: metadata.avaliacao || null,
        url_final: urlNormalizada,
        metricas: {
          ...metricas,
          winningNavigationStrategy,
          winningExtractionStrategies,
          strategiesExecuted: executedStrategiesCount,
          strategiesFailed: failedStrategiesCount
        }
      };

    } catch (err) {
      // Garante que o tempo final seja computado no erro estruturado
      if (err instanceof ExtractorError) {
        err.elapsedMs = Date.now() - startTime;
        if (config.diagnostics.logLevel === "debug") {
          decisionTree.push(`Erro no Pipeline: ${err.code} - ${err.message}`);
          logger.info(`\n=== Árvore de Decisão [${this.marketplace.toUpperCase()}] (FALHA) ===\n` + decisionTree.join("\n ↓ \n") + "\n=================================");
        }
        throw err;
      }
      
      const unhandledErr = new ExtractorError({
        code: "INTERNAL_ERROR",
        marketplace: this.marketplace,
        step: "unhandled",
        reason: err.message,
        url: page.url(),
        elapsedMs: Date.now() - startTime
      });

      if (config.diagnostics.logLevel === "debug") {
        decisionTree.push(`Erro Crítico Não Tratado: ${err.message}`);
        logger.info(`\n=== Árvore de Decisão [${this.marketplace.toUpperCase()}] (FALHA CRÍTICA) ===\n` + decisionTree.join("\n ↓ \n") + "\n=================================");
      }
      throw unhandledErr;
    }
  }
}

export default BaseExtractor;
