import dotenv from "dotenv";
import path from "path";

// Carrega o arquivo .env da raiz do projeto
dotenv.config();

const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  browserless: {
    url: process.env.BROWSERLESS_URL || "ws://browserless_browserless?token=resolver123",
  },
};

// Congela o objeto para garantir que as configurações não sejam alteradas em tempo de execução
export default Object.freeze(config);
