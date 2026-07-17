import { ArrowRight, History, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useCallback } from "react";
import { Link } from "react-router-dom";

import { getIssues } from "../../api/issues";
import useCursorHistory from "../../hooks/useCursorHistory";
import StatusBadge from "../ui/StatusBadge";
import { HistoryCollectionState } from "../history/HistoryPrimitives";
import {
  issueDate,
  issueDetailPath,
  issueLabel,
  issueProvenanceLabel,
  issueRequestError,
  issueScopeLabel,
  issueSeverityVariant,
  issueStatusVariant,
  mapIssue,
} from "../../utils/issues";

const trendIcons = {
  escalating: TrendingUp,
  improving: TrendingDown,
  unchanged: Minus,
};

export function IssueListItem({ value }) {
  const issue = mapIssue(value);
  const path = issueDetailPath(issue);
  const TrendIcon = trendIcons[issue.trend] || Minus;

  if (!path) return null;

  return (
    <Link
      to={path}
      className="group block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-slate-700 dark:focus-visible:ring-slate-100 dark:focus-visible:ring-offset-slate-950"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-950 dark:text-slate-50">
              {issue.title || "Untitled Issue"}
            </h3>
            <StatusBadge variant={issueStatusVariant(issue.status)}>
              {issueLabel(issue.status)}
            </StatusBadge>
            <StatusBadge variant={issueSeverityVariant(issue.severity)}>
              {issueLabel(issue.severity, "Unknown severity")}
            </StatusBadge>
          </div>

          {issue.summary && (
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {issue.summary}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{issueScopeLabel(issue)}</span>
            <span>
              {issue.occurrenceCount === null
                ? "Occurrences unavailable"
                : `${issue.occurrenceCount} occurrences`}
            </span>
            <span>First seen {issueDate(issue.openedAt)}</span>
            <span>Last seen {issueDate(issue.lastSeenAt)}</span>
            <span className="inline-flex items-center gap-1">
              <TrendIcon size={13} aria-hidden="true" />
              {issueLabel(issue.trend, "Unknown trend")}
            </span>
            {issue.reopenCount > 0 && (
              <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300">
                <History size={13} aria-hidden="true" />
                Reopened {issue.reopenCount} {issue.reopenCount === 1 ? "time" : "times"}
              </span>
            )}
          </div>

          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
            {issueProvenanceLabel(issue.identity.campaign.provenance)}
          </p>
        </div>
        <ArrowRight
          size={17}
          aria-hidden="true"
          className="mt-1 shrink-0 text-slate-400 transition group-hover:text-slate-700 dark:group-hover:text-slate-200"
        />
      </div>
    </Link>
  );
}

export default function IssueListSection({
  clientId,
  reportId,
  archivedContext = false,
  className = "",
}) {
  const loadPage = useCallback(
    async ({ cursor, signal }) => {
      try {
        return await getIssues({ clientId, reportId, cursor, signal });
      } catch (error) {
        throw new Error(issueRequestError(error, "Could not load Issues."), { cause: error });
      }
    },
    [clientId, reportId]
  );
  const state = useCursorHistory({
    loadPage,
    resetKey: `issues:${clientId || ""}:${reportId || ""}:${archivedContext}`,
  });

  return (
    <section className={className} aria-labelledby={`issues-${clientId || reportId}-title`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id={`issues-${clientId || reportId}-title`}
            className="text-base font-semibold text-slate-950 dark:text-slate-50"
          >
            Issues
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Grouped performance problems retained across report runs.
          </p>
        </div>
      </div>

      {archivedContext && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
          Status is shown as historically stored. Archiving the parent does not mark an Issue as resolved.
        </div>
      )}

      <HistoryCollectionState
        state={state}
        emptyTitle="No grouped Issues"
        emptyDescription="No recurring account problems have been grouped for this record."
      >
        <div className="space-y-3">
          {state.items.map((issue) => (
            <IssueListItem key={issue.id} value={issue} />
          ))}
        </div>
      </HistoryCollectionState>
    </section>
  );
}
