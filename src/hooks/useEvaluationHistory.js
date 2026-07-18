import { useCallback } from "react";

import { getInterventionEvaluations } from "../api/evaluations";
import { normalizeEvaluationListItem, evaluationRequestError } from "../utils/evaluations";
import useCursorHistory from "./useCursorHistory";

export default function useEvaluationHistory(interventionId, { enabled = true } = {}) {
  const loadPage = useCallback(async ({ cursor, signal }) => {
    try {
      const response = await getInterventionEvaluations(interventionId, { cursor, signal });
      return {
        items: response.items.map(normalizeEvaluationListItem).sort((left, right) => right.sequence - left.sequence),
        page: response.page,
      };
    } catch (error) {
      const controlled = evaluationRequestError(error, "Could not load persisted evaluation history.");
      if (controlled.aborted) throw error;
      throw new Error(controlled.message, { cause: error });
    }
  }, [interventionId]);

  return useCursorHistory({
    loadPage,
    resetKey: `intervention-evaluations:${interventionId}`,
    enabled: Boolean(enabled && interventionId),
  });
}
