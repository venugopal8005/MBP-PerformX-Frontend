import { useCallback, useEffect, useReducer, useRef } from "react";

import {
  createCursorHistoryState,
  cursorHistoryReducer,
  visibleCursorHistoryState,
} from "../utils/historyState";

export default function useCursorHistory({ loadPage, resetKey, enabled = true }) {
  const normalizedResetKey = String(resetKey ?? "");
  const [state, dispatch] = useReducer(
    cursorHistoryReducer,
    normalizedResetKey,
    (key) => createCursorHistoryState(key, { enabled })
  );
  const cursorRef = useRef(null);
  const hasMoreRef = useRef(false);
  const generationRef = useRef(0);
  const ownerKeyRef = useRef(normalizedResetKey);
  const activeRequestRef = useRef(null);
  const loadPageRef = useRef(loadPage);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    loadPageRef.current = loadPage;
  }, [loadPage]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const execute = useCallback(async ({ append, generation, requestOwnerKey }) => {
    if (!enabledRef.current || activeRequestRef.current) return;
    if (append && !hasMoreRef.current) return;

    const controller = new AbortController();
    const request = { controller, generation };
    activeRequestRef.current = request;
    dispatch({ type: "request_started", ownerKey: requestOwnerKey, append });
    if (!append) {
      cursorRef.current = null;
      hasMoreRef.current = false;
    }

    try {
      const result = await loadPageRef.current({
        cursor: append ? cursorRef.current : null,
        signal: controller.signal,
      });
      if (
        controller.signal.aborted ||
        generation !== generationRef.current ||
        requestOwnerKey !== ownerKeyRef.current
      ) return;

      const nextItems = Array.isArray(result?.items) ? result.items : [];
      cursorRef.current = result?.page?.nextCursor || null;
      hasMoreRef.current = Boolean(result?.page?.hasMore);
      dispatch({
        type: "request_succeeded",
        ownerKey: requestOwnerKey,
        append,
        items: nextItems,
        page: result?.page,
      });
    } catch (requestError) {
      if (
        controller.signal.aborted ||
        generation !== generationRef.current ||
        requestOwnerKey !== ownerKeyRef.current
      ) return;
      dispatch({
        type: "request_failed",
        ownerKey: requestOwnerKey,
        error:
          requestError?.response?.data?.message ||
          requestError?.message ||
          "Could not load historical records.",
      });
    } finally {
      if (activeRequestRef.current === request) activeRequestRef.current = null;
      if (
        generation === generationRef.current &&
        requestOwnerKey === ownerKeyRef.current
      ) {
        dispatch({ type: "request_finished", ownerKey: requestOwnerKey });
      }
    }
  }, []);

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    ownerKeyRef.current = normalizedResetKey;
    enabledRef.current = enabled;
    activeRequestRef.current?.controller.abort();
    activeRequestRef.current = null;
    cursorRef.current = null;
    hasMoreRef.current = false;
    dispatch({ type: "reset", ownerKey: normalizedResetKey, enabled });

    queueMicrotask(() => {
      if (
        generation === generationRef.current &&
        normalizedResetKey === ownerKeyRef.current &&
        enabledRef.current
      ) {
        execute({ append: false, generation, requestOwnerKey: normalizedResetKey });
      }
    });

    return () => {
      generationRef.current += 1;
      activeRequestRef.current?.controller.abort();
      activeRequestRef.current = null;
    };
  }, [enabled, execute, normalizedResetKey]);

  const loadMore = useCallback(() => {
    execute({
      append: true,
      generation: generationRef.current,
      requestOwnerKey: ownerKeyRef.current,
    });
  }, [execute]);

  const reload = useCallback(() => {
    generationRef.current += 1;
    activeRequestRef.current?.controller.abort();
    activeRequestRef.current = null;
    execute({
      append: false,
      generation: generationRef.current,
      requestOwnerKey: ownerKeyRef.current,
    });
  }, [execute]);

  const visibleState = visibleCursorHistoryState(state, normalizedResetKey, { enabled });

  return {
    ...visibleState,
    isEmpty:
      !visibleState.isLoading && !visibleState.error && visibleState.items.length === 0,
    loadMore,
    reload,
  };
}
