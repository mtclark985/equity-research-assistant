# Ally Financial IR Command Center

A single-file, self-contained executive dashboard (React artifact) for the Chief Financial Planning & Investor Relations Officer of Ally Financial (NYSE: ALLY). It is the morning glance-screen: how the Street sees Ally *right now*.

**Deliverable:** [`AllyIRCommandCenter.jsx`](./AllyIRCommandCenter.jsx) — one React component, no external dependencies beyond React itself. All styling is inline; sparklines and the sentiment gauge are hand-rolled SVG.

## How it works

1. **First paint is always complete.** Every panel renders from a seeded baseline snapshot — Ally's Q1 2026 results, reported April 17, 2026 (adjusted EPS $1.11 vs $0.94 consensus, NIM ex-OID 3.52%, core ROTCE 11.1% vs mid-teens target, deposits $153.2B, TBVPS $40.93, etc.).
2. **Live data overlays on top.** On mount (and via the Refresh button) the component calls the **Anthropic API from inside the artifact** — `fetch("https://api.anthropic.com/v1/messages")` with the `web_search` tool enabled. In the Claude.ai artifact sandbox this requires **no API key**; the request is proxied and handled for you. One structured-JSON call pulls: current price/day change/market cap/P/E/52-week range, analyst targets and rating changes, the 6–10 latest ALLY headlines (each with a one-line "why it matters for IR" and sentiment tag), a Bullish/Neutral/Bearish sentiment read with drivers, Street watch-items, and the IR calendar.
3. **Every figure is tagged** — `Live` (with source + timestamp), `Last reported (Q1'26)`, `Derived`, or `Model-synthesized` — and the math (implied upside, rating distribution) is computed in code, not by the model.
4. **Graceful degradation.** If the search call fails, an amber notice appears and the dashboard stays on the reported baseline.

## Run it

**As a Claude.ai artifact (intended environment):** paste the contents of `AllyIRCommandCenter.jsx` into a Claude conversation and ask Claude to render it as a React artifact — or attach the file and ask Claude to "render this as an artifact." The no-key Anthropic API call only works inside the artifact sandbox.

**Anywhere else** (Vite, Next.js, CodeSandbox): the component renders fully on baseline data, but the live fetch will fail (CORS + missing API key) and the dashboard will show the fallback notice. To make live data work outside the sandbox, route the call through a server-side proxy that adds your `x-api-key` (the same pattern as this repo's `api/claude.js`).

## ⚠️ Model deprecation

The spec pins `claude-sonnet-4-20250514`, which **retires June 15, 2026**. After that date the live fetch will 404 (the dashboard will still render on baseline). The fix is a one-line swap at the top of the file:

```js
const MODEL = "claude-sonnet-4-6";
```

## Honest-data notes

- Sparklines show **directional 5-quarter paths** consistent with reported YoY deltas, not verified quarterly history — a footnote in the scorecard says so.
- Fields the baseline can't honestly seed (day change, 52-week range, price targets, headlines) render as "pending live pull" rather than invented numbers.
- The sentiment dial is explicitly labeled a **model-synthesized read** of analyst-note and headline tone, not a quantitative index.
