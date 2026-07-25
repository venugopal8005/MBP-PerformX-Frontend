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
  clientId: text(value.clientId),
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
  lifecycleRevision: count(value.lifecycleRevision),
  latestInterventionId: text(value.latestInterventionId),
  interventionCount: count(value.interventionCount) ?? 0,
  lastInterventionAt: text(value.lastInterventionAt),
  interventionRevision: count(value.interventionRevision) ?? 0,
  predecessorIssueId: text(value.predecessorIssueId),
  hasPredecessor: Boolean(text(value.predecessorIssueId)),
  monitoringStartedAt: text(value.monitoringStartedAt),
  monitoringReason: text(value.monitoringReason),
  monitoringInterventionId: text(value.monitoringInterventionId),
  worseningStreak: count(value.worseningStreak) ?? 0,
  worseningMetric: text(value.worseningMetric),
  worseningStartedAt: text(value.worseningStartedAt),
  latestEvaluationId: text(value.latestEvaluationId),
  latestEvaluationStatus: text(value.latestEvaluationStatus),
  latestEvaluationResult: text(value.latestEvaluationResult),
  latestEvaluationConfidence: text(value.latestEvaluationConfidence),
  latestEvaluationAt: text(value.latestEvaluationAt),
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
  reportRunId: text(value.reportRunId),
  campaignId: text(value.campaignId),
  occurrenceNumber: positiveCount(value.occurrenceNumber),
  matchingStatus: text(value.matchingStatus),
  matchingReason: text(value.matchingReason),
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

export const issueStablePeriodLabel = (predecessor, current) => {
  const resolvedAt = Date.parse(predecessor?.resolvedAt || "");
  const openedAt = Date.parse(current?.openedAt || "");
  if (!Number.isFinite(resolvedAt) || !Number.isFinite(openedAt) || openedAt < resolvedAt) {
    return "Stable period unavailable";
  }
  const totalHours = Math.floor((openedAt - resolvedAt) / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days && hours) return `${days} ${days === 1 ? "day" : "days"}, ${hours} ${hours === 1 ? "hour" : "hours"}`;
  if (days) return `${days} ${days === 1 ? "day" : "days"}`;
  return `${totalHours} ${totalHours === 1 ? "hour" : "hours"}`;
};

export const issueLifecycleMessages = (issue) => {
  if (!issue) return [];
  const messages = [];
  if (issue.monitoringInterventionId || issue.monitoringStartedAt) {
    messages.push({
      key: "action_recorded",
      title: "Action recorded",
      description: issue.monitoringStartedAt
        ? `Monitoring began ${issueDate(issue.monitoringStartedAt)}.`
        : "The Issue entered monitoring after a recorded action.",
    });
  }
  if (issue.status === "monitoring") {
    messages.push({
      key: "monitoring",
      title: "Issue is monitoring",
      description: issue.latestEvaluationStatus === "awaiting_follow_up"
        ? "Awaiting enough persisted follow-up evidence for an Evaluation."
        : "Narrative is waiting for enough trusted evidence before changing the lifecycle state.",
    });
  }
  if (issue.status === "monitoring" && issue.worseningStreak === 1) {
    messages.push({
      key: "one_concern",
      title: "One concerning observation",
      description: "One worsening observation was recorded, but this Issue has not been reopened.",
    });
  }
  if (issue.status === "open" && issue.reopenedAt && issue.worseningStreak > 0) {
    const repeated = issue.worseningStreak > 1;
    messages.push({
      key: "reopened",
      title: repeated
        ? "Repeated worsening reopened the Issue"
        : "Strong critical evidence reopened the Issue",
      description: repeated
        ? `${issue.worseningStreak} consecutive concerning observations were persisted${issue.worseningMetric ? ` for ${issueLabel(issue.worseningMetric)}` : ""}.`
        : `One critical trusted observation was sufficient under the persisted lifecycle policy${issue.worseningMetric ? ` for ${issueLabel(issue.worseningMetric)}` : ""}.`,
    });
  }
  if (issue.status === "monitoring" && issue.absenceStreak > 0) {
    messages.push({
      key: "clean_evidence",
      title: "Clean evidence is accumulating",
      description: `${issue.absenceStreak} trusted clean ${issue.absenceStreak === 1 ? "observation has" : "observations have"} been persisted. Resolution has not been assumed early.`,
    });
  }
  if (issue.status === "resolved") {
    messages.push({
      key: "resolved",
      title: "Issue resolved after required evidence",
      description: issue.resolvedAt
        ? `The persisted lifecycle resolved this Issue ${issueDate(issue.resolvedAt)}.`
        : "The persisted lifecycle recorded the required recovery evidence.",
    });
  }
  return messages;
};

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
