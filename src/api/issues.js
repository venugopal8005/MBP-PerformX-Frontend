import api from "./axios";
import { buildIssueQueryParams } from "../utils/issues";

const issuePage = (response, key) => ({
  items: Array.isArray(response.data?.[key]) ? response.data[key] : [],
  page: response.data?.page || { nextCursor: null, hasMore: false },
});

export const getIssues = async ({ signal, ...filters } = {}) => {
  const response = await api.get("/issues", {
    params: buildIssueQueryParams(filters),
    signal,
  });
  return issuePage(response, "issues");
};

export const getIssue = async (issueId, { signal } = {}) => {
  const response = await api.get(`/issues/${encodeURIComponent(issueId)}`, { signal });
  return response.data;
};

export const getIssueSignals = async (issueId, { cursor, limit = 20, signal } = {}) => {
  const response = await api.get(`/issues/${encodeURIComponent(issueId)}/signals`, {
    params: buildIssueQueryParams({ cursor, limit }),
    signal,
  });
  return issuePage(response, "signals");
};
