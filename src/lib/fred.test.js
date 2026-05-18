/**
 * Simple test harness for fred.js — run with:
 *   node src/lib/fred.test.js
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { fetchFredMacroContext } from "./fred.js";

async function main() {
  console.log("FRED Macro Context — Test Harness");
  console.log(`Running at: ${new Date().toISOString()}`);

  try {
    const result = await fetchFredMacroContext();

    console.log(`\nfetchedAt: ${result.fetchedAt}`);
    console.log(`window:    ${result.window}`);

    for (const [key, data] of Object.entries(result.series)) {
      console.log(`\n${"=".repeat(60)}`);
      if (!data) {
        console.log(`${key}: null (missing)`);
        continue;
      }
      console.log(`${key}`);
      console.log(`  Series ID:    ${data.seriesId}`);
      console.log(`  Title:        ${data.title}`);
      console.log(`  Observations: ${data.observations.length}`);
      if (data.observations.length > 0) {
        const latest = data.observations[0];
        const oldest = data.observations[data.observations.length - 1];
        console.log(`  Latest:       ${latest.value} (${latest.date})`);
        console.log(`  Oldest:       ${oldest.value} (${oldest.date})`);
      }
    }

    console.log(`\n${"=".repeat(60)}`);
    if (result.missing.length > 0) {
      console.log(`Missing: ${result.missing.join(", ")}`);
    } else {
      console.log(`Missing: (none)`);
    }
    console.log(`Source:  ${result.source.name}`);
  } catch (err) {
    console.log(`ERROR: ${err.message}`);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("Done.");
}

main();
