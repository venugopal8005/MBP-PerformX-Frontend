import { ArrowLeft, Check, Clock3, ExternalLink, LockKeyhole, MessageSquareText, Plus } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useParams } from "react-router-dom";

import {
  acknowledgeReviewItem,
  getIssueTimeline,
  getReviewActions,
  getReviewItem,
} from "../api/reviews";
import { getInterventionWorkspaceMembers } from "../api/interventions";
import ReviewActionHistory from "../components/reviews/ReviewActionHistory";
import ReviewInterventionModal from "../components/reviews/ReviewInterventionModal";
import ReviewMutationDialog from "../components/reviews/ReviewMutationDialog";
import IssueTimeline from "../components/reviews/IssueTimeline";
import { CardSkeleton } from "../components/ui/Skeleton";
import useCursorHistory from "../hooks/useCursorHistory";
import useRequestOwnership from "../hooks/useRequestOwnership";
import useRouteOwnedResource from "../hooks/useRouteOwnedResource";
import { requestReviewSummaryRefresh } from "../hooks/useReviewSummary";
import {
  createReviewIntentKey,
  normalizeReviewActionsPage,
  normalizeReviewItem,
  normalizeReviewCompletionStatus,
  normalizeTimelinePage,
  reviewDate,
  reviewError,
  reviewLabel,
} from "../utils/reviews";

const priorityClass = { critical: "border-rose-200 bg-rose-50 text-rose-700", high: "border-amber-200 bg-amber-50 text-amber-700", normal: "border-slate-200 bg-slate-50 text-slate-600" };
const buttonClass = "inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

function DetailField({ label, children }) {
  return <div className="min-w-0"><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-900 dark:text-slate-100">{children || "Unavailable"}</dd></div>;
}

function ReviewDetailOwner({ reviewItemId }) {
  const currentUser = useSelector((state) => state.user?.user);
  const [dialog, setDialog] = useState(null);
  const [members, setMembers] = useState([]);
  const [notice, setNotice] = useState(null);
  const [mutationError, setMutationError] = useState(null);
  const [acknowledging, setAcknowledging] = useState(false);
  const acknowledgeKeyRef = useRef(null);
  const reviewOwnerRef = useRef(reviewItemId);
  const mutationRequests = useRequestOwnership(reviewItemId);

  const loadDetail = useCallback(async ({ signal }) => {
    try {
      const [response, memberResponse] = await Promise.all([
        getReviewItem(reviewItemId, { signal }),
        getInterventionWorkspaceMembers({ signal }).catch(() => []),
      ]);
      if (signal.aborted) throw Object.assign(new Error("Request aborted."), { name: "AbortError" });
      setMembers(memberResponse);
      return normalizeReviewItem(response.reviewItem, { detail: true });
    } catch (error) {
      throw new Error(reviewError(error, "Could not load this Review item.").message, { cause: error });
    }
  }, [reviewItemId]);
  const detail = useRouteOwnedResource({ ownerKey: reviewItemId, loadResource: loadDetail, fallbackError: "Could not load this Review item.", preserveDataOnReload: true });
  const reviewItem = detail.data;

  const loadActions = useCallback(async ({ cursor, signal }) => {
    try {
      return normalizeReviewActionsPage(await getReviewActions(reviewItemId, { cursor, limit: 20, signal }));
    } catch (error) {
      throw new Error(reviewError(error, "Could not load Review action history.").message, { cause: error });
    }
  }, [reviewItemId]);
  const actions = useCursorHistory({ loadPage: loadActions, resetKey: `review-actions:${reviewItemId}`, enabled: Boolean(reviewItem) });

  const issueId = reviewItem?.routes.issueId || reviewItem?.context.issue.id;
  const loadTimeline = useCallback(async ({ cursor, signal }) => {
    try {
      return normalizeTimelinePage(await getIssueTimeline(issueId, { cursor, limit: 20, signal }));
    } catch (error) {
      throw new Error(reviewError(error, "Could not load the Issue timeline.").message, { cause: error });
    }
  }, [issueId]);
  const timeline = useCursorHistory({ loadPage: loadTimeline, resetKey: `review-timeline:${issueId || "none"}`, enabled: Boolean(issueId) });

  const sourceReadOnly = reviewItem && (!reviewItem.isSourceCurrent || !reviewItem.sourceRevisionSynchronized);
  const archived = reviewItem?.effectiveCloseReason === "client_archived";
  const mutationAuthorityAvailable = Boolean(reviewItem && !sourceReadOnly && !archived);

  const reconcile = (ownerId, next, message) => {
    if (reviewOwnerRef.current !== ownerId || next?.id !== ownerId) return;
    setDialog(null);
    setMutationError(null);
    setNotice(message);
    detail.reload();
    actions.revalidate();
    requestReviewSummaryRefresh();
  };

  const acknowledge = async () => {
    if (acknowledging || !mutationAuthorityAvailable || !reviewItem?.permissions.canAcknowledge) return;
    if (!acknowledgeKeyRef.current) acknowledgeKeyRef.current = createReviewIntentKey("review-acknowledge");
    const ownerId = reviewItem.id;
    const request = mutationRequests.begin();
    setAcknowledging(true);
    setMutationError(null);
    try {
      const response = await acknowledgeReviewItem(reviewItem.id, {
        expectedRevision: reviewItem.revision,
        idempotencyKey: acknowledgeKeyRef.current,
      }, { signal: request.signal });
      if (!request.isCurrent() || reviewOwnerRef.current !== ownerId) return;
      const next = normalizeReviewItem(response.reviewItem, { detail: true });
      acknowledgeKeyRef.current = null;
      reconcile(ownerId, next, response.idempotentReplay ? "Existing acknowledgement recovered." : "Review acknowledged.");
    } catch (error) {
      if (!request.isCurrent() || reviewOwnerRef.current !== ownerId || error?.code === "ERR_CANCELED") return;
      const controlled = reviewError(error, "This Review item could not be acknowledged.");
      if (controlled.stale || controlled.sourceStale || controlled.conflict) acknowledgeKeyRef.current = null;
      setMutationError(controlled);
      if (controlled.stale || controlled.sourceStale) detail.reload();
    } finally {
      if (request.isCurrent()) setAcknowledging(false);
      mutationRequests.finish(request);
    }
  };

  const onInterventionSuccess = (ownerId, intervention, meta) => {
    if (reviewOwnerRef.current !== ownerId) return;
    const completion = normalizeReviewCompletionStatus(meta.response.reviewCompletionStatus);
    setDialog(null);
    setMutationError(null);
    setNotice(completion === "pending" ? "Action recorded. Review status is still updating." : meta.idempotentReplay ? "Existing action record recovered and Review completed." : "Action recorded and Review completed.");
    detail.reload();
    actions.revalidate();
    timeline.revalidate();
    requestReviewSummaryRefresh();
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1060px]">
        <Link to="/reviews" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"><ArrowLeft size={15} /> Back to Review queue</Link>
        {detail.isLoading && !reviewItem ? <div role="status" className="mt-5"><span className="sr-only">Loading Review item.</span><CardSkeleton rows={8} /></div> : detail.error && !reviewItem ? <div role="alert" className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800"><p>{detail.error}</p><button type="button" onClick={detail.reload} className="mt-2 font-semibold underline">Retry</button></div> : reviewItem && <>
          <header className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-5"><div className="min-w-0"><p className="text-xs font-semibold uppercase text-slate-500">{reviewLabel(reviewItem.type)}</p><h1 className="mt-2 break-words text-2xl font-semibold text-slate-950 dark:text-slate-50">{reviewItem.source.title || reviewItem.issue.title || reviewLabel(reviewItem.reason)}</h1><p className="mt-2 max-w-3xl break-words text-sm leading-6 text-slate-600 dark:text-slate-300">{reviewItem.source.summary || "Persisted source context is available below."}</p></div><div className="flex flex-wrap gap-2"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClass[reviewItem.priority]}`}>{reviewLabel(reviewItem.priority)} priority</span><span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold dark:border-slate-700">{reviewLabel(reviewItem.effectiveState)}</span></div></div>
            <div className="mt-5 flex flex-wrap gap-2">
              {mutationAuthorityAvailable && reviewItem.permissions.canAcknowledge && <button type="button" onClick={acknowledge} disabled={acknowledging} className={buttonClass}><Check size={15} /> {acknowledging ? "Saving..." : mutationError && !mutationError.stale ? "Retry acknowledge" : "Acknowledge"}</button>}
              {mutationAuthorityAvailable && reviewItem.permissions.canSnooze && <button type="button" onClick={() => setDialog("snooze")} className={buttonClass}><Clock3 size={15} /> Snooze</button>}
              {mutationAuthorityAvailable && reviewItem.type === "evaluation_review" && reviewItem.permissions.canReview && <button type="button" onClick={() => setDialog("interpret")} className={buttonClass}><MessageSquareText size={15} /> Record interpretation</button>}
              {mutationAuthorityAvailable && reviewItem.permissions.canRecordIntervention && <button type="button" onClick={() => setDialog("intervention")} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white focus-visible:ring-2 focus-visible:ring-slate-400 dark:bg-slate-100 dark:text-slate-950"><Plus size={15} /> Record action</button>}
            </div>
          </header>

          {notice && <div role="status" aria-live="polite" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
          {mutationError && <div role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><p>{mutationError.message}</p>{mutationError.stale && <p className="mt-1">Latest authority is being reloaded. Review it before trying again.</p>}{mutationError.conflict && <button type="button" onClick={() => { acknowledgeKeyRef.current = createReviewIntentKey("review-acknowledge"); setMutationError(null); }} className="mt-2 font-semibold underline">Start a new attempt</button>}</div>}
          {(sourceReadOnly || archived || !Object.values(reviewItem.permissions).some(Boolean)) && <div className="mt-4 flex gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300"><LockKeyhole size={16} className="mt-0.5 shrink-0" /><p>{archived ? "This Client is archived. Review history remains readable and controls are disabled." : sourceReadOnly ? "The source changed. This Review item is read-only; persisted history remains available." : "This Review item is no longer actionable. Persisted history remains available."}</p></div>}

          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/80 sm:p-6"><h2 className="text-base font-semibold">Review context</h2><dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><DetailField label="Persisted state">{reviewLabel(reviewItem.persistedState)}</DetailField><DetailField label="Effective state">{reviewLabel(reviewItem.effectiveState)}</DetailField><DetailField label="Close context">{reviewItem.effectiveCloseReason ? reviewLabel(reviewItem.effectiveCloseReason) : "Active"}</DetailField><DetailField label="Reason">{reviewLabel(reviewItem.reason)}</DetailField><DetailField label="Generation">{reviewItem.generation}</DetailField><DetailField label="Revision">{reviewItem.revision}</DetailField><DetailField label="Client">{reviewItem.context.client.name}</DetailField><DetailField label="Account">{reviewItem.context.account.name}</DetailField><DetailField label="Campaign">{reviewItem.context.campaign.name}</DetailField><DetailField label="Opened">{reviewDate(reviewItem.openedAt)}</DetailField><DetailField label="Latest evidence">{reviewDate(reviewItem.latestEvidenceAt)}</DetailField><DetailField label="Source status">{reviewItem.isSourceCurrent && reviewItem.sourceRevisionSynchronized ? "Current and synchronized" : "Historical read-only context"}</DetailField></dl>
            <div className="mt-5 flex flex-wrap gap-4 border-t border-slate-200 pt-4 text-sm font-medium dark:border-slate-800">{reviewItem.routes.issueId && <Link to={`/issues/${reviewItem.routes.issueId}`} className="inline-flex items-center gap-1 underline"><ExternalLink size={14} /> Open Issue</Link>}{reviewItem.context.client.id && <Link to={`/clients/${reviewItem.context.client.id}`} className="inline-flex items-center gap-1 underline"><ExternalLink size={14} /> Open Client</Link>}{reviewItem.routes.reportId && <Link to={`/reports/${reviewItem.routes.reportId}`} className="inline-flex items-center gap-1 underline"><ExternalLink size={14} /> Open Report</Link>}{reviewItem.routes.previousReviewItemId && <Link to={`/reviews/${reviewItem.routes.previousReviewItemId}`} className="inline-flex items-center gap-1 underline"><ExternalLink size={14} /> Previous Review generation</Link>}</div>
          </section>

          <section className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/80"><h2 className="text-base font-semibold">Lifecycle evidence</h2><dl className="mt-4 space-y-4"><DetailField label="Acknowledgement">{reviewItem.acknowledgement ? `${reviewItem.acknowledgement.by?.displayName || "Workspace member"}, ${reviewDate(reviewItem.acknowledgement.at)}` : "Not acknowledged"}</DetailField><DetailField label="Snooze">{reviewItem.snooze ? `Until ${reviewDate(reviewItem.snooze.until)}` : "Not snoozed"}</DetailField><DetailField label="Review">{reviewItem.review ? `${reviewItem.review.by?.displayName || "Workspace member"}, ${reviewDate(reviewItem.review.at)}` : "Not completed"}</DetailField></dl></div><div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/80"><h2 className="text-base font-semibold">Linked records</h2><dl className="mt-4 space-y-4"><DetailField label="Intervention">{reviewItem.linkedIntervention ? `${reviewLabel(reviewItem.linkedIntervention.actionType)} · ${reviewLabel(reviewItem.linkedIntervention.status)}` : "None recorded"}</DetailField><DetailField label="Evaluation">{reviewItem.linkedEvaluation ? `${reviewLabel(reviewItem.linkedEvaluation.observedResult || reviewItem.linkedEvaluation.status)} · ${reviewDate(reviewItem.linkedEvaluation.calculatedAt)}` : "None linked"}</DetailField></dl></div></section>

          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/80 sm:p-6"><h2 className="text-base font-semibold">Review action history</h2><p className="mt-1 mb-4 text-sm text-slate-500">Immutable Review lifecycle records, newest first.</p><ReviewActionHistory state={actions} /></section>
          {issueId && <section className="mt-6 mb-10 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/80 sm:p-6"><h2 className="text-base font-semibold">Issue timeline preview</h2><p className="mt-1 mb-5 text-sm text-slate-500">Persisted context across Signals, actions, Evaluations, and Review events.</p><IssueTimeline state={timeline} compact /></section>}

          {(dialog === "snooze" || dialog === "interpret") && <ReviewMutationDialog key={`${reviewItem.id}:${dialog}`} mode={dialog} reviewItem={reviewItem} onClose={() => reviewOwnerRef.current === reviewItem.id && setDialog(null)} onAuthorityChanged={() => reviewOwnerRef.current === reviewItem.id && detail.reload()} onSuccess={(next, response) => reconcile(reviewItem.id, next, response.idempotentReplay ? "Existing Review action recovered." : dialog === "snooze" ? "Review snoozed." : "Interpretation recorded.")} />}
          {dialog === "intervention" && <ReviewInterventionModal key={`${reviewItem.id}:intervention`} reviewItem={reviewItem} members={members} currentUserId={currentUser?.id || currentUser?._id} onClose={() => reviewOwnerRef.current === reviewItem.id && setDialog(null)} onAuthorityChanged={() => reviewOwnerRef.current === reviewItem.id && detail.reload()} onSuccess={(intervention, meta) => onInterventionSuccess(reviewItem.id, intervention, meta)} />}
        </>}
      </div>
    </div>
  );
}

export default function ReviewDetail() {
  const { reviewItemId } = useParams();
  return <ReviewDetailOwner key={reviewItemId} reviewItemId={reviewItemId} />;
}
