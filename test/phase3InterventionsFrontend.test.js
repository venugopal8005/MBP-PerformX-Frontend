import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

import {
  INTERVENTION_ACTIONS,
  buildInterventionMutationPayload,
  createInterventionIntentKey,
  defaultInterventionForm,
  interventionError,
  interventionSummary,
  mapIntervention,
  validateInterventionForm,
} from "../src/utils/interventions.js";
import { mapIssue } from "../src/utils/issues.js";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");
let vite;

before(async () => {
  vite = await createServer({
    root: new URL("..", import.meta.url).pathname,
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });
});

after(async () => {
  await vite?.close();
});

const validForm = (overrides = {}) => ({
  ...defaultInterventionForm({ now: new Date("2026-07-17T10:00:00.000Z") }),
  performedAt: "2026-07-17T15:00",
  actionType: "monitor_only",
  reason: "Continue observing the retained evidence.",
  ...overrides,
});

const validationOptions = {
  openedAt: "2026-07-17T09:00:00.000Z",
  now: new Date("2026-07-17T10:00:00.000Z"),
};

const interventionValue = (overrides = {}) => ({
  id: "intervention-1",
  issueId: "issue-1",
  actionType: "decrease_budget",
  actionPayload: { mode: "percent", amount: 10 },
  reason: "Spend efficiency required review.",
  note: "Recorded after the Issue was detected.",
  performedAt: "2026-07-17T09:30:00.000Z",
  recordedAt: "2026-07-17T09:35:00.000Z",
  performedBy: { displayName: "Asha", workspaceRole: "member", provenance: "workspace_member" },
  recordedBy: { displayName: "Ravi", workspaceRole: "owner", provenance: "workspace_member" },
  status: "active",
  revision: 2,
  permissions: { canCorrect: true, canCancel: true },
  ...overrides,
});

test("Phase 3 API uses authenticated endpoints, bodies, and cursor parameters", async () => {
  const { default: api } = await vite.ssrLoadModule("/src/api/axios.js");
  const {
    cancelIntervention,
    correctIntervention,
    createIntervention,
    getIntervention,
    getIssueInterventions,
  } = await vite.ssrLoadModule("/src/api/interventions.js");
  const originalGet = api.get;
  const originalPost = api.post;
  const calls = [];
  api.get = async (...args) => {
    calls.push(["get", ...args]);
    return args[0].endsWith("/interventions")
      ? { data: { interventions: [{ id: "one" }], page: { nextCursor: "next", hasMore: true } } }
      : { data: { intervention: { id: "one" } } };
  };
  api.post = async (...args) => {
    calls.push(["post", ...args]);
    return { data: { success: true, intervention: { id: "one" } } };
  };
  try {
    const body = { idempotencyKey: "record:1234567890abcdef" };
    await createIntervention("issue 1", body);
    const page = await getIssueInterventions("issue 1", { cursor: "cursor 1", limit: 15 });
    await getIntervention("record 1");
    await correctIntervention("record 1", body);
    await cancelIntervention("record 1", body);

    assert.deepEqual(calls[0], ["post", "/issues/issue%201/interventions", body]);
    assert.equal(calls[1][1], "/issues/issue%201/interventions");
    assert.deepEqual(calls[1][2].params, { limit: 15, cursor: "cursor 1" });
    assert.equal(calls[2][1], "/interventions/record%201");
    assert.equal(calls[3][1], "/interventions/record%201/corrections");
    assert.equal(calls[4][1], "/interventions/record%201/cancel");
    assert.deepEqual(page, {
      items: [{ id: "one" }],
      page: { nextCursor: "next", hasMore: true },
    });
  } finally {
    api.get = originalGet;
    api.post = originalPost;
  }
});

test("Phase 3 API preserves backend errors and contains no Meta or webhook path", async () => {
  const { default: api } = await vite.ssrLoadModule("/src/api/axios.js");
  const { createIntervention } = await vite.ssrLoadModule("/src/api/interventions.js");
  const originalPost = api.post;
  const backendError = Object.assign(new Error("request failed"), {
    response: { status: 409, data: { code: "INTERVENTION_ISSUE_STALE" } },
  });
  api.post = async () => { throw backendError; };
  try {
    await assert.rejects(createIntervention("issue-1", {}), (error) => error === backendError);
  } finally {
    api.post = originalPost;
  }
  const apiSource = await source("../src/api/interventions.js");
  assert.doesNotMatch(apiSource, /\/meta|webhook|n8n|fetch\(/i);
});

test("central action taxonomy exposes all 16 backend actions and presentation metadata", () => {
  assert.deepEqual(INTERVENTION_ACTIONS.map((item) => item.value), [
    "pause_campaign", "resume_campaign", "increase_budget", "decrease_budget",
    "replace_creative", "add_creative", "remove_creative", "change_targeting",
    "add_exclusion", "change_bid_strategy", "fix_tracking", "landing_page_change",
    "monitor_only", "no_action", "internal_note", "other",
  ]);
  for (const action of INTERVENTION_ACTIONS) {
    assert.ok(action.label);
    assert.ok(action.description);
    assert.ok(Array.isArray(action.requiredFields));
    assert.ok(Array.isArray(action.optionalFields));
    assert.equal(typeof action.formatSummary, "function");
  }
});

test("strict budget validation rejects empty, zero, negative, non-finite, and excessive percent input", () => {
  for (const amount of ["", "0", "-2", "Infinity", "1e2", " 10", "10 ", "101"]) {
    const errors = validateInterventionForm(
      validForm({ actionType: "increase_budget", mode: "percent", amount }),
      validationOptions
    );
    assert.ok(errors.amount, amount);
  }
  assert.deepEqual(
    validateInterventionForm(
      validForm({ actionType: "increase_budget", mode: "percent", amount: "10" }),
      validationOptions
    ),
    {}
  );
});

test("absolute budgets require currency and submit only exact action fields", () => {
  const invalid = validForm({
    actionType: "decrease_budget",
    mode: "absolute",
    amount: "500",
    currency: "",
  });
  assert.ok(validateInterventionForm(invalid, validationOptions).currency);
  const form = { ...invalid, currency: "inr" };
  assert.deepEqual(validateInterventionForm(form, validationOptions), {});
  const payload = buildInterventionMutationPayload({
    form,
    idempotencyKey: "record:1234567890abcdef",
    expectedRevision: 7,
  });
  assert.deepEqual(payload.actionPayload, { mode: "absolute", amount: 500, currency: "INR" });
  assert.equal(payload.expectedIssueRevision, 7);
  assert.equal("expectedRevision" in payload, false);
});

test("conditional action fields, manual performer, and reason versus note follow the backend contract", () => {
  const creative = validForm({ actionType: "add_creative", summary: "Add a new visual", assetCount: "2" });
  assert.deepEqual(validateInterventionForm(creative, validationOptions), {});
  assert.deepEqual(
    buildInterventionMutationPayload({ form: creative, idempotencyKey: "record:1234567890abcdef", expectedRevision: 1 }).actionPayload,
    { summary: "Add a new visual", assetCount: 2 }
  );

  const manual = validForm({ performerMode: "manual", manualName: "External operator", manualEmail: "PERSON@example.com" });
  const manualPayload = buildInterventionMutationPayload({ form: manual, idempotencyKey: "record:1234567890abcdef", expectedRevision: 1 });
  assert.deepEqual(manualPayload.performedBy, { mode: "manual", displayName: "External operator", email: "person@example.com" });

  const internal = validForm({ actionType: "internal_note", reason: "", note: "Retained internal context." });
  assert.deepEqual(validateInterventionForm(internal, validationOptions), {});
  const internalPayload = buildInterventionMutationPayload({ form: internal, idempotencyKey: "record:1234567890abcdef", expectedRevision: 1 });
  assert.equal("reason" in internalPayload, false);
  assert.equal(internalPayload.note, "Retained internal context.");
});

test("correction payload uses Intervention revision and a replacement action body", () => {
  const form = validForm({ actionType: "change_targeting", dimension: "placement", summary: "Exclude low-context placements" });
  const payload = buildInterventionMutationPayload({
    form,
    idempotencyKey: "correction:1234567890abcdef",
    expectedRevision: 4,
    correction: true,
  });
  assert.equal(payload.expectedRevision, 4);
  assert.equal("expectedIssueRevision" in payload, false);
  assert.deepEqual(payload.actionPayload, { dimension: "placement", summary: "Exclude low-context placements" });
});

test("idempotency keys are bounded per intent and controlled conflicts require explicit reset", async () => {
  const one = createInterventionIntentKey("record");
  const two = createInterventionIntentKey("record");
  assert.notEqual(one, two);
  assert.match(one, /^record:[A-Za-z0-9:_-]+$/);
  const modal = await source("../src/components/issues/InterventionActionModal.jsx");
  const utilities = await source("../src/utils/interventions.js");
  assert.match(modal, /createInterventionIntentController/);
  assert.match(modal, /intentController\.begin\(\)/);
  assert.match(modal, /if \(pending \|\| staleNeedsReview/);
  assert.match(modal, /Start a new submission/);
  assert.match(utilities, /Network error\. Your submission is still available to retry/);
  assert.match(modal, /intentController\.fail\(\)/);
});

test("controlled errors distinguish stale, idempotency, archived, and network behavior", () => {
  assert.equal(interventionError({ response: { data: { code: "INTERVENTION_REVISION_STALE" }, status: 409 } }).stale, true);
  assert.equal(interventionError({ response: { data: { code: "INTERVENTION_IDEMPOTENCY_CONFLICT" }, status: 409 } }).conflict, true);
  assert.match(interventionError({ response: { data: { code: "INTERVENTION_CLIENT_ARCHIVED" }, status: 409 } }).message, /archived/i);
  assert.match(interventionError(new Error("offline")).message, /submission is still available/i);
});

test("Intervention mapper and rendered cards never expose actor email or internal request fields", async () => {
  const mapped = mapIntervention({
    ...interventionValue(),
    idempotencyKey: "secret-key",
    requestHash: "secret-hash",
    performedBy: { displayName: "Asha", email: "actor@example.com", userId: "private-user" },
    recordedBy: { displayName: "Ravi", email: "recorder@example.com" },
  });
  const serialized = JSON.stringify(mapped);
  assert.doesNotMatch(serialized, /@example\.com|secret-key|secret-hash|private-user/);

  const { InterventionHistoryCard } = await vite.ssrLoadModule(
    "/src/components/issues/InterventionHistory.jsx"
  );
  const markup = renderToStaticMarkup(createElement(InterventionHistoryCard, {
    value: interventionValue({ performedBy: { displayName: "Asha", email: "actor@example.com" } }),
    onOpen: () => {},
  }));
  assert.match(markup, /Decrease budget by 10%/);
  assert.match(markup, /View details/);
  assert.doesNotMatch(markup, /actor@example\.com|idempotency|request hash/i);
});

test("active, superseded, and cancelled history preserve correction and cancellation evidence", async () => {
  const { InterventionHistoryCard } = await vite.ssrLoadModule(
    "/src/components/issues/InterventionHistory.jsx"
  );
  const render = (value) => renderToStaticMarkup(createElement(InterventionHistoryCard, { value, onOpen: () => {} }));
  const active = render(interventionValue());
  const superseded = render(interventionValue({ id: "two", status: "superseded", supersededByInterventionId: "three" }));
  const cancelled = render(interventionValue({
    id: "three",
    status: "cancelled",
    cancellation: { reason: "Recorded against the wrong campaign.", cancelledAt: "2026-07-17T10:00:00.000Z", cancelledBy: { displayName: "Owner" } },
  }));
  assert.match(active, />Active</);
  assert.match(superseded, /replacement record was created/i);
  assert.match(cancelled, /Recorded against the wrong campaign/);
  assert.match(cancelled, /By Owner/);
  assert.doesNotMatch(`${active}${superseded}${cancelled}`, /solved|successful|failed|improved the Issue/i);
});

test("Issue mapping retains Phase 3 lifecycle fields needed for safe writes", () => {
  const issue = mapIssue({
    id: "issue-1",
    clientId: "client-1",
    lifecycleRevision: 8,
    latestInterventionId: "intervention-3",
    interventionCount: 3,
    interventionRevision: 3,
  });
  assert.equal(issue.clientId, "client-1");
  assert.equal(issue.lifecycleRevision, 8);
  assert.equal(issue.latestInterventionId, "intervention-3");
  assert.equal(issue.interventionCount, 3);
});

test("Issue detail integrates independent Intervention history and archived read-only controls", async () => {
  const detail = await source("../src/pages/IssueDetail.jsx");
  assert.match(detail, /getIssueInterventions\(issueId, \{ cursor, signal \}\)/);
  assert.match(detail, /resetKey: `issue-interventions:\$\{issueId\}`/);
  assert.match(detail, /Intervention history/);
  assert.match(detail, /Record action/);
  assert.match(detail, /This Client is archived/);
  assert.match(detail, /canRecord/);
  assert.match(detail, /Occurrence history/);
  assert.match(detail, /IssueSignalHistory/);
});

test("detail, correction, and cancellation controls use permissions, revisions, confirmation, and preserved history", async () => {
  const [detail, action] = await Promise.all([
    source("../src/components/issues/InterventionDetailModal.jsx"),
    source("../src/components/issues/InterventionActionModal.jsx"),
  ]);
  assert.match(detail, /canCorrectIntervention\(detail, \{ canWrite \}\)/);
  assert.match(detail, /canCancelIntervention\(detail, \{ canWrite \}\)/);
  assert.match(detail, /expectedRevision: cancelRevision/);
  assert.match(detail, /setCancelRevision\(null\)/);
  assert.match(detail, /Cancellation reason/);
  assert.match(detail, /Confirm cancellation/);
  assert.match(detail, /The action remains in history/);
  assert.match(detail, /createInterventionIntentController\("cancel"\)/);
  assert.match(action, /Create replacement record/);
  assert.match(action, /original remains in history/i);
  assert.match(action, /onStale/);
  assert.match(action, /Review refreshed data/);
});

test("Phase 3 UI is modal, responsive, accessible, route-local, and does not add Meta or sidebar behavior", async () => {
  const files = await Promise.all([
    source("../src/components/issues/InterventionActionModal.jsx"),
    source("../src/components/issues/InterventionDetailModal.jsx"),
    source("../src/components/issues/InterventionHistory.jsx"),
    source("../src/pages/IssueDetail.jsx"),
  ]);
  const combined = files.join("\n");
  assert.match(combined, /role="dialog"/);
  assert.match(combined, /aria-modal="true"/);
  assert.match(combined, /focus-visible:ring/);
  assert.match(combined, /max-h-\[calc\(100vh/);
  assert.match(combined, /sm:grid-cols-2/);
  assert.doesNotMatch(combined, /dangerouslySetInnerHTML|localStorage|sessionStorage|\/meta|webhook|n8n/i);

  const sidebar = await source("../src/components/layout/Sidebar.jsx");
  assert.doesNotMatch(sidebar, /intervention/i);
});

test("history state presentation covers loading, empty, retry, and cursor pagination", async () => {
  const [history, primitives] = await Promise.all([
    source("../src/components/issues/InterventionHistory.jsx"),
    source("../src/components/history/HistoryPrimitives.jsx"),
  ]);
  assert.match(history, /HistoryCollectionState/);
  assert.match(history, /No actions recorded/);
  assert.match(primitives, /Loading historical records/);
  assert.match(primitives, /Try again/);
  assert.match(primitives, /Load more/);
  assert.match(primitives, /End of history/);
});

test("record form exposes review step and correction keeps a complete replacement form", async () => {
  const { default: InterventionActionModal } = await vite.ssrLoadModule(
    "/src/components/issues/InterventionActionModal.jsx"
  );
  const markup = renderToStaticMarkup(createElement(InterventionActionModal, {
    issue: { id: "issue-1", openedAt: "2026-07-01T00:00:00.000Z", lifecycleRevision: 1 },
    members: [{ id: "aaaaaaaaaaaaaaaaaaaaaaaa", userId: "aaaaaaaaaaaaaaaaaaaaaaaa", membershipId: "member-1", name: "Workspace operator" }],
    onClose: () => {},
    onSuccess: () => {},
  }));
  assert.match(markup, /Record action/);
  assert.match(markup, /Review action/);
  assert.match(markup, /Workspace member/);
  assert.match(markup, /Someone else/);
  for (const action of INTERVENTION_ACTIONS) assert.match(markup, new RegExp(action.label));
});

test("human-readable summaries remain observational and do not claim outcomes", () => {
  assert.equal(interventionSummary(interventionValue()), "Decrease budget by 10%.");
  assert.equal(
    interventionSummary(interventionValue({ actionType: "monitor_only", actionPayload: {} })),
    "Monitor only was recorded after this Issue was detected."
  );
});
