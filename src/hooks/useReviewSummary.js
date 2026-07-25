import { useCallback, useEffect, useRef, useState } from "react";

import { getClientReviewSummary, getWorkspaceReviewSummary } from "../api/reviews";
import { normalizeReviewSummary, reviewError } from "../utils/reviews";

export const REVIEW_SUMMARY_REFRESH_EVENT = "narrative:review-summary-refresh";

export const requestReviewSummaryRefresh = () => {
  globalThis.window?.dispatchEvent?.(new Event(REVIEW_SUMMARY_REFRESH_EVENT));
};

export default function useReviewSummary({ clientId = null } = {}) {
  const ownerKey = clientId || "workspace";
  const [state, setState] = useState({ ownerKey: null, summary: null, loading: true, error: null });
  const [version, setVersion] = useState(0);
  const generationRef = useRef(0);

  const retry = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: null }));
    setVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    const onRefresh = retry;
    globalThis.window?.addEventListener?.(REVIEW_SUMMARY_REFRESH_EVENT, onRefresh);
    return () => globalThis.window?.removeEventListener?.(REVIEW_SUMMARY_REFRESH_EVENT, onRefresh);
  }, [retry]);

  useEffect(() => {
    const controller = new AbortController();
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const load = clientId
      ? getClientReviewSummary(clientId, { signal: controller.signal })
      : getWorkspaceReviewSummary({ signal: controller.signal });
    load.then((response) => {
      if (controller.signal.aborted || generation !== generationRef.current) return;
      setState({ ownerKey, summary: normalizeReviewSummary(response.summary), loading: false, error: null });
    }).catch((error) => {
      if (controller.signal.aborted || generation !== generationRef.current) return;
      setState({ ownerKey, summary: null, loading: false, error: reviewError(error) });
    });
    return () => controller.abort();
  }, [clientId, ownerKey, version]);

  return state.ownerKey === ownerKey
    ? { ...state, retry }
    : { ownerKey, summary: null, loading: true, error: null, retry };
}
