import { mergeHistoryRecords } from "./history.js";

const ownerKey = (value) => String(value ?? "");

export const createCursorHistoryState = (key, { enabled = true } = {}) => ({
  ownerKey: ownerKey(key),
  items: [],
  error: "",
  hasMore: false,
  nextCursor: null,
  isLoading: Boolean(enabled),
  isLoadingMore: false,
  isRefreshing: false,
  failedAppend: false,
  failedRefresh: false,
});

export const cursorHistoryReducer = (state, action) => {
  const actionOwnerKey = ownerKey(action.ownerKey);

  if (action.type === "reset") {
    return createCursorHistoryState(actionOwnerKey, { enabled: action.enabled });
  }
  if (state.ownerKey !== actionOwnerKey) return state;

  if (action.type === "request_started") {
    return action.append
      ? {
          ...state,
          error: "",
          isLoadingMore: true,
          failedAppend: false,
          failedRefresh: false,
        }
      : action.preserveItems
        ? {
            ...state,
            error: "",
            isRefreshing: true,
            failedAppend: false,
            failedRefresh: false,
          }
      : {
          ...createCursorHistoryState(actionOwnerKey),
          isLoading: true,
        };
  }
  if (action.type === "request_succeeded") {
    return {
      ...state,
      items: mergeHistoryRecords(action.append ? state.items : [], action.items),
      error: "",
      hasMore: Boolean(action.page?.hasMore),
      nextCursor: action.page?.nextCursor || null,
      isLoading: false,
      isLoadingMore: false,
      isRefreshing: false,
      failedAppend: false,
      failedRefresh: false,
    };
  }
  if (action.type === "request_failed") {
    return {
      ...state,
      error: action.error || "Could not load historical records.",
      isLoading: false,
      isLoadingMore: false,
      isRefreshing: false,
      failedAppend: action.append === true,
      failedRefresh: action.preserveItems === true,
    };
  }
  if (action.type === "request_finished") {
    return {
      ...state,
      isLoading: false,
      isLoadingMore: false,
      isRefreshing: false,
    };
  }

  return state;
};

export const visibleCursorHistoryState = (state, key, { enabled = true } = {}) =>
  state.ownerKey === ownerKey(key)
    ? state
    : createCursorHistoryState(key, { enabled });

export const createRouteOwnedState = (key) => ({
  ownerKey: ownerKey(key),
  data: null,
  error: "",
  refreshError: "",
  isLoading: true,
  isRefreshing: false,
});

export const routeOwnedReducer = (state, action) => {
  const actionOwnerKey = ownerKey(action.ownerKey);

  if (action.type === "request_started") {
    const preserveData =
      action.preserveData === true &&
      state.ownerKey === actionOwnerKey &&
      state.data !== null;
    return preserveData
      ? {
          ...state,
          error: "",
          refreshError: "",
          isLoading: false,
          isRefreshing: true,
        }
      : createRouteOwnedState(actionOwnerKey);
  }
  if (state.ownerKey !== actionOwnerKey) return state;

  if (action.type === "request_succeeded") {
    return {
      ...state,
      data: action.data ?? null,
      error: "",
      refreshError: "",
      isLoading: false,
      isRefreshing: false,
    };
  }
  if (action.type === "request_failed") {
    const message = action.error || "Could not load history.";
    return action.preserveData === true && state.data !== null
      ? {
          ...state,
          error: "",
          refreshError: message,
          isLoading: false,
          isRefreshing: false,
        }
      : {
          ...state,
          data: null,
          error: message,
          refreshError: "",
          isLoading: false,
          isRefreshing: false,
        };
  }

  return state;
};

export const visibleRouteOwnedState = (state, key) =>
  state.ownerKey === ownerKey(key) ? state : createRouteOwnedState(key);
