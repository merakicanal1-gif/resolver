import test from "node:test";
import assert from "node:assert";
import ProviderFactory from "../../src/core/browser/ProviderFactory.js";
import RetryPolicy from "../../src/core/browser/RetryPolicy.js";
import BrowserHealthManager from "../../src/core/browser/BrowserHealthManager.js";
import LifecycleManager from "../../src/core/browser/LifecycleManager.js";
import ChromeProvider from "../../src/core/browser/ChromeProvider.js";
import BrowserlessProvider from "../../src/core/browser/BrowserlessProvider.js";

test("Suite de Testes Unitários - Etapa 1: Browser Providers", async (t) => {

  await t.test("ProviderFactory - Deve instanciar o provedor configurado corretamente", () => {
    // Caso 1: Chrome
    process.env.BROWSER_PROVIDER = "chrome";
    process.env.CHROME_CDP_URL = "http://localhost:9222";
    const providerChrome = ProviderFactory.getProvider();
    assert.strictEqual(providerChrome.capabilities.supportsPersistentContext, true);

    // Caso 2: Browserless
    process.env.BROWSER_PROVIDER = "browserless";
    process.env.BROWSERLESS_WS_ENDPOINT = "ws://localhost:3000";
    const providerBrowserless = ProviderFactory.getProvider();
    assert.strictEqual(providerBrowserless.capabilities.supportsPersistentContext, false);

    // Caso 3: Inválido
    process.env.BROWSER_PROVIDER = "invalido";
    assert.throws(() => {
      ProviderFactory.getProvider();
    }, /desconhecido/);
  });

  await t.test("RetryPolicy - Deve respeitar número de retentativas", async () => {
    let callCount = 0;
    const fn = async () => {
      callCount++;
      throw new Error("Falha temporária de CDP");
    };

    try {
      await RetryPolicy.execute(fn, {
        retries: 2,
        delay: 5, // Acelera o teste
        shouldRetry: (err) => err.message.includes("CDP")
      });
      assert.fail("Deveria ter lançado erro no final.");
    } catch (error) {
      assert.strictEqual(callCount, 3); // 1 execução inicial + 2 retentativas
      assert.strictEqual(error.message, "Falha temporária de CDP");
    }
  });

  await t.test("RetryPolicy - Identificação de erro de conexão", () => {
    const errCdp = new Error("Target page, context or browser has been closed");
    const errNormal = new Error("Seletor incorreto na extração");

    assert.strictEqual(RetryPolicy.isConnectionError(errCdp), true);
    assert.strictEqual(RetryPolicy.isConnectionError(errNormal), false);
  });

  await t.test("BrowserHealthManager - Validação passiva de falha de conexão", async () => {
    // Mock do browser desconectado
    const mockBrowser = {
      isConnected: () => false
    };

    const health = await BrowserHealthManager.checkHealth(mockBrowser);
    assert.strictEqual(health.connected, false);
    assert.ok(health.error.includes("fechada"));
  });

  await t.test("LifecycleManager - Deve gerenciar ciclo de vida com base nas capabilities", async () => {
    // Mock do browser
    const mockContext = {
      isClosed: () => false,
      close: async () => { mockContext.closedCalled = true; }
    };
    const mockBrowser = {
      contexts: () => [mockContext]
    };

    // 1. Caso Chrome (supportsPersistentContext = true)
    const mockChromeProvider = {
      capabilities: {
        supportsPersistentContext: true,
        supportsScreenshots: true,
        closeBrowserOnShutdown: false
      }
    };

    const contextChrome = await LifecycleManager.createContext(mockChromeProvider, mockBrowser);
    assert.strictEqual(contextChrome, mockContext, "Deveria retornar o contexto padrão no Chrome.");

    await LifecycleManager.closeContext(mockChromeProvider, mockContext);
    assert.notStrictEqual(mockContext.closedCalled, true, "Não deveria fechar o contexto padrão no Chrome.");

    // 2. Caso Browserless (supportsPersistentContext = false)
    const mockBrowserlessProvider = {
      capabilities: {
        supportsPersistentContext: false,
        supportsScreenshots: true,
        closeBrowserOnShutdown: true
      }
    };

    // Modifica o mock do context para registrar fechamento
    mockContext.closedCalled = false;
    await LifecycleManager.closeContext(mockBrowserlessProvider, mockContext);
    assert.strictEqual(mockContext.closedCalled, true, "Deveria fechar o contexto isolado no Browserless.");
  });
});
