Task: Implement a real MarketDataProvider with caching (no UI changes).

Requirements:
- Create a MarketDataProvider interface.
- Implement one free provider for daily OHLCV bars.
- Store data in PriceBarDaily.
- Add ensureBars(symbol, start, end) with gap detection.
- Update POST /api/analyze to use real bars instead of fake metrics.
- Keep API responses identical.
- Do not modify client code