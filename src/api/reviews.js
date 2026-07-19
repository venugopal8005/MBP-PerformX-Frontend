import api from "./axios";

const compactParams = (values) =>
  Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );

const queueParams = ({ state, type, priority, clientId, campaignId, cursor, limit = 25 } = {}) =>
  compactParams({ state, type, priority, clientId, campaignId, cursor, limit });

export const getReviewItems = async (options = {}) => {
  const { signal, ...filters } = options;
  const response = await api.get("/review-items", {
    params: queueParams(filters),
    signal,
  });
  return response.data;
};

export const getClientReviewItems = async (clientId, options = {}) => {
  const { signal, ...filters } = options;
  const response = await api.get(
    `/clients/${encodeURIComponent(clientId)}/review-items`,
    { params: queueParams(filters), signal }
  );
  return response.data;
};

export const getReviewItem = async (reviewItemId, { signal } = {}) => {
  const response = await api.get(`/review-items/${encodeURIComponent(reviewItemId)}`, {
    signal,
  });
  return response.data;
};

export const getReviewActions = async (
  reviewItemId,
  { cursor, limit = 20, signal } = {}
) => {
  const response = await api.get(
    `/review-items/${encodeURIComponent(reviewItemId)}/actions`,
    { params: compactParams({ cursor, limit }), signal }
  );
  return response.data;
};

export const getWorkspaceReviewSummary = async ({ cursor, signal } = {}) => {
  const response = await api.get("/review-items/summary", {
    params: compactParams({ cursor }),
    signal,
  });
  return response.data;
};

export const getClientReviewSummary = async (clientId, { cursor, signal } = {}) => {
  const response = await api.get(
    `/clients/${encodeURIComponent(clientId)}/review-summary`,
    { params: compactParams({ cursor }), signal }
  );
  return response.data;
};

export const getReviewFilterClients = async ({ signal } = {}) => {
  const response = await api.get("/clients", { signal });
  return Array.isArray(response.data?.clients) ? response.data.clients : [];
};

export const getIssueTimeline = async (
  issueId,
  { cursor, limit = 20, signal } = {}
) => {
  const response = await api.get(`/issues/${encodeURIComponent(issueId)}/timeline`, {
    params: compactParams({ cursor, limit }),
    signal,
  });
  return response.data;
};

const postReviewMutation = async (reviewItemId, operation, payload, signal) => {
  const response = await api.post(
    `/review-items/${encodeURIComponent(reviewItemId)}/${operation}`,
    payload,
    { signal }
  );
  return { ...response.data, httpStatus: response.status };
};

export const acknowledgeReviewItem = (reviewItemId, payload, { signal } = {}) =>
  postReviewMutation(reviewItemId, "acknowledge", payload, signal);

export const snoozeReviewItem = (reviewItemId, payload, { signal } = {}) =>
  postReviewMutation(reviewItemId, "snooze", payload, signal);

export const interpretReviewItem = (reviewItemId, payload, { signal } = {}) =>
  postReviewMutation(reviewItemId, "review", payload, signal);

export const createReviewIntervention = (reviewItemId, payload, { signal } = {}) =>
  postReviewMutation(reviewItemId, "interventions", payload, signal);
