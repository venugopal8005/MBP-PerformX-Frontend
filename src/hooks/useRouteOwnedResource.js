import { useCallback, useEffect, useReducer, useState } from "react";

import {
  createRouteOwnedState,
  routeOwnedReducer,
  visibleRouteOwnedState,
} from "../utils/historyState";

export default function useRouteOwnedResource({
  ownerKey,
  loadResource,
  fallbackError,
  preserveDataOnReload = false,
}) {
  const normalizedOwnerKey = String(ownerKey ?? "");
  const [requestVersion, setRequestVersion] = useState(0);
  const [state, dispatch] = useReducer(
    routeOwnedReducer,
    normalizedOwnerKey,
    createRouteOwnedState
  );

  useEffect(() => {
    const controller = new AbortController();
    dispatch({
      type: "request_started",
      ownerKey: normalizedOwnerKey,
      preserveData: preserveDataOnReload,
    });

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
          preserveData: preserveDataOnReload,
          error: error?.response?.data?.message || error?.message || fallbackError,
        });
      });

    return () => controller.abort();
  }, [fallbackError, loadResource, normalizedOwnerKey, preserveDataOnReload, requestVersion]);

  const reload = useCallback(() => setRequestVersion((version) => version + 1), []);

  return {
    ...visibleRouteOwnedState(state, normalizedOwnerKey),
    reload,
  };
}
