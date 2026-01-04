import { PrismaClient } from "@prisma/client";

const YAHOO_BASE_URL = "https://query2.finance.yahoo.com";
const YAHOO_TIMESERIES_PATH = "/ws/fundamentals-timeseries/v1/finance/timeseries";
const RATE_LIMIT_DELAY_MS = 400;
const MAX_RUNNING_AGE_MS = 15 * 60 * 1000;

type FundamentalInput = {
  symbol: string;
  periodEnd: Date;
  fiscalYear: number | null;
  fiscalQuarter: number | null;
  currency: string | null;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  epsBasic: number | null;
  epsDiluted: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  cashAndEquivalents: number | null;
  totalDebt: number | null;
  sharesOutstanding: number | null;
};

const normalizeNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractRawNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return normalizeNumber(value);
  if (typeof value === "object" && value !== null && "raw" in value) {
    return normalizeNumber((value as { raw?: unknown }).raw);
  }
  return normalizeNumber(value);
};

const parseQuarter = (value: unknown): number | null => {
  if (typeof value !== "string") return null;
  const match = value.match(/Q([1-4])/i);
  return match ? Number(match[1]) : null;
};

const toDate = (value: string) => new Date(`${value}T00:00:00Z`);

const toDateFromEndDate = (value: unknown): Date | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return new Date(value * 1000);
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && value !== null && "raw" in value) {
    const raw = (value as { raw?: unknown }).raw;
    if (typeof raw === "number") return new Date(raw * 1000);
    if (typeof raw === "string") {
      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }
  return null;
};

const toQuarter = (date: Date) => Math.floor(date.getUTCMonth() / 3) + 1;

const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

type YahooSeriesEntry = {
  asOfDate?: string;
  reportedValue?: { raw?: number | null };
  currencyCode?: string;
};

type YahooSeriesResult = {
  meta?: { symbol?: string[]; type?: string[] };
  timestamp?: number[];
  [key: string]: unknown;
};

const extractReportedValue = (entry?: YahooSeriesEntry | null) =>
  entry ? extractRawNumber(entry.reportedValue?.raw ?? entry.reportedValue) : null;

const buildSeriesMap = (entries: YahooSeriesEntry[] | undefined) => {
  const map = new Map<string, YahooSeriesEntry>();
  for (const entry of entries ?? []) {
    if (entry.asOfDate) {
      map.set(entry.asOfDate, entry);
    }
  }
  return map;
};

const fetchYahooQuarterly = async (
  symbol: string,
): Promise<{ rows: FundamentalInput[]; rateLimited: boolean }> => {
  const encoded = encodeURIComponent(symbol);
  const nowSec = Math.floor(Date.now() / 1000);
  const fiveYearsSec = nowSec - 60 * 60 * 24 * 365 * 5;
  const url =
    `${YAHOO_BASE_URL}${YAHOO_TIMESERIES_PATH}/${encoded}` +
    `?period1=${fiveYearsSec}&period2=${nowSec}` +
    "&type=quarterlyTotalRevenue,quarterlyNetIncome,quarterlyDilutedEPS,quarterlyBasicEPS," +
    "quarterlyCashAndCashEquivalents,quarterlyTotalDebt&merge=false";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (res.status === 429) {
    return { rows: [], rateLimited: true };
  }
  if (!res.ok) {
    throw new Error(`Yahoo timeseries failed (${res.status})`);
  }

  const payload = (await res.json()) as {
    timeseries?: { result?: YahooSeriesResult[]; error?: unknown };
  };
  const results = payload.timeseries?.result ?? [];

  const pickSeries = (key: string) => {
    const found =
      results.find((result) => {
        const metaType = (result.meta as { type?: string[] } | undefined)?.type ?? [];
        return Array.isArray(metaType) && metaType.includes(key);
      }) ??
      results.find((result) => Array.isArray((result as Record<string, unknown>)[key]));
    return (found?.[key] as YahooSeriesEntry[] | undefined) ?? [];
  };

  const revenueMap = buildSeriesMap(pickSeries("quarterlyTotalRevenue"));
  const netIncomeMap = buildSeriesMap(pickSeries("quarterlyNetIncome"));
  const epsDilutedMap = buildSeriesMap(pickSeries("quarterlyDilutedEPS"));
  const epsBasicMap = buildSeriesMap(pickSeries("quarterlyBasicEPS"));
  const cashMap = buildSeriesMap(pickSeries("quarterlyCashAndCashEquivalents"));
  const debtMap = buildSeriesMap(pickSeries("quarterlyTotalDebt"));

  const allDates = new Set<string>([
    ...revenueMap.keys(),
    ...netIncomeMap.keys(),
    ...epsDilutedMap.keys(),
    ...epsBasicMap.keys(),
    ...cashMap.keys(),
    ...debtMap.keys(),
  ]);

  if (results.length === 0) {
    console.warn(`[fundamentals] Yahoo returned no timeseries for ${symbol}`);
  }

  const rows: FundamentalInput[] = [];
  for (const dateValue of allDates) {
    const periodEnd = toDate(dateValue);
    if (Number.isNaN(periodEnd.getTime())) continue;
    const revenueEntry = revenueMap.get(dateValue);
    const netIncomeEntry = netIncomeMap.get(dateValue);
    const epsDilutedEntry = epsDilutedMap.get(dateValue);
    const epsBasicEntry = epsBasicMap.get(dateValue);
    const cashEntry = cashMap.get(dateValue);
    const debtEntry = debtMap.get(dateValue);
    const currency =
      revenueEntry?.currencyCode ??
      netIncomeEntry?.currencyCode ??
      cashEntry?.currencyCode ??
      debtEntry?.currencyCode ??
      null;

    rows.push({
      symbol,
      periodEnd,
      fiscalYear: periodEnd.getUTCFullYear(),
      fiscalQuarter: toQuarter(periodEnd),
      currency,
      revenue: extractReportedValue(revenueEntry),
      grossProfit: null,
      operatingIncome: null,
      netIncome: extractReportedValue(netIncomeEntry),
      epsBasic: extractReportedValue(epsBasicEntry),
      epsDiluted: extractReportedValue(epsDilutedEntry),
      totalAssets: null,
      totalLiabilities: null,
      cashAndEquivalents: extractReportedValue(cashEntry),
      totalDebt: extractReportedValue(debtEntry),
      sharesOutstanding: null,
    });
  }

  return { rows, rateLimited: false };
};

const buildTtmEps = (rows: FundamentalInput[]) => {
  const sorted = [...rows].sort((a, b) => a.periodEnd.getTime() - b.periodEnd.getTime());
  const epsSeries = sorted.map((row) => row.epsDiluted ?? row.epsBasic ?? null);
  const ttmValues = new Map<string, number | null>();

  for (let i = 0; i < sorted.length; i += 1) {
    if (i < 3) {
      ttmValues.set(sorted[i].periodEnd.toISOString(), null);
      continue;
    }
    const window = epsSeries.slice(i - 3, i + 1);
    if (window.some((value) => value === null)) {
      ttmValues.set(sorted[i].periodEnd.toISOString(), null);
      continue;
    }
    const sum = window.reduce((acc, value) => acc + (value ?? 0), 0);
    ttmValues.set(sorted[i].periodEnd.toISOString(), sum);
  }

  return ttmValues;
};

export const startFundamentalsSync = async (
  prisma: PrismaClient,
  options?: { symbols?: string[] },
): Promise<{ started: boolean; reason?: string }> => {
  const existingState = await prisma.fundamentalSyncState.findUnique({
    where: { id: "global" },
  });
  if (existingState?.status === "running") {
    const lastRunAt = existingState.lastRunAt?.getTime() ?? 0;
    const now = Date.now();
    if (now - lastRunAt < MAX_RUNNING_AGE_MS) {
      return { started: false, reason: "running" };
    }
    console.warn("[fundamentals] stale running state detected, continuing");
  }

  await prisma.fundamentalSyncState.upsert({
    where: { id: "global" },
    update: { status: "running", lastRunAt: new Date(), lastError: null },
    create: { id: "global", status: "running", lastRunAt: new Date(), lastError: null },
  });

  let status: "idle" | "error" = "idle";
  let lastError: string | null = null;

  try {
    let symbols = options?.symbols ?? [];
    if (!symbols.length) {
      const members = await prisma.groupMember.findMany({
        select: { symbol: true },
        distinct: ["symbol"],
      });
      symbols = members.map((row) => row.symbol);
    }

    const deduped = Array.from(
      new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)),
    );

    console.info(`[fundamentals] syncing ${deduped.length} symbols via Yahoo`);
    for (let i = 0; i < deduped.length; i += 1) {
      const symbol = deduped[i];
      try {
        const { rows, rateLimited } = await fetchYahooQuarterly(symbol);
        console.info(`[fundamentals] Yahoo rows for ${symbol}: ${rows.length}`);
        if (rateLimited) {
          status = "error";
          lastError = "Rate limit hit";
          console.warn(`[fundamentals] rate limited on ${symbol}`);
          break;
        }

        if (rows.length === 0) {
          await delay(RATE_LIMIT_DELAY_MS);
          continue;
        }

        await prisma.ticker.upsert({
          where: { symbol },
          update: {},
          create: { symbol },
        });

        const fetchedAt = new Date();
        const upserts = rows.map((row) =>
          prisma.fundamentalQuarter.upsert({
            where: { symbol_periodEnd: { symbol, periodEnd: row.periodEnd } },
            create: {
              ...row,
              source: "YAHOO",
              fetchedAt,
            },
            update: {
              ...row,
              source: "YAHOO",
              fetchedAt,
            },
          }),
        );
        await prisma.$transaction(upserts);

        const ttmMap = buildTtmEps(rows);
        const sorted = [...rows].sort((a, b) => a.periodEnd.getTime() - b.periodEnd.getTime());
        const updates = [];
        for (const row of sorted) {
          const epsTtm = ttmMap.get(row.periodEnd.toISOString()) ?? null;
          const price = await prisma.priceBarDaily.findFirst({
            where: {
              symbol,
              date: { lte: row.periodEnd },
            },
            orderBy: { date: "desc" },
          });
          const priceClose = price?.close ?? null;
          const priceAsOf = price?.date ?? null;
          const peTtm = epsTtm && epsTtm > 0 && priceClose ? priceClose / epsTtm : null;
          updates.push(
            prisma.fundamentalQuarter.update({
              where: { symbol_periodEnd: { symbol, periodEnd: row.periodEnd } },
              data: { epsTtm, priceClose, priceAsOf, peTtm },
            }),
          );
        }
        if (updates.length > 0) {
          await prisma.$transaction(updates);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`[fundamentals] sync failed for ${symbol}`, error);
        lastError = message;
      }

      if (i < deduped.length - 1) {
        await delay(RATE_LIMIT_DELAY_MS);
      }
    }
  } catch (error) {
    status = "error";
    lastError = error instanceof Error ? error.message : "Unknown error";
    console.error("[fundamentals] sync failed", error);
  } finally {
    await prisma.fundamentalSyncState.upsert({
      where: { id: "global" },
      update: { status, lastError },
      create: { id: "global", status, lastError },
    });
  }

  return { started: true };
};
