import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { startFundamentalsSync } from "../fundamentals/sync.js";

const prisma = new PrismaClient();
const YAHOO_QUOTE_SUMMARY_URL = "https://query2.finance.yahoo.com/v10/finance/quoteSummary";
const YAHOO_CRUMB_URL = "https://query2.finance.yahoo.com/v1/test/getcrumb";
const YAHOO_COOKIE = process.env.YAHOO_COOKIE?.trim() ?? "";
export const fundamentalsRouter = Router();

const fundamentalsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(24).default(4),
});

const symbolParamSchema = z.object({
  symbol: z.string().min(1),
});

const refreshQuerySchema = z.object({
  symbol: z.string().min(1),
});

const parseNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseYahooRaw = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return parseNumber(value);
  if (typeof value === "object" && value !== null && "raw" in value) {
    return parseNumber((value as { raw?: unknown }).raw);
  }
  return parseNumber(value);
};

const fetchYahooCrumb = async () => {
  if (!YAHOO_COOKIE) return null;
  const crumbRes = await fetch(YAHOO_CRUMB_URL, {
    headers: {
      Cookie: YAHOO_COOKIE,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/plain",
    },
  });
  if (!crumbRes.ok) {
    return null;
  }
  const crumbText = (await crumbRes.text()).trim();
  if (!crumbText) return null;
  return { crumb: crumbText, cookie: YAHOO_COOKIE };
};

const fetchYahooOverview = async (symbol: string) => {
  const crumbData = await fetchYahooCrumb();
  const crumbQuery = crumbData?.crumb ? `&crumb=${encodeURIComponent(crumbData.crumb)}` : "";
  const url = `${YAHOO_QUOTE_SUMMARY_URL}/${encodeURIComponent(
    symbol,
  )}?modules=assetProfile,price,defaultKeyStatistics${crumbQuery}`;
  const response = await fetch(url, {
    headers: {
      Cookie: crumbData?.cookie ?? "",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as {
    quoteSummary?: {
      result?: Array<{
        assetProfile?: {
          sector?: string;
          industry?: string;
          longBusinessSummary?: string;
        };
        price?: {
          longName?: string;
          shortName?: string;
          exchangeName?: string;
          exchange?: string;
          marketCap?: { raw?: number };
        };
        defaultKeyStatistics?: { sharesOutstanding?: { raw?: number } };
      }>;
    };
  };
  const result = payload.quoteSummary?.result?.[0];
  return {
    name: result?.price?.longName ?? result?.price?.shortName ?? null,
    exchange: result?.price?.exchangeName ?? result?.price?.exchange ?? null,
    sector: result?.assetProfile?.sector ?? null,
    industry: result?.assetProfile?.industry ?? null,
    description: result?.assetProfile?.longBusinessSummary ?? null,
    marketCap: parseYahooRaw(result?.price?.marketCap),
    sharesOutstanding: parseYahooRaw(result?.defaultKeyStatistics?.sharesOutstanding),
  };
};

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
    const ticker = await prisma.ticker.findUnique({
      where: { symbol },
      select: { name: true, sector: true, industry: true },
    });
    let overview = null;
    try {
      overview = await fetchYahooOverview(symbol);
      if (overview && (overview.name || overview.sector || overview.industry)) {
        await prisma.ticker.update({
          where: { symbol },
          data: {
            name: overview.name ?? undefined,
            sector: overview.sector ?? undefined,
            industry: overview.industry ?? undefined,
          },
        });
      }
    } catch (error) {
      console.warn("[fundamentals] overview fetch failed", error);
    }
    const latestQuarter = quarters[0] ?? null;
    const latestPrice = await prisma.priceBarDaily.findFirst({
      where: { symbol },
      orderBy: { date: "desc" },
      select: { close: true },
    });
    const marketCapFromShares =
      latestQuarter?.sharesOutstanding && latestPrice?.close
        ? latestQuarter.sharesOutstanding * latestPrice.close
        : null;
    const marketCap = overview?.marketCap ?? marketCapFromShares;
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
            grossProfit: row.grossProfit ?? null,
            operatingIncome: row.operatingIncome ?? null,
            netIncome: row.netIncome ?? null,
            eps: row.epsDiluted ?? row.epsBasic ?? null,
            cash,
            debt,
            netCash,
            totalAssets: row.totalAssets ?? null,
            totalLiabilities: row.totalLiabilities ?? null,
            sharesOutstanding: row.sharesOutstanding ?? null,
            epsTtm: row.epsTtm ?? null,
            peTtm: row.peTtm ?? null,
            priceAsOf: row.priceAsOf ? row.priceAsOf.toISOString().slice(0, 10) : null,
            priceClose: row.priceClose ?? null,
          };
        }),
        overview: {
          symbol,
          name: overview?.name ?? ticker?.name ?? null,
          exchange: overview?.exchange ?? null,
          sector: overview?.sector ?? ticker?.sector ?? null,
          industry: overview?.industry ?? ticker?.industry ?? null,
          marketCap,
          description: overview?.description ?? null,
        },
        news: [],
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
