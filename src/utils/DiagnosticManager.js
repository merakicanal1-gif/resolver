import fs from "node:fs";
import path from "node:path";
import logger from "./logger.js";

class DiagnosticManager {
  constructor() {
    this.logsDir = path.resolve("logs");
  }

  /**
   * Salva os artefatos de depuração para uma requisição de falha.
   * @param {import('playwright').Page} page - A página do Playwright no estado da falha.
   * @param {string} requestId - O ID da requisição ativa.
   * @param {object} info - Dados adicionais para depuração.
   */
  async saveFailure(page, requestId, info = {}) {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const targetDir = path.join(this.logsDir, today, requestId);

    logger.warn(`📸 [DIAGNOSTICO] Salvando artefatos de falha em: ${targetDir}`);

    try {
      // Garante a existência do diretório recursivamente
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // 1. Salva o HTML recebido
      let htmlContent = "";
      try {
        htmlContent = await page.content();
        fs.writeFileSync(path.join(targetDir, "page.html"), htmlContent, "utf8");
      } catch (err) {
        logger.error("❌ Falha ao extrair HTML para logs de diagnóstico:", err);
      }

      // 2. Salva o Screenshot
      try {
        await page.screenshot({
          path: path.join(targetDir, "screenshot.png"),
          fullPage: true
        });
      } catch (err) {
        logger.error("❌ Falha ao tirar screenshot para logs de diagnóstico:", err);
      }

      // 3. Salva a Cadeia de Redirecionamentos (chain.json)
      fs.writeFileSync(
        path.join(targetDir, "chain.json"),
        JSON.stringify(info.chain || [], null, 2),
        "utf8"
      );

      // 4. Salva Cabeçalhos Recebidos (response_headers.json)
      fs.writeFileSync(
        path.join(targetDir, "response_headers.json"),
        JSON.stringify(info.responseHeaders || {}, null, 2),
        "utf8"
      );

      // 5. Salva Cabeçalhos Enviados (request_headers.json)
      fs.writeFileSync(
        path.join(targetDir, "request_headers.json"),
        JSON.stringify(info.requestHeaders || {}, null, 2),
        "utf8"
      );

      // 6. Salva o Relatório/Motivo da Falha (metadata.json)
      const metadata = {
        requestId,
        timestamp: new Date().toISOString(),
        urlOriginal: info.urlOriginal,
        urlFinal: info.urlFinal,
        marketplace: info.marketplace,
        error: info.error || "Dados incompletos (título ou imagem nulos)",
        htmlSizeBytes: Buffer.byteLength(htmlContent, "utf8")
      };

      fs.writeFileSync(
        path.join(targetDir, "metadata.json"),
        JSON.stringify(metadata, null, 2),
        "utf8"
      );

      logger.info(`✅ [DIAGNOSTICO] Artefatos salvos com sucesso para a requisição [${requestId}]`);
    } catch (error) {
      logger.error("❌ Erro ao salvar logs de diagnóstico de falha:", error);
    }
  }
}

export default new DiagnosticManager();
