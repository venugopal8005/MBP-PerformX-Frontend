import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = [
  "src/components/issues/EvaluationSection.jsx",
  "src/components/issues/EvaluationSummary.jsx",
  "src/utils/evaluations.js",
];
const forbidden = /\b(caused|fixed|successful|failed intervention|effective|ineffective|worked|did not work|led to|resulted in)\b/i;

test("[causal language] Phase 4 user-facing source avoids causal outcome claims", async () => {
  for (const file of files) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.equal(forbidden.test(source), false, `${file} contains forbidden Evaluation outcome wording`);
  }
});

test("[causal language] bounded status labels describe observed movement only", async () => {
  const source = await readFile(new URL("../src/utils/evaluations.js", import.meta.url), "utf8");
  assert.match(source, /Improved movement observed/);
  assert.match(source, /Worsened movement observed/);
  assert.match(source, /not isolated/);
  assert.equal(/Success|Failure/.test(source), false);
});
