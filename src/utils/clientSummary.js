const validSummaryCount = (value) =>
  Number.isInteger(value) && value >= 0 ? value : null;

export const mapBackendClient = (client = {}) => ({
  id: client._id,
  _id: client._id,
  name: client.name,
  account:
    client.meta_ad_account?.name ||
    client.account ||
    client.ad_account_name ||
    "Meta account not assigned",
  metaAdAccount: client.meta_ad_account || null,
  activeReportCount: validSummaryCount(client.activeReportCount),
  monitoredCampaignCount: validSummaryCount(client.monitoredCampaignCount),
  updated: client.updatedAt ? "Recently updated" : "Just now",
  updatedAt: client.updatedAt,
  createdAt: client.createdAt,
  status: client.status || "stable",
  industry: client.industry,
  notes: client.notes,
});

export const filterClientsByStatus = (clients, filter) =>
  clients.filter((client) => {
    if (filter === "Critical") return client.status === "critical";
    if (filter === "Attention needed") {
      return client.status === "moderate" || client.status === "critical";
    }
    return true;
  });

export const formatClientSummaryCount = (value, label) => {
  if (validSummaryCount(value) === null) return `${label} unavailable`;
  const countLabel = value === 1 && label.endsWith("s") ? label.slice(0, -1) : label;
  return `${value} ${countLabel}`;
};
