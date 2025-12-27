import { PriceBarDaily } from "@stonx/shared";

export type BasicMetrics = {
  price: number | null;
  return1D: number | null;
  return5D: number | null;
  return1M: number | null;
  return3M: number | null;
  volAnn: number | null;
  maxDrawdown: number | null;
  sma20: number | null;
  sma50: number | null;
  rsi14: number | null;
  volumeZScore: number | null;
};

const round = (value: number | null, digits = 2) =>
  value === null ? null : Number(value.toFixed(digits));

const percentChange = (current: number, base: number) => ((current - base) / base) * 100;

const computeReturn = (lookback: number, closes: number[]) => {
  if (closes.length > lookback) {
    const latest = closes[closes.length - 1];
    const base = closes[closes.length - (lookback + 1)];
    return percentChange(latest, base);
  }
  return null;
};

const computeSma = (window: number, closes: number[]) => {
  if (closes.length >= window) {
    const slice = closes.slice(-window);
    return slice.reduce((acc, v) => acc + v, 0) / slice.length;
  }
  return null;
};

const computeMaxDrawdown = (closes: number[]) => {
  if (closes.length < 2) return null;
  let peak = closes[0];
  let worst = 0;
  for (const price of closes) {
    if (price > peak) peak = price;
    const drawdown = (price - peak) / peak;
    if (drawdown < worst) {
      worst = drawdown;
    }
  }
  return worst * 100;
};

const computeVolumeZScore = (bars: PriceBarDaily[]) => {
  const withVolume = bars.filter((bar) => bar.volume !== undefined && bar.volume !== null);
  if (withVolume.length === 0) return null;

  const latest = withVolume[withVolume.length - 1];
  if (latest.volume === undefined || latest.volume === null) return null;

  const window = withVolume.slice(-20).map((bar) => bar.volume as number);
  if (window.length < 2) return null;

  const mean = window.reduce((acc, v) => acc + v, 0) / window.length;
  const variance =
    window.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (window.length - 1);
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;
  return (latest.volume - mean) / stdDev;
};

export const computeMetrics = (bars: PriceBarDaily[]): BasicMetrics => {
  if (!bars.length) {
    return {
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
    };
  }

  const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  const closes = sorted.map((bar) => bar.close);
  const latestClose = closes[closes.length - 1] ?? null;

  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }

  const return1D = computeReturn(1, closes);
  const return5D = computeReturn(5, closes);
  const return1M = computeReturn(21, closes);
  const return3M = computeReturn(63, closes);

  let volAnn: number | null = null;
  if (returns.length >= 2) {
    const mean = returns.reduce((acc, r) => acc + r, 0) / returns.length;
    const variance =
      returns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    volAnn = Math.sqrt(variance) * Math.sqrt(252) * 100;
  }

  const maxDrawdown = computeMaxDrawdown(closes);
  const sma20 = computeSma(20, closes);
  const sma50 = computeSma(50, closes);

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

  const volumeZScore = computeVolumeZScore(sorted);

  return {
    price: round(latestClose),
    return1D: round(return1D),
    return5D: round(return5D),
    return1M: round(return1M),
    return3M: round(return3M),
    volAnn: round(volAnn),
    maxDrawdown: round(maxDrawdown),
    sma20: round(sma20),
    sma50: round(sma50),
    rsi14: round(rsi14, 0),
    volumeZScore: round(volumeZScore),
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
