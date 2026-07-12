import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  CalendarClock,
  Clock3,
  ExternalLink,
  FileText,
  Link2Off,
  Plus,
  RefreshCw,
} from "lucide-react";

import api from "../api/axios";
import FrequencyBadge from "../components/ui/FrequencyBadge";
import { ListSkeleton } from "../components/ui/Skeleton";
import StatusBadge from "../components/ui/StatusBadge";
import { getSignalAppearance } from "../utils/signalAppearance";

const formatDateTime = (value) => {
  if (!value) return "Not available";

  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const severityVariant = (severity) => {
  if (severity === "critical" || severity === "high") return "critical";
  if (severity === "moderate" || severity === "medium") return "medium";
  return "high";
};

const reportStatusVariant = (report) => {
  if (report.severity === "high") return "critical";
  if (report.severity === "medium") return "medium";
  return "high";
};

const reportNextRun = (report) => {
  if (report.status !== "active") return "Paused";
  if (!report.next_run_at) return "Not scheduled";
  return formatDateTime(report.next_run_at);
};

export default function ClientDetail() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [reports, setReports] = useState([]);
  const [signals, setSignals] = useState([]);
  const [metaStatus, setMetaStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadClientDetail = useCallback(async () => {
    const [clientResult, reportsResult, signalsResult, metaResult] = await Promise.allSettled([
      api.get(`/clients/${clientId}`),
      api.get("/reports/get-reports", {
        params: { client_id: clientId },
      }),
      api.get("/signals", {
        params: { client_id: clientId, limit: 8 },
      }),
      api.get("/meta/status", {
        params: { client_id: clientId },
      }),
    ]);

    if (clientResult.status === "rejected") {
      throw clientResult.reason;
    }

    setClient(clientResult.value.data?.client || null);
    setReports(reportsResult.status === "fulfilled" ? reportsResult.value.data || [] : []);
    setSignals(
      signalsResult.status === "fulfilled" ? signalsResult.value.data?.signals || [] : []
    );
    setMetaStatus(metaResult.status === "fulfilled" ? metaResult.value.data : { connected: false });
  }, [clientId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        await loadClientDetail();
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || "Could not load this client.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [loadClientDetail]);

  const refreshClientDetail = async () => {
    setIsRefreshing(true);
    setError("");

    try {
      await loadClientDetail();
    } catch (err) {
      setError(err.response?.data?.message || "Could not refresh this client.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const campaigns = useMemo(() => {
    const campaignMap = new Map();

    reports.forEach((report) => {
      (report.monitored_campaigns || []).forEach((campaign) => {
        if (!campaign.campaign_id || campaignMap.has(campaign.campaign_id)) return;
        campaignMap.set(campaign.campaign_id, campaign);
      });
    });

    return Array.from(campaignMap.values());
  }, [reports]);

  const latestSignalByCampaign = useMemo(() => {
    const byCampaign = new Map();

    signals.forEach((signal) => {
      if (!signal.campaign_id || byCampaign.has(signal.campaign_id)) return;
      byCampaign.set(signal.campaign_id, signal);
    });

    return byCampaign;
  }, [signals]);

  const activeReports = reports.filter((report) => report.status === "active");
  const latestSignal = signals[0];
  const clientStatus = client?.status || "stable";

  const connectMeta = () => {
    navigate("/settings?tab=meta-connections");
  };

  const unassignMetaAccount = async () => {
    const accountId = client?.meta_ad_account?._id;
    if (!accountId) return;
    if (!window.confirm("Unassign this Meta ad account? Existing reports will remain linked to it.")) {
      return;
    }

    try {
      await api.patch(`/settings/meta/ad-accounts/${accountId}/assign-client`, {
        clientId: null,
      });
      await loadClientDetail();
    } catch (err) {
      setError(err.response?.data?.message || "Could not unassign this Meta ad account.");
    }
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 overflow-y-auto px-8 py-3">
        <div className="border-b border-slate-200/80 pb-4 dark:border-slate-800">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              <Link to="/clients" className="hover:text-slate-900 dark:hover:text-slate-100">
                Clients
              </Link>
              <span className="mx-2">/</span>
              <span className="text-slate-900 dark:text-slate-100">{client?.name || "Client"}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(`/reports?clientId=${clientId}`)}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
              >
                <Plus size={15} />
                Create Report
              </button>

              <button
                type="button"
                onClick={connectMeta}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ExternalLink size={15} />
                {metaStatus?.connected
                  ? client?.meta_ad_account
                    ? "Change account"
                    : "Assign Meta account"
                  : "Go to Meta settings"}
              </button>

              {client?.meta_ad_account && (
                <button
                  type="button"
                  onClick={unassignMetaAccount}
                  className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 shadow-sm transition hover:bg-rose-50 dark:border-rose-900/70 dark:bg-slate-900 dark:text-rose-300"
                >
                  <Link2Off size={15} />
                  Unassign
                </button>
              )}

              <button
                type="button"
                onClick={refreshClientDetail}
                disabled={isRefreshing}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Refresh client detail"
              >
                <RefreshCw size={17} className={isRefreshing ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="mt-5">
            <ListSkeleton count={4} />
          </div>
        ) : (
          <>
            <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-card)] dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-semibold text-slate-950 dark:text-slate-50">{client?.name}</h1>
                    <StatusBadge variant={severityVariant(clientStatus)}>{clientStatus}</StatusBadge>
                  </div>

                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {!metaStatus?.connected
                      ? "Meta Ads is not connected for this workspace."
                      : client?.meta_ad_account
                        ? `Meta account: ${client.meta_ad_account.name} (${client.meta_ad_account.ad_account_id})`
                        : "No Meta ad account assigned. Assign one available to this workspace."}
                  </p>
                </div>

                <div className="grid min-w-[360px] grid-cols-3 gap-3 text-sm">
                  <div className="border-l border-slate-200 pl-4 dark:border-slate-800">
                    <p className="text-lg font-semibold text-slate-950 dark:text-slate-50">{activeReports.length}</p>
                    <p className="mt-1 text-slate-500 dark:text-slate-400">Active reports</p>
                  </div>

                  <div className="border-l border-slate-200 pl-4 dark:border-slate-800">
                    <p className="text-lg font-semibold text-slate-950 dark:text-slate-50">{campaigns.length}</p>
                    <p className="mt-1 text-slate-500 dark:text-slate-400">Campaigns monitored</p>
                  </div>

                  <div className="border-l border-slate-200 pl-4 dark:border-slate-800">
                    <p className="text-lg font-semibold text-slate-950 dark:text-slate-50">
                      {latestSignal ? formatDateTime(latestSignal.detected_at) : "No signals"}
                    </p>
                    <p className="mt-1 text-slate-500 dark:text-slate-400">Last signal</p>
                  </div>
                </div>
              </div>

              {client?.notes && (
                <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">
                  {client.notes}
                </p>
              )}
            </section>

            <section className="mt-6">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                Reports
              </h2>

              {reports.length ? (
                <div className="space-y-3">
                  {reports.map((report) => (
                    <button
                      key={report._id}
                      type="button"
                      onClick={() => navigate(`/reports/${report._id}`)}
                      className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-px hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-slate-700"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                            <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">
                              {report.name}
                            </h3>
                          </div>
                          <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
                            {client?.name} - {report.monitored_campaigns?.length || 0} campaigns
                          </p>
                        </div>

                        <FrequencyBadge frequency={report.type} />
                      </div>

                      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
                        <p className="text-sm italic text-slate-600 dark:text-slate-300">
                          "{report.last_summary || "Signals will appear after this report runs."}"
                        </p>
                      </div>

                      <div className="mt-3 flex items-center gap-3 text-sm text-slate-400 dark:text-slate-500">
                        <StatusBadge variant={reportStatusVariant(report)}>
                          {report.severity || "low"}
                        </StatusBadge>
                        <span className="inline-flex items-center gap-1">
                          <Clock3 size={14} />
                          {reportNextRun(report)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                  <FileText size={28} className="mx-auto text-slate-300" />
                  <h3 className="mt-3 text-sm font-semibold text-slate-950 dark:text-slate-50">
                    No reports configured
                  </h3>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Create a report to start monitoring this client.
                  </p>
                </div>
              )}
            </section>

            <section className="mt-6 pb-10">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                Campaign Coverage
              </h2>

              {campaigns.length ? (
                <div className="space-y-2">
                  {campaigns.map((campaign) => {
                    const signal = latestSignalByCampaign.get(campaign.campaign_id);
                    const appearance = signal
                      ? getSignalAppearance(signal)
                      : getSignalAppearance({ title: "No recent signal" });

                    return (
                      <div
                        key={campaign.campaign_id}
	                        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${appearance.dotClassName}`}
                          />
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                            {campaign.campaign_name}
                          </p>
                        </div>

                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {signal?.title || "No recent signal"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
                  No monitored campaigns yet.
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <aside className="w-[360px] overflow-y-auto border-l border-slate-200/80 bg-white px-5 py-6 dark:border-slate-800 dark:bg-slate-950/60">
        <h2 className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          Recent Signals
        </h2>

        {signals.length ? (
          <div className="space-y-5">
            {signals.map((signal) => {
              const appearance = getSignalAppearance(signal);
              const Icon = appearance.Icon;

              return (
                <div key={signal._id} className="flex gap-3">
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${appearance.iconClassName}`}
                  >
                    <Icon size={15} />
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{signal.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                      <CalendarClock size={12} />
                      {formatDateTime(signal.detected_at)}
                      <span>-</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 font-medium ${appearance.badgeClassName}`}
                      >
                        {appearance.label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No recent signals for this client.
          </div>
        )}
      </aside>
    </div>
  );
}
