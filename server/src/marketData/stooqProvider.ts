import { PriceBarDaily } from "@stonx/shared";
import { MarketDataProvider } from "./provider.js";

const BASE_URL = "https://stooq.pl/q/d/l/";

const formatDateParam = (date: Date) =>
  date.toISOString().slice(0, 10).replace(/-/g, "");

const parseFloatSafe = (value: string | undefined) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatYahooDate = (timestamp: number) => {
  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const fetchYahooDailyBars = async (
  symbol: string,
  start: Date,
  end: Date,
): Promise<PriceBarDaily[]> => {
  const period1 = Math.floor(start.getTime() / 1000);
  const period2 = Math.floor(end.getTime() / 1000);
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${period1}&period2=${period2}&interval=1d&events=div%2Csplit`;
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    return [];
  }
  const payload = (await response.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: {
          quote?: Array<{
            open?: Array<number | null>;
            high?: Array<number | null>;
            low?: Array<number | null>;
            close?: Array<number | null>;
            volume?: Array<number | null>;
          }>;
        };
      }>;
      error?: unknown;
    };
  };
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  if (!quote || timestamps.length === 0) return [];

  const bars: PriceBarDaily[] = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const date = formatYahooDate(timestamps[i]);
    if (!date) continue;
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    if (
      open === null ||
      open === undefined ||
      high === null ||
      high === undefined ||
      low === null ||
      low === undefined ||
      close === null ||
      close === undefined
    ) {
      continue;
    }
    bars.push({
      date,
      open,
      high,
      low,
      close,
      volume: quote.volume?.[i] ?? undefined,
    });
  }
  return bars;
};

export class StooqMarketDataProvider implements MarketDataProvider {
  name = "stooq";

  async fetchDailyBars(symbol: string, start: Date, end: Date): Promise<PriceBarDaily[]> {
    const ticker = `${symbol.toLowerCase()}.us`;
    const params = new URLSearchParams({
      s: ticker,
      d1: formatDateParam(start),
      d2: formatDateParam(end),
      i: "d",
    });
    const url = `${BASE_URL}?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      // Treat missing or unavailable data as empty to avoid failing the pipeline.
      if (response.status === 404) return [];
      throw new Error(`Provider request failed with status ${response.status}`);
    }

    const text = (await response.text()).trim();
    if (!text) {
      return [];
    }
    if (text.toLowerCase().includes("limit")) {
      return fetchYahooDailyBars(symbol, start, end);
    }

    const rows = text.split(/\r?\n/);
    const header = rows.shift()?.trim();
    if (!header) return [];

    const headers = header.split(",").map((h) => normalizeHeader(h));
    const colIndex = {
      date: headers.findIndex((h) => h === "date" || h === "data"),
      open: headers.findIndex((h) => h === "open" || h === "otwarcie"),
      high: headers.findIndex((h) => h === "high" || h === "najwyzszy"),
      low: headers.findIndex((h) => h === "low" || h === "najnizszy"),
      close: headers.findIndex((h) => h === "close" || h === "zamkniecie"),
      volume: headers.findIndex((h) => h === "volume" || h === "wolumen"),
    };

    if (colIndex.date === -1 || colIndex.open === -1 || colIndex.high === -1 || colIndex.low === -1 || colIndex.close === -1) {
      return [];
    }

    const bars: PriceBarDaily[] = [];
    for (const row of rows) {
      const cells = row.split(",");
      const date = cells[colIndex.date];
      if (!date || date === "N/D") continue;
      const openNum = parseFloatSafe(cells[colIndex.open]);
      const highNum = parseFloatSafe(cells[colIndex.high]);
      const lowNum = parseFloatSafe(cells[colIndex.low]);
      const closeNum = parseFloatSafe(cells[colIndex.close]);
      if (
        openNum === null ||
        highNum === null ||
        lowNum === null ||
        closeNum === null
      ) {
        continue;
      }
      const volumeCell = colIndex.volume >= 0 ? cells[colIndex.volume] : undefined;
      const volumeNum = parseFloatSafe(volumeCell) ?? undefined;
      bars.push({
        date,
        open: openNum,
        high: highNum,
        low: lowNum,
        close: closeNum,
        volume: volumeNum,
      });
    }

    return bars;
  }
}

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");
