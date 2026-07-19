const boundedText = (value, maximum, { required = false } = {}) => {
  if (typeof value !== "string") return required ? null : "";
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) return null;
  return normalized;
};

const displayText = (value, maximum) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maximum);
};

const fields = Object.freeze({
  budget: ["mode", "amount", "currency"],
  creative: ["summary", "assetCount"],
  targeting: ["dimension", "summary"],
  exclusion: ["exclusionType", "summary"],
  bid: ["strategy", "summary"],
  tracking: ["area", "summary"],
  summary: ["summary"],
  other: ["label", "summary"],
  none: [],
});

const action = ({ value, label, description, requiredFields = [], optionalFields = [] }) =>
  Object.freeze({
    value,
    label,
    description,
    requiredFields: Object.freeze(requiredFields),
    optionalFields: Object.freeze(optionalFields),
    fields: Object.freeze([...requiredFields, ...optionalFields]),
    formatSummary: (payload) => payload?.summary || label,
  });

export const INTERVENTION_ACTIONS = Object.freeze([
  action({ value: "pause_campaign", label: "Pause campaign", description: "Record that campaign delivery was paused." }),
  action({ value: "resume_campaign", label: "Resume campaign", description: "Record that campaign delivery was resumed." }),
  action({ value: "increase_budget", label: "Increase budget", description: "Record a percentage or absolute budget increase.", requiredFields: fields.budget }),
  action({ value: "decrease_budget", label: "Decrease budget", description: "Record a percentage or absolute budget decrease.", requiredFields: fields.budget }),
  action({ value: "replace_creative", label: "Replace creative", description: "Record replacement creative and its bounded summary.", requiredFields: ["summary"], optionalFields: ["assetCount"] }),
  action({ value: "add_creative", label: "Add creative", description: "Record creative assets added to the campaign.", requiredFields: ["summary"], optionalFields: ["assetCount"] }),
  action({ value: "remove_creative", label: "Remove creative", description: "Record creative assets removed from the campaign.", requiredFields: ["summary"], optionalFields: ["assetCount"] }),
  action({ value: "change_targeting", label: "Change targeting", description: "Record a targeting dimension change.", requiredFields: fields.targeting }),
  action({ value: "add_exclusion", label: "Add exclusion", description: "Record an audience, placement, or location exclusion.", requiredFields: fields.exclusion }),
  action({ value: "change_bid_strategy", label: "Change bid strategy", description: "Record a campaign bid-strategy change.", requiredFields: fields.bid }),
  action({ value: "fix_tracking", label: "Fix tracking", description: "Record a tracking or attribution correction.", requiredFields: fields.tracking }),
  action({ value: "landing_page_change", label: "Change landing page", description: "Record a landing-page change.", requiredFields: fields.summary }),
  action({ value: "monitor_only", label: "Monitor only", description: "Record a decision to monitor without changing delivery." }),
  action({ value: "no_action", label: "No action", description: "Record a deliberate decision to take no action." }),
  action({ value: "internal_note", label: "Internal note", description: "Add bounded internal context without claiming an action." }),
  action({ value: "other", label: "Other action", description: "Record another bounded action with a clear label.", requiredFields: fields.other }),
]);

export const INTERVENTION_ACTION_BY_VALUE = Object.freeze(
  Object.fromEntries(INTERVENTION_ACTIONS.map((action) => [action.value, action]))
);

export const TARGETING_DIMENSIONS = Object.freeze([
  "audience", "location", "demographic", "placement", "optimization", "other",
]);
export const EXCLUSION_TYPES = Object.freeze([
  "audience", "placement", "location", "publisher", "other",
]);
export const BID_STRATEGIES = Object.freeze([
  "lowest_cost", "cost_cap", "bid_cap", "minimum_roas", "other",
]);
export const TRACKING_AREAS = Object.freeze([
  "pixel", "conversions_api", "event_mapping", "attribution", "utm", "other",
]);

const ENUM_FIELDS = Object.freeze({
  dimension: TARGETING_DIMENSIONS,
  exclusionType: EXCLUSION_TYPES,
  strategy: BID_STRATEGIES,
  area: TRACKING_AREAS,
});

export const interventionLabel = (value, fallback = "Recorded action") =>
  INTERVENTION_ACTION_BY_VALUE[value]?.label || fallback;

export const interventionStatusLabel = (value) => {
  if (value === "active") return "Active";
  if (value === "superseded") return "Superseded";
  if (value === "cancelled") return "Cancelled";
  return "Unknown";
};

export const interventionStatusVariant = (value) => {
  if (value === "active") return "high";
  if (value === "superseded") return "medium";
  return value === "cancelled" ? "critical" : "low";
};

export const canCorrectIntervention = (intervention, { canWrite = true } = {}) =>
  canWrite === true &&
  intervention?.status === "active" &&
  intervention?.permissions?.canCorrect === true &&
  Number.isInteger(intervention?.revision);

export const canCancelIntervention = (intervention, { canWrite = true } = {}) =>
  canWrite === true &&
  intervention?.status === "active" &&
  intervention?.permissions?.canCancel === true &&
  Number.isInteger(intervention?.revision);

export const reconcileStaleIntervention = ({
  intervention,
  operation,
  canWrite = true,
} = {}) => ({
  intervention,
  revision: Number.isInteger(intervention?.revision) ? intervention.revision : null,
  status: intervention?.status || "unknown",
  permissions: intervention?.permissions || { canCorrect: false, canCancel: false },
  mutationAllowed:
    operation === "cancel"
      ? canCancelIntervention(intervention, { canWrite })
      : canCorrectIntervention(intervention, { canWrite }),
  requiresReview: true,
});

export const validateAuthoritativeIntervention = ({
  intervention,
  expectedId,
  operation = "correct",
  canWrite = true,
} = {}) => {
  const supportedStatus = ["active", "superseded", "cancelled"].includes(
    intervention?.status
  );
  const permissionsPresent =
    intervention?.permissions &&
    typeof intervention.permissions === "object" &&
    typeof intervention.permissions.canCorrect === "boolean" &&
    typeof intervention.permissions.canCancel === "boolean";
  const actionSupported = Boolean(
    INTERVENTION_ACTION_BY_VALUE[intervention?.actionType]
  );
  const performerInterpretable = Boolean(
    intervention?.performedBy?.displayName &&
      intervention?.performedBy?.provenance &&
      (intervention.performedBy.provenance !== "workspace_member" ||
        intervention.performedByUserId)
  );
  const identityMatches =
    typeof intervention?.id === "string" &&
    intervention.id.length > 0 &&
    String(intervention.id) === String(expectedId || "");
  const revisionValid =
    Number.isSafeInteger(intervention?.revision) && intervention.revision >= 0;
  const eligible =
    operation === "cancel"
      ? canCancelIntervention(intervention, { canWrite })
      : canCorrectIntervention(intervention, { canWrite });
  const complete =
    identityMatches &&
    revisionValid &&
    supportedStatus &&
    permissionsPresent &&
    actionSupported &&
    performerInterpretable;

  return {
    complete,
    mutationAllowed: complete && eligible,
    message: !complete
      ? "The latest action record was incomplete and cannot be used. Retry the refresh."
      : !eligible
        ? "This action record can no longer be changed after refreshing its latest status and permissions."
        : "Latest action record loaded. Review it before submitting again.",
  };
};

export const interventionProvenanceLabel = (value) => {
  const labels = {
    workspace_member: "Workspace member snapshot",
    manual: "Manually attributed snapshot",
    persisted_issue: "Persisted Issue snapshot",
    persisted_signal: "Persisted Signal snapshot",
    signal_snapshot: "Signal identity snapshot",
    report_run_snapshot: "Report run identity snapshot",
    current_parent: "Current workspace record at capture",
    unknown: "Provenance unavailable",
  };
  return labels[value] || "Provenance unavailable";
};

export const createInterventionIntentKey = (prefix = "intervention") => {
  const browserCrypto = globalThis.crypto;
  if (typeof browserCrypto?.randomUUID === "function") {
    return `${prefix}:${browserCrypto.randomUUID()}`;
  }
  if (typeof browserCrypto?.getRandomValues === "function") {
    const bytes = browserCrypto.getRandomValues(new Uint8Array(16));
    return `${prefix}:${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
};

export const createInterventionIntentController = (prefix = "intervention") => {
  let key = createInterventionIntentKey(prefix);
  let pending = false;
  let completed = false;
  return {
    snapshot: () => ({ key, pending, completed }),
    begin: () => {
      if (pending || completed || !key) return null;
      pending = true;
      return key;
    },
    fail: () => {
      pending = false;
      return { key, pending, completed };
    },
    complete: () => {
      key = null;
      pending = false;
      completed = true;
      return { key, pending, completed };
    },
    reset: () => {
      key = createInterventionIntentKey(prefix);
      pending = false;
      completed = false;
      return { key, pending, completed };
    },
  };
};

export const interventionFieldA11y = (errors, prefix, field) => {
  const hasError = Boolean(errors?.[field]);
  return {
    "aria-invalid": hasError || undefined,
    "aria-describedby": hasError ? `${prefix}-${field}-error` : undefined,
  };
};

const initialActionFields = () => ({
  mode: "percent",
  amount: "",
  currency: "",
  summary: "",
  assetCount: "",
  dimension: "audience",
  exclusionType: "audience",
  strategy: "lowest_cost",
  area: "pixel",
  label: "",
});

export const changeInterventionActionType = (form, actionType) => ({
  ...form,
  ...initialActionFields(),
  actionType,
});

const safeEnum = (value, allowed, fallback) =>
  allowed.includes(value) ? value : fallback;

const enumLabel = (value) =>
  typeof value === "string"
    ? value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase())
    : "Unknown";

export const interventionPerformerDefaults = ({
  intervention,
  members = [],
  currentUserId,
} = {}) => {
  const performer = intervention?.performedBy;
  const performerUserId = intervention?.performedByUserId;
  if (
    performerUserId &&
    currentUserId &&
    String(performerUserId) === String(currentUserId)
  ) {
    return { performerMode: "self", memberUserId: "", manualName: "", manualEmail: "" };
  }
  if (performer?.provenance === "workspace_member" && performerUserId) {
    const selectable = members.some(
      (member) => member?.userId && String(member.userId) === String(performerUserId)
    );
    if (selectable) {
      return {
        performerMode: "workspace_member",
        memberUserId: String(performerUserId),
        manualName: "",
        manualEmail: "",
      };
    }
  }
  if (performer?.provenance === "manual" && performer?.displayName) {
    return {
      performerMode: "manual",
      memberUserId: "",
      manualName: displayText(performer.displayName, 256),
      manualEmail: "",
    };
  }
  return { performerMode: "self", memberUserId: "", manualName: "", manualEmail: "" };
};

export const defaultInterventionForm = ({
  intervention,
  members = [],
  currentUserId,
  now = new Date(),
} = {}) => {
  const payload = intervention?.actionPayload || {};
  const performer = interventionPerformerDefaults({ intervention, members, currentUserId });
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
  return {
    actionType: intervention?.actionType || "monitor_only",
    ...performer,
    performedAt: intervention?.performedAt
      ? new Date(
          new Date(intervention.performedAt).getTime() -
            new Date(intervention.performedAt).getTimezoneOffset() * 60_000
        )
          .toISOString()
          .slice(0, 16)
      : local,
    mode: safeEnum(payload.mode, ["percent", "absolute"], "percent"),
    amount: payload.amount == null ? "" : String(payload.amount),
    currency: payload.currency || "",
    summary: payload.summary || "",
    assetCount: payload.assetCount == null ? "" : String(payload.assetCount),
    dimension: safeEnum(payload.dimension, TARGETING_DIMENSIONS, "audience"),
    exclusionType: safeEnum(payload.exclusionType, EXCLUSION_TYPES, "audience"),
    strategy: safeEnum(payload.strategy, BID_STRATEGIES, "lowest_cost"),
    area: safeEnum(payload.area, TRACKING_AREAS, "pixel"),
    label: payload.label || "",
    reason: intervention?.reason || "",
    note: intervention?.note || "",
  };
};

const strictNumber = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value !== value.trim() || !value) return null;
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const strictInteger = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value !== "string" && typeof value !== "number") return NaN;
  const source = String(value);
  if (!/^\d+$/.test(source)) return NaN;
  return Number(source);
};

const validEmail = (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const validateInterventionForm = (form, { openedAt, now = new Date(), members } = {}) => {
  const errors = {};
  const definition = INTERVENTION_ACTION_BY_VALUE[form.actionType];
  if (!definition) errors.actionType = "Choose a supported action.";

  if (form.performerMode === "workspace_member") {
    const memberSelectable =
      form.memberUserId &&
      (!Array.isArray(members) || members.some((member) => member?.userId === form.memberUserId));
    if (!memberSelectable) errors.memberUserId = "Choose an active workspace member.";
  } else if (form.performerMode === "manual") {
    if (!boundedText(form.manualName, 256, { required: true })) {
      errors.manualName = "Enter a performer name of 256 characters or fewer.";
    }
    if (!validEmail(form.manualEmail.trim()) || form.manualEmail.trim().length > 254) {
      errors.manualEmail = "Enter a valid email or leave it blank.";
    }
  } else if (form.performerMode !== "self") {
    errors.performerMode = "Choose a supported performer.";
  }

  const performedAt = new Date(form.performedAt);
  const opened = new Date(openedAt);
  if (!form.performedAt || Number.isNaN(performedAt.getTime())) {
    errors.performedAt = "Enter when the action was performed.";
  } else if (!Number.isNaN(opened.getTime()) && performedAt < opened) {
    errors.performedAt = "The action cannot be earlier than the Issue.";
  } else if (performedAt.getTime() > now.getTime() + 5 * 60_000) {
    errors.performedAt = "The action cannot be in the future.";
  }

  if (definition?.fields.includes("amount")) {
    const amount = strictNumber(form.amount);
    if (amount === null || amount <= 0 || amount > 1_000_000_000) {
      errors.amount = "Enter a positive numeric amount.";
    } else if (form.mode === "percent" && amount > 100) {
      errors.amount = "Percent changes cannot exceed 100.";
    }
    if (!["percent", "absolute"].includes(form.mode)) errors.mode = "Choose a budget mode.";
    if (form.mode === "absolute" && !/^[A-Za-z]{3}$/.test(form.currency.trim())) {
      errors.currency = "Enter a three-letter currency code.";
    }
  }

  if (definition?.fields.includes("summary") && !boundedText(form.summary, 500, { required: true })) {
    errors.summary = "Enter a summary of 500 characters or fewer.";
  }
  if (definition?.fields.includes("assetCount")) {
    const assetCount = strictInteger(form.assetCount);
    if (Number.isNaN(assetCount) || (assetCount !== null && (assetCount < 1 || assetCount > 100))) {
      errors.assetCount = "Asset count must be an integer from 1 to 100.";
    }
  }
  if (definition?.fields.includes("label") && !boundedText(form.label, 100, { required: true })) {
    errors.label = "Enter an action label of 100 characters or fewer.";
  }
  for (const [field, allowed] of Object.entries(ENUM_FIELDS)) {
    if (definition?.fields.includes(field) && !allowed.includes(form[field])) {
      errors[field] = `Choose a supported ${field === "exclusionType" ? "exclusion type" : field}.`;
    }
  }
  if (form.actionType === "internal_note") {
    if (!boundedText(form.note, 2000, { required: true })) {
      errors.note = "Enter an internal note of 2,000 characters or fewer.";
    }
  } else if (!boundedText(form.reason, 1000, { required: true })) {
    errors.reason = "Explain why this action was taken in 1,000 characters or fewer.";
  }
  if (form.note && form.note.trim().length > 2000) errors.note = "Note must be 2,000 characters or fewer.";
  return errors;
};

export const buildActionPayload = (form) => {
  const definition = INTERVENTION_ACTION_BY_VALUE[form.actionType];
  if (!definition) return {};
  const payload = {};
  if (definition.fields.includes("mode")) {
    payload.mode = form.mode;
    payload.amount = strictNumber(form.amount);
    if (form.mode === "absolute") payload.currency = form.currency.trim().toUpperCase();
  }
  if (definition.fields.includes("summary")) payload.summary = form.summary.trim();
  if (definition.fields.includes("assetCount") && form.assetCount !== "") {
    payload.assetCount = strictInteger(form.assetCount);
  }
  if (definition.fields.includes("dimension")) payload.dimension = form.dimension;
  if (definition.fields.includes("exclusionType")) payload.exclusionType = form.exclusionType;
  if (definition.fields.includes("strategy")) payload.strategy = form.strategy;
  if (definition.fields.includes("area")) payload.area = form.area;
  if (definition.fields.includes("label")) payload.label = form.label.trim();
  return payload;
};

export const buildPerformerPayload = (form) => {
  if (form.performerMode === "workspace_member") {
    return { mode: "workspace_member", userId: form.memberUserId };
  }
  if (form.performerMode === "manual") {
    return {
      mode: "manual",
      displayName: form.manualName.trim(),
      ...(form.manualEmail.trim() ? { email: form.manualEmail.trim().toLowerCase() } : {}),
    };
  }
  return { mode: "self" };
};

export const buildInterventionMutationPayload = ({ form, idempotencyKey, expectedRevision, correction = false }) => ({
  idempotencyKey,
  ...(correction
    ? { expectedRevision }
    : { expectedIssueRevision: expectedRevision }),
  actionType: form.actionType,
  actionVersion: 1,
  actionPayload: buildActionPayload(form),
  performedBy: buildPerformerPayload(form),
  performedAt: new Date(form.performedAt).toISOString(),
  ...(form.actionType === "internal_note"
    ? { note: form.note.trim() }
    : {
        reason: form.reason.trim(),
        ...(form.note.trim() ? { note: form.note.trim() } : {}),
      }),
});

export const interventionSummary = (intervention = {}) => {
  const payload = intervention.actionPayload || {};
  const label = interventionLabel(intervention.actionType);
  if (["increase_budget", "decrease_budget"].includes(intervention.actionType)) {
    const amount = payload.mode === "percent"
      ? `${payload.amount}%`
      : `${payload.currency || ""} ${payload.amount ?? ""}`.trim();
    return `${label}${amount ? ` by ${amount}` : ""}.`;
  }
  if (payload.summary) return `${label}: ${payload.summary}`;
  if (payload.label) return `${payload.label}: ${payload.summary || label}`;
  return `${label} was recorded after this Issue was detected.`;
};

export const mapIntervention = (value = {}) => ({
  id: displayText(value.id, 128),
  issueId: displayText(value.issueId, 128),
  actionType: displayText(value.actionType, 64),
  evaluationIntent: value.evaluationIntent && typeof value.evaluationIntent === "object" ? {
    mode: displayText(value.evaluationIntent.mode, 32),
    primaryMetric: displayText(value.evaluationIntent.primaryMetric, 64),
    watchedMetrics: Array.isArray(value.evaluationIntent.watchedMetrics)
      ? value.evaluationIntent.watchedMetrics.map((metric) => displayText(metric, 64)).filter(Boolean).slice(0, 6)
      : [],
    resolutionSource: displayText(value.evaluationIntent.resolutionSource, 64),
    ruleVersion: Number.isSafeInteger(value.evaluationIntent.ruleVersion) && value.evaluationIntent.ruleVersion >= 1
      ? value.evaluationIntent.ruleVersion
      : null,
  } : null,
  actionPayload: value.actionPayload && typeof value.actionPayload === "object" ? value.actionPayload : {},
  reason: displayText(value.reason, 1000),
  note: displayText(value.note, 2000),
  performedAt: displayText(value.performedAt, 64),
  recordedAt: displayText(value.recordedAt, 64),
  performedBy: value.performedBy?.displayName ? {
    displayName: displayText(value.performedBy.displayName, 256),
    workspaceRole: displayText(value.performedBy.workspaceRole, 32),
    provenance: displayText(value.performedBy.provenance, 32),
  } : null,
  performedByUserId: displayText(value.performedByUserId, 128),
  recordedBy: value.recordedBy?.displayName ? {
    displayName: displayText(value.recordedBy.displayName, 256),
    workspaceRole: displayText(value.recordedBy.workspaceRole, 32),
    provenance: displayText(value.recordedBy.provenance, 32),
  } : null,
  status: displayText(value.status, 32),
  supersedesInterventionId: displayText(value.supersedesInterventionId, 128),
  supersededByInterventionId: displayText(value.supersededByInterventionId, 128),
  correctedAt: displayText(value.correctedAt, 64),
  correctedBy: value.correctedBy?.displayName ? {
    displayName: displayText(value.correctedBy.displayName, 256),
    workspaceRole: displayText(value.correctedBy.workspaceRole, 32),
    provenance: displayText(value.correctedBy.provenance, 32),
  } : null,
  cancellation: value.cancellation?.cancelledAt ? {
    reason: displayText(value.cancellation.reason, 1000),
    cancelledAt: displayText(value.cancellation.cancelledAt, 64),
    cancelledBy: value.cancellation.cancelledBy?.displayName
      ? { displayName: displayText(value.cancellation.cancelledBy.displayName, 256) }
      : null,
  } : null,
  revision:
    Number.isSafeInteger(value.revision) && value.revision >= 0
      ? value.revision
      : null,
  permissions: {
    canCorrect: value.permissions?.canCorrect === true,
    canCancel: value.permissions?.canCancel === true,
  },
  issueSnapshot: value.issueSnapshot && typeof value.issueSnapshot === "object" ? value.issueSnapshot : null,
  scopeSnapshot: value.scopeSnapshot && typeof value.scopeSnapshot === "object" ? value.scopeSnapshot : null,
  latestSignalSnapshot: value.latestSignalSnapshot && typeof value.latestSignalSnapshot === "object" ? value.latestSignalSnapshot : null,
});

export const interventionPayloadDetails = (intervention = {}) => {
  const payload = intervention.actionPayload || {};
  const rows = [];
  const add = (label, value) => {
    if (value !== undefined && value !== null && value !== "") rows.push({ label, value: String(value) });
  };
  if (["increase_budget", "decrease_budget"].includes(intervention.actionType)) {
    add("Budget mode", payload.mode === "percent" ? "Percentage" : "Absolute amount");
    add("Amount", payload.mode === "percent" ? `${payload.amount}%` : payload.amount);
    if (payload.mode === "absolute") add("Currency", payload.currency);
  }
  if (["replace_creative", "add_creative", "remove_creative", "landing_page_change"].includes(intervention.actionType)) {
    add("Change summary", payload.summary);
  }
  if (["replace_creative", "add_creative", "remove_creative"].includes(intervention.actionType)) {
    add("Asset count", payload.assetCount);
  }
  if (intervention.actionType === "change_targeting") {
    add("Targeting dimension", enumLabel(payload.dimension));
    add("Change summary", payload.summary);
  }
  if (intervention.actionType === "add_exclusion") {
    add("Exclusion type", enumLabel(payload.exclusionType));
    add("Change summary", payload.summary);
  }
  if (intervention.actionType === "change_bid_strategy") {
    add("Bid strategy", enumLabel(payload.strategy));
    add("Change summary", payload.summary);
  }
  if (intervention.actionType === "fix_tracking") {
    add("Tracking area", enumLabel(payload.area));
    add("Change summary", payload.summary);
  }
  if (intervention.actionType === "other") {
    add("Action label", payload.label);
    add("Change summary", payload.summary);
  }
  return rows;
};

const controlledErrors = Object.freeze({
  INTERVENTION_VALIDATION_FAILED: "Review the highlighted fields and try again.",
  INTERVENTION_PERMISSION_DENIED: "You do not have permission to change this action record.",
  INTERVENTION_NOT_FOUND: "This action record is no longer available.",
  ISSUE_NOT_FOUND: "This Issue is no longer available.",
  INTERVENTION_ISSUE_STALE: "The Issue changed while this form was open. Refresh and review before resubmitting.",
  INTERVENTION_REVISION_STALE: "This action record changed. Refresh and review before resubmitting.",
  INTERVENTION_CLIENT_ARCHIVED: "This Client is archived, so action records are read-only.",
  CLIENT_ARCHIVED: "This Client is archived, so action records are read-only.",
  INTERVENTION_OWNERSHIP_CONFLICT: "The saved Client, account, or campaign context changed. Refresh before continuing.",
  INTERVENTION_IDEMPOTENCY_CONFLICT: "This submission key was already used for different content. Start a new submission intent.",
  INTERVENTION_TRANSACTION_REQUIRED: "Action recording is temporarily unavailable.",
  INTERVENTION_INDEXES_NOT_READY: "Action recording is temporarily unavailable.",
  client_lifecycle_operation_in_progress: "The Client is being updated. Try again shortly.",
  client_lifecycle_lease_lost: "The Client changed while this form was open. Refresh before continuing.",
});

export const interventionError = (error, fallback = "Could not complete this action request.") => {
  const code = error?.response?.data?.code || error?.code || null;
  return {
    code,
    status: error?.response?.status || null,
    message: controlledErrors[code] || (error?.response ? fallback : "Network error. Your submission is still available to retry."),
    stale: ["INTERVENTION_ISSUE_STALE", "INTERVENTION_REVISION_STALE", "INTERVENTION_OWNERSHIP_CONFLICT", "client_lifecycle_lease_lost"].includes(code),
    conflict: code === "INTERVENTION_IDEMPOTENCY_CONFLICT",
  };
};
