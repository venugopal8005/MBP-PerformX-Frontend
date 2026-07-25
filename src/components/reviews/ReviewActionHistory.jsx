import { reviewDate, reviewLabel } from "../../utils/reviews";

export default function ReviewActionHistory({ state }) {
  if (state.isLoading && state.items.length === 0) {
    return <p role="status" className="text-sm text-slate-500">Loading Review history...</p>;
  }
  if (state.error && state.items.length === 0) {
    return (
      <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p>{state.error}</p>
        <button type="button" onClick={state.retry} className="mt-2 font-semibold underline">Retry</button>
      </div>
    );
  }
  if (state.items.length === 0) return <p className="text-sm text-slate-500">No Review actions recorded.</p>;
  return (
    <div className="space-y-3">
      {state.items.map((action) => (
        <article key={action.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{reviewLabel(action.actionType)}</h3>
              <p className="mt-1 text-xs text-slate-500">
                {action.actor?.displayName || (action.actorType === "system" ? "Narrative" : "Workspace member")} · {reviewDate(action.occurredAt)}
              </p>
            </div>
            <span className="text-xs text-slate-500">{reviewLabel(action.priorState)} → {reviewLabel(action.resultingState)}</span>
          </div>
          {action.note && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600 dark:text-slate-300">{action.note}</p>}
          <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium text-slate-600 dark:text-slate-300">
            {action.interventionId && <span>Related action recorded</span>}
            {action.evaluationId && <span>Related Evaluation recorded</span>}
            {action.decisionType && <span>{reviewLabel(action.decisionType)}</span>}
          </div>
        </article>
      ))}
      {state.error && (
        <div role="alert" className="text-sm text-amber-700">
          Earlier actions could not be loaded. Existing history is still shown. <button type="button" onClick={state.retry} className="font-semibold underline">Retry</button>
        </div>
      )}
      {state.hasMore && (
        <button type="button" onClick={state.loadMore} disabled={state.isLoadingMore} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-slate-700">
          {state.isLoadingMore ? "Loading..." : "Load earlier actions"}
        </button>
      )}
    </div>
  );
}
