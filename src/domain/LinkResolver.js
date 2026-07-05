import logger from "../utils/logger.js";

class LinkResolver {
  /**
   * Resolve uma URL seguindo de forma totalmente agnóstica toda a cadeia de redirecionamentos (HTTP, JS, meta refresh).
   * Ele não conhece nenhum marketplace e apenas navega até que a URL pare de mudar (estabilize).
   * @param {import('playwright').Page} page - A página do Playwright utilizada na resolução.
   * @param {string} initialUrl - A URL de entrada.
   * @returns {Promise<{ urlFinal: string, chain: string[] }>} A URL final resolvida e a cadeia de redirecionamentos.
   */
  async resolve(page, initialUrl) {
    logger.info(`🔗 Iniciando resolução de link 100% agnóstica para: ${initialUrl}`);
    
    const chain = [];

    // Registra cada navegação que altera a URL do frame principal
    const onFrameNavigated = (frame) => {
      if (frame === page.mainFrame()) {
        const url = frame.url();
        if (url && url !== "about:blank") {
          if (chain.length === 0 || chain[chain.length - 1] !== url) {
            logger.info(`📡 URL alterada na rede: ${url}`);
            chain.push(url);
          }
        }
      }
    };

    page.on("framenavigated", onFrameNavigated);

    let currentUrl = initialUrl;

    try {
      // Primeira navegação na Aba 1.
      // Usamos waitUntil: "domcontentloaded" para que scripts leves de redirect inicial rodem.
      // Timeout seguro de 25 segundos para a cadeia inicial.
      await page.goto(initialUrl, {
        waitUntil: "domcontentloaded",
        timeout: 25000
      }).catch(err => {
        logger.warn(`⚠️ Navegação inicial interrompida por timeout ou erro: ${err.message}. Analisando redirects ocorridos.`);
      });

      currentUrl = page.url();

      // Loop de estabilização: monitora se a cadeia de redirecionamentos (chain) parou de crescer.
      // Se o tamanho da cadeia não aumentar por 3 segundos seguidos, a navegação é dada como estabilizada.
      let lastChainLength = chain.length;
      let stableSeconds = 0;
      const maxCheckSeconds = 15;

      for (let i = 0; i < maxCheckSeconds; i++) {
        await page.waitForTimeout(1000);
        const currentChainLength = chain.length;

        if (currentChainLength === lastChainLength) {
          stableSeconds++;
          if (stableSeconds >= 3) {
            logger.info(`⏹️ Cadeia de navegação estabilizou de forma agnóstica em: ${page.url()}`);
            break;
          }
        } else {
          stableSeconds = 0;
          lastChainLength = currentChainLength;
        }
      }
    } catch (error) {
      logger.error("❌ Erro no resolvedor de links agnóstico:", error);
    } finally {
      // Remove o listener para evitar memory leaks
      page.off("framenavigated", onFrameNavigated);
    }

    // Garante que a URL inicial esteja no início da cadeia
    if (chain.length === 0 || chain[0] !== initialUrl) {
      chain.unshift(initialUrl);
    }

    // Adiciona a URL final obtida na cadeia caso ela não esteja listada no final
    currentUrl = page.url();
    if (currentUrl && currentUrl !== "about:blank" && chain[chain.length - 1] !== currentUrl) {
      chain.push(currentUrl);
    }

    logger.info(`🏁 Resolução agnóstica finalizada. URL final obtida: ${currentUrl}`);
    return {
      urlFinal: currentUrl,
      chain
    };
  }
}

export default new LinkResolver();
