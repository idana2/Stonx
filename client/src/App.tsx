import { Activity, BarChart3, BarChart4, Pencil, Play, Plus, Save, Trash2, TrendingDown, TrendingUp, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Group = { id: string; name: string; type: string; symbols: string[] };

type GroupTemplate = {
  id: string;
  name: string;
  category: string;
  description: string;
  symbols: string[];
};

type TemplatesResponse = {
  data: GroupTemplate[];
};

type SymbolInsights = {
  trend: "Bullish" | "Bearish" | "Sideways" | string;
  momentum: "Strong" | "Moderate" | "Weak" | string;
  risk: "Low" | "Medium" | "High" | string;
  anomalies: string[];
  summary: string;
};

type AnalyzeResultRow = {
  symbol: string;
  metrics: {
    price?: number | null;
    return1D?: number | null;
    return5D?: number | null;
    return1M?: number | null;
    return3M?: number | null;
    volAnn?: number | null;
    maxDrawdown?: number | null;
    sma20?: number | null;
    sma50?: number | null;
    rsi14?: number | null;
    volumeZScore?: number | null;
  };
  signals: string[];
  insights?: SymbolInsights | null;
};

type FundamentalsQuarter = {
  periodEnd: string;
  revenue?: number | null;
  netIncome?: number | null;
  eps?: number | null;
  cash?: number | null;
  debt?: number | null;
  netCash?: number | null;
  epsTtm?: number | null;
  peTtm?: number | null;
  priceAsOf?: string | null;
};

type FundamentalsMeta = {
  provider: string;
  providerEnabled: boolean;
  latestFetchedAt?: string | null;
  syncStatus?: string | null;
};

type FundamentalsResponse = {
  data: {
    symbol: string;
    quarters: FundamentalsQuarter[];
    meta: FundamentalsMeta;
  };
};

type FundamentalsState = {
  status: "idle" | "loading" | "error" | "disabled" | "ready";
  error?: string | null;
  quarters?: FundamentalsQuarter[];
  meta?: FundamentalsMeta;
};

type ValuationRow = {
  trailingPe?: number | null;
  forwardPe?: number | null;
};

type ValuationsResponse = {
  data: {
    items: Record<string, ValuationRow>;
  };
};

type GroupInsights = {
  score: number;
  avgReturn1M: number;
  avgVolAnn: number;
  dispersionReturn1M: number;
  momentumBreadth: number;
  topPerformer: string;
  bottomPerformer: string;
  summary: string;
};

type AnalyzeResponse = {
  data: {
    runId: string;
    symbols: string[];
    groupInsights?: GroupInsights | null;
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set<string>();
    const stored = window.localStorage.getItem("stonx-expanded-groups");
    if (!stored) return new Set<string>();
    try {
      return new Set<string>(JSON.parse(stored));
    } catch {
      return new Set<string>();
    }
  });
  const [groupSearch, setGroupSearch] = useState("");
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
  const [groupInsights, setGroupInsights] = useState<GroupInsights | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [fundamentalsOpen, setFundamentalsOpen] = useState<string | null>(null);
  const [fundamentalsCache, setFundamentalsCache] = useState<Record<string, FundamentalsState>>(
    {},
  );
  const [valuationsCache, setValuationsCache] = useState<Record<string, ValuationRow>>({});
  const [valuationsStatus, setValuationsStatus] = useState<"idle" | "loading" | "error">("idle");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templatesStatus, setTemplatesStatus] = useState<"idle" | "loading" | "error">("idle");
  const [templates, setTemplates] = useState<GroupTemplate[]>([]);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateCategory, setTemplateCategory] = useState("All");
  const [templateAddStatus, setTemplateAddStatus] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [templateAddError, setTemplateAddError] = useState<string | null>(null);
  const [createStatus, setCreateStatus] = useState<"idle" | "loading" | "error" | "success">(
    "idle",
  );
  const [createError, setCreateError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [priceSymbol, setPriceSymbol] = useState<string | "ALL" | null>(null);
  const [priceRange, setPriceRange] = useState<"1d" | "1w" | "1m" | "3m" | "6m" | "1y">("1m");
  const [priceSeries, setPriceSeries] = useState<
    {
      symbol: string;
      points: { date: string; close: number; open?: number | null; volume?: number | null }[];
    }[]
  >([]);
  const [volumeSpikeCache, setVolumeSpikeCache] = useState<
    Record<
      string,
      {
        label: "Volume spike" | "Volume spike (extreme)";
        tooltip: string;
        range: "1d" | "1w" | "1m" | "3m" | "6m" | "1y";
      }
    >
  >({});
  const [priceStatus, setPriceStatus] = useState<"idle" | "loading" | "error">("idle");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [draftGroupName, setDraftGroupName] = useState("");
  const [draftSymbols, setDraftSymbols] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [stagedSymbols, setStagedSymbols] = useState<string[]>([]);
  const [addDraft, setAddDraft] = useState("");
  const [inlineAddGroupId, setInlineAddGroupId] = useState<string | null>(null);
  const [inlineAddDraft, setInlineAddDraft] = useState("");
  const [isSavingSymbols, setIsSavingSymbols] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const inlineAddGroup = inlineAddGroupId
    ? groups.find((group) => group.id === inlineAddGroupId) ?? null
    : null;

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

  const loadTemplates = async () => {
    if (templatesStatus === "loading") return;
    setTemplatesStatus("loading");
    try {
      const res = await fetch("http://localhost:3001/api/templates");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload: TemplatesResponse = await res.json();
      setTemplates(payload.data ?? []);
      setTemplatesStatus("idle");
    } catch (err) {
      console.error("Failed to load templates", err);
      setTemplates([]);
      setTemplatesStatus("error");
    }
  };

  const persistExpanded = (next: Set<string>) => {
    try {
      window.localStorage.setItem("stonx-expanded-groups", JSON.stringify(Array.from(next)));
    } catch {
      // ignore storage errors
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persistExpanded(next);
      return next;
    });
  };

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId),
    [groups, selectedGroupId],
  );

  const filteredGroups = useMemo(() => {
    if (!groupSearch.trim()) return groups.map((g) => ({ ...g, filteredSymbols: g.symbols }));
    const term = groupSearch.trim().toLowerCase();
    return groups
      .map((g) => {
        const nameMatch = g.name.toLowerCase().includes(term);
        const symbolMatches = g.symbols.filter((s) => s.toLowerCase().includes(term));
        if (nameMatch) {
          return { ...g, filteredSymbols: g.symbols };
        }
        if (symbolMatches.length > 0) {
          return { ...g, filteredSymbols: symbolMatches };
        }
        return null;
      })
      .filter((g): g is Group & { filteredSymbols: string[] } => Boolean(g));
  }, [groups, groupSearch]);

  const templateCategories = useMemo(() => {
    const set = new Set(templates.map((t) => t.category));
    return ["All", ...Array.from(set).sort()];
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const term = templateSearch.trim().toLowerCase();
    return templates.filter((t) => {
      const matchesCategory = templateCategory === "All" || t.category === templateCategory;
      if (!matchesCategory) return false;
      if (!term) return true;
      return (
        t.name.toLowerCase().includes(term) ||
        t.category.toLowerCase().includes(term) ||
        t.description.toLowerCase().includes(term) ||
        t.symbols.some((sym) => sym.toLowerCase().includes(term))
      );
    });
  }, [templates, templateSearch, templateCategory]);

  const handleAnalyze = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedGroupId) return;
    setAnalyzeStatus("loading");
    setAnalyzeError(null);
    setResult([]);
    setRunId(null);
    setGroupInsights(null);
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
      setGroupInsights(payload.data.groupInsights ?? null);
      setRunId(payload.data.runId);
      setAnalyzeStatus("done");
    } catch (err) {
      setAnalyzeStatus("error");
      setAnalyzeError(err instanceof Error ? err.message : "Analyze failed");
    }
  };

  const loadFundamentals = async (symbol: string) => {
    setFundamentalsCache((prev) => ({
      ...prev,
      [symbol]: { ...prev[symbol], status: "loading", error: null },
    }));
    try {
      const res = await fetch(
        `http://localhost:3001/api/fundamentals/${encodeURIComponent(symbol)}?limit=4`,
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message =
          payload?.error?.message || payload?.error || `HTTP ${res.status}`;
        throw new Error(message);
      }
      const payload: FundamentalsResponse = await res.json();
      const meta = payload.data?.meta;
      if (!meta?.providerEnabled) {
        setFundamentalsCache((prev) => ({
          ...prev,
          [symbol]: {
            status: "disabled",
            quarters: payload.data?.quarters ?? [],
            meta,
          },
        }));
        return;
      }
      setFundamentalsCache((prev) => ({
        ...prev,
        [symbol]: {
          status: "ready",
          quarters: payload.data?.quarters ?? [],
          meta,
        },
      }));
    } catch (err) {
      setFundamentalsCache((prev) => ({
        ...prev,
        [symbol]: {
          status: "error",
          error: err instanceof Error ? err.message : "Failed to load fundamentals",
        },
      }));
    }
  };

  const openFundamentals = (symbol: string) => {
    setFundamentalsOpen(symbol);
    const cached = fundamentalsCache[symbol];
    if (!cached || cached.status === "idle" || cached.status === "error") {
      loadFundamentals(symbol);
    }
  };

  const closeFundamentals = () => {
    setFundamentalsOpen(null);
  };

  const loadValuations = async (symbols: string[]) => {
    if (symbols.length === 0) return;
    const missing = symbols.filter((symbol) => !valuationsCache[symbol]);
    if (missing.length === 0) return;
    setValuationsStatus("loading");
    try {
      const res = await fetch(
        `http://localhost:3001/api/valuations?symbols=${encodeURIComponent(missing.join(","))}`,
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message =
          payload?.error?.message || payload?.error || `HTTP ${res.status}`;
        throw new Error(message);
      }
      const payload: ValuationsResponse = await res.json();
      const items = payload.data?.items ?? {};
      setValuationsCache((prev) => ({ ...prev, ...items }));
      setValuationsStatus("idle");
    } catch (err) {
      console.error("Failed to load valuations", err);
      setValuationsStatus("error");
    }
  };

  const maxAbsReturn = useMemo(() => {
    if (!result.length) return 0;
    return Math.max(...result.map((r) => Math.abs(r.metrics.return1M ?? 0)));
  }, [result]);

  const formatPrice = (value: number | null | undefined) =>
    value === null || value === undefined ? "-" : value.toFixed(2);

  const formatCompact = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "�";
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toFixed(0);
  };

  const formatEps = (value: number | null | undefined) =>
    value === null || value === undefined ? "�" : value.toFixed(2);

  const formatPe = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "string") {
      const cleaned = value.replace(/\uFFFD/g, "").trim();
      if (!cleaned) return "-";
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed.toFixed(1) : "-";
    }
    return Number.isFinite(value) ? value.toFixed(1) : "-";
  };



  const formatPercent = (value: number | null | undefined) =>
    value === null || value === undefined ? "-" : value.toFixed(1);

  const formatMetricValue = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "string") return value.replace(/\uFFFD/g, "-");
    if (!Number.isFinite(value)) return "-";
    return value;
  };

  const safeText = (value: string | null | undefined) =>
    value === null || value === undefined || value === "" ? "-" : value.replace(/\uFFFD/g, "-");

  const rsiClass = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "";
    if (value >= 70) return "rsi-bad";
    if (value <= 30) return "rsi-good";
    return "rsi-mid";
  };

  const formatQuarter = (periodEnd: string) => {
    const date = new Date(periodEnd);
    if (Number.isNaN(date.getTime())) return periodEnd;
    const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
    return `${date.getUTCFullYear()} Q${quarter}`;
  };

  const buildTrendReason = (row: AnalyzeResultRow) => {
    const { price, sma20, sma50, return3M } = row.metrics ?? {};
    if (price === null || price === undefined) return "Insufficient data to score trend.";
    if (sma20 !== null && sma20 !== undefined && sma50 !== null && sma50 !== undefined) {
      if (price > sma20 && sma20 > sma50) {
        return `Price ${price.toFixed(2)} above SMA20 ${sma20.toFixed(2)} and SMA50 ${sma50.toFixed(2)}.`;
      }
      if (price < sma20 && sma20 < sma50) {
        return `Price ${price.toFixed(2)} below SMA20 ${sma20.toFixed(2)} and SMA50 ${sma50.toFixed(2)}.`;
      }
    }
    if (sma50 !== null && sma50 !== undefined && return3M !== null && return3M !== undefined) {
      if (price > sma50 && return3M > 0) {
        return `Price above SMA50 (${sma50.toFixed(2)}) and 3M return ${formatPercent(return3M)}%.`;
      }
      if (price < sma50 && return3M < 0) {
        return `Price below SMA50 (${sma50.toFixed(2)}) and 3M return ${formatPercent(return3M)}%.`;
      }
    }
    return "Mixed price/average signals for trend.";
  };

  const buildMomentumReason = (row: AnalyzeResultRow) => {
    const { return1M, return3M, rsi14 } = row.metrics ?? {};
    if (
      return1M === null ||
      return1M === undefined ||
      return3M === null ||
      return3M === undefined ||
      rsi14 === null ||
      rsi14 === undefined
    ) {
      return "Insufficient data (1M, 3M return, or RSI14 missing).";
    }
    if (return1M > 0 && return3M > 0 && rsi14 >= 55) {
      return `1M ${formatPercent(return1M)}% and 3M ${formatPercent(return3M)}% are positive with RSI14 ${rsi14.toFixed(0)}.`;
    }
    if (return1M < 0 && return3M < 0 && rsi14 <= 45) {
      return `1M ${formatPercent(return1M)}% and 3M ${formatPercent(return3M)}% are negative with RSI14 ${rsi14.toFixed(0)}.`;
    }
    return `Mixed momentum (1M ${formatPercent(return1M)}%, 3M ${formatPercent(return3M)}%, RSI14 ${rsi14.toFixed(0)}).`;
  };

  const buildRiskReason = (row: AnalyzeResultRow) => {
    const { volAnn, maxDrawdown } = row.metrics ?? {};
    if (
      volAnn === null ||
      volAnn === undefined ||
      maxDrawdown === null ||
      maxDrawdown === undefined
    ) {
      return "Insufficient data (volatility or drawdown missing).";
    }
    if (volAnn >= 45 || maxDrawdown <= -35) {
      const reasons = [];
      if (volAnn >= 45) reasons.push(`volatility ${formatPercent(volAnn)}% >= 45%`);
      if (maxDrawdown <= -35) reasons.push(`drawdown ${formatPercent(maxDrawdown)}% <= -35%`);
      return `High risk: ${reasons.join(" and ")}.`;
    }
    if (volAnn <= 25 && maxDrawdown >= -20) {
      return `Low risk: volatility ${formatPercent(volAnn)}% and drawdown ${formatPercent(maxDrawdown)}%.`;
    }
    return `Moderate risk: volatility ${formatPercent(volAnn)}%, drawdown ${formatPercent(maxDrawdown)}%.`;
  };

  const parseSymbols = (input: string) =>
    input
      .split(/[,\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

  const handleCreateGroup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draftGroupName.trim()) return;
    const symbols = parseSymbols(draftSymbols);
    setCreateStatus("loading");
    setCreateError(null);
    try {
      const res = await fetch("http://localhost:3001/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draftGroupName.trim(), symbols }),
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
      setDraftGroupName("");
      setDraftSymbols("");
      setIsCreatingGroup(false);
      setCreateStatus("success");
    } catch (err) {
      setCreateStatus("error");
      setCreateError(err instanceof Error ? err.message : "Create group failed");
    }
  };

  const addTemplateGroup = async (template: GroupTemplate) => {
    setTemplateAddStatus("loading");
    setTemplateAddError(null);
    try {
      const res = await fetch("http://localhost:3001/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: template.name, type: "cluster", symbols: template.symbols }),
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
      setTemplateAddStatus("idle");
      setTemplatesOpen(false);
    } catch (err) {
      setTemplateAddStatus("error");
      setTemplateAddError(err instanceof Error ? err.message : "Add group failed");
    }
  };

  const loadPrices = async (symbol: string | "ALL") => {
    setPriceStatus("loading");
    setPriceSeries([]);
    try {
      const symbolsToLoad =
        symbol === "ALL" ? result.map((row) => row.symbol) : symbol ? [symbol] : [];
      const series: {
        symbol: string;
        points: { date: string; close: number; open?: number | null; volume?: number | null }[];
      }[] = [];
      const spikeThreshold = 1.8;
      const extremeThreshold = 2.2;
      const baselineWindow = 60;
      const detectionWindow = 20;
      const formatVolume = (value: number) => {
        const abs = Math.abs(value);
        if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
        if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
        if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
        return `${Math.round(value)}`;
      };
      const nextSpikeEntries: Record<
        string,
        {
          label: "Volume spike" | "Volume spike (extreme)";
          tooltip: string;
          range: "1d" | "1w" | "1m" | "3m" | "6m" | "1y";
        }
      > = {};
      for (const sym of symbolsToLoad) {
        const res = await fetch(
          `http://localhost:3001/api/prices?symbol=${encodeURIComponent(sym)}&range=${priceRange}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        const bars = (payload.data?.bars ?? []) as {
          date: string;
          close: number;
          open?: number | null;
          volume?: number | null;
        }[];
        series.push({
          symbol: sym,
          points: bars.map((bar) => ({
            date: bar.date,
            close: bar.close,
            open: bar.open ?? null,
            volume: bar.volume ?? null,
          })),
        });
        const points = series[series.length - 1]?.points ?? [];
        if (points.length > 1) {
          let windowSum = 0;
          let windowCount = 0;
          const recentStart = Math.max(0, points.length - detectionWindow);
          let recentCount = 0;
          let recentRatioSum = 0;
          let recentMaxRatio = 0;
          let recentMaxVolume = 0;
          let recentMaxDate = "";
          let recentSpikeDays = 0;
          let recentExtremeDays = 0;
          for (let i = 0; i < points.length; i += 1) {
            const baselineAvg = windowCount >= 5 ? windowSum / windowCount : 0;
            const volume = points[i].volume ?? null;
            const ratio = baselineAvg && volume !== null ? volume / baselineAvg : 0;
            if (i >= recentStart && ratio) {
              recentCount += 1;
              recentRatioSum += ratio;
              if (ratio > recentMaxRatio) {
                recentMaxRatio = ratio;
                recentMaxVolume = volume ?? 0;
                recentMaxDate = points[i].date;
              }
              if (ratio >= spikeThreshold) recentSpikeDays += 1;
              if (ratio >= extremeThreshold) recentExtremeDays += 1;
            }
            if (volume !== null) {
              windowSum += volume;
              windowCount += 1;
            }
            const leavingIndex = i - baselineWindow;
            if (leavingIndex >= 0) {
              const leaving = points[leavingIndex].volume ?? null;
              if (leaving !== null) {
                windowSum -= leaving;
                windowCount -= 1;
              }
            }
          }
          if (recentCount >= 3) {
            if (recentMaxRatio >= extremeThreshold) {
              const tooltip = [
                `Baseline: rolling avg over W=${baselineWindow} trading days`,
                `Detection: last N=${detectionWindow} trading days`,
                `Peak day: ${formatVolume(recentMaxVolume)} on ${recentMaxDate}`,
                `Peak ratio: ${recentMaxRatio.toFixed(2)}x`,
                `Avg ratio (last N): ${(recentRatioSum / recentCount).toFixed(2)}x`,
                `Days >= ${spikeThreshold}x: ${recentSpikeDays}`,
                `Days >= ${extremeThreshold}x: ${recentExtremeDays}`,
              ].join("");
              nextSpikeEntries[sym] = {
                label: "Volume spike (extreme)",
                tooltip,
                range: priceRange,
              };
            } else if (recentMaxRatio >= spikeThreshold) {
              const tooltip = [
                `Baseline: rolling avg over W=${baselineWindow} trading days`,
                `Detection: last N=${detectionWindow} trading days`,
                `Peak day: ${formatVolume(recentMaxVolume)} on ${recentMaxDate}`,
                `Peak ratio: ${recentMaxRatio.toFixed(2)}x`,
                `Avg ratio (last N): ${(recentRatioSum / recentCount).toFixed(2)}x`,
                `Days >= ${spikeThreshold}x: ${recentSpikeDays}`,
              ].join("");
              nextSpikeEntries[sym] = {
                label: "Volume spike",
                tooltip,
                range: priceRange,
              };
            }
          }
        }
      }
      setVolumeSpikeCache((prev) => {
        const next = { ...prev };
        for (const sym of symbolsToLoad) {
          if (nextSpikeEntries[sym]) {
            next[sym] = nextSpikeEntries[sym];
          } else {
            delete next[sym];
          }
        }
        return next;
      });
      setPriceSeries(series);
      setPriceStatus("idle");
    } catch (err) {
      console.error("Failed to load prices", err);
      setPriceStatus("error");
    }
  };

  useEffect(() => {
    if (result.length > 0) {
      setPriceSymbol((prev) => prev ?? "ALL");
    } else {
      setPriceSymbol(null);
      setPriceSeries([]);
      setPriceStatus("idle");
    }
  }, [result]);

  useEffect(() => {
    if (result.length === 0 || valuationsStatus === "loading") return;
    const symbols = result.map((row) => row.symbol);
    const missing = symbols.some((symbol) => !valuationsCache[symbol]);
    if (missing) {
      loadValuations(symbols);
    }
  }, [result, valuationsCache, valuationsStatus]);

  useEffect(() => {
    if (templatesOpen && templatesStatus === "idle" && templates.length === 0) {
      loadTemplates();
    }
  }, [templatesOpen, templatesStatus, templates.length]);

  useEffect(() => {
    if (priceSymbol) {
      loadPrices(priceSymbol);
    }
  }, [priceSymbol, priceRange]);

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

  const openEditSymbols = (group: Group) => {
    setEditingGroupId(group.id);
    setStagedSymbols([...group.symbols]);
    setAddDraft("");
    setEditError(null);
  };

  const cancelEditSymbols = () => {
    setEditingGroupId(null);
    setStagedSymbols([]);
    setAddDraft("");
    setEditError(null);
    setIsSavingSymbols(false);
  };

  const applyAddSymbols = () => {
    if (!addDraft.trim()) return;
    const additions = parseSymbols(addDraft);
    if (additions.length === 0) return;
    const next = Array.from(new Set([...stagedSymbols, ...additions]));
    setStagedSymbols(next);
    setAddDraft("");
  };

  const removeSymbol = (sym: string) => {
    setStagedSymbols((prev) => prev.filter((s) => s !== sym));
  };

  const saveSymbols = async (group: Group, symbolsOverride?: string[]) => {
    const sourceSymbols = symbolsOverride ?? stagedSymbols;
    const deduped = Array.from(
      new Set(
        sourceSymbols
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean),
      ),
    );
    setIsSavingSymbols(true);
    setEditError(null);
    try {
      const res = await fetch(`http://localhost:3001/api/groups/${group.id}/members`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: deduped }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message =
          payload?.error?.message || payload?.error || `Save failed (HTTP ${res.status})`;
        throw new Error(message);
      }
      const payload = await res.json();
      const updated: Group = payload.data;
      setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      setEditingGroupId(null);
      setStagedSymbols([]);
      setAddDraft("");
      setEditError(null);
      setIsSavingSymbols(false);
      return true;
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Save failed");
      setIsSavingSymbols(false);
      return false;
    }
  };

  const startRename = (group: Group) => {
    setRenamingGroupId(group.id);
    setRenameDraft(group.name);
    setRenameError(null);
    setEditingGroupId(null);
    setEditError(null);
  };

  const cancelRename = () => {
    setRenamingGroupId(null);
    setRenameDraft("");
    setRenameError(null);
  };

  const handleRenameSave = async (group: Group) => {
    const nextName = renameDraft.trim();
    if (!nextName || nextName === group.name) {
      cancelRename();
      return;
    }
    setRenameError(null);
    try {
      // Re-use existing APIs: create new group, then delete old.
      const res = await fetch("http://localhost:3001/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName, symbols: group.symbols }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message =
          payload?.error?.message || payload?.error || `Rename failed (HTTP ${res.status})`;
        throw new Error(message);
      }
      const payload = await res.json();
      const created: Group = payload.data;
      await handleDeleteGroup(group.id);
      setGroups((prev) => [...prev.filter((g) => g.id !== created.id && g.id !== group.id), created]);
      setSelectedGroupId(created.id);
      cancelRename();
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : "Rename failed");
    }
  };

  const barWidth = (value: number | null | undefined) => {
    if (!value || maxAbsReturn === 0) return "0%";
    const percent = Math.min(Math.abs(value) / maxAbsReturn, 1);
    return `${(percent * 100).toFixed(1)}%`;
  };

  const scoreTone = (score: number | null | undefined) => {
    if (score === null || score === undefined) return "score-pill score-pill-muted";
    if (score >= 70) return "score-pill score-pill-good";
    if (score >= 40) return "score-pill score-pill-warn";
    return "score-pill score-pill-bad";
  };

  const trendClass = (trend?: string) => {
    if (!trend) return "pill soft";
    if (trend.toLowerCase() === "bullish") return "pill pill-trend bull";
    if (trend.toLowerCase() === "bearish") return "pill pill-trend bear";
    return "pill pill-trend flat";
  };

  const riskClass = (risk?: string) => {
    if (!risk) return "pill soft";
    if (risk.toLowerCase() === "high") return "pill pill-risk high";
    if (risk.toLowerCase() === "low") return "pill pill-risk low";
    return "pill pill-risk mid";
  };

  const momentumClass = (momentum?: string) => {
    if (!momentum) return "pill soft";
    if (momentum.toLowerCase() === "strong") return "pill pill-momo strong";
    if (momentum.toLowerCase() === "weak") return "pill pill-momo weak";
    return "pill pill-momo mid";
  };

  const findRow = (symbol: string | undefined | null) =>
    symbol ? result.find((r) => r.symbol === symbol) : undefined;

  const fallbackTop = [...result].sort(
    (a, b) => (b.metrics.return1M ?? -Infinity) - (a.metrics.return1M ?? -Infinity),
  )[0];
  const fallbackBottom = [...result].sort(
    (a, b) => (a.metrics.return1M ?? Infinity) - (b.metrics.return1M ?? Infinity),
  )[0];

  const topRow = findRow(groupInsights?.topPerformer) ?? fallbackTop;
  const bottomRow = findRow(groupInsights?.bottomPerformer) ?? fallbackBottom;

  const highestRiskRow = [...result].sort((a, b) => {
    const riskScore = (row: AnalyzeResultRow) => {
      const vol = row.metrics.volAnn ?? 0;
      const drawdown = row.metrics.maxDrawdown ?? 0;
      return Math.max(vol, Math.abs(drawdown));
    };
    return riskScore(b) - riskScore(a);
  })[0];
  const highestRiskReason = highestRiskRow
    ? highestRiskRow.metrics.volAnn !== null &&
      highestRiskRow.metrics.volAnn !== undefined &&
      highestRiskRow.metrics.volAnn > 40
      ? "High annualized volatility"
      : highestRiskRow.metrics.maxDrawdown !== null &&
          highestRiskRow.metrics.maxDrawdown !== undefined &&
          Math.abs(highestRiskRow.metrics.maxDrawdown) > 20
        ? "Large max drawdown"
        : "Elevated volatility and drawdown"
    : "";

  type SignalTone = "positive" | "neutral" | "negative";

type SignalItem = {
  key: string;
  shortLabel: string;
  label: string;
  tone: SignalTone;
  timeframe: string;
  takeaway: string;
  metrics?: string;
  detail?: string;
  icon: typeof TrendingUp;
};

const buildSignalItems = (
  row: AnalyzeResultRow,
  spike: { label: string; tooltip: string } | null,
): SignalItem[] => {
  const items: SignalItem[] = [];
  const { return1M, return3M, rsi14, volAnn, maxDrawdown } = row.metrics ?? {};
  const signals = row.signals ?? [];

  for (const signal of signals) {
    switch (signal) {
      case "MOMENTUM_NEG_LAST_MONTH":
        items.push({
          key: signal,
          shortLabel: "Mom -1M",
          label: "Momentum down",
          tone: "negative",
          timeframe: "last 1M",
          takeaway: "Momentum weakening last month",
          metrics: `1M ${formatPercent(return1M)}%, 3M ${formatPercent(return3M)}%`,
          icon: TrendingDown,
        });
        break;
      case "MOMENTUM_POS":
        items.push({
          key: signal,
          shortLabel: "Mom +1M",
          label: "Momentum up",
          tone: "positive",
          timeframe: "last 1M",
          takeaway: "Momentum improving last month",
          metrics: `1M ${formatPercent(return1M)}%, 3M ${formatPercent(return3M)}%`,
          icon: TrendingUp,
        });
        break;
      case "RSI_OVERBOUGHT":
        items.push({
          key: signal,
          shortLabel: "RSI high",
          label: "RSI overbought",
          tone: "negative",
          timeframe: "current",
          takeaway: "RSI overbought (pullback risk)",
          metrics: `RSI ${formatMetricValue(rsi14)}`,
          icon: Activity,
        });
        break;
      case "RSI_OVERSOLD":
        items.push({
          key: signal,
          shortLabel: "RSI low",
          label: "RSI oversold",
          tone: "positive",
          timeframe: "current",
          takeaway: "RSI oversold (rebound watch)",
          metrics: `RSI ${formatMetricValue(rsi14)}`,
          icon: Activity,
        });
        break;
      case "DRAWDOWN_ELEVATED":
        items.push({
          key: signal,
          shortLabel: "Drawdown",
          label: "Drawdown elevated",
          tone: "negative",
          timeframe: "recent",
          takeaway: "Elevated drawdown risk",
          metrics: `DD ${formatPercent(maxDrawdown)}%, Vol ${formatPercent(volAnn)}%`,
          icon: Activity,
        });
        break;
      default:
        items.push({
          key: signal,
          shortLabel: signal,
          label: signal.replace(/_/g, " "),
          tone: "neutral",
          timeframe: "recent",
          takeaway: signal.replace(/_/g, " "),
          icon: Activity,
        });
        break;
    }
  }

  if (spike) {
    items.push({
      key: "VOLUME_SPIKE",
      shortLabel: "Vol spike",
      label: spike.label,
      tone: "neutral",
      timeframe: "recent sessions",
      takeaway: "Volume spike in recent sessions",
      detail: spike.tooltip,
      icon: BarChart3,
    });
  }

  const priority = [
    "MOMENTUM_NEG_LAST_MONTH",
    "DRAWDOWN_ELEVATED",
    "RSI_OVERBOUGHT",
    "VOLUME_SPIKE",
    "MOMENTUM_POS",
    "RSI_OVERSOLD",
  ];

  return items.sort((a, b) => {
    const aIndex = priority.indexOf(a.key);
    const bIndex = priority.indexOf(b.key);
    const aRank = aIndex === -1 ? 99 : aIndex;
    const bRank = bIndex === -1 ? 99 : bIndex;
    return aRank - bRank;
  });
};

const renderSignals = (
  row: AnalyzeResultRow,
  spike: { label: string; tooltip: string } | null,
) => {
  const items = buildSignalItems(row, spike);
  if (items.length === 0) return "-";
  const inlineItems = items.slice(0, 2);
  const primary = items[0];

  return (
    <div className="signals-cell">
      <div className="signal-list">
        {inlineItems.map((item) => {
          const Icon = item.icon;
          return (
            <span key={item.key} className={`signal-tag signal-flag signal-${item.tone}`}>
              <Icon size={12} aria-hidden="true" />
              {item.shortLabel}
            </span>
          );
        })}
      </div>
      <div className="signal-panel" role="tooltip" aria-hidden="true">
        <div className="signal-title">{primary.takeaway}</div>
        <ul className="signal-details">
          {items.map((item) => {
            const Icon = item.icon;
            const meta = [item.timeframe, item.metrics].filter(Boolean).join(" | ");
            return (
              <li key={`${item.key}-detail`}>
                <span className={`signal-bullet signal-${item.tone}`}>
                  <Icon size={12} aria-hidden="true" />
                </span>
                <div>
                  <div className="signal-name">{item.label}</div>
                  {meta ? <div className="signal-meta">{meta}</div> : null}
                  {item.detail ? <div className="signal-sub">{item.detail}</div> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

  return (
    <div className="app-shell">
      <header>
        <h1 className="title">Stonx: Analyze Groups Fast</h1>
        <p className="subtitle">
          Fetch & analyze locally. Select a group, run analyze, and view quick charts.
        </p>
      </header>

      <main className="layout">
        <section className="card sidebar-card">
          <div className="sidebar-header">
            <h2>Groups</h2>
            <div className="sidebar-actions">
              <button
                type="button"
                className="new-group-btn"
                onClick={() => {
                  setTemplatesOpen(true);
                  setTemplateSearch("");
                  setTemplateCategory("All");
                  setTemplateAddStatus("idle");
                  setTemplateAddError(null);
                }}
              >
                Library
              </button>
              <button
                type="button"
                className="new-group-btn"
                onClick={() => {
                  setIsCreatingGroup((prev) => !prev);
                  setDraftGroupName("");
                  setDraftSymbols("");
                  setCreateError(null);
                  setCreateStatus("idle");
                }}
              >
                + New group
              </button>
            </div>
          </div>
          {groupsStatus === "loading" && <div className="status">Loading groups...</div>}
          {groupsStatus === "error" && (
            <div className="status error">Failed to load groups. Start the server.</div>
          )}
          <div className="sidebar-search">
            <input
              type="search"
              placeholder="Search groups or symbols"
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
            />
          </div>
          {isCreatingGroup && (
            <form
              className="inline-create"
              onSubmit={handleCreateGroup}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setIsCreatingGroup(false);
                  setDraftGroupName("");
                  setDraftSymbols("");
                  setCreateError(null);
                }
              }}
            >
              <label htmlFor="inline-group-name">Group name</label>
              <input
                id="inline-group-name"
                value={draftGroupName}
                onChange={(e) => setDraftGroupName(e.target.value)}
                placeholder="My Watchlist"
                autoFocus
              />
              <label htmlFor="inline-group-symbols">Symbols (comma or space separated)</label>
              <input
                id="inline-group-symbols"
                value={draftSymbols}
                onChange={(e) => setDraftSymbols(e.target.value)}
                placeholder="AAPL, MSFT, NVDA"
              />
              {createError && <div className="status error">{createError}</div>}
              <div className="inline-actions">
                <button type="submit" disabled={createStatus === "loading" || !draftGroupName.trim()}>
                  {createStatus === "loading" ? "Creating..." : "Create"}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    setIsCreatingGroup(false);
                    setDraftGroupName("");
                    setDraftSymbols("");
                    setCreateError(null);
                    setCreateStatus("idle");
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          <div className="tree">
            {groupsStatus === "loaded" && filteredGroups.length === 0 && (
              <div className="status">No groups found.</div>
            )}
              {filteredGroups.map((g) => {
                const isExpanded = expandedGroups.has(g.id);
                const count = g.filteredSymbols.length;
                const isRenaming = renamingGroupId === g.id;
                const isEditingSymbols = editingGroupId === g.id;
                const isInlineAdding = inlineAddGroupId === g.id;
                return (
                  <div key={g.id} className={`tree-node ${selectedGroupId === g.id ? "selected" : ""}`}>
                    <div
                    className={`tree-row group-row ${isRenaming ? "renaming" : ""}`}
                    onDoubleClick={() => toggleExpanded(g.id)}
                    onClick={() => {
                      if (isRenaming) return;
                      setSelectedGroupId(g.id);
                    }}
                  >
                    <button
                      type="button"
                      className="chevron-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(g.id);
                      }}
                      aria-label={isExpanded ? "Collapse group" : "Expand group"}
                    >
                      {isExpanded ? "v" : ">"}
                    </button>
                    {isRenaming ? (
                      <>
                        <input
                          className="group-edit-input"
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleRenameSave(g);
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              cancelRename();
                            }
                          }}
                          autoFocus
                        />
                        <div className="count-pill">{count}</div>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="menu-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRenameSave(g);
                            }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="menu-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelRename();
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                          <div className="group-name" title={g.name}>
                            {g.name}
                          </div>
                          <span className="count-pill">{count}</span>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                startRename(g);
                              }}
                              aria-label="Rename"
                            >
                              <Pencil size={20} aria-hidden="true" />
                              <span className="icon-tooltip" role="tooltip" aria-hidden="true">
                                Rename
                              </span>
                            </button>
                            <button
                              type="button"
                              className={`icon-btn ${isInlineAdding ? "active" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setInlineAddGroupId((prev) => (prev === g.id ? null : g.id));
                                setInlineAddDraft("");
                              }}
                              aria-label="Add symbol"
                            >
                              <Plus size={20} aria-hidden="true" />
                              <span className="icon-tooltip" role="tooltip" aria-hidden="true">
                                Add symbol
                              </span>
                            </button>
                            <button
                              type="button"
                              className="icon-btn destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteGroup(g.id);
                              }}
                              aria-label="Delete group"
                              disabled={deletingId === g.id}
                            >
                              <Trash2 size={20} aria-hidden="true" />
                              <span className="icon-tooltip" role="tooltip" aria-hidden="true">
                                Delete group
                              </span>
                            </button>
                          </div>
                        </>
                      )}
                  </div>
                  {isRenaming && renameError && (
                    <div className="status error small">Rename failed: {renameError}</div>
                  )}
                  {isEditingSymbols && (
                    <div
                      className="edit-panel"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <div className="chips">
                        {stagedSymbols.length === 0 && (
                          <div className="status small">No symbols yet.</div>
                        )}
                        {stagedSymbols.map((sym) => (
                          <span key={sym} className="chip">
                            {sym}
                            <button
                              type="button"
                              className="chip-remove"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeSymbol(sym);
                              }}
                              aria-label={`Remove ${sym}`}
                            >
                              <X size={12} aria-hidden="true" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="add-row">
                        <input
                          value={addDraft}
                          onChange={(e) => setAddDraft(e.target.value)}
                          placeholder="Add symbols (comma or space separated)"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              applyAddSymbols();
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              cancelEditSymbols();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            applyAddSymbols();
                          }}
                          disabled={!addDraft.trim()}
                        >
                          Add
                        </button>
                      </div>
                      {editError && <div className="status error small">{editError}</div>}
                      <div className="inline-actions">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            saveSymbols(g);
                          }}
                          disabled={isSavingSymbols}
                        >
                          {isSavingSymbols ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelEditSymbols();
                          }}
                          disabled={isSavingSymbols}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  {isExpanded && (
                    <div className="tree-children">
                      {g.filteredSymbols.map((sym) => (
                        <div key={sym} className="tree-row leaf">
                          <span className="leaf-bullet">*</span>
                          <span className="leaf-label">{sym}</span>
                          <button
                            type="button"
                            className="icon-btn leaf-remove"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isSavingSymbols) return;
                              const nextSymbols = g.symbols.filter((s) => s !== sym);
                              saveSymbols(g, nextSymbols);
                            }}
                            aria-label={`Remove ${sym}`}
                            disabled={isSavingSymbols}
                          >
                            <X size={20} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {inlineAddGroup && (
            <div
              className="inline-add-modal"
              onClick={() => {
                setInlineAddGroupId(null);
                setInlineAddDraft("");
              }}
            >
              <div
                className="inline-add-card"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <div className="inline-add-title">Add symbol to {inlineAddGroup.name}</div>
                <div className="inline-add-controls">
                  <input
                    value={inlineAddDraft}
                    onChange={(e) => setInlineAddDraft(e.target.value)}
                    placeholder="AAPL"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (isSavingSymbols) return;
                        const additions = parseSymbols(inlineAddDraft);
                        if (additions.length === 0) return;
                        const nextSymbols = Array.from(
                          new Set([...inlineAddGroup.symbols, ...additions]),
                        );
                        saveSymbols(inlineAddGroup, nextSymbols).then((ok) => {
                          if (ok) {
                            setInlineAddGroupId(null);
                            setInlineAddDraft("");
                          }
                        });
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setInlineAddGroupId(null);
                        setInlineAddDraft("");
                      }
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => {
                      if (isSavingSymbols) return;
                      const additions = parseSymbols(inlineAddDraft);
                      if (additions.length === 0) return;
                      const nextSymbols = Array.from(
                        new Set([...inlineAddGroup.symbols, ...additions]),
                      );
                      saveSymbols(inlineAddGroup, nextSymbols).then((ok) => {
                        if (ok) {
                          setInlineAddGroupId(null);
                          setInlineAddDraft("");
                        }
                      });
                    }}
                    aria-label="Save symbol"
                    disabled={isSavingSymbols}
                  >
                    <Save size={24} aria-hidden="true" />
                    <span className="icon-tooltip" role="tooltip" aria-hidden="true">
                      Save
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {templatesOpen && (
          <div
            className="template-modal"
            onClick={() => {
              setTemplatesOpen(false);
            }}
          >
            <div
              className="template-card"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <div className="template-header">
                <div>
                  <div className="template-title">Stock Library</div>
                  <div className="template-subtitle">
                    Pre-built US stock groups. No ETFs or microcaps.
                  </div>
                </div>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setTemplatesOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className="template-controls">
                <input
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="Search categories, names, or symbols"
                />
                <select
                  value={templateCategory}
                  onChange={(e) => setTemplateCategory(e.target.value)}
                >
                  {templateCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              {templatesStatus === "loading" && (
                <div className="status">Loading templates...</div>
              )}
              {templatesStatus === "error" && (
                <div className="status error">Failed to load templates.</div>
              )}
              {templateAddStatus === "error" && templateAddError && (
                <div className="status error">{templateAddError}</div>
              )}
              <div className="template-list">
                {filteredTemplates.length === 0 && templatesStatus === "idle" && (
                  <div className="status">No templates found.</div>
                )}
                {filteredTemplates.map((template) => (
                  <div key={template.id} className="template-row">
                    <div className="template-meta">
                      <div className="template-name">{template.name}</div>
                      <div className="template-desc">{template.description}</div>
                      <div className="template-tags">
                        <span>{template.category}</span>
                        <span>{template.symbols.length} symbols</span>
                        <span>{template.symbols.slice(0, 6).join(", ")}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addTemplateGroup(template)}
                      disabled={templateAddStatus === "loading"}
                    >
                      Add group
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="main-column">
          <section className="card">
          <h2>Analyze</h2>
          <p>Preset range: last 1 year. Runs metrics via the API.</p>
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
              Range: {range.start} -&gt; {range.end}
            </div>
            <button
              type="submit"
              className="analyze-btn"
              disabled={analyzeStatus === "loading" || !selectedGroupId}
            >
              <Play size={16} aria-hidden="true" />
              {analyzeStatus === "loading" ? "Analyzing..." : "Run analysis"}
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
          {analyzeStatus === "loading" && <div className="status">Running...</div>}
          {result.length > 0 && (
            <>
              <div className="group-insights">
                <div className="score-row">
                  <div className="score-main">
                    <span className={scoreTone(groupInsights?.score)}>
                      Group Score: {groupInsights?.score?.toFixed(1) ?? "-"} / 100
                    </span>
                    <div className="score-summary">
                      {groupInsights?.summary ?? "No group insights available."}
                    </div>
                  </div>
                  <div className="stats-grid">
                    <div>
                      <div className="stat-label">Avg 1M Return</div>
                      <div className="stat-value">
                        {(groupInsights?.avgReturn1M ?? 0).toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="stat-label">Avg Vol</div>
                      <div className="stat-value">
                        {(groupInsights?.avgVolAnn ?? 0).toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="stat-label">Dispersion</div>
                      <div className="stat-value">
                        {(groupInsights?.dispersionReturn1M ?? 0).toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="stat-label">Momentum breadth</div>
                      <div className="stat-value">
                        {(groupInsights?.momentumBreadth ?? 0).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
                <div className="highlight-grid">
                  {topRow && (
                    <div className="mini-card">
                      <div className="mini-label">Top performer</div>
                      <div className="mini-title">{topRow.symbol}</div>
                      <div className="mini-metrics">
                        3M: {formatMetricValue(topRow.metrics.return3M)}% | 1M: {formatMetricValue(topRow.metrics.return1M)}%
                      </div>
                      <div className="mini-summary">{safeText(topRow.insights?.summary)}</div>
                    </div>
                  )}
                  {bottomRow && (
                    <div className="mini-card">
                      <div className="mini-label">Bottom performer</div>
                      <div className="mini-title">{bottomRow.symbol}</div>
                      <div className="mini-metrics">
                        3M: {formatMetricValue(bottomRow.metrics.return3M)}% | 1M:{" "}
                        {formatMetricValue(bottomRow.metrics.return1M)}%
                      </div>
                      <div className="mini-summary">{safeText(bottomRow.insights?.summary)}</div>
                    </div>
                  )}
                  {highestRiskRow && (
                    <div className="mini-card">
                      <div className="mini-label">Highest risk</div>
                      <div className="mini-title">{highestRiskRow.symbol}</div>
                      <div className="mini-metrics">
                        Vol: {formatMetricValue(highestRiskRow.metrics.volAnn)}% | DD:{" "}
                        {formatMetricValue(highestRiskRow.metrics.maxDrawdown)}%
                      </div>
                      <div className="mini-summary">
                        {highestRiskRow.insights?.summary ?? "Risk profile elevated."}
                      </div>
                      <div className="mini-summary">Why risky: {highestRiskReason}</div>
                    </div>
                  )}
                </div>
              </div>

              <table>
                <thead>
  <tr>
    <th>Symbol</th>
    <th>
      <span className="header-tooltip" tabIndex={0}>
        Price
        <span className="signal-tooltip" role="tooltip" aria-hidden="true">
          Latest share price from the analysis window.
        </span>
      </span>
    </th>
    <th>
      <span className="header-tooltip" tabIndex={0}>
        P/E
        <span className="signal-tooltip" role="tooltip" aria-hidden="true">
          Price to earnings (TTM): share price divided by trailing EPS.
        </span>
      </span>
    </th>
    <th>
      <span className="header-tooltip" tabIndex={0}>
        Fwd P/E
        <span className="signal-tooltip" role="tooltip" aria-hidden="true">
          Forward price to earnings: price divided by next 12M EPS estimate.
        </span>
      </span>
    </th>
    <th>
      <span className="header-tooltip" tabIndex={0}>
        1M Return
        <span className="signal-tooltip" role="tooltip" aria-hidden="true">
          Percent change over the last month.
        </span>
      </span>
    </th>
    <th>
      <span className="header-tooltip" tabIndex={0}>
        Vol (ann)
        <span className="signal-tooltip" role="tooltip" aria-hidden="true">
          Annualized volatility in percent (how much the stock typically swings).
        </span>
      </span>
    </th>
    <th>
      <span className="header-tooltip" tabIndex={0}>
        RSI14
        <span className="signal-tooltip" role="tooltip" aria-hidden="true">
          Relative Strength Index (RSI): 0-100 momentum gauge. Overbought ~70, oversold ~30.
          <a href="https://www.investopedia.com/terms/r/rsi.asp" target="_blank" rel="noreferrer">
            Learn more
          </a>
        </span>
      </span>
    </th>
    <th>
      <span className="header-tooltip" tabIndex={0}>
        Signals
        <span className="signal-tooltip" role="tooltip" aria-hidden="true">
          Rule-based flags from recent price/volume behavior.
        </span>
      </span>
    </th>
    <th>
      <span className="header-tooltip" tabIndex={0}>
        Trend
        <span className="signal-tooltip" role="tooltip" aria-hidden="true">
          Direction from moving averages and 3M trend.
        </span>
      </span>
    </th>
    <th>
      <span className="header-tooltip" tabIndex={0}>
        Momentum
        <span className="signal-tooltip" role="tooltip" aria-hidden="true">
          Strength based on 1M, 3M returns and RSI.
        </span>
      </span>
    </th>
    <th>
      <span className="header-tooltip" tabIndex={0}>
        Risk
        <span className="signal-tooltip" role="tooltip" aria-hidden="true">
          Risk bucket from volatility and drawdown.
        </span>
      </span>
    </th>
    <th>
      <span className="header-tooltip" tabIndex={0}>
        Summary
        <span className="signal-tooltip" role="tooltip" aria-hidden="true">
          Plain-language summary of trend, momentum, and risk.
        </span>
      </span>
    </th>
  </tr>
</thead>
                <tbody>
                  {result.map((row) => (
                    <tr key={row.symbol}>
                      {(() => {
                        const spike =
                          volumeSpikeCache[row.symbol]?.range === priceRange
                            ? volumeSpikeCache[row.symbol]
                            : null;
                        const trendReason = buildTrendReason(row);
                        const momentumReason = buildMomentumReason(row);
                        const riskReason = buildRiskReason(row);
                        return (
                          <>
                      <td>
                        <div className="symbol-cell" onMouseEnter={() => openFundamentals(row.symbol)} onMouseLeave={closeFundamentals}>
                          <span>{row.symbol}</span>
                          <button
                            type="button"
                            className="fundamentals-btn"
                            title="Fundamentals"
                            onFocus={() => openFundamentals(row.symbol)}
                            onBlur={closeFundamentals}
                            aria-label={`Fundamentals for ${row.symbol}`}
                          >
                            <BarChart4 size={20} aria-hidden="true" />
                          </button>
                          {fundamentalsOpen === row.symbol && (
                            <div
                              className="fundamentals-popover"
                              role="dialog"
                              aria-label={`Fundamentals for ${row.symbol}`}
                            >
                              {(() => {
                                const state = fundamentalsCache[row.symbol];
                                if (!state || state.status === "loading" || state.status === "idle") {
                                  return (
                                    <div className="fundamentals-status">
                                      Loading fundamentals...
                                    </div>
                                  );
                                }
                                if (state.status === "disabled") {
                                  return (
                                    <div className="fundamentals-status">
                                      Fundamentals not configured
                                    </div>
                                  );
                                }
                                if (state.status === "error") {
                                  return (
                                    <div className="fundamentals-status error">
                                      {state.error ?? "Failed to load fundamentals"}
                                    </div>
                                  );
                                }
                                const quarters = state.quarters ?? [];
                                if (quarters.length === 0) {
                                  return (
                                    <div className="fundamentals-status">
                                      No fundamentals yet.
                                    </div>
                                  );
                                }
                                const latestFetchedAt = state.meta?.latestFetchedAt
                                  ? new Date(state.meta.latestFetchedAt).toLocaleString()
                                  : null;
                                return (
                                  <>
                                    <div className="fundamentals-header">
                                      <div className="fundamentals-title">
                                        Fundamentals (4Q)
                                      </div>
                                      {state.meta?.syncStatus === "running" && (
                                        <span className="fundamentals-badge">Syncing...</span>
                                      )}
                                    </div>
                                    <div className="fundamentals-meta">
                                      Provider: {state.meta?.provider ?? "FMP"}
                                      {latestFetchedAt ? ` | Updated ${latestFetchedAt}` : ""}
                                    </div>
                                    <table className="fundamentals-table">
                                      <thead>
                                        <tr>
                                          <th>Quarter</th>
                                          <th>Revenue</th>
                                          <th>Net Income / EPS</th>
                                          <th>Cash</th>
                                          <th>Debt</th>
                                          <th>P/E (TTM)</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {quarters.map((q) => (
                                          <tr key={q.periodEnd}>
                                            <td>{formatQuarter(q.periodEnd)}</td>
                                            <td>{formatCompact(q.revenue)}</td>
                                            <td>
                                              <div className="fundamentals-primary">
                                                {formatCompact(q.netIncome)}
                                              </div>
                                              <div className="fundamentals-sub">
                                                EPS {formatEps(q.eps)}
                                              </div>
                                            </td>
                                            <td>
                                              <div className="fundamentals-primary">
                                                {formatCompact(q.cash)}
                                              </div>
                                              <div className="fundamentals-sub">
                                                Net {formatCompact(q.netCash)}
                                              </div>
                                            </td>
                                            <td>{formatCompact(q.debt)}</td>
                                            <td>
                                              <div className="fundamentals-primary">
                                                {formatPe(q.peTtm)}
                                              </div>
                                              <div className="fundamentals-sub">
                                                {q.priceAsOf ? `As of ${q.priceAsOf}` : ""}
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>{formatPrice(row.metrics.price)}</td>
                      <td>{formatPe(valuationsCache[row.symbol]?.trailingPe)}</td>
                      <td>{formatPe(valuationsCache[row.symbol]?.forwardPe)}</td>
                      <td>{formatMetricValue(row.metrics.return1M)}</td>
                      <td>{formatMetricValue(row.metrics.volAnn)}</td>
                      <td className={rsiClass(row.metrics.rsi14)}>{formatMetricValue(row.metrics.rsi14)}</td>
                      <td>{renderSignals(row, spike)}</td>
                      <td>
                        <span
                          className={`insight-pill ${trendClass(row.insights?.trend)}`}
                          tabIndex={0}
                          aria-label={`Trend reason: ${trendReason}`}
                        >
                          {safeText(row.insights?.trend)}
                          <span className="signal-tooltip" role="tooltip" aria-hidden="true">
                            {trendReason}
                          </span>
                        </span>
                      </td>
                      <td>
                        <span
                          className={`insight-pill ${momentumClass(row.insights?.momentum)}`}
                          tabIndex={0}
                          aria-label={`Momentum reason: ${momentumReason}`}
                        >
                          {safeText(row.insights?.momentum)}
                          <span className="signal-tooltip" role="tooltip" aria-hidden="true">
                            {momentumReason}
                          </span>
                        </span>
                      </td>
                      <td>
                        <span
                          className={`insight-pill ${riskClass(row.insights?.risk)}`}
                          tabIndex={0}
                          aria-label={`Risk reason: ${riskReason}`}
                        >
                          {safeText(row.insights?.risk)}
                          <span className="signal-tooltip" role="tooltip" aria-hidden="true">
                            {riskReason}
                          </span>
                        </span>
                      </td>
                      <td>
                        <div className="summary-cell">
                          {safeText(row.insights?.summary)}{row.insights?.anomalies?.length ? (
                            <div className="anomaly-list">
                              {safeText(row.insights.anomalies.join(", "))}
                            </div>
                          ) : null}
                        </div>
                      </td>
                          </>
                        );
                      })()}
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
                  <h3>Price ({priceRange.toUpperCase()})</h3>
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
                    <label htmlFor="price-range">Range</label>
                    <select
                      id="price-range"
                      value={priceRange}
                      onChange={(e) =>
                        setPriceRange(e.target.value as "1d" | "1w" | "1m" | "3m" | "6m" | "1y")
                      }
                    >
                      <option value="1d">1 day</option>
                      <option value="1w">1 week</option>
                      <option value="1m">1 month</option>
                      <option value="3m">3 months</option>
                      <option value="6m">6 months</option>
                      <option value="1y">1 year</option>
                    </select>
                  </div>
                  {priceStatus === "loading" && <div className="status">Loading price data...</div>}
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
        </div>
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
    <svg width={width} height={height} className="scatter" style={{ overflow: "visible" }}>
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
  series: {
    symbol: string;
    points: { date: string; close: number; open?: number | null; volume?: number | null }[];
  }[];
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
  const hasVolume =
    series.length === 1 &&
    basePoints.some((point) => point.volume !== null && point.volume !== undefined);
  const maxVolume = hasVolume
    ? Math.max(...basePoints.map((point) => point.volume ?? 0))
    : 0;
  const barBand = (width - padding * 2) / Math.max(maxPoints, 1);
  const barWidth = Math.min(10, Math.max(3, barBand * 0.6));
  const formatVolume = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return `${Math.round(value)}`;
  };
  const volumeY = (value: number) =>
    height - padding - (value / Math.max(maxVolume, 1)) * (height - padding * 2);

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
      <text
        x={width - padding}
        y={height - padding + 14}
        fill="#94a3b8"
        fontSize={12}
        textAnchor="end"
      >
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
      {hasVolume &&
        basePoints.map((point, idx) => {
          const volume = point.volume ?? 0;
          if (!volume || maxVolume <= 0) return null;
          const prevClose = idx > 0 ? basePoints[idx - 1]?.close : null;
          const isUp =
            point.open !== null && point.open !== undefined
              ? point.close >= point.open
              : prevClose !== null && prevClose !== undefined
                ? point.close >= prevClose
                : true;
          const fill = isUp ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)";
          const x = scaleX(idx) - barWidth / 2;
          const y = volumeY(volume);
          const h = height - padding - y;
          const tooltip = `Price: ${point.close.toFixed(2)}Volume: ${formatVolume(volume)}`;
          return (
            <rect key={`vol-${point.date}`} x={x} y={y} width={barWidth} height={h} fill={fill}>
              <title>{tooltip}</title>
            </rect>
          );
        })}

      {series.map((s, idx) => {
        const color = palette[idx % palette.length];
        const points = s.points.map((p, i) => `${scaleX(i)},${scaleY(p.close)}`).join(" ");
        return (
          <g key={s.symbol}>
            <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
            {s.points.map((p, i) => {
              const volumeLabel =
                hasVolume && p.volume !== null && p.volume !== undefined
                  ? `Volume: ${formatVolume(p.volume)}`
                  : "";
              const tooltip = `Price: ${p.close.toFixed(2)}${volumeLabel}`;
              return (
                <g key={p.date}>
                  <circle cx={scaleX(i)} cy={scaleY(p.close)} r={3} fill={color} />
                  <title>{tooltip}</title>
                </g>
              );
            })}
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












































