/**
 * End-to-end test harness for memo generation via /api/claude.
 * Assumes `vercel dev` is running on localhost:3000.
 *
 * Run with:
 *   node src/lib/memo.test.js
 */

const BASE_URL = "http://localhost:3000/api/claude";
const TICKERS = ["AAPL", "MSFT", "ALLY", "JPM"];

async function runTest(ticker) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Testing: ${ticker}`);
  console.log("=".repeat(70));

  try {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "memo", ticker }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      console.log(`  HTTP ${res.status}: ${err.error || "unknown error"}`);
      return false;
    }

    const result = await res.json();
    const { memo, sources, dataAvailability } = result;

    console.log(`  Ticker:          ${memo.ticker}`);
    console.log(`  Company:         ${memo.companyName}`);
    console.log(`  As of:           ${memo.asOfDate}`);
    console.log(
      `  Thesis:          [${memo.thesis.label}] ${memo.thesis.summary.slice(0, 100)}...`
    );
    console.log(
      `  Key figures:     ${memo.financialHighlights.keyFigures.length}`
    );
    console.log(`  Risks:           ${memo.keyRisks.risks.length}`);
    console.log(`  Data caveats:    ${memo.dataCaveats.length}`);
    console.log(
      `  Price window:    ${memo.valuationContext.priceWindow.fiveYearReturn} (5yr return)`
    );
    console.log(`  Sources:         ${sources.length}`);
    if (dataAvailability.missing.length > 0) {
      console.log(
        `  Missing data:    ${dataAvailability.missing.join(", ")}`
      );
    } else {
      console.log(`  Missing data:    (none)`);
    }
    return true;
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log("Memo Generation — End-to-End Test Harness");
  console.log(`Running at: ${new Date().toISOString()}`);
  console.log(`Target:     ${BASE_URL}`);

  let successes = 0;
  for (const ticker of TICKERS) {
    const ok = await runTest(ticker);
    if (ok) successes++;
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log(`${successes} of ${TICKERS.length} memos generated successfully.`);
}

main();
