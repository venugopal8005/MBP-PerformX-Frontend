import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  Clock3,
  Mail,
  Play,
} from "lucide-react";

import api from "../api/axios";
import ReportQuickLookMetrics from "../components/reports/ReportQuickLookMetrics";
import ConfidenceBadge from "../components/ui/ConfidenceBadge";
import FrequencyBadge from "../components/ui/FrequencyBadge";
import { CardSkeleton, ListSkeleton } from "../components/ui/Skeleton";
import StatusBadge from "../components/ui/StatusBadge";
import { getManualReportDeliveryOutcome } from "../utils/manualReportDelivery";
import { getSignalAppearance } from "../utils/signalAppearance";

const formatDateTime = (value) => {
  if (!value) return "Not run yet";

  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const severityVariant = (severity) => {
  if (severity === "critical" || severity === "high") return "critical";
  if (severity === "moderate" || severity === "medium") return "medium";
  return "low";
};

const runPlainSummary = (run) =>
  run.summary ||
  run.narrative?.userInsight?.plainSummary ||
  run.narrative?.executiveSummary ||
  "No narrative summary was saved for this run.";

const runDecision = (run) =>
  run.decision ||
  run.narrative?.userInsight?.decisionBrief?.primaryAction ||
  run.narrative?.decision ||
  "No action recorded";

const runCause = (run) =>
  run.likely_cause ||
  run.narrative?.likelyCause?.summary ||
  run.narrative?.reason ||
  "No likely cause recorded";

const runNextSignal = (run) =>
  run.next_signal ||
  run.narrative?.nextSignal ||
  run.narrative?.userInsight?.watchNext?.goodSign ||
  "Watch the next completed report run";

const runDisclaimer = (run) => run.narrative?.disclaimer || run.comparison?.disclaimer || "";

const runConfidence = (run) =>
  run.narrative?.userInsight?.decisionBrief?.confidence ||
  run.narrative?.userInsight?.confidence ||
  run.narrative?.confidence ||
  "";

const reportClientId = (report) => {
  if (!report?.client_id) return "";
  if (typeof report.client_id === "object") return report.client_id._id || "";
  return report.client_id;
};

export default function ReportDetail() {
  const { reportId } = useParams();
  const [searchParams] = useSearchParams();
  const previewParam = searchParams.get("preview");
  const [report, setReport] = useState(null);
  const [runs, setRuns] = useState([]);
  const [signals, setSignals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [safetyOverridePrompt, setSafetyOverridePrompt] = useState(null);
  const [activePreviewTab, setActivePreviewTab] = useState(
    previewParam === "internal" ? "internal" : "client"
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const applyReportHistory = (data) => {
    setReport(data.report);
    setRuns(data.runs || []);
    setSignals(data.signals || []);
  };

  const fetchReportHistory = async () => {
    const res = await api.get(`/reports/${reportId}/history`);
    return res.data;
  };

  const sendNow = async () => {
    setIsSending(true);
    setError("");
    setMessage("");

    try {
      const response = await api.post("/reports/manual-send", { reportId });
      const outcome = getManualReportDeliveryOutcome(response.data);

      if (!outcome.confirmed) {
        throw new Error(outcome.message);
      }

      setMessage(outcome.message);
      applyReportHistory(await fetchReportHistory());
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Report generated, but email delivery failed."
      );
      fetchReportHistory()
        .then(applyReportHistory)
        .catch(() => null);
    } finally {
      setIsSending(false);
    }
  };

  const approveAndSend = async (runId, { overrideSafety = false } = {}) => {
    if (!runId) return;

    setIsApproving(true);
    setError("");
    setMessage("");

    try {
      await api.post(`/report-runs/${runId}/client-report/approve-send`, {
        overrideSafety,
      });
      setSafetyOverridePrompt(null);
      setMessage(
        overrideSafety
          ? "Client report sent with safety override recorded."
          : "Client report approved and sent."
      );
      applyReportHistory(await fetchReportHistory());
    } catch (err) {
      const data = err.response?.data || {};

      if (data.requiresOverride) {
        setSafetyOverridePrompt({
          runId,
          safety: data.safety || {},
          message: data.message,
        });
        fetchReportHistory()
          .then(applyReportHistory)
          .catch(() => null);
        return;
      }

      const safetyReasons = err.response?.data?.safety?.reasons || [];
      if (overrideSafety) {
        setSafetyOverridePrompt(null);
      }
      setError(
        safetyReasons.length
          ? `Client report blocked: ${safetyReasons.join(" ")}`
          : err.response?.data?.message || "Could not approve and send client report."
      );
      fetchReportHistory()
        .then(applyReportHistory)
        .catch(() => null);
    } finally {
      setIsApproving(false);
    }
  };

  const cancelClientReport = async (runId) => {
    if (!runId) return;

    setIsCancelling(true);
    setError("");
    setMessage("");

    try {
      await api.post(`/report-runs/${runId}/client-report/cancel`);
      setMessage("Client report cancelled.");
      applyReportHistory(await fetchReportHistory());
    } catch (err) {
      setError(err.response?.data?.message || "Could not cancel client report.");
      fetchReportHistory()
        .then(applyReportHistory)
        .catch(() => null);
    } finally {
      setIsCancelling(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await api.get(`/reports/${reportId}/history`);
        if (cancelled) return;
        applyReportHistory(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || "Could not load report history.");
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
  }, [reportId]);

  useEffect(() => {
    if (previewParam === "client" || previewParam === "internal") {
      setActivePreviewTab(previewParam);
    }
  }, [previewParam]);

  const clientName = report?.client_id?.name || "Client";
  const clientId = reportClientId(report);
  const recipients = report?.internal_recipients?.length
    ? report.internal_recipients
    : report?.recipients || [];
  const latestRun = runs[0] || null;
  const reportMetaAccountName =
    report?.meta_account_name_snapshot || report?.meta_ad_account_id?.name || "";
  const reportMetaAccountId =
    report?.meta_account_external_id_snapshot || report?.meta_ad_account_id?.ad_account_id || "";
  const hasResolvedMetaAccount = Boolean(report?.meta_ad_account_id);
  const previewReport =
    activePreviewTab === "internal"
      ? latestRun?.internal_report
      : latestRun?.client_report;
  const latestClientReport = latestRun?.client_report;
  const overrideReasons = safetyOverridePrompt?.safety?.reasons || [];
  const canApproveLatest =
    latestRun?._id &&
    ["awaiting_approval", "held_for_review"].includes(latestClientReport?.status);
  const canCancelLatest =
    latestRun?._id &&
    ["generated", "awaiting_approval", "held_for_review", "failed"].includes(
      latestClientReport?.status
    );

  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 overflow-y-auto px-8 py-3">
        <div className="border-b border-slate-200/80 pb-4 dark:border-slate-800">
          <div className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            <Link to="/reports" className="hover:text-slate-900 dark:hover:text-slate-100">
              Reports
            </Link>
            <span className="mx-2">/</span>
            {clientId ? (
              <Link to={`/clients/${clientId}`} className="hover:text-slate-900 dark:hover:text-slate-100">
                {clientName}
              </Link>
            ) : (
              <span>{clientName}</span>
            )}
            <span className="mx-2">/</span>
            <span className="text-slate-900 dark:text-slate-100">{report?.name || "Report"}</span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-card)] dark:border-slate-800 dark:bg-slate-900/80">
            {isLoading ? (
              <CardSkeleton rows={3} className="border-0 bg-transparent p-0 shadow-none" />
            ) : (
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-semibold text-slate-950 dark:text-slate-50">
                      {report?.name}
                    </h1>
                    <StatusBadge variant={report?.status === "active" ? "high" : "low"}>
                      {report?.status || "paused"}
                    </StatusBadge>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
                    <span>{clientName}</span>
                    <span>
                      {hasResolvedMetaAccount
                        ? `Meta: ${reportMetaAccountName}${reportMetaAccountId ? ` (${reportMetaAccountId})` : ""}`
                        : "Meta account unresolved"}
                    </span>
                    <span>{report?.monitored_campaigns?.length || 0} campaigns</span>
                    <FrequencyBadge frequency={report?.type || "daily"} />
                    <span className="inline-flex items-center gap-1">
                      <Mail size={14} />
                      Recipients: {recipients.length ? recipients.join(", ") : "none"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden text-right text-sm text-slate-500 dark:text-slate-400 md:block">
                    <div className="inline-flex items-center gap-1">
                      <Clock3 size={14} />
                      Next run
                    </div>
                    <p>{formatDateTime(report?.next_run_at)}</p>
                  </div>

                  <button
                    type="button"
                    onClick={sendNow}
                    disabled={isSending || !hasResolvedMetaAccount}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
                  >
                    <Play size={15} />
                    {isSending ? "Running..." : "Run Now"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        )}

        {!isLoading && !hasResolvedMetaAccount && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Meta account needs to be assigned to this report before it can run. Complete the Meta migration or reconnect the report account.
          </div>
        )}

        {message && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </div>
        )}

        {!isLoading && latestRun?._id && (
          <ReportQuickLookMetrics
            reportRunId={latestRun._id}
            variant={activePreviewTab === "internal" ? "internal" : "client"}
          />
        )}

        {!isLoading && latestRun?.client_report && latestRun?.internal_report && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)] dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                  Latest Generated Reports
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Client status: {latestRun.client_report.status}
                  {latestRun.client_report.delivery_mode
                    ? ` - ${latestRun.client_report.delivery_mode.replaceAll("_", " ")}`
                    : ""}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {["client", "internal"].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActivePreviewTab(tab)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                      activePreviewTab === tab
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950"
                        : "border border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {tab === "client" ? "Client Report" : "Internal Team Report"}
                  </button>
                ))}

                {canApproveLatest && (
                  <button
                    type="button"
                    onClick={() => approveAndSend(latestRun._id)}
                    disabled={isApproving}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                  >
                    {isApproving ? "Sending..." : "Approve & Send"}
                  </button>
                )}

                {canCancelLatest && (
                  <button
                    type="button"
                    onClick={() => cancelClientReport(latestRun._id)}
                    disabled={isCancelling}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/70 dark:text-rose-300 dark:hover:bg-rose-950/30"
                  >
                    <Ban size={14} />
                    {isCancelling ? "Cancelling..." : "Cancel / Hold"}
                  </button>
                )}
              </div>
            </div>

            {activePreviewTab === "client" && latestRun.client_report.safety?.reasons?.length > 0 && (
              <div className="mx-5 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="font-semibold">Safety notes</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {latestRun.client_report.safety.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="p-5">
              {previewReport?.html ? (
                <iframe
                  title={`${activePreviewTab} report preview`}
                  srcDoc={previewReport.html}
                  className="h-[680px] w-full rounded-xl border border-slate-200 bg-white dark:border-slate-800"
                />
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No {activePreviewTab} report preview was saved for this run.
                </div>
              )}
            </div>
          </section>
        )}

        <section className="mt-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
            Narrative History
          </h2>

          {isLoading ? (
            <ListSkeleton count={3} />
          ) : runs.length ? (
            <div className="space-y-4">
              {runs.map((run) => (
                <article
                  key={run._id}
                  className={`rounded-2xl border bg-white p-5 shadow-[var(--shadow-card)] dark:bg-slate-900/80 ${
                    run.status === "insufficient_data"
                      ? "border-amber-200 dark:border-amber-900/70"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm text-slate-500 dark:text-slate-400">{formatDateTime(run.ran_at)}</p>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {run.internal_report?.status && (
                        <StatusBadge variant={run.internal_report.status === "sent" ? "low" : "medium"}>
                          Internal {run.internal_report.status}
                        </StatusBadge>
                      )}
                      {run.client_report?.status && (
                        <StatusBadge
                          variant={
                            run.client_report.status === "held_for_review" ||
                            run.client_report.status === "failed"
                              ? "critical"
                              : run.client_report.status === "sent"
                                ? "low"
                                : "medium"
                          }
                        >
                          Client {run.client_report.status.replaceAll("_", " ")}
                        </StatusBadge>
                      )}
                      <ConfidenceBadge confidence={runConfidence(run)} />
                      <StatusBadge variant={severityVariant(run.severity)}>
                        {run.status === "insufficient_data" ? "Data needed" : run.severity}
                      </StatusBadge>
                    </div>
                  </div>

                  <p className="mt-5 text-sm italic leading-6 text-slate-700 dark:text-slate-300">
                    "{runPlainSummary(run)}"
                  </p>

                  {runDisclaimer(run) && (
                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                      <span className="font-semibold">Data window note:</span>{" "}
                      {runDisclaimer(run)}
                    </div>
                  )}

                  <div className="mt-8 grid gap-5 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium uppercase text-slate-400 dark:text-slate-500">Key Delta</p>
                      <p className="mt-1 text-slate-700 dark:text-slate-300">
                        {run.key_delta || run.narrative?.keyDelta || "No key delta recorded"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase text-slate-400 dark:text-slate-500">
                        Likely Cause
                      </p>
                      <p className="mt-1 text-slate-700 dark:text-slate-300">{runCause(run)}</p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase text-slate-400 dark:text-slate-500">Decision</p>
                      <p className="mt-1 text-slate-700 dark:text-slate-300">{runDecision(run)}</p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase text-slate-400 dark:text-slate-500">
                        Next Signal
                      </p>
                      <p className="mt-1 text-slate-700 dark:text-slate-300">{runNextSignal(run)}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400">
              No narrative runs yet. Use Run Now or wait for the next scheduled run.
            </div>
          )}
        </section>
      </div>

      <aside className="w-[360px] overflow-y-auto border-l border-slate-200/80 bg-white px-5 py-6 dark:border-slate-800 dark:bg-slate-950/60">
        <h2 className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          Signals
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
            No saved signals yet.
          </div>
        )}
      </aside>

      {safetyOverridePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">
                    Send report despite warnings?
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Narrative found issues with this report&apos;s data quality or trust level.
                    You can still send it manually, but review the warnings before continuing.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-100">
                This report has data quality or trust warnings. Sending may expose incomplete
                or unreliable performance context to the client.
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  Safety reasons
                </p>
                {overrideReasons.length ? (
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700 dark:text-slate-300">
                    {overrideReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                    Safety checks failed, but no detailed reason was returned.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSafetyOverridePrompt(null)}
                disabled={isApproving}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  approveAndSend(safetyOverridePrompt.runId, {
                    overrideSafety: true,
                  })
                }
                disabled={isApproving}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
              >
                {isApproving ? "Sending..." : "Send Anyway"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
