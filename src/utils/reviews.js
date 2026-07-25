export const REVIEW_TYPES = Object.freeze(["issue_review", "evaluation_review"]);
export const REVIEW_STATES = Object.freeze([
  "open",
  "acknowledged",
  "snoozed",
  "reviewed",
  "closed",
  "superseded",
]);
export const REVIEW_PRIORITIES = Object.freeze(["critical", "high", "normal"]);
export const REVIEW_REASONS = Object.freeze([
  "issue_created",
  "issue_reopened",
  "issue_new_evidence",
  "issue_severity_escalated",
  "intervention_cancelled",
  "evaluation_ready",
  "evaluation_ready_successor",
  "reconciliation_recovered",
]);
export const REVIEW_CLOSE_REASONS = Object.freeze([
  "source_resolved",
  "client_archived",
  "account_reassigned",
  "evaluation_superseded",
  "source_invalidated",
]);
export const REVIEW_ACTION_TYPES = Object.freeze([
  "acknowledged",
  "snoozed",
  "interpretation_recorded",
  "intervention_recorded",
  "opened_from_issue",
  "opened_from_evaluation",
  "reopened_by_evidence",
  "reopened_by_severity",
  "closed_source_resolved",
  "closed_client_archived",
  "closed_account_reassigned",
  "superseded_by_evaluation",
  "invalidated_by_source",
  "snooze_expired",
  "reconciliation_recovered",
]);
export const REVIEW_DECISIONS = Object.freeze([
  "interpretation_only",
  "campaign_action",
  "monitor_only",
  "no_action",
]);
export const REVIEW_COMPLETION_STATUSES = Object.freeze(["completed", "pending"]);
export const REVIEW_SUMMARY_COMPLETENESS = Object.freeze(["complete", "partial"]);
export const REVIEW_TIMELINE_STREAMS = Object.freeze([
  "signals",
  "intervention_recorded",
  "intervention_corrected",
  "intervention_cancelled",
  "evaluations",
  "review_actions",
  "client_archive",
  "report_archive",
]);
export const REVIEW_TIMELINE_KINDS = Object.freeze([
  "signal_detected",
  "intervention_recorded",
  "intervention_corrected",
  "intervention_cancelled",
  "evaluation_calculated",
  "client_archived",
  "report_archived",
  ...REVIEW_ACTION_TYPES,
]);
const EVALUATION_STATUSES = Object.freeze([
  "awaiting_follow_up",
  "ready",
  "insufficient_data",
  "not_evaluable",
  "invalidated",
  "superseded",
]);
const EVALUATION_RESULTS = Object.freeze([
  "improved",
  "worsened",
  "no_material_change",
  "mixed",
]);

const OBJECT_ID = /^[a-f\d]{24}$/i;
const SUMMARY_KEYS = Object.freeze([
  "active",
  "actionable",
  "snoozed",
  "critical",
  "high",
  "normal",
  "issueReview",
  "evaluationReview",
]);

export class ReviewNormalizationError extends Error {
  constructor(message = "Review data is invalid.") {
    super(message);
    this.name = "ReviewNormalizationError";
  }
}

const invalid = (message) => {
  throw new ReviewNormalizationError(message);
};
const object = (value, field) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value
    : invalid(`${field} is invalid.`);
const text = (value, maximum, field, { nullable = false } = {}) => {
  if (value == null && nullable) return null;
  if (typeof value !== "string") return invalid(`${field} is invalid.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) return invalid(`${field} is invalid.`);
  return normalized;
};
const optionalText = (value, maximum, field) => {
  if (value == null || value === "") return null;
  return text(value, maximum, field);
};
const enumValue = (value, allowed, field, options) => {
  if (value == null && options?.nullable) return null;
  if (!allowed.includes(value)) return invalid(`${field} is invalid.`);
  return value;
};
const id = (value, field, { nullable = false } = {}) => {
  if ((value == null || value === "") && nullable) return null;
  if (typeof value !== "string" || !OBJECT_ID.test(value)) return invalid(`${field} is invalid.`);
  return value.toLowerCase();
};
const integer = (value, field, { minimum = 0, nullable = false } = {}) => {
  if (value == null && nullable) return null;
  if (!Number.isSafeInteger(value) || value < minimum) return invalid(`${field} is invalid.`);
  return value;
};
const date = (value, field, { nullable = false } = {}) => {
  if ((value == null || value === "") && nullable) return null;
  if (typeof value !== "string" || !value.trim()) return invalid(`${field} is invalid.`);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return invalid(`${field} is invalid.`);
  return parsed.toISOString();
};
const boolean = (value, field) => {
  if (typeof value !== "boolean") return invalid(`${field} is invalid.`);
  return value;
};

const normalizeIdentity = (value, field, { campaign = false, nullable = false } = {}) => {
  if (value == null && nullable) return null;
  const source = object(value, field);
  return {
    id: campaign
      ? optionalText(source.id, 256, `${field}.id`)
      : id(source.id, `${field}.id`, { nullable: true }),
    name: optionalText(source.name, 256, `${field}.name`),
    provenance: optionalText(source.provenance, 32, `${field}.provenance`),
    ...(field.endsWith("account")
      ? { externalId: optionalText(source.externalId, 256, `${field}.externalId`) }
      : {}),
  };
};

const normalizeActor = (value, field) => {
  if (value == null) return null;
  const source = object(value, field);
  return {
    displayName: optionalText(source.displayName, 256, `${field}.displayName`),
    workspaceRole: optionalText(source.workspaceRole, 16, `${field}.workspaceRole`),
    provenance: optionalText(source.provenance, 32, `${field}.provenance`),
    capturedAt: date(source.capturedAt, `${field}.capturedAt`, { nullable: true }),
  };
};

const normalizePermissions = (value) => {
  const source = object(value || {}, "permissions");
  return {
    canAcknowledge: source.canAcknowledge === true,
    canSnooze: source.canSnooze === true,
    canReview: source.canReview === true,
    canRecordIntervention: source.canRecordIntervention === true,
  };
};

const normalizeRoutes = (value) => {
  const source = object(value || {}, "routes");
  return {
    issueId: id(source.issueId, "routes.issueId", { nullable: true }),
    reportId: id(source.reportId, "routes.reportId", { nullable: true }),
    reportRunId: id(source.reportRunId, "routes.reportRunId", { nullable: true }),
    interventionId: id(source.interventionId, "routes.interventionId", { nullable: true }),
    evaluationId: id(source.evaluationId, "routes.evaluationId", { nullable: true }),
    previousReviewItemId: id(source.previousReviewItemId, "routes.previousReviewItemId", { nullable: true }),
  };
};

export const normalizeReviewAction = (value) => {
  const source = object(value, "Review action");
  return {
    id: id(source.id, "action.id"),
    reviewItemId: id(source.reviewItemId, "action.reviewItemId"),
    sequence: integer(source.sequence, "action.sequence", { minimum: 1 }),
    actionType: enumValue(source.actionType, REVIEW_ACTION_TYPES, "action.actionType"),
    actorType: enumValue(source.actorType, ["human", "system"], "action.actorType"),
    decisionType: enumValue(source.decisionType, REVIEW_DECISIONS, "action.decisionType", { nullable: true }),
    actor: normalizeActor(source.actor, "action.actor"),
    priorState: enumValue(source.priorState, REVIEW_STATES, "action.priorState"),
    resultingState: enumValue(source.resultingState, REVIEW_STATES, "action.resultingState"),
    note: optionalText(source.note, 2000, "action.note"),
    signalId: id(source.signalId, "action.signalId", { nullable: true }),
    interventionId: id(source.interventionId, "action.interventionId", { nullable: true }),
    evaluationId: id(source.evaluationId, "action.evaluationId", { nullable: true }),
    occurredAt: date(source.occurredAt, "action.occurredAt"),
    recordedAt: date(source.recordedAt, "action.recordedAt"),
  };
};

export const normalizeReviewItem = (value, { detail = false } = {}) => {
  const source = object(value, "Review item");
  const state = enumValue(source.state, REVIEW_STATES, "state");
  const normalized = {
    id: id(source.id, "id"),
    type: enumValue(source.type, REVIEW_TYPES, "type"),
    state,
    priority: enumValue(source.priority, REVIEW_PRIORITIES, "priority"),
    reason: enumValue(source.reason, REVIEW_REASONS, "reason"),
    generation: integer(source.generation, "generation", { minimum: 1 }),
    client: normalizeIdentity(source.client, "client"),
    account: normalizeIdentity(source.account, "account"),
    campaign: normalizeIdentity(source.campaign, "campaign", { campaign: true }),
    issue: {
      ...normalizeIdentity(source.issue, "issue"),
      title: optionalText(source.issue?.title, 512, "issue.title"),
    },
    source: {
      title: optionalText(source.source?.title, 512, "source.title"),
      summary: optionalText(source.source?.summary, 1000, "source.summary"),
      provenance: optionalText(source.source?.provenance, 32, "source.provenance"),
    },
    openedAt: date(source.openedAt, "openedAt"),
    latestEvidenceAt: date(source.latestEvidenceAt, "latestEvidenceAt"),
    acknowledgement: source.acknowledgement
      ? { at: date(source.acknowledgement.at, "acknowledgement.at"), by: normalizeActor(source.acknowledgement.by, "acknowledgement.by") }
      : null,
    snooze: source.snooze
      ? {
          at: date(source.snooze.at, "snooze.at"),
          until: date(source.snooze.until, "snooze.until"),
          note: optionalText(source.snooze.note, 1000, "snooze.note"),
          by: normalizeActor(source.snooze.by, "snooze.by"),
        }
      : null,
    review: source.review
      ? { at: date(source.review.at, "review.at"), by: normalizeActor(source.review.by, "review.by") }
      : null,
    permissions: normalizePermissions(source.permissions),
    routes: normalizeRoutes(source.routes),
  };
  if (!detail) return normalized;
  const persistedState = enumValue(source.persistedState, REVIEW_STATES, "persistedState");
  const effectiveState = enumValue(source.effectiveState, REVIEW_STATES, "effectiveState");
  const context = object(source.context, "context");
  return {
    ...normalized,
    persistedState,
    effectiveState,
    effectiveCloseReason: enumValue(source.effectiveCloseReason, REVIEW_CLOSE_REASONS, "effectiveCloseReason", { nullable: true }),
    isSourceCurrent: boolean(source.isSourceCurrent, "isSourceCurrent"),
    sourceRevisionSynchronized: boolean(source.sourceRevisionSynchronized, "sourceRevisionSynchronized"),
    revision: integer(source.revision, "revision"),
    context: {
      version: integer(context.version, "context.version", { minimum: 1 }),
      capturedAt: date(context.capturedAt, "context.capturedAt"),
      client: normalizeIdentity(context.client, "context.client"),
      account: normalizeIdentity(context.account, "context.account"),
      campaign: normalizeIdentity(context.campaign, "context.campaign", { campaign: true }),
      issue: normalizeIdentity(context.issue, "context.issue"),
      report: normalizeIdentity(context.report, "context.report", { nullable: true }),
      sourceTitle: optionalText(context.sourceTitle, 512, "context.sourceTitle"),
      sourceSummary: optionalText(context.sourceSummary, 2000, "context.sourceSummary"),
      provenance: optionalText(context.provenance, 32, "context.provenance"),
    },
    linkedIntervention: source.linkedIntervention
      ? {
          id: id(source.linkedIntervention.id, "linkedIntervention.id"),
          actionType: optionalText(source.linkedIntervention.actionType, 64, "linkedIntervention.actionType"),
          status: optionalText(source.linkedIntervention.status, 32, "linkedIntervention.status"),
          performedAt: date(source.linkedIntervention.performedAt, "linkedIntervention.performedAt", { nullable: true }),
        }
      : null,
    linkedEvaluation: source.linkedEvaluation
      ? {
          id: id(source.linkedEvaluation.id, "linkedEvaluation.id"),
          status: optionalText(source.linkedEvaluation.status, 32, "linkedEvaluation.status"),
          observedResult: optionalText(source.linkedEvaluation.observedResult, 64, "linkedEvaluation.observedResult"),
          calculatedAt: date(source.linkedEvaluation.calculatedAt, "linkedEvaluation.calculatedAt", { nullable: true }),
        }
      : null,
    actions: Array.isArray(source.actions)
      ? source.actions.map(normalizeReviewAction)
      : invalid("actions is invalid."),
  };
};

const normalizeCounts = (value, field) => {
  const source = object(value, field);
  return Object.fromEntries(
    SUMMARY_KEYS.map((key) => [key, integer(source[key], `${field}.${key}`)])
  );
};

export const normalizeReviewSummary = (value) => {
  const source = object(value, "summary");
  const completeness = enumValue(source.completeness, REVIEW_SUMMARY_COMPLETENESS, "summary.completeness");
  const complete = completeness === "complete";
  return {
    asOf: date(source.asOf, "summary.asOf"),
    archived: source.archived == null ? false : boolean(source.archived, "summary.archived"),
    completeness,
    counts: complete ? normalizeCounts(source.counts, "summary.counts") : null,
    observedCounts: normalizeCounts(source.observedCounts, "summary.observedCounts"),
    scannedCandidates: integer(source.scannedCandidates, "summary.scannedCandidates"),
    nextCursor: complete ? null : text(source.nextCursor, 4096, "summary.nextCursor"),
  };
};

export const normalizeReviewCompletionStatus = (value) =>
  enumValue(value, REVIEW_COMPLETION_STATUSES, "reviewCompletionStatus");

export const normalizeReviewPage = (payload) => {
  const source = object(payload, "queue response");
  const page = object(source.page, "queue page");
  return {
    items: Array.isArray(source.reviewItems)
      ? source.reviewItems.map((item) => normalizeReviewItem(item))
      : invalid("reviewItems is invalid."),
    page: {
      limit: integer(page.limit, "page.limit", { minimum: 1 }),
      returned: integer(page.returned, "page.returned"),
      scanned: integer(page.scanned, "page.scanned"),
      nextCursor: optionalText(page.nextCursor, 4096, "page.nextCursor"),
      hasMore: Boolean(page.nextCursor),
    },
  };
};

export const normalizeReviewActionsPage = (payload) => {
  const source = object(payload, "actions response");
  const page = object(source.page, "actions page");
  return {
    items: Array.isArray(source.actions)
      ? source.actions.map(normalizeReviewAction)
      : invalid("actions is invalid."),
    page: {
      limit: integer(page.limit, "actions.page.limit", { minimum: 1 }),
      nextCursor: page.nextCursor == null ? null : String(integer(Number(page.nextCursor), "actions.page.nextCursor", { minimum: 1 })),
      hasMore: page.nextCursor != null,
    },
  };
};

export const normalizeTimelinePage = (payload) => {
  const source = object(payload, "timeline response");
  const page = object(source.page, "timeline page");
  if (!Array.isArray(source.timeline)) return invalid("timeline is invalid.");
  return {
    items: source.timeline.map((entry, index) => {
      const item = object(entry, `timeline[${index}]`);
      return {
        id: text(item.id, 256, `timeline[${index}].id`),
        stream: enumValue(item.stream, REVIEW_TIMELINE_STREAMS, `timeline[${index}].stream`),
        kind: enumValue(item.kind, REVIEW_TIMELINE_KINDS, `timeline[${index}].kind`),
        sourceId: optionalText(item.sourceId, 128, `timeline[${index}].sourceId`),
        occurredAt: date(item.occurredAt, `timeline[${index}].occurredAt`),
        rank: integer(item.rank, `timeline[${index}].rank`),
        title: text(item.title, 512, `timeline[${index}].title`),
        description: optionalText(item.description, 2000, `timeline[${index}].description`),
        severity: enumValue(item.severity, ["critical", "moderate", "stable"], `timeline[${index}].severity`, { nullable: true }),
        actionType: optionalText(item.actionType, 64, `timeline[${index}].actionType`),
        status: enumValue(item.status, EVALUATION_STATUSES, `timeline[${index}].status`, { nullable: true }),
        result: enumValue(item.result, EVALUATION_RESULTS, `timeline[${index}].result`, { nullable: true }),
        resultingState: enumValue(item.resultingState, REVIEW_STATES, `timeline[${index}].resultingState`, { nullable: true }),
        actor: normalizeActor(item.actor, `timeline[${index}].actor`),
      };
    }),
    page: {
      limit: integer(page.limit, "timeline.page.limit", { minimum: 1 }),
      snapshotAt: date(page.snapshotAt, "timeline.page.snapshotAt"),
      nextCursor: optionalText(page.nextCursor, 4096, "timeline.page.nextCursor"),
      hasMore: Boolean(page.nextCursor),
    },
  };
};

const labels = Object.freeze({
  issue_review: "Issue review",
  evaluation_review: "Evaluation review",
  issue_created: "New Issue",
  issue_reopened: "Issue reopened",
  issue_new_evidence: "New evidence",
  issue_severity_escalated: "Severity changed",
  intervention_cancelled: "Recorded action cancelled",
  evaluation_ready: "Evaluation ready",
  evaluation_ready_successor: "Updated Evaluation ready",
  reconciliation_recovered: "Review restored",
  source_resolved: "Source resolved",
  client_archived: "Client archived",
  account_reassigned: "Account assignment changed",
  evaluation_superseded: "Evaluation superseded",
  source_invalidated: "Source changed",
  acknowledged: "Review acknowledged",
  snoozed: "Review snoozed",
  interpretation_recorded: "Interpretation recorded",
  intervention_recorded: "Action recorded",
  opened_from_issue: "Review opened from Issue",
  opened_from_evaluation: "Review opened from Evaluation",
  reopened_by_evidence: "Review reopened after new evidence",
  reopened_by_severity: "Review reopened after severity changed",
  closed_source_resolved: "Review closed after source resolution",
  closed_client_archived: "Review closed when Client was archived",
  closed_account_reassigned: "Review closed after account assignment changed",
  superseded_by_evaluation: "Review superseded by a newer Evaluation",
  invalidated_by_source: "Review closed after its source changed",
  snooze_expired: "Snooze ended",
});

export const reviewLabel = (value, fallback = "Unavailable") => labels[value] ||
  (typeof value === "string"
    ? value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase())
    : fallback);

export const reviewDate = (value) => {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? parsed.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "Unavailable";
};

export const reviewAge = (value, now = Date.now()) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Unavailable";
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

export const reviewError = (error, fallback = "Review workflow could not be loaded.") => {
  const code = error?.response?.data?.code || error?.code || null;
  const messages = {
    REVIEW_INDEXES_NOT_READY: "Review workflow is temporarily unavailable.",
    REVIEW_REVISION_STALE: "This Review item changed. The latest version must be reviewed before trying again.",
    REVIEW_INVALID_STATE: "This Review item is no longer available for that action.",
    REVIEW_IDEMPOTENCY_CONFLICT: "This submission conflicts with an earlier action. Start a new explicit attempt.",
    INTERVENTION_IDEMPOTENCY_CONFLICT: "This submission conflicts with an earlier action. Start a new explicit attempt.",
    REVIEW_SOURCE_STALE: "The source changed. This Review item is now read-only.",
    CLIENT_ARCHIVED: "This Client is archived. Review history remains read-only.",
    CLIENT_LIFECYCLE_OPERATION_IN_PROGRESS: "The Client is being updated. Wait briefly, then retry.",
    INVALID_REVIEW_CURSOR: "This Review page changed. Reload the queue to continue.",
    INVALID_TIMELINE_CURSOR: "This timeline page changed. Reload the timeline to continue.",
  };
  return {
    code,
    status: error?.response?.status || null,
    message: messages[code] || (error?.response ? fallback : "Network error. You can retry this request."),
    stale: code === "REVIEW_REVISION_STALE",
    sourceStale: code === "REVIEW_SOURCE_STALE",
    conflict: ["REVIEW_IDEMPOTENCY_CONFLICT", "INTERVENTION_IDEMPOTENCY_CONFLICT"].includes(code),
    readiness: code === "REVIEW_INDEXES_NOT_READY",
  };
};

export const createReviewIntentKey = (prefix = "review") => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}:${globalThis.crypto.randomUUID()}`;
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  const suffix = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}:${suffix || `${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`}`;
};
