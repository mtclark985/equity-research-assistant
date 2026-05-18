/**
 * Orchestrator — fetches data from all four sources, builds a data payload,
 * calls Claude to produce the analytical memo, and assembles the final output.
 */

import { fetchEdgarFundamentals } from "./edgar.js";
import { fetchFmpData } from "./fmp.js";
import { fetchYahooPriceHistory } from "./yahoo.js";
import { fetchFredMacroContext } from "./fred.js";
import { SYSTEM_PROMPT_TEMPLATE } from "./systemPrompt.js";

const TIMEOUT_MS = 15000;

function withTimeout(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timeout after ${TIMEOUT_MS}ms`)),
        TIMEOUT_MS
      )
    ),
  ]);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// -----------------------------------------------------------------------
// Step 4: Build the data payload from fetcher results
// -----------------------------------------------------------------------

function buildDataPayload(ticker, edgarData, fmpData, yahooData, fredData) {
  // Company name: prefer FMP > EDGAR > ticker
  let companyName = ticker;
  if (fmpData?.profile?.companyName) {
    companyName = fmpData.profile.companyName;
  } else if (edgarData?.companyName) {
    companyName = edgarData.companyName;
  }

  // Profile from FMP
  let profile = null;
  if (fmpData?.profile) {
    const p = fmpData.profile;
    profile = {
      sector: p.sector,
      industry: p.industry,
      marketCap: p.marketCap,
      beta: p.beta,
      exchange: p.exchange,
      currency: p.currency,
      description: p.description,
    };
  }

  // Fundamentals from EDGAR
  const annual = {};
  const latestQuarter = {};
  for (const [key, concept] of Object.entries(edgarData.concepts)) {
    annual[key] = concept.annual.map((a) => ({
      fy: a.fy,
      end: a.end,
      value: a.value,
    }));
    latestQuarter[key] = concept.quarterly
      ? {
          fp: concept.quarterly.fp,
          end: concept.quarterly.end,
          start: concept.quarterly.start,
          value: concept.quarterly.value,
          periodType: concept.quarterly.periodType,
        }
      : null;
  }

  const fundamentals = {
    fiscalYearEnd: edgarData.fiscalYearEnd,
    latestFilingDate: edgarData.latestFilingDate,
    annual,
    latestQuarter,
  };

  // Price history from Yahoo
  const priceHistory = yahooData?.priceHistory?.points || [];

  // Macro from FRED
  let macro = null;
  if (fredData?.series) {
    macro = {};
    for (const [key, data] of Object.entries(fredData.series)) {
      if (data) {
        macro[key] = {
          title: data.title,
          units: data.units,
          observations: data.observations,
        };
      } else {
        macro[key] = null;
      }
    }
  }

  // Data availability
  const missingItems = [];
  const notes = [];

  // EDGAR missing
  if (edgarData.missing.length > 0) {
    for (const m of edgarData.missing) {
      missingItems.push(`fundamentals.${m}`);
    }
    notes.push(
      `EDGAR: missing concept(s) — ${edgarData.missing.join(", ")}. These XBRL tags were not found in filings.`
    );
  }

  // FMP missing
  if (fmpData) {
    if (fmpData.missing.length > 0) {
      for (const m of fmpData.missing) {
        missingItems.push(`profile`);
      }
      notes.push("FMP: company profile not available.");
    }
  } else {
    missingItems.push("profile");
    notes.push("FMP: fetch failed or timed out — company profile unavailable.");
  }

  // FRED missing
  if (fredData) {
    if (fredData.missing.length > 0) {
      for (const m of fredData.missing) {
        missingItems.push(`macro.${m}`);
      }
      notes.push(
        `FRED: missing series — ${fredData.missing.join(", ")}.`
      );
    }
  } else {
    missingItems.push("macro");
    notes.push(
      "FRED: fetch failed or timed out — macro context unavailable."
    );
  }

  return {
    ticker,
    companyName,
    fetchedAt: today(),
    profile,
    fundamentals,
    priceHistory,
    macro,
    dataAvailability: {
      missing: missingItems,
      notes,
    },
  };
}

// -----------------------------------------------------------------------
// Step 5: Compute deterministic price window
// -----------------------------------------------------------------------

function computePriceWindow(points) {
  const currentPoint = points[0];
  const oldestPoint = points[points.length - 1];
  const closes = points.map((p) => p.close);
  const high = Math.max(...closes);
  const low = Math.min(...closes);
  const fiveYearReturnPct =
    ((currentPoint.close - oldestPoint.close) / oldestPoint.close) * 100;

  return {
    currentClose: currentPoint.close,
    currentDate: currentPoint.date,
    fiveYearHigh: round2(high),
    fiveYearLow: round2(low),
    fiveYearReturn: round2(fiveYearReturnPct) + "%",
  };
}

// -----------------------------------------------------------------------
// Step 6: Call Claude
// -----------------------------------------------------------------------

async function callClaude(systemPrompt, userMessage) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set in environment");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-7",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Anthropic API error:", data);
    throw new Error(
      `Anthropic API request failed: ${response.status}`
    );
  }

  // Extract text from content blocks
  const textBlock = data.content?.find((b) => b.type === "text");
  if (!textBlock) {
    throw new Error("Claude returned no text content");
  }

  return textBlock.text;
}

// -----------------------------------------------------------------------
// Step 7: Parse and validate Claude's response
// -----------------------------------------------------------------------

const REQUIRED_FIELDS = [
  "thesis",
  "businessOverview",
  "financialHighlights",
  "valuationContext",
  "macroContext",
  "keyRisks",
  "dataCaveats",
];

function parseClaudeResponse(rawText) {
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new Error(`Claude returned invalid JSON: ${err.message}`);
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in parsed)) {
      throw new Error(`Claude response missing required field: ${field}`);
    }
  }

  return parsed;
}

// -----------------------------------------------------------------------
// Main export
// -----------------------------------------------------------------------

export async function buildResearchMemo(ticker) {
  // Step 1: Validate input
  const upperTicker = ticker.toUpperCase();
  if (!/^[A-Z]{1,5}$/.test(upperTicker)) {
    throw new Error("Invalid ticker format");
  }

  // Step 2: Run fetchers in parallel with timeouts
  const [edgarResult, fmpResult, yahooResult, fredResult] =
    await Promise.allSettled([
      withTimeout(fetchEdgarFundamentals(upperTicker), "EDGAR"),
      withTimeout(fetchFmpData(upperTicker), "FMP"),
      withTimeout(fetchYahooPriceHistory(upperTicker), "Yahoo"),
      withTimeout(fetchFredMacroContext(), "FRED"),
    ]);

  // Step 3: Hard requirement check
  if (edgarResult.status === "rejected") {
    throw new Error(
      `EDGAR fundamentals are required and could not be fetched: ${edgarResult.reason?.message || edgarResult.reason}`
    );
  }
  if (yahooResult.status === "rejected") {
    throw new Error(
      `Yahoo price history is required and could not be fetched: ${yahooResult.reason?.message || yahooResult.reason}`
    );
  }

  const edgarData = edgarResult.value;
  const yahooData = yahooResult.value;

  // Yahoo succeeded but returned no price data
  if (!yahooData.priceHistory || yahooData.priceHistory.points.length === 0) {
    throw new Error(
      "Yahoo price history is required but returned no data for this ticker"
    );
  }

  // FMP and FRED are degradable
  const fmpData =
    fmpResult.status === "fulfilled" ? fmpResult.value : null;
  const fredData =
    fredResult.status === "fulfilled" ? fredResult.value : null;

  if (fmpResult.status === "rejected") {
    console.warn("FMP degraded:", fmpResult.reason?.message);
  }
  if (fredResult.status === "rejected") {
    console.warn("FRED degraded:", fredResult.reason?.message);
  }

  // Step 4: Build the data payload
  const dataPayload = buildDataPayload(
    upperTicker,
    edgarData,
    fmpData,
    yahooData,
    fredData
  );

  // Step 5: Compute deterministic fields
  const points = yahooData.priceHistory.points;
  const priceWindow = computePriceWindow(points);

  // Build sources array
  const sources = [];
  sources.push({ name: edgarData.source.name, url: edgarData.source.companyFactsUrl });
  if (fmpData) {
    sources.push({ name: fmpData.source.name });
  }
  sources.push({ name: yahooData.source.name });
  if (fredData) {
    sources.push({ name: fredData.source.name });
  }

  // Step 6: Call Claude
  const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace(
    "{{DATA_PAYLOAD}}",
    JSON.stringify(dataPayload, null, 2)
  );
  const userMessage = `Produce the research memo for ${upperTicker} using the data provided in the system prompt.`;

  const rawText = await callClaude(systemPrompt, userMessage);

  // Step 7: Parse and validate
  const claudeMemo = parseClaudeResponse(rawText);

  // Step 8: Assemble final memo
  return {
    memo: {
      ticker: dataPayload.ticker,
      companyName: dataPayload.companyName,
      asOfDate: dataPayload.fetchedAt,
      ...claudeMemo,
      valuationContext: {
        ...claudeMemo.valuationContext,
        priceWindow,
      },
    },
    sources,
    dataAvailability: dataPayload.dataAvailability,
  };
}
