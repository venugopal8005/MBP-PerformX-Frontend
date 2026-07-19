import assert from "node:assert/strict";
import test from "node:test";

import {
  REVIEW_ACTION_TYPES,
  REVIEW_PRIORITIES,
  REVIEW_STATES,
  REVIEW_TYPES,
  ReviewNormalizationError,
  normalizeReviewAction,
  normalizeReviewCompletionStatus,
  normalizeReviewItem,
  normalizeReviewSummary,
  normalizeTimelinePage,
  reviewError,
  reviewLabel,
} from "../src/utils/reviews.js";

const ids = { review: "111111111111111111111111", client: "222222222222222222222222", account: "333333333333333333333333", issue: "444444444444444444444444", action: "555555555555555555555555", evaluation: "666666666666666666666666", intervention: "777777777777777777777777" };
const identity = (id, name) => ({ id, name, provenance: "snapshot" });
const item = (overrides = {}) => ({
  id: ids.review, type: "issue_review", state: "open", priority: "critical", reason: "issue_created", generation: 1,
  client: identity(ids.client, "Acme"), account: { ...identity(ids.account, "Ads"), externalId: "act_1" }, campaign: { id: "campaign-1", name: "Prospecting", provenance: "snapshot" }, issue: { id: ids.issue, title: "CTR movement", provenance: "snapshot" }, source: { title: "CTR movement", summary: "Observed CTR movement.", provenance: "snapshot" }, openedAt: "2026-07-18T10:00:00.000Z", latestEvidenceAt: "2026-07-19T10:00:00.000Z", acknowledgement: null, snooze: null, review: null, permissions: { canAcknowledge: true, canSnooze: true, canReview: false, canRecordIntervention: true }, routes: { issueId: ids.issue, reportId: null, reportRunId: null, interventionId: null, evaluationId: null, previousReviewItemId: null },
  ...overrides,
});
const action = (overrides = {}) => ({ id: ids.action, reviewItemId: ids.review, sequence: 1, actionType: "opened_from_issue", actorType: "system", decisionType: null, actor: null, priorState: "open", resultingState: "open", note: null, signalId: ids.evaluation, interventionId: null, evaluationId: null, occurredAt: "2026-07-18T10:00:00.000Z", recordedAt: "2026-07-18T10:00:01.000Z", ...overrides });
const detail = (overrides = {}) => ({ ...item(), persistedState: "open", effectiveState: "open", effectiveCloseReason: null, isSourceCurrent: true, sourceRevisionSynchronized: true, revision: 0, context: { version: 1, capturedAt: "2026-07-18T10:00:00.000Z", client: identity(ids.client, "Acme"), account: { ...identity(ids.account, "Ads"), externalId: "act_1" }, campaign: { id: "campaign-1", name: "Prospecting", provenance: "snapshot" }, issue: { id: ids.issue, title: "CTR movement", provenance: "snapshot" }, report: null, sourceTitle: "CTR movement", sourceSummary: "Observed movement.", provenance: "snapshot" }, linkedIntervention: null, linkedEvaluation: null, actions: [action()], ...overrides });
const counts = (overrides = {}) => ({ active: 0, actionable: 0, snoozed: 0, critical: 0, high: 0, normal: 0, issueReview: 0, evaluationReview: 0, ...overrides });

test("Review normalizer accepts exact enums, effective state, zero revision, and bounded detail", () => {
  REVIEW_TYPES.forEach((type) => assert.equal(normalizeReviewItem(item({ type })).type, type));
  REVIEW_STATES.forEach((state) => assert.equal(normalizeReviewItem(item({ state })).state, state));
  REVIEW_PRIORITIES.forEach((priority) => assert.equal(normalizeReviewItem(item({ priority })).priority, priority));
  const normalized = normalizeReviewItem(detail(), { detail: true });
  assert.equal(normalized.revision, 0);
  assert.equal(normalized.effectiveState, "open");
  assert.equal(normalized.permissions.canAcknowledge, true);
});

test("malformed IDs, revisions, generations, dates, enums, and non-finite counts fail closed", () => {
  for (const value of [item({ id: "bad" }), item({ generation: 0 }), item({ openedAt: "bad" }), item({ state: "dismissed" }), detail({ revision: -1 })]) assert.throws(() => normalizeReviewItem(value, { detail: Object.hasOwn(value, "revision") }), ReviewNormalizationError);
  for (const value of [-1, Infinity, Number.NaN]) assert.throws(() => normalizeReviewSummary({ asOf: "2026-07-19T00:00:00.000Z", completeness: "complete", counts: counts({ actionable: value }), observedCounts: counts(), scannedCandidates: 0, nextCursor: null }), ReviewNormalizationError);
});

test("complete and partial summaries preserve zero and require opaque continuation only for partial", () => {
  const complete = normalizeReviewSummary({ asOf: "2026-07-19T00:00:00.000Z", completeness: "complete", counts: counts({ actionable: 0 }), observedCounts: counts({ actionable: 0 }), scannedCandidates: 0, nextCursor: null });
  const partial = normalizeReviewSummary({ asOf: "2026-07-19T00:00:00.000Z", completeness: "partial", counts: null, observedCounts: counts({ actionable: 3 }), scannedCandidates: 200, nextCursor: "opaque+/=" });
  assert.equal(complete.counts.actionable, 0);
  assert.equal(partial.counts, null);
  assert.equal(partial.observedCounts.actionable, 3);
  assert.equal(partial.nextCursor, "opaque+/=");
  assert.throws(() => normalizeReviewSummary({ ...partial, completeness: "estimated" }), ReviewNormalizationError);
});

test("ReviewAction accepts every exact action and safely maps system names", () => {
  for (const actionType of REVIEW_ACTION_TYPES) {
    const human = ["acknowledged", "snoozed", "interpretation_recorded", "intervention_recorded"].includes(actionType);
    const normalized = normalizeReviewAction(action({ actionType, actorType: human ? "human" : "system", actor: human ? { displayName: "Asha", workspaceRole: "member", provenance: "snapshot", capturedAt: "2026-07-18T10:00:00.000Z" } : null }));
    assert.equal(normalized.actionType, actionType);
  }
  assert.equal(reviewLabel("closed_account_reassigned").includes("closed_account_reassigned"), false);
  assert.throws(() => normalizeReviewAction(action({ actionType: "assigned" })), ReviewNormalizationError);
});

test("completion and timeline contracts reject malformed values and preserve backend order", () => {
  assert.equal(normalizeReviewCompletionStatus("pending"), "pending");
  assert.throws(() => normalizeReviewCompletionStatus("failed"), ReviewNormalizationError);
  const response = normalizeTimelinePage({ timeline: [{ id: "signals:1", stream: "signals", kind: "signal_detected", sourceId: ids.evaluation, occurredAt: "2026-07-19T10:00:00.000Z", rank: 10, title: "Signal", description: "Observed movement." }, { id: "review:1", stream: "review_actions", kind: "acknowledged", sourceId: ids.action, occurredAt: "2026-07-19T09:00:00.000Z", rank: 40, title: "acknowledged", description: null, actor: { displayName: "Asha", workspaceRole: "member" } }], page: { limit: 20, snapshotAt: "2026-07-19T10:01:00.000Z", nextCursor: "opaque" } });
  assert.deepEqual(response.items.map((entry) => entry.kind), ["signal_detected", "acknowledged"]);
  assert.equal(response.page.hasMore, true);
  const invalidTimeline = (entry) => ({ timeline: [{ ...response.items[0], ...entry }], page: { limit: 20, snapshotAt: "2026-07-19T10:01:00.000Z", nextCursor: null } });
  assert.throws(() => normalizeTimelinePage(invalidTimeline({ kind: "automatic_resolution" })), ReviewNormalizationError);
  assert.throws(() => normalizeTimelinePage(invalidTimeline({ stream: "private_events" })), ReviewNormalizationError);
  assert.throws(() => normalizeTimelinePage(invalidTimeline({ kind: "evaluation_calculated", stream: "evaluations", status: "successful" })), ReviewNormalizationError);
});

test("allowlisting discards actor email, hashes, private origin, rows, HTML, and unrestricted metadata", () => {
  const normalized = normalizeReviewItem(detail({ actorEmail: "secret@example.com", requestHash: "secret", idempotencyKey: "secret", review_origin: { private: true }, rawRows: [{}], html: "secret", metadata: { secret: true } }), { detail: true });
  for (const key of ["actorEmail", "requestHash", "idempotencyKey", "review_origin", "rawRows", "html", "metadata"]) assert.equal(Object.hasOwn(normalized, key), false);
});

test("controlled Review errors never expose backend index or private text", () => {
  const unavailable = reviewError({ response: { status: 503, data: { code: "REVIEW_INDEXES_NOT_READY", message: "phase5_private_index" } } });
  const stale = reviewError({ response: { status: 409, data: { code: "REVIEW_REVISION_STALE" } } });
  assert.equal(unavailable.message, "Review workflow is temporarily unavailable.");
  assert.equal(unavailable.message.includes("index"), false);
  assert.equal(stale.stale, true);
});
