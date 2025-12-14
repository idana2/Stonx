import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";
import { analysisRouter } from "./routes/analyze.js";
import { groupsRouter } from "./routes/groups.js";

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
app.use("/api", analysisRouter);

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});
