import { PrismaClient } from "@prisma/client";
import { PriceBarDaily } from "@stonx/shared";
import { MarketDataProvider } from "./provider.js";

type DateRange = { start: Date; end: Date };

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

const toDateOnly = (value: string | Date) => {
  const parsed = typeof value === "string" ? new Date(`${value}T00:00:00Z`) : value;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const isTradingDay = (date: Date) => {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
};

const findMissingRanges = (
  start: Date,
  end: Date,
  haveDates: Set<string>,
): DateRange[] => {
  const ranges: DateRange[] = [];
  let cursor = new Date(start);
  let openRange: Date | null = null;

  while (cursor <= end) {
    const key = dateKey(cursor);
    if (isTradingDay(cursor) && !haveDates.has(key)) {
      if (!openRange) {
        openRange = new Date(cursor);
      }
    } else if (openRange) {
      ranges.push({ start: openRange, end: addDays(cursor, -1) });
      openRange = null;
    }
    cursor = addDays(cursor, 1);
  }

  if (openRange) {
    ranges.push({ start: openRange, end: new Date(end) });
  }

  return ranges;
};

export const ensureBars = async (
  prisma: PrismaClient,
  provider: MarketDataProvider,
  symbol: string,
  start: string,
  end: string,
): Promise<{ bars: PriceBarDaily[]; fetched: number }> => {
  const startDate = toDateOnly(start);
  const requestedEnd = toDateOnly(end);
  const today = toDateOnly(new Date());
  // Avoid querying the provider for future dates, which return no data.
  const endDate = requestedEnd > today ? today : requestedEnd;

  await prisma.ticker.upsert({
    where: { symbol },
    update: {},
    create: { symbol },
  });

  const existing = await prisma.priceBarDaily.findMany({
    where: {
      symbol,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: "asc" },
  });

  const haveDates = new Set(existing.map((row) => dateKey(row.date)));
  const missing = findMissingRanges(startDate, endDate, haveDates);

  let fetched = 0;
  if (missing.length > 0) {
    const fetchStart = missing[0].start;
    const fetchEnd = missing[missing.length - 1].end;
    const remoteBars = await provider.fetchDailyBars(symbol, fetchStart, fetchEnd);
    const rows = remoteBars
      .map((bar) => ({
        ...bar,
        dateObj: toDateOnly(bar.date),
      }))
      .filter(({ dateObj }) => dateObj >= startDate && dateObj <= endDate)
      .map(({ date, dateObj, open, high, low, close, volume }) => ({
        symbol,
        date: dateObj,
        open,
        high,
        low,
        close,
        volume: volume ?? null,
      }));

    if (rows.length > 0) {
      fetched = rows.length;
      await prisma.$transaction([
        prisma.priceBarDaily.deleteMany({
          where: {
            symbol,
            date: { gte: fetchStart, lte: fetchEnd },
          },
        }),
        prisma.priceBarDaily.createMany({
          data: rows,
        }),
      ]);
    }
  }

  const finalBars = await prisma.priceBarDaily.findMany({
    where: {
      symbol,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: "asc" },
  });

  return {
    fetched,
    bars: finalBars.map((row) => ({
      date: dateKey(row.date),
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume ?? undefined,
    })),
  };
};
