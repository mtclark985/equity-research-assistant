/**
 * EDGAR fetch module — resolves ticker to CIK, fetches company facts,
 * and extracts key financial concepts from XBRL data.
 */

const SEC_USER_AGENT =
  process.env.SEC_USER_AGENT ||
  "Equity Research Assistant michael.clark@example.com";

const TAG_FALLBACKS = {
  revenue: [
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "Revenues",
    "SalesRevenueNet",
    "InterestAndDividendIncomeOperating",
  ],
  netIncome: ["NetIncomeLoss"],
  operatingIncome: [
    "OperatingIncomeLoss",
    "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
  ],
  totalAssets: ["Assets"],
  stockholdersEquity: [
    "StockholdersEquity",
    "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
  ],
  dilutedEps: ["EarningsPerShareDiluted"],
  sharesOutstanding: [
    "CommonStockSharesOutstanding",
    "WeightedAverageNumberOfDilutedSharesOutstanding",
  ],
};

// Unit preference per concept type
const UNIT_PREFERENCE = {
  revenue: "USD",
  netIncome: "USD",
  operatingIncome: "USD",
  totalAssets: "USD",
  stockholdersEquity: "USD",
  dilutedEps: "USD/shares",
  sharesOutstanding: "shares",
};

// Module-scope CIK cache
let cikMap = null;

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": SEC_USER_AGENT,
      Accept: "application/json",
    },
  });
  if (res.status === 404) return { _status: 404 };
  if (res.status === 429 || res.status >= 500) {
    throw new Error(`EDGAR request failed: ${res.status}`);
  }
  if (!res.ok) {
    throw new Error(`EDGAR request failed: ${res.status}`);
  }
  return res.json();
}

async function loadCikMap() {
  if (cikMap) return cikMap;
  const data = await fetchJson("https://www.sec.gov/files/company_tickers.json");
  cikMap = new Map();
  for (const key of Object.keys(data)) {
    const row = data[key];
    cikMap.set(row.ticker.toUpperCase(), {
      cik: row.cik_str,
      title: row.title,
    });
  }
  return cikMap;
}

function padCik(cik) {
  return String(cik).padStart(10, "0");
}

function daysBetween(startStr, endStr) {
  const start = new Date(startStr);
  const end = new Date(endStr);
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

function fiscalYearFromEnd(endDate) {
  return new Date(endDate).getUTCFullYear();
}

function extractAnnual(entries) {
  // Filter for FY + 10-K
  const fyEntries = entries.filter(
    (e) => e.fp === "FY" && e.form === "10-K"
  );

  // Group by periodYear (derived from end date), keep latest filed
  const byPeriodYear = new Map();
  for (const e of fyEntries) {
    const periodYear = fiscalYearFromEnd(e.end);
    const existing = byPeriodYear.get(periodYear);
    if (!existing || e.filed > existing.filed) {
      byPeriodYear.set(periodYear, { ...e, _periodYear: periodYear });
    }
  }

  // Sort desc by periodYear, take top 5
  return Array.from(byPeriodYear.values())
    .sort((a, b) => b._periodYear - a._periodYear)
    .slice(0, 5)
    .map((e) => ({
      fy: e._periodYear,
      end: e.end,
      value: e.val,
      unit: e._unit,
      accn: e.accn,
    }));
}

function extractQuarterly(entries) {
  // Filter for non-FY, 10-Q or 10-K/A
  const qEntries = entries.filter(
    (e) => e.fp !== "FY" && (e.form === "10-Q" || e.form === "10-K/A")
  );

  if (qEntries.length === 0) return null;

  // Dedupe by end date, keep latest filed (handles restatements)
  const byEnd = new Map();
  for (const e of qEntries) {
    const existing = byEnd.get(e.end);
    if (!existing || e.filed > existing.filed) {
      byEnd.set(e.end, e);
    }
  }

  // Sort desc by end date, take first
  const deduped = Array.from(byEnd.values());
  deduped.sort((a, b) => (b.end > a.end ? 1 : b.end < a.end ? -1 : 0));
  const latest = deduped[0];

  let periodType = "ytd";
  if (latest.start && latest.end) {
    const days = daysBetween(latest.start, latest.end);
    if (days >= 80 && days <= 100) {
      periodType = "discrete";
    }
  }

  return {
    fp: latest.fp,
    end: latest.end,
    start: latest.start || null,
    value: latest.val,
    unit: latest._unit,
    periodType,
    accn: latest.accn,
  };
}

function resolveConceptFromFacts(facts, conceptKey) {
  const tags = TAG_FALLBACKS[conceptKey];
  const preferredUnit = UNIT_PREFERENCE[conceptKey];
  const usGaap = facts["us-gaap"];
  if (!usGaap) return null;

  for (const tag of tags) {
    const tagData = usGaap[tag];
    if (!tagData || !tagData.units) continue;

    const unitData = tagData.units[preferredUnit];
    if (!unitData || unitData.length === 0) continue;

    // Attach unit label to each entry for convenience
    const entries = unitData.map((e) => ({ ...e, _unit: preferredUnit }));

    const annual = extractAnnual(entries);
    if (annual.length === 0) continue; // try next tag

    const quarterly = extractQuarterly(entries);
    return { annual, quarterly };
  }

  return null;
}

export async function fetchEdgarFundamentals(ticker) {
  const upperTicker = ticker.toUpperCase();

  // Resolve CIK
  const map = await loadCikMap();
  const entry = map.get(upperTicker);
  if (!entry) {
    throw new Error(`Unknown ticker: ${upperTicker}`);
  }

  const cik10 = padCik(entry.cik);

  // Fetch company facts
  const factsUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik10}.json`;
  const factsData = await fetchJson(factsUrl);
  if (factsData._status === 404) {
    throw new Error(`No EDGAR filings for CIK ${cik10}`);
  }

  // Extract company metadata from facts
  const companyName = factsData.entityName || entry.title;

  // Resolve concepts
  const concepts = {};
  const missing = [];

  for (const conceptKey of Object.keys(TAG_FALLBACKS)) {
    const result = resolveConceptFromFacts(factsData.facts, conceptKey);
    if (result) {
      concepts[conceptKey] = result;
    } else {
      concepts[conceptKey] = { annual: [], quarterly: null };
      missing.push(conceptKey);
    }
  }

  // Determine fiscal year end and latest filing from revenue or first available annual
  let fiscalYearEnd = null;
  let latestFilingDate = null;
  let latestAccessionNumber = null;

  // Find from any concept that has annual data
  for (const key of Object.keys(concepts)) {
    const annual = concepts[key].annual;
    if (annual && annual.length > 0) {
      if (!fiscalYearEnd) {
        fiscalYearEnd = annual[0].end;
        latestAccessionNumber = annual[0].accn;
      }
      break;
    }
  }

  // Get latest filing date from the 10-K filings in facts
  // Look at the recent filings section if available
  if (factsData.facts && factsData.facts["us-gaap"]) {
    // Search for the latest 10-K filed date across all tags
    const usGaap = factsData.facts["us-gaap"];
    let latestFiled = null;
    for (const tag of Object.keys(usGaap)) {
      const units = usGaap[tag].units;
      if (!units) continue;
      for (const unitKey of Object.keys(units)) {
        for (const e of units[unitKey]) {
          if (e.form === "10-K" && e.fp === "FY") {
            if (!latestFiled || e.filed > latestFiled.filed) {
              latestFiled = e;
            }
          }
        }
      }
      // Optimization: check a few key tags rather than all
      if (latestFiled && (tag === "Assets" || tag === "NetIncomeLoss")) break;
    }
    if (latestFiled) {
      latestFilingDate = latestFiled.filed;
      if (!fiscalYearEnd) fiscalYearEnd = latestFiled.end;
      if (!latestAccessionNumber) latestAccessionNumber = latestFiled.accn;
    }
  }

  return {
    ticker: upperTicker,
    cik: cik10,
    companyName,
    fiscalYearEnd,
    latestFilingDate,
    latestAccessionNumber,
    concepts,
    missing,
    source: {
      name: "SEC EDGAR",
      companyFactsUrl: factsUrl,
      latestFilingUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik10}&type=10-K`,
    },
  };
}
