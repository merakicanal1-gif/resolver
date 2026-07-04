import NavigationManager from "../core/navigation/NavigationManager.js";

class LinkResolver {
  constructor() {
    this.finalDomains = [
      "amazon.",
      "mercadolivre.",
      "shopee."
    ];
  }

  /**
   * Resolve uma URL de afiliado/encurtada até atingir uma URL de domínio final de marketplace.
   * Rastreia toda a cadeia de redirecionamentos para fins de debug.
   * @param {import('playwright').Page} page - A página do Playwright a ser utilizada.
   * @param {string} initialUrl - A URL inicial.
   * @returns {Promise<{ urlFinal: string, chain: string[] }>} A URL final resolvida e a cadeia de redirecionamentos.
   */
  async resolve(page, initialUrl) {
    console.log(`🔗 Iniciando resolução de link para: ${initialUrl}`);
    
    const chain = [];
    
    // Escuta todas as navegações do frame principal para capturar redirects de rede, JS e meta refresh
    const onFrameNavigated = (frame) => {
      if (frame === page.mainFrame()) {
        const url = frame.url();
        // Evita adicionar duplicados consecutivos na cadeia
        if (chain.length === 0 || chain[chain.length - 1] !== url) {
          console.log(`📡 Navegação detectada: ${url}`);
          chain.push(url);
        }
      }
    };

    page.on("framenavigated", onFrameNavigated);

    let currentUrl = initialUrl;

    try {
      // Primeira navegação (Aba 1)
      currentUrl = await NavigationManager.navigateTo(page, initialUrl, {
        timeout: 20000 // Limite de 20 segundos para a resolução completa
      });

      // Loop de tentativas para lidar com links intermediários (Pechinchou, Pelando, etc.)
      for (let attempt = 0; attempt < 10; attempt++) {
        // Delay inteligente para permitir redirecionamentos assíncronos/meta refresh
        await NavigationManager.waitForTimeout(page, 2000);
        currentUrl = page.url();

        // Se já alcançamos um domínio final (Amazon, Mercado Livre, Shopee), interrompemos o loop
        if (this._isFinalDomain(currentUrl)) {
          console.log(`🎯 Domínio final alcançado: ${currentUrl}`);
          break;
        }

        // Se não for um domínio final, busca links (tags <a>) dentro da página que apontem para algum domínio final
        const links = await page.locator("a").evaluateAll(elements =>
          elements.map(el => ({
            href: el.href || "",
            text: (el.innerText || "").trim()
          }))
        );

        const candidateLink = links.find(link =>
          this.finalDomains.some(domain => link.href.includes(domain))
        );

        if (candidateLink) {
          console.log(`👉 Seguindo link intermediário candidato: ${candidateLink.href}`);
          currentUrl = await NavigationManager.navigateTo(page, candidateLink.href, {
            timeout: 10000
          });
        } else {
          // Se não há redirecionamento em andamento nem links candidatos nas tags <a>, paramos
          break;
        }
      }
    } catch (error) {
      console.error("❌ Erro durante a resolução de links:", error.message);
    } finally {
      // Remove o listener para evitar memory leaks
      page.off("framenavigated", onFrameNavigated);
    }

    // Garante que a URL inicial esteja na cadeia
    if (chain.length === 0 || chain[0] !== initialUrl) {
      chain.unshift(initialUrl);
    }

    console.log(`🏁 Resolução concluída. URL final: ${currentUrl}. Cadeia: [${chain.length} urls]`);
    return {
      urlFinal: currentUrl,
      chain
    };
  }

  /**
   * Verifica se a URL contém algum dos domínios finais mapeados.
   * @param {string} url 
   * @returns {boolean}
   * @private
   */
  _isFinalDomain(url) {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return this.finalDomains.some(domain => hostname.includes(domain));
    } catch {
      return false;
    }
  }
}

export default new LinkResolver();
