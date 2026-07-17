import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

import {
  BID_STRATEGIES,
  EXCLUSION_TYPES,
  TARGETING_DIMENSIONS,
  TRACKING_AREAS,
  buildInterventionMutationPayload,
  canCancelIntervention,
  canCorrectIntervention,
  changeInterventionActionType,
  createInterventionIntentController,
  defaultInterventionForm,
  interventionFieldA11y,
  interventionPayloadDetails,
  mapIntervention,
  reconcileStaleIntervention,
  validateInterventionForm,
} from "../src/utils/interventions.js";
import {
  containModalTab,
  focusModalEntry,
  modalEscapeAllowed,
  restoreModalFocus,
} from "../src/hooks/useModalFocusTrap.js";
import { createCursorHistoryState, cursorHistoryReducer } from "../src/utils/historyState.js";

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
  reason: "Review the retained evidence.",
  ...overrides,
});

const validationOptions = {
  openedAt: "2026-07-17T09:00:00.000Z",
  now: new Date("2026-07-17T10:00:00.000Z"),
};

const detailValue = (overrides = {}) => ({
  id: "intervention-1",
  issueId: "issue-1",
  actionType: "change_targeting",
  actionPayload: { dimension: "placement", summary: "Exclude weak placements" },
  reason: "Placement quality declined.",
  note: "Review again next week.",
  performedAt: "2026-07-17T09:30:00.000Z",
  recordedAt: "2026-07-17T09:35:00.000Z",
  performedByUserId: "aaaaaaaaaaaaaaaaaaaaaaaa",
  performedBy: { displayName: "Asha", provenance: "workspace_member" },
  recordedBy: { displayName: "Ravi", provenance: "workspace_member" },
  status: "active",
  revision: 2,
  permissions: { canCorrect: true, canCancel: true },
  issueSnapshot: {
    title: "Placement quality declined",
    status: "open",
    severity: "critical",
    provenance: "persisted_issue",
  },
  scopeSnapshot: {
    client: { name: "Acme", provenance: "signal_snapshot" },
    metaAccount: { name: "Acme Ads", provenance: "report_run_snapshot" },
    campaign: { name: "Prospecting", provenance: "signal_snapshot" },
    report: { name: "Daily monitor", provenance: "current_parent" },
  },
  latestSignalSnapshot: {
    title: "CTR declined",
    description: "Retained Signal evidence.",
    recommendation: "Review creative and placement fit.",
    provenance: "persisted_signal",
  },
  ...overrides,
});

test("team-member contract uses user_id and excludes inactive, missing, and malformed entries", async () => {
  const { default: api } = await vite.ssrLoadModule("/src/api/axios.js");
  const { getInterventionWorkspaceMembers } = await vite.ssrLoadModule("/src/api/interventions.js");
  const originalGet = api.get;
  api.get = async () => ({
    data: {
      members: [
        { id: "111111111111111111111111", user_id: "aaaaaaaaaaaaaaaaaaaaaaaa", name: "Active member", role: "member", status: "active" },
        { id: "222222222222222222222222", user_id: "bbbbbbbbbbbbbbbbbbbbbbbb", name: "Inactive", role: "member", status: "removed" },
        { id: "333333333333333333333333", name: "Missing user", role: "member", status: "active" },
        { id: "444444444444444444444444", user_id: "not-an-object-id", name: "Malformed", role: "member", status: "active" },
      ],
    },
  });
  try {
    const members = await getInterventionWorkspaceMembers();
    assert.deepEqual(members, [{
      id: "aaaaaaaaaaaaaaaaaaaaaaaa",
      userId: "aaaaaaaaaaaaaaaaaaaaaaaa",
      membershipId: "111111111111111111111111",
      name: "Active member",
      role: "member",
    }]);
    const payload = buildInterventionMutationPayload({
      form: validForm({ performerMode: "workspace_member", memberUserId: members[0].userId }),
      idempotencyKey: "record:1234567890abcdef",
      expectedRevision: 3,
    });
    assert.deepEqual(payload.performedBy, {
      mode: "workspace_member",
      userId: "aaaaaaaaaaaaaaaaaaaaaaaa",
    });
    assert.notEqual(payload.performedBy.userId, members[0].membershipId);
    const membershipIdInjection = validateInterventionForm(
      validForm({
        performerMode: "workspace_member",
        memberUserId: members[0].membershipId,
      }),
      { ...validationOptions, members }
    );
    assert.equal(
      membershipIdInjection.memberUserId,
      "Choose an active workspace member."
    );
  } finally {
    api.get = originalGet;
  }
});

test("correction restores self, selectable workspace, and manual performer context safely", () => {
  const members = [{ id: "aaaaaaaaaaaaaaaaaaaaaaaa", userId: "aaaaaaaaaaaaaaaaaaaaaaaa", name: "Asha" }];
  const workspace = defaultInterventionForm({
    intervention: detailValue(),
    members,
    currentUserId: "cccccccccccccccccccccccc",
  });
  assert.equal(workspace.performerMode, "workspace_member");
  assert.equal(workspace.memberUserId, "aaaaaaaaaaaaaaaaaaaaaaaa");

  const self = defaultInterventionForm({
    intervention: detailValue(),
    members,
    currentUserId: "aaaaaaaaaaaaaaaaaaaaaaaa",
  });
  assert.equal(self.performerMode, "self");

  const manual = defaultInterventionForm({
    intervention: detailValue({
      performedByUserId: null,
      performedBy: { displayName: "External operator", provenance: "manual", email: "private@example.com" },
    }),
  });
  assert.equal(manual.performerMode, "manual");
  assert.equal(manual.manualName, "External operator");
  assert.equal(manual.manualEmail, "");

  const missingMember = defaultInterventionForm({
    intervention: detailValue(),
    members: [{ id: "aaaaaaaaaaaaaaaaaaaaaaaa", name: "Membership ID only" }],
    currentUserId: "cccccccccccccccccccccccc",
  });
  assert.equal(missingMember.performerMode, "self");
});

test("stale authoritative status and permissions remove correction and cancellation eligibility", () => {
  const active = mapIntervention(detailValue());
  assert.equal(canCorrectIntervention(active), true);
  assert.equal(canCancelIntervention(active), true);

  const permissionRemoved = mapIntervention(detailValue({ permissions: { canCorrect: false, canCancel: false }, revision: 3 }));
  assert.equal(canCorrectIntervention(permissionRemoved), false);
  assert.equal(canCancelIntervention(permissionRemoved), false);

  const superseded = mapIntervention(detailValue({ status: "superseded", revision: 3 }));
  const cancelled = mapIntervention(detailValue({ status: "cancelled", revision: 3 }));
  assert.equal(canCorrectIntervention(superseded), false);
  assert.equal(canCancelIntervention(superseded), false);
  assert.equal(canCorrectIntervention(cancelled), false);
  assert.equal(canCancelIntervention(cancelled), false);

  const correctedRefresh = reconcileStaleIntervention({
    intervention: permissionRemoved,
    operation: "correct",
  });
  const cancelledRefresh = reconcileStaleIntervention({
    intervention: cancelled,
    operation: "cancel",
  });
  assert.equal(correctedRefresh.revision, 3);
  assert.equal(correctedRefresh.requiresReview, true);
  assert.equal(correctedRefresh.mutationAllowed, false);
  assert.equal(cancelledRefresh.status, "cancelled");
  assert.equal(cancelledRefresh.requiresReview, true);
  assert.equal(cancelledRefresh.mutationAllowed, false);

  const controller = createInterventionIntentController("correction");
  const staleKey = controller.begin();
  assert.equal(controller.fail().key, staleKey);
  assert.equal(controller.snapshot().pending, false);
});

test("structured action payload families and enum injection follow exact bounded rules", () => {
  const cases = [
    ["increase_budget", { mode: "absolute", amount: 500, currency: "INR" }, ["Budget mode", "Amount", "Currency"]],
    ["add_creative", { summary: "Add testimonial", assetCount: 2 }, ["Change summary", "Asset count"]],
    ["change_targeting", { dimension: "placement", summary: "Change placements" }, ["Targeting dimension", "Change summary"]],
    ["add_exclusion", { exclusionType: "publisher", summary: "Exclude publisher" }, ["Exclusion type", "Change summary"]],
    ["change_bid_strategy", { strategy: "cost_cap", summary: "Set cost cap" }, ["Bid strategy", "Change summary"]],
    ["fix_tracking", { area: "utm", summary: "Repair UTM tags" }, ["Tracking area", "Change summary"]],
    ["landing_page_change", { summary: "Use faster page" }, ["Change summary"]],
    ["other", { label: "Brief sales team", summary: "Share retained context" }, ["Action label", "Change summary"]],
  ];
  for (const [actionType, actionPayload, labels] of cases) {
    assert.deepEqual(
      interventionPayloadDetails({ actionType, actionPayload }).map((row) => row.label),
      labels
    );
  }

  for (const [actionType, field, values] of [
    ["change_targeting", "dimension", TARGETING_DIMENSIONS],
    ["add_exclusion", "exclusionType", EXCLUSION_TYPES],
    ["change_bid_strategy", "strategy", BID_STRATEGIES],
    ["fix_tracking", "area", TRACKING_AREAS],
  ]) {
    for (const value of values) {
      const errors = validateInterventionForm(
        validForm({ actionType, [field]: value, summary: "Bounded summary" }),
        validationOptions
      );
      assert.equal(errors[field], undefined, `${actionType}:${value}`);
    }
    const injected = validateInterventionForm(
      validForm({ actionType, [field]: "injected_value", summary: "Bounded summary" }),
      validationOptions
    );
    assert.ok(injected[field], actionType);
  }

  const changed = changeInterventionActionType(
    validForm({ actionType: "increase_budget", amount: "50", currency: "INR", summary: "stale" }),
    "monitor_only"
  );
  assert.equal(changed.amount, "");
  assert.equal(changed.currency, "");
  assert.equal(changed.summary, "");
});

test("detail evidence renders payload, provenance, lineage, cancellation, and no private fields", async () => {
  const { InterventionDetailEvidence } = await vite.ssrLoadModule(
    "/src/components/issues/InterventionDetailModal.jsx"
  );
  const value = mapIntervention(detailValue({
    status: "cancelled",
    supersedesInterventionId: "previous-private-id",
    supersededByInterventionId: "replacement-private-id",
    correctedAt: "2026-07-17T10:00:00.000Z",
    correctedBy: { displayName: "Owner", provenance: "workspace_member", email: "owner@example.com" },
    cancellation: {
      reason: "Recorded against the wrong scope.",
      cancelledAt: "2026-07-17T10:10:00.000Z",
      cancelledBy: { displayName: "Owner", email: "owner@example.com" },
    },
    requestHash: "secret-request-hash",
    idempotencyKey: "secret-key",
    token: "secret-token",
  }));
  const markup = renderToStaticMarkup(createElement(InterventionDetailEvidence, {
    detail: value,
    onOpenRelated: () => {},
  }));
  assert.match(markup, /Structured action/);
  assert.match(markup, /Targeting dimension/);
  assert.match(markup, /Persisted Issue snapshot/);
  assert.match(markup, /Persisted Signal snapshot/);
  assert.match(markup, /Open previous record/);
  assert.match(markup, /Open replacement record/);
  assert.match(markup, /Recorded against the wrong scope/);
  assert.doesNotMatch(markup, /previous-private-id|replacement-private-id|@example\.com|secret-request-hash|secret-key|secret-token/);
});

test("pagination failure retains records, cursor, and retry deduplicates appended results", async () => {
  let state = createCursorHistoryState("interventions");
  state = cursorHistoryReducer(state, {
    type: "request_succeeded",
    ownerKey: "interventions",
    items: [detailValue({ id: "one" })],
    page: { hasMore: true, nextCursor: "cursor-one" },
  });
  state = cursorHistoryReducer(state, {
    type: "request_failed",
    ownerKey: "interventions",
    append: true,
    error: "Could not load more actions.",
  });
  assert.equal(state.items.length, 1);
  assert.equal(state.nextCursor, "cursor-one");
  assert.equal(state.failedAppend, true);

  const { default: InterventionHistory } = await vite.ssrLoadModule(
    "/src/components/issues/InterventionHistory.jsx"
  );
  const markup = renderToStaticMarkup(createElement(InterventionHistory, {
    state: { ...state, retry: () => {}, loadMore: () => {}, reload: () => {} },
    onOpen: () => {},
  }));
  assert.match(markup, /Placement quality declined/);
  assert.match(markup, /Could not load more actions/);
  assert.match(markup, /Retry load more/);

  state = cursorHistoryReducer(state, {
    type: "request_succeeded",
    ownerKey: "interventions",
    append: true,
    items: [detailValue({ id: "one" }), detailValue({ id: "two" })],
    page: { hasMore: false, nextCursor: null },
  });
  assert.deepEqual(state.items.map((item) => item.id), ["one", "two"]);
});

test("modal keyboard helpers trap focus, restore focus, and block pending Escape", () => {
  const ownerDocument = { activeElement: null };
  const element = (name) => ({
    name,
    focus() { ownerDocument.activeElement = this; },
    getAttribute() { return null; },
  });
  const first = element("first");
  const last = element("last");
  const container = {
    ownerDocument,
    querySelectorAll: () => [first, last],
    contains: (value) => value === first || value === last,
    focus() { ownerDocument.activeElement = this; },
  };
  assert.equal(focusModalEntry({ container, initialFocus: first }), first);
  assert.equal(ownerDocument.activeElement, first);

  ownerDocument.activeElement = last;
  let prevented = false;
  containModalTab({ event: { key: "Tab", shiftKey: false, preventDefault: () => { prevented = true; } }, container });
  assert.equal(prevented, true);
  assert.equal(ownerDocument.activeElement, first);

  ownerDocument.activeElement = first;
  containModalTab({ event: { key: "Tab", shiftKey: true, preventDefault() {} }, container });
  assert.equal(ownerDocument.activeElement, last);

  ownerDocument.activeElement = element("background");
  containModalTab({ event: { key: "Tab", shiftKey: false, preventDefault() {} }, container });
  assert.equal(ownerDocument.activeElement, first);
  assert.equal(modalEscapeAllowed({ key: "Escape", pending: false }), true);
  assert.equal(modalEscapeAllowed({ key: "Escape", pending: true }), false);

  const trigger = element("trigger");
  restoreModalFocus(trigger);
  assert.equal(ownerDocument.activeElement, trigger);
});

test("field errors expose stable aria-invalid and aria-describedby contracts", () => {
  assert.deepEqual(interventionFieldA11y({ amount: "Required" }, "form-1", "amount"), {
    "aria-invalid": true,
    "aria-describedby": "form-1-amount-error",
  });
  assert.deepEqual(interventionFieldA11y({}, "form-1", "amount"), {
    "aria-invalid": undefined,
    "aria-describedby": undefined,
  });
});

test("deterministic intent controllers preserve keys through retries and isolate operations", () => {
  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  const values = ["record-one", "record-two", "correction-one", "cancel-one"];
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: { randomUUID: () => values.shift() },
  });
  try {
    const creation = createInterventionIntentController("record");
    assert.equal(creation.snapshot().key, "record:record-one");
    const networkKey = creation.begin();
    assert.equal(creation.begin(), null);
    assert.equal(creation.fail().key, networkKey);
    const transactionKey = creation.begin();
    assert.equal(transactionKey, networkKey);
    assert.equal(creation.fail().key, networkKey);
    assert.equal(creation.snapshot().key, networkKey);
    assert.equal(creation.complete().key, "record:record-two");

    const correction = createInterventionIntentController("correction");
    const cancellation = createInterventionIntentController("cancel");
    assert.equal(correction.begin(), "correction:correction-one");
    assert.equal(correction.fail().key, "correction:correction-one");
    assert.equal(cancellation.begin(), "cancel:cancel-one");
    assert.equal(cancellation.begin(), null);
    assert.equal(cancellation.fail().key, "cancel:cancel-one");
  } finally {
    if (originalCrypto) Object.defineProperty(globalThis, "crypto", originalCrypto);
    else delete globalThis.crypto;
  }
});

test("duplicate intent submission calls the mocked API once and preserves exact mutation bodies", async () => {
  const { default: api } = await vite.ssrLoadModule("/src/api/axios.js");
  const {
    cancelIntervention,
    correctIntervention,
    createIntervention,
  } = await vite.ssrLoadModule("/src/api/interventions.js");
  const originalPost = api.post;
  const calls = [];
  let releaseCreation;
  api.post = async (url, body) => {
    calls.push({ url, body });
    if (url === "/issues/issue-1/interventions") {
      return new Promise((resolve) => {
        releaseCreation = () => resolve({ data: { intervention: { id: "created" } } });
      });
    }
    return { data: { intervention: { id: "updated" } } };
  };

  const submitWithIntent = async (controller, request) => {
    const key = controller.begin();
    if (!key) return null;
    try {
      const result = await request(key);
      controller.complete();
      return result;
    } catch (error) {
      controller.fail();
      throw error;
    }
  };

  try {
    const creation = createInterventionIntentController("record");
    const creationForm = validForm({
      actionType: "increase_budget",
      mode: "percent",
      amount: "12",
      currency: "INR",
      note: "",
    });
    const first = submitWithIntent(creation, (idempotencyKey) =>
      createIntervention(
        "issue-1",
        buildInterventionMutationPayload({
          form: creationForm,
          idempotencyKey,
          expectedRevision: 7,
        })
      )
    );
    const duplicate = await submitWithIntent(creation, () => {
      throw new Error("Duplicate request should not execute.");
    });
    assert.equal(duplicate, null);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].body.actionPayload, { mode: "percent", amount: 12 });
    assert.equal(calls[0].body.expectedIssueRevision, 7);
    assert.equal("currency" in calls[0].body.actionPayload, false);
    assert.equal("note" in calls[0].body, false);
    releaseCreation();
    await first;

    const correctionForm = validForm({
      actionType: "internal_note",
      reason: "",
      note: "Corrected internal context.",
    });
    const correctionBody = buildInterventionMutationPayload({
      form: correctionForm,
      idempotencyKey: "correction:fixed",
      expectedRevision: 4,
      correction: true,
    });
    await correctIntervention("intervention-1", correctionBody);
    assert.deepEqual(calls[1], {
      url: "/interventions/intervention-1/corrections",
      body: {
        ...correctionBody,
        actionPayload: {},
        expectedRevision: 4,
      },
    });
    assert.equal("reason" in calls[1].body, false);

    const cancellationBody = {
      idempotencyKey: "cancel:fixed",
      expectedRevision: 5,
      reason: "Recorded against the wrong scope.",
    };
    await cancelIntervention("intervention-1", cancellationBody);
    assert.deepEqual(calls[2], {
      url: "/interventions/intervention-1/cancel",
      body: cancellationBody,
    });
  } finally {
    api.post = originalPost;
  }
});
