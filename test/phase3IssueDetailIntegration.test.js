import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { configureStore } from "@reduxjs/toolkit";
import { JSDOM } from "jsdom";
import { createElement, Fragment } from "react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { createServer } from "vite";

let vite;
let api;
let originalGet;
let originalPost;
let render;
let cleanup;
let fireEvent;
let waitFor;
let act;
let IssueDetail;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
let consoleMessages = [];

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});

for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "Node",
  "Event",
  "KeyboardEvent",
  "MouseEvent",
  "MutationObserver",
  "getComputedStyle",
]) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: dom.window[key],
  });
}
globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const staleIssueError = () =>
  Object.assign(new Error("stale"), {
    response: {
      status: 409,
      data: { code: "INTERVENTION_ISSUE_STALE" },
    },
  });

const issueValue = (id, overrides = {}) => ({
  id,
  clientId: `client-${id.at(-1)}`,
  status: "open",
  severity: "critical",
  trend: "unchanged",
  title: `Issue ${id.at(-1).toUpperCase()}`,
  summary: `Retained summary for ${id}.`,
  archetype: "engagement_quality_drop",
  metricFamily: "engagement",
  occurrenceCount: 2,
  absenceStreak: 0,
  openedAt: "2026-07-17T08:00:00.000Z",
  lastSeenAt: "2026-07-17T09:00:00.000Z",
  reopenCount: 0,
  lifecycleRevision: 7,
  identity: {
    client: { value: `Client ${id.at(-1).toUpperCase()}`, provenance: "snapshot" },
    report: { value: "Daily monitor", provenance: "snapshot" },
    metaAccount: { value: "Ads account", provenance: "snapshot" },
    campaign: { value: "Prospecting", provenance: "snapshot" },
  },
  scope: {
    entity: { level: "campaign" },
    comparison: { cadence: "daily", timezone: "Asia/Kolkata" },
  },
  latestEvidence: {
    kind: "signal",
    observedAt: "2026-07-17T09:00:00.000Z",
    severity: "critical",
    title: "CTR declined",
    summary: "CTR declined in retained evidence.",
    primaryMetric: "ctr",
    delta: -12,
    provenance: "snapshot",
  },
  ...overrides,
});

const interventionValue = (overrides = {}) => ({
  id: "intervention-1",
  issueId: "issue-a",
  actionType: "monitor_only",
  actionPayload: {},
  reason: "Original retained action.",
  note: "",
  performedAt: "2026-07-17T09:15:00.000Z",
  recordedAt: "2026-07-17T09:20:00.000Z",
  performedBy: {
    displayName: "Asha",
    workspaceRole: "member",
    provenance: "workspace_member",
  },
  performedByUserId: "aaaaaaaaaaaaaaaaaaaaaaaa",
  recordedBy: {
    displayName: "Owner",
    workspaceRole: "owner",
    provenance: "workspace_member",
  },
  status: "active",
  revision: 2,
  permissions: { canCorrect: true, canCancel: true },
  issueSnapshot: { openedAt: "2026-07-17T08:00:00.000Z" },
  scopeSnapshot: {},
  latestSignalSnapshot: {},
  ...overrides,
});

function NavigationControl() {
  const navigate = useNavigate();
  return createElement(
    "button",
    { type: "button", onClick: () => navigate("/issues/issue-b") },
    "Go to Issue B"
  );
}

const createStore = () =>
  configureStore({
    reducer: {
      user: (state = { user: { id: "bbbbbbbbbbbbbbbbbbbbbbbb" } }) => state,
    },
  });

const renderIssueDetail = (initialEntry = "/issues/issue-a") =>
  render(
    createElement(
      Provider,
      { store: createStore() },
      createElement(
        MemoryRouter,
        { initialEntries: [initialEntry] },
        createElement(
          Routes,
          null,
          createElement(Route, {
            path: "/issues/:issueId",
            element: createElement(
              Fragment,
              null,
              createElement(NavigationControl),
              createElement(IssueDetail)
            ),
          })
        )
      )
    )
  );

const emptyPage = (key) => ({ data: { [key]: [], page: { hasMore: false, nextCursor: null } } });
const interventionPage = (items) => ({
  data: { interventions: items, page: { hasMore: false, nextCursor: null } },
});

const commonGet = (url) => {
  if (url.endsWith("/signals")) return emptyPage("signals");
  if (url.startsWith("/clients/")) return { data: { client: {} } };
  if (url === "/settings/team") return { data: { members: [] } };
  throw new Error(`Unexpected GET ${url}`);
};

const recordAction = async (view) => {
  const buttons = await view.findAllByRole("button", { name: "Record action" });
  fireEvent.click(buttons[0]);
  fireEvent.change(view.getByLabelText(/^Reason/), {
    target: { value: "Continue monitoring retained evidence." },
  });
  fireEvent.click(view.getByRole("button", { name: "Review action" }));
  const submitButtons = await view.findAllByRole("button", { name: "Record action" });
  fireEvent.click(submitButtons.at(-1));
};

before(async () => {
  ({ render, cleanup, fireEvent, waitFor, act } = await import("@testing-library/react"));
  vite = await createServer({
    root: new URL("..", import.meta.url).pathname,
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  ({ default: api } = await vite.ssrLoadModule("/src/api/axios.js"));
  ({ default: IssueDetail } = await vite.ssrLoadModule("/src/pages/IssueDetail.jsx"));
  originalGet = api.get;
  originalPost = api.post;
});

beforeEach(() => {
  consoleMessages = [];
  console.error = (...args) => consoleMessages.push(`[error] ${args.map(String).join(" ")}`);
  console.warn = (...args) => consoleMessages.push(`[warn] ${args.map(String).join(" ")}`);
});

afterEach(() => {
  cleanup();
  api.get = originalGet;
  api.post = originalPost;
  document.body.innerHTML = "";
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  assert.deepEqual(
    consoleMessages,
    [],
    `IssueDetail integration emitted console warnings:\n${consoleMessages.join("\n")}`
  );
});

after(async () => {
  await vite?.close();
  dom.window.close();
});

test("mounted IssueDetail preserves Issue and Intervention data across independent failed refreshes", async () => {
  const issueRefresh = deferred();
  const historyRefresh = deferred();
  let issueReads = 0;
  let historyReads = 0;
  let mutationCalls = 0;

  api.get = async (url) => {
    if (url === "/issues/issue-a") {
      issueReads += 1;
      if (issueReads === 1) return { data: { issue: issueValue("issue-a") } };
      if (issueReads === 2) return issueRefresh.promise;
      return { data: { issue: issueValue("issue-a", { title: "Issue A refreshed" }) } };
    }
    if (url === "/issues/issue-a/interventions") {
      historyReads += 1;
      if (historyReads === 1) return interventionPage([interventionValue()]);
      if (historyReads === 2) return historyRefresh.promise;
      return interventionPage([
        interventionValue({ reason: "Authoritative corrected action.", revision: 3 }),
        interventionValue({ reason: "Duplicate ignored.", revision: 3 }),
        interventionValue({ id: "intervention-2", reason: "New authoritative action." }),
      ]);
    }
    return commonGet(url);
  };
  api.post = async () => {
    mutationCalls += 1;
    return { data: { intervention: interventionValue({ id: "created-action" }) } };
  };

  const view = renderIssueDetail();
  await view.findByText("Original retained action.");
  await recordAction(view);
  await waitFor(() => {
    assert.equal(issueReads, 2);
    assert.equal(historyReads, 2);
  });
  assert.ok(view.getByText("Issue A"));
  assert.ok(view.getByText("Original retained action."));

  await act(async () => issueRefresh.reject(new Error("issue refresh offline")));
  await view.findByText("Issue details could not be refreshed. Existing details are still shown.");
  assert.ok(view.getByText("Issue A"));
  assert.ok(view.getByText("Original retained action."));

  await act(async () => historyRefresh.reject(new Error("history refresh offline")));
  await view.findByText("The action was saved, but the history could not be refreshed.");
  assert.ok(view.getByText("Original retained action."));

  fireEvent.click(view.getByRole("button", { name: "Retry Issue refresh" }));
  await view.findByText("Issue A refreshed");
  fireEvent.click(view.getByRole("button", { name: "Retry refresh" }));
  await view.findByText("Authoritative corrected action.");
  assert.equal(view.queryByText("Original retained action."), null);
  assert.equal(view.getAllByRole("button", { name: "View details" }).length, 2);
  assert.equal(mutationCalls, 1);
});

test("mounted IssueDetail fences post-mutation Issue A reads after navigation to Issue B", async () => {
  const issueARefresh = deferred();
  const historyARefresh = deferred();
  let issueAReads = 0;
  let historyAReads = 0;
  let mutationCalls = 0;

  api.get = async (url) => {
    if (url === "/issues/issue-a") {
      issueAReads += 1;
      return issueAReads === 1
        ? { data: { issue: issueValue("issue-a") } }
        : issueARefresh.promise;
    }
    if (url === "/issues/issue-a/interventions") {
      historyAReads += 1;
      return historyAReads === 1
        ? interventionPage([interventionValue()])
        : historyARefresh.promise;
    }
    if (url === "/issues/issue-b") {
      return { data: { issue: issueValue("issue-b") } };
    }
    if (url === "/issues/issue-b/interventions") {
      return interventionPage([
        interventionValue({ id: "issue-b-action", issueId: "issue-b", reason: "Issue B action." }),
      ]);
    }
    return commonGet(url);
  };
  api.post = async () => {
    mutationCalls += 1;
    return { data: { intervention: interventionValue({ id: "created-action" }) } };
  };

  const view = renderIssueDetail();
  await view.findByText("Original retained action.");
  await recordAction(view);
  await waitFor(() => assert.equal(issueAReads, 2));
  fireEvent.click(view.getByRole("button", { name: "Go to Issue B" }));
  await view.findByText("Issue B action.");

  await act(async () => {
    issueARefresh.resolve({ data: { issue: issueValue("issue-a", { title: "Late Issue A" }) } });
    historyARefresh.resolve(interventionPage([
      interventionValue({ reason: "Late Issue A action." }),
    ]));
  });
  assert.ok(view.getByText("Issue B"));
  assert.ok(view.getByText("Issue B action."));
  assert.equal(view.queryByText("Late Issue A"), null);
  assert.equal(view.queryByText("Late Issue A action."), null);
  assert.equal(view.queryByText("The action was saved, but the history could not be refreshed."), null);
  assert.equal(mutationCalls, 1);
});

test("mounted IssueDetail aborts creation stale authority continuation on unmount", async () => {
  const staleAuthority = deferred();
  let issueReads = 0;
  let historyReads = 0;
  let mutationCalls = 0;

  api.get = async (url) => {
    if (url === "/issues/issue-a") {
      issueReads += 1;
      return issueReads === 1
        ? { data: { issue: issueValue("issue-a") } }
        : staleAuthority.promise;
    }
    if (url === "/issues/issue-a/interventions") {
      historyReads += 1;
      return interventionPage([interventionValue()]);
    }
    return commonGet(url);
  };
  api.post = async () => {
    mutationCalls += 1;
    throw staleIssueError();
  };

  const view = renderIssueDetail();
  await view.findByText("Original retained action.");
  await recordAction(view);
  await waitFor(() => assert.equal(issueReads, 2));
  view.unmount();
  await act(async () => staleAuthority.resolve({
    data: { issue: issueValue("issue-a", { lifecycleRevision: 8 }) },
  }));
  await act(async () => Promise.resolve());
  assert.equal(mutationCalls, 1);
  assert.equal(issueReads, 2, "unmounted stale continuation must not reload the Issue");
  assert.equal(historyReads, 1, "unmounted stale continuation must not reload history");
});

test("mounted IssueDetail keeps the latest authority when Issue A and Issue B refreshes resolve out of order", async () => {
  const authorityA = deferred();
  const authorityB = deferred();
  const issueReads = { a: 0, b: 0 };
  const posts = [];

  api.get = async (url) => {
    if (url === "/issues/issue-a") {
      issueReads.a += 1;
      return issueReads.a === 1
        ? { data: { issue: issueValue("issue-a") } }
        : authorityA.promise;
    }
    if (url === "/issues/issue-b") {
      issueReads.b += 1;
      return issueReads.b === 1
        ? { data: { issue: issueValue("issue-b") } }
        : authorityB.promise;
    }
    if (url === "/issues/issue-a/interventions") {
      return interventionPage([interventionValue()]);
    }
    if (url === "/issues/issue-b/interventions") {
      return interventionPage([
        interventionValue({ id: "issue-b-action", issueId: "issue-b", reason: "Issue B action." }),
      ]);
    }
    return commonGet(url);
  };
  api.post = async (url, body) => {
    posts.push({ url, body });
    if (posts.length <= 2) throw staleIssueError();
    return { data: { intervention: interventionValue({ id: "issue-b-created", issueId: "issue-b" }) } };
  };

  const view = renderIssueDetail();
  await view.findByText("Original retained action.");
  await recordAction(view);
  await waitFor(() => assert.equal(issueReads.a, 2));

  fireEvent.click(view.getByRole("button", { name: "Go to Issue B" }));
  await view.findByText("Issue B action.");
  await recordAction(view);
  await waitFor(() => assert.equal(issueReads.b, 2));

  await act(async () => authorityB.resolve({
    data: { issue: issueValue("issue-b", { lifecycleRevision: 9 }) },
  }));
  const review = await view.findByRole("button", { name: "Review refreshed data" });
  await act(async () => authorityA.resolve({
    data: { issue: issueValue("issue-a", { lifecycleRevision: 8 }) },
  }));
  assert.ok(view.getByText("Issue B"));
  assert.ok(view.getByRole("button", { name: "Review refreshed data" }));

  fireEvent.click(review);
  const refreshedSubmitButtons = await view.findAllByRole("button", { name: "Record action" });
  fireEvent.click(refreshedSubmitButtons.at(-1));
  await waitFor(() => assert.equal(posts.length, 3));
  assert.equal(posts[2].body.expectedIssueRevision, 9);
});
