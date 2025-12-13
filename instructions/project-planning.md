# Agentic Stock Scout - Product Plan

## Target Users
- **Self-directed retail investors** who hold a handful of U.S. equities/ETFs and want proactive, time-horizon-aware guidance.
- **Newer investors** with starter portfolios who need help spotting concentration risk and diversification opportunities.
- **Side-hustle traders** seeking quick, explainable signals across many tickers without managing complex tools.

## Core Experience
- **Manual portfolio capture**: simple add/edit/remove of tickers, quantities, and cost basis; CSV import for faster onboarding; optional watchlist separate from holdings.
- **Multi-horizon recommendations** powered by agentic AI:
  - **Short term (days-weeks)**: earnings/volatility catalysts, momentum shifts, and stop/trim suggestions.
  - **Medium term (quarters)**: valuation drift vs. peers, factor exposures, capital efficiency trends, and sector rotation ideas.
  - **Long term (years)**: moat/durability signals, balance-sheet quality, cash-flow stability, and position sizing guidance.
- **Broad market scan**: daily sweep of a wide ticker universe to surface “interesting” candidates relevant to the user’s positions and watchlist.
- **Contextual explanations**: each recommendation includes the evidence trail, confidence, and what to monitor next.
- **Risk awareness**: concentration flags, drawdown exposure, and correlation hints with simple what-if tiles.

## Agentic AI Approach
- **Planner/critic loop**: orchestrator decomposes the user goal (e.g., “find short-term trims”) into data pulls, factor checks, and scoring; critic evaluates coverage and conflict before emitting recs.
- **Retrieval and enrichment**: combine fundamentals, consensus estimates, technical indicators, and event data; normalize to comparable factors.
- **Persona grounding**: user risk appetite and horizon preferences shape prompts and thresholds.
- **Transparency**: show rationale, data freshness, and which tools/skills the agent used.

## MVP (6-10 weeks)
- **Goal**: validate that manually-entered portfolios receive trusted, horizon-tagged recommendations that users open and act on.
- **Scope**:
  - Manual holdings + watchlist with CSV import.
  - Daily market sweep (e.g., top 2–3k U.S. tickers) feeding a candidate pool.
  - Recommendation engine producing 3–7 recs per horizon, per user, with explanations and freshness stamps.
  - Basic risk tiles: concentration, beta/volatility bands, and simple correlation to market proxy.
  - Feedback loop: thumbs up/down and “follow this idea” to refine future outputs.
- **Deferred**: brokerage linking, automated trades, tax analysis, advisor collaboration, mobile app, deep backtests.

## Success Criteria
- **Adoption**: ≥70% of new users complete manual portfolio entry within first session; ≥50% import via CSV when offered.
- **Engagement**: ≥60% open daily recommendation digest; ≥25% save or follow at least one idea/week.
- **Quality**: ≥40% positive feedback on recs (thumbs up); <5% flagged as irrelevant to user holdings/watchlist.
- **Reliability**: recommendation job success ≥99%; data freshness <24h for fundamentals/technicals feeds.

## Functional Scope (MVP backlog)
- **Portfolio input/management**: add/edit/remove tickers with quantities and cost basis; CSV upload with validation; watchlist separate from holdings; persistence in relational DB.
- **Recommendation engine**: daily candidate sweep, factor scoring per horizon, ranking, and rationale assembly with freshness stamps; tag ideas to applicable user holdings/watchlist entries.
- **Delivery surfaces**: in-app dashboard with rec cards, saved ideas, and risk tiles; daily email/web digest toggle; horizon filters and sort by confidence/recency.
- **Feedback loop**: thumbs up/down, “follow this idea,” and dismiss; store signals to influence future scores and to audit perceived quality.
- **Governance**: data provenance display (source + timestamp), quota-aware data pulls, retries with backoff, and alerting on stale data or failed sweeps.
- **Non-goals (now)**: brokerage integration, automated trading/tax views, mobile app, deep backtesting, or social/advisor sharing.

## Technology Choices (MVP-ready)
- **Frontend**: Next.js (React/TypeScript) for fast iteration, hydration-friendly dashboards, and Vercel-friendly deploys; UI kit such as Chakra/MUI for accessibility; Recharts (or Lightweight Charts) for price visualizations; React Query for data fetching/cache.
- **Backend**: FastAPI (Python) for tight integration with data/ML tooling **or** NestJS (TypeScript) for monolingual stack; async task queue (Celery/RabbitMQ or BullMQ/Redis) to run market sweeps and scoring jobs; Postgres for users/holdings/recs; Redis for queues + short-lived factors.
- **Data feeds**: Price/technicals from Polygon/IEX/Alpha Vantage; fundamentals/estimates via Financial Modeling Prep or similar; optional news/events (Finnhub/NewsAPI) if we add catalyst surfacing.
- **Agent runtime**: LangGraph (or similar agent framework) to model planner/critic graph; tools for data fetch, factor scoring, critique, ranking, and explanation assembly; embedding store (PGVector) for retrieval of company notes and previous rationales.
- **Infra**: Dockerized services; GitHub Actions for CI/CD (tests, lint, type checks); Observability via OpenTelemetry traces/metrics exported to Grafana/Prometheus; feature flags/config via environment + Git-backed configuration (e.g., Doppler/SOPS) for data keys.

### Technology Rationale & Guardrails
- **Why this stack**: keeps the web and API layer TypeScript-friendly while enabling Python-first data/agent work; all choices have strong community support and hosted options for speed.
- **Data governance**: secrets in managed store (e.g., Doppler/1Password); strict API quota tracking; schema versioning in Postgres via migrations (Alembic/Prisma).
- **Reliability**: idempotent tasks with dedupe keys per sweep window; circuit breakers around external data; health checks on data staleness.
- **Observability of agents**: log tool inputs/outputs, latency, and coverage metrics per horizon; persist rationales with timestamps to aid audits.

## Monetization & Pricing (post-MVP)
- **Free tier**: manual portfolio, watchlist, limited daily recs, and basic risk tiles.
- **Pro subscription**: deeper scan coverage, more rec slots per horizon, premium data (fundamentals/estimates), priority refresh, and saved idea trails.
- **Advisor/Team** (later): multi-seat accounts and client books once brokerage linking exists.

## Rollout
- **Alpha**: invite-only cohort; manual QA on recommendations; tight feedback loop on clarity/trust.
- **Beta**: broaden access, add scheduled digests, instrument feedback signals, and harden agent reliability.
- **GA**: refine monetization, add mobile-friendly UX, and consider brokerage integration roadmap.

## Agent System Blueprint (draft)
- **Inputs**: user holdings + watchlist (with cost basis), user risk appetite/horizon preference, market data (prices/technicals), fundamentals/estimates, optional news/events.
- **Planner steps**:
  1) Build user context (positions, concentration, horizons, risk appetite).
  2) Fetch/refresh factors for candidate universe and relevant peer sets.
  3) For each horizon: apply horizon-specific factor checks and heuristics (volatility/catalyst for short; valuation/quality for medium; moat/cash-flow resilience for long).
  4) Rank, dedupe, and ensure coverage across user holdings/watchlist; enforce per-horizon slot counts; attach rationales + confidence.
  5) Critic pass to verify data freshness, risk balance, and horizon coverage; re-issue missing pieces.
  6) Emit rec payloads with evidence trail and monitoring suggestions.
- **Storage**: Postgres for users/holdings/recommendations/feedback; Redis for queues + cached factors; PGVector for rationale/company note retrieval.

## Delivery & Observability Plan
- **Dashboards**: rec cards with horizon tags, rationales, and confidence; risk tiles with concentration and volatility bands; “follow” list for tracked ideas.
- **Digests**: daily email or in-app digest summarizing new/updated recs and flagged risks with freshness stamps.
- **Instrumentation**: OpenTelemetry traces for agent graph steps; metrics for sweep coverage, success/failure counts, data staleness, and per-horizon latency; logs of tool inputs/outputs with redaction for PII.
- **Quality review**: weekly sample audits of rationales and coverage; feedback trends surfaced to adjust factor weights or prompts.

## Delivery Milestones (example timeline)
- **Week 1-2**: data contracts, schema design, and portfolio/watchlist UI; wire up price/fundamentals provider stubs.
- **Week 3-4**: implement candidate sweep, factor scoring, and ranking per horizon; basic dashboards; initial digest email.
- **Week 5-6**: critic loop, feedback signals, and observability (traces/metrics/logs); add risk tiles and rationale persistence.
- **Week 7-8**: harden retries/quota guards, improve explanations, and run alpha cohort; collect feedback and polish UX.