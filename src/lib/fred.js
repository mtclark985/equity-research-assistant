/**
 * FRED fetch module — retrieves macro context (fed funds rate, 10Y yield,
 * unemployment) from the Federal Reserve Economic Data API.
 */

const BASE_URL = "https://api.stlouisfed.org/fred";

const SERIES_CONFIG = {
  fedFundsRate: {
    seriesId: "DFF",
    title: "Effective Federal Funds Rate",
    units: "Percent",
  },
  treasuryYield10Y: {
    seriesId: "DGS10",
    title: "10-Year Treasury Constant Maturity Rate",
    units: "Percent",
  },
  unemploymentRate: {
    seriesId: "UNRATE",
    title: "Unemployment Rate",
    units: "Percent",
  },
};

function getApiKey() {
  const key = process.env.FRED_API_KEY;
  if (!key) throw new Error("FRED_API_KEY not set in environment");
  return key;
}

async function fetchSeries(seriesId) {
  const key = getApiKey();

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 24);
  const observationStart = startDate.toISOString().slice(0, 10);

  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: key,
    file_type: "json",
    frequency: "m",
    aggregation_method: "avg",
    observation_start: observationStart,
    sort_order: "desc",
    limit: "24",
  });

  const url = `${BASE_URL}/series/observations?${params}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });

  if (res.status === 400 || res.status === 401) {
    throw new Error(`FRED request failed: ${res.status} on ${seriesId}`);
  }
  if (!res.ok) {
    throw new Error(`FRED request failed: ${res.status} on ${seriesId}`);
  }

  const data = await res.json();

  if (!data.observations || data.observations.length === 0) return [];

  return data.observations
    .filter((o) => o.value !== ".")
    .map((o) => ({
      date: o.date,
      value: parseFloat(o.value),
    }));
}

export async function fetchFredMacroContext() {
  getApiKey();

  const keys = Object.keys(SERIES_CONFIG);

  const results = await Promise.allSettled(
    keys.map((key) => fetchSeries(SERIES_CONFIG[key].seriesId))
  );

  const series = {};
  const missing = [];
  let latestDate = null;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const config = SERIES_CONFIG[key];
    const result = results[i];

    if (result.status === "fulfilled" && result.value.length > 0) {
      const observations = result.value;

      // Track latest observation date across all series
      if (!latestDate || observations[0].date > latestDate) {
        latestDate = observations[0].date;
      }

      series[key] = {
        seriesId: config.seriesId,
        title: config.title,
        frequency: "monthly",
        units: config.units,
        observations,
      };
    } else {
      // 400/401 rejections propagate — but 404/5xx/empty land here
      if (result.status === "rejected") {
        const msg = result.reason?.message || "";
        if (msg.includes("400") || msg.includes("401")) {
          throw result.reason;
        }
      }
      series[key] = null;
      missing.push(key);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return {
    fetchedAt: today,
    window: `24 months ending ${latestDate || today}`,
    series,
    missing,
    source: {
      name: "FRED (Federal Reserve Economic Data)",
      publisher: "Federal Reserve Bank of St. Louis",
      endpoint: "/series/observations",
    },
  };
}
