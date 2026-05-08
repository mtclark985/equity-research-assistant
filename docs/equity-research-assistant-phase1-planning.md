# Equity Research Assistant — Phase 1 Planning Artifacts

**Project:** Equity Research Assistant (portfolio piece)
**Owner:** Michael
**Phase:** 1 (single Claude call, no subagents, no persistence)
**Date saved:** 2026-05-08

---

## Overview

This document captures the four planning artifacts produced before opening Claude Code for the Phase 1 build. It is the source of truth for the data contracts, prompt, and database schema. If anything in the codebase drifts from this document, this document wins until deliberately updated.

**Phase 1 scope:**
1. Input: stock ticker
2. Fetch: latest 10-K key financials from EDGAR
3. Fetch: 5-year price history from FMP
4. Fetch: analyst estimates from FMP
5. Fetch: 2-3 FRED macro series (Fed Funds, 10Y Treasury, Unemployment)
6. Single Claude call producing a structured research memo
7. React UI displaying the memo with source attribution

**Out of Phase 1:** Subagents, Supabase persistence, charts, peer comparisons, recommendations.

---

## Artifact 1 — Input context object schema

This is the JSON shape that the fetch layer assembles and hands to Claude.

```json
{
  "ticker": "AAPL",
  "company_name": "Apple Inc.",
  "sector": "Technology",
  "industry": "Consumer Electronics",
  "as_of_date": "2026-05-08",
  "fundamentals": {
    "source": "SEC EDGAR",
    "fiscal_year_end": "2025-09-27",
    "revenue": 391035000000,
    "net_income": 93736000000,
    "total_assets": 364980000000,
    "total_debt": 106629000000,
    "operating_cash_flow": 118254000000,
    "shares_outstanding": 15115823000
  },
  "price_history": {
    "source": "Financial Modeling Prep",
    "start_date": "2021-05-08",
    "end_date": "2026-05-07",
    "current_price": 198.45,
    "fifty_two_week_high": 237.49,
    "fifty_two_week_low": 164.08,
    "monthly_closes": [
      { "date": "2021-05-31", "close": 124.61 },
      { "date": "2021-06-30", "close": 136.96 }
    ]
  },
  "estimates": {
    "source": "Financial Modeling Prep",
    "next_fy_revenue_estimate": 410000000000,
    "next_fy_eps_estimate": 7.25,
    "analyst_price_target_avg": 215.50,
    "analyst_count": 42
  },
  "macro": {
    "source": "FRED",
    "as_of_date": "2026-05-01",
    "fed_funds_rate": 4.25,
    "ten_year_treasury": 4.18,
    "unemployment_rate": 4.1
  },
  "sources": [
    {
      "label": "Apple Inc. 10-K (FY2025)",
      "url": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000320193&type=10-K",
      "retrieved_at": "2026-05-08T14:32:00Z"
    },
    {
      "label": "FMP Historical Prices",
      "url": "https://financialmodelingprep.com/api/v3/historical-price-full/AAPL",
      "retrieved_at": "2026-05-08T14:32:01Z"
    },
    {
      "label": "FRED Series: FEDFUNDS, DGS10, UNRATE",
      "url": "https://fred.stlouisfed.org/",
      "retrieved_at": "2026-05-08T14:32:02Z"
    }
  ]
}
```

**Design notes:**
- Every data section has a `source` field for traceability
- Numbers are raw (not formatted strings) so React can format on render and Claude can do math if needed
- `monthly_closes` is sampled to monthly resolution (~60 points over 5 years) to keep token cost reasonable; daily prices stay in cache for charts
- `as_of_date` at the top level timestamps every memo
- Structure is flat-ish; Claude handles flat JSON better than deeply nested

---

## Artifact 2 — Output memo schema

This is what Claude returns. The React UI renders each section independently.

```json
{
  "ticker": "AAPL",
  "as_of_date": "2026-05-08",
  "memo": {
    "thesis_label": "Constructive",
    "thesis": "2-3 sentence prose...",
    "business_overview": "...",
    "financial_highlights": "...",
    "valuation_context": "...",
    "macro_context": "...",
    "key_risks": [
      "Risk 1...",
      "Risk 2..."
    ]
  },
  "sources": [
    "passed through unchanged from input"
  ]
}
```

**Error response shape** (when input is fundamentally malformed):

```json
{
  "error": "string describing the issue",
  "ticker": "ticker from input if available, else null"
}
```

**Thesis label vocabulary (enum):**
- `Constructive` — fundamentals and macro alignment support the business
- `Neutral` — mixed signals or insufficient data to lean either way
- `Cautious` — meaningful headwinds in fundamentals or macro fit

---

## Artifact 3 — System prompt

This is the prompt that gets passed to Claude (Opus 4.7 for Phase 1) along with the input context object as the user message.

```
You are an equity research analyst writing a structured research memo for a portfolio of internal readers at a mid-sized financial institution. Your readers are finance professionals — they understand standard financial terminology, but they want clarity over jargon. They will use this memo as context for further research, not as a basis for investment decisions.

You will receive a JSON object containing fundamentals, price history, analyst estimates, macroeconomic context, and source metadata for a single publicly traded company. Your job is to produce a structured memo as a JSON object matching the exact schema below.

# INPUT CONTRACT

You will receive a JSON object with this shape:

{
  "ticker": string,
  "company_name": string,
  "sector": string,
  "industry": string,
  "as_of_date": string (ISO date),
  "fundamentals": {
    "source": string,
    "fiscal_year_end": string (ISO date),
    "revenue": number,
    "net_income": number,
    "total_assets": number,
    "total_debt": number,
    "operating_cash_flow": number,
    "shares_outstanding": number
  },
  "price_history": {
    "source": string,
    "start_date": string,
    "end_date": string,
    "current_price": number,
    "fifty_two_week_high": number,
    "fifty_two_week_low": number,
    "monthly_closes": array of { "date": string, "close": number }
  },
  "estimates": {
    "source": string,
    "next_fy_revenue_estimate": number,
    "next_fy_eps_estimate": number,
    "analyst_price_target_avg": number,
    "analyst_count": number
  },
  "macro": {
    "source": string,
    "as_of_date": string,
    "fed_funds_rate": number,
    "ten_year_treasury": number,
    "unemployment_rate": number
  },
  "sources": array of { "label": string, "url": string, "retrieved_at": string }
}

Any field may be null, missing, or zero if the upstream data source did not return a value.

# OUTPUT CONTRACT

Return a single JSON object — and only a JSON object, with no surrounding markdown fences, commentary, or preamble — matching this exact schema:

{
  "ticker": string,
  "as_of_date": string,
  "memo": {
    "thesis_label": "Constructive" | "Neutral" | "Cautious",
    "thesis": string,
    "business_overview": string,
    "financial_highlights": string,
    "valuation_context": string,
    "macro_context": string,
    "key_risks": array of string
  },
  "sources": array (pass through unchanged from input)
}

# SECTION GUIDELINES

**thesis_label** — Choose exactly one:
- "Constructive" when fundamentals and macro environment broadly support the business
- "Neutral" when signals are mixed or insufficient data prevents a clear lean
- "Cautious" when meaningful headwinds exist in fundamentals, valuation, or macro fit

**thesis** — 2-3 sentences. State the directional view in the first sentence. Identify the single most important driver supporting your label. Do not hedge with multiple competing views; pick the dominant signal.

**business_overview** — One paragraph, 3-5 sentences. Describe what the company does, the sector and industry context, and any structural characteristics inferable from the financials (capital intensity, leverage profile, scale). Do not speculate about products or strategy beyond what the data supports.

**financial_highlights** — One paragraph, 4-6 sentences. Translate the fundamentals into prose with specific figures. Cover revenue scale, profitability (net income and implied net margin), balance sheet (total assets, debt-to-assets ratio), and cash flow quality (operating cash flow vs. net income). Call out anything notable: unusually high or low margins for the sector, leverage outliers, divergence between earnings and cash flow.

**valuation_context** — One paragraph, 3-4 sentences. Position the current price within the 52-week range. Compare to the analyst price target average and state implied upside or downside as a percentage. If forward estimates are available, note the implied revenue growth rate. This is context, not a recommendation — do not say "buy," "sell," "overvalued," or "undervalued."

**macro_context** — One paragraph, 3-4 sentences. Connect the current rate environment, employment picture, and yield curve to this specific company's business model. The relevance varies by sector: rates matter heavily for banks and REITs, less for software or consumer staples. Explicitly acknowledge when macro is a low-impact factor for the business rather than forcing a connection.

**key_risks** — Array of 3-5 strings, each 1-2 sentences. Mix company-specific risks (concentration, leverage, margin pressure, cash flow quality) with macro risks (rate sensitivity, cyclical exposure, employment-driven demand). Frame each risk concretely with reference to the data, not generically.

# GOVERNANCE RULES

1. **Missing data policy.** If any input field is null, missing, zero, or otherwise unavailable, explicitly state in the relevant section that the data was unavailable. Do not estimate, infer from general knowledge, or substitute plausible-sounding values. Example: "Forward revenue estimates were not available from the data provider, so implied growth cannot be calculated."

2. **No investment advice.** Do not recommend buying, selling, or holding the security. Do not state a price target. The thesis label and thesis prose describe the analytical view, not an action.

3. **Numeric precision.** Round revenue, net income, assets, and debt to the nearest billion when written in prose ("$391B"). Round prices to two decimals ("$198.45"). Round percentages to one decimal ("4.2%"). Use the raw numbers from the input — do not recalculate or adjust.

4. **Source grounding.** Every quantitative claim in the memo should be traceable to a field in the input JSON. Do not introduce facts, figures, or events not present in the input.

5. **Tone.** Direct, professional, and concise. Active voice. No filler phrases like "It is worth noting that" or "Importantly." Do not use emojis or exclamation marks.

# WORKED EXAMPLE

Given input (abbreviated for clarity):

{
  "ticker": "JPM",
  "company_name": "JPMorgan Chase & Co.",
  "sector": "Financial Services",
  "industry": "Banks - Diversified",
  "as_of_date": "2026-05-08",
  "fundamentals": {
    "revenue": 158104000000,
    "net_income": 49552000000,
    "total_assets": 3875000000000,
    "total_debt": 425000000000,
    "operating_cash_flow": 35200000000
  },
  "price_history": {
    "current_price": 218.40,
    "fifty_two_week_high": 232.50,
    "fifty_two_week_low": 178.20
  },
  "estimates": {
    "analyst_price_target_avg": 235.00,
    "next_fy_revenue_estimate": 165000000000
  },
  "macro": {
    "fed_funds_rate": 4.25,
    "ten_year_treasury": 4.18,
    "unemployment_rate": 4.1
  }
}

Expected output:

{
  "ticker": "JPM",
  "as_of_date": "2026-05-08",
  "memo": {
    "thesis_label": "Constructive",
    "thesis": "Constructive view on JPMorgan supported by sustained net income strength and a rate environment that continues to support net interest margins. The bank's scale and diversification provide a buffer against any single business line softening.",
    "business_overview": "JPMorgan Chase operates in the Financial Services sector as a diversified bank, with $3.9T in total assets making it the largest U.S. bank by balance sheet size. The business spans consumer banking, investment banking, asset management, and commercial banking, providing revenue diversification across credit cycles. The capital-intensive balance sheet and $425B in total debt are characteristic of the banking model rather than indicators of stress.",
    "financial_highlights": "Revenue of $158B and net income of $50B in the most recent fiscal year imply a net margin of approximately 31%, reflecting the operating leverage of a scaled banking franchise. Total assets of $3.9T against $425B in total debt indicate a debt-to-assets ratio of 11%, in line with peer banks. Operating cash flow of $35B runs below net income, which is typical for banks where earnings include non-cash items tied to loan loss provisioning and trading gains.",
    "valuation_context": "JPM trades at $218.40, in the upper half of its 52-week range of $178-$233. The analyst price target average of $235 implies approximately 7.6% upside from current levels. Forward revenue estimates of $165B suggest 4.4% growth over the most recent fiscal year, consistent with mature large-bank growth profiles.",
    "macro_context": "With the Fed Funds Rate at 4.25% and the 10-year Treasury at 4.18%, the yield curve is roughly flat — a mixed setup for banks, supportive of net interest margins on new loans but limiting the carry trade benefit of borrowing short to lend long. Unemployment at 4.1% remains supportive of credit quality, reducing the likelihood of a near-term spike in loan loss provisions.",
    "key_risks": [
      "Rate sensitivity cuts both ways: a sharp Fed easing cycle would compress net interest margins faster than asset repricing can offset.",
      "Credit cycle exposure: while unemployment at 4.1% is benign today, any deterioration would flow through provisions and earnings with a one-to-two quarter lag.",
      "Capital markets revenue volatility: investment banking and trading lines are inherently lumpy and drove a meaningful portion of the $50B net income figure.",
      "Regulatory capital requirements may tighten further, constraining buyback capacity and weighing on per-share metrics."
    ]
  },
  "sources": [pass through from input]
}

# FINAL INSTRUCTIONS

Read the input JSON carefully. Apply the section guidelines and governance rules. Return only the output JSON object — no markdown fences, no preamble, no commentary. If you cannot produce a valid memo because the input is fundamentally malformed (not just missing fields), return:

{
  "error": "string describing the issue",
  "ticker": "ticker from input if available, else null"
}
```

---

## Artifact 4 — Supabase schema (designed in Phase 1, implemented in Phase 2)

Four tables. Phase 1 does not need persistence; this schema is here so when Phase 2 begins, the design is already settled.

### `research_runs`
One row per ticker analysis. The audit trail and the basis for a "research history" view.

| Column | Type | Notes |
|---|---|---|
| id | uuid (pk) | |
| ticker | text | |
| created_at | timestamptz | |
| user_id | uuid (nullable) | Nullable for Phase 1 (no auth yet) |
| memo_markdown | text | The full memo, stored as markdown for portability |
| memo_json | jsonb | The structured memo object, for section-level rendering |
| model_used | text | e.g., "claude-opus-4-7" |
| status | text | 'pending' / 'complete' / 'error' |
| error_message | text (nullable) | Populated if status = 'error' |

### `fundamentals_cache`
Keyed on (ticker, fiscal_period, source). Stores raw API responses so re-parsing doesn't require re-fetching.

| Column | Type | Notes |
|---|---|---|
| id | uuid (pk) | |
| ticker | text | |
| period_end_date | date | |
| source | text | 'edgar' or 'fmp' |
| raw_json | jsonb | Full API response |
| fetched_at | timestamptz | |

Unique constraint on (ticker, period_end_date, source).

### `macro_cache`
Keyed on (series_id, observation_date). FRED data is small and cheap to cache aggressively.

| Column | Type | Notes |
|---|---|---|
| id | uuid (pk) | |
| series_id | text | e.g., 'FEDFUNDS', 'DGS10', 'UNRATE' |
| observation_date | date | |
| value | numeric | |
| fetched_at | timestamptz | |

Unique constraint on (series_id, observation_date).

### `sources_cited`
Child table of research_runs. Makes the "sources cited" feature auditable.

| Column | Type | Notes |
|---|---|---|
| id | uuid (pk) | |
| run_id | uuid (fk -> research_runs.id) | |
| source_type | text | 'edgar' / 'fmp' / 'fred' |
| source_url | text | |
| source_label | text | Human-readable label for the citations panel |
| retrieved_at | timestamptz | |

**Why this design:**
- Cache tables are separate from the run table so you can rerun an analysis on cached data (fast, free, deterministic for demos) or force a refresh
- Storing raw API responses (not parsed fields) means upstream schema changes don't break history
- `memo_markdown` and `memo_json` both stored — markdown for portability/export, JSON for structured rendering
- `sources_cited` as a child table instead of an array column makes it queryable ("show me all runs that cited FRED data")

---

## Decisions log

For future-me reading this in three weeks: the four hardest decisions made during planning, and why.

1. **EDGAR for fundamentals, not FMP.** EDGAR is the primary source and reads stronger on a portfolio piece. FMP free tier doubles as the price and estimates source.

2. **Seven-section memo with JSON-per-section output.** Free-form markdown was the alternative; rejected because it makes section-level rendering and Phase 2 features (e.g., "show me just the risks across my last 10 analyses") much harder.

3. **Directional thesis label as a defined enum.** Three values: Constructive / Neutral / Cautious. Forces sharper writing and makes UI rendering trivial.

4. **Explicit missing-data policy in the prompt.** This is the single most important governance instruction. Without it, Claude hallucinates plausible-sounding numbers for missing fields, which is the worst possible failure mode for a portfolio piece a hiring manager might spot-check.

---

## Build sequence in Claude Code

1. Scaffold the project skeleton (Vite + React, folder structure, env template, gitignore, README stub). Push to GitHub before writing real logic.
2. Build the Vercel serverless function for Anthropic. Test with a hardcoded ticker and hand-written context JSON.
3. Build the fetch layer one source at a time: EDGAR first, then FMP, then FRED. Each gets its own module. Test in isolation.
4. Build the orchestrator that calls all three fetchers in parallel, assembles the context object, calls the Claude proxy, and returns the memo.
5. Build the React UI: ticker input, loading state, memo display with seven sections, sources panel, error state.
6. Deploy to Vercel and run on five tickers spanning sectors (bank, tech, consumer staple, REIT, industrial).

Skip Supabase entirely in Phase 1.

---

## Known gotchas to expect

- **EDGAR Company Facts API has inconsistent field naming across companies.** Apple uses `Revenues`; some companies use `RevenueFromContractWithCustomerExcludingAssessedTax`; banks use `InterestAndDividendIncomeOperating`. Need a small lookup table or fallback chain.
- **EDGAR requires a descriptive User-Agent header** with contact info, server-side only to avoid exposing the contact email in the browser.
- **FMP free tier is 250 calls/day.** Cache aggressively to local files during development (`.cache/` folder, gitignored) so test runs don't burn quota.
- **Claude occasionally returns JSON wrapped in markdown fences** despite instructions otherwise. Strip ```json and ``` before parsing.
- **The first memo will feel underwhelming.** Plan for one round of prompt tuning after the end-to-end works on 5 tickers.
