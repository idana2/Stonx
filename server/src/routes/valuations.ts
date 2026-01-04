import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

const prisma = new PrismaClient();
const YAHOO_CRUMB_URL = "https://query2.finance.yahoo.com/v1/test/getcrumb";
const YAHOO_QUOTE_SUMMARY_URL = "https://query2.finance.yahoo.com/v10/finance/quoteSummary";
const YAHOO_COOKIE = process.env.YAHOO_COOKIE?.trim() ?? "";

const querySchema = z.object({
  symbols: z.string().min(1),
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

const getLatestPrice = async (symbol: string) => {
  const price = await prisma.priceBarDaily.findFirst({
    where: { symbol },
    orderBy: { date: "desc" },
    select: { close: true },
  });
  if (!price?.close || !Number.isFinite(price.close)) {
    return null;
  }
  return price.close;
};

const getTrailingPeFromDb = async (symbol: string) => {
  const latest = await prisma.fundamentalQuarter.findFirst({
    where: { symbol },
    orderBy: { periodEnd: "desc" },
    select: { peTtm: true, epsTtm: true, periodEnd: true },
  });
  if (!latest?.epsTtm || !Number.isFinite(latest.epsTtm) || latest.epsTtm <= 0) {
    return null;
  }
  const price = await getLatestPrice(symbol);
  if (!price) return null;
  return price / latest.epsTtm;
};

const getForwardPeFromYahoo = async (symbol: string, price: number | null) => {
  const crumbData = await fetchYahooCrumb();
  if (!crumbData) {
    console.warn(`[valuations] Yahoo crumb unavailable for ${symbol}`);
    return null;
  }
  const crumbQuery = crumbData?.crumb ? `&crumb=${encodeURIComponent(crumbData.crumb)}` : "";
  const url = `${YAHOO_QUOTE_SUMMARY_URL}/${encodeURIComponent(
    symbol,
  )}?modules=defaultKeyStatistics,financialData${crumbQuery}`;
  const response = await fetch(url, {
    headers: {
      Cookie: crumbData?.cookie ?? "",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    console.warn(`[valuations] Yahoo quoteSummary failed (${response.status}) for ${symbol}`);
    return null;
  }
  const payload = (await response.json()) as {
    quoteSummary?: {
      result?: Array<{
        defaultKeyStatistics?: { forwardPE?: { raw?: number } };
        financialData?: { forwardPE?: { raw?: number }; forwardEps?: { raw?: number } };
      }>;
    };
  };
  const result = payload.quoteSummary?.result?.[0];
  const directForwardPe =
    parseYahooRaw(result?.defaultKeyStatistics?.forwardPE) ??
    parseYahooRaw(result?.financialData?.forwardPE);
  if (directForwardPe === null) {
    const forwardEpsRaw = parseYahooRaw(result?.financialData?.forwardEps);
    console.info(
      `[valuations] Yahoo forward fields for ${symbol}: forwardPE=${directForwardPe ?? "null"}, forwardEps=${forwardEpsRaw ?? "null"}`,
    );
  }
  if (directForwardPe !== null) {
    return directForwardPe;
  }
  const forwardEps = parseYahooRaw(result?.financialData?.forwardEps);
  if (forwardEps && forwardEps > 0 && price) {
    return price / forwardEps;
  }
  return null;
};

export const valuationsRouter = Router();

valuationsRouter.get("/", async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: { message: "Invalid query", details: parsed.error.flatten() },
    });
  }

  const symbols = Array.from(
    new Set(
      parsed.data.symbols
        .split(",")
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean),
    ),
  );

  if (symbols.length === 0) {
    return res.json({ data: { items: {} } });
  }

  try {
    const items = await symbols.reduce<
      Promise<Record<string, { trailingPe: number | null; forwardPe: number | null }>>
    >(async (accPromise, symbol) => {
      const acc = await accPromise;
      const [trailingPe, price] = await Promise.all([
        getTrailingPeFromDb(symbol),
        getLatestPrice(symbol),
      ]);
      const forwardPe = await getForwardPeFromYahoo(symbol, price);
      acc[symbol] = {
        trailingPe: parseNumber(trailingPe),
        forwardPe: parseNumber(forwardPe),
      };
      return acc;
    }, Promise.resolve({}));

    return res.json({ data: { items } });
  } catch (error) {
    console.error("[valuations] fetch failed", error);
    return res.status(500).json({
      error: {
        message: "Failed to load valuations",
        details: error instanceof Error ? error.message : null,
      },
    });
  }
});
