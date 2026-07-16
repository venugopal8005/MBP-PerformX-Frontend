import { Archive, ArrowRight, BriefcaseBusiness, FileClock } from "lucide-react";
import { useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getArchivedClients } from "../api/history";
import IdentityProvenance from "../components/history/IdentityProvenance";
import { HistoryCollectionState } from "../components/history/HistoryPrimitives";
import PageHeader from "../components/ui/PageHeader";
import PageTabs from "../components/ui/PageTabs";
import useCursorHistory from "../hooks/useCursorHistory";
import { formatHistoryDate, historyRecordId } from "../utils/history";

export default function ArchivedClients() {
  const navigate = useNavigate();
  const loadPage = useCallback(
    ({ cursor, signal }) => getArchivedClients({ cursor, signal }),
    []
  );
  const history = useCursorHistory({
    loadPage,
    resetKey: "archived-clients",
  });

  return (
    <div className="h-full overflow-y-auto px-4 py-3 sm:px-6 lg:px-8">
      <div className="w-full max-w-[1250px]">
        <PageHeader
          title="Clients"
          meta={`${history.items.length} loaded`}
          subtitle="Read-only client records retained after archival."
        />
        <PageTabs
          tabs={["Active", "Archived"]}
          activeTab="Archived"
          onChange={(tab) => tab === "Active" && navigate("/clients")}
        />

        <div className="mt-6">
          <HistoryCollectionState
            state={history}
            emptyTitle="No archived clients"
            emptyDescription="Archived client records will appear here when operational access is removed."
          >
            <div className="space-y-3">
              {history.items.map((client) => (
                <Link
                  key={historyRecordId(client)}
                  to={`/clients/${historyRecordId(client)}/history`}
                  className="group block rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-slate-700"
                >
                  <div className="flex items-start justify-between gap-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                          <Archive size={17} />
                        </span>
                        <div>
                          <h2 className="font-semibold text-slate-950 dark:text-slate-50">
                            {client.name || "Unnamed archived client"}
                          </h2>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            Archived {formatHistoryDate(client.archived_at)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-5 text-sm text-slate-600 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1.5">
                          <BriefcaseBusiness size={14} /> {client.reportCount || 0} reports
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <FileClock size={14} /> {client.reportRunCount || 0} runs
                        </span>
                        <span>{client.signalCount || 0} signals</span>
                      </div>
                      <div className="mt-4">
                        <IdentityProvenance
                          completeness={client.identityCompleteness}
                          sources={client.identitySources}
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
