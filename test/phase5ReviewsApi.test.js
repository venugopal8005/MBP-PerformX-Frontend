import assert from "node:assert/strict";
import test, { after, afterEach, before } from "node:test";
import { createServer } from "vite";

let vite;
let api;
let reviews;
let originalGet;
let originalPost;

before(async () => {
  vite = await createServer({ root: new URL("..", import.meta.url).pathname, appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
  ({ default: api } = await vite.ssrLoadModule("/src/api/axios.js"));
  reviews = await vite.ssrLoadModule("/src/api/reviews.js");
  originalGet = api.get;
  originalPost = api.post;
});
afterEach(() => { api.get = originalGet; api.post = originalPost; });
after(async () => vite?.close());

test("Review reads use exact authenticated Axios endpoints, opaque cursors, filters, and AbortSignal", async () => {
  const calls = [];
  const signal = new AbortController().signal;
  api.get = async (...args) => { calls.push(args); return { data: { success: true, reviewItems: [], actions: [], timeline: [], summary: {}, clients: [], page: {} } }; };
  await reviews.getReviewItems({ state: "open,acknowledged", type: "issue_review", priority: "high", clientId: "client/id", campaignId: "campaign/id", cursor: "opaque+/=", limit: 7, signal });
  await reviews.getReviewItem("review/id", { signal });
  await reviews.getReviewActions("review/id", { cursor: "17", limit: 9, signal });
  await reviews.getWorkspaceReviewSummary({ cursor: "summary+/=", signal });
  await reviews.getClientReviewSummary("client/id", { cursor: "client-summary", signal });
  await reviews.getIssueTimeline("issue/id", { cursor: "timeline+/=", limit: 11, signal });
  assert.equal(calls[0][0], "/review-items");
  assert.deepEqual(calls[0][1].params, { state: "open,acknowledged", type: "issue_review", priority: "high", clientId: "client/id", campaignId: "campaign/id", cursor: "opaque+/=", limit: 7 });
  assert.equal(calls[1][0], "/review-items/review%2Fid");
  assert.equal(calls[2][0], "/review-items/review%2Fid/actions");
  assert.deepEqual(calls[2][1].params, { cursor: "17", limit: 9 });
  assert.equal(calls[3][0], "/review-items/summary");
  assert.deepEqual(calls[3][1].params, { cursor: "summary+/=" });
  assert.equal(calls[4][0], "/clients/client%2Fid/review-summary");
  assert.equal(calls[5][0], "/issues/issue%2Fid/timeline");
  assert.deepEqual(calls[5][1].params, { cursor: "timeline+/=", limit: 11 });
  calls.forEach((call) => assert.equal(call[1].signal, signal));
});

test("Review mutations preserve exact caller bodies, routes, status, and AbortSignal", async () => {
  const calls = [];
  const signal = new AbortController().signal;
  api.post = async (...args) => { calls.push(args); return { status: calls.length === 1 ? 200 : 201, data: { success: true } }; };
  const acknowledge = { expectedRevision: 2, idempotencyKey: "review:key-00000001" };
  const snooze = { expectedRevision: 3, idempotencyKey: "review:key-00000002", snoozedUntil: "2026-07-20T10:00:00.000Z", note: "Observe later" };
  const interpretation = { expectedRevision: 4, idempotencyKey: "review:key-00000003", decision: "interpretation_recorded", note: "Mixed movement observed." };
  const intervention = { expectedReviewRevision: 5, idempotencyKey: "review:key-00000004", actionType: "monitor_only", actionVersion: 1, actionPayload: {}, performedBy: { mode: "self" }, performedAt: "2026-07-19T10:00:00.000Z", reason: "Additional observation planned." };
  assert.equal((await reviews.acknowledgeReviewItem("id/1", acknowledge, { signal })).httpStatus, 200);
  await reviews.snoozeReviewItem("id/2", snooze, { signal });
  await reviews.interpretReviewItem("id/3", interpretation, { signal });
  await reviews.createReviewIntervention("id/4", intervention, { signal });
  assert.deepEqual(calls.map((call) => call[0]), ["/review-items/id%2F1/acknowledge", "/review-items/id%2F2/snooze", "/review-items/id%2F3/review", "/review-items/id%2F4/interventions"]);
  assert.deepEqual(calls.map((call) => call[1]), [acknowledge, snooze, interpretation, intervention]);
  calls.forEach((call) => assert.equal(call[2].signal, signal));
});

test("Review API never uses direct fetch or creates idempotency keys", async () => {
  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = async () => { fetches += 1; throw new Error("unexpected fetch"); };
  api.get = async () => ({ data: { success: true, reviewItems: [], page: {} } });
  try { await reviews.getReviewItems(); assert.equal(fetches, 0); }
  finally { globalThis.fetch = originalFetch; }
  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../src/api/reviews.js", import.meta.url), "utf8"));
  assert.equal(source.includes("randomUUID"), false);
  assert.equal(source.includes("fetch("), false);
});

