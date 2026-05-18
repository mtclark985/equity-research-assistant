/**
 * Simple test harness for yahoo.js — run with:
 *   node src/lib/yahoo.test.js
 */

import { fetchYahooPriceHistory } from "./yahoo.js";

const TICKERS = ["AAPL", "MSFT", "ALLY", "JPM", "FAKETICKER"];

async function runTest(ticker) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing: ${ticker}`);
  console.log("=".repeat(60));

  try {
    const result = await fetchYahooPriceHistory(ticker);

    if (result.priceHistory) {
      const pts = result.priceHistory.points;
      console.log(`  Points:       ${pts.length}`);
      if (pts.length > 0) {
        console.log(`  Latest close: $${pts[0].close.toFixed(2)} (${pts[0].date})`);
        console.log(`  Oldest close: $${pts[pts.length - 1].close.toFixed(2)} (${pts[pts.length - 1].date})`);
      }
    } else {
      console.log(`  Points:       n/a`);
    }

    if (result.missing.length > 0) {
      console.log(`  Missing:      ${result.missing.join(", ")}`);
    } else {
      console.log(`  Missing:      (none)`);
    }
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
  }
}

async function main() {
  console.log("Yahoo Finance Price History — Test Harness");
  console.log(`Running at: ${new Date().toISOString()}`);

  for (const ticker of TICKERS) {
    await runTest(ticker);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("Done.");
}

main();
