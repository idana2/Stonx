import { PrismaClient } from "@prisma/client";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";
import { startFundamentalsSync } from "./fundamentals/sync.js";
import { analysisRouter } from "./routes/analyze.js";
import { fundamentalsRouter } from "./routes/fundamentals.js";
import { groupsRouter } from "./routes/groups.js";
import { templatesRouter } from "./routes/templates.js";
import { valuationsRouter } from "./routes/valuations.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "stonx-server",
    version: "0.1.0",
  });
});

app.use("/api/groups", groupsRouter);
app.use("/api/fundamentals", fundamentalsRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/valuations", valuationsRouter);
app.use("/api", analysisRouter);

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});

const FUNDAMENTALS_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000;
const prisma = new PrismaClient();
setTimeout(() => {
  startFundamentalsSync(prisma).catch((error) => {
    console.error("[fundamentals] sync failed", error);
  });
}, 0);
setInterval(() => {
  startFundamentalsSync(prisma).catch((error) => {
    console.error("[fundamentals] sync failed", error);
  });
}, FUNDAMENTALS_SYNC_INTERVAL_MS);
