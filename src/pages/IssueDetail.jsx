import { ArrowLeft, History, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useCallback } from "react";
import { Link, useParams } from "react-router-dom";

import { getIssue, getIssueSignals } from "../api/issues";
import IssueSignalHistory from "../components/issues/IssueSignalHistory";
import StatusBadge from "../components/ui/StatusBadge";
import { CardSkeleton } from "../components/ui/Skeleton";
import useCursorHistory from "../hooks/useCursorHistory";
import useRouteOwnedResource from "../hooks/useRouteOwnedResource";
import {
  issueDate,
  issueEvidenceSummary,
  issueIdentityLabel,
  issueLabel,
  issueProvenanceLabel,
  issueRequestError,
  issueScopeLabel,
  issueSeverityVariant,
  issueStatusVariant,
  mapIssue,
} from "../utils/issues";

const trendIcons = {
  escalating: TrendingUp,
  improving: TrendingDown,
  unchanged: Minus,
};

const OverviewItem = ({ label, children }) => (
  <div>
    <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
    <dd className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{children}</dd>
  </div>
);

export default function IssueDetail() {
  const { issueId } = useParams();
  const loadIssue = useCallback(
    async ({ signal }) => {
      try {
        const response = await getIssue(issueId, { signal });
        return mapIssue(response.issue);
      } catch (error) {
        throw new Error(issueRequestError(error, "Could not load this Issue."), { cause: error });
      }
    },
    [issueId]
  );
  const issueState = useRouteOwnedResource({
    ownerKey: issueId,
    loadResource: loadIssue,
    fallbackError: "Could not load this Issue.",
  });
  const loadSignals = useCallback(
    async ({ cursor, signal }) => {
      try {
        return await getIssueSignals(issueId, { cursor, signal });
      } catch (error) {
        throw new Error(issueRequestError(error, "Could not load Issue occurrences."), {
          cause: error,
        });
      }
    },
    [issueId]
  );
  const occurrences = useCursorHistory({
    loadPage: loadSignals,
    resetKey: `issue-signals:${issueId}`,
    enabled: Boolean(issueState.data),
  });
  const issue = issueState.data;
  const TrendIcon = trendIcons[issue?.trend] || Minus;
  const isNotFound = issueState.error === "Issue not found.";

  return (
    <div className="h-full overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1040px]">
        <Link
          to="/clients"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft size={15} aria-hidden="true" /> Back to workspace
        </Link>

        {issueState.isLoading ? (
          <div className="mt-5" role="status" aria-live="polite">
            <span className="sr-only">Loading Issue details.</span>
            <div aria-hidden="true"><CardSkeleton rows={8} /></div>
          </div>
        ) : issueState.error ? (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
          >
            <p className="font-semibold">{isNotFound ? "Issue not found" : "Could not load Issue"}</p>
            <p className="mt-1">{issueState.error}</p>
            <button type="button" onClick={issueState.reload} className="mt-3 font-semibold underline">
              Try again
            </button>
          </div>
        ) : (
          <>
            <header className="mt-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">
                    Grouped performance Issue
                  </p>
                  <h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">
                    {issue?.title || "Untitled Issue"}
                  </h1>
                  {issue?.summary && (
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {issue.summary}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge variant={issueStatusVariant(issue?.status)}>
                    {issueLabel(issue?.status)}
                  </StatusBadge>
                  <StatusBadge variant={issueSeverityVariant(issue?.severity)}>
                    {issueLabel(issue?.severity, "Unknown severity")}
                  </StatusBadge>
                  <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    <TrendIcon size={13} aria-hidden="true" />
                    {issueLabel(issue?.trend, "Unknown trend")}
                  </span>
                </div>
              </div>
            </header>

            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
              <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">Overview</h2>
              <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <OverviewItem label="Campaign or scope">{issueScopeLabel(issue)}</OverviewItem>
                <OverviewItem label="Entity level">{issueLabel(issue?.scope.entityLevel, "Unknown")}</OverviewItem>
                <OverviewItem label="Archetype">{issueLabel(issue?.archetype, "Unknown")}</OverviewItem>
                <OverviewItem label="Metric family">{issueLabel(issue?.metricFamily, "Unknown")}</OverviewItem>
                {issue?.previousSeverity && (
                  <OverviewItem label="Previous severity">
                    {issueLabel(issue.previousSeverity)}
                  </OverviewItem>
                )}
                <OverviewItem label="Cadence">{issueLabel(issue?.scope.cadence, "Unknown")}</OverviewItem>
                <OverviewItem label="Opened">{issueDate(issue?.openedAt)}</OverviewItem>
                <OverviewItem label="Last seen">{issueDate(issue?.lastSeenAt)}</OverviewItem>
                {issue?.resolvedAt && <OverviewItem label="Resolved">{issueDate(issue.resolvedAt)}</OverviewItem>}
                <OverviewItem label="Occurrences">{issue?.occurrenceCount ?? "Not recorded"}</OverviewItem>
                <OverviewItem label="Reopened">{issue?.reopenCount ?? "Not recorded"}</OverviewItem>
              </dl>

              <div className="mt-6 grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2 dark:border-slate-800">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Client context</p>
                  <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {issueIdentityLabel(issue?.identity.client)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    {issueProvenanceLabel(issue?.identity.client.provenance)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Report context</p>
                  <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {issueIdentityLabel(issue?.identity.report)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    {issueProvenanceLabel(issue?.identity.report.provenance)}
                  </p>
                </div>
              </div>

              {(issue?.hasPredecessor || issue?.reopenCount > 0) && (
                <div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300">
                  <History size={15} aria-hidden="true" />
                  {issue.hasPredecessor
                    ? "This Issue continues a previous persisted lineage."
                    : `This Issue has reopened ${issue.reopenCount} ${issue.reopenCount === 1 ? "time" : "times"}.`}
                </div>
              )}
            </section>

            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
              <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">Latest evidence</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {issueEvidenceSummary(issue)}
              </p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Observed {issueDate(issue?.latestEvidence.observedAt)}</span>
                <span>{issueLabel(issue?.latestEvidence.primaryMetric, "Metric unavailable")}</span>
                <span>
                  Delta {issue?.latestEvidence.delta === null ? "unavailable" : issue.latestEvidence.delta}
                </span>
                <span>{issueProvenanceLabel(issue?.latestEvidence.provenance)}</span>
              </div>
            </section>

            <section className="mt-6 pb-10">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">Occurrence history</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Persisted Signal occurrences, newest first.
                </p>
              </div>
              <IssueSignalHistory state={occurrences} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
