import assert from "node:assert/strict";
import test from "node:test";

import {
  EVALUATION_EFFECTIVE_STATUSES,
  EVALUATION_METRICS,
  EVALUATION_STATUSES,
  METRIC_CLASSIFICATIONS,
  TOP_LEVEL_OBSERVED_RESULTS,
  EvaluationContractError,
  evaluationReasonLabel,
  formatEvaluationAbsoluteDelta,
  formatEvaluationMetric,
  formatEvaluationRelativeDelta,
  normalizeEvaluationDetail,
  normalizeEvaluationListItem,
  normalizeEvaluationMetricResult,
} from "../src/utils/evaluations.js";

const ids = {
  evaluation: "111111111111111111111111",
  intervention: "222222222222222222222222",
  issue: "333333333333333333333333",
  client: "444444444444444444444444",
  report: "555555555555555555555555",
  run: "666666666666666666666666",
  agency: "777777777777777777777777",
  account: "888888888888888888888888",
};

const listItem = (overrides = {}) => ({
  id: ids.evaluation,
  interventionId: ids.intervention,
  issueId: ids.issue,
  clientId: ids.client,
  reportId: ids.report,
  sourceReportRunId: ids.run,
  sequence: 2,
  actionType: "replace_creative",
  status: "ready",
  effectiveStatus: "ready",
  primaryMetric: "ctr",
  watchedMetrics: ["ctr", "spend"],
  baselineValue: 2,
  followUpValue: 2.5,
  absoluteDelta: 0.5,
  relativeDelta: 0.25,
  observedResult: "improved",
  interpretability: "directional",
  reasonCodes: [],
  calculatedAt: "2026-07-18T10:00:00.000Z",
  ...overrides,
});

const snapshot = (values = {}, window = { start: "2026-07-17", end: "2026-07-17", timezone: "UTC", cadence: "daily" }) => ({
  reportRunId: ids.run,
  window,
  campaignId: "campaign-1",
  campaignName: "Prospecting",
  currency: "USD",
  attributionWindows: ["7d_click"],
  metaBindingRevision: 3,
  provenance: "scheduled_window",
  values: {
    spend: 100, impressions: 1000, clicks: 20, conversions: 2, conversionValue: 200,
    ctr: 2, cpc: 5, cpm: 100, cpa: 50, roas: 2, conversionRate: 10,
    ...values,
  },
  rowCount: 1,
  sourceLevel: "campaign",
  completeness: "complete",
});

const detail = (overrides = {}) => ({
  ...listItem(),
  agencyId: ids.agency,
  metaAdAccountId: ids.account,
  campaignId: "campaign-1",
  reportIdAtAction: ids.report,
  schemaVersion: 1,
  ruleVersion: 1,
  evidenceVersion: 1,
  normalizationVersion: 1,
  triggerType: "report_run",
  intent: { mode: "auto_resolved", primaryMetric: "ctr", watchedMetrics: ["ctr", "spend"], resolutionSource: "issue_metric_family", ruleVersion: 1 },
  baseline: snapshot(),
  followUp: snapshot({ ctr: 2.5 }, { start: "2026-07-18", end: "2026-07-18", timezone: "UTC", cadence: "daily" }),
  metricResults: [{ metric: "ctr", directionality: "higher_is_better", unit: "percent", baselineValue: 2, followUpValue: 2.5, absoluteDelta: 0.5, relativeDelta: 0.25, minimumEvidenceMet: true, material: true, classification: "improved", reasonCodes: [] }],
  overlapInterventionIds: [],
  evidenceCompleteness: "complete",
  summary: "CTR increased across the bounded persisted windows.",
  supersedesEvaluationId: null,
  supersededByEvaluationId: null,
  invalidationContext: null,
  canRefresh: true,
  ...overrides,
});

test("normalization accepts every persisted and effective Evaluation status", () => {
  for (const status of EVALUATION_STATUSES) {
    assert.equal(normalizeEvaluationListItem(listItem({ status, effectiveStatus: status })).status, status);
  }
  assert.equal(normalizeEvaluationListItem(listItem({ effectiveStatus: "superseded" })).effectiveStatus, "superseded");
  assert.equal(EVALUATION_EFFECTIVE_STATUSES.length, 6);
});

test("[contract] normalization accepts exactly the four top-level observed results", () => {
  for (const observedResult of TOP_LEVEL_OBSERVED_RESULTS) {
    assert.equal(normalizeEvaluationListItem(listItem({ observedResult })).observedResult, observedResult);
  }
  assert.deepEqual(TOP_LEVEL_OBSERVED_RESULTS, ["improved", "worsened", "no_material_change", "mixed"]);
  assert.equal(normalizeEvaluationListItem(listItem({ observedResult: null })).observedResult, null);
});

test("[contract] status and metric-only classifications are rejected as top-level results", () => {
  for (const observedResult of ["context_only", "insufficient_data", "not_evaluable"]) {
    assert.throws(() => normalizeEvaluationListItem(listItem({ observedResult })), EvaluationContractError);
  }
});

test("[contract] every exact metric classification is accepted and unknown classifications fail closed", () => {
  const value = detail().metricResults[0];
  for (const classification of METRIC_CLASSIFICATIONS) {
    assert.equal(normalizeEvaluationMetricResult({ ...value, classification }).classification, classification);
  }
  assert.deepEqual(METRIC_CLASSIFICATIONS, ["improved", "worsened", "no_material_change", "context_only", "insufficient_data", "not_evaluable"]);
  assert.throws(() => normalizeEvaluationMetricResult({ ...value, classification: "mixed" }), EvaluationContractError);
});

test("normalization accepts every supported metric without inventing values", () => {
  for (const primaryMetric of EVALUATION_METRICS) {
    const value = normalizeEvaluationListItem(listItem({ primaryMetric, watchedMetrics: [primaryMetric], baselineValue: 0, followUpValue: null }));
    assert.equal(value.primaryMetric, primaryMetric);
    assert.equal(value.baselineValue, 0);
    assert.equal(value.followUpValue, null);
  }
});

test("malformed IDs, enums, sequences, dates, metrics, and reason codes fail closed", () => {
  const malformed = [
    { id: "bad" },
    { status: "successful" },
    { effectiveStatus: "effective" },
    { sequence: 0 },
    { calculatedAt: "not-a-date" },
    { primaryMetric: "reach", watchedMetrics: ["reach"] },
    { reasonCodes: ["Internal error: raw value"] },
  ];
  for (const overrides of malformed) {
    assert.throws(() => normalizeEvaluationListItem(listItem(overrides)), EvaluationContractError);
  }
});

test("[contract] detail normalization validates windows, metric results, revisions, and permissions", () => {
  const normalized = normalizeEvaluationDetail(detail());
  assert.equal(normalized.baseline.values.ctr, 2);
  assert.equal(normalized.followUp.window.timezone, "UTC");
  assert.equal(normalized.metricResults[0].absoluteDelta, 0.5);
  assert.equal(normalized.canRefresh, true);
  assert.throws(() => normalizeEvaluationDetail(detail({ canRefresh: "yes" })), EvaluationContractError);
  assert.throws(() => normalizeEvaluationDetail(detail({ ruleVersion: -1 })), EvaluationContractError);
  assert.throws(() => normalizeEvaluationDetail(detail({ baseline: { ...snapshot(), window: { ...snapshot().window, start: "18-07-2026" } } })), EvaluationContractError);
});

test("[date-window] real calendar validation accepts leap dates and rejects impossible dates", () => {
  const validLeap = detail({
    baseline: snapshot({}, { start: "2028-02-29", end: "2028-02-29", timezone: "UTC", cadence: "daily" }),
    followUp: snapshot({}, { start: "2028-03-01", end: "2028-03-01", timezone: "UTC", cadence: "daily" }),
  });
  assert.equal(normalizeEvaluationDetail(validLeap).baseline.window.start, "2028-02-29");
  for (const start of ["2026-00-10", "2026-13-10", "2026-02-30", "2026-99-99", "2027-02-29"]) {
    assert.throws(() => normalizeEvaluationDetail(detail({ baseline: { ...snapshot(), window: { ...snapshot().window, start } } })), EvaluationContractError);
  }
});

test("[date-window] inclusive windows enforce cadence duration and reject reversed ranges", () => {
  assert.doesNotThrow(() => normalizeEvaluationDetail(detail()));
  const invalidWindows = [
    { start: "2026-07-18", end: "2026-07-17", timezone: "UTC", cadence: "daily" },
    { start: "2026-07-10", end: "2026-07-15", timezone: "UTC", cadence: "weekly" },
    { start: "2026-07-01", end: "2026-07-29", timezone: "UTC", cadence: "monthly" },
  ];
  for (const window of invalidWindows) {
    assert.throws(() => normalizeEvaluationDetail(detail({ baseline: snapshot({}, window) })), EvaluationContractError);
  }
  assert.doesNotThrow(() => normalizeEvaluationDetail(detail({
    baseline: snapshot({}, { start: "2026-07-01", end: "2026-07-07", timezone: "UTC", cadence: "weekly" }),
    followUp: snapshot({}, { start: "2026-07-08", end: "2026-07-14", timezone: "UTC", cadence: "weekly" }),
  })));
});

test("[date-window] baseline must finish before the follow-up window begins", () => {
  assert.throws(() => normalizeEvaluationDetail(detail({
    baseline: snapshot({}, { start: "2026-07-18", end: "2026-07-18", timezone: "UTC", cadence: "daily" }),
    followUp: snapshot({}, { start: "2026-07-17", end: "2026-07-17", timezone: "UTC", cadence: "daily" }),
  })), EvaluationContractError);
  assert.throws(() => normalizeEvaluationDetail(detail({
    baseline: snapshot({}, { start: "2026-07-17", end: "2026-07-17", timezone: "UTC", cadence: "daily" }),
    followUp: snapshot({}, { start: "2026-07-17", end: "2026-07-17", timezone: "UTC", cadence: "daily" }),
  })), EvaluationContractError);
});

test("[contract] serialized versions, provenance, and completeness use field-specific backend enums", () => {
  assert.equal(normalizeEvaluationDetail(detail()).schemaVersion, 1);
  for (const field of ["schemaVersion", "evidenceVersion", "normalizationVersion"]) {
    assert.throws(() => normalizeEvaluationDetail(detail({ [field]: 2 })), EvaluationContractError);
  }
  for (const provenance of ["scheduled_window", "scheduled_manual_window"]) {
    assert.equal(normalizeEvaluationDetail(detail({ baseline: { ...snapshot(), provenance } })).baseline.provenance, provenance);
  }
  assert.throws(() => normalizeEvaluationDetail(detail({ baseline: { ...snapshot(), provenance: "historical_fallback" } })), EvaluationContractError);
  for (const completeness of ["complete", "zero_delivery"]) {
    assert.equal(normalizeEvaluationDetail(detail({ baseline: { ...snapshot(), completeness } })).baseline.completeness, completeness);
  }
  assert.throws(() => normalizeEvaluationDetail(detail({ baseline: { ...snapshot(), completeness: "partial" } })), EvaluationContractError);
  for (const evidenceCompleteness of ["complete", "partial", "unavailable"]) {
    assert.equal(normalizeEvaluationDetail(detail({ evidenceCompleteness })).evidenceCompleteness, evidenceCompleteness);
  }
  assert.throws(() => normalizeEvaluationDetail(detail({ evidenceCompleteness: "zero_delivery" })), EvaluationContractError);
});

test("normalization rejects non-finite numbers while preserving zero and null", () => {
  assert.equal(normalizeEvaluationListItem(listItem({ baselineValue: 0 })).baselineValue, 0);
  assert.equal(normalizeEvaluationListItem(listItem({ baselineValue: null })).baselineValue, null);
  for (const baselineValue of [Number.NaN, Infinity, -Infinity]) {
    assert.throws(() => normalizeEvaluationListItem(listItem({ baselineValue })), EvaluationContractError);
  }
});

test("normalization allowlists output and omits privacy and transport fields", () => {
  const normalized = normalizeEvaluationDetail(detail({ requestHash: "secret", idempotencyKey: "secret", actorEmail: "secret@example.com", rawRows: [{ secret: true }], html: "secret", processingLock: { token: "secret" } }));
  for (const key of ["requestHash", "idempotencyKey", "actorEmail", "rawRows", "html", "processingLock"]) {
    assert.equal(Object.hasOwn(normalized, key), false);
  }
});

test("metric formatting uses evidence units, currency, signed deltas, and controlled placeholders", () => {
  assert.equal(formatEvaluationMetric("ctr", 0), "0%");
  assert.equal(formatEvaluationMetric("roas", 2.5), "2.5x");
  assert.match(formatEvaluationMetric("spend", 12.5, { currencyCode: "USD" }), /\$12\.50/);
  assert.equal(formatEvaluationMetric("spend", 12.5), "Unavailable");
  assert.equal(formatEvaluationMetric("ctr", null), "Unavailable");
  assert.equal(formatEvaluationMetric("ctr", Infinity), "Unavailable");
  assert.equal(formatEvaluationRelativeDelta(0.125), "+12.5%");
  assert.equal(formatEvaluationRelativeDelta(-0.1), "-10%");
  assert.equal(formatEvaluationAbsoluteDelta({ absoluteDelta: 0.2, unit: "percent" }), "+0.2 percentage points");
});

test("known and unknown reason codes produce bounded observational explanations", () => {
  assert.match(evaluationReasonLabel("overlapping_intervention"), /not isolated/);
  assert.match(evaluationReasonLabel("follow_up_timeout"), /Persisted evidence remained insufficient/);
  assert.equal(evaluationReasonLabel("private_backend_reason"), "Additional persisted evidence context is unavailable.");
  assert.equal(evaluationReasonLabel("private_backend_reason").includes("private_backend_reason"), false);
});

test("[contract] every current backend Evaluation reason has a bounded explanation", () => {
  const backendReasons = [
    "awaiting_follow_up", "intent_unresolved", "action_not_applicable",
    "tracking_comparability_unavailable", "observational_intent", "unsupported_metric",
    "neutral_only_intent", "historical_fallback_evidence", "source_evidence_unvalidated",
    "baseline_not_found", "baseline_evidence_missing", "baseline_stale", "follow_up_not_found",
    "follow_up_evidence_missing", "follow_up_timeout", "window_mismatch",
    "window_duration_mismatch", "cadence_mismatch", "timezone_mismatch", "currency_mismatch",
    "attribution_mismatch", "attribution_not_comparable", "binding_revision_mismatch",
    "account_binding_changed", "ownership_mismatch", "campaign_mismatch",
    "campaign_evidence_missing", "malformed_evidence", "minimum_volume_not_met",
    "zero_denominator", "zero_baseline", "overlapping_intervention",
    "overlap_completeness_unavailable", "intervention_superseded", "intervention_cancelled",
    "client_archived", "account_reassigned",
  ];
  const fallback = evaluationReasonLabel("future_reason");
  for (const reason of backendReasons) {
    const label = evaluationReasonLabel(reason);
    assert.notEqual(label, fallback, `${reason} must not use the generic fallback`);
    assert.equal(label.includes(reason), false, `${reason} must not render raw`);
  }
  assert.equal(new Set(backendReasons).size, 37);
});

export { detail as evaluationDetailFixture, listItem as evaluationListFixture, ids as evaluationIds };
