import assert from "node:assert/strict";

import { getSignalAppearance } from "./signalAppearance.js";

const cases = [
  {
    name: "critical severity stays critical",
    signal: { severity: "critical", title: "ROAS collapsed" },
    tone: "critical",
  },
  {
    name: "problem text is not treated as success when severity is stable",
    signal: {
      severity: "stable",
      title: "People are seeing the ads, but fewer are engaging.",
      description: "Engagement quality drop and weaker creative-message fit.",
    },
    tone: "warning",
  },
  {
    name: "data quality signals use info treatment",
    signal: { type: "data_quality_issue", title: "Missing data for conversion rate" },
    tone: "info",
  },
  {
    name: "explicit opportunity can be green",
    signal: { type: "healthy_scaling", title: "Campaign is ready to scale" },
    tone: "success",
  },
  {
    name: "no recent signal stays neutral",
    signal: { title: "No recent signal" },
    tone: "neutral",
  },
];

for (const testCase of cases) {
  assert.equal(getSignalAppearance(testCase.signal).tone, testCase.tone, testCase.name);
}
