import logger from "../utils/logger.js";

class LinkResolver {
  /**
   * Resolve uma URL seguindo de forma totalmente agnóstica toda a cadeia de redirecionamentos (HTTP, JS, meta refresh).
   * Ele não conhece nenhum marketplace e apenas navega até que a URL pare de mudar (estabilize).
   * 
   * @param {import('playwright').Page} page - A página do Playwright utilizada na resolução.
   * @param {string} initialUrl - A URL de entrada.
   * @param {number} [timeoutGlobal=30000] - Timeout global de segurança em ms.
   * @returns {Promise<{ chain: string[], urlOriginal: string, urlFinal: string, tempoResolucao: number, estatisticas: object }>}
   */
  async resolve(page, initialUrl, timeoutGlobal = 30000) {
    const startTime = Date.now();
    logger.info(`[Resolver] Abrindo navegador...`);
    logger.info(`[Resolver] Nova URL detectada: ${initialUrl}`);

    const chain = [initialUrl];
    let redirectsHttp = 0;
    let redirectsJavascript = 0;
    let metaRefreshCount = 0;
    let eventosCapturados = 0;

    // Função auxiliar para registrar URLs na cadeia de forma deduplicada
    const addToChain = (url) => {
      if (!url || url === "about:blank") return;
      const lastUrl = chain[chain.length - 1];
      if (lastUrl !== url) {
        chain.push(url);
      }
    };

    let stabilityResolve = null;
    let stabilityTimer = null;
    let isStable = false;
    let initialLoadComplete = false;

    // Reseta o timer de estabilidade (750ms de silêncio)
    const resetStabilityTimer = (reason, details = "") => {
      eventosCapturados++;
      
      // Só começamos a contar a estabilização pós-carga inicial do page.goto
      if (!initialLoadComplete || isStable) return;

      if (stabilityTimer) {
        clearTimeout(stabilityTimer);
      }

      const elapsed = Date.now() - startTime;
      logger.info(`[Resolver] ${reason}${details ? ` (${details})` : ""} detectado → reiniciando estabilização [${elapsed}ms]`);

      stabilityTimer = setTimeout(async () => {
        // Antes de declarar estabilidade, verifica se há meta refresh no DOM
        try {
          const metaContent = await page.evaluate(() => {
            const meta = document.querySelector('meta[http-equiv="refresh"i]');
            return meta ? meta.getAttribute("content") : null;
          }).catch(() => null);

          if (metaContent) {
            const match = metaContent.match(/^\s*(\d+)\s*;\s*url\s*=\s*(.+)$/i);
            if (match) {
              const delay = parseInt(match[1], 10);
              const targetUrl = match[2].trim();
              if (delay <= 5) {
                metaRefreshCount++;
                resetStabilityTimer("Meta Refresh", `delay: ${delay}s, destino: ${targetUrl}`);
                return;
              }
            }
          }
        } catch (e) {
          // Ignora se o contexto da página foi destruído ou inacessível momentaneamente
        }

        isStable = true;
        if (stabilityResolve) {
          stabilityResolve();
        }
      }, 750);
    };

    // 1. Expor a função para capturar eventos de navegação Javascript/History
    await page.exposeFunction("__onNavigationEvent", (type, url) => {
      if (type !== "init_script" && type !== "beforeunload") {
        redirectsJavascript++;
        addToChain(url);
        resetStabilityTimer(`Redirect JavaScript [${type}]`, url);
      }
    });

    // 2. Injetar scripts de escuta de rotas no navegador
    await page.addInitScript(() => {
      window.__onNavigationEvent("init_script", window.location.href);

      // Hook pushState
      const origPushState = window.history.pushState;
      window.history.pushState = function(...args) {
        const res = origPushState.apply(this, args);
        window.__onNavigationEvent("pushState", window.location.href);
        return res;
      };

      // Hook replaceState
      const origReplaceState = window.history.replaceState;
      window.history.replaceState = function(...args) {
        const res = origReplaceState.apply(this, args);
        window.__onNavigationEvent("replaceState", window.location.href);
        return res;
      };

      // Listeners padrão do browser
      window.addEventListener("hashchange", () => {
        window.__onNavigationEvent("hashchange", window.location.href);
      });

      window.addEventListener("popstate", () => {
        window.__onNavigationEvent("popstate", window.location.href);
      });

      window.addEventListener("beforeunload", () => {
        window.__onNavigationEvent("beforeunload", window.location.href);
      });
    });

    // 3. Listeners do Playwright (HTTP redirects e Frame Navigation)
    const onFrameNavigated = (frame) => {
      if (frame === page.mainFrame()) {
        const url = frame.url();
        addToChain(url);
        resetStabilityTimer("Nova requisição de documento (framenavigated)", url);
      }
    };

    const onRequest = (req) => {
      if (req.isNavigationRequest() && req.frame() === page.mainFrame()) {
        const redirectedFrom = req.redirectedFrom();
        if (redirectedFrom) {
          redirectsHttp++;
          addToChain(req.url());
          resetStabilityTimer("Redirect HTTP", `${redirectedFrom.url()} -> ${req.url()}`);
        }
      } else if (req.frame() === page.mainFrame() && (req.resourceType() === "xhr" || req.resourceType() === "fetch")) {
        // Requisições XHR/Fetch de rede resetam o timer de silêncio de rede
        resetStabilityTimer("Requisição de API (XHR/Fetch)", req.url().slice(0, 100));
      }
    };

    page.on("framenavigated", onFrameNavigated);
    page.on("request", onRequest);

    // Promise que resolve quando a navegação estabilizar por completo
    const stabilityPromise = new Promise((resolve) => {
      stabilityResolve = resolve;
    });

    // Promise de timeout global de segurança
    let globalTimeoutTimer = null;
    const timeoutPromise = new Promise((_, reject) => {
      globalTimeoutTimer = setTimeout(() => {
        reject(new Error("TIMEOUT_ESTABILIZACAO"));
      }, timeoutGlobal);
    });

    try {
      // Executa a carga inicial do page.goto
      const elapsedStart = Date.now() - startTime;
      logger.info(`[Resolver] Iniciando navegação inicial via page.goto [${elapsedStart}ms]`);
      
      await page.goto(initialUrl, { waitUntil: "domcontentloaded", timeout: timeoutGlobal }).catch(err => {
        logger.warn(`[Resolver] Carga inicial do page.goto gerou erro/aviso: ${err.message}`);
      });

      // Marca a carga inicial como concluída e inicia o timer de estabilização pós-carga
      initialLoadComplete = true;
      resetStabilityTimer("Carga Inicial Concluída", page.url());

      // Aguarda a estabilização real completa ou timeout global
      await Promise.race([stabilityPromise, timeoutPromise]);

    } catch (err) {
      if (err.message === "TIMEOUT_ESTABILIZACAO") {
        logger.warn(`[Resolver] Timeout global de ${timeoutGlobal / 1000}s atingido. Retornando cadeia parcial.`);
      } else {
        logger.error(`[Resolver] Erro inesperado durante a resolução:`, err);
      }
    } finally {
      // Limpeza de listeners e timers
      page.off("framenavigated", onFrameNavigated);
      page.off("request", onRequest);
      if (stabilityTimer) clearTimeout(stabilityTimer);
      if (globalTimeoutTimer) clearTimeout(globalTimeoutTimer);
    }

    // Adiciona a URL atual final obtida
    const urlFinal = page.url();
    addToChain(urlFinal);

    const tempoResolucao = Date.now() - startTime;
    const estatisticas = {
      redirectsHttp,
      redirectsJavascript,
      metaRefresh: metaRefreshCount,
      eventosCapturados,
      tempoEstabilizacao: tempoResolucao
    };

    logger.info(`[Resolver] Finalizado em ${tempoResolucao}ms. URL Final: ${urlFinal}`);

    return {
      chain,
      urlOriginal: initialUrl,
      urlFinal,
      tempoResolucao,
      estatisticas
    };
  }
}

export default new LinkResolver();
