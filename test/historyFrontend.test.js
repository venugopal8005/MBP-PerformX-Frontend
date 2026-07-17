import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  artifactAudiencePath,
  artifactRequestKey,
  createHistoryResetKey,
  formatHistoryWeekday,
  getIdentityPresentation,
  mapDeliveryEvidence,
  mergeHistoryRecords,
  reportRunDetailPath,
  shouldApplyArtifactResponse,
} from "../src/utils/history.js";
import {
  createCursorHistoryState,
  createRouteOwnedState,
  cursorHistoryReducer,
  routeOwnedReducer,
  visibleCursorHistoryState,
  visibleRouteOwnedState,
} from "../src/utils/historyState.js";

test("cursor records are deduplicated by stable history ID", () => {
  const merged = mergeHistoryRecords(
    [{ id: "one" }, { _id: "two", value: "first" }],
    [{ id: "two", value: "duplicate" }, { id: "three" }]
  );

  assert.deepEqual(merged, [
    { id: "one" },
    { _id: "two", value: "first" },
    { id: "three" },
  ]);
});

test("history reset keys change with route identity and filters", () => {
  assert.notEqual(
    createHistoryResetKey("client", "client-a", "all"),
    createHistoryResetKey("client", "client-b", "all")
  );
  assert.notEqual(
    createHistoryResetKey("report", "report-a", "signals"),
    createHistoryResetKey("report", "report-a", "runs")
  );
});

test("cursor state becomes empty synchronously when its reset owner changes", () => {
  let state = createCursorHistoryState("client-a");
  state = cursorHistoryReducer(state, {
    type: "request_succeeded",
    ownerKey: "client-a",
    items: [{ id: "a-record" }],
    page: { nextCursor: "cursor-a", hasMore: true },
  });

  const visibleForB = visibleCursorHistoryState(state, "client-b");
  assert.deepEqual(visibleForB.items, []);
  assert.equal(visibleForB.error, "");
  assert.equal(visibleForB.hasMore, false);
  assert.equal(visibleForB.nextCursor, null);
  assert.equal(visibleForB.isLoading, true);
});

test("cursor state ignores late success and error actions from a previous owner", () => {
  let state = cursorHistoryReducer(createCursorHistoryState("client-b"), {
    type: "request_started",
    ownerKey: "client-b",
    append: false,
  });
  const loadingB = state;

  state = cursorHistoryReducer(state, {
    type: "request_succeeded",
    ownerKey: "client-a",
    items: [{ id: "late-a" }],
    page: { hasMore: false },
  });
  assert.deepEqual(state, loadingB);

  state = cursorHistoryReducer(state, {
    type: "request_failed",
    ownerKey: "client-a",
    error: "Late A error",
  });
  assert.deepEqual(state, loadingB);
});

test("cursor success and load more retain the current owner and deduplicate records", () => {
  let state = cursorHistoryReducer(createCursorHistoryState("report-b"), {
    type: "request_succeeded",
    ownerKey: "report-b",
    items: [{ id: "one" }, { id: "two" }],
    page: { nextCursor: "cursor-1", hasMore: true },
  });
  assert.equal(state.isLoading, false);

  state = cursorHistoryReducer(state, {
    type: "request_succeeded",
    ownerKey: "report-b",
    append: true,
    items: [{ id: "two" }, { id: "three" }],
    page: { nextCursor: null, hasMore: false },
  });
  assert.deepEqual(state.items.map((item) => item.id), ["one", "two", "three"]);
  assert.equal(state.hasMore, false);
});

test("route-owned Client, Report, and ReportRun data cannot cross route identities", () => {
  for (const resource of ["client", "report", "report-run"]) {
    const ownerA = `${resource}-a`;
    const ownerB = `${resource}-b`;
    let state = routeOwnedReducer(createRouteOwnedState(ownerA), {
      type: "request_succeeded",
      ownerKey: ownerA,
      data: { id: ownerA },
    });
    state = routeOwnedReducer(state, {
      type: "request_failed",
      ownerKey: ownerA,
      error: `${resource} A failed`,
    });

    const visibleForB = visibleRouteOwnedState(state, ownerB);
    assert.equal(visibleForB.data, null);
    assert.equal(visibleForB.error, "");
    assert.equal(visibleForB.isLoading, true);

    const loadingB = routeOwnedReducer(state, {
      type: "request_started",
      ownerKey: ownerB,
    });
    const staleSuccess = routeOwnedReducer(loadingB, {
      type: "request_succeeded",
      ownerKey: ownerA,
      data: { id: ownerA },
    });
    assert.deepEqual(staleSuccess, loadingB);

    const loadedB = routeOwnedReducer(staleSuccess, {
      type: "request_succeeded",
      ownerKey: ownerB,
      data: { id: ownerB },
    });
    assert.equal(loadedB.data.id, ownerB);
    assert.equal(loadedB.error, "");
    assert.equal(loadedB.isLoading, false);
  }
});

test("route-owned refresh preservation is opt-in and never crosses owners", () => {
  const loadedA = routeOwnedReducer(createRouteOwnedState("issue-a"), {
    type: "request_succeeded",
    ownerKey: "issue-a",
    data: { id: "issue-a", title: "Retained Issue A" },
  });
  const refreshingA = routeOwnedReducer(loadedA, {
    type: "request_started",
    ownerKey: "issue-a",
    preserveData: true,
  });
  assert.equal(refreshingA.data.title, "Retained Issue A");
  assert.equal(refreshingA.isLoading, false);
  assert.equal(refreshingA.isRefreshing, true);

  const failedRefreshA = routeOwnedReducer(refreshingA, {
    type: "request_failed",
    ownerKey: "issue-a",
    preserveData: true,
    error: "Refresh unavailable",
  });
  assert.equal(failedRefreshA.data.title, "Retained Issue A");
  assert.equal(failedRefreshA.error, "");
  assert.equal(failedRefreshA.refreshError, "Refresh unavailable");

  const loadingB = routeOwnedReducer(failedRefreshA, {
    type: "request_started",
    ownerKey: "issue-b",
    preserveData: true,
  });
  assert.equal(loadingB.data, null);
  assert.equal(loadingB.ownerKey, "issue-b");
  assert.equal(loadingB.isLoading, true);
});

test("delivery evidence maps only fields returned by the ReportRun serializer", () => {
  const evidence = mapDeliveryEvidence({
    client: {
      status: "sent",
      sent_at: "2026-07-16T10:00:00.000Z",
      approved_at: "2026-07-16T09:58:00.000Z",
      cancelled_at: null,
      safety: { passed: false, reasons: ["Low trust"], warnings: [] },
    },
    internal: {
      status: "sent",
      sent_at: "2026-07-16T09:55:00.000Z",
      approved_at: null,
      cancelled_at: null,
      safety: null,
    },
  });

  assert.deepEqual(evidence[0], {
    audience: "client",
    available: true,
    status: "sent",
    events: [
      { label: "Sent", timestamp: "2026-07-16T10:00:00.000Z" },
      { label: "Approved", timestamp: "2026-07-16T09:58:00.000Z" },
    ],
    safety: { passed: false, reasons: ["Low trust"], warnings: [] },
  });
  assert.equal(evidence[1].audience, "internal");
  assert.equal(evidence[1].status, "sent");
  assert.equal(evidence[1].events.length, 1);
});

test("numeric weekly schedule values map to readable weekday names", () => {
  assert.equal(formatHistoryWeekday(0), "Sunday");
  assert.equal(formatHistoryWeekday(6), "Saturday");
  assert.equal(formatHistoryWeekday(9), "Day unavailable");
});

test("identity completeness maps only to honest presentation labels", () => {
  assert.equal(getIdentityPresentation("complete").label, "Identity preserved");
  assert.equal(getIdentityPresentation("partial").label, "Identity reconstructed");
  assert.equal(getIdentityPresentation("legacy_unknown").label, "Identity unavailable");
  assert.equal(getIdentityPresentation("unexpected").label, "Identity unavailable");
});

test("artifact audience URL selects one explicit audience", () => {
  assert.equal(
    artifactAudiencePath("run 1", "client"),
    "/report-runs/run%201/artifacts/client"
  );
  assert.equal(
    artifactAudiencePath("run-2", "internal"),
    "/report-runs/run-2/artifacts/internal"
  );
  assert.equal(artifactAudiencePath("run-2", "other"), null);
});

test("active Report history links to detail with the serialized ReportRun ID", () => {
  assert.equal(
    reportRunDetailPath({ id: "run 1", report_id: "report-wrong" }),
    "/report-runs/run%201"
  );
  assert.equal(
    reportRunDetailPath({ _id: "run-2", report_id: "report-wrong" }),
    "/report-runs/run-2"
  );
});

test("active Report history does not create a detail path without a ReportRun ID", () => {
  assert.equal(reportRunDetailPath({ report_id: "report-only" }), null);
  assert.equal(reportRunDetailPath(null), null);
});

test("stale artifact responses cannot replace the current audience", () => {
  const clientRequest = artifactRequestKey("run-1", "client");
  const internalRequest = artifactRequestKey("run-1", "internal");
  assert.equal(shouldApplyArtifactResponse(clientRequest, internalRequest), false);
  assert.equal(shouldApplyArtifactResponse(internalRequest, internalRequest), true);
});

test("archived history routes are configured inside the protected router", async () => {
  const source = await readFile(
    new URL("../src/routes/router.jsx", import.meta.url),
    "utf8"
  );
  for (const route of [
    "/clients/archived",
    "/clients/:clientId/history",
    "/reports/archived",
    "/reports/:reportId/history",
    "/report-runs/:reportRunId",
  ]) {
    assert.equal(source.includes(`path: "${route}"`), true, route);
  }
});

test("artifact preview is sandboxed and never injects HTML into the app DOM", async () => {
  const source = await readFile(
    new URL("../src/components/history/ArtifactPreviewPanel.jsx", import.meta.url),
    "utf8"
  );
  assert.match(source, /sandbox=""/);
  assert.match(source, /referrerPolicy="no-referrer"/);
  assert.doesNotMatch(source, /allow-scripts|allow-same-origin|dangerouslySetInnerHTML/);
  assert.match(source, /getReportArtifact\(reportRunId, audience/);
  assert.doesNotMatch(source, /Promise\.all/);
});

test("operational Report preview no longer reads embedded artifact HTML", async () => {
  const source = await readFile(
    new URL("../src/pages/ReportDetail.jsx", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(source, /client_report\.html|internal_report\.html|previewReport\.html/);
  assert.match(source, /ArtifactPreviewPanel/);
  assert.match(source, /to=\{runDetailPath\}/);
  assert.match(source, /View run details/);
  assert.match(source, /Approve & Send/);
  assert.match(source, /Cancel \/ Hold/);
});

test("unsupported delivery-mode assumptions are absent from affected screens", async () => {
  const [reportDetail, archivedReports] = await Promise.all([
    readFile(new URL("../src/pages/ReportDetail.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/ArchivedReports.jsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(reportDetail, /client_report\??\.delivery_mode/);
  assert.doesNotMatch(archivedReports, /client_delivery_mode/);
});
