import { Archive, ArrowLeft, CalendarClock, Mail, Users } from "lucide-react";
import { useCallback } from "react";
import { Link, useParams } from "react-router-dom";

import {
  getHistoricalActivities,
  getHistoricalSignals,
  getReportHistory,
  getReportRuns,
} from "../api/history";
import IdentityProvenance from "../components/history/IdentityProvenance";
import IssueListSection from "../components/issues/IssueListSection";
import {
  HistoricalActivityList,
  HistoricalRunList,
  HistoricalSignalList,
  HistoryCollectionState,
  HistorySection,
  HistoryStatGrid,
} from "../components/history/HistoryPrimitives";
import FrequencyBadge from "../components/ui/FrequencyBadge";
import { CardSkeleton } from "../components/ui/Skeleton";
import useCursorHistory from "../hooks/useCursorHistory";
import useRouteOwnedResource from "../hooks/useRouteOwnedResource";
import {
  createHistoryResetKey,
  formatHistoryDate,
  formatHistoryLabel,
  formatHistoryWeekday,
} from "../utils/history";

const scheduleSummary = (report) => {
  const schedule = report?.schedule || {};
  if (report?.type === "weekly") {
    return `${formatHistoryWeekday(schedule.day_of_week)} at ${schedule.time_of_day || "time unavailable"}`;
  }
  if (report?.type === "monthly") {
    return `Day ${schedule.day_of_month || "?"} at ${schedule.time_of_day || "time unavailable"}`;
  }
  return schedule.time_of_day ? `Daily at ${schedule.time_of_day}` : "Schedule unavailable";
};

export default function ReportHistory() {
  const { reportId } = useParams();
  const loadSummary = useCallback(
    ({ signal }) => getReportHistory(reportId, { limit: 1, signal }),
    [reportId]
  );
  const loadRuns = useCallback(
    ({ cursor, signal }) => getReportRuns({ reportId, cursor, signal }),
    [reportId]
  );
  const loadSignals = useCallback(
    ({ cursor, signal }) => getHistoricalSignals({ reportId, cursor, signal }),
    [reportId]
  );
  const loadActivities = useCallback(
    ({ cursor, signal }) => getHistoricalActivities({ reportId, cursor, signal }),
    [reportId]
  );
  const resetKey = createHistoryResetKey("report-history", reportId);
  const runs = useCursorHistory({ loadPage: loadRuns, resetKey: `${resetKey}:runs` });
  const signals = useCursorHistory({ loadPage: loadSignals, resetKey: `${resetKey}:signals` });
  const activities = useCursorHistory({
    loadPage: loadActivities,
    resetKey: `${resetKey}:activities`,
  });
  const summaryState = useRouteOwnedResource({
    ownerKey: reportId,
    loadResource: loadSummary,
    fallbackError: "Could not load Report history.",
  });
  const summary = summaryState.data;
  const summaryError = summaryState.error;
  const isLoadingSummary = summaryState.isLoading;

  const report = summary?.report;

  return (
    <div className="h-full overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1120px]">
        <Link to="/reports/archived" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
          <ArrowLeft size={15} /> Archived reports
        </Link>

        {isLoadingSummary ? (
          <div className="mt-5" role="status" aria-live="polite">
            <span className="sr-only">Loading Report history.</span>
            <div aria-hidden="true"><CardSkeleton rows={7} /></div>
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
                  <Archive size={14} /> Historical report record
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-semibold text-slate-950 dark:text-slate-50">
                    {report?.name || "Report identity unavailable"}
                  </h1>
                  {report?.type && <FrequencyBadge frequency={report.type} />}
                </div>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {report?.is_archived ? `Archived ${formatHistoryDate(report.archived_at)}` : "Active report viewed in historical mode"}
                </p>
              </div>
              <IdentityProvenance
                completeness={report?.identityCompleteness}
                sources={report?.identitySources}
              />
            </div>

            <div className="mt-6 grid gap-4 border-t border-slate-200 pt-5 text-sm sm:grid-cols-2 dark:border-slate-800">
              <div className="flex items-start gap-2">
                <Users size={16} className="mt-0.5 text-slate-400" />
                <div><p className="text-xs text-slate-500">Client</p><p className="font-medium text-slate-800 dark:text-slate-200">{report?.client?.name || "Unavailable"}</p></div>
              </div>
              <div className="flex items-start gap-2">
                <CalendarClock size={16} className="mt-0.5 text-slate-400" />
                <div><p className="text-xs text-slate-500">Archived schedule</p><p className="font-medium text-slate-800 dark:text-slate-200">{scheduleSummary(report)}</p></div>
              </div>
              <div className="flex items-start gap-2">
                <Mail size={16} className="mt-0.5 text-slate-400" />
                <div><p className="text-xs text-slate-500">Delivery mode</p><p className="font-medium text-slate-800 dark:text-slate-200">{formatHistoryLabel(report?.client_delivery_mode)}</p></div>
              </div>
              <div><p className="text-xs text-slate-500">Meta account snapshot</p><p className="font-medium text-slate-800 dark:text-slate-200">{report?.metaAccount?.name || report?.meta_account_name_snapshot || "Unavailable"}</p></div>
            </div>

            <div className="mt-5">
              <HistoryStatGrid items={[
                ["Report runs", report?.reportRunCount || 0],
                ["Signals", report?.signalCount || 0],
                ["Campaigns", report?.monitored_campaigns?.length || 0],
                ["Last run", report?.lastRunAt ? formatHistoryDate(report.lastRunAt) : "None"],
              ]} />
            </div>
          </header>
        )}

        <div className="mt-6">
          <HistorySection title="Report runs" description="Permanent execution evidence for this report." count={report?.reportRunCount}>
            <HistoryCollectionState state={runs} emptyTitle="No report runs">
              <HistoricalRunList runs={runs.items} />
            </HistoryCollectionState>
          </HistorySection>
          <IssueListSection
            reportId={reportId}
            archivedContext
            className="border-t border-slate-200 py-6 dark:border-slate-800"
          />
          <HistorySection title="Signals" description="Retained decisions and performance warnings." count={report?.signalCount}>
            <HistoryCollectionState state={signals} emptyTitle="No historical signals">
              <HistoricalSignalList signals={signals.items} />
            </HistoryCollectionState>
          </HistorySection>
          <HistorySection title="Activity" description="Workspace events recorded for this report.">
            <HistoryCollectionState state={activities} emptyTitle="No historical activity">
              <HistoricalActivityList activities={activities.items} />
            </HistoryCollectionState>
          </HistorySection>
        </div>
      </div>
    </div>
  );
}
