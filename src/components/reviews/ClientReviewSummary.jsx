import { Link } from "react-router-dom";

import useReviewSummary from "../../hooks/useReviewSummary";

export default function ClientReviewSummary({ clientId }) {
  const state = useReviewSummary({ clientId });
  if (state.loading && !state.summary) return <div role="status" className="mt-6 rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/80">Loading Client Review summary...</div>;
  if (state.error) {
    return <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/80"><p>Client Review summary is temporarily unavailable.</p><button type="button" onClick={state.retry} className="mt-2 font-semibold underline">Retry</button></div>;
  }
  const summary = state.summary;
  if (!summary) return null;
  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80" aria-labelledby="client-review-summary-title">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="client-review-summary-title" className="text-base font-semibold">Review</h2><p className="mt-1 text-sm text-slate-500">Persisted decisions associated with this Client.</p></div><Link to={`/reviews?clientId=${encodeURIComponent(clientId)}`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700">Open Client Review queue</Link></div>
      {summary.archived ? <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-950/60 dark:text-slate-300">Archived Client · Review history is read-only.</p> : summary.completeness === "partial" ? <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-950/60 dark:text-slate-300">{summary.observedCounts.actionable > 0 ? "Review items are available. The complete total is still being calculated." : "Review totals are still being calculated."}</p> : <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><div><dt className="text-xs text-slate-500">Actionable</dt><dd className="mt-1 text-xl font-semibold">{summary.counts.actionable}</dd></div><div><dt className="text-xs text-slate-500">Critical</dt><dd className="mt-1 text-xl font-semibold">{summary.counts.critical}</dd></div><div><dt className="text-xs text-slate-500">High</dt><dd className="mt-1 text-xl font-semibold">{summary.counts.high}</dd></div><div><dt className="text-xs text-slate-500">Snoozed</dt><dd className="mt-1 text-xl font-semibold">{summary.counts.snoozed}</dd></div></dl>}
    </section>
  );
}
