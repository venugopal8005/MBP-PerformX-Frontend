import { getSignalAppearance } from "../../utils/signalAppearance";

export const toneStyle = {
  setup: {
    background: "#eef2ff",
    color: "#4f46e5",
    border: "#c7d2fe",
  },
  connected: {
    background: "#ecfeff",
    color: "#0891b2",
    border: "#a5f3fc",
  },
  active: {
    background: "#ecfdf5",
    color: "#059669",
    border: "#a7f3d0",
  },
  paused: {
    background: "#f8fafc",
    color: "#64748b",
    border: "#cbd5e1",
  },
  analysis: {
    background: "#eff6ff",
    color: "#2563eb",
    border: "#bfdbfe",
  },
  decision: {
    background: "#fffbeb",
    color: "#d97706",
    border: "#fde68a",
  },
  delivered: {
    background: "#f0fdf4",
    color: "#16a34a",
    border: "#bbf7d0",
  },
  warning: {
    background: "#fff7ed",
    color: "#ea580c",
    border: "#fed7aa",
  },
  danger: {
    background: "#fef2f2",
    color: "#dc2626",
    border: "#fecaca",
  },
  neutral: {
    background: "#f8fafc",
    color: "#475569",
    border: "#e2e8f0",
  },
};

const activityFallback = {
  client_created: { icon: "UserPlus", tone: "setup", label: "Client created" },
  client_updated: { icon: "Pencil", tone: "analysis", label: "Client updated" },
  client_deleted: { icon: "Trash2", tone: "danger", label: "Client deleted" },
  meta_connected: { icon: "PlugZap", tone: "connected", label: "Meta connected" },
  meta_reconnected: { icon: "RefreshCcw", tone: "connected", label: "Meta reconnected" },
  meta_disconnected: { icon: "RouteOff", tone: "danger", label: "Meta disconnected" },
  meta_accounts_synced: { icon: "DatabaseZap", tone: "connected", label: "Accounts synced" },
  meta_account_assigned: { icon: "GitMerge", tone: "active", label: "Account assigned" },
  meta_account_reassigned: { icon: "Repeat", tone: "warning", label: "Account changed" },
  meta_account_unassigned: { icon: "RouteOff", tone: "paused", label: "Account unassigned" },
  report_created: { icon: "FilePlus2", tone: "setup", label: "Monitor created" },
  report_started: { icon: "PlayCircle", tone: "active", label: "Monitor started" },
  report_paused: { icon: "PauseCircle", tone: "paused", label: "Monitor paused" },
  report_executed: { icon: "Activity", tone: "analysis", label: "Analyzed" },
  decision_generated: { icon: "Lightbulb", tone: "decision", label: "Decision" },
  report_sent: { icon: "MailCheck", tone: "delivered", label: "Email sent" },
  report_failed: { icon: "AlertTriangle", tone: "danger", label: "Failed" },
  campaign_synced: { icon: "RefreshCcw", tone: "connected", label: "Campaigns synced" },
};

const getSignalFallbackDisplay = (activity = {}) => {
  const appearance = getSignalAppearance({
    ...activity,
    signal_type: activity.signal_type || activity.metadata?.signal_type,
    signal_category: activity.signal_category || activity.metadata?.signal_category,
  });

  return {
    label: appearance.label,
    tone: appearance.activityTone,
    icon: appearance.icon,
  };
};

const getFallbackDisplay = (activity = {}) => {
  if (activity.type === "signal_detected") {
    return getSignalFallbackDisplay(activity);
  }

  const base = activityFallback[activity.type];
  const fallback = base || { icon: "Circle", tone: "neutral", label: "Activity" };
  const tone = fallback.tone;

  return {
    label: fallback.label,
    tone,
    icon: {
      name: fallback.icon,
      ...toneStyle[tone],
    },
  };
};

export const getActivityPresentation = (activity = {}) => {
  const fallback = getFallbackDisplay(activity);
  const useStoredDisplay = activity.type !== "signal_detected";
  const icon = useStoredDisplay ? activity.display?.icon || fallback.icon : fallback.icon;
  const tone = useStoredDisplay
    ? activity.display?.tone || fallback.tone || "neutral"
    : fallback.tone;
  const style = toneStyle[tone] || toneStyle.neutral;

  return {
    label: useStoredDisplay ? activity.display?.label || fallback.label : fallback.label,
    title: activity.display?.title || activity.title || "Activity recorded",
    description: activity.display?.description || activity.description || "",
    icon: {
      name: icon.name || fallback.icon.name || "Circle",
      background: icon.background || style.background,
      color: icon.color || style.color,
      border: icon.border || style.border,
    },
  };
};
