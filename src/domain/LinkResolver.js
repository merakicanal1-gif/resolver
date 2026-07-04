import NavigationManager from "../core/navigation/NavigationManager.js";
import logger from "../utils/logger.js";

class LinkResolver {
  /**
   * Resolve uma URL seguindo toda a cadeia de redirecionamentos (HTTP, JS, meta refresh, links intermediários).
   * O resolvedor é totalmente agnóstico em relação aos marketplaces específicos.
   * @param {import('playwright').Page} page - A página do Playwright utilizada na resolução.
   * @param {string} initialUrl - A URL de entrada.
   * @param {string[]} targetDomains - Domínios finais suportados para parada imediata (ex: ['amazon.', 'mercadolivre.']).
   * @returns {Promise<{ urlFinal: string, chain: string[] }>} A URL final resolvida e a cadeia de redirecionamentos.
   */
  async resolve(page, initialUrl, targetDomains = []) {
    logger.info(`🔗 Iniciando resolução de link: ${initialUrl}`, { targetDomains });
    
    const chain = [];
    const maxRedirects = 12; // Proteção contra loops infinitos de redirecionamento
    let currentUrl = initialUrl;

    // Registra cada navegação que altera a URL do frame principal
    const onFrameNavigated = (frame) => {
      if (frame === page.mainFrame()) {
        const url = frame.url();
        if (url && url !== "about:blank") {
          // Evita duplicados na cadeia consecutivamente
          if (chain.length === 0 || chain[chain.length - 1] !== url) {
            logger.info(`📡 URL alterada na rede: ${url}`);
            chain.push(url);
          }
        }
      }
    };

    page.on("framenavigated", onFrameNavigated);

    try {
      // Primeira navegação na Aba 1
      await page.goto(initialUrl, {
        waitUntil: "domcontentloaded",
        timeout: 20000 // 20s de timeout máximo global para a navegação inicial
      }).catch(err => {
        logger.warn(`⚠️ Navegação inicial interrompida ou demorada: ${err.message}. Verificando URL alcançada.`);
      });

      currentUrl = page.url();

      // Loop de resolução para redirecionamentos intermediários baseados em clique/JS/meta refresh
      for (let attempt = 0; attempt < maxRedirects; attempt++) {
        // Aguarda 2 segundos para permitir a execução de redirects assíncronos (JS/meta refresh)
        await NavigationManager.waitForTimeout(page, 2000);
        currentUrl = page.url();

        // 1. Condição de Parada Rápida: se a URL atual contiver um dos domínios alvo (targetDomains)
        const isTarget = targetDomains.some(domain => currentUrl.toLowerCase().includes(domain.toLowerCase()));
        if (isTarget) {
          logger.info(`🎯 URL de destino alvo identificada: ${currentUrl}`);
          break;
        }

        // 2. Busca links na página que apontem para algum domínio alvo (casos de agregadores como Pechinchou, Pelando)
        const links = await page.locator("a").evaluateAll(elements =>
          elements.map(el => ({
            href: el.href || "",
            text: (el.innerText || "").trim()
          }))
        );

        // Filtra links que apontam para os domínios finais desejados
        const candidateLink = links.find(link =>
          targetDomains.some(domain => link.href.toLowerCase().includes(domain.toLowerCase()))
        );

        if (candidateLink && candidateLink.href !== currentUrl) {
          logger.info(`👉 Seguindo link intermediário candidato: ${candidateLink.href}`);
          
          // Navega para o link candidato
          await page.goto(candidateLink.href, {
            waitUntil: "domcontentloaded",
            timeout: 10000
          }).catch(err => {
            logger.warn(`⚠️ Erro ao seguir link intermediário: ${err.message}. Continuando.`);
          });
          
          currentUrl = page.url();
        } else {
          // Se não há mais redirecionamentos em andamento nem links candidatos a seguir, a navegação estabilizou
          logger.info(`⏹️ Navegação estabilizou em: ${currentUrl}`);
          break;
        }
      }
    } catch (error) {
      logger.error("❌ Erro fatal durante a resolução do LinkResolver:", error);
    } finally {
      // Remove o listener para evitar memory leaks
      page.off("framenavigated", onFrameNavigated);
    }

    // Garante que a URL de entrada original seja sempre o primeiro elemento da cadeia
    if (chain.length === 0 || chain[0] !== initialUrl) {
      chain.unshift(initialUrl);
    }

    // Adiciona a URL final obtida na cadeia caso não esteja listada
    if (chain[chain.length - 1] !== currentUrl && currentUrl !== "about:blank") {
      chain.push(currentUrl);
    }

    logger.info(`🏁 Resolução de link finalizada. URL final: ${currentUrl}`);
    return {
      urlFinal: currentUrl,
      chain
    };
  }
}

export default new LinkResolver();
