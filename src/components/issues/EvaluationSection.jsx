import { AlertTriangle, ChevronRight, Clock3, RefreshCw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { getEvaluation, refreshInterventionEvaluation } from "../../api/evaluations";
import useEvaluationHistory from "../../hooks/useEvaluationHistory";
import useRequestOwnership from "../../hooks/useRequestOwnership";
import {
  createEvaluationRefreshKey,
  evaluationInterpretabilityLabel,
  evaluationMetricClassificationLabel,
  evaluationMetricLabel,
  evaluationReasonLabel,
  evaluationRequestError,
  evaluationResultLabel,
  evaluationStatusLabel,
  formatEvaluationAbsoluteDelta,
  formatEvaluationDate,
  formatEvaluationMetric,
  formatEvaluationRelativeDelta,
  formatEvaluationWindow,
  normalizeEvaluationDetail,
} from "../../utils/evaluations";
import { HistoryCollectionState } from "../history/HistoryPrimitives";
import StatusBadge from "../ui/StatusBadge";

const aborted = (error) => ["AbortError", "CanceledError"].includes(error?.name) || error?.code === "ERR_CANCELED";

function EvidenceValue({ label, children }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-slate-900 dark:text-slate-100">{children}</dd>
    </div>
  );
}

function Snapshot({ label, snapshot, metric }) {
  if (!snapshot) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-4 dark:border-slate-700">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{label}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Persisted evidence unavailable.</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</p>
          <p className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">{formatEvaluationWindow(snapshot)}</p>
        </div>
        <StatusBadge variant="low">{snapshot.completeness.replaceAll("_", " ")}</StatusBadge>
      </div>
      <p className="mt-4 text-xl font-semibold text-slate-950 dark:text-slate-50">
        {formatEvaluationMetric(metric, snapshot.values[metric], { currencyCode: snapshot.currency })}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span>{snapshot.campaignName || snapshot.campaignId}</span>
        <span>{snapshot.currency}</span>
        <span>{snapshot.provenance.replaceAll("_", " ")}</span>
        <span>{snapshot.rowCount} persisted {snapshot.rowCount === 1 ? "row" : "rows"}</span>
      </div>
    </div>
  );
}

export function EvaluationDetailEvidence({ evaluation }) {
  const primaryResult = evaluation.metricResults.find((item) => item.metric === evaluation.primaryMetric) || null;
  const currency = evaluation.followUp?.currency || evaluation.baseline?.currency;
  const reasonLabels = [...new Set([
    ...evaluation.reasonCodes,
    ...evaluation.metricResults.flatMap((item) => item.reasonCodes),
  ].map(evaluationReasonLabel))];
  const overlap = evaluation.overlapInterventionIds.length > 0 || evaluation.reasonCodes.includes("overlapping_intervention") || evaluation.reasonCodes.includes("overlap_completeness_unavailable");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge variant={evaluation.status === "awaiting_follow_up" ? "low" : "medium"}>
              {evaluationStatusLabel(evaluation.effectiveStatus)}
            </StatusBadge>
            {evaluation.observedResult && <StatusBadge variant="low">{evaluationResultLabel(evaluation.observedResult)}</StatusBadge>}
          </div>
          <p className="mt-3 break-words text-sm leading-6 text-slate-700 dark:text-slate-300">{evaluation.summary}</p>
        </div>
        <div className="shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">
          <p>Version {evaluation.sequence}</p>
          <p className="mt-1">{formatEvaluationDate(evaluation.calculatedAt)}</p>
        </div>
      </div>

      {overlap && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>Another recorded action overlaps this evidence window, so the comparison is not isolated.</p>
        </div>
      )}

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <EvidenceValue label="Action type">{evaluation.actionType.replaceAll("_", " ")}</EvidenceValue>
        <EvidenceValue label="Primary metric">{evaluationMetricLabel(evaluation.primaryMetric)}</EvidenceValue>
        <EvidenceValue label="Watched metrics">{evaluation.watchedMetrics.map(evaluationMetricLabel).join(", ") || "Unavailable"}</EvidenceValue>
        <EvidenceValue label="Observed movement">{evaluationResultLabel(evaluation.observedResult)}</EvidenceValue>
        <EvidenceValue label="Interpretability">{evaluationInterpretabilityLabel(evaluation.interpretability)}</EvidenceValue>
        <EvidenceValue label="Evidence completeness">{evaluation.evidenceCompleteness.replaceAll("_", " ")}</EvidenceValue>
        <EvidenceValue label="Absolute change">{formatEvaluationAbsoluteDelta(primaryResult, currency)}</EvidenceValue>
        <EvidenceValue label="Relative change">{formatEvaluationRelativeDelta(primaryResult?.relativeDelta)}</EvidenceValue>
        <EvidenceValue label="Trigger">{evaluation.triggerType.replaceAll("_", " ")}</EvidenceValue>
      </dl>

      <div>
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Persisted evidence windows</h4>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Stored ReportRun evidence only. This is not live Meta data.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Snapshot label="Baseline" snapshot={evaluation.baseline} metric={evaluation.primaryMetric} />
          <Snapshot label="Follow-up" snapshot={evaluation.followUp} metric={evaluation.primaryMetric} />
        </div>
      </div>

      {evaluation.metricResults.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Metric comparisons</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {evaluation.metricResults.map((result) => (
              <div key={result.metric} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{evaluationMetricLabel(result.metric)}</p>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{evaluationMetricClassificationLabel(result.classification)}</span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <div><dt>Baseline</dt><dd className="mt-1 font-medium text-slate-800 dark:text-slate-200">{formatEvaluationMetric(result.metric, result.baselineValue, { currencyCode: currency })}</dd></div>
                  <div><dt>Follow-up</dt><dd className="mt-1 font-medium text-slate-800 dark:text-slate-200">{formatEvaluationMetric(result.metric, result.followUpValue, { currencyCode: currency })}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}

      {reasonLabels.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Evidence notes</h4>
          <ul className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            {reasonLabels.map((label) => <li key={label} className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-950/60">{label}</li>)}
          </ul>
        </div>
      )}

      {evaluation.invalidationContext && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
          <p className="font-semibold">Historical invalidation</p>
          <p className="mt-1">{evaluationReasonLabel(evaluation.invalidationContext.reason)}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Recorded {formatEvaluationDate(evaluation.invalidationContext.invalidatedAt)}</p>
        </div>
      )}
    </div>
  );
}

export default function EvaluationSection({
  interventionId,
  interventionRevision,
  onInterventionReload,
  onPendingChange = () => {},
}) {
  const refreshErrorId = useId();
  const history = useEvaluationHistory(interventionId);
  const {
    begin: beginDetailRequest,
    finish: finishDetailRequest,
    invalidate: invalidateDetailRequests,
  } = useRequestOwnership();
  const {
    begin: beginRefreshRequest,
    finish: finishRefreshRequest,
    invalidate: invalidateRefreshRequests,
  } = useRequestOwnership();
  const ownerRef = useRef(interventionId);
  const effectOwnerRef = useRef(interventionId);
  const onPendingChangeRef = useRef(onPendingChange);
  const refreshKeyRef = useRef(null);
  const refreshPendingRef = useRef(false);
  const [selectedId, setSelectedId] = useState(null);
  const [detailRecord, setDetailRecord] = useState(null);
  const [detailRequestState, setDetailRequestState] = useState(null);
  const [refreshState, setRefreshState] = useState(null);
  const latestEvaluationId = history.items[0]?.id || null;
  const selectedEvaluationId = selectedId || latestEvaluationId;
  const visibleDetail = detailRecord?.interventionId === interventionId &&
    detailRecord.evaluationId === selectedEvaluationId &&
    detailRecord.data?.interventionId === interventionId
    ? detailRecord.data
    : null;
  const visibleDetailRequest = detailRequestState?.interventionId === interventionId &&
    detailRequestState.evaluationId === selectedEvaluationId
    ? detailRequestState
    : null;
  const visibleRefreshState = refreshState?.interventionId === interventionId
    ? refreshState
    : { pending: false, error: null, notice: "", stale: false };

  useEffect(() => {
    onPendingChangeRef.current = onPendingChange;
  }, [onPendingChange]);

  useEffect(() => {
    const ownerChanged = effectOwnerRef.current !== interventionId;
    effectOwnerRef.current = interventionId;
    ownerRef.current = interventionId;
    const requestedOwner = interventionId;
    refreshPendingRef.current = false;
    refreshKeyRef.current = null;
    if (ownerChanged) onPendingChangeRef.current(false);
    invalidateDetailRequests();
    invalidateRefreshRequests();
    queueMicrotask(() => {
      if (ownerRef.current !== requestedOwner) return;
      setSelectedId(null);
      setDetailRecord(null);
      setDetailRequestState(null);
      setRefreshState(null);
    });
  }, [interventionId, invalidateDetailRequests, invalidateRefreshRequests]);

  useEffect(() => {
    if (!selectedEvaluationId) return undefined;
    const request = beginDetailRequest();
    const requestedInterventionId = interventionId;
    const requestedEvaluationId = selectedEvaluationId;
    queueMicrotask(() => {
      if (!request.isCurrent() || ownerRef.current !== requestedInterventionId) return;
      setDetailRequestState({ interventionId: requestedInterventionId, evaluationId: requestedEvaluationId, loading: true, error: "" });
    });
    getEvaluation(requestedEvaluationId, { signal: request.signal })
      .then((response) => {
        if (!request.isCurrent() || ownerRef.current !== requestedInterventionId) return;
        const normalized = normalizeEvaluationDetail(response?.evaluation);
        if (normalized.id !== requestedEvaluationId || normalized.interventionId !== requestedInterventionId) throw new Error("Evaluation ownership mismatch.");
        if (!request.isCurrent()) return;
        setDetailRecord({ interventionId: requestedInterventionId, evaluationId: requestedEvaluationId, data: normalized });
      })
      .catch((error) => {
        if (!request.isCurrent() || ownerRef.current !== requestedInterventionId || aborted(error)) return;
        setDetailRequestState({ interventionId: requestedInterventionId, evaluationId: requestedEvaluationId, loading: false, error: evaluationRequestError(error, "Could not load this evaluation version.").message });
      })
      .finally(() => {
        if (request.isCurrent() && ownerRef.current === requestedInterventionId) {
          setDetailRequestState((current) => current?.interventionId === requestedInterventionId && current?.evaluationId === requestedEvaluationId
            ? { ...current, loading: false }
            : current);
        }
        finishDetailRequest(request);
    });
    return () => request.controller.abort();
  }, [beginDetailRequest, finishDetailRequest, interventionId, selectedEvaluationId]);

  const requestRefresh = async () => {
    if (refreshPendingRef.current || visibleRefreshState.stale || !visibleDetail?.canRefresh || !Number.isSafeInteger(interventionRevision)) return;
    if (!refreshKeyRef.current) refreshKeyRef.current = createEvaluationRefreshKey();
    const request = beginRefreshRequest();
    const requestedInterventionId = interventionId;
    refreshPendingRef.current = true;
    setRefreshState({ interventionId: requestedInterventionId, pending: true, error: null, notice: "", stale: false });
    onPendingChangeRef.current(true);
    try {
      const response = await refreshInterventionEvaluation(interventionId, {
        expectedInterventionRevision: interventionRevision,
        idempotencyKey: refreshKeyRef.current,
      }, { signal: request.signal });
      if (!request.isCurrent() || ownerRef.current !== requestedInterventionId) return;
      const normalized = normalizeEvaluationDetail(response?.evaluation);
      if (normalized.interventionId !== requestedInterventionId) throw new Error("Evaluation ownership mismatch.");
      setDetailRecord({ interventionId: requestedInterventionId, evaluationId: normalized.id, data: normalized });
      setSelectedId(normalized.id);
      setRefreshState({
        interventionId: requestedInterventionId,
        pending: false,
        error: null,
        stale: false,
        notice: response.httpStatus === 202
          ? "Awaiting persisted follow-up evidence. No Report was started."
          : response.httpStatus === 201
            ? "A new immutable evaluation version was recorded."
            : "The current persisted evaluation is shown.",
      });
      refreshKeyRef.current = null;
      history.revalidate({ failureMessage: "The evaluation was refreshed, but history could not be revalidated." });
    } catch (error) {
      if (!request.isCurrent() || ownerRef.current !== requestedInterventionId || aborted(error)) return;
      const controlled = evaluationRequestError(error, "Could not refresh persisted evaluation evidence.");
      setRefreshState({ interventionId: requestedInterventionId, pending: false, error: controlled, notice: "", stale: Boolean(controlled.stale) });
      if (controlled.stale) refreshKeyRef.current = null;
    } finally {
      if (request.isCurrent() && ownerRef.current === requestedInterventionId) {
        refreshPendingRef.current = false;
        setRefreshState((current) => current?.interventionId === requestedInterventionId
          ? { ...current, pending: false }
          : current);
        onPendingChangeRef.current(false);
      }
      finishRefreshRequest(request);
    }
  };

  const latest = history.items[0];
  return (
    <section className="border-t border-slate-200 pt-6 dark:border-slate-800" aria-labelledby={`evaluation-${interventionId}-title`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`evaluation-${interventionId}-title`} className="font-semibold text-slate-950 dark:text-slate-50">Evaluation</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Immutable comparisons built from persisted ReportRun evidence.</p>
        </div>
        {visibleDetail?.canRefresh && !visibleRefreshState.stale && (
          <button
            type="button"
            onClick={requestRefresh}
            disabled={visibleRefreshState.pending}
            aria-describedby={visibleRefreshState.error ? refreshErrorId : undefined}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw size={14} className={visibleRefreshState.pending ? "animate-spin" : ""} aria-hidden="true" />
            {visibleRefreshState.pending ? "Checking persisted evidence..." : visibleRefreshState.error ? "Retry persisted refresh" : "Refresh evaluation"}
          </button>
        )}
      </div>

      {visibleRefreshState.notice && <p role="status" className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">{visibleRefreshState.notice}</p>}
      {visibleRefreshState.error && (
        <div id={refreshErrorId} role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <p>{visibleRefreshState.error.message}</p>
          {visibleRefreshState.error.stale && <button type="button" onClick={onInterventionReload} className="mt-2 font-semibold underline">Reload action details</button>}
        </div>
      )}

      <div className="mt-4">
        <HistoryCollectionState
          state={history}
          preserveItemsOnError
          emptyTitle="No persisted evaluation yet"
          emptyDescription="Evaluation evidence will appear after this action is processed."
        >
          <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
            <div className="space-y-2" aria-label="Evaluation versions">
              {history.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  aria-current={selectedEvaluationId === item.id ? "true" : undefined}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${selectedEvaluationId === item.id ? "border-slate-400 bg-slate-100 dark:border-slate-600 dark:bg-slate-800" : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"}`}
                >
                  <span>
                    <span className="block font-semibold text-slate-900 dark:text-slate-100">Version {item.sequence}</span>
                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{evaluationStatusLabel(item.effectiveStatus)}</span>
                  </span>
                  <ChevronRight size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
                </button>
              ))}
            </div>
            <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              {visibleDetailRequest?.loading ? (
                <p role="status" className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><Clock3 size={15} aria-hidden="true" /> Loading persisted evaluation...</p>
              ) : visibleDetailRequest?.error ? (
                <div role="alert" className="text-sm text-amber-800 dark:text-amber-200"><p>{visibleDetailRequest.error}</p><button type="button" onClick={() => setSelectedId(null)} className="mt-2 font-semibold underline">Return to latest version</button></div>
              ) : visibleDetail ? <EvaluationDetailEvidence evaluation={visibleDetail} /> : latest ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Select an evaluation version.</p>
              ) : null}
            </div>
          </div>
        </HistoryCollectionState>
      </div>
    </section>
  );
}
