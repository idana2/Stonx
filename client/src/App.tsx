import { useEffect, useMemo, useState } from "react";

type Group = { id: string; name: string; type: string; symbols: string[] };

type AnalyzeResultRow = {
  symbol: string;
  metrics: {
    price?: number | null;
    return1M?: number | null;
    volAnn?: number | null;
    rsi14?: number | null;
  };
  signals: string[];
};

type AnalyzeResponse = {
  data: {
    runId: string;
    symbols: string[];
    results: AnalyzeResultRow[];
  };
};

type Range = { start: string; end: string };

function App() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsStatus, setGroupsStatus] = useState<"idle" | "loading" | "error" | "loaded">(
    "idle",
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>();
  const [range] = useState<Range>(() => {
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    const startDate = new Date();
    startDate.setFullYear(today.getFullYear() - 1);
    const start = startDate.toISOString().slice(0, 10);
    return { start, end };
  });

  const [analyzeStatus, setAnalyzeStatus] = useState<"idle" | "loading" | "error" | "done">(
    "idle",
  );
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResultRow[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupSymbols, setNewGroupSymbols] = useState("");
  const [createStatus, setCreateStatus] = useState<"idle" | "loading" | "error" | "success">(
    "idle",
  );
  const [createError, setCreateError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [priceSymbol, setPriceSymbol] = useState<string | "ALL" | null>(null);
  const [priceSeries, setPriceSeries] = useState<
    { symbol: string; points: { date: string; close: number }[] }[]
  >([]);
  const [priceStatus, setPriceStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    const loadGroups = async () => {
      setGroupsStatus("loading");
      try {
        const res = await fetch("http://localhost:3001/api/groups");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        setGroups(payload.data ?? []);
        setGroupsStatus("loaded");
        if (payload.data?.length && !selectedGroupId) {
          setSelectedGroupId(payload.data[0].id);
        }
      } catch (err) {
        console.error("Failed to load groups", err);
        setGroups([]);
        setGroupsStatus("error");
      }
    };
    loadGroups();
  }, [selectedGroupId]);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId),
    [groups, selectedGroupId],
  );

  const handleAnalyze = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedGroupId) return;
    setAnalyzeStatus("loading");
    setAnalyzeError(null);
    setResult([]);
    setRunId(null);
    try {
      const res = await fetch("http://localhost:3001/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: selectedGroupId, range }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message =
          payload?.error?.message || payload?.error || `Analyze failed (HTTP ${res.status})`;
        throw new Error(message);
      }
      const payload: AnalyzeResponse = await res.json();
      setResult(payload.data.results || []);
      setRunId(payload.data.runId);
      setAnalyzeStatus("done");
    } catch (err) {
      setAnalyzeStatus("error");
      setAnalyzeError(err instanceof Error ? err.message : "Analyze failed");
    }
  };

  const maxAbsReturn = useMemo(() => {
    if (!result.length) return 0;
    return Math.max(...result.map((r) => Math.abs(r.metrics.return1M ?? 0)));
  }, [result]);

  const formatPrice = (value: number | null | undefined) =>
    value === null || value === undefined ? "-" : value.toFixed(2);

  const parseSymbols = (input: string) =>
    input
      .split(/[,\\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

  const handleCreateGroup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newGroupName.trim()) return;
    const symbols = parseSymbols(newGroupSymbols);
    setCreateStatus("loading");
    setCreateError(null);
    try {
      const res = await fetch("http://localhost:3001/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName.trim(), symbols }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message =
          payload?.error?.message || payload?.error || `Create failed (HTTP ${res.status})`;
        throw new Error(message);
      }
      const payload = await res.json();
      const created: Group = payload.data;
      setGroups((prev) => [...prev.filter((g) => g.id !== created.id), created]);
      setSelectedGroupId(created.id);
      setNewGroupName("");
      setNewGroupSymbols("");
      setCreateStatus("success");
    } catch (err) {
      setCreateStatus("error");
      setCreateError(err instanceof Error ? err.message : "Create group failed");
    }
  };

  const loadPrices = async (symbol: string | "ALL") => {
    setPriceStatus("loading");
    setPriceSeries([]);
    try {
      const symbolsToLoad =
        symbol === "ALL" ? result.map((row) => row.symbol) : symbol ? [symbol] : [];
      const series: { symbol: string; points: { date: string; close: number }[] }[] = [];
      for (const sym of symbolsToLoad) {
        const res = await fetch(
          `http://localhost:3001/api/prices?symbol=${encodeURIComponent(sym)}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        const bars = (payload.data?.bars ?? []) as { date: string; close: number }[];
        series.push({ symbol: sym, points: bars.slice(-22) });
      }
      setPriceSeries(series);
      setPriceStatus("idle");
    } catch (err) {
      console.error("Failed to load prices", err);
      setPriceStatus("error");
    }
  };

  useEffect(() => {
    if (result.length > 0) {
      const first = result[0].symbol;
      setPriceSymbol((prev) => prev ?? "ALL");
    } else {
      setPriceSymbol(null);
      setPriceSeries([]);
      setPriceStatus("idle");
    }
  }, [result]);

  useEffect(() => {
    if (priceSymbol) {
      loadPrices(priceSymbol);
    }
  }, [priceSymbol]);

  const handleDeleteGroup = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`http://localhost:3001/api/groups/${id}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        throw new Error(`Delete failed (HTTP ${res.status})`);
      }
      setGroups((prev) => prev.filter((g) => g.id !== id));
      if (selectedGroupId === id) {
        setSelectedGroupId(groups.find((g) => g.id !== id)?.id);
      }
    } catch (err) {
      console.error("Failed to delete group", err);
    } finally {
      setDeletingId(null);
    }
  };

  const barWidth = (value: number | null | undefined) => {
    if (!value || maxAbsReturn === 0) return "0%";
    const percent = Math.min(Math.abs(value) / maxAbsReturn, 1);
    return `${(percent * 100).toFixed(1)}%`;
  };

  const renderSignals = (signals: string[]) => {
    if (!signals || signals.length === 0) return "-";
    return signals.join(", ");
  };

  return (
    <div className="app-shell">
      <header>
        <h1 className="title">Stonx: Analyze Groups Fast</h1>
        <p className="subtitle">
          Fetch & analyze locally. Select a group, run analyze, and view quick charts.
        </p>
      </header>

      <main>
        <section className="card">
          <h2>Groups</h2>
          {groupsStatus === "loading" && <div className="status">Loading groups…</div>}
          {groupsStatus === "error" && (
            <div className="status error">Failed to load groups. Start the server.</div>
          )}
          <form className="group-form" onSubmit={handleCreateGroup}>
            <div className="form-grid">
              <label htmlFor="group-name">New group name</label>
              <input
                id="group-name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="My Watchlist"
              />
              <label htmlFor="group-symbols">Symbols (comma or space separated)</label>
              <input
                id="group-symbols"
                value={newGroupSymbols}
                onChange={(e) => setNewGroupSymbols(e.target.value)}
                placeholder="AAPL, MSFT, NVDA"
              />
            </div>
            <button type="submit" disabled={createStatus === "loading" || !newGroupName.trim()}>
              {createStatus === "loading" ? "Creating…" : "Create manual group"}
            </button>
            {createStatus === "success" && (
              <div className="status success">Group created and selected.</div>
            )}
            {createStatus === "error" && <div className="status error">{createError}</div>}
          </form>
          {groupsStatus === "loaded" && (
            <ul>
              {groups.map((g) => (
                <li key={g.id} className="group-row">
                  <div>
                    <span className="pill">{g.type}</span>
                    <strong>{g.name}</strong> - {g.symbols.join(", ")}
                  </div>
                  <button
                    type="button"
                    className="delete-btn"
                    onClick={() => handleDeleteGroup(g.id)}
                    disabled={deletingId === g.id}
                    aria-label={`Delete group ${g.name}`}
                  >
                    {deletingId === g.id ? "…" : "×"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {groupsStatus === "loaded" && groups.length === 0 && (
            <div className="status">No groups found.</div>
          )}
        </section>

        <section className="card">
          <h2>Analyze</h2>
          <p>Preset range: last 1 year. Runs fake metrics via the API.</p>
          <form onSubmit={handleAnalyze}>
            <label htmlFor="group">Group</label>
            <select
              id="group"
              value={selectedGroupId ?? ""}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              disabled={groupsStatus !== "loaded" || groups.length === 0}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <div className="status">
              Range: {range.start} → {range.end}
            </div>
            <button type="submit" disabled={analyzeStatus === "loading" || !selectedGroupId}>
              {analyzeStatus === "loading" ? "Analyzing…" : "Run analysis"}
            </button>
            {analyzeError && <div className="status error">{analyzeError}</div>}
            {analyzeStatus === "done" && (
              <div className="status success">
                Run {runId} complete for {selectedGroup?.name ?? "selection"}.
              </div>
            )}
          </form>
        </section>

        <section className="card">
          <h2>Results</h2>
          {!result.length && analyzeStatus !== "loading" && (
            <div className="status">Run an analysis to see results.</div>
          )}
          {analyzeStatus === "loading" && <div className="status">Running…</div>}
          {result.length > 0 && (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Price</th>
                    <th>1M Return</th>
                    <th>Vol (ann)</th>
                    <th>RSI14</th>
                    <th>Signals</th>
                  </tr>
                </thead>
                <tbody>
                  {result.map((row) => (
                    <tr key={row.symbol}>
                      <td>{row.symbol}</td>
                      <td>{formatPrice(row.metrics.price)}</td>
                      <td>{row.metrics.return1M ?? "-"}</td>
                      <td>{row.metrics.volAnn ?? "-"}</td>
                      <td>{row.metrics.rsi14 ?? "-"}</td>
                      <td>{renderSignals(row.signals)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="charts">
                <div>
                  <h3>Return vs Vol (scatter)</h3>
                  <ScatterChart data={result} />
                </div>

                <div>
                  <h3>Price (last 1M)</h3>
                  <div className="price-selector">
                    <label htmlFor="price-symbol">Symbol</label>
                    <select
                      id="price-symbol"
                      value={priceSymbol ?? ""}
                      onChange={(e) => setPriceSymbol(e.target.value as "ALL" | string)}
                    >
                      <option value="ALL">ALL</option>
                      {result.map((row) => (
                        <option key={row.symbol} value={row.symbol}>
                          {row.symbol}
                        </option>
                      ))}
                    </select>
                  </div>
                  {priceStatus === "loading" && <div className="status">Loading price dataƒ?İ</div>}
                  {priceStatus === "error" && (
                    <div className="status error">Failed to load price data.</div>
                  )}
                  {priceStatus === "idle" && priceSeries.length > 0 && (
                    <PriceChart series={priceSeries} />
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function ScatterChart({ data }: { data: AnalyzeResultRow[] }) {
  if (data.length === 0) return null;
  const padding = 20;
  const width = 420;
  const height = 260;
  const vols = data.map((d) => d.metrics.volAnn ?? 0);
  const rets = data.map((d) => d.metrics.return1M ?? 0);
  const minX = Math.min(...vols);
  const maxX = Math.max(...vols);
  const minY = Math.min(...rets);
  const maxY = Math.max(...rets);
  const scaleX = (v: number) =>
    maxX === minX ? width / 2 : padding + ((v - minX) / (maxX - minX)) * (width - padding * 2);
  const scaleY = (v: number) =>
    maxY === minY
      ? height / 2
      : height - padding - ((v - minY) / (maxY - minY)) * (height - padding * 2);

  return (
  <svg
    width={width}
    height={height}
    className="scatter"
    style={{ overflow: "visible" }}
  >
    <line
      x1={padding}
      y1={height - padding}
      x2={width - padding}
      y2={height - padding}
      stroke="rgba(255,255,255,0.35)"
      strokeWidth="2"
    />
    <line
      x1={padding}
      y1={padding}
      x2={padding}
      y2={height - padding}
      stroke="rgba(255,255,255,0.35)"
      strokeWidth="2"
    />
    {data.map((d) => (
      <g key={d.symbol}>
        <circle
          cx={scaleX(d.metrics.volAnn ?? 0)}
          cy={scaleY(d.metrics.return1M ?? 0)}
          r={6}
          fill="rgba(56,189,248,0.9)"
        />
        <text
          x={scaleX(d.metrics.volAnn ?? 0) + 8}
          y={scaleY(d.metrics.return1M ?? 0) - 8}
          fontSize={12}
          fill="rgba(255,255,255,0.85)"
        >
          {d.symbol}
        </text>
      </g>
    ))}
  </svg>
);
}

function PriceChart({
  series,
}: {
  series: { symbol: string; points: { date: string; close: number }[] }[];
}) {
  if (!series.length) return null;
  const width = 420;
  const height = 240;
  const padding = 36;
  const maxPoints = Math.max(...series.map((s) => s.points.length));
  const allCloses = series.flatMap((s) => s.points.map((p) => p.close));
  if (!allCloses.length) return null;
  const minY = Math.min(...allCloses);
  const maxY = Math.max(...allCloses);
  const scaleX = (i: number) =>
    padding + (i / Math.max(maxPoints - 1, 1)) * (width - padding * 2);
  const scaleY = (v: number) =>
    height - padding - ((v - minY) / Math.max(maxY - minY, 1)) * (height - padding * 2);

  const palette = ["#22d3ee", "#f472b6", "#a78bfa", "#34d399", "#facc15", "#fb7185", "#60a5fa"];
  const basePoints =
    series.find((s) => s.points.length === maxPoints)?.points ?? series[0]?.points ?? [];
  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    minY + ((maxY - minY) * i) / yTicks,
  );
  const xTickIndices =
    basePoints.length > 1
      ? Array.from(new Set([0, Math.floor((basePoints.length - 1) / 2), basePoints.length - 1]))
      : [0];

  return (
    <svg width={width} height={height} className="price-chart">
      <line
        x1={padding}
        y1={height - padding}
        x2={width - padding}
        y2={height - padding}
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={1}
      />
      <line
        x1={padding}
        y1={padding}
        x2={padding}
        y2={height - padding}
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={1}
      />
      <text x={padding} y={padding - 10} fill="#94a3b8" fontSize={12}>
        Price
      </text>
      <text x={width - padding} y={height - padding + 14} fill="#94a3b8" fontSize={12} textAnchor="end">
        Time
      </text>
      {yTickValues.map((v) => (
        <g key={`y-${v}`}>
          <line
            x1={padding - 4}
            y1={scaleY(v)}
            x2={padding}
            y2={scaleY(v)}
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={1}
          />
          <text
            x={padding - 6}
            y={scaleY(v) + 4}
            fill="#94a3b8"
            fontSize={10}
            textAnchor="end"
          >
            {v.toFixed(2)}
          </text>
        </g>
      ))}
      {basePoints.map((p, idx) =>
        xTickIndices.includes(idx) ? (
          <g key={`x-${idx}`}>
            <line
              x1={scaleX(idx)}
              y1={height - padding}
              x2={scaleX(idx)}
              y2={height - padding + 4}
              stroke="rgba(255,255,255,0.4)"
              strokeWidth={1}
            />
            <text
              x={scaleX(idx)}
              y={height - padding + 16}
              fill="#94a3b8"
              fontSize={10}
              textAnchor="middle"
            >
              {p.date}
            </text>
          </g>
        ) : null,
      )}

      {series.map((s, idx) => {
        const color = palette[idx % palette.length];
        const points = s.points.map((p, i) => `${scaleX(i)},${scaleY(p.close)}`).join(" ");
        return (
          <g key={s.symbol}>
            <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
            {s.points.map((p, i) => (
              <circle key={p.date} cx={scaleX(i)} cy={scaleY(p.close)} r={3} fill={color} />
            ))}
            <text
              x={width - padding + 4}
              y={scaleY(s.points[s.points.length - 1]?.close ?? minY)}
              fill={color}
              fontSize={11}
              textAnchor="start"
            >
              {s.symbol}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
export default App;
