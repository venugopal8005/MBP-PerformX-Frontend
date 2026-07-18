const objectIdPattern = /^[a-f\d]{24}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const reasonPattern = /^[a-z][a-z0-9_]{0,127}$/;

export const EVALUATION_STATUSES = Object.freeze([
  "awaiting_follow_up",
  "ready",
  "insufficient_data",
  "not_evaluable",
  "invalidated",
]);
export const EVALUATION_EFFECTIVE_STATUSES = Object.freeze([
  ...EVALUATION_STATUSES,
  "superseded",
]);
export const TOP_LEVEL_OBSERVED_RESULTS = Object.freeze([
  "improved",
  "worsened",
  "no_material_change",
  "mixed",
]);
export const METRIC_CLASSIFICATIONS = Object.freeze([
  "improved",
  "worsened",
  "no_material_change",
  "context_only",
  "insufficient_data",
  "not_evaluable",
]);
export const EVALUATION_METRICS = Object.freeze([
  "ctr",
  "cpc",
  "cpm",
  "cpa",
  "roas",
  "conversions",
  "conversion_value",
  "conversion_rate",
  "clicks",
  "impressions",
  "spend",
]);

const observedResultValues = new Set(TOP_LEVEL_OBSERVED_RESULTS);
const metricClassificationValues = new Set(METRIC_CLASSIFICATIONS);
const interpretabilityValues = new Set(["directional", "observational", "not_interpretable"]);
const triggerValues = new Set(["intervention_recorded", "report_run", "manual_refresh", "reconciliation", "correction", "cancellation", "rule_upgrade"]);
const directionalityValues = new Set(["higher_is_better", "lower_is_better", "context_only"]);
const unitValues = new Set(["percent", "currency", "ratio", "count"]);
const cadenceValues = new Set(["daily", "weekly", "monthly"]);
const cadenceDays = Object.freeze({ daily: 1, weekly: 7, monthly: 30 });
const snapshotProvenanceValues = new Set(["scheduled_window", "scheduled_manual_window"]);
const snapshotCompletenessValues = new Set(["complete", "zero_delivery"]);
const evidenceCompletenessValues = new Set(["complete", "partial", "unavailable"]);
const intentModes = new Set(["auto_resolved", "explicit", "observational", "not_applicable", "unresolved"]);
const metricSet = new Set(EVALUATION_METRICS);
const statusSet = new Set(EVALUATION_STATUSES);
const effectiveStatusSet = new Set(EVALUATION_EFFECTIVE_STATUSES);

export class EvaluationContractError extends Error {
  constructor(message = "Evaluation data is unavailable.") {
    super(message);
    this.name = "EvaluationContractError";
  }
}

const contract = (condition) => {
  if (!condition) throw new EvaluationContractError();
};
const record = (value) => value && typeof value === "object" && !Array.isArray(value);
const text = (value, maximum, { nullable = false } = {}) => {
  if (value == null && nullable) return null;
  contract(typeof value === "string" && value.length <= maximum);
  return value;
};
const nonEmptyText = (value, maximum) => {
  contract(typeof value === "string" && value.length > 0 && value.length <= maximum && value.trim() === value);
  return value;
};
const timezoneText = (value) => {
  const timezone = nonEmptyText(value, 128);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
  } catch {
    contract(false);
  }
  return timezone;
};
const currencyText = (value) => {
  contract(typeof value === "string" && /^[A-Z]{3}$/.test(value));
  return value;
};
const id = (value, { nullable = false } = {}) => {
  if ((value == null || value === "") && nullable) return null;
  contract(typeof value === "string" && objectIdPattern.test(value));
  return value;
};
const finite = (value, { nullable = true } = {}) => {
  if (value == null && nullable) return null;
  contract(typeof value === "number" && Number.isFinite(value));
  return value;
};
const integer = (value, minimum = 0) => {
  contract(Number.isSafeInteger(value) && value >= minimum);
  return value;
};
const isoDate = (value, { nullable = false } = {}) => {
  if (value == null && nullable) return null;
  contract(typeof value === "string" && Number.isFinite(Date.parse(value)));
  return value;
};
const enumValue = (value, values, { nullable = false } = {}) => {
  if (value == null && nullable) return null;
  contract(values.has(value));
  return value;
};
const reasonCodes = (value) => {
  contract(Array.isArray(value) && value.length <= 16);
  return value.map((item) => {
    contract(typeof item === "string" && reasonPattern.test(item));
    return item;
  });
};
const metrics = (value) => {
  contract(Array.isArray(value) && value.length <= 6);
  return value.map((item) => enumValue(item, metricSet));
};

const dateOnlyParts = (value) => {
  contract(typeof value === "string" && datePattern.test(value));
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  contract(
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
  return { value, ordinal: Math.floor(date.getTime() / 86_400_000) };
};

const normalizeWindow = (value) => {
  contract(record(value));
  const start = dateOnlyParts(value.start);
  const end = dateOnlyParts(value.end);
  const cadence = enumValue(value.cadence, cadenceValues);
  contract(start.ordinal <= end.ordinal);
  contract(end.ordinal - start.ordinal + 1 === cadenceDays[cadence]);
  return {
    start: start.value,
    end: end.value,
    timezone: timezoneText(value.timezone),
    cadence,
  };
};

const normalizeMetricValues = (value) => {
  contract(record(value));
  return Object.fromEntries(EVALUATION_METRICS.map((metric) => {
    const key = metric === "conversion_value"
      ? "conversionValue"
      : metric === "conversion_rate"
        ? "conversionRate"
        : metric;
    return [metric, finite(value[key])];
  }));
};

export const normalizeEvaluationEvidence = (value) => {
  if (value == null) return null;
  contract(record(value));
  contract(Array.isArray(value.attributionWindows) && value.attributionWindows.length <= 8);
  return {
    reportRunId: id(value.reportRunId),
    window: normalizeWindow(value.window),
    campaignId: nonEmptyText(value.campaignId, 256),
    campaignName: text(value.campaignName, 512, { nullable: true }),
    currency: currencyText(value.currency),
    attributionWindows: value.attributionWindows.map((item) => nonEmptyText(item, 64)),
    metaBindingRevision: integer(value.metaBindingRevision),
    provenance: enumValue(value.provenance, snapshotProvenanceValues),
    values: normalizeMetricValues(value.values),
    rowCount: integer(value.rowCount),
    sourceLevel: enumValue(value.sourceLevel, new Set(["ad", "campaign"])),
    completeness: enumValue(value.completeness, snapshotCompletenessValues),
  };
};

export const normalizeEvaluationMetricResult = (value) => {
  contract(record(value));
  contract(typeof value.minimumEvidenceMet === "boolean" && typeof value.material === "boolean");
  return {
    metric: enumValue(value.metric, metricSet),
    directionality: enumValue(value.directionality, directionalityValues),
    unit: enumValue(value.unit, unitValues),
    baselineValue: finite(value.baselineValue),
    followUpValue: finite(value.followUpValue),
    absoluteDelta: finite(value.absoluteDelta),
    relativeDelta: finite(value.relativeDelta),
    minimumEvidenceMet: value.minimumEvidenceMet,
    material: value.material,
    classification: enumValue(value.classification, metricClassificationValues),
    reasonCodes: reasonCodes(value.reasonCodes),
  };
};

export const normalizeEvaluationListItem = (value) => {
  contract(record(value));
  const status = enumValue(value.status, statusSet);
  const effectiveStatus = enumValue(value.effectiveStatus, effectiveStatusSet);
  contract(effectiveStatus === status || effectiveStatus === "superseded");
  return {
    id: id(value.id),
    interventionId: id(value.interventionId),
    issueId: id(value.issueId),
    clientId: id(value.clientId),
    reportId: id(value.reportId),
    sourceReportRunId: id(value.sourceReportRunId, { nullable: true }),
    sequence: integer(value.sequence, 1),
    actionType: text(value.actionType, 64),
    status,
    effectiveStatus,
    primaryMetric: value.primaryMetric == null ? null : enumValue(value.primaryMetric, metricSet),
    watchedMetrics: metrics(value.watchedMetrics),
    baselineValue: finite(value.baselineValue),
    followUpValue: finite(value.followUpValue),
    absoluteDelta: finite(value.absoluteDelta),
    relativeDelta: finite(value.relativeDelta),
    observedResult: enumValue(value.observedResult, observedResultValues, { nullable: true }),
    interpretability: enumValue(value.interpretability, interpretabilityValues),
    reasonCodes: reasonCodes(value.reasonCodes),
    calculatedAt: isoDate(value.calculatedAt),
  };
};

export const normalizeEvaluationDetail = (value) => {
  const base = normalizeEvaluationListItem(value);
  contract(Array.isArray(value.metricResults) && value.metricResults.length <= 6);
  contract(Array.isArray(value.overlapInterventionIds) && value.overlapInterventionIds.length <= 25);
  contract(record(value.intent));
  contract(typeof value.canRefresh === "boolean");
  const baseline = normalizeEvaluationEvidence(value.baseline);
  const followUp = normalizeEvaluationEvidence(value.followUp);
  if (baseline && followUp) {
    contract(dateOnlyParts(baseline.window.end).ordinal < dateOnlyParts(followUp.window.start).ordinal);
  }
  return {
    ...base,
    agencyId: id(value.agencyId),
    metaAdAccountId: id(value.metaAdAccountId),
    campaignId: text(value.campaignId, 256),
    reportIdAtAction: id(value.reportIdAtAction),
    schemaVersion: enumValue(value.schemaVersion, new Set([1])),
    ruleVersion: integer(value.ruleVersion, 1),
    evidenceVersion: enumValue(value.evidenceVersion, new Set([1])),
    normalizationVersion: enumValue(value.normalizationVersion, new Set([1])),
    triggerType: enumValue(value.triggerType, triggerValues),
    intent: {
      mode: enumValue(value.intent.mode, intentModes),
      primaryMetric: value.intent.primaryMetric == null ? null : enumValue(value.intent.primaryMetric, metricSet),
      watchedMetrics: metrics(value.intent.watchedMetrics),
      resolutionSource: text(value.intent.resolutionSource, 64),
      ruleVersion: integer(value.intent.ruleVersion, 1),
    },
    baseline,
    followUp,
    metricResults: value.metricResults.map(normalizeEvaluationMetricResult),
    overlapInterventionIds: value.overlapInterventionIds.map((item) => id(item)),
    evidenceCompleteness: enumValue(value.evidenceCompleteness, evidenceCompletenessValues),
    summary: text(value.summary, 500),
    supersedesEvaluationId: id(value.supersedesEvaluationId, { nullable: true }),
    supersededByEvaluationId: id(value.supersededByEvaluationId, { nullable: true }),
    invalidationContext: value.invalidationContext == null ? null : {
      reason: enumValue(value.invalidationContext.reason, new Set(["intervention_superseded", "intervention_cancelled"])),
      invalidatedAt: isoDate(value.invalidationContext.invalidatedAt),
      sourceInterventionId: id(value.invalidationContext.sourceInterventionId),
    },
    canRefresh: value.canRefresh,
  };
};

export const evaluationStatusLabel = (status) => ({
  awaiting_follow_up: "Awaiting follow-up",
  ready: "Observed result available",
  insufficient_data: "Insufficient evidence",
  not_evaluable: "Not evaluable",
  invalidated: "Historical evaluation",
  superseded: "Earlier evaluation version",
}[status] || "Evaluation unavailable");

export const evaluationResultLabel = (result) => ({
  improved: "Improved movement observed",
  worsened: "Worsened movement observed",
  no_material_change: "No material change",
  mixed: "Mixed movement",
}[result] || "Result unavailable");

export const evaluationMetricClassificationLabel = (classification) => ({
  improved: "Improved movement observed",
  worsened: "Worsened movement observed",
  no_material_change: "No material change",
  context_only: "Supporting context",
  insufficient_data: "Insufficient evidence",
  not_evaluable: "Not evaluable",
}[classification] || "Classification unavailable");

export const evaluationMetricLabel = (metric) => ({
  ctr: "CTR", cpc: "CPC", cpm: "CPM", cpa: "CPA", roas: "ROAS",
  conversions: "Conversions", conversion_value: "Conversion value",
  conversion_rate: "Conversion rate", clicks: "Clicks", impressions: "Impressions", spend: "Spend",
}[metric] || "Metric unavailable");

export const evaluationInterpretabilityLabel = (value) => ({
  directional: "Directional comparison",
  observational: "Observational comparison",
  not_interpretable: "Not interpretable",
}[value] || "Unavailable");

const reasonLabels = Object.freeze({
  awaiting_follow_up: "The follow-up window has not produced persisted evidence yet.",
  intent_unresolved: "The recorded action does not identify a supported metric for comparison.",
  action_not_applicable: "This action type does not produce an evaluable comparison.",
  tracking_comparability_unavailable: "Tracking changes cannot be compared reliably across these persisted windows.",
  observational_intent: "This comparison is observational and does not isolate the recorded action.",
  unsupported_metric: "A watched metric is not supported for evaluation.",
  neutral_only_intent: "The recorded metrics provide supporting context but no directional comparison.",
  historical_fallback_evidence: "Fallback history is not eligible for this comparison.",
  source_evidence_unvalidated: "The persisted source evidence could not be validated.",
  follow_up_not_found: "No eligible persisted follow-up window was found.",
  follow_up_evidence_missing: "Persisted follow-up evidence is missing.",
  follow_up_timeout: "Persisted evidence remained insufficient after the follow-up timeout.",
  baseline_not_found: "No eligible persisted baseline window was found.",
  baseline_evidence_missing: "Persisted baseline evidence is missing.",
  baseline_stale: "The available baseline evidence is outside the allowed freshness window.",
  window_mismatch: "The persisted evidence windows are not comparable.",
  window_duration_mismatch: "The persisted evidence windows have different durations.",
  cadence_mismatch: "The persisted evidence uses a different reporting cadence.",
  timezone_mismatch: "The persisted evidence uses a different reporting timezone.",
  currency_mismatch: "The persisted evidence uses different currencies across the comparison windows.",
  attribution_mismatch: "The attribution windows differ between evidence periods.",
  attribution_not_comparable: "The attribution windows are not comparable.",
  binding_revision_mismatch: "The Meta account binding revision differs across the comparison windows.",
  client_archived: "The Client is archived, so this evaluation is historical and read-only.",
  account_binding_changed: "The Meta account binding changed between the recorded evidence windows.",
  account_reassigned: "The assigned Meta account changed after the action was recorded.",
  ownership_mismatch: "Persisted evidence ownership does not match the recorded action.",
  campaign_mismatch: "Persisted evidence does not match the recorded campaign.",
  campaign_evidence_missing: "Persisted evidence for the recorded campaign is missing.",
  malformed_evidence: "The persisted evidence is incomplete or malformed.",
  overlapping_intervention: "Another recorded action overlaps this window, so the comparison is not isolated.",
  overlap_completeness_unavailable: "Overlap evidence is incomplete, so the comparison is not isolated.",
  zero_baseline: "The baseline is zero, so relative movement is unavailable.",
  minimum_volume_not_met: "The persisted evidence does not meet the minimum volume requirement.",
  zero_denominator: "A required rate denominator is zero.",
  intervention_superseded: "This evaluation is historical because the action record was corrected.",
  intervention_cancelled: "This evaluation is historical because the action record was cancelled.",
});

export const evaluationReasonLabel = (reason) => reasonLabels[reason] || "Additional persisted evidence context is unavailable.";

const number = (value, maximumFractionDigits = 2) => Number(value).toLocaleString("en-US", { maximumFractionDigits });
const currency = (value, code) => {
  if (!/^[A-Z]{3}$/.test(code || "")) return "Unavailable";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code, maximumFractionDigits: 2 }).format(value);
  } catch {
    return "Unavailable";
  }
};

export const formatEvaluationMetric = (metric, value, { currencyCode } = {}) => {
  if (value == null || typeof value !== "number" || !Number.isFinite(value)) return "Unavailable";
  if (["ctr", "conversion_rate"].includes(metric)) return `${number(value)}%`;
  if (["spend", "cpc", "cpm", "cpa", "conversion_value"].includes(metric)) return currency(value, currencyCode);
  if (metric === "roas") return `${number(value)}x`;
  return number(value, Number.isInteger(value) ? 0 : 2);
};

export const formatEvaluationRelativeDelta = (value) => {
  if (value == null || typeof value !== "number" || !Number.isFinite(value)) return "Unavailable";
  const percentage = value * 100;
  return `${percentage > 0 ? "+" : ""}${number(percentage)}%`;
};

export const formatEvaluationAbsoluteDelta = (result, currencyCode) => {
  const value = result?.absoluteDelta;
  if (value == null || typeof value !== "number" || !Number.isFinite(value)) return "Unavailable";
  const prefix = value > 0 ? "+" : "";
  if (result.unit === "percent") return `${prefix}${number(value)} percentage points`;
  if (result.unit === "currency") {
    const formatted = currency(Math.abs(value), currencyCode);
    return formatted === "Unavailable" ? formatted : `${value < 0 ? "-" : "+"}${formatted}`;
  }
  if (result.unit === "ratio") return `${prefix}${number(value)}x`;
  return `${prefix}${number(value, Number.isInteger(value) ? 0 : 2)}`;
};

export const formatEvaluationDate = (value) => {
  if (!value || !Number.isFinite(Date.parse(value))) return "Unavailable";
  return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
};

export const formatEvaluationWindow = (snapshot) => snapshot
  ? `${snapshot.window.start} to ${snapshot.window.end} · ${snapshot.window.cadence} · ${snapshot.window.timezone}`
  : "Unavailable";

export const evaluationRequestError = (error, fallback = "Evaluation is unavailable.") => {
  if (["AbortError", "CanceledError"].includes(error?.name) || error?.code === "ERR_CANCELED") return { aborted: true, message: "" };
  if (error instanceof EvaluationContractError) return { contract: true, message: "Evaluation data is unavailable." };
  const status = error?.response?.status;
  const code = error?.response?.data?.code;
  if (status === 404) return { status, code, message: "Evaluation history is unavailable." };
  if (status === 409) return { status, code, stale: code === "EVALUATION_INTERVENTION_REVISION_STALE", message: "The action record changed. Reload it before requesting another evaluation." };
  if (status === 429) return { status, code, rateLimited: true, message: "A persisted-evidence refresh was requested recently. Wait before trying again." };
  if (status === 503) return { status, code, unavailable: true, message: "Evaluation is temporarily unavailable." };
  if (!error?.response) return { network: true, message: "Network error. Existing evaluation history is still available." };
  return { status, code, message: fallback };
};

export const createEvaluationRefreshKey = () => {
  contract(typeof globalThis.crypto?.randomUUID === "function");
  return `evaluation-refresh:${globalThis.crypto.randomUUID()}`;
};
