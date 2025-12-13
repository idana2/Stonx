import { useEffect, useMemo, useState } from "react";
import {
  AnalysisRequest,
  AnalysisResult,
  Group,
  SignalBadge,
} from "@stonx/shared";

const fallbackGroups: Group[] = [
  {
    id: "mega-cap-tech",
    name: "MegaCap Tech",
    type: "manual",
    symbols: ["AAPL", "MSFT", "GOOGL", "AMZN"],
  },
  {
    id: "semis",
    name: "Semiconductors",
    type: "manual",
    symbols: ["NVDA", "AVGO", "AMD", "TSM"],
  },
  {
    id: "energy",
    name: "Energy",
    type: "manual",
    symbols: ["XOM", "CVX", "COP", "SLB"],
  },
];

const sampleAnalysis: AnalysisResult = {
  generatedAt: new Date().toISOString(),
  range: { start: "2024-01-01", end: "2024-06-30" },
  provider: "demo-local",
  notes: ["Sample data only. Run the backend to fetch fresh results."],
  rows: [
    {
      symbol: "AAPL",
      metrics: {
        return1M: { label: "1M Return", value: 4.2, unit: "%" },
        vol: { label: "Vol (ann)", value: 22.1, unit: "%" },
        rsi: { label: "RSI14", value: 54 },
      },
      signals: [{ code: "TREND_UP", description: "Above SMA50", severity: "info" }],
    },
    {
      symbol: "MSFT",
      metrics: {
        return1M: { label: "1M Return", value: 3.1, unit: "%" },
        vol: { label: "Vol (ann)", value: 19.4, unit: "%" },
        rsi: { label: "RSI14", value: 48 },
      },
      signals: [{ code: "NEUTRAL", description: "Inside range", severity: "warn" }],
    },
    {
      symbol: "NVDA",
      metrics: {
        return1M: { label: "1M Return", value: 8.8, unit: "%" },
        vol: { label: "Vol (ann)", value: 35.2, unit: "%" },
        rsi: { label: "RSI14", value: 62 },
      },
      signals: [
        { code: "BREAKOUT", description: "Close > recent high", severity: "alert" },
      ],
    },
  ],
};

function App() {
  const [groups, setGroups] = useState<Group[]>(fallbackGroups);
  const [groupsStatus, setGroupsStatus] = useState("Using seed groups");
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>();
  const [range, setRange] = useState({ start: "2024-01-01", end: "2024-06-30" });
  const [analysisStatus, setAnalysisStatus] = useState("Ready to analyze");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/groups");
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const payload = await res.json();
        if (Array.isArray(payload.data)) {
          setGroups(payload.data);
          setGroupsStatus("Live data from server");
        }
      } catch (error) {
        console.warn("Falling back to local seed groups", error);
        setGroupsStatus("Using seed groups (start server to sync)");
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedGroupId && groups.length > 0) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups, selectedGroupId]);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId),
    [groups, selectedGroupId],
  );

  const handleAnalyze = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const request: AnalysisRequest = {
      groupId: selectedGroupId,
      range,
      metrics: ["returns", "volatility", "rsi14", "sma20", "sma50"],
    };
    console.info("TODO call backend analyze", request);
    setAnalysisStatus(
      `Queued analysis for ${selectedGroup?.name ?? "selection"} (${range.start} -> ${range.end})`,
    );
  };

  const renderSignals = (signals: SignalBadge[]) => {
    if (!signals.length) return "—";
    return signals
      .map((signal) => `${signal.code}${signal.severity ? ` (${signal.severity})` : ""}`)
      .join(", ");
  };

  return (
    <div className="app-shell">
      <header>
        <h1 className="title">Stonx: Analyze Groups Fast</h1>
        <p className="subtitle">
          Fetch > Analyze > Visualize. Local-only, SQLite-backed MVP with React + Express.
        </p>
      </header>

      <main>
        <section className="card">
          <h2>Groups</h2>
          <p>Track watchlists, sectors, or custom clusters. Click analyze to launch a run.</p>
          <div className="status">{groupsStatus}</div>
          <ul>
            {groups.map((g) => (
              <li key={g.id}>
                <span className="pill">{g.type}</span>
                <strong>{g.name}</strong> — {g.symbols.join(", ")}
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>Analyze Wizard</h2>
          <p>Pick a group, set the range, and run analytics. Backend hookup TBD.</p>
          <form onSubmit={handleAnalyze}>
            <label htmlFor="group">Group</label>
            <select
              id="group"
              value={selectedGroupId ?? ""}
              onChange={(e) => setSelectedGroupId(e.target.value)}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>

            <label htmlFor="start">Start</label>
            <input
              id="start"
              type="date"
              value={range.start}
              onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
            />

            <label htmlFor="end">End</label>
            <input
              id="end"
              type="date"
              value={range.end}
              onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
            />

            <button type="submit">Run analysis</button>
            <div className="status">{analysisStatus}</div>
          </form>
        </section>

        <section className="card">
          <h2>Results Dashboard</h2>
          <p>Snapshot of recent metrics (sample). Wire to /api/analyze to make it live.</p>
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>1M Return</th>
                <th>Vol (ann)</th>
                <th>RSI14</th>
                <th>Signals</th>
              </tr>
            </thead>
            <tbody>
              {sampleAnalysis.rows.map((row) => (
                <tr key={row.symbol}>
                  <td>{row.symbol}</td>
                  <td>
                    {row.metrics.return1M?.value ?? "—"} {row.metrics.return1M?.unit ?? ""}
                  </td>
                  <td>
                    {row.metrics.vol?.value ?? "—"} {row.metrics.vol?.unit ?? ""}
                  </td>
                  <td>{row.metrics.rsi?.value ?? "—"}</td>
                  <td>{renderSignals(row.signals)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="status">
            Range: {sampleAnalysis.range.start} -> {sampleAnalysis.range.end} - Provider: {" "}
            {sampleAnalysis.provider}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
