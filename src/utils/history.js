export const historyRecordId = (record) => String(record?.id || record?._id || "");

export const reportRunDetailPath = (record) => {
  const reportRunId = historyRecordId(record);
  return reportRunId ? `/report-runs/${encodeURIComponent(reportRunId)}` : null;
};

export const mergeHistoryRecords = (current = [], incoming = []) => {
  const merged = [];
  const seen = new Set();

  [...current, ...incoming].forEach((record) => {
    const id = historyRecordId(record);
    if (!id || seen.has(id)) return;
    seen.add(id);
    merged.push(record);
  });

  return merged;
};

export const createHistoryResetKey = (...parts) =>
  parts.map((part) => String(part ?? "")).join("::");

const IDENTITY_PRESENTATION = {
  complete: {
    label: "Identity preserved",
    tone: "emerald",
    description: "Historical identity is available from retained evidence.",
  },
  partial: {
    label: "Identity reconstructed",
    tone: "amber",
    description: "Some identity fields were reconstructed from a current workspace record.",
  },
  legacy_unknown: {
    label: "Identity unavailable",
    tone: "slate",
    description: "This historical record does not contain enough identity evidence.",
  },
};

export const getIdentityPresentation = (value) =>
  IDENTITY_PRESENTATION[value] || IDENTITY_PRESENTATION.legacy_unknown;

export const getIdentitySourceLabel = (value) => {
  if (value === "snapshot") return "Preserved snapshot";
  if (value === "current_parent") return "Current workspace record";
  if (value === "workspace_member") return "Workspace membership";
  return "Unavailable";
};

export const artifactAudiencePath = (reportRunId, audience) => {
  if (!reportRunId || !["client", "internal"].includes(audience)) return null;
  return `/report-runs/${encodeURIComponent(reportRunId)}/artifacts/${audience}`;
};

export const artifactRequestKey = (reportRunId, audience) =>
  `${String(reportRunId || "")}:${String(audience || "")}`;

export const shouldApplyArtifactResponse = (requestKey, currentRequestKey) =>
  Boolean(requestKey && requestKey === currentRequestKey);

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const formatHistoryWeekday = (value, fallback = "Day unavailable") =>
  Number.isInteger(value) && value >= 0 && value < WEEKDAYS.length
    ? WEEKDAYS[value]
    : fallback;

export const mapDeliveryEvidence = (delivery = {}) =>
  ["client", "internal"].map((audience) => {
    const value = delivery?.[audience];
    if (!value || typeof value !== "object") {
      return { audience, available: false, status: null, events: [], safety: null };
    }

    const events = [
      ["Sent", value.sent_at],
      ["Approved", value.approved_at],
      ["Cancelled", value.cancelled_at],
    ]
      .filter(([, timestamp]) => Boolean(timestamp))
      .map(([label, timestamp]) => ({ label, timestamp }));

    const safety = value.safety && typeof value.safety === "object"
      ? {
          passed: typeof value.safety.passed === "boolean" ? value.safety.passed : null,
          reasons: Array.isArray(value.safety.reasons) ? value.safety.reasons : [],
          warnings: Array.isArray(value.safety.warnings) ? value.safety.warnings : [],
        }
      : null;

    return {
      audience,
      available: Boolean(value.status || events.length || safety),
      status: value.status || null,
      events,
      safety,
    };
  });

export const formatHistoryDate = (value, fallback = "Not recorded") => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

export const formatHistoryLabel = (value, fallback = "Not recorded") => {
  if (!value) return fallback;
  return String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
};
