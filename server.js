import express from "express";
import dotenv from "dotenv";
import resolveRoute from "./routes/resolve.js";

dotenv.config();

const app = express();

app.use(express.json());

app.use("/resolve", resolveRoute);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Resolver iniciado na porta ${PORT}`);
});
