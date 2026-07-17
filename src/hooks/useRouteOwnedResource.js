import { useCallback, useEffect, useReducer, useState } from "react";

import {
  createRouteOwnedState,
  routeOwnedReducer,
  visibleRouteOwnedState,
} from "../utils/historyState";

export default function useRouteOwnedResource({ ownerKey, loadResource, fallbackError }) {
  const normalizedOwnerKey = String(ownerKey ?? "");
  const [requestVersion, setRequestVersion] = useState(0);
  const [state, dispatch] = useReducer(
    routeOwnedReducer,
    normalizedOwnerKey,
    createRouteOwnedState
  );

  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: "request_started", ownerKey: normalizedOwnerKey });

    loadResource({ signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        dispatch({ type: "request_succeeded", ownerKey: normalizedOwnerKey, data });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        dispatch({
          type: "request_failed",
          ownerKey: normalizedOwnerKey,
          error: error?.response?.data?.message || error?.message || fallbackError,
        });
      });

    return () => controller.abort();
  }, [fallbackError, loadResource, normalizedOwnerKey, requestVersion]);

  const reload = useCallback(() => setRequestVersion((version) => version + 1), []);

  return {
    ...visibleRouteOwnedState(state, normalizedOwnerKey),
    reload,
  };
}
