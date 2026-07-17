import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

import {
  buildIssueQueryParams,
  issueDetailPath,
  issueEvidenceSummary,
  issueIdentityLabel,
  issueRequestError,
  issueScopeLabel,
  issueSeverityVariant,
  issueStatusVariant,
  mapIssue,
  mapIssueSignal,
} from "../src/utils/issues.js";
import {
  createCursorHistoryState,
  cursorHistoryReducer,
} from "../src/utils/historyState.js";

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

const renderIssueListItem = async (value) => {
  const { IssueListItem } = await vite.ssrLoadModule(
    "/src/components/issues/IssueListSection.jsx"
  );
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ["/clients/client-1"] },
      createElement(IssueListItem, { value })
    )
  );
};

const renderSignalHistory = async (value) => {
  const { default: IssueSignalHistory } = await vite.ssrLoadModule(
    "/src/components/issues/IssueSignalHistory.jsx"
  );
  return renderToStaticMarkup(
    createElement(IssueSignalHistory, {
      state: {
        items: [value],
        isLoading: false,
        isLoadingMore: false,
        isEmpty: false,
        error: "",
        hasMore: false,
      },
    })
  );
};

const serializedIssue = {
  id: "issue-1",
  status: "monitoring",
  severity: "stable",
  previousSeverity: "moderate",
  trend: "improving",
  title: "Critical words do not override stored severity",
  summary: "Grouped performance evidence.",
  archetype: "ctr_decline",
  metricFamily: "ctr",
  occurrenceCount: 4,
  absenceStreak: 1,
  openedAt: "2026-07-01T10:00:00.000Z",
  lastSeenAt: "2026-07-16T10:00:00.000Z",
  resolvedAt: null,
  identity: {
    client: { value: "Acme", provenance: "snapshot" },
    report: { value: "Daily Monitor", provenance: "snapshot" },
    metaAccount: { value: "Acme Ads", provenance: "current_parent" },
    campaign: { id: "campaign-raw", value: "Prospecting", provenance: "snapshot" },
  },
  latestEvidence: {
    kind: "signal",
    observedAt: "2026-07-16T10:00:00.000Z",
    severity: "stable",
    title: "CTR recovered",
    summary: "CTR improved in the latest retained window.",
    primaryMetric: "ctr",
    delta: 12.4,
    provenance: "snapshot",
  },
};

test("Issue query parameters include supported filters and cursor", () => {
  assert.deepEqual(
    buildIssueQueryParams({
      clientId: "client 1",
      reportId: "report-1",
      metaAdAccountId: "account-1",
      status: "open",
      severity: "critical",
      cursor: "cursor value",
      limit: 15,
    }),
    {
      clientId: "client 1",
      reportId: "report-1",
      metaAdAccountId: "account-1",
      status: "open",
      severity: "critical",
      cursor: "cursor value",
      limit: 15,
    }
  );
});

test("Issue query parameters omit null, undefined, and empty filters", () => {
  assert.deepEqual(
    buildIssueQueryParams({ clientId: null, reportId: undefined, status: "", limit: 20 }),
    { limit: 20 }
  );
});

test("Issue API failures map to controlled non-disclosing messages", () => {
  assert.equal(issueRequestError({ response: { status: 404 } }, "Fallback"), "Issue not found.");
  assert.equal(
    issueRequestError({ response: { status: 403, data: { stack: "secret" } } }, "Fallback"),
    "This Issue is not available in this workspace."
  );
  assert.equal(issueRequestError({ response: { status: 500 } }, "Fallback"), "Fallback");
});

test("Issue mapper uses explicit backend severity without title heuristics", () => {
  const issue = mapIssue(serializedIssue);
  assert.equal(issue.severity, "stable");
  assert.equal(issue.previousSeverity, "moderate");
  assert.equal(issue.trend, "improving");
  assert.equal(issueSeverityVariant(issue.severity), "high");
});

test("unknown Issue values remain neutral instead of becoming stable or resolved", () => {
  const issue = mapIssue({ title: "Everything is critical" });
  assert.equal(issue.status, null);
  assert.equal(issue.severity, null);
  assert.equal(issue.trend, null);
  assert.equal(issueSeverityVariant(issue.severity), "low");
  assert.equal(issueStatusVariant(issue.status), "low");
  assert.equal(issueStatusVariant("resolved"), "low");
});

test("Issue identity and evidence use controlled contract fallbacks", () => {
  const issue = mapIssue({ identity: {}, latestEvidence: {} });
  assert.equal(issueScopeLabel(issue), "Unknown campaign");
  assert.equal(issueIdentityLabel(issue.identity.client), "Identity unavailable");
  assert.equal(issueEvidenceSummary(issue), "Evidence unavailable");
});

test("Issue detail mapping retains recurrence without exposing predecessor ID", () => {
  const issue = mapIssue({
    ...serializedIssue,
    reopenCount: 2,
    predecessorIssueId: "do-not-display-this-id",
    scope: { entity: { level: "campaign" }, comparison: { cadence: "daily" } },
  });
  assert.equal(issue.reopenCount, 2);
  assert.equal(issue.hasPredecessor, true);
  assert.equal(issue.scope.entityLevel, "campaign");
  assert.equal("predecessorIssueId" in issue, false);
});

test("Issue list recurrence indicator renders only for a positive persisted reopen count", async () => {
  const reopened = await renderIssueListItem({ ...serializedIssue, reopenCount: 2 });
  const neverReopened = await renderIssueListItem({ ...serializedIssue, reopenCount: 0 });
  const unavailable = await renderIssueListItem(serializedIssue);

  assert.match(reopened, /Reopened 2 times/);
  assert.doesNotMatch(neverReopened, /Reopened/);
  assert.doesNotMatch(unavailable, /Reopened/);
});

test("Issue route navigation uses only the serialized Issue ID", () => {
  assert.equal(issueDetailPath({ id: "issue 1", reportId: "wrong-report" }), "/issues/issue%201");
  assert.equal(issueDetailPath({ reportId: "wrong-report" }), null);
});

test("linked Signal mapping contains only safe occurrence presentation fields", () => {
  const signal = mapIssueSignal({
    id: "signal-1",
    issueId: "issue-1",
    reportId: "report-1",
    reportRunId: "run-1",
    occurrenceNumber: 3,
    severity: "critical",
    title: "CTR declined",
    recommendation: "Review creative",
    detectedAt: "2026-07-16T10:00:00.000Z",
  });
  assert.equal(signal.occurrenceNumber, 3);
  assert.equal(signal.severity, "critical");
  assert.equal("reportId" in signal, false);
  assert.equal("reportRunId" in signal, false);
  assert.equal("issueId" in signal, false);
});

test("Signal occurrence number renders only when the backend supplies a positive number", async () => {
  const occurrence = await renderSignalHistory({
    id: "signal-3",
    occurrenceNumber: 3,
    severity: "moderate",
    title: "CTR declined",
  });
  const nullOccurrence = await renderSignalHistory({
    id: "signal-null",
    occurrenceNumber: null,
    title: "No occurrence number",
  });
  const missingOccurrence = await renderSignalHistory({
    id: "signal-missing",
    title: "Missing occurrence number",
  });
  const zeroOccurrence = await renderSignalHistory({
    id: "signal-zero",
    occurrenceNumber: 0,
    title: "Invalid zero occurrence",
  });

  assert.match(occurrence, /Occurrence 3/);
  assert.doesNotMatch(nullOccurrence, /Occurrence/);
  assert.doesNotMatch(missingOccurrence, /Occurrence/);
  assert.doesNotMatch(zeroOccurrence, /Occurrence/);
  assert.doesNotMatch(
    `${occurrence}${nullOccurrence}${missingOccurrence}${zeroOccurrence}`,
    /Occurrence not recorded/
  );
});

test("cursor state covers loading, empty, pagination, end, and retryable error transitions", () => {
  let state = createCursorHistoryState("issues");
  assert.equal(state.isLoading, true);
  state = cursorHistoryReducer(state, {
    type: "request_succeeded",
    ownerKey: "issues",
    items: [],
    page: { hasMore: false, nextCursor: null },
  });
  assert.deepEqual(state.items, []);
  assert.equal(state.hasMore, false);
  state = cursorHistoryReducer(state, {
    type: "request_failed",
    ownerKey: "issues",
    error: "Could not load Issues.",
  });
  assert.equal(state.error, "Could not load Issues.");
});

test("Issue API module uses authenticated Issue endpoints and no other data source", async () => {
  const api = await source("../src/api/issues.js");
  assert.match(api, /api\.get\("\/issues"/);
  assert.match(api, /`\/issues\/\$\{encodeURIComponent\(issueId\)\}`/);
  assert.match(api, /`\/issues\/\$\{encodeURIComponent\(issueId\)\}\/signals`/);
  assert.doesNotMatch(api, /meta|artifact|localStorage|sessionStorage/i);
});

test("Issue list implements loading, empty, error, retry, pagination, and route navigation", async () => {
  const [list, states] = await Promise.all([
    source("../src/components/issues/IssueListSection.jsx"),
    source("../src/components/history/HistoryPrimitives.jsx"),
  ]);
  assert.match(list, /useCursorHistory/);
  assert.match(list, /getIssues\(\{ clientId, reportId, cursor, signal \}\)/);
  assert.match(list, /to=\{path\}/);
  assert.match(list, /occurrenceCount/);
  assert.match(list, /reopenCount > 0/);
  assert.match(states, /ListSkeleton/);
  assert.match(states, /Try again/);
  assert.match(states, /Load more/);
  assert.match(states, /End of history/);
});

test("active Client integrates Issues without replacing Reports or Signals", async () => {
  const client = await source("../src/pages/ClientDetail.jsx");
  assert.match(client, /<IssueListSection clientId=\{clientId\}/);
  assert.match(client, />\s*Reports\s*</);
  assert.match(client, /Recent Signals/);
});

test("active Report integrates Issues without replacing narrative history or artifacts", async () => {
  const report = await source("../src/pages/ReportDetail.jsx");
  assert.match(report, /<IssueListSection reportId=\{reportId\}/);
  assert.match(report, /Narrative History/);
  assert.match(report, /ArtifactPreviewPanel/);
  assert.match(report, />\s*Signals\s*</);
});

test("archived Client and Report reuse the same Issue list with historical wording", async () => {
  const [client, report, list] = await Promise.all([
    source("../src/pages/ClientHistory.jsx"),
    source("../src/pages/ReportHistory.jsx"),
    source("../src/components/issues/IssueListSection.jsx"),
  ]);
  assert.match(client, /<IssueListSection[\s\S]*clientId=\{clientId\}[\s\S]*archivedContext/);
  assert.match(report, /<IssueListSection[\s\S]*reportId=\{reportId\}[\s\S]*archivedContext/);
  assert.match(list, /Archiving the parent does not mark an Issue as resolved/);
  assert.doesNotMatch(list, /status\s*=\s*["']resolved["']/);
});

test("Issue detail owns direct-route state and paginated occurrence history", async () => {
  const detail = await source("../src/pages/IssueDetail.jsx");
  assert.match(detail, /const \{ issueId \} = useParams\(\)/);
  assert.match(detail, /getIssue\(issueId/);
  assert.match(detail, /getIssueSignals\(issueId, \{ cursor, signal \}\)/);
  assert.match(detail, /useRouteOwnedResource/);
  assert.match(detail, /useCursorHistory/);
  assert.match(detail, /Issue not found/);
  assert.match(detail, /Try again/);
  assert.match(detail, /Occurrence history/);
});

test("Issue route is protected and no sidebar navigation is added", async () => {
  const [router, sidebar] = await Promise.all([
    source("../src/routes/router.jsx"),
    source("../src/components/layout/Sidebar.jsx"),
  ]);
  assert.match(router, /path: "\/issues\/:issueId"/);
  assert.match(router, /element: <IssueDetail \/>/);
  assert.doesNotMatch(sidebar, /\/issues/);
});

test("Issue frontend performs no persistent storage, Meta, artifact, or email requests", async () => {
  const issueFiles = await Promise.all([
    source("../src/api/issues.js"),
    source("../src/utils/issues.js"),
    source("../src/components/issues/IssueListSection.jsx"),
    source("../src/components/issues/IssueSignalHistory.jsx"),
    source("../src/pages/IssueDetail.jsx"),
  ]);
  const combined = issueFiles.join("\n");
  assert.doesNotMatch(combined, /localStorage|sessionStorage|dangerouslySetInnerHTML/);
  assert.doesNotMatch(combined, /\/meta|\/artifacts|manual-send|webhook|emailHtml|email_html/);
});

test("Issue frontend adds bounded intervention controls without a Review Queue or outcome controls", async () => {
  const issueFiles = await Promise.all([
    source("../src/components/issues/IssueListSection.jsx"),
    source("../src/components/issues/IssueSignalHistory.jsx"),
    source("../src/components/issues/InterventionHistory.jsx"),
    source("../src/pages/IssueDetail.jsx"),
  ]);
  const combined = issueFiles.join("\n");
  assert.match(combined, /Intervention history/);
  assert.match(combined, /Record action/);
  assert.doesNotMatch(combined, /Review Queue|outcome evaluation|resolve Issue/i);
});
