import dotenv from "dotenv";

// Carrega o arquivo .env da raiz do projeto
dotenv.config();

const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  browserless: {
    wsEndpoint: process.env.BROWSERLESS_WS_ENDPOINT || "ws://browserless_browserless?token=resolver123",
  },
  timeouts: {
    // Timeout máximo para toda a cadeia de resolução de links (Aba 1)
    resolution: parseInt(process.env.TIMEOUT_RESOLUTION || "20000", 10),
    // Timeout máximo para carregar a página limpa e extrair os dados (Aba 2)
    extraction: parseInt(process.env.TIMEOUT_EXTRACTION || "15000", 10),
    // Timeout padrão do Playwright para esperas de seletores/navegações internas
    defaultNavigation: parseInt(process.env.TIMEOUT_NAVIGATION || "10000", 10),
  }
};

// Congela o objeto para garantir integridade em tempo de execução
export default Object.freeze(config);
