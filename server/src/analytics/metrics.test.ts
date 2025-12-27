import assert from "node:assert/strict";
import test from "node:test";
import type { PriceBarDaily } from "@stonx/shared";
import { computeMetrics } from "./metrics.js";

const toDate = (start: string, offset: number) => {
  const base = new Date(`${start}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + offset);
  return base.toISOString().slice(0, 10);
};

const generateBars = (
  count: number,
  startDate = "2024-01-01",
  startClose = 100,
  closeStep = 1,
  volumeStart = 1000,
  volumeStep = 10,
): PriceBarDaily[] =>
  Array.from({ length: count }, (_, idx) => {
    const close = startClose + idx * closeStep;
    return {
      date: toDate(startDate, idx),
      open: close,
      high: close,
      low: close,
      close,
      volume: volumeStart + idx * volumeStep,
    };
  });

const expectCloseTo = (actual: number | null, expected: number, tolerance = 0.02) => {
  assert.notStrictEqual(actual, null, "expected metric to be present");
  assert.ok(Math.abs((actual as number) - expected) <= tolerance, `expected ${actual} ≈ ${expected}`);
};

const calcVolAnn = (closes: number[]) => {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  if (returns.length < 2) return null;
  const mean = returns.reduce((acc, r) => acc + r, 0) / returns.length;
  const variance =
    returns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
};

test("computes full metric set on increasing series", () => {
  const bars = generateBars(70);
  const metrics = computeMetrics(bars);
  const closes = bars.map((b) => b.close);

  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  const ret = (now: number, base: number) => ((now - base) / base) * 100;

  expectCloseTo(metrics.price, last);
  expectCloseTo(metrics.return1D, ret(last, prev));
  expectCloseTo(metrics.return5D, ret(last, closes[closes.length - 6]));
  expectCloseTo(metrics.return1M, ret(last, closes[closes.length - 22]));
  expectCloseTo(metrics.return3M, ret(last, closes[closes.length - 64]));

  expectCloseTo(metrics.sma20, (closes[closes.length - 20] + last) / 2);
  expectCloseTo(metrics.sma50, (closes[closes.length - 50] + last) / 2);
  expectCloseTo(metrics.maxDrawdown, 0);
  expectCloseTo(metrics.rsi14, 100, 0.01);
  const expectedVolAnn = calcVolAnn(closes);
  expectCloseTo(metrics.volAnn, expectedVolAnn ?? 0);

  // Volume z-score over last 20 linearly increasing volumes.
  const volumes = bars.map((b) => b.volume ?? 0).slice(-20);
  const mean = volumes.reduce((acc, v) => acc + v, 0) / volumes.length;
  const variance =
    volumes.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (volumes.length - 1);
  const stdDev = Math.sqrt(variance);
  const expectedZ = (volumes[volumes.length - 1] - mean) / stdDev;
  expectCloseTo(metrics.volumeZScore, expectedZ, 0.02);
});

test("handles drawdowns and short history", () => {
  const bars: PriceBarDaily[] = [
    { date: "2024-01-01", open: 100, high: 100, low: 100, close: 100, volume: 1000 },
    { date: "2024-01-02", open: 110, high: 110, low: 110, close: 110, volume: 1100 },
    { date: "2024-01-03", open: 90, high: 90, low: 90, close: 90, volume: 900 },
    { date: "2024-01-04", open: 95, high: 95, low: 95, close: 95, volume: 950 },
    { date: "2024-01-05", open: 96, high: 96, low: 96, close: 96, volume: 960 },
  ];

  const metrics = computeMetrics(bars);
  expectCloseTo(metrics.price, 96);
  expectCloseTo(metrics.return1D, ((96 - 95) / 95) * 100);
  assert.strictEqual(metrics.return5D, null);
  assert.strictEqual(metrics.return1M, null);
  assert.strictEqual(metrics.return3M, null);
  assert.strictEqual(metrics.sma20, null);
  assert.strictEqual(metrics.sma50, null);

  expectCloseTo(metrics.maxDrawdown, -18.18, 0.05);
  assert.ok((metrics.volAnn ?? 0) > 0);
  expectCloseTo(metrics.volumeZScore, -0.29, 0.02);
});

test("returns null metrics when no bars", () => {
  const metrics = computeMetrics([]);
  assert.deepStrictEqual(metrics, {
    price: null,
    return1D: null,
    return5D: null,
    return1M: null,
    return3M: null,
    volAnn: null,
    maxDrawdown: null,
    sma20: null,
    sma50: null,
    rsi14: null,
    volumeZScore: null,
  });
});
