/**
 * Estratégias comuns de extração de metadados baseadas em padrões web.
 */

export class JsonLdStrategy {
  constructor() {
    this.name = "JsonLdStrategy";
  }

  async execute(page, extractor) {
    const data = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      for (const script of scripts) {
        try {
          const parsed = JSON.parse(script.textContent);
          const items = Array.isArray(parsed) ? parsed : [parsed];
          
          const findProduct = (obj) => {
            if (!obj || typeof obj !== "object") return null;
            if (obj["@type"] === "Product" || obj["@type"]?.includes("Product")) {
              return obj;
            }
            if (obj["@graph"] && Array.isArray(obj["@graph"])) {
              const graphMatch = obj["@graph"].find(item => item["@type"] === "Product" || item["@type"]?.includes("Product"));
              if (graphMatch) return graphMatch;
            }
            for (const key of Object.keys(obj)) {
              const match = findProduct(obj[key]);
              if (match) return match;
            }
            return null;
          };

          for (const item of items) {
            const product = findProduct(item);
            if (product) return product;
          }
        } catch (e) {
          // ignore invalid JSON
        }
      }
      return null;
    }).catch(() => null);

    if (!data) return {};

    // Extração do preço
    let price = null;
    if (data.offers) {
      const offers = Array.isArray(data.offers) ? data.offers[0] : data.offers;
      if (offers.price !== undefined && offers.price !== null) {
        const currency = offers.priceCurrency || "BRL";
        const cleanPrice = String(offers.price).trim();
        price = `${currency === "BRL" ? "R$" : currency} ${cleanPrice}`;
      }
    }

    // Extração da avaliação
    let rating = null;
    if (data.aggregateRating) {
      rating = data.aggregateRating.ratingValue ? String(data.aggregateRating.ratingValue) : null;
    }

    // Extração da imagem
    let image = null;
    if (data.image) {
      image = Array.isArray(data.image) ? data.image[0] : (typeof data.image === "object" ? data.image.url : data.image);
    }

    return {
      titulo: data.name ? String(data.name).trim() : null,
      imagem: image ? String(image).trim() : null,
      preco: price,
      vendedor: data.brand?.name || (typeof data.brand === "string" ? data.brand : null),
      avaliacao: rating
    };
  }
}

export class OpenGraphStrategy {
  constructor() {
    this.name = "OpenGraphStrategy";
  }

  async execute(page, extractor) {
    const data = await page.evaluate(() => {
      const getMeta = (prop) => {
        const el = document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`);
        return el ? el.getAttribute("content") : null;
      };
      return {
        titulo: getMeta("og:title") || getMeta("twitter:title"),
        imagem: getMeta("og:image") || getMeta("twitter:image"),
        preco: getMeta("product:price:amount") || getMeta("og:price:amount"),
        currency: getMeta("product:price:currency") || getMeta("og:price:currency") || "BRL",
        vendedor: getMeta("og:site_name")
      };
    }).catch(() => ({}));

    if (!data.titulo) return {};

    let formattedPrice = null;
    if (data.preco) {
      formattedPrice = `${data.currency === "BRL" ? "R$" : data.currency} ${String(data.preco).trim()}`;
    }

    return {
      titulo: data.titulo ? String(data.titulo).trim() : null,
      imagem: data.imagem ? String(data.imagem).trim() : null,
      preco: formattedPrice,
      vendedor: data.vendedor ? String(data.vendedor).trim() : null,
      avaliacao: null
    };
  }
}

export class MicrodataStrategy {
  constructor() {
    this.name = "MicrodataStrategy";
  }

  async execute(page, extractor) {
    return await page.evaluate(() => {
      const productEl = document.querySelector('[itemscope][itemtype*="schema.org/Product"]');
      if (!productEl) return {};

      const getProp = (propName) => {
        const el = productEl.querySelector(`[itemprop="${propName}"]`);
        if (!el) return null;
        return el.getAttribute("content") || el.textContent || el.src;
      };

      const title = getProp("name");
      const image = getProp("image");
      
      let price = null;
      const priceEl = productEl.querySelector('[itemprop="price"]');
      if (priceEl) {
        const amount = priceEl.getAttribute("content") || priceEl.textContent;
        const currencyEl = productEl.querySelector('[itemprop="priceCurrency"]');
        const currency = currencyEl ? (currencyEl.getAttribute("content") || currencyEl.textContent) : "BRL";
        if (amount) {
          price = `${currency === "BRL" ? "R$" : currency} ${String(amount).trim()}`;
        }
      }

      const ratingEl = productEl.querySelector('[itemprop="ratingValue"]');
      const rating = ratingEl ? (ratingEl.getAttribute("content") || ratingEl.textContent) : null;

      const brandEl = productEl.querySelector('[itemprop="brand"]');
      const brand = brandEl ? (brandEl.getAttribute("content") || brandEl.textContent) : null;

      return {
        titulo: title ? String(title).trim() : null,
        imagem: image ? String(image).trim() : null,
        preco: price,
        vendedor: brand ? String(brand).trim() : null,
        avaliacao: rating ? String(rating).trim() : null
      };
    }).catch(() => ({}));
  }
}

export class CssFallbackStrategy {
  constructor() {
    this.name = "CssFallbackStrategy";
  }

  async execute(page, extractor) {
    if (typeof extractor.extractDomFallback === "function") {
      return await extractor.extractDomFallback(page);
    }
    return {};
  }
}
