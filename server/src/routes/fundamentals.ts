import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { startFundamentalsSync } from "../fundamentals/sync.js";

const prisma = new PrismaClient();
export const fundamentalsRouter = Router();

const fundamentalsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(12).default(4),
});

const symbolParamSchema = z.object({
  symbol: z.string().min(1),
});

const refreshQuerySchema = z.object({
  symbol: z.string().min(1),
});

fundamentalsRouter.get("/:symbol", async (req, res) => {
  const symbolParsed = symbolParamSchema.safeParse(req.params);
  const queryParsed = fundamentalsQuerySchema.safeParse(req.query);
  if (!symbolParsed.success) {
    return res.status(400).json({
      error: { message: "Invalid symbol", details: symbolParsed.error.flatten() },
    });
  }
  if (!queryParsed.success) {
    return res.status(400).json({
      error: { message: "Invalid query", details: queryParsed.error.flatten() },
    });
  }

  try {
    const symbol = symbolParsed.data.symbol.toUpperCase();
    const providerEnabled = process.env.YAHOO_DISABLED?.trim() !== "true";
    const limit = queryParsed.data.limit;
    const quarters = await prisma.fundamentalQuarter.findMany({
      where: { symbol },
      orderBy: { periodEnd: "desc" },
      take: limit,
    });
    const latestFetched = await prisma.fundamentalQuarter.findFirst({
      where: { symbol },
      orderBy: { fetchedAt: "desc" },
      select: { fetchedAt: true },
    });
    const syncState = await prisma.fundamentalSyncState.findUnique({
      where: { id: "global" },
    });

    res.json({
      data: {
        symbol,
        quarters: quarters.map((row) => {
          const cash = row.cashAndEquivalents ?? null;
          const debt = row.totalDebt ?? null;
          const netCash = cash !== null && debt !== null ? cash - debt : null;
          return {
            periodEnd: row.periodEnd.toISOString().slice(0, 10),
            revenue: row.revenue ?? null,
            netIncome: row.netIncome ?? null,
            eps: row.epsDiluted ?? row.epsBasic ?? null,
            cash,
            debt,
            netCash,
            epsTtm: row.epsTtm ?? null,
            peTtm: row.peTtm ?? null,
            priceAsOf: row.priceAsOf ? row.priceAsOf.toISOString().slice(0, 10) : null,
          };
        }),
        meta: {
          provider: "Yahoo",
          providerEnabled,
          latestFetchedAt: latestFetched?.fetchedAt
            ? latestFetched.fetchedAt.toISOString()
            : null,
          syncStatus: syncState?.status ?? "idle",
        },
      },
    });
  } catch (error) {
    console.error("[fundamentals] fetch failed", error);
    return res.status(500).json({
      error: {
        message: "Failed to load fundamentals",
        details: error instanceof Error ? error.message : null,
      },
    });
  }
});

fundamentalsRouter.post("/refresh", async (req, res) => {
  const parsed = refreshQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: { message: "Invalid query", details: parsed.error.flatten() },
    });
  }

  const symbol = parsed.data.symbol.trim().toUpperCase();
  void startFundamentalsSync(prisma, { symbols: [symbol] });
  return res.status(202).json({
    data: {
      symbol,
      status: "queued",
    },
  });
});
