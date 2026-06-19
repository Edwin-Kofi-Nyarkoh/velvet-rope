import express from "express";
import { env } from "./env";
import { apiRouter } from "./routes";
import { errorHandler, sendData } from "./lib/http";
import { globalLimiter, securityMiddleware } from "./middleware/security";
import { startCronJobs } from "./services/cron.service";

const app = express();

app.set("trust proxy", 1);
app.use(securityMiddleware);
app.use(globalLimiter);
app.get("/", (_req, res) => sendData(res, { name: "Velvet Rope API", version: "0.1.0" }));
app.get("/health", (_req, res) => sendData(res, { ok: true }));
app.use("/api", apiRouter);
app.use(errorHandler);

app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`Velvet Rope API listening on http://0.0.0.0:${env.PORT}`);
  startCronJobs();
});
