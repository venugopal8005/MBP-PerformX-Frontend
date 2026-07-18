import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { JSDOM } from "jsdom";
import { createElement, useState } from "react";
import { createServer } from "vite";

let vite;
let api;
let EvaluationSection;
let InterventionDetailModal;
let InterventionHistory;
let render;
let cleanup;
let fireEvent;
let waitFor;
let act;
let originalGet;
let originalPost;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
let consoleMessages = [];

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const key of ["window", "document", "navigator", "HTMLElement", "Node", "Event", "KeyboardEvent", "MouseEvent", "MutationObserver", "getComputedStyle"]) {
  Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
}
globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ids = {
  evaluation: "111111111111111111111111",
  previous: "121212121212121212121212",
  intervention: "222222222222222222222222",
  interventionB: "232323232323232323232323",
  issue: "333333333333333333333333",
  client: "444444444444444444444444",
  report: "555555555555555555555555",
  run: "666666666666666666666666",
  agency: "777777777777777777777777",
  account: "888888888888888888888888",
  overlap: "999999999999999999999999",
};

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const snapshot = (values = {}, date = "2026-07-17") => ({
  reportRunId: ids.run,
  window: { start: date, end: date, timezone: "UTC", cadence: "daily" },
  campaignId: "campaign-1",
  campaignName: "Prospecting",
  currency: "USD",
  attributionWindows: ["7d_click"],
  metaBindingRevision: 2,
  provenance: "scheduled_window",
  values: { spend: 120, impressions: 1000, clicks: 20, conversions: 2, conversionValue: 240, ctr: 2, cpc: 6, cpm: 120, cpa: 60, roas: 2, conversionRate: 10, ...values },
  rowCount: 1,
  sourceLevel: "campaign",
  completeness: "complete",
});

const evaluationList = (overrides = {}) => ({
  id: ids.evaluation,
  interventionId: ids.intervention,
  issueId: ids.issue,
  clientId: ids.client,
  reportId: ids.report,
  sourceReportRunId: ids.run,
  sequence: 2,
  actionType: "replace_creative",
  status: "ready",
  effectiveStatus: "ready",
  primaryMetric: "ctr",
  watchedMetrics: ["ctr", "spend"],
  baselineValue: 2,
  followUpValue: 2.5,
  absoluteDelta: 0.5,
  relativeDelta: 0.25,
  observedResult: "improved",
  interpretability: "directional",
  reasonCodes: [],
  calculatedAt: "2026-07-18T10:00:00.000Z",
  ...overrides,
});

const evaluationDetail = (overrides = {}) => ({
  ...evaluationList(),
  agencyId: ids.agency,
  metaAdAccountId: ids.account,
  campaignId: "campaign-1",
  reportIdAtAction: ids.report,
  schemaVersion: 1,
  ruleVersion: 1,
  evidenceVersion: 1,
  normalizationVersion: 1,
  triggerType: "report_run",
  intent: { mode: "auto_resolved", primaryMetric: "ctr", watchedMetrics: ["ctr", "spend"], resolutionSource: "issue_metric_family", ruleVersion: 1 },
  baseline: snapshot(),
  followUp: snapshot({ ctr: 2.5, spend: 125 }, "2026-07-18"),
  metricResults: [
    { metric: "ctr", directionality: "higher_is_better", unit: "percent", baselineValue: 2, followUpValue: 2.5, absoluteDelta: 0.5, relativeDelta: 0.25, minimumEvidenceMet: true, material: true, classification: "improved", reasonCodes: [] },
    { metric: "spend", directionality: "context_only", unit: "currency", baselineValue: 120, followUpValue: 125, absoluteDelta: 5, relativeDelta: 0.0417, minimumEvidenceMet: true, material: false, classification: "context_only", reasonCodes: [] },
  ],
  overlapInterventionIds: [],
  evidenceCompleteness: "complete",
  summary: "CTR increased across the bounded persisted windows. This is an observed association.",
  supersedesEvaluationId: null,
  supersededByEvaluationId: null,
  invalidationContext: null,
  canRefresh: true,
  ...overrides,
});

const intervention = (overrides = {}) => ({
  id: ids.intervention,
  issueId: ids.issue,
  actionType: "replace_creative",
  evaluationIntent: { mode: "auto_resolved", primaryMetric: "ctr", watchedMetrics: ["ctr", "spend"], resolutionSource: "issue_metric_family", ruleVersion: 1 },
  actionPayload: { label: "Creative A", summary: "Updated retained visual" },
  reason: "A creative update was recorded.",
  note: "",
  performedAt: "2026-07-17T09:15:00.000Z",
  recordedAt: "2026-07-17T09:20:00.000Z",
  performedBy: { displayName: "Asha", workspaceRole: "member", provenance: "workspace_member" },
  performedByUserId: "aaaaaaaaaaaaaaaaaaaaaaaa",
  recordedBy: { displayName: "Owner", workspaceRole: "owner", provenance: "workspace_member" },
  status: "active",
  revision: 3,
  permissions: { canCorrect: true, canCancel: true },
  issueSnapshot: { title: "CTR movement", status: "open", severity: "moderate", provenance: "snapshot" },
  scopeSnapshot: { client: { name: "Acme", provenance: "snapshot" }, metaAccount: { name: "Ads", provenance: "snapshot" }, campaign: { name: "Prospecting", provenance: "snapshot" }, report: { name: "Daily", provenance: "snapshot" } },
  latestSignalSnapshot: {},
  ...overrides,
});

const evaluationPage = (items) => ({ data: { evaluations: items, page: { hasMore: false, nextCursor: null, limit: 20 } } });
const historyState = (items) => ({ items, isLoading: false, isLoadingMore: false, isRefreshing: false, isEmpty: items.length === 0, hasMore: false, error: "", failedAppend: false, failedRefresh: false, loadMore() {}, reload() {}, revalidate() {}, retry() {} });

const routeGet = ({ list = [evaluationList()], details = new Map() } = {}) => async (url) => {
  if (url.endsWith("/evaluations") && url.startsWith("/interventions/")) return evaluationPage(list);
  if (url.startsWith("/evaluations/")) {
    const id = url.split("/").at(-1);
    return { data: { evaluation: details.get(id) || evaluationDetail({ id }) } };
  }
  if (url === `/interventions/${ids.intervention}`) return { data: { intervention: intervention() } };
  throw new Error(`Unexpected GET ${url}`);
};

before(async () => {
  ({ render, cleanup, fireEvent, waitFor, act } = await import("@testing-library/react"));
  vite = await createServer({ root: new URL("..", import.meta.url).pathname, appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
  ({ default: api } = await vite.ssrLoadModule("/src/api/axios.js"));
  ({ default: EvaluationSection } = await vite.ssrLoadModule("/src/components/issues/EvaluationSection.jsx"));
  ({ default: InterventionDetailModal } = await vite.ssrLoadModule("/src/components/issues/InterventionDetailModal.jsx"));
  ({ default: InterventionHistory } = await vite.ssrLoadModule("/src/components/issues/InterventionHistory.jsx"));
  originalGet = api.get;
  originalPost = api.post;
});

beforeEach(() => {
  consoleMessages = [];
  console.error = (...args) => consoleMessages.push(`[error] ${args.map(String).join(" ")}`);
  console.warn = (...args) => consoleMessages.push(`[warn] ${args.map(String).join(" ")}`);
  api.get = routeGet();
  api.post = async () => ({ status: 200, data: { success: true, evaluation: evaluationDetail() } });
});

afterEach(() => {
  cleanup();
  api.get = originalGet;
  api.post = originalPost;
  document.body.innerHTML = "";
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  assert.deepEqual(consoleMessages, [], `Phase 4 mounted test emitted console warnings:\n${consoleMessages.join("\n")}`);
});

after(async () => {
  await vite?.close();
  dom.window.close();
});

test("[n-plus-one] twenty Intervention cards make no Evaluation request before detail opens", async () => {
  const interventions = Array.from({ length: 20 }, (_, index) => intervention({
    id: index === 0 ? ids.intervention : (index + 40).toString(16).padStart(24, "0"),
    actionPayload: { label: `Creative ${index + 1}`, summary: `Recorded action ${index + 1}` },
  }));
  const requests = [];
  api.get = async (url, options) => {
    requests.push({ url, options });
    return routeGet()(url, options);
  };
  function Harness() {
    const [selected, setSelected] = useState(null);
    return createElement("div", null,
      createElement(InterventionHistory, { state: historyState(interventions), highlightedId: null, onOpen: setSelected }),
      selected && createElement(InterventionDetailModal, {
        interventionId: selected,
        canWrite: true,
        onClose: () => setSelected(null),
        onCorrect() {},
        onMutation() {},
        onOpenRelated() {},
      })
    );
  }
  const view = render(createElement(Harness));
  assert.equal(view.getAllByRole("article").length, 20);
  assert.equal(requests.length, 0);
  fireEvent.click(view.getAllByRole("button", { name: "View details" })[0]);
  await view.findByText("Observed result available");
  const evaluationRequests = requests.filter(({ url }) => url.includes("/evaluations"));
  assert.deepEqual(evaluationRequests.map(({ url }) => url), [
    `/interventions/${ids.intervention}/evaluations`,
    `/evaluations/${ids.evaluation}`,
  ]);
  assert.equal(evaluationRequests[0].options.params.limit, 20);
});

test("[display] ready Evaluation renders metrics, signed movement, windows, currency, and historical provenance", async () => {
  const view = render(createElement(EvaluationSection, { interventionId: ids.intervention, interventionRevision: 3 }));
  assert.ok(await view.findByText("Observed result available"));
  assert.ok((await view.findAllByText("Improved movement observed")).length >= 1);
  assert.ok(view.getAllByText("CTR").length >= 1);
  assert.ok(view.getByText("+25%"));
  assert.ok(view.getByText("+0.5 percentage points"));
  assert.ok(view.getAllByText(/2026-07-17 to 2026-07-17/).length >= 1);
  assert.ok(view.getByText(/Stored ReportRun evidence only/));
  assert.ok(view.getAllByText(/\$120\.00/).length >= 1);
  assert.ok(view.getByText("Supporting context"));
  assert.equal(view.queryByText("Classification unavailable"), null);
});

test("[display] invalid top-level observed result fails safely without crashing the section", async () => {
  api.get = routeGet({ list: [evaluationList({ observedResult: "not_evaluable" })] });
  const view = render(createElement(EvaluationSection, { interventionId: ids.intervention, interventionRevision: 3 }));
  assert.ok(await view.findByText("Evaluation data is unavailable."));
  assert.ok(view.getByRole("heading", { name: "Evaluation" }));
});

test("[display] count metrics preserve zero and use deterministic count formatting", async () => {
  const value = evaluationDetail({
    primaryMetric: "clicks",
    watchedMetrics: ["clicks"],
    baselineValue: 0,
    followUpValue: 25,
    absoluteDelta: 25,
    relativeDelta: null,
    intent: { mode: "explicit", primaryMetric: "clicks", watchedMetrics: ["clicks"], resolutionSource: "explicit", ruleVersion: 1 },
    baseline: snapshot({ clicks: 0 }),
    followUp: snapshot({ clicks: 25 }, "2026-07-18"),
    metricResults: [{ metric: "clicks", directionality: "higher_is_better", unit: "count", baselineValue: 0, followUpValue: 25, absoluteDelta: 25, relativeDelta: null, minimumEvidenceMet: true, material: true, classification: "improved", reasonCodes: [] }],
  });
  api.get = routeGet({
    list: [evaluationList({ primaryMetric: "clicks", watchedMetrics: ["clicks"], baselineValue: 0, followUpValue: 25, absoluteDelta: 25, relativeDelta: null })],
    details: new Map([[ids.evaluation, value]]),
  });
  const view = render(createElement(EvaluationSection, { interventionId: ids.intervention, interventionRevision: 3 }));
  assert.ok((await view.findAllByText("0")).length >= 1);
  assert.ok(view.getAllByText("25").length >= 1);
});

for (const [status, effectiveStatus, label] of [
  ["insufficient_data", "insufficient_data", "Insufficient evidence"],
  ["not_evaluable", "not_evaluable", "Not evaluable"],
  ["invalidated", "invalidated", "Historical evaluation"],
  ["ready", "superseded", "Earlier evaluation version"],
]) {
  test(`[display] ${effectiveStatus} Evaluation state is rendered neutrally`, async () => {
    const item = evaluationList({ status, effectiveStatus, observedResult: status === "ready" ? "no_material_change" : null });
    api.get = routeGet({ list: [item], details: new Map([[item.id, evaluationDetail({ ...item, status, effectiveStatus })]]) });
    const view = render(createElement(EvaluationSection, { interventionId: ids.intervention, interventionRevision: 3 }));
    assert.ok(await view.findByText(label));
  });
}

for (const [observedResult, label] of [
  ["improved", "Improved movement observed"],
  ["worsened", "Worsened movement observed"],
  ["no_material_change", "No material change"],
  ["mixed", "Mixed movement"],
]) {
  test(`[display] ${observedResult} movement label describes observed metrics`, async () => {
    const item = evaluationList({ observedResult });
    api.get = routeGet({ list: [item], details: new Map([[item.id, evaluationDetail({ observedResult })]]) });
    const view = render(createElement(EvaluationSection, { interventionId: ids.intervention, interventionRevision: 3 }));
    assert.ok((await view.findAllByText(label)).length >= 1);
  });
}

test("[display] overlap, zero baseline, reason fallback, and invalidation remain bounded", async () => {
  const value = evaluationDetail({
    status: "invalidated",
    effectiveStatus: "invalidated",
    observedResult: null,
    overlapInterventionIds: [ids.overlap],
    reasonCodes: ["overlapping_intervention", "zero_baseline", "private_reason"],
    invalidationContext: { reason: "intervention_cancelled", invalidatedAt: "2026-07-18T11:00:00.000Z", sourceInterventionId: ids.intervention },
  });
  api.get = routeGet({ list: [evaluationList({ status: "invalidated", effectiveStatus: "invalidated", observedResult: null })], details: new Map([[ids.evaluation, value]]) });
  const view = render(createElement(EvaluationSection, { interventionId: ids.intervention, interventionRevision: 3 }));
  assert.ok((await view.findAllByText(/comparison is not isolated/)).length >= 1);
  assert.ok(view.getByText(/baseline is zero/));
  assert.ok(view.getByText("Additional persisted evidence context is unavailable."));
  assert.ok(view.getByText("Historical invalidation"));
});

test("[display] immutable previous Evaluation versions remain accessible by Evaluation ID", async () => {
  const latest = evaluationList();
  const previous = evaluationList({ id: ids.previous, sequence: 1, status: "ready", effectiveStatus: "superseded", summary: "Older" });
  const details = new Map([
    [latest.id, evaluationDetail()],
    [previous.id, evaluationDetail({ ...previous, id: ids.previous, sequence: 1, effectiveStatus: "superseded", summary: "Earlier persisted comparison." })],
  ]);
  api.get = routeGet({ list: [latest, previous], details });
  const view = render(createElement(EvaluationSection, { interventionId: ids.intervention, interventionRevision: 3 }));
  await view.findByText("Version 2");
  fireEvent.click(view.getByRole("button", { name: /Version 1/ }));
  assert.ok(await view.findByText("Earlier persisted comparison."));
});

test("[refresh] canRefresh false hides persisted refresh control", async () => {
  api.get = routeGet({ details: new Map([[ids.evaluation, evaluationDetail({ canRefresh: false })]]) });
  const view = render(createElement(EvaluationSection, { interventionId: ids.intervention, interventionRevision: 3 }));
  await view.findByText("Observed result available");
  assert.equal(view.queryByRole("button", { name: "Refresh evaluation" }), null);
});

test("[refresh] network retry preserves one key, double-click is bounded, and a new intent rotates the key", async () => {
  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  const keys = ["refresh-one", "refresh-two"];
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: { randomUUID: () => keys.shift() } });
  const first = deferred();
  const posts = [];
  api.post = async (url, body) => {
    posts.push({ url, body });
    if (posts.length === 1) return first.promise;
    return { status: 200, data: { evaluation: evaluationDetail() } };
  };
  try {
    const view = render(createElement(EvaluationSection, { interventionId: ids.intervention, interventionRevision: 3 }));
    const button = await view.findByRole("button", { name: "Refresh evaluation" });
    fireEvent.click(button);
    fireEvent.click(button);
    assert.equal(posts.length, 1);
    await act(async () => first.reject(new Error("offline")));
    const retry = await view.findByRole("button", { name: "Retry persisted refresh" });
    fireEvent.click(retry);
    await waitFor(() => assert.equal(posts.length, 2));
    assert.equal(posts[0].body.expectedInterventionRevision, 3);
    assert.equal(posts[0].body.idempotencyKey, "evaluation-refresh:refresh-one");
    assert.equal(posts[1].body.idempotencyKey, posts[0].body.idempotencyKey);
    fireEvent.click(await view.findByRole("button", { name: "Refresh evaluation" }));
    await waitFor(() => assert.equal(posts.length, 3));
    assert.equal(posts[2].body.idempotencyKey, "evaluation-refresh:refresh-two");
  } finally {
    if (originalCrypto) Object.defineProperty(globalThis, "crypto", originalCrypto);
    else delete globalThis.crypto;
  }
});

for (const [httpStatus, message] of [
  [200, "The current persisted evaluation is shown."],
  [201, "A new immutable evaluation version was recorded."],
  [202, "Awaiting persisted follow-up evidence. No Report was started."],
]) {
  test(`[refresh] HTTP ${httpStatus} refresh response is handled without live execution`, async () => {
    api.post = async () => ({ status: httpStatus, data: { evaluation: evaluationDetail({ status: httpStatus === 202 ? "awaiting_follow_up" : "ready", effectiveStatus: httpStatus === 202 ? "awaiting_follow_up" : "ready" }) } });
    const view = render(createElement(EvaluationSection, { interventionId: ids.intervention, interventionRevision: 3 }));
    fireEvent.click(await view.findByRole("button", { name: "Refresh evaluation" }));
    assert.ok(await view.findByText(message));
  });
}

test("[refresh] stale revision fails closed and requires explicit action-detail reload", async () => {
  let reloads = 0;
  let posts = 0;
  api.post = async () => {
    posts += 1;
    throw { response: { status: 409, data: { code: "EVALUATION_INTERVENTION_REVISION_STALE" } } };
  };
  const view = render(createElement(EvaluationSection, { interventionId: ids.intervention, interventionRevision: 3, onInterventionReload: () => { reloads += 1; } }));
  fireEvent.click(await view.findByRole("button", { name: "Refresh evaluation" }));
  const reload = await view.findByRole("button", { name: "Reload action details" });
  assert.equal(view.queryByRole("button", { name: /Refresh evaluation|Retry persisted refresh/ }), null);
  assert.equal(posts, 1);
  fireEvent.click(reload);
  assert.equal(reloads, 1);
  assert.equal(posts, 1);
});

for (const [status, expected] of [[429, /requested recently/], [503, /temporarily unavailable/]]) {
  test(`[refresh] HTTP ${status} produces a controlled message without automatic retry`, async () => {
    let posts = 0;
    api.post = async () => { posts += 1; throw { response: { status, data: { code: status === 429 ? "EVALUATION_REFRESH_RATE_LIMITED" : "EVALUATION_INDEXES_NOT_READY", message: "private index" } } }; };
    const view = render(createElement(EvaluationSection, { interventionId: ids.intervention, interventionRevision: 3 }));
    fireEvent.click(await view.findByRole("button", { name: "Refresh evaluation" }));
    assert.ok(await view.findByText(expected));
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(posts, 1);
    assert.equal(view.queryByText(/private index/), null);
  });
}

test("[race] Intervention owner change aborts old history and ignores its late response", async () => {
  const first = deferred();
  api.get = async (url) => {
    if (url === `/interventions/${ids.intervention}/evaluations`) return first.promise;
    if (url === `/interventions/${ids.interventionB}/evaluations`) return evaluationPage([evaluationList({ id: ids.previous, interventionId: ids.interventionB, sequence: 1 })]);
    if (url === `/evaluations/${ids.previous}`) return { data: { evaluation: evaluationDetail({ id: ids.previous, interventionId: ids.interventionB, sequence: 1, summary: "Current owner B evidence." }) } };
    throw new Error(`Unexpected GET ${url}`);
  };
  const view = render(createElement(EvaluationSection, { interventionId: ids.intervention, interventionRevision: 3 }));
  view.rerender(createElement(EvaluationSection, { interventionId: ids.interventionB, interventionRevision: 1 }));
  assert.ok(await view.findByText("Current owner B evidence."));
  await act(async () => first.resolve(evaluationPage([evaluationList({ summary: "Late owner A evidence" })])));
  assert.equal(view.queryByText("Late owner A evidence"), null);
});

test("[owner-transition] loaded owner detail and refresh authority are hidden synchronously after owner change", async () => {
  const ownerBHistory = deferred();
  api.get = async (url) => {
    if (url === `/interventions/${ids.intervention}/evaluations`) return evaluationPage([evaluationList()]);
    if (url === `/evaluations/${ids.evaluation}`) return { data: { evaluation: evaluationDetail({ summary: "Owner A persisted detail." }) } };
    if (url === `/interventions/${ids.interventionB}/evaluations`) return ownerBHistory.promise;
    if (url === `/evaluations/${ids.previous}`) return { data: { evaluation: evaluationDetail({ id: ids.previous, interventionId: ids.interventionB, sequence: 1, summary: "Owner B persisted detail." }) } };
    throw new Error(`Unexpected GET ${url}`);
  };
  const view = render(createElement(EvaluationSection, { interventionId: ids.intervention, interventionRevision: 3 }));
  assert.ok(await view.findByText("Owner A persisted detail."));
  assert.ok(view.getByRole("button", { name: "Refresh evaluation" }));

  view.rerender(createElement(EvaluationSection, { interventionId: ids.interventionB, interventionRevision: 1 }));
  assert.equal(view.queryByText("Owner A persisted detail."), null);
  assert.equal(view.queryByRole("button", { name: "Refresh evaluation" }), null);

  await act(async () => ownerBHistory.resolve(evaluationPage([evaluationList({ id: ids.previous, interventionId: ids.interventionB, sequence: 1 })])));
  assert.ok(await view.findByText("Owner B persisted detail."));
  assert.equal(view.queryByText("Owner A persisted detail."), null);
});

test("[race] unmount during initial Evaluation history load is silent", async () => {
  const pendingHistory = deferred();
  api.get = (url) => {
    if (url === `/interventions/${ids.intervention}/evaluations`) return pendingHistory.promise;
    throw new Error(`Unexpected GET ${url}`);
  };
  const view = render(createElement(EvaluationSection, { interventionId: ids.intervention, interventionRevision: 3 }));
  view.unmount();
  await act(async () => pendingHistory.resolve(evaluationPage([evaluationList()])));
  assert.deepEqual(consoleMessages, []);
});

test("[race] unmount during Evaluation detail load is silent", async () => {
  const pendingDetail = deferred();
  api.get = (url) => {
    if (url === `/interventions/${ids.intervention}/evaluations`) return evaluationPage([evaluationList()]);
    if (url === `/evaluations/${ids.evaluation}`) return pendingDetail.promise;
    throw new Error(`Unexpected GET ${url}`);
  };
  const view = render(createElement(EvaluationSection, { interventionId: ids.intervention, interventionRevision: 3 }));
  await view.findByRole("button", { name: /Version 2/ });
  view.unmount();
  await act(async () => pendingDetail.resolve({ data: { evaluation: evaluationDetail({ summary: "Late unmounted detail." }) } }));
  assert.deepEqual(consoleMessages, []);
});

test("[race] old Evaluation detail cannot overwrite a newly selected version", async () => {
  const oldDetail = deferred();
  const latest = evaluationList();
  const previous = evaluationList({ id: ids.previous, sequence: 1, effectiveStatus: "superseded" });
  api.get = async (url) => {
    if (url === `/interventions/${ids.intervention}/evaluations`) return evaluationPage([latest, previous]);
    if (url === `/evaluations/${ids.evaluation}`) return oldDetail.promise;
    if (url === `/evaluations/${ids.previous}`) {
      return { data: { evaluation: evaluationDetail({ ...previous, id: ids.previous, sequence: 1, effectiveStatus: "superseded", summary: "Selected immutable version." }) } };
    }
    throw new Error(`Unexpected GET ${url}`);
  };
  const view = render(createElement(EvaluationSection, { interventionId: ids.intervention, interventionRevision: 3 }));
  fireEvent.click(await view.findByRole("button", { name: /Version 1/ }));
  assert.ok(await view.findByText("Selected immutable version."));
  await act(async () => oldDetail.resolve({ data: { evaluation: evaluationDetail({ summary: "Late unselected version." }) } }));
  assert.equal(view.queryByText("Late unselected version."), null);
});

test("[race] owner change fences out-of-order refresh responses and latest owner wins", async () => {
  const refreshA = deferred();
  const refreshB = deferred();
  api.get = async (url) => {
    if (url === `/interventions/${ids.intervention}/evaluations`) return evaluationPage([evaluationList()]);
    if (url === `/evaluations/${ids.evaluation}`) return { data: { evaluation: evaluationDetail({ summary: "Owner A initial." }) } };
    if (url === `/interventions/${ids.interventionB}/evaluations`) return evaluationPage([evaluationList({ id: ids.previous, interventionId: ids.interventionB, sequence: 1 })]);
    if (url === `/evaluations/${ids.previous}`) return { data: { evaluation: evaluationDetail({ id: ids.previous, interventionId: ids.interventionB, sequence: 1, summary: "Owner B initial." }) } };
    throw new Error(`Unexpected GET ${url}`);
  };
  api.post = (url) => url.includes(ids.interventionB) ? refreshB.promise : refreshA.promise;
  const view = render(createElement(EvaluationSection, { interventionId: ids.intervention, interventionRevision: 3 }));
  fireEvent.click(await view.findByRole("button", { name: "Refresh evaluation" }));
  view.rerender(createElement(EvaluationSection, { interventionId: ids.interventionB, interventionRevision: 1 }));
  await view.findByText("Owner B initial.");
  fireEvent.click(await view.findByRole("button", { name: "Refresh evaluation" }));
  await act(async () => refreshB.resolve({ status: 200, data: { evaluation: evaluationDetail({ id: ids.previous, interventionId: ids.interventionB, sequence: 2, summary: "Owner B latest response." }) } }));
  assert.ok(await view.findByText("Owner B latest response."));
  await act(async () => refreshA.resolve({ status: 200, data: { evaluation: evaluationDetail({ summary: "Owner A late response." }) } }));
  assert.equal(view.queryByText("Owner A late response."), null);
  assert.ok(view.getByText("Owner B latest response."));
});

test("[stale-navigation] stale 409 from owner A is ignored after navigating to owner B", async () => {
  const staleA = deferred();
  let reloads = 0;
  api.get = async (url) => {
    if (url === `/interventions/${ids.intervention}/evaluations`) return evaluationPage([evaluationList()]);
    if (url === `/evaluations/${ids.evaluation}`) return { data: { evaluation: evaluationDetail({ summary: "Owner A before navigation." }) } };
    if (url === `/interventions/${ids.interventionB}/evaluations`) return evaluationPage([evaluationList({ id: ids.previous, interventionId: ids.interventionB, sequence: 1 })]);
    if (url === `/evaluations/${ids.previous}`) return { data: { evaluation: evaluationDetail({ id: ids.previous, interventionId: ids.interventionB, sequence: 1, summary: "Owner B after navigation." }) } };
    throw new Error(`Unexpected GET ${url}`);
  };
  api.post = () => staleA.promise;
  const view = render(createElement(EvaluationSection, {
    interventionId: ids.intervention,
    interventionRevision: 3,
    onInterventionReload: () => { reloads += 1; },
  }));
  fireEvent.click(await view.findByRole("button", { name: "Refresh evaluation" }));
  view.rerender(createElement(EvaluationSection, {
    interventionId: ids.interventionB,
    interventionRevision: 1,
    onInterventionReload: () => { reloads += 1; },
  }));
  assert.ok(await view.findByText("Owner B after navigation."));
  await act(async () => staleA.reject({ response: { status: 409, data: { code: "EVALUATION_INTERVENTION_REVISION_STALE" } } }));
  assert.equal(view.queryByText(/action record changed/i), null);
  assert.equal(view.queryByRole("button", { name: "Reload action details" }), null);
  assert.equal(reloads, 0);
  assert.ok(view.getByText("Owner B after navigation."));
});

test("[refresh] visible Evaluation history remains while post-refresh revalidation is pending", async () => {
  const revalidation = deferred();
  let listRequests = 0;
  api.get = async (url) => {
    if (url === `/interventions/${ids.intervention}/evaluations`) {
      listRequests += 1;
      return listRequests === 1 ? evaluationPage([evaluationList()]) : revalidation.promise;
    }
    if (url === `/evaluations/${ids.evaluation}`) return { data: { evaluation: evaluationDetail() } };
    throw new Error(`Unexpected GET ${url}`);
  };
  const view = render(createElement(EvaluationSection, { interventionId: ids.intervention, interventionRevision: 3 }));
  fireEvent.click(await view.findByRole("button", { name: "Refresh evaluation" }));
  await view.findByText("The current persisted evaluation is shown.");
  assert.ok(view.getByRole("button", { name: /Version 2/ }));
  await act(async () => revalidation.resolve(evaluationPage([evaluationList()])));
  assert.ok(view.getByRole("button", { name: /Version 2/ }));
});

test("[race] unmount during refresh aborts continuation and calls no pending callback after resolution", async () => {
  const pending = deferred();
  api.post = () => pending.promise;
  const pendingStates = [];
  const view = render(createElement(EvaluationSection, { interventionId: ids.intervention, interventionRevision: 3, onPendingChange: (value) => pendingStates.push(value) }));
  fireEvent.click(await view.findByRole("button", { name: "Refresh evaluation" }));
  view.unmount();
  await act(async () => pending.resolve({ status: 200, data: { evaluation: evaluationDetail() } }));
  assert.deepEqual(pendingStates, [true]);
});

test("[accessibility] outer detail modal traps pending Evaluation refresh, then Escape closes and restores focus", async () => {
  const pending = deferred();
  api.get = routeGet();
  api.post = () => pending.promise;
  function Harness() {
    const [open, setOpen] = useState(false);
    return createElement("div", null,
      createElement("button", { type: "button", onClick: () => setOpen(true) }, "Open action detail"),
      open && createElement(InterventionDetailModal, { interventionId: ids.intervention, canWrite: true, onClose: () => setOpen(false), onCorrect() {}, onMutation() {}, onOpenRelated() {} })
    );
  }
  const view = render(createElement(Harness));
  const trigger = view.getByRole("button", { name: "Open action detail" });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = await view.findByRole("dialog");
  const close = await view.findByRole("button", { name: "Close action details" });
  await waitFor(() => assert.equal(document.activeElement, close));
  fireEvent.click(await view.findByRole("button", { name: "Refresh evaluation" }));
  assert.equal(close.disabled, true);
  fireEvent.keyDown(document, { key: "Escape" });
  assert.ok(view.getByRole("dialog"));
  await act(async () => pending.resolve({ status: 200, data: { evaluation: evaluationDetail() } }));
  await waitFor(() => assert.equal(close.disabled, false));
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => assert.equal(view.queryByRole("dialog"), null));
  assert.equal(document.activeElement, trigger);
  assert.ok(dialog.getAttribute("aria-modal"));
});
