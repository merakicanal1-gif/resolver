import test from "node:test";
import assert from "node:assert";
import MarketplaceDetector from "../../src/domain/MarketplaceDetector.js";

test("MarketplaceDetector - Deve detectar marketplaces suportados corretamente", (t) => {
  const cases = [
    { url: "https://www.amazon.com.br/dp/B0GNN42NBM", expected: "amazon" },
    { url: "https://produto.mercadolivre.com.br/MLB-12345678", expected: "mercadolivre" },
    { url: "https://shopee.com.br/product-i.12345.67890", expected: "shopee" },
    { url: "https://www.magazineluiza.com.br/produto/123", expected: "magalu" },
    { url: "https://www.kabum.com.br/produto/456", expected: "kabum" },
    { url: "https://www.google.com", expected: "desconhecido" }
  ];

  for (const c of cases) {
    const result = MarketplaceDetector.detect(c.url);
    assert.strictEqual(result, c.expected, `Falhou para URL: ${c.url}`);
  }
});
