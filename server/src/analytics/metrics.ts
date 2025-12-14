import { PriceBarDaily } from "@stonx/shared";

export type BasicMetrics = {
  price: number | null;
  return1M: number | null;
  volAnn: number | null;
  rsi14: number | null;
};

const round = (value: number | null, digits = 2) =>
  value === null ? null : Number(value.toFixed(digits));

export const computeMetrics = (bars: PriceBarDaily[]): BasicMetrics => {
  if (!bars.length) {
    return { price: null, return1M: null, volAnn: null, rsi14: null };
  }

  const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  const closes = sorted.map((bar) => bar.close);
  const latestClose = closes[closes.length - 1] ?? null;
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }

  let return1M: number | null = null;
  const monthLookback = 21;
  if (closes.length > monthLookback) {
    const latest = closes[closes.length - 1];
    const base = closes[closes.length - (monthLookback + 1)];
    return1M = ((latest - base) / base) * 100;
  }

  let volAnn: number | null = null;
  if (returns.length >= 2) {
    const mean = returns.reduce((acc, r) => acc + r, 0) / returns.length;
    const variance =
      returns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) /
      (returns.length - 1);
    volAnn = Math.sqrt(variance) * Math.sqrt(252) * 100;
  }

  let rsi14: number | null = null;
  if (closes.length >= 15) {
    const deltas: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      deltas.push(closes[i] - closes[i - 1]);
    }
    let gainSum = 0;
    let lossSum = 0;
    for (let i = 0; i < 14 && i < deltas.length; i++) {
      const delta = deltas[i];
      if (delta > 0) gainSum += delta;
      else lossSum += -delta;
    }
    let avgGain = gainSum / 14;
    let avgLoss = lossSum / 14;
    for (let i = 14; i < deltas.length; i++) {
      const delta = deltas[i];
      const gain = Math.max(delta, 0);
      const loss = Math.max(-delta, 0);
      avgGain = (avgGain * 13 + gain) / 14;
      avgLoss = (avgLoss * 13 + loss) / 14;
    }
    if (avgLoss === 0 && avgGain === 0) {
      rsi14 = 50;
    } else if (avgLoss === 0) {
      rsi14 = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsi14 = 100 - 100 / (1 + rs);
    }
  }

  return {
    price: round(latestClose),
    return1M: round(return1M),
    volAnn: round(volAnn),
    rsi14: round(rsi14, 0),
  };
};

export const buildSignals = (metrics: BasicMetrics): string[] => {
  const signals: string[] = [];
  if (metrics.rsi14 !== null) {
    if (metrics.rsi14 >= 70) signals.push("RSI_OVERBOUGHT");
    else if (metrics.rsi14 <= 30) signals.push("RSI_OVERSOLD");
  }
  if (metrics.return1M !== null) {
    if (metrics.return1M >= 5) signals.push("MOMENTUM_POS");
    else if (metrics.return1M <= -5) signals.push("MOMENTUM_NEG");
  }
  return signals;
};
