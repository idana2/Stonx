import { Activity, BarChart3, BarChart4, Maximize2, Pencil, Play, Plus, Save, Trash2, TrendingDown, TrendingUp, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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
  grossProfit?: number | null;
  operatingIncome?: number | null;
  netIncome?: number | null;
  eps?: number | null;
  cash?: number | null;
  debt?: number | null;
  netCash?: number | null;
  totalAssets?: number | null;
  totalLiabilities?: number | null;
  sharesOutstanding?: number | null;
  epsTtm?: number | null;
  peTtm?: number | null;
  priceAsOf?: string | null;
  priceClose?: number | null;
};

type FundamentalsOverview = {
  symbol: string;
  name?: string | null;
  exchange?: string | null;
  sector?: string | null;
  industry?: string | null;
  marketCap?: number | null;
  description?: string | null;
};

type FundamentalsNewsItem = {
  headline: string;
  source: string;
  publishedAt: string;
  url?: string | null;
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
    overview?: FundamentalsOverview;
    news?: FundamentalsNewsItem[];
    meta: FundamentalsMeta;
  };
};

type FundamentalsState = {
  status: "idle" | "loading" | "error" | "disabled" | "ready";
  error?: string | null;
  quarters?: FundamentalsQuarter[];
  overview?: FundamentalsOverview;
  news?: FundamentalsNewsItem[];
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
  const [fundamentalsPopoverOpen, setFundamentalsPopoverOpen] = useState<string | null>(null);
  const [fundamentalsClosing, setFundamentalsClosing] = useState(false);
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
      points: {
        date: string;
        close: number;
        open?: number | null;
        high?: number | null;
        low?: number | null;
        volume?: number | null;
      }[];
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
  const [signalsHover, setSignalsHover] = useState<string | null>(null);
  const signalsHoverTimer = useRef<number | null>(null);
  const [fullScreenOpen, setFullScreenOpen] = useState(false);
  const [fullScreenSymbol, setFullScreenSymbol] = useState<string | null>(null);
  const [fullScreenIndicators, setFullScreenIndicators] = useState({
    ma20: true,
    ma50: true,
    rsi: true,
    benchmark: false,
    benchmarkSymbol: "SPY",
  });
  const [fullScreenEvents, setFullScreenEvents] = useState({
    enabled: false,
    momentum: true,
    volume: true,
    risk: true,
  });
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const fundamentalsCloseRef = useRef<HTMLButtonElement | null>(null);
  const fundamentalsCloseTimer = useRef<number | null>(null);

  const openSignalsHover = (symbol: string) => {
    if (signalsHoverTimer.current !== null) {
      window.clearTimeout(signalsHoverTimer.current);
      signalsHoverTimer.current = null;
    }
    setSignalsHover(symbol);
  };

  const closeSignalsHover = (symbol: string) => {
    if (signalsHoverTimer.current !== null) {
      window.clearTimeout(signalsHoverTimer.current);
    }
    signalsHoverTimer.current = window.setTimeout(() => {
      setSignalsHover((prev) => (prev === symbol ? null : prev));
    }, 200);
  };

  const openFullScreenChart = (symbol: string) => {
    setFullScreenSymbol(symbol);
    setFullScreenOpen(true);
  };

  const closeFullScreenChart = () => {
    setFullScreenOpen(false);
  };

  useEffect(() => {
    if (!fullScreenOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setFullScreenOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [fullScreenOpen]);

  useEffect(() => {
    if (!fundamentalsOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFundamentals();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [fundamentalsOpen]);

  useEffect(() => {
    if (!fullScreenOpen) return;
    const { documentElement, body } = document;
    const prevOverflow = documentElement.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
    documentElement.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
    closeButtonRef.current?.focus();
    return () => {
      documentElement.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, [fullScreenOpen]);

  useEffect(() => {
    if (!fundamentalsOpen) return;
    const { documentElement, body } = document;
    const prevOverflow = documentElement.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
    documentElement.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
    fundamentalsCloseRef.current?.focus();
    return () => {
      documentElement.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, [fundamentalsOpen]);

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
        `http://localhost:3001/api/fundamentals/${encodeURIComponent(symbol)}?limit=20`,
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message =
          payload?.error?.message || payload?.error || `HTTP ${res.status}`;
        throw new Error(message);
      }
      const payload: FundamentalsResponse = await res.json();
      const meta = payload.data?.meta;
      const overview = payload.data?.overview;
      const news = payload.data?.news ?? [];
      if (!meta?.providerEnabled) {
        setFundamentalsCache((prev) => ({
          ...prev,
          [symbol]: {
            status: "disabled",
            quarters: payload.data?.quarters ?? [],
            overview,
            news,
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
          overview,
          news,
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
    if (fundamentalsCloseTimer.current !== null) {
      window.clearTimeout(fundamentalsCloseTimer.current);
      fundamentalsCloseTimer.current = null;
    }
    setFundamentalsClosing(false);
    setFundamentalsOpen(symbol);
    setFundamentalsPopoverOpen(null);
    const cached = fundamentalsCache[symbol];
    if (!cached || cached.status === "idle" || cached.status === "error") {
      loadFundamentals(symbol);
    }
  };

  const closeFundamentals = () => {
    setFundamentalsClosing(true);
    if (fundamentalsCloseTimer.current !== null) {
      window.clearTimeout(fundamentalsCloseTimer.current);
    }
    fundamentalsCloseTimer.current = window.setTimeout(() => {
      setFundamentalsOpen(null);
      setFundamentalsClosing(false);
      fundamentalsCloseTimer.current = null;
    }, 160);
  };

  const openFundamentalsPopover = (symbol: string) => {
    setFundamentalsPopoverOpen(symbol);
    const cached = fundamentalsCache[symbol];
    if (!cached || cached.status === "idle" || cached.status === "error") {
      loadFundamentals(symbol);
    }
  };

  const closeFundamentalsPopover = (symbol: string) => {
    setFundamentalsPopoverOpen((prev) => (prev === symbol ? null : prev));
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

  const sortQuartersAsc = (quarters: FundamentalsQuarter[]) =>
    [...quarters].sort(
      (a, b) => new Date(a.periodEnd).getTime() - new Date(b.periodEnd).getTime(),
    );

  const calcYoY = (latest: number | null | undefined, prior: number | null | undefined) => {
    if (latest === null || latest === undefined || prior === null || prior === undefined) {
      return null;
    }
    if (!Number.isFinite(latest) || !Number.isFinite(prior) || prior === 0) {
      return null;
    }
    return ((latest - prior) / Math.abs(prior)) * 100;
  };

  const calcMargin = (value: number | null | undefined, base: number | null | undefined) => {
    if (value === null || value === undefined || base === null || base === undefined) {
      return null;
    }
    if (!Number.isFinite(value) || !Number.isFinite(base) || base === 0) {
      return null;
    }
    return (value / base) * 100;
  };

  const buildTrendSeries = (quarters: FundamentalsQuarter[], valueKey: keyof FundamentalsQuarter) => {
    const sorted = sortQuartersAsc(quarters);
    const slice = sorted.slice(-20);
    if (slice.length < 20) return [];
    const values = slice.map((item) => item[valueKey] as number | null | undefined);
    if (values.some((value) => value === null || value === undefined)) return [];
    return values as number[];
  };

  const formatPrice = (value: number | null | undefined) =>
    value === null || value === undefined ? "-" : value.toFixed(2);

  const formatCompact = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "-";
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toFixed(0);
  };

  const formatEps = (value: number | null | undefined) =>
    value === null || value === undefined ? "-" : value.toFixed(2);

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


  const formatPercent2 = (value: number | null | undefined) =>
    value === null || value === undefined ? "-" : value.toFixed(2);

  const formatNumber2 = (value: number | null | undefined) =>
    value === null || value === undefined ? "-" : value.toFixed(2);

  const missingValue = "—";

  const formatDisplayNumber = (value: number | null | undefined, digits = 2) =>
    value === null || value === undefined || !Number.isFinite(value)
      ? missingValue
      : value.toFixed(digits);

  const formatDisplayPercent = (value: number | null | undefined, digits = 1) =>
    value === null || value === undefined || !Number.isFinite(value)
      ? missingValue
      : `${value.toFixed(digits)}%`;

  const formatDisplayCompact = (value: number | null | undefined) =>
    value === null || value === undefined || !Number.isFinite(value)
      ? missingValue
      : formatCompact(value);

  const formatDisplayText = (value: string | null | undefined) =>
    value === null || value === undefined || value.trim() === "" ? missingValue : value;

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

  const negativeClass = (value: number | null | undefined) =>
    value !== null && value !== undefined && Number.isFinite(value) && value < 0
      ? "is-negative"
      : "";

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
        points: {
          date: string;
          close: number;
          open?: number | null;
          high?: number | null;
          low?: number | null;
          volume?: number | null;
        }[];
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
          high?: number | null;
          low?: number | null;
          volume?: number | null;
        }[];
        const trimmedBars = priceRange === "1d" ? bars.slice(-1) : bars;
        series.push({
          symbol: sym,
          points: trimmedBars.map((bar) => ({
            date: bar.date,
            close: bar.close,
            open: bar.open ?? null,
            high: bar.high ?? null,
            low: bar.low ?? null,
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

  const canExpandChart =
    priceSymbol !== null && priceSymbol !== "ALL" && priceSeries.length > 0 && priceStatus === "idle";
  const activeSymbol = priceSymbol && priceSymbol !== "ALL" ? priceSymbol : null;

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
          metrics: `1M ${formatPercent2(return1M)}%, 3M ${formatPercent2(return3M)}%`,
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
          metrics: `1M ${formatPercent2(return1M)}%, 3M ${formatPercent2(return3M)}%`,
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
          metrics: `DD ${formatPercent2(maxDrawdown)}%, Vol ${formatPercent2(volAnn)}%`,
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
                        const isSignalOpen = signalsHover === row.symbol;
                        const handleSignalEnter = () => openSignalsHover(row.symbol);
                        const handleSignalLeave = () => closeSignalsHover(row.symbol);
                        const momentumReason = buildMomentumReason(row);
                        const riskReason = buildRiskReason(row);
                        return (
                          <>
                      <td>
                        <div
                          className="symbol-cell"
                          onMouseEnter={() => openFundamentalsPopover(row.symbol)}
                          onMouseLeave={() => closeFundamentalsPopover(row.symbol)}
                        >
                          <span>{row.symbol}</span>
                          <button
                            type="button"
                            className="fundamentals-btn"
                            title="Fundamentals"
                            onClick={() => openFundamentals(row.symbol)}
                            onFocus={() => openFundamentalsPopover(row.symbol)}
                            onBlur={() => closeFundamentalsPopover(row.symbol)}
                            aria-label={`Fundamentals for ${row.symbol}`}
                          >
                            <BarChart4 size={20} aria-hidden="true" />
                          </button>
                          {fundamentalsPopoverOpen === row.symbol && (
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
                                        {quarters.slice(0, 4).map((q) => (
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
                      <td>{renderSignals(row, spike, isSignalOpen, handleSignalEnter, handleSignalLeave)}</td>
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
                    <div
                      className={`price-chart-frame ${canExpandChart ? "is-expandable" : "is-disabled"}`}
                      role={canExpandChart ? "button" : undefined}
                      tabIndex={canExpandChart ? 0 : -1}
                      aria-label={
                        canExpandChart
                          ? `Expand ${activeSymbol} chart`
                          : "Select a symbol to expand"
                      }
                      onClick={() => {
                        if (canExpandChart && activeSymbol) {
                          openFullScreenChart(activeSymbol);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (!canExpandChart || !activeSymbol) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openFullScreenChart(activeSymbol);
                        }
                      }}
                    >
                      <PriceChart series={priceSeries} />
                      <button
                        type="button"
                        className="chart-expand-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (canExpandChart && activeSymbol) {
                            openFullScreenChart(activeSymbol);
                          }
                        }}
                        disabled={!canExpandChart}
                        aria-label={canExpandChart ? "Expand chart" : "Select a symbol to expand"}
                      >
                        <Maximize2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
        </div>
      </main>
      {fundamentalsOpen ? (
        <div
          className={`fundamentals-overlay ${fundamentalsClosing ? "is-closing" : ""}`}
          role="presentation"
        >
          <div
            className={`fundamentals-panel ${fundamentalsClosing ? "is-closing" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={`Fundamentals for ${fundamentalsOpen}`}
          >
            {(() => {
              const state = fundamentalsCache[fundamentalsOpen];
              const overview = state?.overview;
              const quarters = state?.quarters ?? [];
              const sortedQuarters = sortQuartersAsc(quarters);
              const latestQuarter = sortedQuarters[sortedQuarters.length - 1];
              const priorYearQuarter =
                sortedQuarters.length >= 5
                  ? sortedQuarters[sortedQuarters.length - 5]
                  : undefined;
              const sector = formatDisplayText(overview?.sector);
              const industry = formatDisplayText(overview?.industry);
              const sectorIndustry =
                sector !== missingValue && industry !== missingValue
                  ? `${sector} → ${industry}`
                  : sector !== missingValue
                    ? sector
                    : industry !== missingValue
                      ? industry
                      : missingValue;
              const marketCap = overview?.marketCap ?? null;
              const trailingPe =
                valuationsCache[fundamentalsOpen]?.trailingPe ?? latestQuarter?.peTtm ?? null;
              const forwardPe = valuationsCache[fundamentalsOpen]?.forwardPe ?? null;
              const ttmRevenue = (() => {
                if (sortedQuarters.length < 4) return null;
                const recent = sortedQuarters.slice(-4);
                if (recent.some((q) => q.revenue === null || q.revenue === undefined)) {
                  return null;
                }
                return recent.reduce((sum, q) => sum + (q.revenue ?? 0), 0);
              })();
              const priceToSales =
                marketCap !== null && marketCap !== undefined && ttmRevenue
                  ? marketCap / ttmRevenue
                  : null;
              const revenueYoY = calcYoY(latestQuarter?.revenue, priorYearQuarter?.revenue);
              const epsYoY = calcYoY(latestQuarter?.eps, priorYearQuarter?.eps);
              const grossMargin = calcMargin(latestQuarter?.grossProfit, latestQuarter?.revenue);
              const operatingMargin = calcMargin(
                latestQuarter?.operatingIncome,
                latestQuarter?.revenue,
              );
              const netMargin = calcMargin(latestQuarter?.netIncome, latestQuarter?.revenue);
              const equity =
                latestQuarter?.totalAssets !== null &&
                latestQuarter?.totalAssets !== undefined &&
                latestQuarter?.totalLiabilities !== null &&
                latestQuarter?.totalLiabilities !== undefined
                  ? latestQuarter.totalAssets - latestQuarter.totalLiabilities
                  : null;
              const roe = equity ? calcMargin(latestQuarter?.netIncome, equity) : null;
              const totalCash = latestQuarter?.cash ?? null;
              const totalDebt = latestQuarter?.debt ?? null;
              const netDebt =
                totalDebt !== null && totalDebt !== undefined && totalCash !== null && totalCash !== undefined
                  ? totalDebt - totalCash
                  : null;
              const netCash =
                netDebt !== null && netDebt !== undefined && netDebt < 0 ? Math.abs(netDebt) : null;
              const debtToEquity =
                totalDebt !== null &&
                totalDebt !== undefined &&
                equity !== null &&
                equity !== undefined &&
                equity !== 0
                  ? totalDebt / equity
                  : null;
              const revenueSeries = buildTrendSeries(quarters, "revenue");
              const epsSeries = buildTrendSeries(quarters, "eps");
              const operatingMarginSeries = (() => {
                const sorted = sortQuartersAsc(quarters).slice(-20);
                if (sorted.length < 20) return [];
                const values = sorted.map((q) => {
                  if (q.operatingIncome === null || q.operatingIncome === undefined) return null;
                  if (q.revenue === null || q.revenue === undefined || q.revenue === 0) return null;
                  return (q.operatingIncome / q.revenue) * 100;
                });
                if (values.some((value) => value === null || value === undefined)) return [];
                return values as number[];
              })();
              const newsItems = (state?.news ?? [])
                .slice()
                .sort((a, b) => {
                  const timeA = new Date(a.publishedAt).getTime();
                  const timeB = new Date(b.publishedAt).getTime();
                  return (Number.isFinite(timeB) ? timeB : 0) - (Number.isFinite(timeA) ? timeA : 0);
                })
                .slice(0, 5);
              const displayNews =
                newsItems.length > 0
                  ? newsItems
                  : [
                      {
                        headline: missingValue,
                        source: missingValue,
                        publishedAt: missingValue,
                        url: null,
                      },
                    ];
              const formatPublishedDate = (value: string) => {
                const date = new Date(value);
                if (Number.isNaN(date.getTime())) return value;
                return date.toLocaleDateString();
              };
              return (
                <>
                  <div className="fundamentals-panel-header">
                    <div className="fundamentals-company">
                      <div className="fundamentals-company-name">
                        {formatDisplayText(overview?.name)}
                      </div>
                      <div className="fundamentals-ticker-line">
                        {fundamentalsOpen} • {formatDisplayText(overview?.exchange)}
                      </div>
                      <div className="fundamentals-sector-line">{sectorIndustry}</div>
                    </div>
                    <div className="fundamentals-market-cap">
                      <div className="fundamentals-market-label">Market Cap</div>
                      <div className="fundamentals-market-value">
                        {formatDisplayCompact(overview?.marketCap)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="fundamentals-close-btn"
                      onClick={closeFundamentals}
                      aria-label="Close fundamentals"
                      ref={fundamentalsCloseRef}
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="fundamentals-description">
                    {formatDisplayText(overview?.description)}
                  </div>
                  {(() => {
                    if (!state || state.status === "loading" || state.status === "idle") {
                      return <div className="fundamentals-status">Loading fundamentals...</div>;
                    }
                    if (state.status === "disabled") {
                      return <div className="fundamentals-status">Fundamentals not configured</div>;
                    }
                    if (state.status === "error") {
                      return (
                        <div className="fundamentals-status error">
                          {state.error ?? "Failed to load fundamentals"}
                        </div>
                      );
                    }
                    if (quarters.length === 0) {
                      return <div className="fundamentals-status">No fundamentals yet.</div>;
                    }
                    return (
                      <div className="fundamentals-content">
                        <div className="fundamentals-grid">
                          <div className="fundamentals-section">
                            <div className="fundamentals-section-title">Valuation</div>
                            <div className="fundamentals-metrics">
                              <div className="fundamentals-metric">
                                <div className="metric-label">Market Cap</div>
                                <div className="metric-value">
                                  {formatDisplayCompact(marketCap)}
                                </div>
                              </div>
                              <div className="fundamentals-metric">
                                <div className="metric-label">P/E (TTM)</div>
                                <div className="metric-value">
                                  {formatDisplayNumber(trailingPe, 1)}
                                </div>
                              </div>
                              <div className="fundamentals-metric">
                                <div className="metric-label">P/E (Forward)</div>
                                <div className="metric-value">
                                  {formatDisplayNumber(forwardPe, 1)}
                                </div>
                              </div>
                              <div className="fundamentals-metric">
                                <div className="metric-label">EV / EBITDA</div>
                                <div className="metric-value">{missingValue}</div>
                              </div>
                              <div className="fundamentals-metric">
                                <div className="metric-label">Price / Sales</div>
                                <div className="metric-value">
                                  {formatDisplayNumber(priceToSales, 2)}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="fundamentals-section">
                            <div className="fundamentals-section-title">Growth</div>
                            <div className="fundamentals-metrics">
                              <div className="fundamentals-metric">
                                <div className="metric-label">Revenue YoY (%)</div>
                                <div className={`metric-value ${negativeClass(revenueYoY)}`}>
                                  {formatDisplayPercent(revenueYoY, 1)}
                                </div>
                              </div>
                              <div className="fundamentals-metric">
                                <div className="metric-label">EPS YoY (%)</div>
                                <div className={`metric-value ${negativeClass(epsYoY)}`}>
                                  {formatDisplayPercent(epsYoY, 1)}
                                </div>
                              </div>
                              <div className="fundamentals-metric">
                                <div className="metric-label">Free Cash Flow Growth (%)</div>
                                <div className="metric-value">{missingValue}</div>
                              </div>
                            </div>
                          </div>
                          <div className="fundamentals-section">
                            <div className="fundamentals-section-title">Profitability</div>
                            <div className="fundamentals-metrics">
                              <div className="fundamentals-metric">
                                <div className="metric-label">Gross Margin (%)</div>
                                <div className={`metric-value ${negativeClass(grossMargin)}`}>
                                  {formatDisplayPercent(grossMargin, 1)}
                                </div>
                              </div>
                              <div className="fundamentals-metric">
                                <div className="metric-label">Operating Margin (%)</div>
                                <div className={`metric-value ${negativeClass(operatingMargin)}`}>
                                  {formatDisplayPercent(operatingMargin, 1)}
                                </div>
                              </div>
                              <div className="fundamentals-metric">
                                <div className="metric-label">Net Margin (%)</div>
                                <div className={`metric-value ${negativeClass(netMargin)}`}>
                                  {formatDisplayPercent(netMargin, 1)}
                                </div>
                              </div>
                              <div className="fundamentals-metric">
                                <div className="metric-label">ROE (%)</div>
                                <div className={`metric-value ${negativeClass(roe)}`}>
                                  {formatDisplayPercent(roe, 1)}
                                </div>
                              </div>
                              <div className="fundamentals-metric">
                                <div className="metric-label">ROIC (%)</div>
                                <div className="metric-value">{missingValue}</div>
                              </div>
                            </div>
                          </div>
                          <div className="fundamentals-section">
                            <div className="fundamentals-section-title">Balance Sheet</div>
                            <div className="fundamentals-metrics">
                              <div className="fundamentals-metric">
                                <div className="metric-label">Total Cash</div>
                                <div className="metric-value">
                                  {formatDisplayCompact(totalCash)}
                                </div>
                              </div>
                              <div className="fundamentals-metric">
                                <div className="metric-label">Total Debt</div>
                                <div className="metric-value">
                                  {formatDisplayCompact(totalDebt)}
                                </div>
                              </div>
                              <div className="fundamentals-metric">
                                <div className="metric-label">
                                  {netCash !== null ? "Net Cash" : "Net Debt"}
                                </div>
                                <div
                                  className={`metric-value ${netCash !== null ? "is-positive" : ""}`}
                                >
                                  {netCash !== null
                                    ? formatDisplayCompact(netCash)
                                    : formatDisplayCompact(netDebt)}
                                </div>
                              </div>
                              <div className="fundamentals-metric">
                                <div className="metric-label">Debt / Equity</div>
                                <div className={`metric-value ${negativeClass(debtToEquity)}`}>
                                  {formatDisplayNumber(debtToEquity, 2)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        {(revenueSeries.length > 0 ||
                          epsSeries.length > 0 ||
                          operatingMarginSeries.length > 0) && (
                          <div className="fundamentals-trends">
                            {revenueSeries.length > 0 && (
                              <div className="fundamentals-trend">
                                <div className="trend-title">Revenue (5Y)</div>
                                <MiniTrendChart data={revenueSeries} />
                              </div>
                            )}
                            {epsSeries.length > 0 && (
                              <div className="fundamentals-trend">
                                <div className="trend-title">EPS (5Y)</div>
                                <MiniTrendChart data={epsSeries} />
                              </div>
                            )}
                            {operatingMarginSeries.length > 0 && (
                              <div className="fundamentals-trend">
                                <div className="trend-title">Operating Margin (5Y)</div>
                                <MiniTrendChart data={operatingMarginSeries} />
                              </div>
                            )}
                          </div>
                        )}
                        <div className="fundamentals-news">
                          <div className="fundamentals-section-title">News</div>
                          <div className="news-list">
                            {displayNews.map((item, index) => (
                              <div className="news-item" key={`${item.headline}-${index}`}>
                                {item.url ? (
                                  <a href={item.url} target="_blank" rel="noreferrer">
                                    {item.headline}
                                  </a>
                                ) : (
                                  <span>{item.headline}</span>
                                )}
                                <div className="news-meta">
                                  <span>{item.source}</span>
                                  <span>{formatPublishedDate(item.publishedAt)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </div>
        </div>
      ) : null}
      {fullScreenOpen && fullScreenSymbol ? (
        <div
          className="chart-modal"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeFullScreenChart();
            }
          }}
        >
          <div className="chart-modal-card" role="dialog" aria-modal="true">
            <div className="chart-modal-header">
              <div className="chart-modal-title">
                <div className="chart-modal-symbol">{fullScreenSymbol}</div>
                <div className="chart-modal-subtitle">Full-screen inspection</div>
              </div>
              <div className="chart-modal-controls">
                <div className="chart-range-group" role="group" aria-label="Time range">
                  {(["1m", "3m", "6m", "1y"] as const).map((rangeOption) => (
                    <button
                      key={rangeOption}
                      type="button"
                      className={`chart-range-btn ${
                        priceRange === rangeOption ? "active" : ""
                      }`}
                      onClick={() => setPriceRange(rangeOption)}
                    >
                      {rangeOption.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="chart-indicator-group">
                  <label className="chart-toggle">
                    <input
                      type="checkbox"
                      checked={fullScreenIndicators.ma20}
                      onChange={(event) =>
                        setFullScreenIndicators((prev) => ({
                          ...prev,
                          ma20: event.target.checked,
                        }))
                      }
                    />
                    MA20
                  </label>
                  <label className="chart-toggle">
                    <input
                      type="checkbox"
                      checked={fullScreenIndicators.ma50}
                      onChange={(event) =>
                        setFullScreenIndicators((prev) => ({
                          ...prev,
                          ma50: event.target.checked,
                        }))
                      }
                    />
                    MA50
                  </label>
                  <label className="chart-toggle">
                    <input
                      type="checkbox"
                      checked={fullScreenIndicators.rsi}
                      onChange={(event) =>
                        setFullScreenIndicators((prev) => ({
                          ...prev,
                          rsi: event.target.checked,
                        }))
                      }
                    />
                    RSI
                  </label>
                  <label className="chart-toggle">
                    <input
                      type="checkbox"
                      checked={fullScreenIndicators.benchmark}
                      onChange={(event) =>
                        setFullScreenIndicators((prev) => ({
                          ...prev,
                          benchmark: event.target.checked,
                        }))
                      }
                    />
                    Benchmark
                  </label>
                  {fullScreenIndicators.benchmark ? (
                    <select
                      className="chart-benchmark-select"
                      value={fullScreenIndicators.benchmarkSymbol}
                      onChange={(event) =>
                        setFullScreenIndicators((prev) => ({
                          ...prev,
                          benchmarkSymbol: event.target.value,
                        }))
                      }
                    >
                      {priceSeries.map((series) => (
                        <option key={series.symbol} value={series.symbol}>
                          {series.symbol}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
                <div className="chart-event-group">
                  <label className="chart-toggle">
                    <input
                      type="checkbox"
                      checked={fullScreenEvents.enabled}
                      onChange={(event) =>
                        setFullScreenEvents((prev) => ({
                          ...prev,
                          enabled: event.target.checked,
                        }))
                      }
                    />
                    Show technical events
                  </label>
                  <label className="chart-toggle">
                    <input
                      type="checkbox"
                      checked={fullScreenEvents.momentum}
                      disabled={!fullScreenEvents.enabled}
                      onChange={(event) =>
                        setFullScreenEvents((prev) => ({
                          ...prev,
                          momentum: event.target.checked,
                        }))
                      }
                    />
                    Momentum
                  </label>
                  <label className="chart-toggle">
                    <input
                      type="checkbox"
                      checked={fullScreenEvents.volume}
                      disabled={!fullScreenEvents.enabled}
                      onChange={(event) =>
                        setFullScreenEvents((prev) => ({
                          ...prev,
                          volume: event.target.checked,
                        }))
                      }
                    />
                    Volume
                  </label>
                  <label className="chart-toggle">
                    <input
                      type="checkbox"
                      checked={fullScreenEvents.risk}
                      disabled={!fullScreenEvents.enabled}
                      onChange={(event) =>
                        setFullScreenEvents((prev) => ({
                          ...prev,
                          risk: event.target.checked,
                        }))
                      }
                    />
                    Risk
                  </label>
                </div>
                <button
                  type="button"
                  className="chart-close-btn"
                  onClick={closeFullScreenChart}
                  ref={closeButtonRef}
                  aria-label="Close full screen chart"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="chart-modal-body">
              <FullScreenChart
                series={priceSeries}
                symbol={fullScreenSymbol}
                benchmarkSymbol={
                  fullScreenIndicators.benchmark ? fullScreenIndicators.benchmarkSymbol : null
                }
                showMA20={fullScreenIndicators.ma20}
                showMA50={fullScreenIndicators.ma50}
                showRSI={fullScreenIndicators.rsi}
                showEvents={fullScreenEvents.enabled}
                eventFilters={{
                  momentum: fullScreenEvents.momentum,
                  volume: fullScreenEvents.volume,
                  risk: fullScreenEvents.risk,
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MiniTrendChart({ data }: { data: number[] }) {
  const width = 180;
  const height = 48;
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 6;
  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height} className="mini-trend-chart" role="img">
      <line
        x1={padding}
        x2={width - padding}
        y1={height / 2}
        y2={height / 2}
        stroke="rgba(148, 163, 184, 0.2)"
        strokeWidth="1"
      />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="rgba(56, 189, 248, 0.9)"
        strokeWidth="2"
      />
    </svg>
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
    points: {
      date: string;
      close: number;
      open?: number | null;
      high?: number | null;
      low?: number | null;
      volume?: number | null;
    }[];
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

function FullScreenChart({
  series,
  symbol,
  benchmarkSymbol,
  showMA20,
  showMA50,
  showRSI,
  showEvents,
  eventFilters,
}: {
  series: {
    symbol: string;
    points: {
      date: string;
      close: number;
      open?: number | null;
      high?: number | null;
      low?: number | null;
      volume?: number | null;
    }[];
  }[];
  symbol: string;
  benchmarkSymbol: string | null;
  showMA20: boolean;
  showMA50: boolean;
  showRSI: boolean;
  showEvents: boolean;
  eventFilters: { momentum: boolean; volume: boolean; risk: boolean };
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 960, height: 420 });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [eventHover, setEventHover] = useState<null | {
    id: string;
    index: number;
    category: "momentum" | "volume" | "risk";
    title: string;
    value: string;
    explanation: string;
  }>(null);

  useEffect(() => {
    if (!showEvents) {
      setEventHover(null);
    }
  }, [showEvents]);

  useEffect(() => {
    const updateSize = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setChartSize({ width: Math.max(rect.width, 320), height: Math.max(rect.height, 240) });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const primarySeries = series.find((s) => s.symbol === symbol) ?? series[0];
  const benchmarkSeries = benchmarkSymbol
    ? series.find((s) => s.symbol === benchmarkSymbol)
    : undefined;
  const points = primarySeries?.points ?? [];
  useEffect(() => {
    setHoverIndex(null);
    setEventHover(null);
  }, [points.length]);
  const width = chartSize.width;
  const height = chartSize.height;
  const padding = 48;
  const chartHeight = showRSI ? height * 0.72 : height;
  const rsiHeight = Math.max(110, height * 0.22);
  const maxPoints = points.length;
  const closes = points.map((p) => p.close);
  const minY = closes.length ? Math.min(...closes) : 0;
  const maxY = closes.length ? Math.max(...closes) : 0;
  const scaleX = (i: number) =>
    padding + (i / Math.max(maxPoints - 1, 1)) * (width - padding * 2);
  const scaleY = (v: number) =>
    chartHeight - padding - ((v - minY) / Math.max(maxY - minY, 1)) * (chartHeight - padding * 2);

  const movingAverage = (windowSize: number) => {
    const values: (number | null)[] = [];
    for (let i = 0; i < points.length; i += 1) {
      if (i < windowSize - 1) {
        values.push(null);
        continue;
      }
      const slice = points.slice(i - windowSize + 1, i + 1);
      const sum = slice.reduce((acc, p) => acc + p.close, 0);
      values.push(sum / windowSize);
    }
    return values;
  };

  const rsi = (() => {
    const windowSize = 14;
    const values: (number | null)[] = [];
    let gainSum = 0;
    let lossSum = 0;
    for (let i = 1; i < points.length; i += 1) {
      const change = points[i].close - points[i - 1].close;
      gainSum += Math.max(0, change);
      lossSum += Math.max(0, -change);
      if (i < windowSize) {
        values.push(null);
        continue;
      }
      if (i === windowSize) {
        gainSum /= windowSize;
        lossSum /= windowSize;
      } else {
        gainSum = (gainSum * (windowSize - 1) + Math.max(0, change)) / windowSize;
        lossSum = (lossSum * (windowSize - 1) + Math.max(0, -change)) / windowSize;
      }
      const rs = lossSum === 0 ? 100 : gainSum / lossSum;
      values.push(100 - 100 / (1 + rs));
    }
    return [null, ...values];
  })();

  const ma20 = movingAverage(20);
  const ma50 = movingAverage(50);
  const formatVolume = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return `${Math.round(value)}`;
  };

  const allEvents = useMemo(() => {
    if (points.length === 0) return [];
    const events: {
      id: string;
      index: number;
      category: "momentum" | "volume" | "risk";
      title: string;
      value: string;
      explanation: string;
    }[] = [];
    const pushEvent = (
      index: number,
      category: "momentum" | "volume" | "risk",
      title: string,
      value: string,
      explanation: string,
    ) => {
      events.push({
        id: `${title}-${index}-${category}`,
        index,
        category,
        title,
        value,
        explanation,
      });
    };

    for (let i = 1; i < points.length; i += 1) {
      const currentRsi = rsi[i];
      const prevRsi = rsi[i - 1];
      if (currentRsi !== null && prevRsi !== null) {
        if (prevRsi < 70 && currentRsi >= 70) {
          pushEvent(
            i,
            "momentum",
            "RSI crossed 70",
            `RSI ${currentRsi.toFixed(1)}`,
            "RSI moved into the overbought band.",
          );
        }
        if (prevRsi > 30 && currentRsi <= 30) {
          pushEvent(
            i,
            "momentum",
            "RSI crossed 30",
            `RSI ${currentRsi.toFixed(1)}`,
            "RSI moved into the oversold band.",
          );
        }
      }
    }

    const volumeWindow = 20;
    for (let i = volumeWindow; i < points.length; i += 1) {
      const window = points.slice(i - volumeWindow, i);
      const baseline = window
        .map((p) => p.volume)
        .filter((v): v is number => v !== null && v !== undefined);
      if (!baseline.length) continue;
      const avg = baseline.reduce((acc, v) => acc + v, 0) / baseline.length;
      const volume = points[i].volume ?? null;
      if (volume && avg > 0 && volume / avg >= 1.8) {
        pushEvent(
          i,
          "volume",
          "Volume spike",
          `Vol ${formatVolume(volume)} (${(volume / avg).toFixed(1)}x)`,
          "Volume jumped vs the 20-day baseline.",
        );
      }
    }

    const momentumWindow = 20;
    let prevRegime: "positive" | "negative" | null = null;
    for (let i = momentumWindow; i < points.length; i += 1) {
      const base = points[i - momentumWindow]?.close ?? null;
      if (!base) continue;
      const mom = (points[i].close - base) / base;
      const regime = mom >= 0 ? "positive" : "negative";
      if (prevRegime && prevRegime !== regime) {
        pushEvent(
          i,
          "momentum",
          "Momentum regime shift",
          `20D ${(mom * 100).toFixed(1)}%`,
          `Momentum flipped ${regime}.`,
        );
      }
      prevRegime = regime;
    }

    for (let i = 1; i < points.length; i += 1) {
      if (ma20[i] !== null && ma20[i - 1] !== null) {
        const prev = points[i - 1].close - (ma20[i - 1] as number);
        const curr = points[i].close - (ma20[i] as number);
        if (prev <= 0 && curr > 0) {
          pushEvent(
            i,
            "momentum",
            "Price crossed MA20",
            `Close ${points[i].close.toFixed(2)} | MA20 ${(ma20[i] as number).toFixed(2)}`,
            "Price moved above the 20-day average.",
          );
        }
        if (prev >= 0 && curr < 0) {
          pushEvent(
            i,
            "momentum",
            "Price crossed MA20",
            `Close ${points[i].close.toFixed(2)} | MA20 ${(ma20[i] as number).toFixed(2)}`,
            "Price fell below the 20-day average.",
          );
        }
      }
      if (ma50[i] !== null && ma50[i - 1] !== null) {
        const prev = points[i - 1].close - (ma50[i - 1] as number);
        const curr = points[i].close - (ma50[i] as number);
        if (prev <= 0 && curr > 0) {
          pushEvent(
            i,
            "momentum",
            "Price crossed MA50",
            `Close ${points[i].close.toFixed(2)} | MA50 ${(ma50[i] as number).toFixed(2)}`,
            "Price moved above the 50-day average.",
          );
        }
        if (prev >= 0 && curr < 0) {
          pushEvent(
            i,
            "momentum",
            "Price crossed MA50",
            `Close ${points[i].close.toFixed(2)} | MA50 ${(ma50[i] as number).toFixed(2)}`,
            "Price fell below the 50-day average.",
          );
        }
      }
    }

    const pivotWindow = 3;
    for (let i = pivotWindow; i < points.length - pivotWindow; i += 1) {
      const slice = points.slice(i - pivotWindow, i + pivotWindow + 1).map((p) => p.close);
      const max = Math.max(...slice);
      const min = Math.min(...slice);
      if (points[i].close === max) {
        pushEvent(
          i,
          "momentum",
          "Local high",
          `High ${points[i].close.toFixed(2)}`,
          "Local peak over the surrounding sessions.",
        );
      }
      if (points[i].close === min) {
        pushEvent(
          i,
          "momentum",
          "Local low",
          `Low ${points[i].close.toFixed(2)}`,
          "Local trough over the surrounding sessions.",
        );
      }
    }

    if (points.length > 0) {
      let peak = points[0].close;
      let maxDrawdown = 0;
      let maxDrawdownIndex = 0;
      for (let i = 0; i < points.length; i += 1) {
        if (points[i].close > peak) {
          peak = points[i].close;
        }
        const drawdown = (points[i].close - peak) / peak;
        if (drawdown < maxDrawdown) {
          maxDrawdown = drawdown;
          maxDrawdownIndex = i;
        }
      }
      if (maxDrawdownIndex > 0) {
        pushEvent(
          maxDrawdownIndex,
          "risk",
          "Max drawdown",
          `Drawdown ${(maxDrawdown * 100).toFixed(1)}%`,
          "Largest peak-to-trough decline in this range.",
        );
      }
    }

    return events;
  }, [points, rsi, ma20, ma50]);

  const visibleEvents = useMemo(() => {
    if (!showEvents) return [];
    const filtered = allEvents.filter((event) => {
      if (event.category === "momentum" && !eventFilters.momentum) return false;
      if (event.category === "volume" && !eventFilters.volume) return false;
      if (event.category === "risk" && !eventFilters.risk) return false;
      return true;
    });
    const minGap = Math.max(2, Math.floor(points.length / 80));
    const sorted = filtered.sort((a, b) => a.index - b.index);
    const output: typeof filtered = [];
    let lastIndex = -Infinity;
    for (const event of sorted) {
      if (event.title === "Max drawdown") {
        output.push(event);
        lastIndex = event.index;
        continue;
      }
      if (event.index - lastIndex >= minGap) {
        output.push(event);
        lastIndex = event.index;
      }
    }
    return output;
  }, [allEvents, showEvents, eventFilters, points.length]);

  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;
  const hoverX = hoverIndex !== null ? scaleX(hoverIndex) : null;
  const hoverY = hoverPoint ? scaleY(hoverPoint.close) : null;
  const tooltipFlip = hoverX !== null && hoverX > width - 220;

  const renderLine = (linePoints: { x: number; y: number }[], stroke: string) =>
    linePoints.length > 0 ? (
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.8"
        points={linePoints.map((p) => `${p.x},${p.y}`).join(" ")}
      />
    ) : null;

  const ma20Line =
    showMA20 && ma20.length
      ? ma20
          .map((value, idx) => (value === null ? null : { x: scaleX(idx), y: scaleY(value) }))
          .filter((p): p is { x: number; y: number } => Boolean(p))
      : [];
  const ma50Line =
    showMA50 && ma50.length
      ? ma50
          .map((value, idx) => (value === null ? null : { x: scaleX(idx), y: scaleY(value) }))
          .filter((p): p is { x: number; y: number } => Boolean(p))
      : [];

  const benchmarkLine =
    benchmarkSeries && benchmarkSeries.points.length === points.length
      ? benchmarkSeries.points.map((p, idx) => ({ x: scaleX(idx), y: scaleY(p.close) }))
      : [];

  const rsiScaleY = (v: number) =>
    chartHeight + rsiHeight - 20 - (v / 100) * (rsiHeight - 40);

  if (!primarySeries || points.length === 0) return null;

  return (
    <div className="chart-modal-chart">
      <div className="chart-stage" ref={containerRef}>
        <svg
          width={width}
          height={height}
          onMouseMove={(event) => {
            if (points.length === 0) return;
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const x = event.clientX - rect.left;
            const ratio = (x - padding) / Math.max(width - padding * 2, 1);
            const index = Math.min(
              points.length - 1,
              Math.max(0, Math.round(ratio * (points.length - 1))),
            );
            setHoverIndex(index);
          }}
          onMouseLeave={() => {
            setHoverIndex(null);
            setEventHover(null);
          }}
        >
          <rect x={0} y={0} width={width} height={height} fill="transparent" />
          <line
            x1={padding}
            y1={chartHeight - padding}
            x2={width - padding}
            y2={chartHeight - padding}
            stroke="rgba(148,163,184,0.3)"
            strokeWidth={1}
          />
          <line
            x1={padding}
            y1={padding}
            x2={padding}
            y2={chartHeight - padding}
            stroke="rgba(148,163,184,0.3)"
            strokeWidth={1}
          />
          {renderLine(
            points.map((p, idx) => ({ x: scaleX(idx), y: scaleY(p.close) })),
            "#38bdf8",
          )}
          {benchmarkLine.length > 0 ? renderLine(benchmarkLine, "rgba(148,163,184,0.6)") : null}
          {renderLine(ma20Line, "rgba(34,197,94,0.9)")}
          {renderLine(ma50Line, "rgba(250,204,21,0.9)")}
          {hoverX !== null && hoverY !== null ? (
            <>
              <line
                x1={hoverX}
                y1={padding}
                x2={hoverX}
                y2={chartHeight - padding}
                stroke="rgba(226,232,240,0.5)"
                strokeDasharray="4 4"
              />
              <line
                x1={padding}
                y1={hoverY}
                x2={width - padding}
                y2={hoverY}
                stroke="rgba(226,232,240,0.35)"
                strokeDasharray="4 4"
              />
              <circle cx={hoverX} cy={hoverY} r={4} fill="#38bdf8" />
            </>
          ) : null}
          {visibleEvents.map((event) => {
            const point = points[event.index];
            if (!point) return null;
            const x = scaleX(event.index);
            const y = scaleY(point.close);
            const markerClass = `chart-event-marker event-${event.category}`;
            return (
              <g
                key={event.id}
                onMouseEnter={() => setEventHover(event)}
                onMouseLeave={() => setEventHover(null)}
              >
                {event.category === "risk" ? (
                  <polygon
                    points={`${x},${y - 5} ${x - 5},${y + 4} ${x + 5},${y + 4}`}
                    className={markerClass}
                  />
                ) : (
                  <circle cx={x} cy={y} r={4} className={markerClass} />
                )}
              </g>
            );
          })}
          {showRSI ? (
            <>
              <line
                x1={padding}
                y1={chartHeight + 10}
                x2={width - padding}
                y2={chartHeight + 10}
                stroke="rgba(148,163,184,0.2)"
              />
              <line
                x1={padding}
                y1={chartHeight + rsiHeight - 10}
                x2={width - padding}
                y2={chartHeight + rsiHeight - 10}
                stroke="rgba(148,163,184,0.2)"
              />
              {renderLine(
                rsi
                  .map((value, idx) =>
                    value === null ? null : { x: scaleX(idx), y: rsiScaleY(value) },
                  )
                  .filter((p): p is { x: number; y: number } => Boolean(p)),
                "rgba(244,114,182,0.9)",
              )}
              <line
                x1={padding}
                y1={rsiScaleY(70)}
                x2={width - padding}
                y2={rsiScaleY(70)}
                stroke="rgba(248,113,113,0.4)"
                strokeDasharray="6 4"
              />
              <line
                x1={padding}
                y1={rsiScaleY(30)}
                x2={width - padding}
                y2={rsiScaleY(30)}
                stroke="rgba(34,197,94,0.4)"
                strokeDasharray="6 4"
              />
              {hoverX !== null && hoverIndex !== null && rsi[hoverIndex] ? (
                <circle cx={hoverX} cy={rsiScaleY(rsi[hoverIndex] as number)} r={3} fill="#f472b6" />
              ) : null}
            </>
          ) : null}
        </svg>
      </div>
      {hoverPoint && !eventHover ? (
        <div
          className={`chart-tooltip${tooltipFlip ? " flip" : ""}`}
          style={{ left: hoverX ?? 0, top: hoverY ?? 0 }}
        >
          <div className="chart-tooltip-title">{hoverPoint.date}</div>
          <div>Close: {hoverPoint.close.toFixed(2)}</div>
          <div>
            Open:{" "}
            {hoverPoint.open !== null && hoverPoint.open !== undefined
              ? hoverPoint.open.toFixed(2)
              : "-"}
          </div>
          <div>
            High:{" "}
            {hoverPoint.high !== null && hoverPoint.high !== undefined
              ? hoverPoint.high.toFixed(2)
              : "-"}
          </div>
          <div>
            Low:{" "}
            {hoverPoint.low !== null && hoverPoint.low !== undefined
              ? hoverPoint.low.toFixed(2)
              : "-"}
          </div>
          <div>Volume: {hoverPoint.volume ? formatVolume(hoverPoint.volume) : "-"}</div>
        </div>
      ) : null}
      {eventHover && points[eventHover.index] ? (
        <div
          className={`chart-event-tooltip event-${eventHover.category}${
            tooltipFlip ? " flip" : ""
          }`}
          style={{
            left: scaleX(eventHover.index),
            top: scaleY(points[eventHover.index].close),
          }}
        >
          <div className="chart-tooltip-title">{eventHover.title}</div>
          <div>{points[eventHover.index].date}</div>
          <div>{eventHover.value}</div>
          <div className="chart-tooltip-note">{eventHover.explanation}</div>
        </div>
      ) : null}
      <div className="chart-legend">
        <span className="legend-item legend-price">Price</span>
        {showMA20 ? <span className="legend-item legend-ma20">MA20</span> : null}
        {showMA50 ? <span className="legend-item legend-ma50">MA50</span> : null}
        {benchmarkLine.length > 0 ? (
          <span className="legend-item legend-benchmark">Benchmark</span>
        ) : null}
        {showRSI ? <span className="legend-item legend-rsi">RSI 14</span> : null}
      </div>
    </div>
  );
}
export default App;



























































