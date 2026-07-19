import { ArrowLeft, History, LockKeyhole, Minus, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useParams } from "react-router-dom";

import { getIssue, getIssueSignals } from "../api/issues";
import { getIssueTimeline } from "../api/reviews";
import {
  getIntervention,
  getInterventionWorkspaceMembers,
  getIssueClientWriteAccess,
  getIssueInterventions,
} from "../api/interventions";
import InterventionActionModal from "../components/issues/InterventionActionModal";
import InterventionDetailModal from "../components/issues/InterventionDetailModal";
import InterventionHistory from "../components/issues/InterventionHistory";
import IssueSignalHistory from "../components/issues/IssueSignalHistory";
import IssueTimeline from "../components/reviews/IssueTimeline";
import StatusBadge from "../components/ui/StatusBadge";
import { CardSkeleton } from "../components/ui/Skeleton";
import useCursorHistory from "../hooks/useCursorHistory";
import useRequestOwnership from "../hooks/useRequestOwnership";
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
import { interventionError, mapIntervention } from "../utils/interventions";
import { normalizeTimelinePage, reviewError } from "../utils/reviews";

const trendIcons = {
  escalating: TrendingUp,
  improving: TrendingDown,
  unchanged: Minus,
};

const abortedRequestError = () => {
  const error = new Error("Request was aborted.");
  error.name = "AbortError";
  return error;
};

const OverviewItem = ({ label, children }) => (
  <div>
    <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
    <dd className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{children}</dd>
  </div>
);

export default function IssueDetail() {
  const { issueId } = useParams();
  const currentUser = useSelector((state) => state.user?.user);
  const currentUserId = currentUser?.id || currentUser?._id || null;
  const [access, setAccess] = useState({
    clientId: null,
    isLoading: false,
    canWrite: false,
    isArchived: false,
    members: [],
    error: "",
  });
  const [actionModal, setActionModal] = useState(null);
  const [selectedInterventionId, setSelectedInterventionId] = useState(null);
  const [highlightedInterventionId, setHighlightedInterventionId] = useState(null);
  const [notice, setNotice] = useState(null);
  const issueOwnerRef = useRef(issueId);
  const {
    begin: beginAccessRequest,
    finish: finishAccessRequest,
  } = useRequestOwnership();
  const {
    begin: beginAuthorityRequest,
    finish: finishAuthorityRequest,
    invalidate: invalidateAuthorityRequests,
  } = useRequestOwnership();
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
    preserveDataOnReload: true,
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
  const loadInterventions = useCallback(
    async ({ cursor, signal }) => {
      try {
        return await getIssueInterventions(issueId, { cursor, signal });
      } catch (error) {
        throw new Error(
          interventionError(error, "Could not load recorded actions.").message,
          { cause: error }
        );
      }
    },
    [issueId]
  );
  const interventions = useCursorHistory({
    loadPage: loadInterventions,
    resetKey: `issue-interventions:${issueId}`,
    enabled: Boolean(issueState.data),
  });
  const loadTimeline = useCallback(
    async ({ cursor, signal }) => {
      try {
        return normalizeTimelinePage(
          await getIssueTimeline(issueId, { cursor, limit: 20, signal })
        );
      } catch (error) {
        throw new Error(reviewError(error, "Could not load the Issue timeline.").message, {
          cause: error,
        });
      }
    },
    [issueId]
  );
  const timeline = useCursorHistory({
    loadPage: loadTimeline,
    resetKey: `issue-timeline:${issueId}`,
    enabled: Boolean(issueState.data),
  });
  const issue = issueState.data;
  const TrendIcon = trendIcons[issue?.trend] || Minus;
  const isNotFound = issueState.error === "Issue not found.";

  useEffect(() => {
    issueOwnerRef.current = issueId;
    invalidateAuthorityRequests();
  }, [invalidateAuthorityRequests, issueId]);

  useEffect(() => {
    if (!issue?.clientId) return undefined;
    const request = beginAccessRequest();
    const requestIssueId = issueId;
    Promise.allSettled([
      getIssueClientWriteAccess(issue.clientId, { signal: request.signal }),
      getInterventionWorkspaceMembers({ signal: request.signal }),
    ]).then(([clientResult, membersResult]) => {
      if (!request.isCurrent() || issueOwnerRef.current !== requestIssueId) return;
      if (clientResult.status === "rejected") {
        setAccess({
          clientId: issue.clientId,
          isLoading: false,
          canWrite: false,
          isArchived: false,
          members: [],
          error: interventionError(clientResult.reason, "Action recording is unavailable.").message,
        });
        return;
      }
      setAccess({
        clientId: issue.clientId,
        isLoading: false,
        ...clientResult.value,
        members: membersResult.status === "fulfilled" ? membersResult.value : [],
        error: "",
      });
    }).finally(() => {
      finishAccessRequest(request);
    });
    return () => request.controller.abort();
  }, [beginAccessRequest, finishAccessRequest, issue?.clientId, issueId]);

  const accessPending = access.clientId !== issue?.clientId || access.isLoading;
  const canRecord =
    access.clientId === issue?.clientId &&
    access.canWrite &&
    !access.isArchived &&
    Number.isInteger(issue?.lifecycleRevision);

  const handleMutationSuccess = (value, { operation, idempotentReplay } = {}) => {
    const mutationIssueId = issueId;
    if (issueOwnerRef.current !== mutationIssueId) return;
    const saved = mapIntervention(value);
    setHighlightedInterventionId({ issueId, id: saved.id });
    setNotice({
      issueId,
      message: idempotentReplay
        ? "The existing action record was recovered safely."
        : operation === "cancel"
          ? "Action record cancelled."
          : operation === "correct"
            ? "Correction recorded. The original remains in history."
            : "Action recorded.",
    });
    setActionModal(null);
    interventions.revalidate({
      failureMessage: "The action was saved, but the history could not be refreshed.",
    });
    issueState.reload();
  };

  const refreshRevision = async ({ correction, interventionId, signal }) => {
    const request = beginAuthorityRequest();
    const requestIssueId = issueId;
    const abortFromCaller = () => request.controller.abort();
    if (signal?.aborted) abortFromCaller();
    else signal?.addEventListener?.("abort", abortFromCaller, { once: true });
    const isCurrentOwner = () =>
      request.isCurrent() &&
      !signal?.aborted &&
      issueOwnerRef.current === requestIssueId;

    try {
      if (correction && interventionId) {
        const [response, accessResponse] = await Promise.all([
          getIntervention(interventionId, { signal: request.signal }),
          issue?.clientId
            ? getIssueClientWriteAccess(issue.clientId, { signal: request.signal })
            : Promise.resolve({ canWrite: false, isArchived: false }),
        ]);
        if (!isCurrentOwner()) throw abortedRequestError();
        return {
          intervention: response.intervention,
          canWrite: accessResponse.canWrite === true && !accessResponse.isArchived,
        };
      }

      const [issueResponse, accessResponse] = await Promise.all([
        getIssue(requestIssueId, { signal: request.signal }),
        issue?.clientId
          ? getIssueClientWriteAccess(issue.clientId, { signal: request.signal })
          : Promise.resolve(null),
      ]);
      if (!isCurrentOwner()) throw abortedRequestError();
      const refreshed = mapIssue(issueResponse.issue);
      if (accessResponse && issue?.clientId) {
        setAccess((current) => ({
          ...current,
          clientId: issue.clientId,
          ...accessResponse,
          error: "",
        }));
      }
      if (!isCurrentOwner()) throw abortedRequestError();
      issueState.reload();
      return { issue: refreshed, canWrite: accessResponse?.canWrite !== false };
    } finally {
      signal?.removeEventListener?.("abort", abortFromCaller);
      finishAuthorityRequest(request);
    }
  };

  const openCorrection = (intervention) => {
    setSelectedInterventionId(null);
    setActionModal({ issueId, mode: "correct", intervention });
  };

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
                  {canRecord && (
                    <button
                      type="button"
                      onClick={() => setActionModal({ issueId, mode: "create" })}
                      className="ml-1 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3.5 py-2 text-sm font-semibold text-white outline-none hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white dark:focus-visible:ring-offset-slate-900"
                    >
                      <Plus size={15} aria-hidden="true" /> Record action
                    </button>
                  )}
                </div>
              </div>
            </header>

            {notice?.issueId === issueId && (
              <div role="status" className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                <span>{notice.message}</span>
                <button type="button" onClick={() => setNotice(null)} className="font-semibold underline">Dismiss</button>
              </div>
            )}

            {issueState.refreshError && (
              <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <span>Issue details could not be refreshed. Existing details are still shown.</span>
                <button type="button" onClick={issueState.reload} disabled={issueState.isRefreshing} className="font-semibold underline disabled:opacity-50">
                  {issueState.isRefreshing ? "Retrying..." : "Retry Issue refresh"}
                </button>
              </div>
            )}

            {(access.isArchived || access.error || (!accessPending && issue?.clientId && !canRecord)) && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                <LockKeyhole size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <p>
                  {access.isArchived
                    ? "This Client is archived. Recorded action history remains available, but new actions, corrections, and cancellations are read-only."
                    : access.error || "Recorded action history is available, but action controls are read-only."}
                </p>
              </div>
            )}

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

            <section className="mt-6">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">Intervention history</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Human actions recorded after this Issue, newest first.
                  </p>
                </div>
                {canRecord && (
                  <button type="button" onClick={() => setActionModal({ issueId, mode: "create" })} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
                    <Plus size={15} aria-hidden="true" /> Record action
                  </button>
                )}
              </div>
              <InterventionHistory
                state={interventions}
                highlightedId={
                  highlightedInterventionId?.issueId === issueId
                    ? highlightedInterventionId.id
                    : null
                }
                onOpen={(id) => setSelectedInterventionId({ issueId, id })}
              />
            </section>

            <section className="mt-8 pb-10">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">Unified timeline</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Persisted Signals, recorded actions, Evaluations, Review events, and archive events.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/80 sm:p-6">
                <IssueTimeline state={timeline} />
              </div>
            </section>

            <section className="mt-8 pb-10">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">Occurrence history</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Persisted Signal occurrences, newest first.
                </p>
              </div>
              <IssueSignalHistory state={occurrences} />
            </section>

            {actionModal?.issueId === issueId && (
              <InterventionActionModal
                key={`${issueId}:${actionModal.mode}:${actionModal.intervention?.id || "new"}`}
                issue={issue}
                intervention={actionModal.intervention}
                members={access.members}
                currentUserId={currentUserId}
                mode={actionModal.mode}
                onClose={() => setActionModal(null)}
                onStale={refreshRevision}
                onSuccess={(value, meta) =>
                  handleMutationSuccess(value, {
                    ...meta,
                    operation: actionModal.mode === "correct" ? "correct" : "create",
                  })
                }
              />
            )}

            {selectedInterventionId?.issueId === issueId && (
              <InterventionDetailModal
                key={`${issueId}:${selectedInterventionId.id}`}
                interventionId={selectedInterventionId.id}
                canWrite={canRecord}
                onClose={() => setSelectedInterventionId(null)}
                onCorrect={openCorrection}
                onOpenRelated={(id) => setSelectedInterventionId({ issueId, id })}
                onMutation={handleMutationSuccess}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
