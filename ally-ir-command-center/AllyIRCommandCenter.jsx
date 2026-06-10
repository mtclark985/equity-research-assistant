import { useState, useEffect, useRef, useCallback } from "react";

// ---------------------------------------------------------------------------
// Ally Financial IR Command Center
// Morning screen for the Chief FP&A / IR Officer: how the Street sees ALLY now.
//
// Live data: in-artifact Anthropic API (no key needed in the Claude.ai artifact
// sandbox) with web_search enabled. Everything renders from the Q1'26 baseline
// snapshot first; live values overlay when the search call returns.
// ---------------------------------------------------------------------------

// claude-sonnet-4-20250514 is deprecated and retires 2026-06-15. If live
// fetches start failing with model-not-found, swap to "claude-sonnet-4-6".
const MODEL = "claude-sonnet-4-20250514";

const PURPLE = "#50104A";
const MAGENTA = "#A6248F";
const BG = "#F6F4F1";
const INK = "#23202B";
const MUTED = "#7A7385";
const HAIRLINE = "#E8E4DF";
const GREEN = "#1E7A4D";
const RED = "#B3322E";
const AMBER = "#9A6B12";

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

// --------------------------- Baseline (Q1 2026) ----------------------------
// Reported April 17, 2026. Tagged "Last reported (Q1'26)" in the UI.

const BASELINE = {
  price: 45.0,
  pe: 10.4,
  marketCapNote: "≈$13.7B", // derived: ~$45 × ~305M shares
  adjEPS: 1.11,
  adjEPSConsensus: 0.94,
  gaapEPS: 0.93,
  nim: 3.48,
  nimExOID: 3.52,
  nimYoYBps: 17,
  rotce: 11.1,
  rotceTarget: 15.0, // "mid-teens"
  effRatio: 50.8,
  tbvps: 40.93,
  depositsB: 153.2,
  assetsB: 197.3,
  consumerLoansB: 102.0,
  commercialLoansB: 37.9,
  revenueB: 2.1,
  netFinancingRevB: 1.59,
  epsFY26: 5.4,
  epsFY27: 6.0,
  nextEarnings: "~July 17, 2026 (Q2'26)",
};

// Directional 5-quarter paths (Q1'25 → Q1'26), consistent with reported YoY
// deltas — flagged as illustrative in the scorecard footnote.
const TRENDS = {
  nim: [3.31, 3.36, 3.4, 3.45, 3.48],
  rotce: [8.9, 9.5, 10.1, 10.6, 11.1],
  adjEPS: [0.58, 0.74, 0.91, 0.98, 1.11],
  tbvps: [36.7, 37.8, 38.9, 39.9, 40.93],
  deposits: [146.2, 148.6, 150.5, 152.1, 153.2],
  effRatio: [54.1, 53.0, 52.1, 51.4, 50.8],
};

const BASELINE_SENTIMENT = {
  label: "Neutral",
  score: 55,
  rationale:
    "Recovery trajectory intact after the Q1'26 adjusted EPS beat ($1.11 vs $0.94), but the Street notes the beat leaned partly on a lower tax rate. NIM progression and credit normalization remain the live debates.",
  drivers: [
    "NIM ex-OID path (3.52%, +17bps YoY) toward management's exit-rate goals",
    "Credit normalization in retail auto — pace and severity",
    "Core ROTCE bridge from 11.1% to the mid-teens target later in 2026",
    "Used-vehicle values and consumer auto demand",
  ],
};

const BASELINE_WATCH = [
  {
    topic: "Quality of the Q1 beat",
    detail:
      "Analysts flag the lower tax rate as a meaningful contributor versus pure operating upside. Be ready to bridge adjusted EPS to pre-tax, pre-provision earnings.",
  },
  {
    topic: "NIM trajectory",
    detail:
      "Ex-OID NIM of 3.52% is +17bps YoY. The Street wants the quarterly cadence to the full-year exit rate and deposit-repricing assumptions behind it.",
  },
  {
    topic: "Credit normalization",
    detail:
      "Retail auto charge-off path and reserve adequacy. Expect questions on vintage performance and whether normalization stays inside guided ranges.",
  },
  {
    topic: "ROTCE bridge to mid-teens",
    detail:
      "Core ROTCE of 11.1% vs the mid-teens target later in 2026 — analysts will press on the building blocks: NIM, fees, expense leverage, and capital.",
  },
  {
    topic: "Capital return",
    detail:
      "With TBVPS at $40.93 and capital rebuilding, buyback capacity and dividend posture are recurring questions.",
  },
];

// ------------------------------ Live fetch --------------------------------

const LIVE_PROMPT = `You are a research assistant for Ally Financial (NYSE: ALLY) investor relations. Today's date: ${new Date().toDateString()}.

Use web search to find CURRENT information, then respond with ONLY a single JSON object (no markdown fences, no commentary) matching exactly this schema:

{
  "market": {
    "price": number,            // most recent ALLY share price (USD)
    "dayChange": number,        // day change in dollars (negative if down)
    "dayChangePct": number,     // day change in percent
    "marketCap": string,        // e.g. "$13.8B"
    "pe": number,
    "week52Low": number,
    "week52High": number,
    "asOf": string,             // when the quote is from, e.g. "Jun 10, 2026 10:02 ET"
    "source": string            // where the quote came from
  },
  "analysts": {
    "meanTarget": number,
    "lowTarget": number,
    "highTarget": number,
    "ratingsBuy": number,       // count of buy/overweight ratings
    "ratingsHold": number,
    "ratingsSell": number,
    "epsFY26": number,          // current consensus FY2026 EPS
    "epsFY27": number,
    "recentActions": [          // up to 4 most recent rating/target changes
      { "firm": string, "action": string, "date": string }
    ]
  },
  "news": [                     // the 6-10 most recent ALLY news items
    {
      "headline": string,
      "source": string,
      "date": string,
      "whyItMatters": string,   // ONE line: why this matters for Ally IR
      "sentiment": "positive" | "neutral" | "negative"
    }
  ],
  "sentiment": {
    "label": "Bullish" | "Neutral" | "Bearish",
    "score": number,            // 0 = max bearish, 100 = max bullish
    "rationale": string,        // 2-3 sentences classifying the tone of recent analyst notes and headlines
    "drivers": [string]         // 3-4 key drivers (margin path, credit, capital return, auto demand, etc.)
  },
  "watchItems": [               // 3-5 things analysts are pressing on right now, framed as IR prep
    { "topic": string, "detail": string }
  ],
  "calendar": {
    "nextEarnings": string,     // next earnings date
    "events": [ { "name": string, "date": string } ]  // recent/upcoming investor conferences, up to 4
  }
}

Rules:
- Numbers must be plain JSON numbers (no "$", "%", or commas inside number fields).
- If you cannot verify a field, set it to null rather than guessing.
- Sentiment is your synthesized read of analyst-note and headline tone, not a quantitative index.
- Output the JSON object and nothing else.`;

async function fetchLiveData() {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 6000,
      messages: [{ role: "user", content: LIVE_PROMPT }],
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in response");
  return JSON.parse(match[0]);
}

// ------------------------------ Small pieces ------------------------------

function useAnimatedNumber(target, decimals = 2, duration = 700) {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef(null);

  useEffect(() => {
    if (target == null || !isFinite(target)) return;
    const from = fromRef.current ?? target;
    if (from === target) {
      setDisplay(target);
      return;
    }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (target - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  if (target == null || !isFinite(target)) return null;
  return display.toFixed(decimals);
}

function Badge({ kind, detail }) {
  const cfg = {
    live: { bg: "#E5F4EC", fg: GREEN, dot: GREEN, label: "Live" },
    reported: {
      bg: "#F1ECF4",
      fg: PURPLE,
      dot: MAGENTA,
      label: "Last reported (Q1'26)",
    },
    derived: { bg: "#FBF3E3", fg: AMBER, dot: AMBER, label: "Derived" },
    model: { bg: "#F1ECF4", fg: PURPLE, dot: MAGENTA, label: "Model-synthesized" },
  }[kind];
  return (
    <span
      title={detail || ""}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: cfg.bg,
        color: cfg.fg,
        borderRadius: 999,
        padding: "2px 9px",
        fontSize: 10.5,
        fontWeight: 600,
        fontFamily: SANS,
        letterSpacing: 0.2,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: cfg.dot,
          flexShrink: 0,
        }}
      />
      {cfg.label}
      {detail ? (
        <span style={{ fontWeight: 400, opacity: 0.85 }}>· {detail}</span>
      ) : null}
    </span>
  );
}

function Skeleton({ w = "100%", h = 14, style }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: w,
        height: h,
        borderRadius: 4,
        background:
          "linear-gradient(90deg, #ECE8E3 25%, #F6F3EF 50%, #ECE8E3 75%)",
        backgroundSize: "400px 100%",
        animation: "ally-shimmer 1.3s infinite linear",
        verticalAlign: "middle",
        ...style,
      }}
    />
  );
}

function Spark({ data, color = MAGENTA, w = 96, h = 28 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * (w - 4) + 2;
      const y = h - 3 - ((v - min) / span) * (h - 6);
      return `${x},${y}`;
    })
    .join(" ");
  const last = pts.split(" ").pop().split(",");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2.4" fill={color} />
    </svg>
  );
}

function Card({ children, style }) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 12,
        border: `1px solid ${HAIRLINE}`,
        boxShadow: "0 1px 3px rgba(35,32,43,0.06), 0 8px 24px rgba(35,32,43,0.05)",
        padding: "18px 20px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children, right }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 12,
        gap: 8,
      }}
    >
      <h2
        style={{
          fontFamily: SERIF,
          fontSize: 17,
          fontWeight: 700,
          color: PURPLE,
          margin: 0,
          letterSpacing: 0.1,
        }}
      >
        {children}
      </h2>
      {right}
    </div>
  );
}

function MetricCard({ label, value, sub, trend, badge, accent }) {
  return (
    <div
      style={{
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 10,
        padding: "12px 14px",
        background: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontFamily: SANS,
          fontSize: 11,
          fontWeight: 600,
          color: MUTED,
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 24,
            fontWeight: 700,
            color: accent || INK,
            lineHeight: 1.05,
          }}
        >
          {value}
        </div>
        {trend ? <Spark data={trend} /> : null}
      </div>
      {sub ? (
        <div style={{ fontFamily: SANS, fontSize: 11.5, color: MUTED }}>{sub}</div>
      ) : null}
      {badge}
    </div>
  );
}

function SentimentGauge({ sentiment, isLive, loading }) {
  const score = Math.max(0, Math.min(100, sentiment.score ?? 50));
  // Needle sweeps 180° from bearish (left) to bullish (right).
  const angle = -90 + (score / 100) * 180;
  const color =
    sentiment.label === "Bullish"
      ? GREEN
      : sentiment.label === "Bearish"
      ? RED
      : AMBER;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
        <svg width="190" height="108" viewBox="0 0 190 108">
          <path
            d="M 15 100 A 80 80 0 0 1 175 100"
            fill="none"
            stroke="#EEE9E3"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path
            d="M 15 100 A 80 80 0 0 1 60 31"
            fill="none"
            stroke={RED}
            strokeWidth="14"
            strokeLinecap="round"
            opacity="0.55"
          />
          <path
            d="M 70 26 A 80 80 0 0 1 120 26"
            fill="none"
            stroke={AMBER}
            strokeWidth="14"
            opacity="0.55"
          />
          <path
            d="M 130 31 A 80 80 0 0 1 175 100"
            fill="none"
            stroke={GREEN}
            strokeWidth="14"
            strokeLinecap="round"
            opacity="0.55"
          />
          <g
            style={{
              transform: `rotate(${angle}deg)`,
              transformOrigin: "95px 100px",
              transition: "transform 900ms cubic-bezier(.2,.8,.3,1)",
            }}
          >
            <line
              x1="95"
              y1="100"
              x2="95"
              y2="34"
              stroke={PURPLE}
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </g>
          <circle cx="95" cy="100" r="7" fill={PURPLE} />
        </svg>
      </div>
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <span
          style={{
            fontFamily: SERIF,
            fontSize: 26,
            fontWeight: 700,
            color,
          }}
        >
          {loading ? <Skeleton w={90} h={24} /> : sentiment.label}
        </span>
      </div>
      <p
        style={{
          fontFamily: SANS,
          fontSize: 12.5,
          lineHeight: 1.55,
          color: INK,
          margin: "0 0 10px",
        }}
      >
        {loading ? (
          <>
            <Skeleton h={11} style={{ marginBottom: 5 }} />
            <Skeleton w="85%" h={11} />
          </>
        ) : (
          sentiment.rationale
        )}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {(sentiment.drivers || []).map((d, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 8,
              fontFamily: SANS,
              fontSize: 12,
              color: INK,
              lineHeight: 1.45,
            }}
          >
            <span style={{ color: MAGENTA, fontWeight: 700, flexShrink: 0 }}>
              ◆
            </span>
            {d}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <Badge
          kind="model"
          detail={isLive ? "from live analyst notes + headlines" : "Q1'26 baseline read"}
        />
      </div>
    </div>
  );
}

const SENT_TAG = {
  positive: { fg: GREEN, bg: "#E5F4EC", label: "Positive" },
  neutral: { fg: AMBER, bg: "#FBF3E3", label: "Neutral" },
  negative: { fg: RED, bg: "#F9E9E8", label: "Negative" },
};

// --------------------------------- Main -----------------------------------

export default function AllyIRCommandCenter() {
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLiveData();
      setLive(data);
      setLastUpdated(new Date());
    } catch (e) {
      setError(
        "Live refresh unavailable — showing Q1'26 reported baseline. " +
          "(Search-derived data could not be fetched: " +
          (e?.message || "unknown error") +
          ")"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const mkt = live?.market || {};
  const an = live?.analysts || {};
  const price = mkt.price ?? BASELINE.price;
  const priceIsLive = mkt.price != null;
  const animatedPrice = useAnimatedNumber(price, 2);

  const meanTarget = an.meanTarget;
  const impliedUpside =
    meanTarget != null && price ? ((meanTarget - price) / price) * 100 : null;

  const sentiment = live?.sentiment?.label ? live.sentiment : BASELINE_SENTIMENT;
  const watch =
    live?.watchItems && live.watchItems.length >= 3
      ? live.watchItems
      : BASELINE_WATCH;
  const news = live?.news || [];
  const cal = live?.calendar || {};

  const ratingsTotal =
    (an.ratingsBuy ?? 0) + (an.ratingsHold ?? 0) + (an.ratingsSell ?? 0);

  const dayChangeColor =
    (mkt.dayChange ?? 0) > 0 ? "#8BE3B0" : (mkt.dayChange ?? 0) < 0 ? "#F3A09C" : "#D9CBE0";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        fontFamily: SANS,
        color: INK,
      }}
    >
      <style>{`
        @keyframes ally-shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        @media (max-width: 980px) {
          .ally-main-grid { grid-template-columns: 1fr !important; }
          .ally-header-stats { flex-wrap: wrap !important; }
        }
      `}</style>

      {/* ------------------------------ Header ----------------------------- */}
      <header
        style={{
          background: `linear-gradient(135deg, ${PURPLE} 0%, #3A0B36 100%)`,
          color: "#FFFFFF",
          padding: "18px 28px 16px",
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 14,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: SANS,
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: 2,
                color: "#CBA8C6",
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              Investor Relations Command Center
            </div>
            <h1
              style={{
                fontFamily: SERIF,
                fontSize: 26,
                fontWeight: 700,
                margin: 0,
                letterSpacing: 0.2,
              }}
            >
              Ally Financial{" "}
              <span style={{ color: MAGENTA, fontSize: 20 }}>NYSE: ALLY</span>
            </h1>
          </div>

          <div
            className="ally-header-stats"
            style={{ display: "flex", alignItems: "center", gap: 26 }}
          >
            <div>
              <div style={{ fontSize: 10.5, color: "#CBA8C6", fontWeight: 600 }}>
                SHARE PRICE
              </div>
              <div
                style={{
                  fontFamily: SERIF,
                  fontSize: 30,
                  fontWeight: 700,
                  lineHeight: 1.05,
                }}
              >
                {loading && !live ? (
                  <Skeleton w={86} h={26} style={{ background: "#6B2663" }} />
                ) : (
                  <>${animatedPrice}</>
                )}
              </div>
              <div style={{ fontSize: 12, color: dayChangeColor, fontWeight: 600 }}>
                {mkt.dayChange != null && mkt.dayChangePct != null ? (
                  <>
                    {mkt.dayChange >= 0 ? "▲" : "▼"} {mkt.dayChange >= 0 ? "+" : ""}
                    {mkt.dayChange.toFixed(2)} ({mkt.dayChangePct >= 0 ? "+" : ""}
                    {mkt.dayChangePct.toFixed(2)}%)
                  </>
                ) : (
                  "— day change pending live pull"
                )}
              </div>
            </div>

            {[
              {
                k: "MARKET CAP",
                v: mkt.marketCap ?? BASELINE.marketCapNote,
              },
              {
                k: "P/E",
                v: (mkt.pe ?? BASELINE.pe).toFixed
                  ? Number(mkt.pe ?? BASELINE.pe).toFixed(1)
                  : mkt.pe ?? BASELINE.pe,
              },
              {
                k: "52-WK RANGE",
                v:
                  mkt.week52Low != null && mkt.week52High != null
                    ? `$${Number(mkt.week52Low).toFixed(2)} – $${Number(
                        mkt.week52High
                      ).toFixed(2)}`
                    : "—",
              },
            ].map((s) => (
              <div key={s.k}>
                <div style={{ fontSize: 10.5, color: "#CBA8C6", fontWeight: 600 }}>
                  {s.k}
                </div>
                <div
                  style={{
                    fontFamily: SERIF,
                    fontSize: 19,
                    fontWeight: 700,
                    marginTop: 3,
                  }}
                >
                  {loading && !live ? (
                    <Skeleton w={70} h={16} style={{ background: "#6B2663" }} />
                  ) : (
                    s.v
                  )}
                </div>
              </div>
            ))}

            <div style={{ textAlign: "right" }}>
              <button
                onClick={refresh}
                disabled={loading}
                style={{
                  background: loading ? "#7A4274" : MAGENTA,
                  color: "#FFF",
                  border: "none",
                  borderRadius: 8,
                  padding: "9px 18px",
                  fontFamily: SANS,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: loading ? "default" : "pointer",
                  letterSpacing: 0.3,
                }}
              >
                {loading ? "Refreshing…" : "↻ Refresh"}
              </button>
              <div style={{ fontSize: 10.5, color: "#CBA8C6", marginTop: 6 }}>
                {lastUpdated
                  ? `Last updated ${lastUpdated.toLocaleTimeString()}`
                  : loading
                  ? "Fetching live data…"
                  : "Baseline only"}
              </div>
            </div>
          </div>
        </div>
        <div
          style={{
            maxWidth: 1280,
            margin: "10px auto 0",
            fontSize: 11,
            color: "#B790B2",
          }}
        >
          {priceIsLive ? (
            <>
              Quote: {mkt.source || "web search"} · {mkt.asOf || "timestamp unavailable"} ·
              search-derived, may be delayed
            </>
          ) : (
            <>Header figures from Q1'26 baseline (reported Apr 17, 2026) until live pull completes</>
          )}
        </div>
      </header>

      {/* ------------------------------ Error ------------------------------ */}
      {error && (
        <div
          style={{
            maxWidth: 1280,
            margin: "14px auto 0",
            padding: "10px 16px",
            background: "#FBF3E3",
            border: `1px solid #E8D9B5`,
            borderRadius: 10,
            fontSize: 12.5,
            color: AMBER,
            fontWeight: 600,
          }}
        >
          ⚠ {error}
        </div>
      )}

      {/* ------------------------------ Body ------------------------------- */}
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "18px 24px 30px" }}>
        <div
          className="ally-main-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "7fr 5fr",
            gap: 16,
            marginBottom: 16,
          }}
        >
          {/* -------------------- Valuation & consensus -------------------- */}
          <Card>
            <SectionTitle
              right={
                an.meanTarget != null ? (
                  <Badge kind="live" detail="analyst data via web search" />
                ) : (
                  <Badge kind="reported" />
                )
              }
            >
              Valuation &amp; Consensus
            </SectionTitle>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <MetricCard
                label="Consensus EPS FY26"
                value={`$${(an.epsFY26 ?? BASELINE.epsFY26).toFixed(2)}`}
                sub={`Q1'26 actual: $${BASELINE.adjEPS.toFixed(2)} adj (beat $${BASELINE.adjEPSConsensus.toFixed(2)})`}
              />
              <MetricCard
                label="Consensus EPS FY27"
                value={`$${(an.epsFY27 ?? BASELINE.epsFY27).toFixed(2)}`}
                sub="Implied forward P/E supportive vs financials"
              />
              <MetricCard
                label="Mean Price Target"
                value={
                  loading && !live ? (
                    <Skeleton w={70} h={20} />
                  ) : meanTarget != null ? (
                    `$${Number(meanTarget).toFixed(2)}`
                  ) : (
                    "—"
                  )
                }
                sub={
                  an.lowTarget != null && an.highTarget != null
                    ? `Range $${Number(an.lowTarget).toFixed(0)} – $${Number(
                        an.highTarget
                      ).toFixed(0)}`
                    : "Range pending live pull"
                }
              />
              <MetricCard
                label="Implied Upside"
                value={
                  loading && !live ? (
                    <Skeleton w={70} h={20} />
                  ) : impliedUpside != null ? (
                    `${impliedUpside >= 0 ? "+" : ""}${impliedUpside.toFixed(1)}%`
                  ) : (
                    "—"
                  )
                }
                accent={
                  impliedUpside == null ? INK : impliedUpside >= 0 ? GREEN : RED
                }
                sub="Mean target vs current price (computed)"
              />
            </div>

            {/* Ratings distribution */}
            <div style={{ marginBottom: 6 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: MUTED,
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  marginBottom: 7,
                }}
              >
                Rating Distribution
              </div>
              {ratingsTotal > 0 ? (
                <>
                  <div
                    style={{
                      display: "flex",
                      height: 14,
                      borderRadius: 7,
                      overflow: "hidden",
                      border: `1px solid ${HAIRLINE}`,
                    }}
                  >
                    <div
                      style={{
                        width: `${((an.ratingsBuy ?? 0) / ratingsTotal) * 100}%`,
                        background: GREEN,
                        transition: "width 800ms ease",
                      }}
                    />
                    <div
                      style={{
                        width: `${((an.ratingsHold ?? 0) / ratingsTotal) * 100}%`,
                        background: AMBER,
                        transition: "width 800ms ease",
                      }}
                    />
                    <div
                      style={{
                        width: `${((an.ratingsSell ?? 0) / ratingsTotal) * 100}%`,
                        background: RED,
                        transition: "width 800ms ease",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      marginTop: 6,
                      fontSize: 11.5,
                      color: MUTED,
                    }}
                  >
                    <span>
                      <b style={{ color: GREEN }}>{an.ratingsBuy ?? 0}</b> Buy
                    </span>
                    <span>
                      <b style={{ color: AMBER }}>{an.ratingsHold ?? 0}</b> Hold
                    </span>
                    <span>
                      <b style={{ color: RED }}>{an.ratingsSell ?? 0}</b> Sell
                    </span>
                  </div>
                </>
              ) : loading ? (
                <Skeleton h={14} />
              ) : (
                <div style={{ fontSize: 12, color: MUTED }}>
                  Rating counts pending live pull.
                </div>
              )}
            </div>

            {/* Recent actions */}
            {(an.recentActions || []).length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: MUTED,
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                    marginBottom: 6,
                  }}
                >
                  Recent Rating / Target Actions
                </div>
                {an.recentActions.slice(0, 4).map((a, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      fontSize: 12.5,
                      padding: "5px 0",
                      borderTop: i ? `1px solid ${HAIRLINE}` : "none",
                    }}
                  >
                    <span>
                      <b>{a.firm}</b> — {a.action}
                    </span>
                    <span style={{ color: MUTED, flexShrink: 0 }}>{a.date}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ---------------------- Sentiment gauge ------------------------ */}
          <Card>
            <SectionTitle>Investor Sentiment</SectionTitle>
            <SentimentGauge
              sentiment={sentiment}
              isLive={!!live?.sentiment?.label}
              loading={loading && !live}
            />
          </Card>
        </div>

        {/* ------------------------ IR scorecard --------------------------- */}
        <Card style={{ marginBottom: 16 }}>
          <SectionTitle right={<Badge kind="reported" detail="Apr 17, 2026" />}>
            Core IR Scorecard — Q1 2026
          </SectionTitle>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(195px, 1fr))",
              gap: 10,
            }}
          >
            <MetricCard
              label="NIM (ex-OID)"
              value={`${BASELINE.nimExOID.toFixed(2)}%`}
              sub={`GAAP NIM ${BASELINE.nim.toFixed(2)}% · +${BASELINE.nimYoYBps} bps YoY`}
              trend={TRENDS.nim}
            />
            <div
              style={{
                border: `1px solid ${HAIRLINE}`,
                borderRadius: 10,
                padding: "12px 14px",
                background: "#FFFFFF",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: MUTED,
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                }}
              >
                Core ROTCE vs Mid-Teens Target
              </div>
              <div
                style={{
                  fontFamily: SERIF,
                  fontSize: 24,
                  fontWeight: 700,
                  color: INK,
                }}
              >
                {BASELINE.rotce.toFixed(1)}%
              </div>
              <div
                style={{
                  height: 9,
                  borderRadius: 5,
                  background: "#EEE9E3",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${(BASELINE.rotce / BASELINE.rotceTarget) * 100}%`,
                    height: "100%",
                    background: `linear-gradient(90deg, ${PURPLE}, ${MAGENTA})`,
                    borderRadius: 5,
                    transition: "width 900ms ease",
                  }}
                />
              </div>
              <div style={{ fontSize: 11.5, color: MUTED }}>
                {Math.round((BASELINE.rotce / BASELINE.rotceTarget) * 100)}% of the
                ~15% mid-teens target (mgmt: later in 2026)
              </div>
            </div>
            <MetricCard
              label="Adjusted EPS"
              value={`$${BASELINE.adjEPS.toFixed(2)}`}
              sub={`Beat $${BASELINE.adjEPSConsensus.toFixed(2)} consensus · GAAP $${BASELINE.gaapEPS.toFixed(2)}`}
              trend={TRENDS.adjEPS}
            />
            <MetricCard
              label="Adjusted TBVPS"
              value={`$${BASELINE.tbvps.toFixed(2)}`}
              sub="Tangible book compounding through recovery"
              trend={TRENDS.tbvps}
            />
            <MetricCard
              label="Deposits"
              value={`$${BASELINE.depositsB.toFixed(1)}B`}
              sub={`Total assets $${BASELINE.assetsB.toFixed(1)}B · loans $${(
                BASELINE.consumerLoansB + BASELINE.commercialLoansB
              ).toFixed(1)}B`}
              trend={TRENDS.deposits}
            />
            <MetricCard
              label="Adj. Efficiency Ratio"
              value={`${BASELINE.effRatio.toFixed(1)}%`}
              sub="Improving — expense leverage building"
              trend={TRENDS.effRatio}
            />
            <MetricCard
              label="Revenue / Net Financing"
              value={`$${BASELINE.revenueB.toFixed(2)}B`}
              sub={`Net financing revenue $${BASELINE.netFinancingRevB.toFixed(2)}B`}
            />
            <MetricCard
              label="Credit Trend (NCOs)"
              value="Normalizing"
              sub="Retail auto charge-offs tracking management's guided range; watch vintage performance. Exact NCO % populates from live pull when available."
            />
          </div>
          <div style={{ fontSize: 10.5, color: MUTED, marginTop: 10 }}>
            Sparklines show directional 5-quarter paths consistent with reported
            YoY changes — verify exact history against filings before external use.
          </div>
        </Card>

        {/* -------------------- News + watch items / calendar -------------- */}
        <div
          className="ally-main-grid"
          style={{ display: "grid", gridTemplateColumns: "7fr 5fr", gap: 16 }}
        >
          {/* News feed */}
          <Card>
            <SectionTitle
              right={
                news.length ? (
                  <Badge kind="live" detail="web search" />
                ) : null
              }
            >
              Live News Feed
            </SectionTitle>
            {loading && !news.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i}>
                    <Skeleton w="78%" h={13} style={{ marginBottom: 6 }} />
                    <Skeleton w="50%" h={10} />
                  </div>
                ))}
              </div>
            ) : news.length ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {news.slice(0, 10).map((n, i) => {
                  const tag = SENT_TAG[n.sentiment] || SENT_TAG.neutral;
                  return (
                    <div
                      key={i}
                      style={{
                        padding: "11px 0",
                        borderTop: i ? `1px solid ${HAIRLINE}` : "none",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          alignItems: "flex-start",
                        }}
                      >
                        <div
                          style={{
                            fontFamily: SERIF,
                            fontSize: 14.5,
                            fontWeight: 700,
                            lineHeight: 1.35,
                          }}
                        >
                          {n.headline}
                        </div>
                        <span
                          style={{
                            background: tag.bg,
                            color: tag.fg,
                            fontSize: 10.5,
                            fontWeight: 700,
                            borderRadius: 999,
                            padding: "2px 9px",
                            flexShrink: 0,
                          }}
                        >
                          {tag.label}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: MUTED,
                          margin: "3px 0 5px",
                        }}
                      >
                        {n.source} · {n.date}
                      </div>
                      <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                        <b style={{ color: PURPLE }}>Why it matters for IR:</b>{" "}
                        {n.whyItMatters}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.6 }}>
                No cached headlines in the baseline snapshot — headlines populate
                from web search on load. Hit <b>Refresh</b> to retry.
              </div>
            )}
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Watch items */}
            <Card>
              <SectionTitle
                right={
                  live?.watchItems?.length >= 3 ? (
                    <Badge kind="live" detail="web search" />
                  ) : (
                    <Badge kind="reported" />
                  )
                }
              >
                Street Watch-Items — IR Prep
              </SectionTitle>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {watch.slice(0, 5).map((w, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "10px 0",
                      borderTop: i ? `1px solid ${HAIRLINE}` : "none",
                      display: "flex",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: SERIF,
                        fontWeight: 700,
                        fontSize: 16,
                        color: MAGENTA,
                        flexShrink: 0,
                        width: 18,
                      }}
                    >
                      {i + 1}
                    </div>
                    <div>
                      <div
                        style={{
                          fontFamily: SERIF,
                          fontWeight: 700,
                          fontSize: 13.5,
                          marginBottom: 2,
                        }}
                      >
                        {w.topic}
                      </div>
                      <div
                        style={{ fontSize: 12, color: "#4A4454", lineHeight: 1.5 }}
                      >
                        {w.detail}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* IR calendar */}
            <Card>
              <SectionTitle>IR Calendar</SectionTitle>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  background: "#F8F4F7",
                  border: `1px solid #EADFE8`,
                  borderRadius: 10,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    fontFamily: SERIF,
                    fontSize: 22,
                    color: PURPLE,
                    fontWeight: 700,
                  }}
                >
                  Q2'26
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>
                    Next earnings release
                  </div>
                  <div style={{ fontSize: 12.5, color: MUTED }}>
                    {cal.nextEarnings || BASELINE.nextEarnings}
                  </div>
                </div>
              </div>
              {(cal.events || []).length ? (
                (cal.events || []).slice(0, 4).map((e, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      fontSize: 12.5,
                      padding: "7px 2px",
                      borderTop: i ? `1px solid ${HAIRLINE}` : "none",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{e.name}</span>
                    <span style={{ color: MUTED, flexShrink: 0 }}>{e.date}</span>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.55 }}>
                  Investor-conference appearances populate from the live pull when
                  announced.
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* ----------------------------- Footer ----------------------------- */}
        <div
          style={{
            marginTop: 18,
            paddingTop: 12,
            borderTop: `1px solid ${HAIRLINE}`,
            fontSize: 10.5,
            color: MUTED,
            lineHeight: 1.6,
          }}
        >
          Search-derived market figures may be delayed or approximate and are not
          official real-time quotes. Metric figures are from Ally Financial's Q1
          2026 earnings release (April 17, 2026) unless tagged Live. The investor
          sentiment read is model-synthesized from public analyst commentary and
          headlines — it is a qualitative classification, not a quantitative
          index. For internal IR preparation only; not investment advice.
        </div>
      </main>
    </div>
  );
}
