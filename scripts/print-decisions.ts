/**
 * Prints the engine's decision for every example action in every domain.
 * Useful for sanity-checking a change to a domain's numbers or to the
 * matrix itself without opening the UI. This is also exactly how the
 * expected-outcome table in src/domains/__tests__/domainConformance.test.ts
 * was produced — if you change a domain's data, run this first and update
 * that table to match, then let the test hold you to it.
 *
 * Usage: npm run decisions
 */
import { domains } from "../src/domains";
import { decide } from "../src/engine/decisionEngine";

for (const domain of domains) {
  console.log(`\n=== ${domain.id} ===`);
  for (const action of [...domain.actions, domain.failureCase]) {
    const d = decide(action, domain.thresholds, {});
    console.log(
      action.id.padEnd(28),
      d.outcome.padEnd(9),
      `conf=${d.confidence}`.padEnd(9),
      `risk=${d.risk}`.padEnd(9),
      `cov=${d.evidenceCoverage.toFixed(2)}`
    );
  }
}
