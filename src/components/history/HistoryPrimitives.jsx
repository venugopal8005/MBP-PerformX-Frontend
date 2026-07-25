import { Activity, AlertCircle, ArrowRight, Clock3, FileText } from "lucide-react";
import { Link } from "react-router-dom";

import { formatHistoryDate, formatHistoryLabel, historyRecordId } from "../../utils/history";
import IdentityProvenance from "./IdentityProvenance";
import { ListSkeleton } from "../ui/Skeleton";
import StatusBadge from "../ui/StatusBadge";

export function HistorySection({ title, description, count, children }) {
  return (
    <section className="border-t border-slate-200 py-6 first:border-t-0 dark:border-slate-800">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
          )}
        </div>
        {Number.isFinite(count) && (
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {count} retained
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

export function HistoryCollectionState({
  state,
  emptyTitle = "No historical records",
  emptyDescription = "No retained records are available for this section.",
  preserveItemsOnError = false,
  children,
}) {
  if (state.isLoading && state.items.length === 0) {
    return (
      <div role="status" aria-live="polite">
        <span className="sr-only">Loading historical records.</span>
        <div aria-hidden="true">
          <ListSkeleton count={3} compact />
        </div>
      </div>
    );
  }

  const retainedPaginationError =
    preserveItemsOnError &&
    state.error &&
    state.items.length > 0 &&
    (state.failedAppend || state.failedRefresh);

  if (state.error && !retainedPaginationError) {
    return (
      <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
        <div className="flex items-start gap-2">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <div>
            <p>{state.error}</p>
            <button type="button" onClick={state.reload} className="mt-2 font-semibold underline">
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state.isEmpty) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 px-5 py-9 text-center dark:border-slate-700">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{emptyTitle}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <>
      {children}
      {retainedPaginationError ? (
        <div role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{state.error}</span>
            <button type="button" onClick={state.retry || state.loadMore} disabled={state.isLoadingMore} className="font-semibold underline disabled:opacity-50">
              {state.isLoadingMore || state.isRefreshing
                ? "Retrying..."
                : state.failedRefresh
                  ? "Retry refresh"
                  : "Retry load more"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex justify-center">
        {state.hasMore ? (
          <button
            type="button"
            onClick={state.loadMore}
            disabled={state.isLoadingMore}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {state.isLoadingMore ? "Loading..." : "Load more"}
          </button>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500">End of history</span>
        )}
        </div>
      )}
      {state.isRefreshing && (
        <p role="status" className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Refreshing recorded actions...
        </p>
      )}
    </>
  );
}

export function HistoricalRunList({ runs }) {
  return (
    <div className="space-y-3">
      {runs.map((run) => (
        <Link
          key={historyRecordId(run)}
          to={`/report-runs/${historyRecordId(run)}`}
          className="group flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-slate-700"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <FileText size={16} className="text-slate-400" />
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {run.report?.name || "Historical report run"}
              </p>
              <StatusBadge variant={run.status === "ok" ? "high" : "medium"}>
                {formatHistoryLabel(run.status, "Unknown")}
              </StatusBadge>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
              {run.summary || run.decision || "Permanent execution evidence"}
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span>{formatHistoryLabel(run.trigger_type, "Unknown trigger")}</span>
              <span>{formatHistoryDate(run.ran_at)}</span>
              <span>
                Artifacts: {run.artifactAvailability?.client ? "client" : ""}
                {run.artifactAvailability?.client && run.artifactAvailability?.internal ? ", " : ""}
                {run.artifactAvailability?.internal ? "internal" : ""}
                {!run.artifactAvailability?.client && !run.artifactAvailability?.internal
                  ? "none"
                  : ""}
              </span>
            </div>
            <div className="mt-3">
              <IdentityProvenance
                completeness={run.identityCompleteness}
                sources={run.identitySources}
                compact
              />
            </div>
          </div>
          <ArrowRight size={17} className="mt-1 shrink-0 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200" />
        </Link>
      ))}
    </div>
  );
}

export function HistoricalSignalList({ signals }) {
  return (
    <div className="space-y-3">
      {signals.map((signal) => (
        <article
          key={historyRecordId(signal)}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
        >
          <div className="flex items-start gap-3">
            <AlertCircle size={17} className="mt-0.5 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  {signal.title || formatHistoryLabel(signal.type, "Historical signal")}
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {formatHistoryDate(signal.detected_at)}
                </span>
              </div>
              {signal.description && (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {signal.description}
                </p>
              )}
              {signal.recommendation && (
                <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                  {signal.recommendation}
                </p>
              )}
              <div className="mt-3">
                <IdentityProvenance
                  completeness={signal.identityCompleteness}
                  sources={signal.identitySources}
                  compact
                />
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function HistoricalActivityList({ activities }) {
  return (
    <div className="relative space-y-0 pl-3">
      <div className="absolute bottom-4 left-[19px] top-4 w-px bg-slate-200 dark:bg-slate-800" />
      {activities.map((item) => (
        <article key={historyRecordId(item)} className="relative flex gap-4 py-3">
          <div className="relative z-10 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-200 ring-4 ring-[var(--bg-app)] dark:bg-slate-700">
            <Activity size={10} />
          </div>
          <div className="min-w-0 flex-1 pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {item.title || item.display?.title || formatHistoryLabel(item.type)}
              </p>
              <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <Clock3 size={12} />
                {formatHistoryDate(item.createdAt)}
              </span>
            </div>
            {(item.description || item.display?.description) && (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {item.description || item.display.description}
              </p>
            )}
            {item.actor?.displayName && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                By {item.actor.displayName}
              </p>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

export function HistoryStatGrid({ items }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-xl font-semibold text-slate-950 dark:text-slate-50">{value}</p>
        </div>
      ))}
    </div>
  );
}
