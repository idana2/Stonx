import { BasicMetrics } from "./metrics.js";

export type TrendLabel = "Bullish" | "Bearish" | "Sideways";
export type MomentumLabel = "Strong" | "Moderate" | "Weak";
export type RiskLabel = "Low" | "Medium" | "High";

export type SymbolInsights = {
  trend: TrendLabel;
  momentum: MomentumLabel;
  risk: RiskLabel;
  anomalies: string[];
  summary: string;
};

const hasAll = (...values: (number | null)[]) => values.every((v) => v !== null);

const buildSummary = (trend: TrendLabel, momentum: MomentumLabel, risk: RiskLabel, anomalies: string[]) => {
  const parts = [`${trend} trend with ${momentum.toLowerCase()} momentum`, `risk ${risk.toLowerCase()}`];
  let summary = `${parts.join("; ")}.`;
  if (anomalies.length > 0) {
    const toWords = (code: string) => code.replace(/_/g, " ").toLowerCase();
    summary += ` Notable: ${toWords(anomalies[0])}.`;
  }
  return summary;
};

export const computeSymbolInsights = (metrics: BasicMetrics, signals: string[]): SymbolInsights => {
  const { price, sma20, sma50, return3M, return1M, rsi14, volAnn, maxDrawdown, volumeZScore } = metrics;

  let trend: TrendLabel = "Sideways";
  if (hasAll(price, sma20, sma50)) {
    if (
      (price as number) > (sma20 as number) &&
      (sma20 as number) > (sma50 as number)
    ) {
      trend = "Bullish";
    } else if (
      (price as number) < (sma20 as number) &&
      (sma20 as number) < (sma50 as number)
    ) {
      trend = "Bearish";
    }
  }
  if (trend === "Sideways" && hasAll(price, sma50, return3M)) {
    if ((price as number) > (sma50 as number) && (return3M as number) > 0) {
      trend = "Bullish";
    } else if ((price as number) < (sma50 as number) && (return3M as number) < 0) {
      trend = "Bearish";
    }
  }

  let momentum: MomentumLabel = "Moderate";
  if (hasAll(return1M, return3M, rsi14)) {
    if ((return1M as number) > 0 && (return3M as number) > 0 && (rsi14 as number) >= 55) {
      momentum = "Strong";
    } else if ((return1M as number) < 0 && (return3M as number) < 0 && (rsi14 as number) <= 45) {
      momentum = "Weak";
    }
  }

  let risk: RiskLabel = "Medium";
  if (hasAll(volAnn, maxDrawdown)) {
    if ((volAnn as number) >= 45 || (maxDrawdown as number) <= -35) {
      risk = "High";
    } else if ((volAnn as number) <= 25 && (maxDrawdown as number) >= -20) {
      risk = "Low";
    }
  }

  const anomalies: string[] = [];
  if (volumeZScore !== null) {
    if (volumeZScore >= 2) anomalies.push("VOLUME_SPIKE");
    else if (volumeZScore <= -2) anomalies.push("VOLUME_DROP");
  }
  if (rsi14 !== null) {
    if (rsi14 >= 70) anomalies.push("RSI_OVERBOUGHT");
    else if (rsi14 <= 30) anomalies.push("RSI_OVERSOLD");
  }
  if (maxDrawdown !== null && maxDrawdown <= -35) anomalies.push("DRAWDOWN_ELEVATED");
  if (signals.includes("MOMENTUM_NEG_LAST_MONTH")) anomalies.push("MOMENTUM_NEG_LAST_MONTH");

  const summary = buildSummary(trend, momentum, risk, anomalies);

  return { trend, momentum, risk, anomalies, summary };
};
