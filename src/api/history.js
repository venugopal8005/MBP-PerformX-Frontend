import api from "./axios";
import { artifactAudiencePath } from "../utils/history";

const pageResult = (response, key) => ({
  items: Array.isArray(response.data?.[key]) ? response.data[key] : [],
  page: response.data?.page || { nextCursor: null, hasMore: false },
});

const withCursor = ({ cursor, limit = 25, ...params } = {}) => ({
  ...params,
  limit,
  ...(cursor ? { cursor } : {}),
});

export const getArchivedClients = async ({ cursor, limit, signal } = {}) => {
  const response = await api.get("/clients/archived", {
    params: withCursor({ cursor, limit }),
    signal,
  });
  return pageResult(response, "clients");
};

export const getClientHistory = async (clientId, { signal } = {}) => {
  const response = await api.get(`/clients/${encodeURIComponent(clientId)}/history`, { signal });
  return response.data;
};

export const getArchivedReports = async ({ clientId, cursor, limit, signal } = {}) => {
  const response = await api.get("/reports/archived", {
    params: withCursor({ cursor, limit, ...(clientId ? { clientId } : {}) }),
    signal,
  });
  return pageResult(response, "reports");
};

export const getReportHistory = async (reportId, { limit = 25, signal } = {}) => {
  const response = await api.get(`/reports/${encodeURIComponent(reportId)}/history`, {
    params: { limit },
    signal,
  });
  return response.data;
};

export const getReportRuns = async ({ reportId, clientId, cursor, limit, signal } = {}) => {
  const response = await api.get("/report-runs", {
    params: withCursor({
      cursor,
      limit,
      ...(reportId ? { reportId } : {}),
      ...(clientId ? { clientId } : {}),
    }),
    signal,
  });
  return pageResult(response, "runs");
};

export const getReportRun = async (reportRunId, { signal } = {}) => {
  const response = await api.get(`/report-runs/${encodeURIComponent(reportRunId)}`, { signal });
  return response.data;
};

export const getReportArtifact = async (reportRunId, audience, { signal } = {}) => {
  const path = artifactAudiencePath(reportRunId, audience);
  if (!path) throw new Error("A valid report run and artifact audience are required.");
  const response = await api.get(path, { signal });
  return response.data;
};

export const getHistoricalSignals = async ({
  reportId,
  clientId,
  reportRunId,
  cursor,
  limit,
  signal,
} = {}) => {
  const response = await api.get("/signals", {
    params: withCursor({
      cursor,
      limit,
      ...(reportId ? { reportId } : {}),
      ...(clientId ? { clientId } : {}),
      ...(reportRunId ? { reportRunId } : {}),
    }),
    signal,
  });
  return pageResult(response, "signals");
};

export const getHistoricalActivities = async ({ reportId, clientId, cursor, limit, signal } = {}) => {
  const response = await api.get("/activities", {
    params: withCursor({
      cursor,
      limit,
      ...(reportId ? { reportId } : {}),
      ...(clientId ? { clientId } : {}),
    }),
    signal,
  });
  return pageResult(response, "activities");
};

export const historyErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;
