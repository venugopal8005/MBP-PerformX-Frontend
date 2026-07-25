import { reviewDate, reviewLabel } from "../../utils/reviews";

const kindLabels = Object.freeze({
  signal: "Persisted Signal",
  persisted_signal: "Persisted Signal",
  signal_detected: "Persisted Signal",
  intervention_recorded: "Recorded action",
  intervention_corrected: "Intervention corrected",
  intervention_cancelled: "Intervention cancelled",
  evaluation: "Persisted Evaluation",
  evaluation_recorded: "Persisted Evaluation",
  evaluation_calculated: "Persisted Evaluation",
  evaluation_superseded: "Evaluation superseded",
  evaluation_invalidated: "Evaluation invalidated",
  acknowledged: "Review acknowledged",
  review_acknowledged: "Review acknowledged",
  snoozed: "Review snoozed",
  review_snoozed: "Review snoozed",
  interpretation_recorded: "Review completed",
  intervention_recorded_review: "Review completed",
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
  reconciliation_recovered: "Review restored",
  client_archived: "Client archived",
  report_archived: "Report archived",
});

const timelineKindLabel = (entry) => {
  if (entry.stream === "review_actions" && entry.kind === "intervention_recorded") return "Review completed";
  if (entry.kind === "evaluation_calculated" && entry.status === "superseded") return "Evaluation superseded";
  if (entry.kind === "evaluation_calculated" && entry.status === "invalidated") return "Evaluation invalidated";
  return kindLabels[entry.kind] || reviewLabel(entry.kind, entry.title || "Historical event");
};

export default function IssueTimeline({ state, compact = false }) {
  if (state.isLoading && state.items.length === 0) return <p role="status" className="text-sm text-slate-500">Loading timeline...</p>;
  if (state.error && state.items.length === 0) {
    return <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><p>{state.error}</p><button type="button" onClick={state.retry} className="mt-2 font-semibold underline">Retry</button></div>;
  }
  if (state.items.length === 0) return <p className="text-sm text-slate-500">No timeline entries recorded.</p>;
  const items = compact ? state.items.slice(0, 5) : state.items;
  return (
    <div>
      <ol className="relative space-y-5 border-l border-slate-200 pl-5 dark:border-slate-700">
        {items.map((entry) => (
          <li key={entry.id} className="relative min-w-0">
            <span aria-hidden="true" className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-500 ring-4 ring-white dark:ring-slate-900" />
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
              <h3 className="break-words text-sm font-semibold text-slate-900 dark:text-slate-100">{timelineKindLabel(entry)}</h3>
              <time className="shrink-0 text-xs text-slate-500" dateTime={entry.occurredAt}>{reviewDate(entry.occurredAt)}</time>
            </div>
            {entry.title && entry.title !== timelineKindLabel(entry) && <p className="mt-1 break-words text-sm font-medium text-slate-700 dark:text-slate-200">{entry.title}</p>}
            {entry.description && <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600 dark:text-slate-300">{entry.description}</p>}
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
              {entry.actor?.displayName && <span>{entry.actor.displayName}</span>}
              {entry.resultingState && <span>{reviewLabel(entry.resultingState)}</span>}
              {entry.status && <span>{reviewLabel(entry.status)}</span>}
              {entry.result && <span>{reviewLabel(entry.result)}</span>}
            </div>
          </li>
        ))}
      </ol>
      {state.error && state.items.length > 0 && <div role="alert" className="mt-4 text-sm text-amber-700">More timeline entries could not be loaded. Existing entries are still shown. <button type="button" onClick={state.retry} className="font-semibold underline">Retry</button></div>}
      {!compact && state.hasMore && <button type="button" onClick={state.loadMore} disabled={state.isLoadingMore} className="mt-5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-slate-700">{state.isLoadingMore ? "Loading..." : "Load earlier timeline entries"}</button>}
    </div>
  );
}
