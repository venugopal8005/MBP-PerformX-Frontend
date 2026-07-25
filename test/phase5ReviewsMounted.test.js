import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { JSDOM } from "jsdom";
import { createElement, Fragment } from "react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { configureStore } from "@reduxjs/toolkit";
import { createServer } from "vite";

let vite;
let api;
let Reviews;
let ReviewDetail;
let ReviewSummaryBadge;
let ReviewSummaryHarness;
let ReviewMutationDialog;
let ReviewInterventionModal;
let IssueTimeline;
let ClientReviewSummary;
let ClientDetail;
let IssueDetail;
let render;
let cleanup;
let fireEvent;
let waitFor;
let act;
let within;
let originalGet;
let originalPost;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
let consoleMessages = [];

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/reviews" });
for (const key of ["window", "document", "navigator", "HTMLElement", "Node", "Event", "KeyboardEvent", "MouseEvent", "MutationObserver", "getComputedStyle"]) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
globalThis.cancelAnimationFrame = clearTimeout;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ids = { review: "111111111111111111111111", reviewB: "777777777777777777777777", client: "222222222222222222222222", clientB: "888888888888888888888888", account: "333333333333333333333333", issue: "444444444444444444444444", issueB: "999999999999999999999999", action: "555555555555555555555555", signal: "666666666666666666666666" };
const identity = (id, name) => ({ id, name, provenance: "snapshot" });
const listItem = (overrides = {}) => ({ id: ids.review, type: "issue_review", state: "open", priority: "critical", reason: "issue_created", generation: 1, client: identity(ids.client, "Acme"), account: { ...identity(ids.account, "Ads"), externalId: "act_1" }, campaign: { id: "campaign-1", name: "Prospecting", provenance: "snapshot" }, issue: { id: ids.issue, title: "CTR movement", provenance: "snapshot" }, source: { title: "CTR needs review", summary: "Observed CTR movement in persisted evidence.", provenance: "snapshot" }, openedAt: "2026-07-18T10:00:00.000Z", latestEvidenceAt: "2026-07-19T10:00:00.000Z", acknowledgement: null, snooze: null, review: null, permissions: { canAcknowledge: true, canSnooze: true, canReview: false, canRecordIntervention: true }, routes: { issueId: ids.issue, reportId: null, reportRunId: null, interventionId: null, evaluationId: null, previousReviewItemId: null }, ...overrides });
const action = { id: ids.action, reviewItemId: ids.review, sequence: 1, actionType: "opened_from_issue", actorType: "system", decisionType: null, actor: null, priorState: "open", resultingState: "open", note: null, signalId: ids.signal, interventionId: null, evaluationId: null, occurredAt: "2026-07-18T10:00:00.000Z", recordedAt: "2026-07-18T10:00:01.000Z" };
const detailItem = (overrides = {}) => ({ ...listItem(), persistedState: "open", effectiveState: "open", effectiveCloseReason: null, isSourceCurrent: true, sourceRevisionSynchronized: true, revision: 2, context: { version: 1, capturedAt: "2026-07-18T10:00:00.000Z", client: identity(ids.client, "Acme"), account: { ...identity(ids.account, "Ads"), externalId: "act_1" }, campaign: { id: "campaign-1", name: "Prospecting", provenance: "snapshot" }, issue: { id: ids.issue, title: "CTR movement", provenance: "snapshot" }, report: null, sourceTitle: "CTR needs review", sourceSummary: "Observed CTR movement.", provenance: "snapshot" }, linkedIntervention: null, linkedEvaluation: null, actions: [action], ...overrides });
const detailFor = (id, title, issueId, clientId = ids.client) => detailItem({
  id,
  client: identity(clientId, clientId === ids.client ? "Acme" : "Beta"),
  issue: { id: issueId, title, provenance: "snapshot" },
  source: { title, summary: `Persisted context for ${title}.`, provenance: "snapshot" },
  context: {
    ...detailItem().context,
    client: identity(clientId, clientId === ids.client ? "Acme" : "Beta"),
    issue: { id: issueId, title, provenance: "snapshot" },
    sourceTitle: title,
    sourceSummary: `Persisted context for ${title}.`,
  },
  routes: { ...detailItem().routes, issueId },
});
const counts = (actionable = 0) => ({ active: actionable, actionable, snoozed: 0, critical: actionable, high: 0, normal: 0, issueReview: actionable, evaluationReview: 0 });
const timelineResponse = { success: true, timeline: [{ id: "signals:one", stream: "signals", kind: "signal_detected", sourceId: ids.signal, occurredAt: "2026-07-19T10:00:00.000Z", rank: 10, title: "Signal detected", description: "Observed movement." }, { id: "review:one", stream: "review_actions", kind: "acknowledged", sourceId: ids.action, occurredAt: "2026-07-19T09:00:00.000Z", rank: 40, title: "acknowledged", description: null, actor: { displayName: "Asha", workspaceRole: "member", email: "private@example.com" } }], page: { limit: 20, snapshotAt: "2026-07-19T10:01:00.000Z", nextCursor: null } };
const store = configureStore({ reducer: { user: () => ({ user: { id: "aaaaaaaaaaaaaaaaaaaaaaaa" } }) } });
const wrap = (child, entry = "/reviews", path = "*") => createElement(Provider, { store }, createElement(MemoryRouter, { initialEntries: [entry] }, createElement(Routes, null, createElement(Route, { path, element: child }))));
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

const emptyPage = { limit: 20, nextCursor: null, hasMore: false };
const reviewReads = ({ detailById = {}, actionById = {}, timelineByIssue = {}, onGet = null } = {}) => async (url, options = {}) => {
  onGet?.(url, options);
  if (url === "/settings/team") return { data: { members: [] } };
  const detailMatch = url.match(/^\/review-items\/([^/]+)$/);
  if (detailMatch) return { data: { reviewItem: detailById[detailMatch[1]] || detailFor(detailMatch[1], "Review item", ids.issue) } };
  const actionMatch = url.match(/^\/review-items\/([^/]+)\/actions$/);
  if (actionMatch) return { data: actionById[actionMatch[1]] || { actions: [], page: emptyPage } };
  const timelineMatch = url.match(/^\/issues\/([^/]+)\/timeline$/);
  if (timelineMatch) return { data: timelineByIssue[timelineMatch[1]] || { timeline: [], page: { ...emptyPage, snapshotAt: "2026-07-19T10:00:00.000Z" } } };
  throw new Error(url);
};

function ReviewRouteHarness() {
  const navigate = useNavigate();
  return createElement(Fragment, null,
    createElement("button", { type: "button", onClick: () => navigate(`/reviews/${ids.reviewB}`) }, "Open Review B"),
    createElement(ReviewDetail)
  );
}

const reviewRoute = () => wrap(createElement(ReviewRouteHarness), `/reviews/${ids.review}`, "/reviews/:reviewItemId");

function IssueRouteHarness() {
  const navigate = useNavigate();
  return createElement(Fragment, null,
    createElement("button", { type: "button", onClick: () => navigate(`/issues/${ids.issueB}`) }, "Open Issue B"),
    createElement(IssueDetail)
  );
}

function ClientRouteHarness() {
  const navigate = useNavigate();
  return createElement(Fragment, null,
    createElement("button", { type: "button", onClick: () => navigate(`/clients/${ids.clientB}`) }, "Open Client B"),
    createElement(ClientDetail)
  );
}

const clientRoute = () => wrap(createElement(ClientRouteHarness), `/clients/${ids.client}`, "/clients/:clientId");

const clientValue = (id, name, { archived = false } = {}) => ({
  _id: id,
  name,
  status: archived ? "archived" : "stable",
  notes: `Retained historical context for ${name}.`,
  meta_ad_account: null,
});

const clientDetailReads = ({ clients = {}, summaries = {}, onGet = null } = {}) => async (url, options = {}) => {
  onGet?.(url, options);
  const summaryMatch = url.match(/^\/clients\/([^/]+)\/review-summary$/);
  if (summaryMatch) {
    const value = summaries[summaryMatch[1]];
    if (typeof value === "function") return value(url, options);
    return { data: value || summaryPayload() };
  }
  const clientMatch = url.match(/^\/clients\/([^/]+)$/);
  if (clientMatch) {
    const id = clientMatch[1];
    return {
      data: {
        client: clients[id] || clientValue(id, id === ids.clientB ? "Beta" : "Acme"),
      },
    };
  }
  if (url === "/reports/get-reports") return { data: [] };
  if (url === "/signals") return { data: { signals: [] } };
  if (url === "/meta/status") return { data: { connected: false } };
  if (url === "/issues") return { data: { issues: [], page: emptyPage } };
  throw new Error(url);
};

const issueValue = (id, title, clientId) => ({
  id,
  clientId,
  status: "open",
  severity: "critical",
  trend: "unchanged",
  title,
  summary: `Persisted summary for ${title}.`,
  archetype: "engagement_quality_drop",
  metricFamily: "engagement",
  occurrenceCount: 2,
  absenceStreak: 0,
  openedAt: "2026-07-17T08:00:00.000Z",
  lastSeenAt: "2026-07-17T09:00:00.000Z",
  reopenCount: 0,
  lifecycleRevision: 7,
  identity: {
    client: { value: title === "Issue A" ? "Acme" : "Beta", provenance: "snapshot" },
    report: { value: "Daily monitor", provenance: "snapshot" },
    metaAccount: { value: "Ads account", provenance: "snapshot" },
    campaign: { value: "Prospecting", provenance: "snapshot" },
  },
  scope: { entity: { level: "campaign" }, comparison: { cadence: "daily", timezone: "Asia/Kolkata" } },
  latestEvidence: {
    kind: "signal",
    observedAt: "2026-07-17T09:00:00.000Z",
    severity: "critical",
    title: "CTR movement",
    summary: "Observed movement in persisted evidence.",
    primaryMetric: "ctr",
    delta: -12,
    provenance: "snapshot",
  },
});

const summaryPayload = ({ actionable = 0, completeness = "complete", archived = false } = {}) => ({
  success: true,
  summary: {
    asOf: "2026-07-19T10:00:00.000Z",
    archived,
    completeness,
    counts: completeness === "complete" ? counts(actionable) : null,
    observedCounts: counts(actionable),
    scannedCandidates: actionable,
    nextCursor: completeness === "partial" ? "opaque-summary" : null,
  },
});

before(async () => {
  ({ render, cleanup, fireEvent, waitFor, act, within } = await import("@testing-library/react"));
  vite = await createServer({ root: new URL("..", import.meta.url).pathname, appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
  ({ default: api } = await vite.ssrLoadModule("/src/api/axios.js"));
  ({ default: Reviews } = await vite.ssrLoadModule("/src/pages/Reviews.jsx"));
  ({ default: ReviewDetail } = await vite.ssrLoadModule("/src/pages/ReviewDetail.jsx"));
  ({ default: ReviewSummaryBadge } = await vite.ssrLoadModule("/src/components/reviews/ReviewSummaryBadge.jsx"));
  ({ default: ReviewMutationDialog } = await vite.ssrLoadModule("/src/components/reviews/ReviewMutationDialog.jsx"));
  ({ default: ReviewInterventionModal } = await vite.ssrLoadModule("/src/components/reviews/ReviewInterventionModal.jsx"));
  ({ default: IssueTimeline } = await vite.ssrLoadModule("/src/components/reviews/IssueTimeline.jsx"));
  ({ default: ClientReviewSummary } = await vite.ssrLoadModule("/src/components/reviews/ClientReviewSummary.jsx"));
  ({ default: ClientDetail } = await vite.ssrLoadModule("/src/pages/ClientDetail.jsx"));
  ({ default: IssueDetail } = await vite.ssrLoadModule("/src/pages/IssueDetail.jsx"));
  const { default: useReviewSummary } = await vite.ssrLoadModule("/src/hooks/useReviewSummary.js");
  ReviewSummaryHarness = () => { const state = useReviewSummary(); return createElement("nav", null, createElement("span", null, "Review"), createElement(ReviewSummaryBadge, { summary: state.summary })); };
  originalGet = api.get;
  originalPost = api.post;
});
beforeEach(() => { consoleMessages = []; console.error = (...args) => consoleMessages.push(`[error] ${args.join(" ")}`); console.warn = (...args) => consoleMessages.push(`[warn] ${args.join(" ")}`); });
afterEach(() => { cleanup(); api.get = originalGet; api.post = originalPost; document.body.innerHTML = ""; console.error = originalConsoleError; console.warn = originalConsoleWarn; assert.deepEqual(consoleMessages, []); });
after(async () => { await vite?.close(); dom.window.close(); });

test("queue renders semantic desktop and mobile views in backend order without per-row requests", async () => {
  const calls = [];
  api.get = async (url) => { calls.push(url); if (url === "/clients") return { data: { clients: [{ _id: ids.client, name: "Acme" }] } }; if (url === "/review-items") return { data: { success: true, reviewItems: [listItem(), listItem({ id: "777777777777777777777777", priority: "high", reason: "issue_new_evidence", source: { title: "Second", summary: "Observed second item.", provenance: "snapshot" } })], page: { limit: 25, returned: 2, scanned: 2, nextCursor: null } } }; throw new Error(url); };
  const view = render(wrap(createElement(Reviews)));
  assert.ok(await view.findByRole("table"));
  assert.ok(view.getByText("Workspace Review queue in backend priority order"));
  assert.equal(view.getAllByText("Acme").length >= 2, true);
  assert.equal(view.getAllByText("New Issue")[0].compareDocumentPosition(view.getAllByText("New evidence")[0]) & Node.DOCUMENT_POSITION_FOLLOWING, Node.DOCUMENT_POSITION_FOLLOWING);
  assert.ok(view.getByLabelText("Review queue mobile list"));
  assert.deepEqual(calls.filter((url) => url.startsWith("/review-items/")), []);
  assert.equal(calls.filter((url) => url === "/clients").length, 1);
});

test("queue filter is URL-owned and resets the cursor owner", async () => {
  const requests = [];
  api.get = async (url, options) => { if (url === "/clients") return { data: { clients: [] } }; requests.push(options.params); return { data: { reviewItems: [], page: { limit: 25, returned: 0, scanned: 0, nextCursor: null } } }; };
  const view = render(wrap(createElement(Reviews)));
  await view.findByText("Review queue is clear");
  fireEvent.change(view.getByLabelText("Review priority"), { target: { value: "high" } });
  await waitFor(() => assert.equal(requests.at(-1).priority, "high"));
  assert.equal(requests.at(-1).cursor, undefined);
  assert.equal(view.getByLabelText("Review priority").value, "high");
});

test("queue cursor append preserves retained rows when the next page fails", async () => {
  let pages = 0;
  api.get = async (url, options) => {
    if (url === "/clients") return { data: { clients: [] } };
    pages += 1;
    if (pages === 1) return { data: { reviewItems: [listItem()], page: { limit: 25, returned: 1, scanned: 1, nextCursor: "opaque-next" } } };
    assert.equal(options.params.cursor, "opaque-next");
    throw new Error("offline");
  };
  const view = render(wrap(createElement(Reviews)));
  assert.ok((await view.findAllByText(/CTR needs review/)).length >= 1);
  fireEvent.click(view.getByRole("button", { name: "Load more" }));
  assert.ok(await view.findByText(/Existing items are still shown/));
  assert.ok(view.getAllByText(/CTR needs review/).length >= 1);
  assert.equal(pages, 2);
});

test("Sidebar summary badge handles complete, 99+, partial, zero, and 503 safely", async () => {
  const complete = render(createElement(ReviewSummaryBadge, { summary: { completeness: "complete", counts: counts(120), observedCounts: counts(120) } }));
  assert.ok(complete.getByText("99+"));
  cleanup();
  const partial = render(createElement(ReviewSummaryBadge, { summary: { completeness: "partial", counts: null, observedCounts: counts(3) } }));
  assert.ok(partial.getByLabelText(/total is still being calculated/));
  cleanup();
  assert.equal(render(createElement(ReviewSummaryBadge, { summary: { completeness: "complete", counts: counts(0), observedCounts: counts(0) } })).container.textContent, "");
  cleanup();
  let calls = 0;
  api.get = async () => { calls += 1; const error = new Error("unavailable"); error.response = { status: 503, data: { code: "REVIEW_INDEXES_NOT_READY" } }; throw error; };
  const unavailable = render(createElement(ReviewSummaryHarness));
  await waitFor(() => assert.equal(calls, 1));
  assert.ok(unavailable.getByText("Review"));
  assert.equal(unavailable.queryByLabelText(/actionable/), null);
});

test("workspace summary ignores an older response after a refresh takes ownership", async () => {
  const first = deferred();
  let calls = 0;
  const summary = (actionable) => ({
    summary: {
      asOf: "2026-07-19T10:00:00.000Z",
      archived: false,
      completeness: "complete",
      counts: counts(actionable),
      observedCounts: counts(actionable),
      scannedCandidates: actionable,
      nextCursor: null,
    },
  });
  api.get = async () => {
    calls += 1;
    return calls === 1 ? first.promise : { data: summary(2) };
  };
  const view = render(createElement(ReviewSummaryHarness));
  await waitFor(() => assert.equal(calls, 1));
  fireEvent(window, new Event("narrative:review-summary-refresh"));
  assert.ok(await view.findByText("2"));
  first.resolve({ data: summary(9) });
  await waitFor(() => assert.equal(view.queryByText("9"), null));
  assert.ok(view.getByText("2"));
});

test("detail renders bounded context, immutable history, source state, links, and no private fields", async () => {
  api.get = async (url) => {
    if (url === `/review-items/${ids.review}`) return { data: { reviewItem: detailItem() } };
    if (url === "/settings/team") return { data: { members: [] } };
    if (url.endsWith("/actions")) return { data: { actions: [action], page: { limit: 20, nextCursor: null } } };
    if (url.endsWith("/timeline")) return { data: timelineResponse };
    throw new Error(url);
  };
  const view = render(wrap(createElement(ReviewDetail), `/reviews/${ids.review}`, "/reviews/:reviewItemId"));
  assert.ok(await view.findByRole("heading", { level: 1, name: "CTR needs review" }));
  assert.ok(view.getByText("Current and synchronized"));
  assert.ok(view.getByRole("link", { name: "Open Issue" }));
  assert.ok(await view.findByText("Review opened from Issue"));
  assert.equal(view.queryByText("private@example.com"), null);
  assert.equal(view.container.textContent.includes("review_origin"), false);
});

test("acknowledge retries with one stable key and bounds duplicate clicks", async () => {
  const payloads = [];
  api.get = async (url) => {
    if (url === `/review-items/${ids.review}`) return { data: { reviewItem: detailItem() } };
    if (url === "/settings/team") return { data: { members: [] } };
    if (url.endsWith("/actions")) return { data: { actions: [action], page: { limit: 20, nextCursor: null } } };
    if (url.endsWith("/timeline")) return { data: timelineResponse };
    throw new Error(url);
  };
  const retry = deferred();
  api.post = async (_url, payload) => {
    payloads.push(payload);
    if (payloads.length === 1) throw new Error("offline");
    return retry.promise;
  };
  const view = render(wrap(createElement(ReviewDetail), `/reviews/${ids.review}`, "/reviews/:reviewItemId"));
  fireEvent.click(await view.findByRole("button", { name: "Acknowledge" }));
  assert.ok(await view.findByText(/Network error/));
  const retryButton = view.getByRole("button", { name: "Retry acknowledge" });
  fireEvent.click(retryButton);
  fireEvent.click(retryButton);
  await waitFor(() => assert.equal(payloads.length, 2));
  assert.equal(payloads[0].idempotencyKey, payloads[1].idempotencyKey);
  assert.equal(payloads[1].expectedRevision, 2);
  retry.resolve({ status: 201, data: { reviewItem: detailItem({ state: "acknowledged", persistedState: "acknowledged", effectiveState: "acknowledged", revision: 3, permissions: { canAcknowledge: false, canSnooze: true, canReview: false, canRecordIntervention: true }, acknowledgement: { at: "2026-07-19T10:00:00.000Z", by: { displayName: "Asha", workspaceRole: "member", provenance: "snapshot", capturedAt: "2026-07-19T10:00:00.000Z" } } }), idempotentReplay: false } });
  assert.ok(await view.findByText("Review acknowledged."));
});

test("stale and archived detail authority is readable without mutation controls", async () => {
  const readonly = detailItem({ state: "closed", persistedState: "open", effectiveState: "closed", effectiveCloseReason: "client_archived", isSourceCurrent: false, sourceRevisionSynchronized: false, permissions: { canAcknowledge: true, canSnooze: true, canReview: true, canRecordIntervention: true } });
  api.get = async (url) => { if (url.includes("/review-items/") && !url.endsWith("/actions")) return { data: { reviewItem: readonly } }; if (url === "/settings/team") return { data: { members: [] } }; if (url.endsWith("/actions")) return { data: { actions: [], page: { limit: 20, nextCursor: null } } }; if (url.endsWith("/timeline")) return { data: timelineResponse }; throw new Error(url); };
  const view = render(wrap(createElement(ReviewDetail), `/reviews/${ids.review}`, "/reviews/:reviewItemId"));
  assert.ok(await view.findByText(/Client is archived/));
  assert.equal(view.queryByRole("button", { name: "Acknowledge" }), null);
  assert.equal(view.queryByRole("button", { name: "Snooze" }), null);
  assert.equal(view.queryByRole("button", { name: "Record action" }), null);
});

test("snooze dialog has accessible focus ownership and sends exact bounded body", async () => {
  let post;
  api.post = async (...args) => { post = args; return { status: 201, data: { reviewItem: detailItem({ state: "snoozed", persistedState: "snoozed", effectiveState: "snoozed", revision: 3, permissions: { canAcknowledge: false, canSnooze: true, canReview: false, canRecordIntervention: true }, snooze: { at: "2026-07-19T10:00:00.000Z", until: "2026-07-20T10:00:00.000Z", note: "Later", by: { displayName: "Asha", workspaceRole: "member", provenance: "snapshot", capturedAt: "2026-07-19T10:00:00.000Z" } } }) } }; };
  const opener = document.createElement("button"); opener.textContent = "Open"; document.body.append(opener); opener.focus();
  let closed = 0;
  const view = render(createElement(ReviewMutationDialog, { mode: "snooze", reviewItem: detailItem(), onClose: () => { closed += 1; }, onSuccess() {} }));
  const until = view.getByLabelText("Snoozed until");
  assert.equal(document.activeElement, until);
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000); const local = new Date(future.getTime() - future.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  fireEvent.change(until, { target: { value: local } });
  fireEvent.change(view.getByLabelText("Note (optional)"), { target: { value: "Later" } });
  fireEvent.click(view.getByRole("button", { name: "Snooze" }));
  await waitFor(() => assert.ok(post));
  assert.equal(post[0], `/review-items/${ids.review}/snooze`);
  assert.equal(post[1].expectedRevision, 2);
  assert.equal(post[1].note, "Later");
  assert.match(post[1].idempotencyKey, /^review-snooze:/);
  await waitFor(() => assert.equal(view.getByRole("button", { name: "Snooze" }).disabled, false));
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => assert.equal(closed, 1));
});

test("interpretation dialog validates required note and sends observational decision", async () => {
  let post;
  api.post = async (...args) => { post = args; return { status: 201, data: { reviewItem: detailItem({ type: "evaluation_review", state: "reviewed", persistedState: "reviewed", effectiveState: "reviewed", revision: 3, permissions: { canAcknowledge: false, canSnooze: false, canReview: false, canRecordIntervention: false }, review: { at: "2026-07-19T10:00:00.000Z", by: { displayName: "Asha", workspaceRole: "member", provenance: "snapshot", capturedAt: "2026-07-19T10:00:00.000Z" } } }) } }; };
  const item = detailItem({ type: "evaluation_review", permissions: { canAcknowledge: false, canSnooze: true, canReview: true, canRecordIntervention: true } });
  const view = render(createElement(ReviewMutationDialog, { mode: "interpret", reviewItem: item, onClose() {}, onSuccess() {} }));
  fireEvent.click(view.getByRole("button", { name: "Record interpretation" }));
  assert.ok(view.getByRole("alert"));
  const field = view.getByLabelText("Interpretation");
  assert.equal(field.getAttribute("aria-invalid"), "true");
  fireEvent.change(field, { target: { value: "Mixed movement observed across the persisted windows." } });
  fireEvent.click(view.getByRole("button", { name: "Record interpretation" }));
  await waitFor(() => assert.ok(post));
  assert.equal(post[0], `/review-items/${ids.review}/review`);
  assert.equal(post[1].decision, "interpretation_recorded");
});

test("pending Review dialog blocks Escape and duplicate submission", async () => {
  const request = deferred();
  let posts = 0;
  api.post = async () => { posts += 1; return request.promise; };
  let closes = 0;
  const item = detailItem({ type: "evaluation_review", permissions: { canAcknowledge: false, canSnooze: true, canReview: true, canRecordIntervention: true } });
  const view = render(createElement(ReviewMutationDialog, { mode: "interpret", reviewItem: item, onClose: () => { closes += 1; }, onSuccess() {} }));
  fireEvent.change(view.getByLabelText("Interpretation"), { target: { value: "No material change observed." } });
  const submit = view.getByRole("button", { name: "Record interpretation" });
  fireEvent.click(submit);
  fireEvent.click(submit);
  fireEvent.keyDown(document, { key: "Escape" });
  assert.equal(posts, 1);
  assert.equal(closes, 0);
  request.resolve({ status: 201, data: { reviewItem: detailItem({ type: "evaluation_review", state: "reviewed", persistedState: "reviewed", effectiveState: "reviewed", revision: 3, permissions: { canAcknowledge: false, canSnooze: false, canReview: false, canRecordIntervention: false }, review: { at: "2026-07-19T10:00:00.000Z", by: { displayName: "Asha", workspaceRole: "member", provenance: "snapshot", capturedAt: "2026-07-19T10:00:00.000Z" } } }) } });
  await waitFor(() => assert.equal(posts, 1));
});

test("network retry preserves the Review mutation idempotency key", async () => {
  const payloads = [];
  api.post = async (_url, payload) => {
    payloads.push(payload);
    if (payloads.length === 1) throw new Error("offline");
    return { status: 201, data: { reviewItem: detailItem({ type: "evaluation_review", state: "reviewed", persistedState: "reviewed", effectiveState: "reviewed", revision: 3, permissions: { canAcknowledge: false, canSnooze: false, canReview: false, canRecordIntervention: false }, review: { at: "2026-07-19T10:00:00.000Z", by: { displayName: "Asha", workspaceRole: "member", provenance: "snapshot", capturedAt: "2026-07-19T10:00:00.000Z" } } }) } };
  };
  const item = detailItem({ type: "evaluation_review", permissions: { canAcknowledge: false, canSnooze: false, canReview: true, canRecordIntervention: false } });
  const view = render(createElement(ReviewMutationDialog, { mode: "interpret", reviewItem: item, onClose() {}, onSuccess() {} }));
  fireEvent.change(view.getByLabelText("Interpretation"), { target: { value: "Mixed movement observed." } });
  const submit = view.getByRole("button", { name: "Record interpretation" });
  fireEvent.click(submit);
  assert.ok(await view.findByText(/Network error/));
  fireEvent.click(submit);
  await waitFor(() => assert.equal(payloads.length, 2));
  assert.equal(payloads[0].idempotencyKey, payloads[1].idempotencyKey);
});

test("stale Review revision fails closed and requires authoritative review", async () => {
  let posts = 0;
  let authorityChanges = 0;
  api.post = async () => {
    posts += 1;
    const error = new Error("stale");
    error.response = { status: 409, data: { code: "REVIEW_REVISION_STALE" } };
    throw error;
  };
  const item = detailItem({ type: "evaluation_review", permissions: { canAcknowledge: false, canSnooze: false, canReview: true, canRecordIntervention: false } });
  const view = render(createElement(ReviewMutationDialog, { mode: "interpret", reviewItem: item, onClose() {}, onSuccess() {}, onAuthorityChanged: () => { authorityChanges += 1; } }));
  fireEvent.change(view.getByLabelText("Interpretation"), { target: { value: "No material change observed." } });
  fireEvent.click(view.getByRole("button", { name: "Record interpretation" }));
  assert.ok(await view.findByText(/latest version must be reviewed/));
  assert.equal(view.getByRole("button", { name: "Record interpretation" }).disabled, true);
  assert.ok(view.getByRole("button", { name: "Close and review the latest item" }));
  assert.equal(posts, 1);
  assert.equal(authorityChanges, 1);
});

test("Review Intervention reuses the form, excludes internal notes, and submits Review revision", async () => {
  let post;
  api.post = async (...args) => { post = args; return { status: 201, data: { intervention: { id: "777777777777777777777777" }, reviewCompletionStatus: "pending", idempotentReplay: false } }; };
  const view = render(createElement(ReviewInterventionModal, { reviewItem: detailItem(), members: [], currentUserId: "aaaaaaaaaaaaaaaaaaaaaaaa", onClose() {}, onSuccess() {} }));
  const select = view.getAllByRole("combobox")[0];
  assert.equal(Array.from(select.options).some((option) => option.value === "internal_note"), false);
  fireEvent.change(view.container.querySelectorAll("textarea")[0], { target: { value: "Continue observing persisted evidence." } });
  fireEvent.click(view.getByRole("button", { name: "Review action" }));
  fireEvent.click(await view.findByRole("button", { name: "Record action" }));
  await waitFor(() => assert.ok(post));
  assert.equal(post[0], `/review-items/${ids.review}/interventions`);
  assert.equal(post[1].expectedReviewRevision, 2);
  assert.equal(Object.hasOwn(post[1], "expectedIssueRevision"), false);
  assert.equal(post[1].actionType, "monitor_only");
});

test("timeline preserves backend order, wraps bounded text, and never renders actor email", () => {
  const evaluationEntries = [
    { id: "evaluations:superseded", stream: "evaluations", kind: "evaluation_calculated", sourceId: ids.action, occurredAt: "2026-07-19T08:00:00.000Z", rank: 30, title: "Evaluation calculated", description: "Historical evidence.", status: "superseded", result: "mixed", actor: null },
    { id: "evaluations:invalidated", stream: "evaluations", kind: "evaluation_calculated", sourceId: ids.signal, occurredAt: "2026-07-19T07:00:00.000Z", rank: 30, title: "Evaluation calculated", description: "Source authority changed.", status: "invalidated", result: null, actor: null },
  ];
  const state = { items: [...timelineResponse.timeline.map((entry) => ({ ...entry, actor: entry.actor ? { displayName: entry.actor.displayName, workspaceRole: entry.actor.workspaceRole } : null })), ...evaluationEntries], isLoading: false, isLoadingMore: false, error: null, hasMore: false, retry() {}, loadMore() {} };
  const view = render(createElement(IssueTimeline, { state }));
  const labels = view.getAllByRole("heading", { level: 3 });
  assert.equal(labels[0].textContent, "Persisted Signal");
  assert.equal(labels[1].textContent, "Review acknowledged");
  assert.ok(view.getByRole("heading", { level: 3, name: "Evaluation superseded" }));
  assert.ok(view.getByRole("heading", { level: 3, name: "Evaluation invalidated" }));
  assert.equal(view.queryByText("private@example.com"), null);
});

test("Review A acknowledgement success is ignored after navigation to Review B", async () => {
  const pending = deferred();
  const reads = [];
  let summaryRefreshes = 0;
  const onSummary = () => { summaryRefreshes += 1; };
  window.addEventListener("narrative:review-summary-refresh", onSummary);
  api.get = reviewReads({
    detailById: {
      [ids.review]: detailFor(ids.review, "Review A", ids.issue),
      [ids.reviewB]: detailFor(ids.reviewB, "Review B", ids.issueB, ids.clientB),
    },
    onGet: (url) => reads.push(url),
  });
  api.post = async () => pending.promise;
  try {
    const view = render(reviewRoute());
    fireEvent.click(await view.findByRole("button", { name: "Acknowledge" }));
    fireEvent.click(view.getByRole("button", { name: "Open Review B" }));
    assert.ok(await view.findByRole("heading", { level: 1, name: "Review B" }));
    const bDetailReads = reads.filter((url) => url === `/review-items/${ids.reviewB}`).length;
    const bActionReads = reads.filter((url) => url === `/review-items/${ids.reviewB}/actions`).length;
    await act(async () => {
      pending.resolve({ status: 201, data: { reviewItem: detailFor(ids.review, "Review A", ids.issue), idempotentReplay: false } });
      await Promise.resolve();
    });
    assert.equal(view.queryByText("Review acknowledged."), null);
    assert.equal(view.queryByText(/latest version must be reviewed/i), null);
    assert.equal(reads.filter((url) => url === `/review-items/${ids.reviewB}`).length, bDetailReads);
    assert.equal(reads.filter((url) => url === `/review-items/${ids.reviewB}/actions`).length, bActionReads);
    assert.equal(summaryRefreshes, 0);
  } finally {
    window.removeEventListener("narrative:review-summary-refresh", onSummary);
  }
});

test("stale Review A mutation cannot reload or message Review B", async () => {
  const pending = deferred();
  const reads = [];
  let posts = 0;
  api.get = reviewReads({
    detailById: {
      [ids.review]: detailFor(ids.review, "Review A", ids.issue),
      [ids.reviewB]: detailFor(ids.reviewB, "Review B", ids.issueB, ids.clientB),
    },
    onGet: (url) => reads.push(url),
  });
  api.post = async () => { posts += 1; return pending.promise; };
  const view = render(reviewRoute());
  fireEvent.click(await view.findByRole("button", { name: "Acknowledge" }));
  fireEvent.click(view.getByRole("button", { name: "Open Review B" }));
  assert.ok(await view.findByRole("heading", { level: 1, name: "Review B" }));
  const bReads = reads.filter((url) => url === `/review-items/${ids.reviewB}`).length;
  const stale = Object.assign(new Error("stale"), { response: { status: 409, data: { code: "REVIEW_REVISION_STALE" } } });
  await act(async () => {
    pending.reject(stale);
    await Promise.resolve();
  });
  assert.equal(view.queryByText(/latest version must be reviewed/i), null);
  assert.equal(reads.filter((url) => url === `/review-items/${ids.reviewB}`).length, bReads);
  assert.equal(posts, 1);
});

test("unmount aborts an active Review mutation without callbacks or warnings", async () => {
  const pending = deferred();
  let mutationSignal;
  let summaryRefreshes = 0;
  const onSummary = () => { summaryRefreshes += 1; };
  window.addEventListener("narrative:review-summary-refresh", onSummary);
  api.get = reviewReads({ detailById: { [ids.review]: detailFor(ids.review, "Review A", ids.issue) } });
  api.post = async (_url, _payload, options) => { mutationSignal = options.signal; return pending.promise; };
  try {
    const view = render(wrap(createElement(ReviewDetail), `/reviews/${ids.review}`, "/reviews/:reviewItemId"));
    fireEvent.click(await view.findByRole("button", { name: "Acknowledge" }));
    await waitFor(() => assert.ok(mutationSignal));
    view.unmount();
    assert.equal(mutationSignal.aborted, true);
    await act(async () => {
      pending.resolve({ status: 201, data: { reviewItem: detailFor(ids.review, "Review A", ids.issue), idempotentReplay: false } });
      await Promise.resolve();
    });
    assert.equal(summaryRefreshes, 0);
  } finally {
    window.removeEventListener("narrative:review-summary-refresh", onSummary);
  }
});

test("Review dialog creates one lazy UUID across rerenders and retry, then a new one when reopened", async () => {
  const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  let uuidCalls = 0;
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: { randomUUID: () => `${String(++uuidCalls).padStart(8, "0")}-0000-4000-8000-000000000000` },
  });
  const payloads = [];
  api.post = async (_url, payload) => {
    payloads.push(payload);
    if (payloads.length === 1) throw new Error("offline");
    return { status: 201, data: { reviewItem: detailFor(ids.review, "Review A", ids.issue), idempotentReplay: false } };
  };
  const props = { mode: "snooze", reviewItem: detailFor(ids.review, "Review A", ids.issue), onClose() {}, onSuccess() {} };
  try {
    const view = render(createElement(ReviewMutationDialog, props));
    view.rerender(createElement(ReviewMutationDialog, props));
    assert.equal(uuidCalls, 1);
    const future = new Date(Date.now() + 86_400_000);
    const local = new Date(future.getTime() - future.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    fireEvent.change(view.getByLabelText("Snoozed until"), { target: { value: local } });
    fireEvent.click(view.getByRole("button", { name: "Snooze" }));
    assert.ok(await view.findByText(/Network error/));
    fireEvent.click(view.getByRole("button", { name: "Snooze" }));
    await waitFor(() => assert.equal(payloads.length, 2));
    assert.equal(payloads[0].idempotencyKey, payloads[1].idempotencyKey);
    assert.equal(uuidCalls, 1);
    view.unmount();
    render(createElement(ReviewMutationDialog, props));
    assert.equal(uuidCalls, 2);
  } finally {
    if (originalCryptoDescriptor) Object.defineProperty(globalThis, "crypto", originalCryptoDescriptor);
    else delete globalThis.crypto;
  }
});

test("Review action invalid cursor retry restarts only that history from its first page", async () => {
  const cursors = [];
  let actionReads = 0;
  const secondAction = { ...action, id: "aaaaaaaaaaaaaaaaaaaaaaaa", sequence: 2, actionType: "acknowledged", resultingState: "acknowledged" };
  api.get = async (url, options = {}) => {
    if (url === `/review-items/${ids.review}`) return { data: { reviewItem: detailFor(ids.review, "Review A", ids.issue) } };
    if (url === "/settings/team") return { data: { members: [] } };
    if (url === `/review-items/${ids.review}/actions`) {
      actionReads += 1;
      cursors.push(options.params?.cursor);
      if (actionReads === 1) return { data: { actions: [action], page: { limit: 20, nextCursor: "2" } } };
      if (actionReads === 2) throw Object.assign(new Error("private cursor failure"), { response: { status: 400, data: { code: "INVALID_REVIEW_CURSOR", message: "private" } } });
      return { data: { actions: [action, secondAction], page: { limit: 20, nextCursor: null } } };
    }
    if (url === `/issues/${ids.issue}/timeline`) return { data: { timeline: [], page: { ...emptyPage, snapshotAt: "2026-07-19T10:00:00.000Z" } } };
    throw new Error(url);
  };
  const view = render(wrap(createElement(ReviewDetail), `/reviews/${ids.review}`, "/reviews/:reviewItemId"));
  assert.ok(await view.findByText("Review opened from Issue"));
  fireEvent.click(view.getByRole("button", { name: "Load earlier actions" }));
  assert.ok(await view.findByText(/Existing history is still shown/));
  assert.ok(view.getByText("Review opened from Issue"));
  fireEvent.click(view.getByRole("button", { name: "Retry" }));
  assert.ok(await view.findByText("Review acknowledged"));
  assert.deepEqual(cursors, [undefined, "2", undefined]);
  assert.equal(view.getAllByText("Review opened from Issue").length, 1);
  assert.ok(view.getByRole("heading", { level: 1, name: "Review A" }));
});

test("real Review Intervention pending and replay responses reconcile without failure or duplicate submission", async () => {
  const payloads = [];
  api.get = reviewReads({ detailById: { [ids.review]: detailFor(ids.review, "Review A", ids.issue) } });
  api.post = async (url, payload) => {
    payloads.push({ url, payload });
    if (payloads.length === 1) throw new Error("offline");
    return { status: 201, data: { intervention: { id: "bbbbbbbbbbbbbbbbbbbbbbbb" }, reviewCompletionStatus: "pending", idempotentReplay: false } };
  };
  const view = render(wrap(createElement(ReviewDetail), `/reviews/${ids.review}`, "/reviews/:reviewItemId"));
  fireEvent.click(await view.findByRole("button", { name: "Record action" }));
  const actionType = view.getAllByRole("combobox")[0];
  assert.equal(Array.from(actionType.options).some((option) => option.value === "internal_note"), false);
  fireEvent.change(view.getByLabelText(/^Reason/), { target: { value: "Continue observing persisted evidence." } });
  fireEvent.click(view.getByRole("button", { name: "Review action" }));
  fireEvent.click(within(view.getByRole("dialog")).getByRole("button", { name: "Record action" }));
  assert.ok(await view.findByText(/Network error/));
  fireEvent.click(within(view.getByRole("dialog")).getByRole("button", { name: "Record action" }));
  assert.ok(await view.findByText("Action recorded. Review status is still updating."));
  assert.equal(payloads[0].url, `/review-items/${ids.review}/interventions`);
  assert.equal(payloads[0].payload.idempotencyKey, payloads[1].payload.idempotencyKey);
  assert.equal(payloads[1].payload.expectedReviewRevision, 2);
  assert.equal(Object.hasOwn(payloads[1].payload, "expectedIssueRevision"), false);
  assert.equal(Object.hasOwn(payloads[1].payload, "internal_note"), false);
  assert.equal(view.queryByRole("alert"), null);

  cleanup();
  api.get = reviewReads({ detailById: { [ids.review]: detailFor(ids.review, "Review A", ids.issue) } });
  let replayPosts = 0;
  api.post = async () => {
    replayPosts += 1;
    return { status: 200, data: { intervention: { id: "bbbbbbbbbbbbbbbbbbbbbbbb" }, reviewCompletionStatus: "completed", idempotentReplay: true } };
  };
  const replay = render(wrap(createElement(ReviewDetail), `/reviews/${ids.review}`, "/reviews/:reviewItemId"));
  fireEvent.click(await replay.findByRole("button", { name: "Record action" }));
  fireEvent.change(replay.getByLabelText(/^Reason/), { target: { value: "Continue observing persisted evidence." } });
  fireEvent.click(replay.getByRole("button", { name: "Review action" }));
  fireEvent.click(within(replay.getByRole("dialog")).getByRole("button", { name: "Record action" }));
  assert.ok(await replay.findByText("Existing action record recovered and Review completed."));
  assert.equal(replayPosts, 1);
  assert.equal(replay.getAllByText("Existing action record recovered and Review completed.").length, 1);
});

test("real Review Intervention exact replay retires its UUID until a new explicit intent", async () => {
  const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  const storagePrototype = Object.getPrototypeOf(window.localStorage);
  const originalStorageMethods = {
    getItem: storagePrototype.getItem,
    setItem: storagePrototype.setItem,
    removeItem: storagePrototype.removeItem,
  };
  const uuidValues = ["review-intent-one", "review-intent-two"];
  const payloads = [];
  let uuidCalls = 0;
  let storageCalls = 0;

  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      randomUUID: () => {
        uuidCalls += 1;
        return uuidValues.shift();
      },
    },
  });
  for (const method of Object.keys(originalStorageMethods)) {
    storagePrototype[method] = function trackedStorageMethod(...args) {
      storageCalls += 1;
      return originalStorageMethods[method].apply(this, args);
    };
  }

  api.get = reviewReads({
    detailById: { [ids.review]: detailFor(ids.review, "Review A", ids.issue) },
  });
  api.post = async (url, payload) => {
    payloads.push({ url, payload });
    if (payloads.length === 1) throw new Error("offline");
    return {
      status: 200,
      data: {
        intervention: { id: "bbbbbbbbbbbbbbbbbbbbbbbb" },
        reviewCompletionStatus: "completed",
        idempotentReplay: true,
      },
    };
  };

  try {
    const view = render(wrap(createElement(ReviewDetail), `/reviews/${ids.review}`, "/reviews/:reviewItemId"));
    fireEvent.click(await view.findByRole("button", { name: "Record action" }));
    assert.equal(uuidCalls, 1);
    fireEvent.change(view.getByLabelText(/^Reason/), {
      target: { value: "Continue observing persisted evidence." },
    });
    fireEvent.click(view.getByRole("button", { name: "Review action" }));
    assert.equal(uuidCalls, 1, "rerenders must not mint another intent key");

    fireEvent.click(within(view.getByRole("dialog")).getByRole("button", { name: "Record action" }));
    assert.ok(await view.findByText(/Network error/));
    assert.equal(uuidCalls, 1);
    fireEvent.click(within(view.getByRole("dialog")).getByRole("button", { name: "Record action" }));
    assert.ok(await view.findByText("Existing action record recovered and Review completed."));

    assert.equal(payloads.length, 2);
    assert.equal(payloads[0].url, `/review-items/${ids.review}/interventions`);
    assert.equal(payloads[0].payload.idempotencyKey, "record:review-intent-one");
    assert.equal(payloads[1].payload.idempotencyKey, payloads[0].payload.idempotencyKey);
    assert.equal(uuidCalls, 1, "exact replay must not prepare an unused replacement key");
    assert.equal(view.queryByRole("dialog"), null);
    assert.equal(view.getAllByText("Existing action record recovered and Review completed.").length, 1);
    assert.equal(storageCalls, 0, "Intervention intent keys must remain in component memory");

    fireEvent.click(view.getByRole("button", { name: "Record action" }));
    assert.equal(uuidCalls, 2, "a new explicit modal intent creates exactly one new UUID");
    assert.ok(view.getByRole("dialog"));
    view.unmount();
    assert.equal(uuidCalls, 2, "unmount must not create another UUID");
  } finally {
    for (const [method, implementation] of Object.entries(originalStorageMethods)) {
      storagePrototype[method] = implementation;
    }
    if (originalCryptoDescriptor) Object.defineProperty(globalThis, "crypto", originalCryptoDescriptor);
    else delete globalThis.crypto;
  }
});

test("pending Review Intervention for A is ignored after navigation to B", async () => {
  const pending = deferred();
  const reads = [];
  api.get = reviewReads({
    detailById: {
      [ids.review]: detailFor(ids.review, "Review A", ids.issue),
      [ids.reviewB]: detailFor(ids.reviewB, "Review B", ids.issueB, ids.clientB),
    },
    onGet: (url) => reads.push(url),
  });
  api.post = async () => pending.promise;
  const view = render(reviewRoute());
  fireEvent.click(await view.findByRole("button", { name: "Record action" }));
  fireEvent.change(view.getByLabelText(/^Reason/), { target: { value: "Continue observing persisted evidence." } });
  fireEvent.click(view.getByRole("button", { name: "Review action" }));
  fireEvent.click(within(view.getByRole("dialog")).getByRole("button", { name: "Record action" }));
  fireEvent.click(view.getByRole("button", { name: "Open Review B" }));
  assert.ok(await view.findByRole("heading", { level: 1, name: "Review B" }));
  const bReads = reads.filter((url) => url === `/review-items/${ids.reviewB}`).length;
  await act(async () => {
    pending.resolve({ status: 201, data: { intervention: { id: "bbbbbbbbbbbbbbbbbbbbbbbb" }, reviewCompletionStatus: "pending", idempotentReplay: false } });
    await Promise.resolve();
  });
  assert.equal(view.queryByText("Action recorded. Review status is still updating."), null);
  assert.equal(reads.filter((url) => url === `/review-items/${ids.reviewB}`).length, bReads);
  assert.equal(view.queryByRole("alert"), null);
});

test("Client Review summary is honest, bounded, and fenced across Client owners", async () => {
  const states = [
    { payload: summaryPayload(), expected: "0" },
    { payload: summaryPayload({ actionable: 4 }), expected: "4" },
    { payload: summaryPayload({ actionable: 3, completeness: "partial" }), expected: "complete total is still being calculated" },
    { payload: summaryPayload({ archived: true }), expected: "Archived Client" },
  ];
  for (const [index, state] of states.entries()) {
    api.get = async () => ({ data: state.payload });
    const clientId = `${ids.client.slice(0, -1)}${index}`;
    const view = render(wrap(createElement(ClientReviewSummary, { clientId })));
    assert.ok((await view.findAllByText(new RegExp(state.expected))).length >= 1);
    if (state.payload.summary.completeness === "partial") assert.equal(view.queryByText("3"), null);
    view.unmount();
  }

  const pendingA = deferred();
  const calls = [];
  api.get = async (url) => {
    calls.push(url);
    return url.includes(ids.clientB) ? { data: summaryPayload({ actionable: 2 }) } : pendingA.promise;
  };
  const view = render(wrap(createElement(ClientReviewSummary, { clientId: ids.client })));
  view.rerender(wrap(createElement(ClientReviewSummary, { clientId: ids.clientB })));
  assert.ok((await view.findAllByText("2")).length >= 1);
  await act(async () => {
    pendingA.resolve({ data: summaryPayload({ actionable: 9 }) });
    await Promise.resolve();
  });
  assert.equal(view.queryByText("9"), null);
  assert.equal(calls.filter((url) => url === `/clients/${ids.client}/review-summary`).length, 1);
  assert.equal(calls.filter((url) => url === `/clients/${ids.clientB}/review-summary`).length, 1);
  assert.equal(calls.some((url) => url === "/clients"), false);
});

test("real ClientDetail presents complete, partial, and archived Review summaries honestly", async () => {
  const cases = [
    { suffix: "0", payload: summaryPayload(), expectedActionable: "0" },
    { suffix: "1", payload: summaryPayload({ actionable: 4 }), expectedActionable: "4" },
    { suffix: "2", payload: summaryPayload({ actionable: 3, completeness: "partial" }), partial: true },
    { suffix: "3", payload: summaryPayload({ archived: true }), archived: true },
  ];

  for (const scenario of cases) {
    const clientId = `${ids.client.slice(0, -1)}${scenario.suffix}`;
    const calls = [];
    api.get = clientDetailReads({
      clients: {
        [clientId]: clientValue(clientId, "Acme", { archived: scenario.archived }),
      },
      summaries: { [clientId]: scenario.payload },
      onGet: (url) => calls.push(url),
    });
    const view = render(wrap(createElement(ClientDetail), `/clients/${clientId}`, "/clients/:clientId"));
    assert.ok(await view.findByRole("heading", { level: 1, name: "Acme" }));
    assert.ok(view.getByText("Retained historical context for Acme."));
    const summarySection = (await view.findByRole("heading", { level: 2, name: "Review" })).closest("section");
    assert.ok(summarySection);

    if (scenario.partial) {
      assert.ok(within(summarySection).getByText(/complete total is still being calculated/));
      assert.equal(within(summarySection).queryByText("3"), null);
    } else if (scenario.archived) {
      assert.ok(within(summarySection).getByText(/Archived Client/));
      assert.ok(within(summarySection).getByText(/read-only/));
      assert.equal(view.queryByRole("button", { name: /Acknowledge|Snooze|Record interpretation|Record action/ }), null);
    } else {
      const actionable = within(summarySection).getByText("Actionable");
      assert.equal(actionable.nextElementSibling?.textContent, scenario.expectedActionable);
      assert.equal(within(summarySection).queryByText(/still being calculated/), null);
    }

    assert.equal(calls.filter((url) => url === `/clients/${clientId}/review-summary`).length, 1);
    view.unmount();
  }
});

test("real ClientDetail fences a deferred Client A summary after navigation to Client B", async () => {
  const pendingA = deferred();
  const calls = [];
  api.get = clientDetailReads({
    summaries: {
      [ids.client]: () => pendingA.promise,
      [ids.clientB]: summaryPayload({ actionable: 2 }),
    },
    onGet: (url) => calls.push(url),
  });

  const view = render(clientRoute());
  assert.ok(await view.findByRole("heading", { level: 1, name: "Acme" }));
  await waitFor(() => assert.equal(
    calls.filter((url) => url === `/clients/${ids.client}/review-summary`).length,
    1
  ));
  fireEvent.click(view.getByRole("button", { name: "Open Client B" }));
  assert.ok(await view.findByRole("heading", { level: 1, name: "Beta" }));
  const summarySection = (await view.findByRole("heading", { level: 2, name: "Review" })).closest("section");
  assert.equal(within(summarySection).getByText("Actionable").nextElementSibling?.textContent, "2");

  await act(async () => {
    pendingA.resolve({ data: summaryPayload({ actionable: 9 }) });
    await Promise.resolve();
  });
  assert.equal(within(summarySection).queryByText("9"), null);
  assert.ok(view.getByText("Retained historical context for Beta."));
  assert.equal(calls.filter((url) => url === `/clients/${ids.client}/review-summary`).length, 1);
  assert.equal(calls.filter((url) => url === `/clients/${ids.clientB}/review-summary`).length, 1);
  assert.equal(calls.filter((url) => url.endsWith("/review-summary")).length, 2);
});

test("real ClientDetail preserves history and retries a bounded summary error for its current owner", async () => {
  const calls = [];
  let summaryReads = 0;
  api.get = clientDetailReads({
    summaries: {
      [ids.client]: () => {
        summaryReads += 1;
        if (summaryReads === 1) {
          throw Object.assign(new Error("private summary failure"), {
            response: { status: 503, data: { message: "private summary failure" } },
          });
        }
        return { data: summaryPayload({ actionable: 1 }) };
      },
    },
    onGet: (url) => calls.push(url),
  });

  const view = render(wrap(createElement(ClientDetail), `/clients/${ids.client}`, "/clients/:clientId"));
  assert.ok(await view.findByRole("heading", { level: 1, name: "Acme" }));
  assert.ok(view.getByText("Retained historical context for Acme."));
  assert.ok(await view.findByText("Client Review summary is temporarily unavailable."));
  assert.equal(view.queryByText("private summary failure"), null);
  fireEvent.click(view.getByRole("button", { name: "Retry" }));
  const summarySection = (await view.findByRole("heading", { level: 2, name: "Review" })).closest("section");
  await waitFor(() => assert.equal(
    within(summarySection).getByText("Actionable").nextElementSibling?.textContent,
    "1"
  ));
  assert.ok(view.getByText("Retained historical context for Acme."));
  assert.equal(summaryReads, 2);
  assert.deepEqual(
    calls.filter((url) => url.endsWith("/review-summary")),
    [`/clients/${ids.client}/review-summary`, `/clients/${ids.client}/review-summary`]
  );
});

test("real IssueDetail fences Issue A timeline and resets invalid Issue B cursor on retry", async () => {
  const pendingA = deferred();
  const timelineCursors = [];
  let bTimelineReads = 0;
  const evaluationEntries = [
    { id: "evaluations:superseded", stream: "evaluations", kind: "evaluation_calculated", sourceId: ids.action, occurredAt: "2026-07-19T08:00:00.000Z", rank: 30, title: "Evaluation calculated", description: "Issue B superseded evidence.", status: "superseded", result: "mixed", actor: null },
    { id: "evaluations:invalidated", stream: "evaluations", kind: "evaluation_calculated", sourceId: ids.signal, occurredAt: "2026-07-19T07:00:00.000Z", rank: 30, title: "Evaluation calculated", description: "Issue B invalidated evidence.", status: "invalidated", result: null, actor: null },
  ];
  api.get = async (url, options = {}) => {
    if (url === `/issues/${ids.issue}`) return { data: { issue: issueValue(ids.issue, "Issue A", ids.client) } };
    if (url === `/issues/${ids.issueB}`) return { data: { issue: issueValue(ids.issueB, "Issue B", ids.clientB) } };
    if (url.endsWith("/signals")) return { data: { signals: [], page: emptyPage } };
    if (url.endsWith("/interventions")) return { data: { interventions: [], page: emptyPage } };
    if (url === `/issues/${ids.issue}/timeline`) return pendingA.promise;
    if (url === `/issues/${ids.issueB}/timeline`) {
      bTimelineReads += 1;
      timelineCursors.push(options.params?.cursor);
      if (bTimelineReads === 1) return { data: { timeline: evaluationEntries, page: { limit: 20, snapshotAt: "2026-07-19T10:00:00.000Z", nextCursor: "rejected-timeline-cursor" } } };
      if (bTimelineReads === 2) throw Object.assign(new Error("private"), { response: { status: 400, data: { code: "INVALID_TIMELINE_CURSOR", message: "private" } } });
      return { data: { timeline: evaluationEntries, page: { limit: 20, snapshotAt: "2026-07-19T10:00:00.000Z", nextCursor: null } } };
    }
    if (url === "/settings/team") return { data: { members: [] } };
    if (url.startsWith("/clients/")) return { data: { client: {} } };
    throw new Error(url);
  };
  const view = render(wrap(createElement(IssueRouteHarness), `/issues/${ids.issue}`, "/issues/:issueId"));
  assert.ok(await view.findByRole("heading", { level: 1, name: "Issue A" }));
  fireEvent.click(view.getByRole("button", { name: "Open Issue B" }));
  assert.ok(await view.findByRole("heading", { level: 1, name: "Issue B" }));
  assert.ok(await view.findByText("Issue B superseded evidence."));
  await act(async () => {
    pendingA.resolve({ data: { timeline: [{ ...evaluationEntries[0], id: "evaluations:old-a", description: "Old Issue A timeline." }], page: { ...emptyPage, snapshotAt: "2026-07-19T10:00:00.000Z" } } });
    await Promise.resolve();
  });
  assert.equal(view.queryByText("Old Issue A timeline."), null);
  assert.ok(view.getByText("Evaluation superseded"));
  assert.ok(view.getByText("Evaluation invalidated"));
  fireEvent.click(view.getByRole("button", { name: "Load earlier timeline entries" }));
  assert.ok(await view.findByText(/Existing entries are still shown/));
  assert.ok(view.getByText("Issue B superseded evidence."));
  fireEvent.click(view.getByRole("button", { name: "Retry" }));
  await waitFor(() => assert.deepEqual(timelineCursors, [undefined, "rejected-timeline-cursor", undefined]));
  assert.equal(view.getAllByText("Issue B superseded evidence.").length, 1);
});

test("real IssueDetail retains ordinary failed timeline appends and retries the same cursor", async () => {
  const timelineCursors = [];
  const requests = [];
  let timelineReads = 0;
  const superseded = {
    id: "evaluations:ordinary-superseded",
    stream: "evaluations",
    kind: "evaluation_calculated",
    sourceId: ids.action,
    occurredAt: "2026-07-19T08:00:00.000Z",
    rank: 30,
    title: "Evaluation calculated",
    description: "Superseded evidence remains first.",
    status: "superseded",
    result: "mixed",
    actor: { displayName: "Asha", workspaceRole: "member", email: "private@example.com" },
  };
  const invalidated = {
    id: "evaluations:ordinary-invalidated",
    stream: "evaluations",
    kind: "evaluation_calculated",
    sourceId: ids.signal,
    occurredAt: "2026-07-19T07:00:00.000Z",
    rank: 30,
    title: "Evaluation calculated",
    description: "Invalidated evidence appends second.",
    status: "invalidated",
    result: null,
    actor: null,
  };

  api.get = async (url, options = {}) => {
    requests.push(url);
    if (url === `/issues/${ids.issue}`) {
      return { data: { issue: issueValue(ids.issue, "Issue A", ids.client) } };
    }
    if (url === `/issues/${ids.issue}/signals`) {
      return { data: { signals: [], page: emptyPage } };
    }
    if (url === `/issues/${ids.issue}/interventions`) {
      return { data: { interventions: [], page: emptyPage } };
    }
    if (url === `/issues/${ids.issue}/timeline`) {
      timelineReads += 1;
      timelineCursors.push(options.params?.cursor);
      if (timelineReads === 1) {
        return {
          data: {
            timeline: [superseded],
            page: {
              limit: 20,
              snapshotAt: "2026-07-19T10:00:00.000Z",
              nextCursor: "ordinary-cursor-C1",
            },
          },
        };
      }
      if (timelineReads === 2) throw new Error("private timeline network detail");
      return {
        data: {
          timeline: [superseded, invalidated],
          page: {
            limit: 20,
            snapshotAt: "2026-07-19T10:00:00.000Z",
            nextCursor: null,
          },
        },
      };
    }
    if (url === `/clients/${ids.client}`) return { data: { client: {} } };
    if (url === "/settings/team") return { data: { members: [] } };
    throw new Error(url);
  };

  const view = render(wrap(createElement(IssueDetail), `/issues/${ids.issue}`, "/issues/:issueId"));
  assert.ok(await view.findByRole("heading", { level: 1, name: "Issue A" }));
  assert.ok(await view.findByText("Superseded evidence remains first."));
  fireEvent.click(view.getByRole("button", { name: "Load earlier timeline entries" }));
  assert.ok(await view.findByText(/Existing entries are still shown/));
  assert.ok(view.getByText("Superseded evidence remains first."));
  assert.ok(view.getByText("Persisted summary for Issue A."));
  assert.equal(view.queryByText("private timeline network detail"), null);
  assert.deepEqual(timelineCursors, [undefined, "ordinary-cursor-C1"]);

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  assert.equal(timelineReads, 2, "ordinary append failures must not retry automatically");

  fireEvent.click(view.getByRole("button", { name: "Retry" }));
  assert.ok(await view.findByText("Invalidated evidence appends second."));
  assert.deepEqual(timelineCursors, [undefined, "ordinary-cursor-C1", "ordinary-cursor-C1"]);
  assert.equal(view.getAllByText("Superseded evidence remains first.").length, 1);
  assert.ok(view.getByText("Evaluation superseded"));
  assert.ok(view.getByText("Evaluation invalidated"));
  const firstEntry = view.getByText("Superseded evidence remains first.");
  const secondEntry = view.getByText("Invalidated evidence appends second.");
  assert.equal(
    firstEntry.compareDocumentPosition(secondEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    Node.DOCUMENT_POSITION_FOLLOWING
  );
  assert.ok(view.getByText("Asha"));
  assert.equal(view.queryByText("private@example.com"), null);
  assert.equal(requests.some((url) => url.includes("ordinary-superseded") || url.includes("ordinary-invalidated")), false);
  assert.equal(requests.filter((url) => url === `/issues/${ids.issue}/timeline`).length, 3);
});

test("Review queue covers first-page retry, filtered empty state, and initial-load unmount", async () => {
  let queueReads = 0;
  api.get = async (url) => {
    if (url === "/clients") return { data: { clients: [] } };
    queueReads += 1;
    if (queueReads === 1) throw new Error("offline");
    return { data: { reviewItems: [], page: { limit: 25, returned: 0, scanned: 0, nextCursor: null } } };
  };
  const view = render(wrap(createElement(Reviews)));
  assert.ok(await view.findByText(/Network error/));
  fireEvent.click(view.getByRole("button", { name: "Retry" }));
  assert.ok(await view.findByText("Review queue is clear"));
  fireEvent.change(view.getByLabelText("Review priority"), { target: { value: "high" } });
  assert.ok(await view.findByText("No Review items match these filters"));

  cleanup();
  const pending = deferred();
  let signal;
  api.get = async (url, options = {}) => {
    if (url === "/clients") return { data: { clients: [] } };
    signal = options.signal;
    return pending.promise;
  };
  const loading = render(wrap(createElement(Reviews)));
  await waitFor(() => assert.ok(signal));
  loading.unmount();
  assert.equal(signal.aborted, true);
  await act(async () => {
    pending.resolve({ data: { reviewItems: [listItem()], page: { limit: 25, returned: 1, scanned: 1, nextCursor: null } } });
    await Promise.resolve();
  });
});

test("Review queue ignores deferred old-filter and old-append responses", async () => {
  const initial = deferred();
  const append = deferred();
  let defaultReads = 0;
  const requestedPriorities = [];
  api.get = async (url, options = {}) => {
    if (url === "/clients") return { data: { clients: [] } };
    requestedPriorities.push(options.params?.priority || "");
    if (options.params?.priority === "high") return { data: { reviewItems: [listItem({ id: ids.reviewB, priority: "high", source: { title: "High owner", summary: "High owner.", provenance: "snapshot" } })], page: { limit: 25, returned: 1, scanned: 1, nextCursor: null } } };
    defaultReads += 1;
    if (defaultReads === 1) return initial.promise;
    return append.promise;
  };
  const view = render(wrap(createElement(Reviews)));
  await waitFor(() => assert.equal(defaultReads, 1));
  fireEvent.change(view.getByLabelText("Review priority"), { target: { value: "high" } });
  await waitFor(() => assert.ok(requestedPriorities.includes("high")));
  assert.ok((await view.findAllByText(/High owner/)).length >= 1);
  await act(async () => {
    initial.resolve({ data: { reviewItems: [listItem({ source: { title: "Old owner", summary: "Old owner.", provenance: "snapshot" } })], page: { limit: 25, returned: 1, scanned: 1, nextCursor: "old-append" } } });
    await Promise.resolve();
  });
  assert.equal(view.queryByText(/Old owner/), null);

  cleanup();
  defaultReads = 0;
  const firstPage = { data: { reviewItems: [listItem({ source: { title: "Default owner", summary: "Default.", provenance: "snapshot" } })], page: { limit: 25, returned: 1, scanned: 1, nextCursor: "old-append" } } };
  api.get = async (url, options = {}) => {
    if (url === "/clients") return { data: { clients: [] } };
    if (options.params?.priority === "high") return { data: { reviewItems: [listItem({ id: ids.reviewB, priority: "high", source: { title: "High owner", summary: "High.", provenance: "snapshot" } })], page: { limit: 25, returned: 1, scanned: 1, nextCursor: null } } };
    defaultReads += 1;
    return defaultReads === 1 ? firstPage : append.promise;
  };
  const appendView = render(wrap(createElement(Reviews)));
  assert.ok((await appendView.findAllByText(/Default owner/)).length >= 1);
  fireEvent.click(appendView.getByRole("button", { name: "Load more" }));
  fireEvent.change(appendView.getByLabelText("Review priority"), { target: { value: "high" } });
  assert.ok((await appendView.findAllByText(/High owner/)).length >= 1);
  await act(async () => {
    append.resolve({ data: { reviewItems: [listItem({ id: "cccccccccccccccccccccccc", source: { title: "Old appended owner", summary: "Old.", provenance: "snapshot" } })], page: { limit: 25, returned: 1, scanned: 1, nextCursor: null } } });
    await Promise.resolve();
  });
  assert.equal(appendView.queryByText(/Old appended owner/), null);
  assert.equal(appendView.queryByText(/Default owner/), null);
});

test("Review-owned dialog closes on route change without restoring focus into removed UI", async () => {
  const pending = deferred();
  api.get = reviewReads({
    detailById: {
      [ids.review]: detailFor(ids.review, "Review A", ids.issue),
      [ids.reviewB]: detailFor(ids.reviewB, "Review B", ids.issueB, ids.clientB),
    },
  });
  api.post = async () => pending.promise;
  const view = render(reviewRoute());
  const opener = await view.findByRole("button", { name: "Snooze" });
  fireEvent.click(opener);
  const future = new Date(Date.now() + 86_400_000);
  const local = new Date(future.getTime() - future.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  fireEvent.change(view.getByLabelText("Snoozed until"), { target: { value: local } });
  fireEvent.click(within(view.getByRole("dialog")).getByRole("button", { name: "Snooze" }));
  fireEvent.click(view.getByRole("button", { name: "Open Review B" }));
  assert.ok(await view.findByRole("heading", { level: 1, name: "Review B" }));
  assert.equal(view.queryByRole("dialog"), null);
  assert.equal(opener.isConnected, false);
  assert.notEqual(document.activeElement, opener);
  await act(async () => {
    pending.resolve({ status: 201, data: { reviewItem: detailFor(ids.review, "Review A", ids.issue), idempotentReplay: false } });
    await Promise.resolve();
  });
  assert.equal(view.queryByText("Review snoozed."), null);
  assert.ok(view.getByRole("button", { name: "Snooze" }));
});
