import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { computeMetrics, buildSignals } from "../analytics/metrics.js";
import { ensureBars } from "../marketData/cache.js";
import { StooqMarketDataProvider } from "../marketData/stooqProvider.js";

const prisma = new PrismaClient();
export const analysisRouter = Router();
const marketDataProvider = new StooqMarketDataProvider();

const analysisRequestSchema = z
  .object({
    groupId: z.string().min(1).optional(),
    symbols: z.array(z.string().min(1)).nonempty().optional(),
    range: z.object({
      start: z.string().min(1),
      end: z.string().min(1),
    }),
  })
  .refine((value) => value.groupId || value.symbols, {
    message: "Provide symbols or groupId",
    path: ["symbols"],
  });
const makeValidationError = (error: z.ZodError) => ({
  error: { message: "Invalid payload", details: error.flatten() },
});

const parseJson = <T>(value: string | null | undefined): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const pricesQuerySchema = z.object({
  symbol: z.string().min(1),
});

analysisRouter.get("/prices", async (req, res) => {
  const parsed = pricesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(makeValidationError(parsed.error));
  }

  const { symbol } = parsed.data;
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 30);

  try {
    const { bars } = await ensureBars(
      prisma,
      marketDataProvider,
      symbol,
      start.toISOString().slice(0, 10),
      end.toISOString().slice(0, 10),
    );
    return res.json({ data: { symbol, bars } });
  } catch (error) {
    console.error("[prices] failed", error);
    return res.status(500).json({
      error: {
        message: "Failed to fetch prices",
        details: error instanceof Error ? error.message : null,
      },
    });
  }
});

analysisRouter.post("/analyze", async (req, res) => {
  const parsed = analysisRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(makeValidationError(parsed.error));
  }

  const payload = parsed.data;
  let symbols: string[] = [];
  let scope = "";

  if (payload.groupId) {
    const group = await prisma.group.findUnique({
      where: { id: payload.groupId },
      include: { members: true },
    });
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }
    symbols = group.members.map((m) => m.symbol);
    scope = `group:${group.id}`;
  } else if (payload.symbols) {
    symbols = payload.symbols;
    scope = `symbols:${symbols.join(",")}`;
  }

  if (symbols.length === 0) {
    return res.status(400).json({
      error: { message: "No symbols to analyze", details: null },
    });
  }

  const rangeStart = payload.range.start;
  const rangeEnd = payload.range.end;
  const startDate = new Date(`${rangeStart}T00:00:00Z`);
  const endDate = new Date(`${rangeEnd}T00:00:00Z`);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
    return res.status(400).json({
      error: { message: "Invalid date range", details: null },
    });
  }

  try {
    const run = await prisma.analysisRun.create({
      data: {
        scope,
        providerUsed: marketDataProvider.name,
        parametersJson: JSON.stringify(payload),
      },
    });

    const results: {
      symbol: string;
      metrics: ReturnType<typeof computeMetrics>;
      signals: string[];
    }[] = [];

    for (const symbol of symbols) {
      const { bars } = await ensureBars(prisma, marketDataProvider, symbol, rangeStart, rangeEnd);
      const metrics = computeMetrics(bars);
      const signals = buildSignals(metrics);
      await prisma.analysisResult.create({
        data: {
          runId: run.id,
          symbol,
          metricsJson: JSON.stringify(metrics),
          signalsJson: JSON.stringify(signals),
        },
      });
      results.push({ symbol, metrics, signals });
    }

    return res.status(201).json({
      data: {
        runId: run.id,
        symbols,
        results,
      },
    });
  } catch (error) {
    console.error("[analyze] failed", error);
    return res.status(500).json({
      error: {
        message: "Analyze failed",
        details: error instanceof Error ? error.message : null,
      },
    });
  }
});

analysisRouter.get("/runs/:id", async (req, res) => {
  const run = await prisma.analysisRun.findUnique({
    where: { id: req.params.id },
  });
  if (!run) {
    return res.status(404).json({ error: "Run not found" });
  }

  const parameters = parseJson<unknown>(run.parametersJson) ?? run.parametersJson ?? null;

  return res.json({
    data: {
      id: run.id,
      createdAt: run.createdAt,
      scope: run.scope,
      providerUsed: run.providerUsed,
      parameters,
    },
  });
});

analysisRouter.get("/runs/:id/results", async (req, res) => {
  const run = await prisma.analysisRun.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });
  if (!run) {
    return res.status(404).json({ error: "Run not found" });
  }

  const results = await prisma.analysisResult.findMany({
    where: { runId: run.id },
    orderBy: { symbol: "asc" },
  });

  return res.json({
    data: {
      runId: run.id,
      results: results.map((row) => ({
        symbol: row.symbol,
        metrics: parseJson<ReturnType<typeof computeMetrics>>(row.metricsJson),
        signals: parseJson<string[]>(row.signalsJson) ?? [],
      })),
    },
  });
});
