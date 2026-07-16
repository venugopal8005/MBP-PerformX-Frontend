import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Info,
} from "lucide-react";

const SIGNAL_TONE_STYLES = {
  critical: {
    label: "Critical",
    Icon: AlertTriangle,
    iconName: "AlertTriangle",
    iconClassName: "border-rose-200 bg-rose-50 text-rose-600",
    badgeClassName: "border-rose-200 bg-rose-50 text-rose-700",
    dotClassName: "bg-rose-500",
    activityTone: "danger",
    activityIcon: {
      background: "#fff1f2",
      border: "#fecdd3",
      color: "#e11d48",
    },
  },
  warning: {
    label: "Review",
    Icon: AlertTriangle,
    iconName: "AlertTriangle",
    iconClassName: "border-amber-200 bg-amber-50 text-amber-600",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
    dotClassName: "bg-amber-500",
    activityTone: "warning",
    activityIcon: {
      background: "#fffbeb",
      border: "#fde68a",
      color: "#d97706",
    },
  },
  info: {
    label: "Data needed",
    Icon: Info,
    iconName: "Info",
    iconClassName: "border-sky-200 bg-sky-50 text-sky-600",
    badgeClassName: "border-sky-200 bg-sky-50 text-sky-700",
    dotClassName: "bg-sky-500",
    activityTone: "analysis",
    activityIcon: {
      background: "#eff6ff",
      border: "#bfdbfe",
      color: "#2563eb",
    },
  },
  success: {
    label: "Opportunity",
    Icon: CheckCircle2,
    iconName: "CheckCircle2",
    iconClassName: "border-emerald-200 bg-emerald-50 text-emerald-600",
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dotClassName: "bg-emerald-500",
    activityTone: "active",
    activityIcon: {
      background: "#ecfdf5",
      border: "#bbf7d0",
      color: "#059669",
    },
  },
  stable: {
    label: "Stable",
    Icon: CheckCircle2,
    iconName: "CheckCircle2",
    iconClassName: "border-slate-200 bg-slate-50 text-slate-500",
    badgeClassName: "border-slate-200 bg-slate-50 text-slate-600",
    dotClassName: "bg-slate-400",
    activityTone: "neutral",
    activityIcon: {
      background: "#f8fafc",
      border: "#e2e8f0",
      color: "#64748b",
    },
  },
  neutral: {
    label: "Logged",
    Icon: Clock3,
    iconName: "Clock3",
    iconClassName: "border-slate-200 bg-slate-50 text-slate-500",
    badgeClassName: "border-slate-200 bg-slate-50 text-slate-600",
    dotClassName: "bg-slate-400",
    activityTone: "neutral",
    activityIcon: {
      background: "#f8fafc",
      border: "#e2e8f0",
      color: "#64748b",
    },
  },
};

const CRITICAL_TYPES = new Set([
  "conversion_collapse",
  "conversion_funnel_breakdown",
  "creative_collapse",
  "cpa_spike",
  "meta_disconnected",
  "roas_drop",
  "severe_ctr_drop",
  "spend_waste",
  "volume_loss",
]);

const WARNING_TYPES = new Set([
  "auction_pressure",
  "cpc_rising",
  "cpm_spike",
  "creative_fatigue",
  "ctr_decline",
  "engagement_quality_drop",
  "fatigue_risk",
  "frequency_spike",
  "learning_limited",
  "quality_drop",
]);

const INFO_TYPES = new Set([
  "data_issue",
  "data_quality_issue",
  "fix_data",
  "incomplete_report",
  "insufficient_data",
  "low_confidence",
  "low_reliability",
  "missing_breakdown",
  "missing_data",
  "no_delivery",
  "sync_issue",
  "token_expiration",
]);

const SUCCESS_TYPES = new Set([
  "healthy_scaling",
  "opportunity",
  "positive_efficiency",
  "protect_setup",
  "recovered",
  "recovery",
  "roas_recovered",
  "scale_signal",
  "stable_performance",
  "winning_setup",
]);

const DATA_KEYWORDS = [
  "cannot judge",
  "data needed",
  "data quality",
  "insufficient data",
  "low confidence",
  "missing data",
  "not enough data",
  "sync",
  "token",
];

const CRITICAL_KEYWORDS = [
  "action needed",
  "collapsed",
  "critical",
  "fix today",
  "severe",
  "stopped converting",
  "wasting spend",
];

const WARNING_KEYWORDS = [
  "before changing budget",
  "decline",
  "drop",
  "fewer are engaging",
  "fatigue",
  "fix the ad message",
  "main issue",
  "not engaging",
  "quality drop",
  "review today",
  "risk",
  "weaker",
  "weakest",
  "worse",
];

const SUCCESS_KEYWORDS = [
  "healthy",
  "improved",
  "opportunity",
  "recovered",
  "scale",
  "stable performance",
  "winning",
];

const NEUTRAL_KEYWORDS = ["logged", "monitor executed", "report sent"];

const normalize = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const includesAny = (value, keywords) =>
  keywords.some((keyword) => value.includes(keyword));

const readSignalType = (signal = {}) =>
  normalize(
    signal.signal_type ||
      signal.signalType ||
      signal.metadata?.signal_type ||
      signal.metadata?.signalType ||
      signal.type
  );

const readSignalCategory = (signal = {}) =>
  normalize(
    signal.signal_category ||
      signal.signalCategory ||
      signal.category ||
      signal.metadata?.signal_category ||
      signal.metadata?.category
  );

const readSeverity = (signal = {}) =>
  normalize(signal.severity || signal.priority || signal.metadata?.severity);

const toneFromType = (type, category) => {
  const candidates = [type, category].filter(Boolean);

  if (candidates.some((candidate) => CRITICAL_TYPES.has(candidate))) return "critical";
  if (candidates.some((candidate) => WARNING_TYPES.has(candidate))) return "warning";
  if (candidates.some((candidate) => INFO_TYPES.has(candidate))) return "info";
  if (candidates.some((candidate) => SUCCESS_TYPES.has(candidate))) return "success";

  return null;
};

const toneFromSeverity = (severity) => {
  if (["critical", "high", "urgent"].includes(severity)) return "critical";
  if (["moderate", "medium", "warning", "review_today"].includes(severity)) {
    return "warning";
  }
  if (["data_needed", "insufficient_data"].includes(severity)) {
    return "info";
  }
  if (severity === "stable") return "stable";
  if (severity === "low") return "neutral";

  return null;
};

const toneFromText = (signal = {}) => {
  const text = normalizeText(
    [
      signal.title,
      signal.description,
      signal.summary,
      signal.message,
      signal.decision,
      signal.metadata?.title,
      signal.metadata?.description,
      signal.metadata?.summary,
      signal.metadata?.message,
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (!text) return null;
  if (includesAny(text, CRITICAL_KEYWORDS)) return "critical";
  if (includesAny(text, WARNING_KEYWORDS)) return "warning";
  if (includesAny(text, DATA_KEYWORDS)) return "info";
  if (includesAny(text, SUCCESS_KEYWORDS)) return "success";
  if (includesAny(text, NEUTRAL_KEYWORDS)) return "neutral";

  return null;
};

export const getSignalAppearance = (signal = {}) => {
  const type = readSignalType(signal);
  const category = readSignalCategory(signal);
  const severity = readSeverity(signal);

  // Recognized persisted severity is authoritative. Type and text are fallbacks
  // for legacy records with no usable severity value.
  const tone =
    toneFromSeverity(severity) ||
    toneFromType(type, category) ||
    toneFromText(signal) ||
    "neutral";
  const style = SIGNAL_TONE_STYLES[tone] || SIGNAL_TONE_STYLES.neutral;

  return {
    ...style,
    tone,
    type,
    category,
    severity,
    icon: {
      name: style.iconName,
      ...style.activityIcon,
    },
  };
};

export { SIGNAL_TONE_STYLES };
