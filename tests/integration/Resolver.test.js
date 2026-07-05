import test from "node:test";
import assert from "node:assert";
import http from "node:http";
import BrowserManager from "../../src/core/browser/BrowserManager.js";
import ResolveLinkUseCase from "../../src/use-cases/ResolveLinkUseCase.js";

// Executa os testes de integração se BROWSER_PROVIDER for chrome ou se rodado explicitamente
const runIntegration = process.env.BROWSER_PROVIDER === "chrome";

test("Suite de Testes de Integração - Pipeline de Resolução e Extração (Chrome CDP)", { skip: !runIntegration }, async (t) => {
  let context;
  let mockServer;

  t.before(async () => {
    // Inicializa servidor HTTP local para mockar redirects reais sem depender de encurtadores instáveis
    mockServer = http.createServer((req, res) => {
      if (req.url === "/redirect-amazon") {
        res.writeHead(302, { Location: "https://www.amazon.com.br/dp/B0BLS36SHC" });
        res.end();
      } else if (req.url === "/redirect-meli") {
        res.writeHead(302, { Location: "https://produto.mercadolivre.com.br/MLB-3407981503-adaptador-conversor-hdmi-para-vga-com-saida-de-audio-p2-_JM" });
        res.end();
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise((resolve) => mockServer.listen(4567, resolve));
    
    try {
      context = await BrowserManager.createContext();
    } catch (error) {
      console.error("❌ Falha ao conectar ao Chrome CDP para os testes de integração:", error.message);
      t.skip("Chrome CDP indisponível");
    }
  });

  t.after(async () => {
    if (mockServer) {
      await new Promise((resolve) => mockServer.close(resolve));
    }
    await BrowserManager.shutdown().catch(() => {});
  });

  await t.test("Amazon - Deve resolver link curto/afiliado e extrair metadados completos", async () => {
    const urlOriginal = "http://localhost:4567/redirect-amazon";
    const result = await ResolveLinkUseCase.execute(urlOriginal);

    assert.strictEqual(result.success, true, "Operação deveria ter sucesso");
    assert.strictEqual(result.marketplace, "amazon", "Marketplace deve ser amazon");
    assert.ok(result.produto_id, "ASIN do produto deve ser extraído");
    assert.strictEqual(result.produto_id, "B0BLS36SHC", "ASIN extraído incorretamente");
    assert.ok(result.titulo, "Título do produto deve ser extraído");
    assert.ok(result.imagem, "Imagem do produto deve ser extraída");
    assert.ok(result.url_final.includes("/dp/B0BLS36SHC"), "A URL final deve estar limpa e conter o ASIN");
    assert.ok(result.chain.length > 0, "Cadeia de redirects não deve estar vazia");
  });

  await t.test("Mercado Livre - Deve resolver meli.la/link oficial e extrair metadados completos", async () => {
    const urlOriginal = "http://localhost:4567/redirect-meli";
    const result = await ResolveLinkUseCase.execute(urlOriginal);

    assert.strictEqual(result.success, true, "Operação deveria ter sucesso");
    assert.strictEqual(result.marketplace, "mercadolivre", "Marketplace deve ser mercadolivre");
    assert.ok(result.produto_id, "MLB ID do produto deve ser extraído");
    assert.strictEqual(result.produto_id, "MLB-3407981503", "MLB ID extraído incorretamente");
    assert.ok(result.titulo, "Título do produto deve ser extraído");
    assert.ok(result.imagem, "Imagem do produto deve ser extraída");
    assert.ok(result.url_final.includes("MLB-3407981503"), "A URL final deve estar limpa e conter o MLB ID");
    assert.ok(result.chain.length > 0, "Cadeia de redirects não deve estar vazia");
  });

  await t.test("Shopee - Deve resolver shope.ee e extrair metadados completos", async () => {
    const urlOriginal = "https://shope.ee/4Ae01i5wNK"; // Redireciona para produto Shopee real ativo
    const result = await ResolveLinkUseCase.execute(urlOriginal);

    assert.strictEqual(result.success, true, "Operação deveria ter sucesso");
    assert.strictEqual(result.marketplace, "shopee", "Marketplace deve ser shopee");
    assert.ok(result.produto_id, "ID do produto deve ser extraído");
    assert.strictEqual(result.produto_id, "8238335156", "ID do produto extraído incorretamente");
    assert.ok(result.titulo, "Título do produto deve ser extraído");
    assert.ok(result.imagem, "Imagem do produto deve ser extraída");
    assert.ok(result.chain.length > 0, "Cadeia de redirects não deve estar vazia");
  });
});
