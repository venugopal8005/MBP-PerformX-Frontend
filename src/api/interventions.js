import api from "./axios";

const interventionPage = (response) => ({
  items: Array.isArray(response.data?.interventions) ? response.data.interventions : [],
  page: response.data?.page || { nextCursor: null, hasMore: false },
});

const withCursor = ({ cursor, limit = 20 } = {}) => ({
  limit,
  ...(cursor ? { cursor } : {}),
});

const postWithSignal = (url, payload, signal) =>
  signal ? api.post(url, payload, { signal }) : api.post(url, payload);

export const createIntervention = async (issueId, payload, { signal } = {}) => {
  const response = await postWithSignal(
    `/issues/${encodeURIComponent(issueId)}/interventions`,
    payload,
    signal
  );
  return response.data;
};

export const getIssueInterventions = async (
  issueId,
  { cursor, limit = 20, signal } = {}
) => {
  const response = await api.get(
    `/issues/${encodeURIComponent(issueId)}/interventions`,
    { params: withCursor({ cursor, limit }), signal }
  );
  return interventionPage(response);
};

export const getIntervention = async (interventionId, { signal } = {}) => {
  const response = await api.get(
    `/interventions/${encodeURIComponent(interventionId)}`,
    { signal }
  );
  return response.data;
};

export const cancelIntervention = async (interventionId, payload, { signal } = {}) => {
  const response = await postWithSignal(
    `/interventions/${encodeURIComponent(interventionId)}/cancel`,
    payload,
    signal
  );
  return response.data;
};

export const correctIntervention = async (interventionId, payload, { signal } = {}) => {
  const response = await postWithSignal(
    `/interventions/${encodeURIComponent(interventionId)}/corrections`,
    payload,
    signal
  );
  return response.data;
};

export const getInterventionWorkspaceMembers = async ({ signal } = {}) => {
  const response = await api.get("/settings/team", { signal });
  return (response.data?.members || [])
    .filter(
      (member) =>
        typeof member?.user_id === "string" &&
        /^[a-f\d]{24}$/i.test(member.user_id) &&
        member?.status === "active"
    )
    .map((member) => ({
      id: member.user_id,
      userId: member.user_id,
      membershipId:
        typeof member.id === "string" && member.id.trim() ? member.id : null,
      name: typeof member.name === "string" ? member.name.trim().slice(0, 256) : "",
      role: typeof member.role === "string" ? member.role.trim().slice(0, 32) : "",
    }));
};

export const getIssueClientWriteAccess = async (clientId, { signal } = {}) => {
  try {
    await api.get(`/clients/${encodeURIComponent(clientId)}`, { signal });
    return { canWrite: true, isArchived: false };
  } catch (error) {
    if (error?.response?.data?.code === "CLIENT_ARCHIVED") {
      return { canWrite: false, isArchived: true };
    }
    throw error;
  }
};
