import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import PageHeader from "../components/ui/PageHeader";
import ReportCard from "../components/reports/ReportCard";
import ActivityPanel from "../components/activity/ActivityPanel";
import CreateClientModal from "../components/clients/CreateClientModal";
import FrequencyBadge from "../components/ui/FrequencyBadge";
import ReportClientSelectModal from "../components/reports/ReportClientSelectModal";
import { ListSkeleton } from "../components/ui/Skeleton";

import {
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  PlayCircle,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  X,
} from "lucide-react";

import api from "../api/axios";

const INITIAL_REPORT_FORM = {
  client: null,
  campaigns: [],
  name: "",
  recipients: "",
  internalRecipients: "",
  clientRecipients: "",
  clientDeliveryMode: "generate_only",
  safetySettings: {
    holdClientReportOnLowTrust: true,
    holdClientReportOnMissingMetrics: true,
    holdClientReportOnInsufficientData: true,
    notifyTeamWhenHeld: true,
  },
  frequency: "weekly",
  schedule: {
    timezone: "Asia/Kolkata",
    time_of_day: "09:00",
    day_of_week: "1",
    day_of_month: "",
  },
};

const WEEK_DAYS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

const MONTH_DAYS = Array.from({ length: 31 }, (_, index) => {
  const day = index + 1;
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";

  return {
    value: String(day),
    label: `${day}${suffix}`,
  };
});

const formatFrequency = (frequency = "daily") =>
  `${frequency.charAt(0).toUpperCase()}${frequency.slice(1)}`;

const DELIVERY_MODE_LABELS = {
  generate_only: "Generate only",
  auto_send: "Auto-send if safe",
  approval_required: "Approval required",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const splitEmailInput = (value = "") =>
  String(value)
    .split(/[\s,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

const serializeEmails = (emails = []) => Array.from(new Set(emails)).join(", ");

const parseEmailList = (value = "") => serializeEmails(splitEmailInput(value)).split(", ").filter(Boolean);

const teamEmailsFromMembers = (members = []) =>
  serializeEmails(
    members
      .filter((member) => !member.status || member.status === "active")
      .map((member) => member.email)
      .filter(Boolean)
      .map((email) => String(email).trim().toLowerCase())
  );

function EmailTagInput({
  label,
  description,
  value,
  onChange,
  placeholder,
  helper,
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const emails = parseEmailList(value);

  const commitDraft = (rawValue = draft) => {
    const tokens = splitEmailInput(rawValue);

    if (!tokens.length) return;

    const invalid = tokens.filter((email) => !EMAIL_PATTERN.test(email));
    const valid = tokens.filter((email) => EMAIL_PATTERN.test(email));

    if (valid.length) {
      onChange(serializeEmails([...emails, ...valid]));
    }

    if (invalid.length) {
      setDraft(invalid.join(", "));
      setError(`Check ${invalid[0]}.`);
      return;
    }

    setDraft("");
    setError("");
  };

  const removeEmail = (emailToRemove) => {
    onChange(serializeEmails(emails.filter((email) => email !== emailToRemove)));
  };

  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <label className="block text-sm font-semibold text-slate-900">{label}</label>
          {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
        </div>
        {emails.length > 0 && (
          <span className="shrink-0 text-xs font-medium text-slate-400">
            {emails.length} selected
          </span>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-2.5 transition focus-within:border-slate-400 focus-within:shadow-sm">
        {emails.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {emails.map((email) => (
              <span
                key={email}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
              >
                <span className="truncate">{email}</span>
                <button
                  type="button"
                  onClick={() => removeEmail(email)}
                  className="rounded-full p-0.5 text-slate-400 transition hover:bg-white hover:text-slate-700"
                  aria-label={`Remove ${email}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        <input
          type="email"
          value={draft}
          placeholder={emails.length ? "Add another email..." : placeholder}
          onChange={(event) => {
            setDraft(event.target.value);
            setError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "," || event.key === "Tab") {
              if (draft.trim()) {
                event.preventDefault();
                commitDraft();
              }
            }

            if (event.key === "Backspace" && !draft && emails.length) {
              removeEmail(emails[emails.length - 1]);
            }
          }}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData("text");
            if (!pasted) return;
            event.preventDefault();
            commitDraft(pasted);
          }}
          onBlur={() => commitDraft()}
          className="w-full border-0 bg-transparent px-1 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
      </div>

      {(error || helper) && (
        <p className={`mt-2 text-xs leading-5 ${error ? "text-rose-600" : "text-slate-500"}`}>
          {error || helper}
        </p>
      )}
    </div>
  );
}

const formatShortDate = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatRunDateRange = (run) => {
  const current = run?.period?.current || run?.comparison?.period?.current;
  const start = formatShortDate(current?.start);
  const end = formatShortDate(current?.end);

  if (!start && !end) return "";
  if (start && end && start !== end) return `${start} - ${end}`;
  return start || end;
};

const getClientSafetyStatus = (latestRun) => {
  const clientReport = latestRun?.client_report;
  if (!clientReport?.status) return "";

  if (
    clientReport.status === "held_for_review" ||
    clientReport.status === "failed" ||
    clientReport.safety?.passed === false
  ) {
    return "Needs review";
  }

  if (clientReport.status === "awaiting_approval") return "Pending approval";
  if (clientReport.status === "sent" || clientReport.safety?.passed === true) return "Passed";
  return "Not checked";
};

const isMongoObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || ""));

const clientIdOf = (client) => client?._id || client?.id || "";

const reportClientIdOf = (report) => {
  if (!report?.client_id) return "";
  if (typeof report.client_id === "object") return report.client_id._id || "";
  return report.client_id;
};

const mapBackendClient = (client) => ({
  id: client._id,
  _id: client._id,
  name: client.name,
  account: client.account || client.ad_account_name || "Meta account not selected",
  reports: client.reports || 0,
  campaigns: client.campaigns || 0,
  updated: client.updatedAt ? "Recently updated" : "Just now",
  status: client.status || "stable",
  industry: client.industry,
  notes: client.notes,
});

const mapBackendReport = (report, clients = []) => {
  const clientId = reportClientIdOf(report);
  const client = clients.find((item) => item._id === clientId || item.id === clientId);
  const latestRun = report.latest_run;
  const latestClientStatus = latestRun?.client_report?.status || "";

  return {
    id: report._id,
    databaseId: report._id,
    localOnly: false,
    isActive: report.status === "active",
    title: report.name,
    client: client?.name || report.client_id?.name || "Client",
    campaigns: report.monitored_campaigns?.length || 0,
    insight: report.last_summary || "Monitor configured. Signals will appear after the first run.",
    frequency: formatFrequency(report.type || "daily"),
    status: report.severity || "low",
    clientDeliveryMode: report.client_delivery_mode || "generate_only",
    latestRunId: latestRun?._id || "",
    latestInternalStatus: latestRun?.internal_report?.status || "",
    latestClientStatus,
    latestDateRange: formatRunDateRange(latestRun),
    latestSafetyStatus: getClientSafetyStatus(latestRun),
    latestSafetyReasons: latestRun?.client_report?.safety?.reasons || [],
    canApproveLatest: ["awaiting_approval", "held_for_review"].includes(latestClientStatus),
    latestGeneratedAt: latestRun?.ran_at || latestRun?.createdAt || "",
    latestSentAt:
      latestRun?.client_report?.sent_at ||
      latestRun?.internal_report?.sent_at ||
      "",
    nextRun: report.next_run_at
      ? new Date(report.next_run_at).toLocaleString()
      : report.status === "active"
        ? "Scheduled"
        : "Paused draft",
  };
};

const mapAdAccount = (account) => ({
  id: account.id || `act_${account.account_id}`,
  ad_account_id: account.id || `act_${account.account_id}`,
  ad_account_name: account.name || account.account_id || "Meta ad account",
});

const mapCampaign = (campaign) => ({
  campaign_id: campaign.id,
  campaign_name: campaign.name,
  status: campaign.status,
  objective: campaign.objective,
});

const mapStoredCampaign = (campaign) => ({
  campaign_id: campaign.campaign_id || campaign.campaignId,
  campaign_name: campaign.campaign_name || campaign.campaignName,
  status: campaign.status,
  objective: campaign.objective,
});

const uniqueCampaigns = (...campaignGroups) => {
  const campaignMap = new Map();

  campaignGroups.flat().forEach((campaign) => {
    if (!campaign?.campaign_id || campaignMap.has(campaign.campaign_id)) return;
    campaignMap.set(campaign.campaign_id, campaign);
  });

  return Array.from(campaignMap.values());
};

export default function Reports() {
  const navigate = useNavigate();
  const [clientList, setClientList] = useState([]);
  const [reportsList, setReportsList] = useState([]);
  const [teamMemberEmails, setTeamMemberEmails] = useState([]);
  const [showClientSelectModal, setShowClientSelectModal] = useState(false);
  const [showCreateClientModal, setShowCreateClientModal] = useState(false);
  const [showReportBuilderModal, setShowReportBuilderModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedAdAccount, setSelectedAdAccount] = useState(null);
  const [selectedCampaigns, setSelectedCampaigns] = useState([]);
  const [adAccounts, setAdAccounts] = useState([]);
  const [campaignOptions, setCampaignOptions] = useState([]);
  const [step, setStep] = useState("meta");
  const [reportMode, setReportMode] = useState("create");
  const [reportForm, setReportForm] = useState(INITIAL_REPORT_FORM);
  const [createdReport, setCreatedReport] = useState(null);
  const [editingReport, setEditingReport] = useState(null);
  const [reportPendingDelete, setReportPendingDelete] = useState(null);
  const [pageError, setPageError] = useState("");
  const [pageMessage, setPageMessage] = useState("");
  const [flowError, setFlowError] = useState("");
  const [flowMessage, setFlowMessage] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [reportActionMessage, setReportActionMessage] = useState("");
  const [reportActionError, setReportActionError] = useState("");
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [isCheckingMeta, setIsCheckingMeta] = useState(false);
  const [isLoadingAdAccounts, setIsLoadingAdAccounts] = useState(false);
  const [isSelectingAdAccount, setIsSelectingAdAccount] = useState(false);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
  const [isLoadingEditReport, setIsLoadingEditReport] = useState(false);
  const [isCreatingReport, setIsCreatingReport] = useState(false);
  const [isUpdatingReport, setIsUpdatingReport] = useState(false);
  const [isActivatingReport, setIsActivatingReport] = useState(false);
  const [isSendingNow, setIsSendingNow] = useState(false);
  const [isDeletingReport, setIsDeletingReport] = useState(false);
  const [approvingRunId, setApprovingRunId] = useState("");
  const [metaConnected, setMetaConnected] = useState(false);

  const internalRecipientList = parseEmailList(reportForm.internalRecipients || reportForm.recipients);
  const clientRecipientList = parseEmailList(reportForm.clientRecipients);
  const canReviewReport =
    Boolean(reportForm.name.trim()) &&
    reportForm.schedule.time_of_day &&
    reportForm.campaigns.length > 0 &&
    internalRecipientList.length > 0;

  useEffect(() => {
    let cancelled = false;

    const loadInitialData = async () => {
      setIsLoadingClients(true);
      setIsLoadingReports(true);

      try {
        const [clientsResult, reportsResult, teamResult] = await Promise.allSettled([
          api.get("/clients"),
          api.get("/reports/get-reports"),
          api.get("/settings/team"),
        ]);

        if (cancelled) return;

        const clients =
          clientsResult.status === "fulfilled"
            ? (clientsResult.value.data?.clients || []).map(mapBackendClient)
            : [];
        const backendReports =
          reportsResult.status === "fulfilled" ? reportsResult.value.data || [] : [];
        const loadedTeamRecipients =
          teamResult.status === "fulfilled"
            ? teamEmailsFromMembers(teamResult.value.data?.members || [])
            : "";

        setClientList(clients);
        setReportsList(backendReports.map((report) => mapBackendReport(report, clients)));
        setTeamMemberEmails(parseEmailList(loadedTeamRecipients));

        const params = new URLSearchParams(window.location.search);
        const metaStatus = params.get("meta");
        const returnedClientId = params.get("clientId");

        if (metaStatus === "connected" && returnedClientId) {
          const returnedClient =
            clients.find((client) => client._id === returnedClientId || client.id === returnedClientId) ||
            mapBackendClient((await api.get(`/clients/${returnedClientId}`)).data.client);

          if (cancelled) return;

          setSelectedClient(returnedClient);
          setMetaConnected(true);
          setShowReportBuilderModal(true);
          setStep("adAccount");
          setReportForm({
            ...INITIAL_REPORT_FORM,
            client: returnedClient,
            name: `${returnedClient.name} Weekly Monitor`,
            recipients: loadedTeamRecipients,
            internalRecipients: loadedTeamRecipients,
          });
          setFlowMessage("Meta connected. Choose the ad account to monitor.");
          window.history.replaceState({}, "", window.location.pathname);

          try {
            const accountsRes = await api.get("/meta/ad-accounts", {
              params: { client_id: returnedClientId },
            });

            if (!cancelled) {
              setAdAccounts((accountsRes.data?.accounts || []).map(mapAdAccount));
            }
          } catch (err) {
            if (!cancelled) {
              setFlowError(
                err.response?.data?.message || "Meta connected, but ad accounts could not be loaded."
              );
            }
          }
        }

        if (metaStatus && metaStatus !== "connected") {
          setFlowError("Meta connection did not complete. Please try again.");
          window.history.replaceState({}, "", window.location.pathname);
        }

        if (!metaStatus && returnedClientId) {
          const returnedClient =
            clients.find((client) => client._id === returnedClientId || client.id === returnedClientId) ||
            mapBackendClient((await api.get(`/clients/${returnedClientId}`)).data.client);

          if (cancelled) return;

          setSelectedClient(returnedClient);
          setSelectedAdAccount(null);
          setSelectedCampaigns([]);
          setAdAccounts([]);
          setCampaignOptions([]);
          setReportForm({
            ...INITIAL_REPORT_FORM,
            client: returnedClient,
            name: `${returnedClient.name} Weekly Monitor`,
            recipients: loadedTeamRecipients,
            internalRecipients: loadedTeamRecipients,
          });
          setShowReportBuilderModal(true);
          setStep("meta");
          setFlowMessage("Create a report for this client.");
          window.history.replaceState({}, "", window.location.pathname);
        }
      } catch (err) {
        if (!cancelled) {
          setPageError(err.response?.data?.message || "Could not load reports.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingClients(false);
          setIsLoadingReports(false);
        }
      }
    };

    loadInitialData();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadClients = async () => {
    setIsLoadingClients(true);
    setPageError("");

    try {
      const res = await api.get("/clients");
      const clients = (res.data?.clients || []).map(mapBackendClient);
      setClientList(clients);
      return clients;
    } catch (err) {
      setPageError(err.response?.data?.message || "Could not load clients.");
      return [];
    } finally {
      setIsLoadingClients(false);
    }
  };

  const loadReports = async (clients = clientList) => {
    setIsLoadingReports(true);

    try {
      const res = await api.get("/reports/get-reports");
      setReportsList((res.data || []).map((report) => mapBackendReport(report, clients)));
    } catch (err) {
      setPageError(err.response?.data?.message || "Could not load reports.");
    } finally {
      setIsLoadingReports(false);
    }
  };

  const loadAdAccountsForClient = async (clientId) => {
    const res = await api.get("/meta/ad-accounts", {
      params: { client_id: clientId },
    });
    const accounts = (res.data?.accounts || []).map(mapAdAccount);

    setAdAccounts(accounts);
    return accounts;
  };

  const loadCampaignsForClient = async (clientId, selected = []) => {
    const res = await api.get("/meta/campaigns", {
      params: { client_id: clientId },
    });
    const campaigns = (res.data?.data || res.data?.campaigns || [])
      .map(mapCampaign)
      .filter((campaign) => campaign.campaign_id && campaign.campaign_name);
    const mergedCampaigns = uniqueCampaigns(selected, campaigns);

    setCampaignOptions(mergedCampaigns);
    return mergedCampaigns;
  };

  const buildReportFormFromBackend = (report, client) => {
    const storedCampaigns = (report.monitored_campaigns || [])
      .map(mapStoredCampaign)
      .filter((campaign) => campaign.campaign_id && campaign.campaign_name);
    const frequency = report.type || "weekly";

    return {
      client,
      campaigns: storedCampaigns,
      name: report.name || "",
      recipients: (report.internal_recipients || report.recipients || []).join(", "),
      internalRecipients: (report.internal_recipients || report.recipients || []).join(", "),
      clientRecipients: (report.client_recipients || []).join(", "),
      clientDeliveryMode: report.client_delivery_mode || "generate_only",
      safetySettings: {
        holdClientReportOnLowTrust:
          report.safety_settings?.hold_client_report_on_low_trust ?? true,
        holdClientReportOnMissingMetrics:
          report.safety_settings?.hold_client_report_on_missing_metrics ?? true,
        holdClientReportOnInsufficientData:
          report.safety_settings?.hold_client_report_on_insufficient_data ?? true,
        notifyTeamWhenHeld:
          report.safety_settings?.notify_team_when_held ?? true,
      },
      frequency,
      schedule: {
        timezone: report.schedule?.timezone || "Asia/Kolkata",
        time_of_day: report.schedule?.time_of_day || "09:00",
        day_of_week:
          frequency === "weekly" ? String(report.schedule?.day_of_week ?? "1") : "",
        day_of_month:
          frequency === "monthly" ? String(report.schedule?.day_of_month ?? "1") : "",
      },
    };
  };

  const resetReportFlow = () => {
    setShowClientSelectModal(false);
    setShowCreateClientModal(false);
    setShowReportBuilderModal(false);
    setSelectedClient(null);
    setSelectedAdAccount(null);
    setSelectedCampaigns([]);
    setAdAccounts([]);
    setCampaignOptions([]);
    setStep("meta");
    setReportMode("create");
    setReportForm(INITIAL_REPORT_FORM);
    setCreatedReport(null);
    setEditingReport(null);
    setFlowError("");
    setFlowMessage("");
    setReportActionMessage("");
    setReportActionError("");
    setDeleteError("");
    setIsCheckingMeta(false);
    setIsLoadingAdAccounts(false);
    setIsSelectingAdAccount(false);
    setIsLoadingCampaigns(false);
    setIsLoadingEditReport(false);
    setIsCreatingReport(false);
    setIsUpdatingReport(false);
    setIsActivatingReport(false);
    setIsSendingNow(false);
    setIsDeletingReport(false);
    setMetaConnected(false);
  };

  const openDeleteReportDialog = (reportId) => {
    const report = reportsList.find((item) => item.id === reportId);
    if (!report) return;

    setReportPendingDelete(report);
    setDeleteError("");
  };

  const closeDeleteReportDialog = () => {
    if (isDeletingReport) return;
    setReportPendingDelete(null);
    setDeleteError("");
  };

  const confirmDeleteReport = async () => {
    if (!reportPendingDelete) return;

    const reportId = reportPendingDelete.databaseId || reportPendingDelete.id;

    setIsDeletingReport(true);
    setDeleteError("");
    setPageError("");

    try {
      await api.delete(`/reports/delete-report/${reportId}`);

      setReportsList((current) =>
        current.filter((report) => report.id !== reportPendingDelete.id)
      );
      setReportPendingDelete(null);
    } catch (err) {
      setDeleteError(err.response?.data?.message || "Could not delete this report.");
    } finally {
      setIsDeletingReport(false);
    }
  };

  const approveLatestClientReport = async (report) => {
    if (!report?.latestRunId || approvingRunId) return;

    setApprovingRunId(report.latestRunId);
    setPageError("");
    setPageMessage("");

    try {
      await api.post(`/report-runs/${report.latestRunId}/client-report/approve-send`);
      setPageMessage("Client report approved and sent.");
      await loadReports();
    } catch (err) {
      const safetyReasons = err.response?.data?.safety?.reasons || [];
      setPageError(
        safetyReasons.length
          ? `Client report blocked: ${safetyReasons.join(" ")}`
          : err.response?.data?.message || "Could not approve and send client report."
      );
    } finally {
      setApprovingRunId("");
    }
  };

  const openEditReportFlow = async (reportId) => {
    resetReportFlow();
    setReportMode("edit");
    setIsLoadingEditReport(true);
    setShowReportBuilderModal(true);

    try {
      const [reportRes, loadedClients] = await Promise.all([
        api.get(`/reports/${reportId}`),
        clientList.length ? Promise.resolve(clientList) : loadClients(),
      ]);
      const report = reportRes.data?.report;
      const clientId = reportClientIdOf(report);

      if (!report || !clientId) {
        throw new Error("Report is missing client context.");
      }

      let client = loadedClients.find((item) => item.id === clientId || item._id === clientId);

      if (!client) {
        const clientRes = await api.get(`/clients/${clientId}`);
        client = mapBackendClient(clientRes.data.client);
      }

      const form = buildReportFormFromBackend(report, client);
      const selectedCampaignIds = form.campaigns.map((campaign) => campaign.campaign_id);

      setEditingReport(report);
      setSelectedClient(client);
      setSelectedCampaigns(selectedCampaignIds);
      setCampaignOptions(form.campaigns);
      setReportForm(form);
      setStep("settings");

      try {
        const statusRes = await api.get("/meta/status", {
          params: { client_id: clientId },
        });

        setMetaConnected(Boolean(statusRes.data?.connected));

        if (statusRes.data?.ad_account_id) {
          setSelectedAdAccount({
            id: statusRes.data.ad_account_id,
            ad_account_id: statusRes.data.ad_account_id,
            ad_account_name: statusRes.data.ad_account_name || statusRes.data.ad_account_id,
          });
        }
      } catch {
        setMetaConnected(false);
      }

      try {
        await loadAdAccountsForClient(clientId);
      } catch {
        setFlowError("Report loaded, but Meta ad accounts could not be loaded.");
      }

      try {
        await loadCampaignsForClient(clientId, form.campaigns);
      } catch {
        setCampaignOptions(form.campaigns);
        setFlowError("Report loaded, but live campaigns could not be refreshed.");
      }
    } catch (err) {
      setShowReportBuilderModal(false);
      setPageError(err.response?.data?.message || err.message || "Could not load this report.");
    } finally {
      setIsLoadingEditReport(false);
    }
  };

  const openNewReportFlow = () => {
    resetReportFlow();
    setShowClientSelectModal(true);
    loadClients();
  };

  const checkMetaStatus = async (client) => {
    const clientId = clientIdOf(client);

    if (!isMongoObjectId(clientId)) {
      setFlowError("Save this client to the backend before connecting Meta.");
      return;
    }

    setIsCheckingMeta(true);
    setFlowError("");
    setFlowMessage("");

    try {
      const res = await api.get("/meta/status", {
        params: { client_id: clientId },
      });

      if (res.data?.connected) {
        setMetaConnected(true);
        setFlowMessage("Meta is connected for this client.");

        if (res.data.ad_account_id) {
          setSelectedAdAccount({
            id: res.data.ad_account_id,
            ad_account_id: res.data.ad_account_id,
            ad_account_name: res.data.ad_account_name || res.data.ad_account_id,
          });
        }
      } else {
        setMetaConnected(false);
      }
    } catch (err) {
      setMetaConnected(false);
      setFlowError(err.response?.data?.message || "Could not check Meta connection.");
    } finally {
      setIsCheckingMeta(false);
    }
  };

  const continueWithClient = (client) => {
    const defaultTeamRecipients = serializeEmails(teamMemberEmails);

    setSelectedClient(client);
    setSelectedAdAccount(null);
    setSelectedCampaigns([]);
    setAdAccounts([]);
    setCampaignOptions([]);
    setReportForm({
      ...INITIAL_REPORT_FORM,
      client,
      name: `${client.name} Weekly Monitor`,
      recipients: defaultTeamRecipients,
      internalRecipients: defaultTeamRecipients,
      clientRecipients: "",
    });
    setShowClientSelectModal(false);
    setShowReportBuilderModal(true);
    setStep("meta");
    checkMetaStatus(client);
  };

  const handleCreateClient = async (clientDraft) => {
    setFlowError("");

    try {
      const res = await api.post("/clients", {
        name: clientDraft.name,
        industry: clientDraft.industry,
        notes: clientDraft.notes,
        status: clientDraft.status || "stable",
      });
      const nextClient = mapBackendClient(res.data.client);

      setClientList((current) => [nextClient, ...current]);
      setShowCreateClientModal(false);
      continueWithClient(nextClient);
    } catch (err) {
      setShowCreateClientModal(false);
      setShowClientSelectModal(true);
      setFlowError(err.response?.data?.message || "Could not create client.");
    }
  };

  const connectMeta = () => {
    const clientId = clientIdOf(selectedClient);

    if (!isMongoObjectId(clientId)) {
      setFlowError("Create a backend client before connecting Meta.");
      return;
    }

    window.location.assign(`/api/meta/connect?client_id=${clientId}`);
  };

  const fetchAdAccounts = async () => {
    const clientId = clientIdOf(selectedClient);

    setIsLoadingAdAccounts(true);
    setFlowError("");
    setFlowMessage("");

    try {
      const accounts = await loadAdAccountsForClient(clientId);

      setStep("adAccount");

      if (!accounts.length) {
        setFlowError("No Meta ad accounts were returned for this connection.");
      }
    } catch (err) {
      setFlowError(err.response?.data?.message || "Could not load Meta ad accounts.");
    } finally {
      setIsLoadingAdAccounts(false);
    }
  };

  const fetchCampaigns = async () => {
    const clientId = clientIdOf(selectedClient);

    setIsLoadingCampaigns(true);
    setFlowError("");
    setFlowMessage("");

    try {
      const campaigns = await loadCampaignsForClient(clientId);

      setSelectedCampaigns([]);
      setReportForm((prev) => ({
        ...prev,
        campaigns: [],
      }));
      setStep("campaigns");

      if (!campaigns.length) {
        setFlowError("No campaigns were found in this ad account.");
      }
    } catch (err) {
      setFlowError(err.response?.data?.message || "Could not load campaigns.");
    } finally {
      setIsLoadingCampaigns(false);
    }
  };

  const selectAdAccountAndContinue = async () => {
    const clientId = clientIdOf(selectedClient);

    if (!selectedAdAccount) {
      setFlowError("Choose an ad account first.");
      return;
    }

    setIsSelectingAdAccount(true);
    setFlowError("");

    try {
      await api.post("/meta/select-account", {
        client_id: clientId,
        ad_account_id: selectedAdAccount.ad_account_id,
        ad_account_name: selectedAdAccount.ad_account_name,
      });

      await fetchCampaigns();
    } catch (err) {
      setFlowError(err.response?.data?.message || "Could not select this ad account.");
    } finally {
      setIsSelectingAdAccount(false);
    }
  };

  const toggleCampaign = (campaign) => {
    const exists = selectedCampaigns.includes(campaign.campaign_id);
    const updated = exists
      ? selectedCampaigns.filter((campaignId) => campaignId !== campaign.campaign_id)
      : [...selectedCampaigns, campaign.campaign_id];

    setSelectedCampaigns(updated);
    setReportForm((prev) => ({
      ...prev,
      campaigns: campaignOptions.filter((item) => updated.includes(item.campaign_id)),
    }));
  };

  const updateReportFrequency = (frequency) => {
    setReportForm((prev) => ({
      ...prev,
      frequency,
      schedule: {
        ...prev.schedule,
        day_of_week: frequency === "weekly" ? prev.schedule.day_of_week || "1" : "",
        day_of_month: frequency === "monthly" ? prev.schedule.day_of_month || "1" : "",
      },
    }));
  };

  const updateScheduleField = (field, value) => {
    setReportForm((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [field]: value,
      },
    }));
  };

  const scheduleSummary = () => {
    const time = reportForm.schedule.time_of_day;

    if (reportForm.frequency === "daily") {
      return `Runs every day at ${time}.`;
    }

    if (reportForm.frequency === "monthly") {
      const day =
        MONTH_DAYS.find((item) => item.value === reportForm.schedule.day_of_month)?.label ||
        "1st";

      return `Runs on the ${day} of each month at ${time}.`;
    }

    const day =
      WEEK_DAYS.find((item) => item.value === reportForm.schedule.day_of_week)?.label ||
      "Monday";

    return `Runs every ${day} at ${time}.`;
  };

  const buildReportPayload = ({ includeStatus = true } = {}) => ({
    client_id: clientIdOf(selectedClient),
    name: reportForm.name.trim(),
    type: reportForm.frequency,
    frequency: reportForm.frequency,
    ...(includeStatus ? { status: "paused" } : {}),
    severity: "low",
    recipients: internalRecipientList,
    internal_recipients: internalRecipientList,
    client_recipients: clientRecipientList,
    generate_client_report: true,
    generate_internal_report: true,
    client_delivery_mode: reportForm.clientDeliveryMode,
    safety_settings: {
      hold_client_report_on_low_trust:
        reportForm.safetySettings.holdClientReportOnLowTrust,
      hold_client_report_on_missing_metrics:
        reportForm.safetySettings.holdClientReportOnMissingMetrics,
      hold_client_report_on_insufficient_data:
        reportForm.safetySettings.holdClientReportOnInsufficientData,
      notify_team_when_held: reportForm.safetySettings.notifyTeamWhenHeld,
    },
    monitored_campaigns: reportForm.campaigns,
    schedule: {
      timezone: reportForm.schedule.timezone,
      time_of_day: reportForm.schedule.time_of_day,
      day_of_week:
        reportForm.frequency === "weekly" ? Number(reportForm.schedule.day_of_week) : null,
      day_of_month:
        reportForm.frequency === "monthly"
          ? Number(reportForm.schedule.day_of_month || 1)
          : null,
    },
  });

  const createReportDraft = async () => {
    setIsCreatingReport(true);
    setReportActionMessage("");
    setReportActionError("");

    try {
      const res = await api.post("/reports/create", {
        formData: buildReportPayload(),
      });
      const savedReport = res.data?.report;
      const nextReport = {
        id: savedReport._id,
        databaseId: savedReport._id,
        localOnly: false,
        isActive: savedReport.status === "active",
        title: savedReport.name,
        client: selectedClient.name,
        campaigns: savedReport.monitored_campaigns?.length || reportForm.campaigns.length,
        insight: "Monitor configured. Signals will appear after the first run.",
        frequency: formatFrequency(savedReport.type || reportForm.frequency),
        status: savedReport.severity || "low",
        nextRun: "Paused draft",
      };

      setReportsList((current) => [nextReport, ...current]);
      setCreatedReport(nextReport);
      setReportActionMessage("Report saved to MongoDB as a paused draft.");
      setStep("success");
      loadReports();
    } catch (err) {
      setReportActionError(err.response?.data?.message || "Could not create report.");
    } finally {
      setIsCreatingReport(false);
    }
  };

  const updateExistingReport = async () => {
    if (!editingReport?._id) return;

    setIsUpdatingReport(true);
    setReportActionMessage("");
    setReportActionError("");

    try {
      const res = await api.patch("/reports/update-report", {
        reportId: editingReport._id,
        updates: buildReportPayload({ includeStatus: false }),
      });
      const savedReport = res.data?.report;
      const nextReport = mapBackendReport(savedReport, [selectedClient, ...clientList]);

      setReportsList((current) =>
        current.map((report) => (report.id === nextReport.id ? nextReport : report))
      );
      setCreatedReport(nextReport);
      setEditingReport(savedReport);
      setReportActionMessage("Report settings updated.");
      setStep("success");
      loadReports();
    } catch (err) {
      setReportActionError(err.response?.data?.message || "Could not update report.");
    } finally {
      setIsUpdatingReport(false);
    }
  };

  const activateCreatedReport = async () => {
    if (!createdReport?.databaseId) return;

    setIsActivatingReport(true);
    setReportActionMessage("");
    setReportActionError("");

    try {
      const res = await api.post("/reports/start-report", {
        reportId: createdReport.databaseId,
      });
      const updated = res.data?.report;

      setCreatedReport((current) => ({
        ...current,
        isActive: true,
        nextRun: updated?.next_run_at ? new Date(updated.next_run_at).toLocaleString() : "Scheduled",
      }));
      setReportsList((current) =>
        current.map((report) =>
          report.id === createdReport.id
            ? {
                ...report,
                isActive: true,
                nextRun: updated?.next_run_at
                  ? new Date(updated.next_run_at).toLocaleString()
                  : "Scheduled",
              }
            : report
        )
      );
      setReportActionMessage("Report activated. It will run on the configured schedule.");
    } catch (err) {
      setReportActionError(
        err.response?.data?.message || "Could not activate this report. Please try again."
      );
    } finally {
      setIsActivatingReport(false);
    }
  };

  const sendCreatedReportNow = async () => {
    if (!createdReport?.databaseId) return;

    setIsSendingNow(true);
    setReportActionMessage("");
    setReportActionError("");

    try {
      await api.post("/reports/manual-send", {
        reportId: createdReport.databaseId,
      });

      setReportActionMessage("Manual send started. The backend is generating and sending the report now.");
    } catch (err) {
      setReportActionError(err.response?.data?.message || "Manual send failed. Please try again.");
    } finally {
      setIsSendingNow(false);
    }
  };

  const renderFlowNotice = () => {
    if (!flowError && !flowMessage && !reportActionError) return null;

    const message = flowError || reportActionError || flowMessage;
    const isError = Boolean(flowError || reportActionError);

    return (
      <div
        className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
          isError
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-emerald-200 bg-emerald-50 text-emerald-800"
        }`}
      >
        {message}
      </div>
    );
  };

  return (
    <>
      <div className="flex h-full min-h-0">
        <div className="flex-1 overflow-y-auto px-8 py-3">
          <div className="w-full">
            <PageHeader
              title="Reports"
              subtitle="Operational narrative monitoring across all clients."
              meta={`${reportsList.length} total`}
              actions={
                <button
                  onClick={openNewReportFlow}
                  className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  <Plus size={16} />
                  New Report
                </button>
              }
            />

            {pageError && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {pageError}
              </div>
            )}

            {pageMessage && (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {pageMessage}
              </div>
            )}

            {isLoadingReports ? (
              <ListSkeleton count={4} />
            ) : reportsList.length ? (
              <div className="space-y-4">
                {reportsList.map((report) => (
                  <ReportCard
                    key={report.id}
                    {...report}
                    onOpen={(reportId) => navigate(`/reports/${reportId}`)}
                    onPreview={(reportId, previewType) =>
                      navigate(`/reports/${reportId}?preview=${previewType}`)
                    }
                    onApproveLatest={() => approveLatestClientReport(report)}
                    onEdit={openEditReportFlow}
                    onDelete={openDeleteReportDialog}
                    isApprovingLatest={approvingRunId === report.latestRunId}
                    isEditing={isLoadingEditReport && editingReport?._id === report.id}
                    isDeleting={isDeletingReport && reportPendingDelete?.id === report.id}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">No reports yet</h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Create a client, connect Meta, select campaigns, and launch your first monitor.
                </p>
                <button
                  onClick={openNewReportFlow}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  <Plus size={16} />
                  New Report
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="w-[360px] overflow-y-auto border-l border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950/60">
          <ActivityPanel />
        </div>
      </div>

      {showClientSelectModal && (
        <ReportClientSelectModal
          clients={clientList}
          selectedClient={selectedClient}
          isLoading={isLoadingClients}
          error={flowError}
          onClose={resetReportFlow}
          onCreateClient={() => setShowCreateClientModal(true)}
          onSelectClient={setSelectedClient}
          onContinue={continueWithClient}
        />
      )}

      {reportPendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                  <Trash2 size={20} />
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Delete report?</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    This will remove the report from your workspace.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
                <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                  {reportPendingDelete.title}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {reportPendingDelete.client} - {reportPendingDelete.campaigns} campaigns
                </p>
              </div>

              {deleteError && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {deleteError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
              <button
                type="button"
                onClick={closeDeleteReportDialog}
                disabled={isDeletingReport}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDeleteReport}
                disabled={isDeletingReport}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 size={16} />
                {isDeletingReport ? "Deleting..." : "Delete report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateClientModal && (
        <CreateClientModal
          onClose={() => setShowCreateClientModal(false)}
          onCreate={handleCreateClient}
        />
      )}

      {showReportBuilderModal && (selectedClient || isLoadingEditReport) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <div>
                <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-50">
                  {reportMode === "edit" ? "Edit Report" : "New Report"}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {selectedClient
                    ? `${selectedClient.name} - ${selectedClient.account}`
                    : "Loading report settings..."}
                </p>
              </div>

              <button
                type="button"
                onClick={resetReportFlow}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Close report builder"
              >
                <X size={18} />
              </button>
            </div>

            <div className="border-b border-slate-200 bg-slate-50 px-6 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
              <span className="font-medium text-slate-800 dark:text-slate-200">Client</span>
              <ChevronRight size={14} className="mx-2 inline" />
              <span className={step === "meta" ? "font-medium text-slate-900 dark:text-slate-100" : ""}>Meta</span>
              <ChevronRight size={14} className="mx-2 inline" />
              <span className={step === "adAccount" ? "font-medium text-slate-900 dark:text-slate-100" : ""}>
                Ad Account
              </span>
              <ChevronRight size={14} className="mx-2 inline" />
              <span className={step === "campaigns" ? "font-medium text-slate-900 dark:text-slate-100" : ""}>
                Campaigns
              </span>
              <ChevronRight size={14} className="mx-2 inline" />
              <span className={step === "settings" ? "font-medium text-slate-900 dark:text-slate-100" : ""}>
                Settings
              </span>
              <ChevronRight size={14} className="mx-2 inline" />
              <span className={step === "review" ? "font-medium text-slate-900 dark:text-slate-100" : ""}>Review</span>
              <ChevronRight size={14} className="mx-2 inline" />
              <span className={step === "success" ? "font-medium text-slate-900 dark:text-slate-100" : ""}>
                {reportMode === "edit" ? "Saved" : "Created"}
              </span>
            </div>

            <div className="max-h-[calc(90vh-132px)] overflow-y-auto px-6 py-6">
              {isLoadingEditReport ? (
                <ListSkeleton count={2} compact />
              ) : (
                <>
                  {renderFlowNotice()}

              {step === "meta" && (
                <>
                  <h2 className="text-xl font-semibold text-slate-900">Connect Meta</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Authorize read-only Meta Ads access for {selectedClient.name}.
                  </p>

                  <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-sm font-semibold text-slate-900">
                      {metaConnected ? "Meta is connected" : "Meta connection required"}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Narrative reads ad accounts and campaign data. It does not change budgets,
                      bids, or creative.
                    </p>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <button
                      onClick={connectMeta}
                      className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-white"
                    >
                      <ExternalLink size={16} />
                      {metaConnected ? "Reconnect Meta" : "Connect Meta"}
                    </button>

                    <button
                      onClick={metaConnected ? fetchAdAccounts : () => checkMetaStatus(selectedClient)}
                      disabled={isCheckingMeta || isLoadingAdAccounts}
                      className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <RefreshCw size={16} />
                      {metaConnected
                        ? isLoadingAdAccounts
                          ? "Loading accounts..."
                          : "Continue"
                        : isCheckingMeta
                          ? "Checking..."
                          : "Check Connection"}
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setShowReportBuilderModal(false);
                      setShowClientSelectModal(true);
                    }}
                    className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3"
                  >
                    Back
                  </button>
                </>
              )}

              {step === "adAccount" && (
                <>
                  <h2 className="text-xl font-semibold text-slate-900">Select Ad Account</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Choose the Meta ad account this report should monitor.
                  </p>

                  <div className="mt-6 space-y-3">
                    {adAccounts.map((account) => {
                      const checked = selectedAdAccount?.ad_account_id === account.ad_account_id;

                      return (
                        <button
                          key={account.ad_account_id}
                          type="button"
                          onClick={() => setSelectedAdAccount(account)}
                          className={`flex w-full items-center justify-between rounded-xl border px-4 py-4 text-left transition ${
                            checked ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white"
                          }`}
                        >
                          <span className="text-sm font-semibold text-slate-900">
                            {account.ad_account_name}
                          </span>
                          <span className="text-xs text-slate-400">{account.ad_account_id}</span>
                        </button>
                      );
                    })}

                    {!adAccounts.length && (
                      <div className="rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">
                        {isLoadingAdAccounts ? "Loading ad accounts..." : "No ad accounts loaded yet."}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={selectAdAccountAndContinue}
                    disabled={!selectedAdAccount || isSelectingAdAccount || isLoadingCampaigns}
                    className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3 text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {isSelectingAdAccount || isLoadingCampaigns ? "Loading campaigns..." : "Continue"}
                  </button>

                  <button
                    onClick={reportMode === "edit" ? () => setStep("settings") : () => setStep("meta")}
                    className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3"
                  >
                    Back
                  </button>
                </>
              )}

              {step === "campaigns" && (
                <>
                  <h2 className="text-xl font-semibold text-slate-900">Select Campaigns</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Choose campaigns to monitor for {selectedClient.name}.
                  </p>

                  <div className="mt-6 space-y-3">
                    {campaignOptions.map((campaign) => {
                      const checked = selectedCampaigns.includes(campaign.campaign_id);

                      return (
                        <label
                          key={campaign.campaign_id}
                          className={`flex items-center gap-3 rounded-xl border p-4 transition ${
                            checked ? "border-slate-900 bg-slate-50" : "border-slate-200"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCampaign(campaign)}
                            className="h-4 w-4 accent-slate-900"
                          />
                          <span className="text-sm font-medium text-slate-800">
                            {campaign.campaign_name}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setStep("settings")}
                    disabled={!selectedCampaigns.length}
                    className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3 text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    Continue
                  </button>

                  <button
                    onClick={reportMode === "edit" ? () => setStep("settings") : () => setStep("adAccount")}
                    className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3"
                  >
                    Back
                  </button>
                </>
              )}

              {step === "settings" && (
                <>
                  <h2 className="text-xl font-semibold text-slate-900">Configure Report</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Choose when Narrative should run this monitor.
                  </p>

                  <div className="mt-6">
                    <label className="mb-2 block text-sm text-slate-600">Report Name</label>
                    <input
                      type="text"
                      placeholder="Weekly Executive Report"
                      value={reportForm.name}
                      onChange={(event) =>
                        setReportForm((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 p-4 outline-none focus:border-slate-400"
                    />
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase text-slate-400">Ad Account</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {selectedAdAccount?.ad_account_name || selectedClient.account}
                      </p>
                      <button
                        type="button"
                        onClick={() => setStep("adAccount")}
                        className="mt-3 text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
                      >
                        Change ad account
                      </button>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase text-slate-400">Campaigns</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {reportForm.campaigns.length} selected
                      </p>
                      <button
                        type="button"
                        onClick={() => setStep("campaigns")}
                        className="mt-3 text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
                      >
                        Change campaigns
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm text-slate-600">Frequency</label>
                      <select
                        value={reportForm.frequency}
                        onChange={(event) => updateReportFrequency(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 p-4 outline-none focus:border-slate-400"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>

                    {reportForm.frequency === "weekly" && (
                      <div>
                        <label className="mb-2 block text-sm text-slate-600">Day of week</label>
                        <select
                          value={reportForm.schedule.day_of_week || "1"}
                          onChange={(event) => updateScheduleField("day_of_week", event.target.value)}
                          className="w-full rounded-xl border border-slate-200 p-4 outline-none focus:border-slate-400"
                        >
                          {WEEK_DAYS.map((day) => (
                            <option key={day.value} value={day.value}>
                              {day.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {reportForm.frequency === "monthly" && (
                      <div>
                        <label className="mb-2 block text-sm text-slate-600">Day of month</label>
                        <select
                          value={reportForm.schedule.day_of_month || "1"}
                          onChange={(event) => updateScheduleField("day_of_month", event.target.value)}
                          className="w-full rounded-xl border border-slate-200 p-4 outline-none focus:border-slate-400"
                        >
                          {MONTH_DAYS.map((day) => (
                            <option key={day.value} value={day.value}>
                              {day.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="mb-2 block text-sm text-slate-600">Time of day</label>
                      <input
                        type="time"
                        value={reportForm.schedule.time_of_day}
                        onChange={(event) => updateScheduleField("time_of_day", event.target.value)}
                        className="w-full rounded-xl border border-slate-200 p-4 outline-none focus:border-slate-400"
                      />
                    </div>
                  </div>

                  <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    {scheduleSummary()}
                  </p>

                  <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-950">Delivery settings</h3>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Internal report, client delivery, and send protection.
                          </p>
                        </div>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          Internal always on
                        </span>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-200">
                      <section className="px-5 py-5">
                        <EmailTagInput
                          label="Team recipients"
                          description={
                            teamMemberEmails.length
                              ? "Active team members are added by default."
                              : "Internal reports are sent here automatically."
                          }
                          placeholder="team@example.com"
                          value={reportForm.internalRecipients || reportForm.recipients}
                          onChange={(nextValue) =>
                            setReportForm((prev) => ({
                              ...prev,
                              recipients: nextValue,
                              internalRecipients: nextValue,
                            }))
                          }
                          helper="Internal reports include diagnosis, safety notes, and media-team actions."
                        />
                      </section>

                      <section className="px-5 py-5">
                        <div className="mb-4">
                          <h4 className="text-sm font-semibold text-slate-950">Client delivery</h4>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            The client-safe report is generated on every run.
                          </p>
                        </div>

                        <div className="grid gap-2 md:grid-cols-3">
                          {[
                            {
                              value: "generate_only",
                              title: "Generate only",
                              description: "Save in app without emailing.",
                            },
                            {
                              value: "auto_send",
                              title: "Auto-send if safe",
                              description: "Send after safety checks pass.",
                            },
                            {
                              value: "approval_required",
                              title: "Approval required",
                              description: "Hold for team review first.",
                            },
                          ].map((option) => (
                            <label
                              key={option.value}
                              className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
                                reportForm.clientDeliveryMode === option.value
                                  ? "border-slate-900 bg-slate-950 text-white shadow-sm"
                                  : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                              }`}
                            >
                              <input
                                type="radio"
                                name="client-delivery-mode"
                                value={option.value}
                                checked={reportForm.clientDeliveryMode === option.value}
                                onChange={(event) =>
                                  setReportForm((prev) => ({
                                    ...prev,
                                    clientDeliveryMode: event.target.value,
                                  }))
                                }
                                className="mt-1 h-4 w-4 accent-slate-900"
                              />
                              <span>
                                <span className="block text-sm font-semibold">{option.title}</span>
                                <span
                                  className={`mt-1 block text-xs leading-5 ${
                                    reportForm.clientDeliveryMode === option.value
                                      ? "text-slate-300"
                                      : "text-slate-500"
                                  }`}
                                >
                                  {option.description}
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>

                        <div className="mt-5">
                          <EmailTagInput
                            label="Client recipients"
                            description="Client contacts only receive the client-safe report."
                            placeholder="client@example.com"
                            value={reportForm.clientRecipients}
                            onChange={(nextValue) =>
                              setReportForm((prev) => ({
                                ...prev,
                                clientRecipients: nextValue,
                              }))
                            }
                          />
                        </div>
                      </section>

                      <section className="px-5 py-5">
                        <div className="mb-3">
                          <h4 className="text-sm font-semibold text-slate-950">Safety</h4>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Client emails are blocked when the report is not reliable enough.
                          </p>
                        </div>

                        <div className="grid gap-2 md:grid-cols-3">
                          {[
                            ["holdClientReportOnLowTrust", "Weak data quality"],
                            ["holdClientReportOnMissingMetrics", "Missing key metrics"],
                            ["notifyTeamWhenHeld", "Notify team when held"],
                          ].map(([key, label]) => (
                            <label
                              key={key}
                              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700"
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(reportForm.safetySettings[key])}
                                onChange={(event) =>
                                  setReportForm((prev) => ({
                                    ...prev,
                                    safetySettings: {
                                      ...prev.safetySettings,
                                      [key]: event.target.checked,
                                      ...(key === "holdClientReportOnLowTrust"
                                        ? { holdClientReportOnInsufficientData: event.target.checked }
                                        : {}),
                                    },
                                  }))
                                }
                                className="h-4 w-4 accent-slate-900"
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                      </section>
                    </div>
                  </div>

                  <button
                    onClick={() => setStep("review")}
                    disabled={!canReviewReport}
                    className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3 text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    Review Report
                  </button>

                  <button
                    onClick={reportMode === "edit" ? resetReportFlow : () => setStep("campaigns")}
                    className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3"
                  >
                    {reportMode === "edit" ? "Cancel" : "Back"}
                  </button>
                </>
              )}

              {step === "review" && (
                <>
                  <h2 className="text-xl font-semibold text-slate-900">Review Report</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {reportMode === "edit"
                      ? "Confirm the changes before saving this monitor."
                      : "Confirm the monitor before creating the draft."}
                  </p>

                  <div className="mt-6 space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-medium uppercase text-slate-400">Report</p>
                      <h3 className="mt-2 text-lg font-semibold text-slate-900">{reportForm.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {selectedClient.name} - {selectedAdAccount?.ad_account_name}
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-medium uppercase text-slate-400">Schedule</p>
                        <div className="mt-2">
                          <FrequencyBadge frequency={reportForm.frequency} />
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{scheduleSummary()}</p>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-medium uppercase text-slate-400">Internal recipients</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {internalRecipientList.map((recipient) => (
                            <span
                              key={recipient}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                            >
                              {recipient}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase text-slate-400">Client delivery</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {DELIVERY_MODE_LABELS[reportForm.clientDeliveryMode] || "Generate only"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {clientRecipientList.length ? (
                          clientRecipientList.map((recipient) => (
                            <span
                              key={recipient}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                            >
                              {recipient}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500">No client recipients selected.</span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium uppercase text-slate-400">Campaigns</p>
                        <span className="text-xs text-slate-400">
                          {reportForm.campaigns.length} selected
                        </span>
                      </div>

                      <div className="mt-3 max-h-44 space-y-2 overflow-y-auto">
                        {reportForm.campaigns.map((campaign) => (
                          <div
                            key={campaign.campaign_id}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                          >
                            {campaign.campaign_name}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={reportMode === "edit" ? updateExistingReport : createReportDraft}
                    disabled={isCreatingReport || isUpdatingReport}
                    className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3 text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {reportMode === "edit"
                      ? isUpdatingReport
                        ? "Saving..."
                        : "Save Changes"
                      : isCreatingReport
                        ? "Creating..."
                        : "Create Report Draft"}
                  </button>

                  <button
                    onClick={() => setStep("settings")}
                    className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3"
                  >
                    Back
                  </button>
                </>
              )}

              {step === "success" && createdReport && (
                <>
                  <div className="flex flex-col items-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <CheckCircle2 size={28} />
                    </div>

                    <h2 className="mt-4 text-xl font-semibold text-slate-900">
                      {reportMode === "edit" ? "Report updated" : "Report draft created"}
                    </h2>

                    <p className="mt-2 max-w-md text-sm text-slate-500">
                      {reportMode === "edit"
                        ? `${createdReport.title} has the latest monitor settings.`
                        : `${createdReport.title} is saved. Activate it for scheduled runs, or send it now.`}
                    </p>
                  </div>

                  <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-slate-900">{createdReport.title}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {createdReport.client} - {createdReport.campaigns} campaigns
                        </p>
                      </div>

                      <FrequencyBadge frequency={createdReport.frequency} />
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <p className="text-xs uppercase text-slate-400">Schedule</p>
                        <p className="mt-1 text-sm text-slate-700">{createdReport.nextRun}</p>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <p className="text-xs uppercase text-slate-400">Status</p>
                        <p className="mt-1 text-sm text-slate-700">
                          {createdReport.isActive ? "Active" : "Paused draft"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {(reportActionMessage || reportActionError) && (
                    <div
                      className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                        reportActionError
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-emerald-200 bg-emerald-50 text-emerald-800"
                      }`}
                    >
                      {reportActionError || reportActionMessage}
                    </div>
                  )}

                  {reportMode === "create" && (
                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      <button
                        onClick={activateCreatedReport}
                        disabled={isActivatingReport}
                        className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        <PlayCircle size={16} />
                        {isActivatingReport ? "Activating..." : "Activate Report"}
                      </button>

                      <button
                        onClick={sendCreatedReportNow}
                        disabled={isSendingNow}
                        className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <Send size={16} />
                        {isSendingNow ? "Sending..." : "Send Now"}
                      </button>
                    </div>
                  )}

                  <button
                    onClick={resetReportFlow}
                    className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3"
                  >
                    Done
                  </button>
                </>
              )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
