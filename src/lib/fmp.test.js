/**
 * Simple test harness for fmp.js — run with:
 *   node src/lib/fmp.test.js
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { fetchFmpData } from "./fmp.js";

const TICKERS = ["AAPL", "MSFT", "ALLY", "JPM", "FAKETICKER"];

function fmt(n) {
  if (n == null) return "n/a";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n}`;
}

async function runTest(ticker) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing: ${ticker}`);
  console.log("=".repeat(60));

  try {
    const result = await fetchFmpData(ticker);

    if (result.profile) {
      console.log(`  Company:    ${result.profile.companyName}`);
      console.log(`  Sector:     ${result.profile.sector}`);
      console.log(`  Industry:   ${result.profile.industry}`);
      console.log(`  Market Cap: ${fmt(result.profile.marketCap)}`);
      console.log(`  Exchange:   ${result.profile.exchange}`);
      console.log(`  Currency:   ${result.profile.currency}`);
    } else {
      console.log(`  Profile:    n/a`);
    }

    if (result.missing.length > 0) {
      console.log(`  Missing:    ${result.missing.join(", ")}`);
    } else {
      console.log(`  Missing:    (none)`);
    }
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
  }
}

async function main() {
  console.log("FMP Profile Module — Test Harness");
  console.log(`Running at: ${new Date().toISOString()}`);

  for (const ticker of TICKERS) {
    await runTest(ticker);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("Done.");
}

main();
