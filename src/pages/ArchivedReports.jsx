import { Archive, ArrowRight, CalendarClock, Users } from "lucide-react";
import { useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getArchivedReports } from "../api/history";
import IdentityProvenance from "../components/history/IdentityProvenance";
import { HistoryCollectionState } from "../components/history/HistoryPrimitives";
import FrequencyBadge from "../components/ui/FrequencyBadge";
import PageHeader from "../components/ui/PageHeader";
import PageTabs from "../components/ui/PageTabs";
import useCursorHistory from "../hooks/useCursorHistory";
import { formatHistoryDate, historyRecordId } from "../utils/history";

export default function ArchivedReports() {
  const navigate = useNavigate();
  const loadPage = useCallback(
    ({ cursor, signal }) => getArchivedReports({ cursor, signal }),
    []
  );
  const history = useCursorHistory({
    loadPage,
    resetKey: "archived-reports",
  });

  return (
    <div className="h-full overflow-y-auto px-4 py-3 sm:px-6 lg:px-8">
      <div className="w-full max-w-[1250px]">
        <PageHeader
          title="Reports"
          meta={`${history.items.length} loaded`}
          subtitle="Permanent report configuration and execution history."
        />
        <PageTabs
          tabs={["Active", "Archived"]}
          activeTab="Archived"
          onChange={(tab) => tab === "Active" && navigate("/reports")}
        />

        <div className="mt-5">
          <HistoryCollectionState
            state={history}
            emptyTitle="No archived reports"
            emptyDescription="Reports removed from operational use will remain available here."
          >
            <div className="space-y-3">
              {history.items.map((report) => (
                <Link
                  key={historyRecordId(report)}
                  to={`/reports/${historyRecordId(report)}/history`}
                  className="group block rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-slate-700"
                >
                  <div className="flex items-start justify-between gap-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                          <Archive size={17} />
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-semibold text-slate-950 dark:text-slate-50">
                              {report.name || "Unnamed archived report"}
                            </h2>
                            {report.type && <FrequencyBadge frequency={report.type} />}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            Archived {formatHistoryDate(report.archived_at)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-5 text-sm text-slate-600 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1.5">
                          <Users size={14} /> {report.client?.name || "Client identity unavailable"}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock size={14} /> {report.reportRunCount || 0} runs
                        </span>
                        <span>{report.signalCount || 0} signals</span>
                      </div>
                      <div className="mt-4">
                        <IdentityProvenance
                          completeness={report.identityCompleteness}
                          sources={report.identitySources}
                          compact
                        />
                      </div>
                    </div>
                    <ArrowRight size={18} className="mt-2 shrink-0 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200" />
                  </div>
                </Link>
              ))}
            </div>
          </HistoryCollectionState>
        </div>
      </div>
    </div>
  );
}
