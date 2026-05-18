/**
 * Simple test harness for edgar.js — run with:
 *   node src/lib/edgar.test.js
 */

import { fetchEdgarFundamentals } from "./edgar.js";

const TICKERS = ["AAPL", "MSFT", "ALLY", "JPM", "FAKETICKER"];

async function runTest(ticker) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing: ${ticker}`);
  console.log("=".repeat(60));

  try {
    const result = await fetchEdgarFundamentals(ticker);

    console.log(`  Company:         ${result.companyName}`);
    console.log(`  CIK:             ${result.cik}`);
    console.log(`  Fiscal Year End: ${result.fiscalYearEnd}`);
    console.log(`  Latest Filing:   ${result.latestFilingDate}`);

    const conceptKeys = Object.keys(result.concepts);
    const found = conceptKeys.filter(
      (k) => result.concepts[k].annual.length > 0
    );
    console.log(`  Concepts found:  ${found.length}/${conceptKeys.length}`);

    if (result.missing.length > 0) {
      console.log(`  Missing:         ${result.missing.join(", ")}`);
    }

    // Latest annual revenue
    const rev = result.concepts.revenue;
    if (rev && rev.annual.length > 0) {
      const latest = rev.annual[0];
      const formatted =
        latest.unit === "USD"
          ? `$${(latest.value / 1e9).toFixed(2)}B`
          : latest.value;
      console.log(
        `  Latest Revenue:  ${formatted} (FY${latest.fy}, ending ${latest.end})`
      );
    } else {
      console.log(`  Latest Revenue:  N/A`);
    }

    // Show quarterly if available
    if (rev && rev.quarterly) {
      const q = rev.quarterly;
      const formatted =
        q.unit === "USD" ? `$${(q.value / 1e9).toFixed(2)}B` : q.value;
      console.log(
        `  Latest Quarter:  ${formatted} (${q.fp}, ${q.periodType}, ending ${q.end})`
      );
    }
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
  }
}

async function main() {
  console.log("EDGAR Fetch Module — Test Harness");
  console.log(`Running at: ${new Date().toISOString()}`);

  for (const ticker of TICKERS) {
    await runTest(ticker);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("Done.");
}

main();
