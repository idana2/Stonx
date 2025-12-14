import { PriceBarDaily } from "@stonx/shared";

export interface MarketDataProvider {
  name: string;
  fetchDailyBars(symbol: string, start: Date, end: Date): Promise<PriceBarDaily[]>;
}
