export default function ReviewSummaryBadge({ summary }) {
  if (!summary) return null;
  const observed = summary.observedCounts?.actionable || 0;
  if (summary.completeness === "partial") {
    if (observed === 0) return null;
    return (
      <span
        aria-label="Review items are available; the total is still being calculated"
        title="Review items are available"
        className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500 ring-2 ring-amber-100 dark:ring-amber-950"
      />
    );
  }
  const actionable = summary.counts?.actionable || 0;
  if (actionable === 0) return null;
  return (
    <span
      aria-label={`${actionable} actionable Review ${actionable === 1 ? "item" : "items"}`}
      className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white dark:bg-slate-100 dark:text-slate-950"
    >
      {actionable > 99 ? "99+" : actionable}
    </span>
  );
}

