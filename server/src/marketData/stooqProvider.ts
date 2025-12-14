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
