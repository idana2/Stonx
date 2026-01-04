import assert from "node:assert/strict";
import test from "node:test";
import { computeSymbolInsights, type SymbolInsights } from "./insights.js";
import type { BasicMetrics } from "./metrics.js";

const baseMetrics: BasicMetrics = {
  price: 100,
  return1D: 0,
  return5D: 0,
  return1M: 0,
  return3M: 0,
  volAnn: 20,
  maxDrawdown: -10,
  sma20: 95,
  sma50: 90,
  rsi14: 50,
  volumeZScore: 0,
};

const build = (overrides: Partial<BasicMetrics> = {}, signals: string[] = []) =>
  computeSymbolInsights({ ...baseMetrics, ...overrides }, signals);

test("bullish with high risk", () => {
  const insights = build(
    {
      price: 120,
      sma20: 110,
      sma50: 100,
      return1M: 6,
      return3M: 12,
      rsi14: 60,
      volAnn: 55,
      maxDrawdown: -15,
    },
    [],
  );

  assert.strictEqual(insights.trend, "Bullish");
  assert.strictEqual(insights.momentum, "Strong");
  assert.strictEqual(insights.risk, "High");
  assert.ok(insights.summary.toLowerCase().includes("bullish"));
});

test("bearish with low risk", () => {
  const insights = build(
    {
      price: 80,
      sma20: 90,
      sma50: 100,
      return1M: -2,
      return3M: -4,
      rsi14: 40,
      volAnn: 18,
      maxDrawdown: -10,
    },
    [],
  );
  assert.strictEqual(insights.trend, "Bearish");
  assert.strictEqual(insights.momentum, "Weak");
  assert.strictEqual(insights.risk, "Low");
});

test("flags volume spike and momentum negative anomaly", () => {
  const insights = build(
    {
      volumeZScore: 2.5,
      return1M: -6,
      return3M: -8,
      rsi14: 35,
    },
    ["MOMENTUM_NEG_LAST_MONTH"],
  );
  assert.ok(insights.anomalies.includes("VOLUME_SPIKE"));
  assert.ok(insights.anomalies.includes("MOMENTUM_NEG_LAST_MONTH"));
  assert.ok(insights.summary.toLowerCase().includes("notable"));
});
