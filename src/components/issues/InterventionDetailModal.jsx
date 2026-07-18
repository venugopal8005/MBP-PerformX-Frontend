import { Ban, PencilLine, RefreshCw, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { cancelIntervention, getIntervention } from "../../api/interventions";
import useModalFocusTrap from "../../hooks/useModalFocusTrap";
import useRequestOwnership from "../../hooks/useRequestOwnership";
import {
  createInterventionIntentController,
  canCancelIntervention,
  canCorrectIntervention,
  interventionError,
  interventionPayloadDetails,
  interventionProvenanceLabel,
  interventionStatusLabel,
  interventionStatusVariant,
  interventionSummary,
  mapIntervention,
  validateAuthoritativeIntervention,
} from "../../utils/interventions";
import { issueDate, issueLabel } from "../../utils/issues";
import StatusBadge from "../ui/StatusBadge";
import { CardSkeleton } from "../ui/Skeleton";
import EvaluationSection from "./EvaluationSection";

function DetailRow({ label, children }) {
  if (!children) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm leading-6 text-slate-900 dark:text-slate-100">{children}</dd>
    </div>
  );
}

const identityName = (value) => value?.name || "Unknown";
const requestWasAborted = (error) =>
  error?.name === "AbortError" ||
  error?.name === "CanceledError" ||
  error?.code === "ERR_CANCELED";

function Provenance({ value }) {
  return (
    <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
      {interventionProvenanceLabel(value)}
    </span>
  );
}

export function InterventionDetailEvidence({ detail, onOpenRelated = () => {} }) {
  const issueSnapshot = detail?.issueSnapshot;
  const scope = detail?.scopeSnapshot;
  const signal = detail?.latestSignalSnapshot;
  const payloadRows = interventionPayloadDetails(detail);
  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">{interventionSummary(detail)}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Performed {issueDate(detail.performedAt)}</p>
          </div>
          <StatusBadge variant={interventionStatusVariant(detail.status)}>{interventionStatusLabel(detail.status)}</StatusBadge>
        </div>
        <dl className="mt-5 grid gap-5 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-950/60">
          <DetailRow label="Performer">
            {detail.performedBy?.displayName || "Unavailable"}
            <Provenance value={detail.performedBy?.provenance} />
          </DetailRow>
          <DetailRow label="Recorded by">
            {detail.recordedBy?.displayName || "Unavailable"}
            <Provenance value={detail.recordedBy?.provenance} />
          </DetailRow>
          <DetailRow label="Recorded at">{issueDate(detail.recordedAt)}</DetailRow>
          <DetailRow label="Reason">{detail.reason}</DetailRow>
          <DetailRow label="Note">{detail.note}</DetailRow>
        </dl>
      </section>

      {payloadRows.length > 0 && (
        <section className="border-t border-slate-200 pt-5 dark:border-slate-800">
          <h3 className="font-semibold text-slate-950 dark:text-slate-50">Structured action</h3>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {payloadRows.map((row) => <DetailRow key={row.label} label={row.label}>{row.value}</DetailRow>)}
          </dl>
        </section>
      )}

      {(detail.supersedesInterventionId || detail.supersededByInterventionId) && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="flex items-center gap-2 font-semibold"><RefreshCw size={15} aria-hidden="true" /> Correction lineage</p>
          {detail.supersedesInterventionId && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span>Corrected from an earlier action record.</span>
              <button type="button" onClick={() => onOpenRelated(detail.supersedesInterventionId)} className="font-semibold underline">Open previous record</button>
            </div>
          )}
          {detail.supersededByInterventionId && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span>A replacement action record was created.</span>
              <button type="button" onClick={() => onOpenRelated(detail.supersededByInterventionId)} className="font-semibold underline">Open replacement record</button>
            </div>
          )}
          {detail.correctedBy?.displayName && (
            <p className="mt-2 text-xs">Corrected by {detail.correctedBy.displayName}{detail.correctedAt ? ` · ${issueDate(detail.correctedAt)}` : ""}</p>
          )}
        </section>
      )}

      {detail.status === "cancelled" && detail.cancellation && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          <p className="flex items-center gap-2 font-semibold"><Ban size={15} aria-hidden="true" /> Cancelled action record</p>
          <p className="mt-2">{detail.cancellation.reason}</p>
          <p className="mt-1 text-xs">{detail.cancellation.cancelledBy?.displayName ? `By ${detail.cancellation.cancelledBy.displayName} · ` : ""}{issueDate(detail.cancellation.cancelledAt)}</p>
        </div>
      )}

      <section className="border-t border-slate-200 pt-5 dark:border-slate-800">
        <h3 className="font-semibold text-slate-950 dark:text-slate-50">Historical context</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Captured when this action was recorded. This is not live Meta data.</p>
        <dl className="mt-4 grid gap-5 sm:grid-cols-2">
          <DetailRow label="Issue">
            {issueSnapshot?.title || "Unknown"}
            <Provenance value={issueSnapshot?.provenance} />
          </DetailRow>
          <DetailRow label="Issue state">{issueSnapshot ? `${issueLabel(issueSnapshot.status)} · ${issueLabel(issueSnapshot.severity)}` : "Unknown"}</DetailRow>
          <DetailRow label="Client">{identityName(scope?.client)}<Provenance value={scope?.client?.provenance} /></DetailRow>
          <DetailRow label="Meta account">{identityName(scope?.metaAccount)}<Provenance value={scope?.metaAccount?.provenance} /></DetailRow>
          <DetailRow label="Campaign">{identityName(scope?.campaign)}<Provenance value={scope?.campaign?.provenance} /></DetailRow>
          <DetailRow label="Report">{identityName(scope?.report)}<Provenance value={scope?.report?.provenance} /></DetailRow>
        </dl>
        {signal?.title && (
          <div className="mt-5 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Latest Signal at capture</p>
            <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{signal.title}</p>
            <Provenance value={signal.provenance} />
            {signal.description && <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{signal.description}</p>}
            {signal.recommendation && <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">{signal.recommendation}</p>}
          </div>
        )}
      </section>
    </div>
  );
}

export default function InterventionDetailModal({
  interventionId,
  canWrite,
  onClose,
  onCorrect,
  onMutation,
  onOpenRelated,
}) {
  const titleId = useId();
  const cancelErrorId = useId();
  const dialogRef = useRef(null);
  const closeButton = useRef(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);
  const [cancelMode, setCancelMode] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState(null);
  const [cancelPending, setCancelPending] = useState(false);
  const [cancelNeedsReview, setCancelNeedsReview] = useState(false);
  const [cancelRevision, setCancelRevision] = useState(null);
  const [cancelAuthorityState, setCancelAuthorityState] = useState("idle");
  const [evaluationPending, setEvaluationPending] = useState(false);
  const [cancelController] = useState(() =>
    createInterventionIntentController("cancel")
  );
  const requests = useRequestOwnership();

  const modalPending = cancelPending || evaluationPending;

  useModalFocusTrap({
    containerRef: dialogRef,
    initialFocusRef: closeButton,
    pending: modalPending,
    onClose,
  });

  useEffect(() => {
    const controller = new AbortController();
    getIntervention(interventionId, { signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) {
          const next = mapIntervention(response.intervention);
          setDetail(next);
          const allowed = canCancelIntervention(next, { canWrite });
          setCancelRevision(allowed ? next.revision : null);
          if (!allowed) {
            setCancelMode(false);
          }
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setLoadError(interventionError(error, "Could not load this action record.").message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [canWrite, interventionId, requestVersion]);

  const reload = () => {
    setEvaluationPending(false);
    setLoading(true);
    setLoadError("");
    setRequestVersion((value) => value + 1);
  };

  const beginCancellation = () => {
    setCancelMode(true);
    setCancelReason("");
    setCancelError(null);
    setCancelNeedsReview(false);
    setCancelRevision(detail?.revision ?? null);
    setCancelAuthorityState("idle");
    cancelController.reset();
  };

  const startNewCancellation = () => {
    cancelController.reset();
    setCancelError(null);
    setCancelNeedsReview(false);
  };

  const refreshCancellationAuthority = async (controlled, activeRequest = null) => {
    const request = activeRequest || requests.begin();
    if (request.isCurrent()) {
      setCancelAuthorityState("loading");
      setCancelRevision(null);
    }
    try {
      const response = await getIntervention(interventionId, { signal: request.signal });
      if (!request.isCurrent()) return;
      const rawIntervention = response?.intervention;
      const next = mapIntervention(rawIntervention);
      const authority = validateAuthoritativeIntervention({
        intervention: rawIntervention,
        expectedId: interventionId,
        operation: "cancel",
        canWrite,
      });
      if (authority.complete) setDetail(next);
      setCancelRevision(authority.mutationAllowed ? next.revision : null);
      setCancelAuthorityState(authority.mutationAllowed ? "ready" : "blocked");
      setCancelError({ ...controlled, message: authority.message });
    } catch (error) {
      if (!request.isCurrent() || requestWasAborted(error)) return;
      setCancelRevision(null);
      setCancelAuthorityState("failed");
      setCancelError({
        ...controlled,
        message: `${controlled.message} The latest authoritative record could not be loaded. Retry the refresh.`,
      });
    } finally {
      requests.finish(request);
    }
  };

  const reviewCancellationRefresh = () => {
    if (cancelAuthorityState !== "ready" || !Number.isInteger(cancelRevision)) return;
    setCancelNeedsReview(false);
    setCancelError(null);
  };

  const submitCancellation = async () => {
    const reason = cancelReason.trim();
    if (
      !reason ||
      reason.length > 1000 ||
      cancelPending ||
      cancelNeedsReview ||
      !Number.isInteger(cancelRevision)
    ) {
      if (!reason || reason.length > 1000) {
        setCancelError({ message: "Enter a cancellation reason of 1,000 characters or fewer." });
      }
      return;
    }
    const cancelKey = cancelController.begin();
    if (!cancelKey) return;
    const request = requests.begin();
    setCancelPending(true);
    setCancelError(null);
    try {
      const response = await cancelIntervention(interventionId, {
        idempotencyKey: cancelKey,
        expectedRevision: cancelRevision,
        reason,
      }, { signal: request.signal });
      if (!request.isCurrent()) return;
      const next = mapIntervention(response.intervention);
      setDetail(next);
      setCancelMode(false);
      cancelController.complete();
      onMutation(next, { operation: "cancel", idempotentReplay: response.idempotentReplay === true });
    } catch (error) {
      if (!request.isCurrent() || requestWasAborted(error)) return;
      cancelController.fail();
      const controlled = interventionError(error, "Could not cancel this action record.");
      setCancelError(controlled);
      if (controlled.stale) {
        setCancelNeedsReview(true);
        setCancelRevision(null);
        await refreshCancellationAuthority(controlled, request);
      }
    } finally {
      if (request.isCurrent()) setCancelPending(false);
      requests.finish(request);
    }
  };

  const canCorrect = canCorrectIntervention(detail, { canWrite });
  const canCancel = canCancelIntervention(detail, { canWrite });

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 px-3 py-5 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !modalPending) onClose();
      }}
    >
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="flex max-h-[calc(100vh-2.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Recorded human action</p>
            <h2 id={titleId} className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">Action details</h2>
          </div>
          <button ref={closeButton} type="button" onClick={onClose} disabled={modalPending} aria-label="Close action details" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          {loading ? (
            <div role="status" aria-live="polite"><span className="sr-only">Loading action details.</span><CardSkeleton rows={6} /></div>
          ) : loadError ? (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
              <p>{loadError}</p>
              <button type="button" onClick={reload} className="mt-2 font-semibold underline">Try again</button>
            </div>
          ) : detail ? (
            <div className="space-y-6">
              <InterventionDetailEvidence
                detail={detail}
                onOpenRelated={(relatedId) => {
                  setLoading(true);
                  setLoadError("");
                  onOpenRelated?.(relatedId);
                }}
              />

              {detail.evaluationIntent && (
                <EvaluationSection
                  interventionId={detail.id}
                  interventionRevision={detail.revision}
                  onInterventionReload={reload}
                  onPendingChange={setEvaluationPending}
                />
              )}

              {cancelMode && (
                <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/20">
                  <h3 className="font-semibold text-rose-900 dark:text-rose-100">Cancel this action record?</h3>
                  <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">The action remains in history with cancellation evidence.</p>
                  {cancelError && (
                    <div id={cancelErrorId} role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">
                      <p>{cancelError.message}</p>
                      {cancelError.conflict && <button type="button" onClick={startNewCancellation} className="mt-2 font-semibold underline">Start a new cancellation intent</button>}
                      {cancelNeedsReview && cancelAuthorityState === "ready" && (
                        <button type="button" onClick={reviewCancellationRefresh} className="mt-2 block font-semibold underline">
                          Review refreshed record
                        </button>
                      )}
                      {cancelNeedsReview && ["failed", "blocked"].includes(cancelAuthorityState) && (
                        <button type="button" onClick={() => refreshCancellationAuthority(cancelError)} className="mt-2 block font-semibold underline">
                          Retry refresh
                        </button>
                      )}
                      {cancelAuthorityState === "loading" && (
                        <p className="mt-2 font-medium">Refreshing latest authority...</p>
                      )}
                    </div>
                  )}
                  <label className="mt-4 block text-sm font-medium text-rose-900 dark:text-rose-100">
                    Cancellation reason
                    <textarea aria-invalid={Boolean(cancelError) || undefined} aria-describedby={cancelError ? cancelErrorId : undefined} rows={3} maxLength={1000} value={cancelReason} onChange={(event) => { setCancelReason(event.target.value); if (!cancelNeedsReview) setCancelError(null); }} className="mt-1 w-full rounded-lg border border-rose-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-rose-200 dark:border-rose-800 dark:bg-slate-950 dark:text-slate-100" />
                  </label>
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button type="button" onClick={() => setCancelMode(false)} disabled={cancelPending} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Keep record</button>
                    <button type="button" onClick={submitCancellation} disabled={cancelPending || cancelNeedsReview || !Number.isInteger(cancelRevision)} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50">{cancelPending ? "Cancelling..." : "Confirm cancellation"}</button>
                  </div>
                </section>
              )}
            </div>
          ) : null}
        </div>

        {!loading && detail && !cancelMode && (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6 dark:border-slate-800 dark:bg-slate-950/50">
            {!canWrite && <p className="text-xs text-slate-500 dark:text-slate-400">Read-only action history</p>}
            <div className="ml-auto flex flex-wrap gap-2">
              {canCorrect && (
                <button type="button" onClick={() => onCorrect(detail)} disabled={modalPending} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
                  <PencilLine size={15} aria-hidden="true" /> Correct
                </button>
              )}
              {canCancel && (
                <button type="button" onClick={beginCancellation} disabled={modalPending} className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/30">
                  <Ban size={15} aria-hidden="true" /> Cancel record
                </button>
              )}
              <button type="button" onClick={onClose} disabled={modalPending} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950">Done</button>
            </div>
          </footer>
        )}
      </section>
    </div>
  );
}
