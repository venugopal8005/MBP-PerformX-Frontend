import { AlertCircle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import StatusBadge from "../ui/StatusBadge";
import { HistoryCollectionState } from "../history/HistoryPrimitives";
import {
  issueDate,
  issueLabel,
  issueSeverityVariant,
  mapIssueSignal,
} from "../../utils/issues";

export default function IssueSignalHistory({ state }) {
  const signals = state.items.map(mapIssueSignal);
  const reportRunCounts = signals.reduce((counts, signal) => {
    if (!signal.reportRunId) return counts;
    counts.set(signal.reportRunId, (counts.get(signal.reportRunId) || 0) + 1);
    return counts;
  }, new Map());

  return (
    <HistoryCollectionState
      state={state}
      emptyTitle="No linked occurrences"
      emptyDescription="No persisted Signal occurrences are linked to this Issue."
    >
      <div className="space-y-3">
        {signals.map((signal) => {
          const siblingCount = reportRunCounts.get(signal.reportRunId) || 0;
          const hasReportRunRoute = /^[a-f\d]{24}$/i.test(signal.reportRunId || "");
          return (
            <article
              key={signal.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
            >
              <div className="flex items-start gap-3">
                <AlertCircle size={17} className="mt-0.5 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-950 dark:text-slate-50">
                          {signal.title || "Signal occurrence"}
                        </h3>
                        <StatusBadge variant={issueSeverityVariant(signal.severity)}>
                          {issueLabel(signal.severity, "Unknown severity")}
                        </StatusBadge>
                      </div>
                      {signal.occurrenceNumber !== null && (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Occurrence {signal.occurrenceNumber}
                        </p>
                      )}
                      {siblingCount > 1 && (
                        <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                          {siblingCount} Signals from this ReportRun in the loaded history
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {issueDate(signal.detectedAt)}
                    </span>
                  </div>

                  {signal.description && (
                    <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {signal.description}
                    </p>
                  )}
                  {signal.recommendation && (
                    <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-200">
                      {signal.recommendation}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 dark:text-slate-500">
                    <span>{signal.campaignId ? "Campaign-scoped evidence" : "Campaign identity unavailable"}</span>
                    <span>Evidence provenance unavailable</span>
                    <span>Matched {issueDate(signal.matchedAt)}</span>
                  </div>
                  {hasReportRunRoute && (
                    <Link
                      to={`/report-runs/${encodeURIComponent(signal.reportRunId)}`}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-slate-400 dark:text-slate-200"
                    >
                      View ReportRun evidence <ArrowRight size={13} aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </HistoryCollectionState>
  );
}
