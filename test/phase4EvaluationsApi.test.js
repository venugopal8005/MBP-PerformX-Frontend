import assert from "node:assert/strict";
import test, { after, afterEach, before } from "node:test";
import { createServer } from "vite";

import { evaluationRequestError } from "../src/utils/evaluations.js";

let vite;
let api;
let getEvaluation;
let getInterventionEvaluations;
let refreshInterventionEvaluation;
let originalGet;
let originalPost;

before(async () => {
  vite = await createServer({
    root: new URL("..", import.meta.url).pathname,
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  ({ default: api } = await vite.ssrLoadModule("/src/api/axios.js"));
  ({ getEvaluation, getInterventionEvaluations, refreshInterventionEvaluation } = await vite.ssrLoadModule("/src/api/evaluations.js"));
  originalGet = api.get;
  originalPost = api.post;
});

afterEach(() => {
  api.get = originalGet;
  api.post = originalPost;
});

after(async () => {
  await vite?.close();
});

test("Evaluation API requests exact intervention history endpoint with cursor and AbortSignal", async () => {
  const controller = new AbortController();
  let request;
  api.get = async (...args) => {
    request = args;
    return { data: { evaluations: [{ id: "one" }], page: { nextCursor: "next", hasMore: true, limit: 7 } } };
  };
  const result = await getInterventionEvaluations("action/id", { cursor: "cursor/value", limit: 7, signal: controller.signal });
  assert.equal(request[0], "/interventions/action%2Fid/evaluations");
  assert.deepEqual(request[1].params, { limit: 7, cursor: "cursor/value" });
  assert.equal(request[1].signal, controller.signal);
  assert.equal(result.items.length, 1);
  assert.equal(result.page.nextCursor, "next");
});

test("Evaluation API requests exact detail endpoint with AbortSignal", async () => {
  const controller = new AbortController();
  let request;
  api.get = async (...args) => {
    request = args;
    return { data: { success: true, evaluation: { id: "one" } } };
  };
  const result = await getEvaluation("evaluation/id", { signal: controller.signal });
  assert.equal(request[0], "/evaluations/evaluation%2Fid");
  assert.equal(request[1].signal, controller.signal);
  assert.equal(result.evaluation.id, "one");
});

test("Evaluation refresh sends the exact bounded body and exposes HTTP status", async () => {
  const controller = new AbortController();
  let request;
  api.post = async (...args) => {
    request = args;
    return { status: 202, data: { success: true, evaluation: { id: "one" } } };
  };
  const result = await refreshInterventionEvaluation("action/id", {
    expectedInterventionRevision: 4,
    idempotencyKey: "evaluation-refresh:stable-key",
  }, { signal: controller.signal });
  assert.equal(request[0], "/interventions/action%2Fid/evaluations/refresh");
  assert.deepEqual(request[1], {
    expectedInterventionRevision: 4,
    idempotencyKey: "evaluation-refresh:stable-key",
  });
  assert.deepEqual(request[2], { signal: controller.signal });
  assert.equal(result.httpStatus, 202);
});

test("Evaluation API uses authenticated Axios and never direct fetch", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => { fetchCalls += 1; throw new Error("unexpected fetch"); };
  api.get = async () => ({ data: { evaluations: [], page: { nextCursor: null, hasMore: false } } });
  try {
    await getInterventionEvaluations("action");
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("controlled Evaluation errors do not expose backend readiness or index details", () => {
  const unavailable = evaluationRequestError({ response: { status: 503, data: { code: "EVALUATION_INDEXES_NOT_READY", message: "phase4_evaluations_secret_index" } } });
  const stale = evaluationRequestError({ response: { status: 409, data: { code: "EVALUATION_INTERVENTION_REVISION_STALE" } } });
  const limited = evaluationRequestError({ response: { status: 429, data: { code: "EVALUATION_REFRESH_RATE_LIMITED" } } });
  assert.equal(unavailable.message, "Evaluation is temporarily unavailable.");
  assert.equal(unavailable.message.includes("index"), false);
  assert.equal(stale.stale, true);
  assert.equal(limited.rateLimited, true);
});
