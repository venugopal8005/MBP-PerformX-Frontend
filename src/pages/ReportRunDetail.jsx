import { ArrowLeft, CalendarRange, Clock3, FileText, Mail, Users } from "lucide-react";
import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getHistoricalSignals, getReportRun } from "../api/history";
import ArtifactPreviewPanel from "../components/history/ArtifactPreviewPanel";
import IdentityProvenance from "../components/history/IdentityProvenance";
import {
  HistoricalSignalList,
  HistoryCollectionState,
  HistorySection,
  HistoryStatGrid,
} from "../components/history/HistoryPrimitives";
import { CardSkeleton } from "../components/ui/Skeleton";
import StatusBadge from "../components/ui/StatusBadge";
import useCursorHistory from "../hooks/useCursorHistory";
import useRouteOwnedResource from "../hooks/useRouteOwnedResource";
import {
  createHistoryResetKey,
  formatHistoryDate,
  formatHistoryLabel,
  mapDeliveryEvidence,
} from "../utils/history";

export default function ReportRunDetail() {
  const { reportRunId } = useParams();
  const [audience, setAudience] = useState("client");
  const loadReportRun = useCallback(async ({ signal }) => {
    const data = await getReportRun(reportRunId, { signal });
    return data.reportRun || null;
  }, [reportRunId]);
  const loadSignals = useCallback(
    ({ cursor, signal }) => getHistoricalSignals({ reportRunId, cursor, signal }),
    [reportRunId]
  );
  const reportRunState = useRouteOwnedResource({
    ownerKey: reportRunId,
    loadResource: loadReportRun,
    fallbackError: "Could not load this Report run.",
  });
  const signals = useCursorHistory({
    loadPage: loadSignals,
    resetKey: createHistoryResetKey("report-run-signals", reportRunId),
  });
  const reportRun = reportRunState.data;
  const isLoading = reportRunState.isLoading;
  const error = reportRunState.error;

  const reportId = reportRun?.report?.id || reportRun?.report_id;
  const clientId = reportRun?.client?.id || reportRun?.client_id;
  const currentMetrics = reportRun?.displayMetrics || {};
  const period = reportRun?.period || {};
  const deliveryEvidence = mapDeliveryEvidence(reportRun?.delivery);

  return (
    <div className="h-full overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1120px]">
        <Link to={reportId ? `/reports/${reportId}/history` : "/reports/archived"} className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
          <ArrowLeft size={15} /> Report history
        </Link>

        {isLoading ? (
          <div className="mt-5" role="status" aria-live="polite">
            <span className="sr-only">Loading Report run history.</span>
            <div aria-hidden="true"><CardSkeleton rows={8} /></div>
          </div>
        ) : error ? (
          <div role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>
        ) : (
          <>
            <header className="mt-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500"><FileText size={14} /> Permanent execution evidence</div>
                  <h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">{reportRun?.report?.name || "Historical report run"}</h1>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <StatusBadge variant={reportRun?.status === "ok" ? "high" : "medium"}>{formatHistoryLabel(reportRun?.status, "Unknown")}</StatusBadge>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{formatHistoryLabel(reportRun?.trigger_type, "Unknown trigger")}</span>
                  </div>
                </div>
                <IdentityProvenance completeness={reportRun?.identityCompleteness} sources={reportRun?.identitySources} />
              </div>

              <div className="mt-6 grid gap-4 border-t border-slate-200 pt-5 text-sm sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800">
                <div className="flex gap-2"><Users size={16} className="text-slate-400" /><div><p className="text-xs text-slate-500">Client</p>{clientId ? <Link to={`/clients/${clientId}/history`} className="font-medium text-slate-800 hover:underline dark:text-slate-200">{reportRun?.client?.name || "Historical Client"}</Link> : <p>Unavailable</p>}</div></div>
                <div className="flex gap-2"><Clock3 size={16} className="text-slate-400" /><div><p className="text-xs text-slate-500">Started</p><p className="font-medium text-slate-800 dark:text-slate-200">{formatHistoryDate(reportRun?.startedAt || reportRun?.ran_at)}</p></div></div>
                <div className="flex gap-2"><Clock3 size={16} className="text-slate-400" /><div><p className="text-xs text-slate-500">Completed</p><p className="font-medium text-slate-800 dark:text-slate-200">{formatHistoryDate(reportRun?.completedAt)}</p></div></div>
                <div className="flex gap-2"><CalendarRange size={16} className="text-slate-400" /><div><p className="text-xs text-slate-500">Execution stage</p><p className="font-medium text-slate-800 dark:text-slate-200">{formatHistoryLabel(reportRun?.execution_stage)}</p></div></div>
              </div>

              {Object.keys(currentMetrics).length > 0 && (
                <div className="mt-5"><HistoryStatGrid items={Object.entries(currentMetrics).slice(0, 4).map(([key, value]) => [formatHistoryLabel(key), typeof value === "number" ? value.toLocaleString("en-IN") : value ?? "N/A"])} /></div>
              )}
            </header>

            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
              <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">Execution narrative</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{reportRun?.summary || reportRun?.narrative?.executiveSummary || "No narrative summary was retained."}</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950/60"><p className="text-xs font-medium text-slate-500">Decision</p><p className="mt-1 text-sm text-slate-800 dark:text-slate-200">{reportRun?.decision || reportRun?.narrative?.userInsight?.decisionBrief?.primaryAction || "Not recorded"}</p></div>
                <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950/60"><p className="text-xs font-medium text-slate-500">Comparison window</p><p className="mt-1 text-sm text-slate-800 dark:text-slate-200">{period?.current?.start && period?.current?.end ? `${period.current.start} to ${period.current.end}` : "Not recorded"}</p></div>
              </div>
            </section>

            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
              <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">Delivery evidence</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Stored delivery state from this execution, separate from artifact availability.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {deliveryEvidence.map((entry) => (
                  <div key={entry.audience} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{entry.audience === "client" ? "Client report" : "Internal report"}</p>
                      {entry.status && <StatusBadge variant={entry.status === "sent" ? "high" : "medium"}>{formatHistoryLabel(entry.status)}</StatusBadge>}
                    </div>
                    {!entry.available ? (
                      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No delivery evidence was retained.</p>
                    ) : (
                      <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                        {!entry.status && <p>Status was not recorded.</p>}
                        {entry.events.map((event) => <p key={`${event.label}:${event.timestamp}`}><span className="font-medium">{event.label}:</span> {formatHistoryDate(event.timestamp)}</p>)}
                        {entry.safety?.passed === false && <p className="text-amber-700 dark:text-amber-300">Delivery retained trust or data-quality warnings.</p>}
                        {[...new Set([...(entry.safety?.reasons || []), ...(entry.safety?.warnings || [])])].map((warning) => <p key={warning} className="text-xs text-slate-500 dark:text-slate-400">{warning}</p>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-6">
              <HistorySection title="Signals" description="Signals linked to this exact Report run.">
                <HistoryCollectionState state={signals} emptyTitle="No signals linked to this run">
                  <HistoricalSignalList signals={signals.items} />
                </HistoryCollectionState>
              </HistorySection>
              <HistorySection title="Activity references" description="Run-specific Activity filtering is not available in the current history API.">
                <div className="rounded-lg border border-dashed border-slate-300 px-5 py-7 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Activity references cannot be resolved safely without a backend reportRunId filter. Workspace history is not scanned client-side.
                </div>
              </HistorySection>
            </div>

            <section className="mt-6 rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <div><h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">Stored report artifact</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Only the selected audience is requested and held in memory.</p></div>
                <div className="flex items-center gap-2" role="group" aria-label="Artifact audience">
                  {[{ id: "client", label: "Client report", icon: Users }, { id: "internal", label: "Internal report", icon: Mail }].map((option) => {
                    const Icon = option.icon;
                    return <button key={option.id} type="button" onClick={() => setAudience(option.id)} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${audience === option.id ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950" : "border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}><Icon size={15} />{option.label}</button>;
                  })}
                </div>
              </div>
              <div className="p-5">
                <ArtifactPreviewPanel key={`${reportRunId}:${audience}`} reportRunId={reportRunId} audience={audience} available={reportRun?.artifactAvailability?.[audience] === true} />
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
