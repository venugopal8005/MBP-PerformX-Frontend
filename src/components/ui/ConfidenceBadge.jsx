const confidenceStyles = {
  high: "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-rose-200 bg-rose-50 text-rose-700",
};

const normalizeConfidence = (confidence) => {
  if (!confidence) return "";

  if (typeof confidence === "object") {
    return String(confidence.level || confidence.label || "").toLowerCase();
  }

  return String(confidence).toLowerCase();
};

const formatConfidence = (confidence) => {
  const normalized = normalizeConfidence(confidence);
  if (!normalized) return "";

  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
};

export default function ConfidenceBadge({ confidence, label = "Confidence" }) {
  const normalized = normalizeConfidence(confidence);
  const formatted = formatConfidence(confidence);

  if (!formatted) return null;

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${
        confidenceStyles[normalized] || "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {label}: {formatted}
    </span>
  );
}
