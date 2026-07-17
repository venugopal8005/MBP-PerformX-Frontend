const text = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const count = (value) =>
  Number.isInteger(value) && value >= 0 ? value : null;

const positiveCount = (value) =>
  Number.isInteger(value) && value > 0 ? value : null;

const optionalValue = (value) =>
  value === null || value === undefined || value === "" ? undefined : value;

export const buildIssueQueryParams = ({
  clientId,
  reportId,
  metaAdAccountId,
  status,
  severity,
  cursor,
  limit = 20,
} = {}) =>
  Object.fromEntries(
    Object.entries({
      clientId: optionalValue(clientId),
      reportId: optionalValue(reportId),
      metaAdAccountId: optionalValue(metaAdAccountId),
      status: optionalValue(status),
      severity: optionalValue(severity),
      cursor: optionalValue(cursor),
      limit: optionalValue(limit),
    }).filter(([, value]) => value !== undefined)
  );

export const issueRequestError = (error, fallback) => {
  const status = error?.response?.status;
  if (status === 404) return "Issue not found.";
  if (status === 401 || status === 403) return "This Issue is not available in this workspace.";
  if (status === 400) return "The Issue request could not be completed.";
  return fallback;
};

const identityValue = (value) => ({
  value: text(value?.value),
  provenance: ["snapshot", "current_parent", "unknown"].includes(value?.provenance)
    ? value.provenance
    : "unknown",
});

const evidence = (value) => ({
  kind: text(value?.kind),
  observedAt: text(value?.observedAt),
  severity: text(value?.severity),
  title: text(value?.title),
  summary: text(value?.summary),
  primaryMetric: text(value?.primaryMetric),
  delta: typeof value?.delta === "number" && Number.isFinite(value.delta) ? value.delta : null,
  provenance: ["snapshot", "current_parent", "unknown"].includes(value?.provenance)
    ? value.provenance
    : "unknown",
});

export const mapIssue = (value = {}) => ({
  id: text(value.id),
  status: text(value.status),
  severity: text(value.severity),
  previousSeverity: text(value.previousSeverity),
  trend: text(value.trend),
  title: text(value.title),
  summary: text(value.summary),
  archetype: text(value.archetype),
  metricFamily: text(value.metricFamily),
  occurrenceCount: count(value.occurrenceCount),
  absenceStreak: count(value.absenceStreak),
  openedAt: text(value.openedAt),
  lastSeenAt: text(value.lastSeenAt),
  resolvedAt: text(value.resolvedAt),
  reopenCount: count(value.reopenCount),
  reopenedAt: text(value.reopenedAt),
  hasPredecessor: Boolean(text(value.predecessorIssueId)),
  identity: {
    client: identityValue(value.identity?.client),
    report: identityValue(value.identity?.report),
    metaAccount: identityValue(value.identity?.metaAccount),
    campaign: identityValue(value.identity?.campaign),
  },
  scope: {
    entityLevel: text(value.scope?.entity?.level),
    cadence: text(value.scope?.comparison?.cadence),
    timezone: text(value.scope?.comparison?.timezone),
  },
  latestEvidence: evidence(value.latestEvidence),
});

export const mapIssueSignal = (value = {}) => ({
  id: text(value.id),
  occurrenceNumber: positiveCount(value.occurrenceNumber),
  type: text(value.type),
  severity: text(value.severity),
  title: text(value.title),
  description: text(value.description),
  recommendation: text(value.recommendation),
  detectedAt: text(value.detectedAt),
  matchedAt: text(value.matchedAt),
});

export const issueDetailPath = (issue) =>
  issue?.id ? `/issues/${encodeURIComponent(issue.id)}` : null;

export const issueLabel = (value, fallback = "Unknown") =>
  text(value)?.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) ||
  fallback;

export const issueDate = (value, fallback = "Not recorded") => {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

export const issueScopeLabel = (issue) =>
  issue?.identity?.campaign?.value || "Unknown campaign";

export const issueEvidenceSummary = (issue) =>
  issue?.latestEvidence?.summary ||
  issue?.latestEvidence?.title ||
  "Evidence unavailable";

export const issueIdentityLabel = (value) => value?.value || "Identity unavailable";

export const issueProvenanceLabel = (value) => {
  if (value === "snapshot") return "Preserved snapshot";
  if (value === "current_parent") return "Current workspace record";
  return "Identity unavailable";
};

export const issueStatusVariant = (status) => {
  if (status === "open") return "critical";
  if (status === "monitoring") return "medium";
  return "low";
};

export const issueSeverityVariant = (severity) => {
  if (severity === "critical") return "critical";
  if (severity === "moderate") return "medium";
  if (severity === "stable") return "high";
  return "low";
};
