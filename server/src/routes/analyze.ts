import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { computeMetrics, buildSignals } from "../analytics/metrics.js";
import { computeSymbolInsights, type SymbolInsights } from "../analytics/insights.js";
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
  range: z.enum(["1d", "1w", "1m", "3m", "6m", "1y"]).default("1m"),
});

const RANGE_DAYS: Record<z.infer<typeof pricesQuerySchema>["range"], number> = {
  "1d": 7,
  "1w": 7,
  "1m": 30,
  "3m": 90,
  "6m": 180,
  "1y": 365,
};

type GroupInsights = {
  score: number;
  avgReturn1M: number;
  avgVolAnn: number;
  dispersionReturn1M: number;
  momentumBreadth: number;
  topPerformer: string | null;
  bottomPerformer: string | null;
  summary: string;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const stddev = (values: number[]) => {
  if (values.length < 2) return 0;
  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
};

const buildSummary = (insights: GroupInsights) => {
  const phrases: string[] = [];

  if (insights.avgReturn1M > 5) phrases.push("Strong average returns");
  else if (insights.avgReturn1M > 0) phrases.push("Modest positive returns");
  else phrases.push("Weak or negative returns");

  if (insights.momentumBreadth >= 60) phrases.push("broad momentum");
  else if (insights.momentumBreadth >= 30) phrases.push("mixed momentum");
  else phrases.push("narrow momentum");

  if (insights.avgVolAnn > 40) phrases.push("with elevated volatility");
  else if (insights.avgVolAnn > 20) phrases.push("with moderate volatility");
  else phrases.push("with low volatility");

  if (insights.dispersionReturn1M > 10) phrases.push("and high dispersion");
  else if (insights.dispersionReturn1M > 5) phrases.push("and some dispersion");
  else phrases.push("and tight dispersion");

  return phrases.join(", ") + ".";
};

const computeGroupInsights = (
  perSymbol: {
    symbol: string;
    metrics: ReturnType<typeof computeMetrics>;
  }[],
): GroupInsights => {
  const returns = perSymbol
    .map((row) => row.metrics.return1M)
    .filter((value): value is number => value !== null && !Number.isNaN(value));
  const vols = perSymbol
    .map((row) => row.metrics.volAnn)
    .filter((value): value is number => value !== null && !Number.isNaN(value));
  const rsiValues = perSymbol
    .map((row) => row.metrics.rsi14)
    .filter((value): value is number => value !== null && !Number.isNaN(value));

  const avgReturn1M = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const avgVolAnn = vols.length ? vols.reduce((a, b) => a + b, 0) / vols.length : 0;
  const dispersionReturn1M = returns.length ? stddev(returns) : 0;

  const momentumBreadth =
    rsiValues.length === 0
      ? 0
      : (rsiValues.filter((rsi) => rsi > 50).length / rsiValues.length) * 100;

  let topPerformer: string | null = null;
  let bottomPerformer: string | null = null;
  if (returns.length > 0) {
    const sortedByReturn = perSymbol
      .filter((row) => row.metrics.return1M !== null)
      .sort((a, b) => (b.metrics.return1M ?? 0) - (a.metrics.return1M ?? 0));
    topPerformer = sortedByReturn[0]?.symbol ?? null;
    bottomPerformer = sortedByReturn[sortedByReturn.length - 1]?.symbol ?? null;
  }

  // Group Score: start at 50, add/subtract weighted components, clamp to [0,100].
  const returnComponent = clamp(avgReturn1M, -10, 10) * 3; // up to ±30 based on 1M return capped at ±10%.
  const breadthBonus = (momentumBreadth / 100) * 20; // up to +20 for broad momentum.
  const volPenalty = (clamp(avgVolAnn, 0, 80) / 80) * 20; // up to -20 for high vol (80%+).
  const dispersionPenalty = (clamp(dispersionReturn1M, 0, 20) / 20) * 15; // up to -15 for very wide dispersion.

  const rawScore = 50 + returnComponent + breadthBonus - volPenalty - dispersionPenalty;
  const score = clamp(Number(rawScore.toFixed(2)), 0, 100);

  const insights: GroupInsights = {
    score,
    avgReturn1M: Number(avgReturn1M.toFixed(2)),
    avgVolAnn: Number(avgVolAnn.toFixed(2)),
    dispersionReturn1M: Number(dispersionReturn1M.toFixed(2)),
    momentumBreadth: Number(momentumBreadth.toFixed(2)),
    topPerformer,
    bottomPerformer,
    summary: "",
  };

  insights.summary = buildSummary(insights);
  return insights;
};

analysisRouter.get("/prices", async (req, res) => {
  const parsed = pricesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(makeValidationError(parsed.error));
  }

  const { symbol, range } = parsed.data;
  const pad2 = (value: number) => String(value).padStart(2, "0");
  const formatLocalDate = (value: Date) =>
    `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  const endLocal = new Date();
  endLocal.setHours(0, 0, 0, 0);
  const startLocal = new Date(endLocal);
  startLocal.setDate(endLocal.getDate() - RANGE_DAYS[range]);

  try {
    const { bars } = await ensureBars(
      prisma,
      marketDataProvider,
      symbol,
      formatLocalDate(startLocal),
      formatLocalDate(endLocal),
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
      insights: SymbolInsights;
    }[] = [];

    for (const symbol of symbols) {
      const { bars } = await ensureBars(prisma, marketDataProvider, symbol, rangeStart, rangeEnd);
      const metrics = computeMetrics(bars);
      const signals = buildSignals(metrics);
      const insights = computeSymbolInsights(metrics, signals);
      await prisma.analysisResult.create({
        data: {
          runId: run.id,
          symbol,
          metricsJson: JSON.stringify(metrics),
          // Store both signals and insights together to avoid schema changes.
          signalsJson: JSON.stringify({ signals, insights }),
        },
      });
      results.push({ symbol, metrics, signals, insights });
    }

    const insights = computeGroupInsights(results);

    await prisma.analysisRun.update({
      where: { id: run.id },
      data: {
        parametersJson: JSON.stringify({
          request: payload,
          groupInsights: insights,
        }),
      },
    });

    return res.status(201).json({
      data: {
        runId: run.id,
        symbols,
        results,
        groupInsights: insights,
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
        // Accept legacy array payloads as well as enriched objects.
        ...(() => {
          const parsedSignals = parseJson<unknown>(row.signalsJson);
          if (Array.isArray(parsedSignals)) {
            const metrics = parseJson<ReturnType<typeof computeMetrics>>(row.metricsJson);
            const signals = parsedSignals.filter((s): s is string => typeof s === "string");
            return {
              signals,
              insights: metrics ? computeSymbolInsights(metrics, signals) : null,
            };
          }
          if (parsedSignals && typeof parsedSignals === "object") {
            const maybeSignals = (parsedSignals as { signals?: unknown }).signals;
            const signals = Array.isArray(maybeSignals)
              ? maybeSignals.filter((s): s is string => typeof s === "string")
              : [];
            const insights = (parsedSignals as { insights?: unknown }).insights as SymbolInsights | null;
            return { signals, insights: insights ?? null };
          }
          return { signals: [], insights: null };
        })(),
      })),
    },
  });
});
