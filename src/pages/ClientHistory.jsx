import { Archive, ArrowLeft, FileText } from "lucide-react";
import { useCallback } from "react";
import { Link, useParams } from "react-router-dom";

import {
  getArchivedReports,
  getClientHistory,
  getHistoricalActivities,
  getHistoricalSignals,
  getReportRuns,
} from "../api/history";
import IdentityProvenance from "../components/history/IdentityProvenance";
import {
  HistoricalActivityList,
  HistoricalRunList,
  HistoricalSignalList,
  HistoryCollectionState,
  HistorySection,
  HistoryStatGrid,
} from "../components/history/HistoryPrimitives";
import { CardSkeleton } from "../components/ui/Skeleton";
import useCursorHistory from "../hooks/useCursorHistory";
import useRouteOwnedResource from "../hooks/useRouteOwnedResource";
import {
  createHistoryResetKey,
  formatHistoryDate,
  historyRecordId,
} from "../utils/history";

export default function ClientHistory() {
  const { clientId } = useParams();
  const loadSummary = useCallback(
    ({ signal }) => getClientHistory(clientId, { signal }),
    [clientId]
  );

  const loadReports = useCallback(
    ({ cursor, signal }) => getArchivedReports({ clientId, cursor, signal }),
    [clientId]
  );
  const loadRuns = useCallback(
    ({ cursor, signal }) => getReportRuns({ clientId, cursor, signal }),
    [clientId]
  );
  const loadSignals = useCallback(
    ({ cursor, signal }) => getHistoricalSignals({ clientId, cursor, signal }),
    [clientId]
  );
  const loadActivities = useCallback(
    ({ cursor, signal }) => getHistoricalActivities({ clientId, cursor, signal }),
    [clientId]
  );
  const resetKey = createHistoryResetKey("client-history", clientId);
  const reports = useCursorHistory({ loadPage: loadReports, resetKey: `${resetKey}:reports` });
  const runs = useCursorHistory({ loadPage: loadRuns, resetKey: `${resetKey}:runs` });
  const signals = useCursorHistory({ loadPage: loadSignals, resetKey: `${resetKey}:signals` });
  const activities = useCursorHistory({
    loadPage: loadActivities,
    resetKey: `${resetKey}:activities`,
  });
  const summaryState = useRouteOwnedResource({
    ownerKey: clientId,
    loadResource: loadSummary,
    fallbackError: "Could not load Client history.",
  });
  const summary = summaryState.data;
  const summaryError = summaryState.error;
  const isLoadingSummary = summaryState.isLoading;

  const client = summary?.client;

  return (
    <div className="h-full overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1120px]">
        <Link to="/clients/archived" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
          <ArrowLeft size={15} /> Archived clients
        </Link>

        {isLoadingSummary ? (
          <div className="mt-5" role="status" aria-live="polite">
            <span className="sr-only">Loading Client history.</span>
            <div aria-hidden="true"><CardSkeleton rows={6} /></div>
          </div>
        ) : summaryError ? (
          <div role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
            {summaryError}
          </div>
        ) : (
          <header className="mt-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">
                  <Archive size={14} /> Historical client record
                </div>
                <h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">
                  {client?.name || "Client identity unavailable"}
                </h1>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {client?.is_archived ? `Archived ${formatHistoryDate(client.archived_at)}` : "Active record viewed in historical mode"}
                </p>
              </div>
              <IdentityProvenance
                completeness={client?.identityCompleteness}
                sources={client?.identitySources}
              />
            </div>
            {(client?.industry || client?.notes) && (
              <div className="mt-5 border-t border-slate-200 pt-5 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
                {client.industry && <p><span className="font-medium">Industry:</span> {client.industry}</p>}
                {client.notes && <p className="mt-2">{client.notes}</p>}
              </div>
            )}
            <div className="mt-5">
              <HistoryStatGrid items={[
                ["Reports", summary?.counts?.reports || 0],
                ["Report runs", summary?.counts?.reportRuns || 0],
                ["Signals", summary?.counts?.signals || 0],
                ["Activities", summary?.counts?.activities || 0],
              ]} />
            </div>
          </header>
        )}

        <div className="mt-6">
          <HistorySection title="Reports" description="Archived report configurations associated with this Client." count={summary?.counts?.archivedReports}>
            <HistoryCollectionState state={reports} emptyTitle="No archived reports">
              <div className="space-y-3">
                {reports.items.map((report) => (
                  <Link key={historyRecordId(report)} to={`/reports/${historyRecordId(report)}/history`} className="group flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-slate-700">
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText size={17} className="shrink-0 text-slate-400" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{report.name || "Historical report"}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Archived {formatHistoryDate(report.archived_at)}</p>
                      </div>
                    </div>
                    <ArrowLeft size={16} className="rotate-180 text-slate-400 group-hover:text-slate-700" />
                  </Link>
                ))}
              </div>
            </HistoryCollectionState>
          </HistorySection>

          <HistorySection title="Report runs" description="Permanent execution evidence for this Client." count={summary?.counts?.reportRuns}>
            <HistoryCollectionState state={runs} emptyTitle="No report runs">
              <HistoricalRunList runs={runs.items} />
            </HistoryCollectionState>
          </HistorySection>

          <HistorySection title="Signals" description="Retained performance signals without live Meta requests." count={summary?.counts?.signals}>
            <HistoryCollectionState state={signals} emptyTitle="No historical signals">
              <HistoricalSignalList signals={signals.items} />
            </HistoryCollectionState>
          </HistorySection>

          <HistorySection title="Activity" description="Recorded workspace events associated with this Client." count={summary?.counts?.activities}>
            <HistoryCollectionState state={activities} emptyTitle="No historical activity">
              <HistoricalActivityList activities={activities.items} />
            </HistoryCollectionState>
          </HistorySection>
        </div>
      </div>
    </div>
  );
}
