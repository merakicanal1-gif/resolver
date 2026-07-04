import { Router } from "express";
import { abrirPagina } from "../services/browser.js";
import { normalizar } from "../services/normalizer.js";
import { detectarMarketplace } from "../services/detector.js";
import { extrairIdProduto } from "../services/extractor.js";

const router = Router();

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

export default router;
