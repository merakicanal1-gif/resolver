import { Router } from "express";
import { abrirPagina } from "../services/browser.js";
import { normalizar } from "../services/normalizer.js";
import { detectarMarketplace } from "../services/detector.js";
import { extrairIdProduto } from "../services/extractor.js";

// V2 Imports
import ResolveLinkUseCase from "../src/use-cases/ResolveLinkUseCase.js";
import BrowserManager from "../src/core/browser/BrowserManager.js";
import config from "../src/config/index.js";
import logger from "../src/utils/logger.js";

const router = Router();

// ROTA V1 ORIGINAL (Mantida intacta para migração incremental segura)
router.post("/", async (req, res) => {

    const inicio = Date.now();

    try {

        const { url } = req.body;

        if (!url) {

            return res.status(400).json({
                success: false,
                error: "URL não enviada."
            });

        }

        const resultado = await abrirPagina(url);

        const urlFinal = normalizar(resultado.url);

        const marketplace = detectarMarketplace(urlFinal);

        const ids = extrairIdProduto(urlFinal);

        res.json({

            success: true,

            marketplace,

            ...ids,

            url_original: url,

            url_encontrada: resultado.url,

            url_final: urlFinal,

            titulo: resultado.titulo,

            imagem: resultado.imagem,

            tempo_ms: Date.now() - inicio

        });

    } catch (e) {

        res.status(500).json({

            success: false,

            error: e.message,

            stack: e.stack,

            tempo_ms: Date.now() - inicio

        });

    }

});

// ROTA V2 (Nova implementação limpa e robusta)
router.post("/v2", async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({
            success: false,
            code: "INVALID_URL",
            message: "URL não enviada."
        });
    }

    // Executa a requisição V2 dentro do contexto do Logger (gerando UUID do requestId e metadados)
    logger.run(async () => {
        const inicio = Date.now();
        try {
            const resultado = await ResolveLinkUseCase.execute(url);
            
            if (!resultado.success) {
                let status = 400;
                if (resultado.code === "BROWSER_CONNECTION_ERROR") {
                    status = 503;
                } else if (resultado.code === "INTERNAL_ERROR") {
                    status = 500;
                }
                return res.status(status).json({
                    ...resultado,
                    tempo_ms: Date.now() - inicio
                });
            }

            res.json({
                ...resultado,
                tempo_ms: Date.now() - inicio
            });
        } catch (e) {
            logger.error("❌ Erro não tratado na rota /v2:", e);
            res.status(500).json({
                success: false,
                code: "INTERNAL_ERROR",
                message: e.message,
                tempo_ms: Date.now() - inicio
            });
        }
    });
});

// ROTA DE DEBUG/VALIDAÇÃO TEMPORÁRIA DA ETAPA 1
router.get("/debug/chrome", async (req, res) => {
    const inicio = Date.now();
    let browser = null;
    let context = null;
    let page = null;

    try {
        // 1. Conectar ao Chrome
        browser = await BrowserManager.getBrowser();
        
        // 2. Obter contexto persistente
        context = await BrowserManager.createContext(browser);
        
        // 3. Abrir nova Page
        page = await BrowserManager.createPage(context);
        
        // 4. Navegar para o Mercado Livre
        await page.goto("https://www.mercadolivre.com.br/", {
            waitUntil: "domcontentloaded",
            timeout: 20000
        });

        // 5. Coletar as informações solicitadas
        const urlFinal = page.url();
        const title = await page.title();

        // Verifica autenticação com seletores comuns do Mercado Livre logado
        const usernameSelectorExists = await page.$(".nav-header-username").then(el => !!el);
        const userMenuExists = await page.$(".nav-header-user-menu").then(el => !!el);
        const authenticated = usernameSelectorExists || userMenuExists;

        const capabilities = BrowserManager.provider.capabilities;
        const browserVersion = await browser.version();
        const contextsCount = browser.contexts().length;
        const pagesCount = context.pages().length;

        const elapsedMs = Date.now() - inicio;

        res.json({
            success: true,
            provider: config.browser.provider,
            browserVersion,
            contexts: contextsCount,
            pages: pagesCount,
            url: urlFinal,
            title,
            authenticated,
            persistentContext: capabilities.supportsPersistentContext,
            elapsedMs
        });

    } catch (e) {
        res.status(500).json({
            success: false,
            error: e.message,
            stack: e.stack,
            elapsedMs: Date.now() - inicio
        });
    } finally {
        // 8. Fechar apenas a aba criada
        if (page) {
            await BrowserManager.closePage(page).catch(() => {});
        }
        // NUNCA fechar browser ou contexto persistente do Chrome
    }
});

export default router;
