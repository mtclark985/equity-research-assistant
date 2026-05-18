/**
 * Yahoo Finance price history module — fetches monthly adjusted closes
 * via the yahoo-finance2 library.
 */

import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({
  suppressNotices: ["ripHistorical", "yahooSurvey"],
});

export async function fetchYahooPriceHistory(ticker) {
  const result = {
    ticker: ticker.toUpperCase(),
    priceHistory: null,
    missing: [],
    source: {
      name: "Yahoo Finance",
      library: "yahoo-finance2",
      note: "Adjusted closes (split/dividend-adjusted)",
    },
  };

  try {
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

    const bars = await yf.historical(ticker, {
      period1: fiveYearsAgo,
      period2: new Date(),
      interval: "1mo",
    });

    if (!bars || bars.length === 0) {
      result.missing.push("priceHistory");
      return result;
    }

    // Map to our shape: { date: "YYYY-MM-DD", close: adjClose }, desc by date
    const points = bars
      .filter((b) => b.adjClose != null)
      .map((b) => ({
        date: b.date.toISOString().slice(0, 10),
        close: b.adjClose,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    result.priceHistory = {
      frequency: "monthly",
      points,
    };
  } catch (err) {
    // Invalid ticker or network error — degrade gracefully
    result.missing.push("priceHistory");
  }

  return result;
}
