import api from "./axios";

const pageParams = ({ cursor, limit = 20 } = {}) => ({
  limit,
  ...(cursor ? { cursor } : {}),
});

export const getInterventionEvaluations = async (
  interventionId,
  { cursor, limit = 20, signal } = {}
) => {
  const response = await api.get(
    `/interventions/${encodeURIComponent(interventionId)}/evaluations`,
    { params: pageParams({ cursor, limit }), signal }
  );
  return {
    items: Array.isArray(response.data?.evaluations) ? response.data.evaluations : [],
    page: response.data?.page || { nextCursor: null, hasMore: false, limit },
  };
};

export const getEvaluation = async (evaluationId, { signal } = {}) => {
  const response = await api.get(
    `/evaluations/${encodeURIComponent(evaluationId)}`,
    { signal }
  );
  return response.data;
};

export const refreshInterventionEvaluation = async (
  interventionId,
  { expectedInterventionRevision, idempotencyKey },
  { signal } = {}
) => {
  const response = await api.post(
    `/interventions/${encodeURIComponent(interventionId)}/evaluations/refresh`,
    { expectedInterventionRevision, idempotencyKey },
    { signal }
  );
  return { ...response.data, httpStatus: response.status };
};
