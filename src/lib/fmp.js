/**
 * FMP (Financial Modeling Prep) fetch module — retrieves company profile
 * for a given ticker.
 *
 * Uses the FMP "stable" API (legacy v3 endpoints were sunset Aug 31 2025).
 */

const BASE_URL = "https://financialmodelingprep.com/stable";

function getApiKey() {
  const key = process.env.FMP_API_KEY;
  if (!key) throw new Error("FMP_API_KEY not set in environment");
  return key;
}

function parseProfile(data) {
  if (!data || !Array.isArray(data) || data.length === 0) return null;
  const p = data[0];
  return {
    companyName: p.companyName || null,
    sector: p.sector || null,
    industry: p.industry || null,
    marketCap: p.marketCap || null,
    beta: p.beta || null,
    exchange: p.exchange || null,
    currency: p.currency || null,
    description: p.description ? p.description.slice(0, 500) : null,
  };
}

export async function fetchFmpData(ticker) {
  const key = getApiKey();
  const upperTicker = ticker.toUpperCase();

  const url = `${BASE_URL}/profile?symbol=${encodeURIComponent(upperTicker)}&apikey=${key}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });

  // Auth / rate-limit errors are setup problems — fail loudly
  if (res.status === 401 || res.status === 403 || res.status === 429) {
    throw new Error(`FMP request failed: ${res.status} on /profile`);
  }

  const missing = [];
  let profile = null;

  // 402 = symbol not available on current plan; 404 = unknown; 5xx = server error
  if (res.ok) {
    const data = await res.json();
    profile = parseProfile(data);
  }

  if (!profile) missing.push("profile");

  return {
    ticker: upperTicker,
    profile,
    missing,
    source: {
      name: "Financial Modeling Prep",
      endpoints: ["/profile"],
    },
  };
}
