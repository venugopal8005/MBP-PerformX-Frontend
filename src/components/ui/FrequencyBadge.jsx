const frequencyStyles = {
  daily: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/50 dark:text-sky-300",
  weekly: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/70 dark:bg-violet-950/50 dark:text-violet-300",
  monthly: "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900/70 dark:bg-teal-950/50 dark:text-teal-300",
};

const normalizeFrequency = (value = "daily") => String(value).trim().toLowerCase();

const formatFrequency = (value = "daily") => {
  const frequency = normalizeFrequency(value);
  return `${frequency.charAt(0).toUpperCase()}${frequency.slice(1)}`;
};

export default function FrequencyBadge({ frequency = "daily" }) {
  const normalized = normalizeFrequency(frequency);

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${
        frequencyStyles[normalized] || "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
      }`}
    >
      {formatFrequency(normalized)}
    </span>
  );
}
