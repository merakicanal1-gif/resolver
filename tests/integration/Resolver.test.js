import test from "node:test";
import assert from "node:assert";
import BrowserManager from "../../src/core/browser/BrowserManager.js";
import LinkResolver from "../../src/domain/LinkResolver.js";
import ExtractorRegistry from "../../src/market-extractors/ExtractorRegistry.js";
import MarketplaceDetector from "../../src/domain/MarketplaceDetector.js";
import logger from "../../src/utils/logger.js";

// Só executa se a variável RUN_INTEGRATION_TESTS for true ou se estiver rodando explicitamente
const runIntegration = process.env.RUN_INTEGRATION_TESTS === "true" || true;

test("Testes de Integração com o Navegador (Browserless)", { skip: !runIntegration }, async (t) => {
  let context;
  
  t.before(async () => {
    // Inicializa o contexto antes dos testes
    try {
      context = await BrowserManager.createContext();
    } catch (error) {
      console.warn("⚠️ Não foi possível conectar ao Browserless para os testes de integração. Pulando.");
      t.skip("Browserless indisponível");
    }
  });

  t.after(async () => {
    // Encerra e libera recursos
    if (context) {
      await BrowserManager.closeContext(context);
    }
    await BrowserManager.shutdown();
  });

  await t.test("LinkResolver - Deve resolver um link da Amazon e registrar a cadeia", async () => {
    if (!context) return;
    const { page } = await BrowserManager.createPage(context);
    
    try {
      // Usaremos um link encurtado da Amazon para o teste
      const urlOriginal = "https://amzn.to/3W0kKkX"; // Link encurtado válido da Amazon
      const resultado = await LinkResolver.resolve(page, urlOriginal);
      
      assert.ok(resultado.urlFinal, "A URL final não deve ser vazia.");
      assert.ok(resultado.urlFinal.includes("amazon.com.br"), "Deveria resolver para um link da Amazon.");
      assert.ok(resultado.chain.length > 0, "A cadeia de redirecionamento (chain) deve conter URLs.");
      assert.strictEqual(resultado.chain[0], urlOriginal, "O primeiro link da cadeia deve ser a URL original.");
    } finally {
      await BrowserManager.closePage(page);
    }
  });

  await t.test("AmazonExtractor - Deve extrair título e imagem de um produto real da Amazon", async () => {
    if (!context) return;
    const { page } = await BrowserManager.createPage(context);
    
    try {
      // URL direta de produto na Amazon
      const urlProduto = "https://www.amazon.com.br/dp/B07PFF59NC"; // Exemplo: Echo Dot
      await page.goto(urlProduto, { waitUntil: "domcontentloaded", timeout: 15000 });
      
      const extractor = ExtractorRegistry.getExtractor("amazon");
      const dados = await extractor.extract(page);
      
      assert.ok(dados.titulo, "O título da Amazon não deveria ser nulo.");
      assert.ok(dados.titulo.toLowerCase().includes("echo"), "O título deveria conter 'echo'.");
      assert.ok(dados.imagem, "A imagem da Amazon não deveria ser nula.");
      assert.ok(dados.imagem.startsWith("http"), "A URL da imagem deve ser válida.");
    } finally {
      await BrowserManager.closePage(page);
    }
  });
  
  await t.test("MercadoLivreExtractor - Deve extrair título e imagem de um produto real", async () => {
    if (!context) return;
    const { page } = await BrowserManager.createPage(context);
    
    try {
      // URL direta de produto no Mercado Livre
      // MLB-3407981503 é um exemplo estável (geralmente produtos populares)
      const urlProduto = "https://produto.mercadolivre.com.br/MLB-3407981503-adaptador-conversor-hdmi-para-vga-com-saida-de-audio-p2-_JM";
      await page.goto(urlProduto, { waitUntil: "domcontentloaded", timeout: 15000 });
      
      const extractor = ExtractorRegistry.getExtractor("mercadolivre");
      const dados = await extractor.extract(page);
      
      assert.ok(dados.titulo, "O título do Mercado Livre não deveria ser nulo.");
      assert.ok(dados.imagem, "A imagem do Mercado Livre não deveria ser nula.");
      assert.ok(dados.imagem.startsWith("http"), "A URL da imagem deve ser válida.");
    } finally {
      await BrowserManager.closePage(page);
    }
  });
});
