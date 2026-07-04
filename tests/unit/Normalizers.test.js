import test from "node:test";
import assert from "node:assert";
import AmazonNormalizer from "../../src/market-extractors/amazon/AmazonNormalizer.js";
import MercadoLivreNormalizer from "../../src/market-extractors/mercadolivre/MercadoLivreNormalizer.js";
import ShopeeNormalizer from "../../src/market-extractors/shopee/ShopeeNormalizer.js";

test("AmazonNormalizer - Normalização e ID", (t) => {
  const url = "https://www.amazon.com.br/dp/B0GNN42NBM?th=1&linkCode=sl2&tag=tag-20";
  const normalized = AmazonNormalizer.normalize(url);
  const info = AmazonNormalizer.extractId(url);

  assert.strictEqual(normalized, "https://www.amazon.com.br/dp/B0GNN42NBM");
  assert.deepStrictEqual(info, { marketplace: "amazon", produto_id: "B0GNN42NBM" });
});

test("MercadoLivreNormalizer - Normalização e ID", (t) => {
  const url = "https://produto.mercadolivre.com.br/MLB-3549216012-produto-de-teste?searchVariation=1782#position=1";
  const normalized = MercadoLivreNormalizer.normalize(url);
  const info = MercadoLivreNormalizer.extractId(url);

  assert.strictEqual(normalized, "https://produto.mercadolivre.com.br/MLB-3549216012");
  assert.deepStrictEqual(info, { marketplace: "mercadolivre", produto_id: "MLB-3549216012" });
});

test("ShopeeNormalizer - Normalização e ID", (t) => {
  const url = "https://shopee.com.br/product-i.12345.67890?sp_atk=abcd";
  const normalized = ShopeeNormalizer.normalize(url);
  const info = ShopeeNormalizer.extractId(url);

  assert.strictEqual(normalized, "https://shopee.com.br/product-i.12345.67890");
  assert.deepStrictEqual(info, { marketplace: "shopee", shop_id: "12345", produto_id: "67890" });
});
