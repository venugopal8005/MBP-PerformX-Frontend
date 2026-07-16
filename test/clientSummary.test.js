import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  filterClientsByStatus,
  formatClientSummaryCount,
  mapBackendClient,
} from "../src/utils/clientSummary.js";
import { getSignalAppearance } from "../src/utils/signalAppearance.js";

test("Client API summaries map explicit report and campaign counts", () => {
  const client = mapBackendClient({
    _id: "client-1",
    name: "Client One",
    status: "stable",
    activeReportCount: 1,
    monitoredCampaignCount: 2,
  });

  assert.equal(client.activeReportCount, 1);
  assert.equal(client.monitoredCampaignCount, 2);
  assert.equal(formatClientSummaryCount(client.activeReportCount, "reports"), "1 report");
  assert.equal(formatClientSummaryCount(client.monitoredCampaignCount, "campaigns"), "2 campaigns");
});

test("explicit backend zero remains a genuine zero summary", () => {
  const client = mapBackendClient({
    _id: "zero",
    name: "Zero Summary",
    activeReportCount: 0,
    monitoredCampaignCount: 0,
  });

  assert.equal(client.activeReportCount, 0);
  assert.equal(client.monitoredCampaignCount, 0);
  assert.equal(formatClientSummaryCount(client.activeReportCount, "reports"), "0 reports");
  assert.equal(formatClientSummaryCount(client.monitoredCampaignCount, "campaigns"), "0 campaigns");
});

test("missing or invalid Client summaries remain unavailable instead of becoming zero", () => {
  const missing = mapBackendClient({ _id: "missing", name: "Missing" });
  const invalid = mapBackendClient({
    _id: "invalid",
    name: "Invalid",
    activeReportCount: "0",
    monitoredCampaignCount: -1,
  });

  assert.equal(missing.activeReportCount, null);
  assert.equal(missing.monitoredCampaignCount, null);
  assert.equal(invalid.activeReportCount, null);
  assert.equal(invalid.monitoredCampaignCount, null);
  assert.equal(formatClientSummaryCount(null, "reports"), "reports unavailable");
  assert.equal(formatClientSummaryCount(undefined, "campaigns"), "campaigns unavailable");
});

test("negative, decimal, string, and NaN summaries remain unavailable", () => {
  for (const value of [-1, 1.5, "2", Number.NaN]) {
    const client = mapBackendClient({
      _id: String(value),
      name: "Invalid Summary",
      activeReportCount: value,
      monitoredCampaignCount: value,
    });
    assert.equal(client.activeReportCount, null);
    assert.equal(client.monitoredCampaignCount, null);
  }
});

test("Client update mapping preserves known summaries while applying updated fields", async () => {
  const current = mapBackendClient({
    _id: "client-1",
    name: "Before update",
    industry: "Retail",
    activeReportCount: 3,
    monitoredCampaignCount: 5,
  });
  const updateResponse = {
    _id: "client-1",
    name: "After update",
    industry: "Software",
    status: "moderate",
  };
  const updated = mapBackendClient({
    ...updateResponse,
    activeReportCount: current.activeReportCount,
    monitoredCampaignCount: current.monitoredCampaignCount,
  });

  assert.equal(updated.activeReportCount, 3);
  assert.equal(updated.monitoredCampaignCount, 5);
  assert.equal(updated.name, "After update");
  assert.equal(updated.industry, "Software");
  assert.equal(updated.status, "moderate");

  const source = await readFile(new URL("../src/pages/Clients.jsx", import.meta.url), "utf8");
  assert.match(source, /activeReportCount: editingClient\.activeReportCount/);
  assert.match(source, /monitoredCampaignCount: editingClient\.monitoredCampaignCount/);
});

test("Client filters use only stored Client status", () => {
  const clients = [
    mapBackendClient({ _id: "stable", name: "Stable", status: "stable" }),
    mapBackendClient({ _id: "moderate", name: "Moderate", status: "moderate" }),
    mapBackendClient({ _id: "critical", name: "Critical", status: "critical" }),
    mapBackendClient({ _id: "missing", name: "Missing status" }),
  ];

  assert.deepEqual(
    filterClientsByStatus(clients, "Critical").map((client) => client.id),
    ["critical"]
  );
  assert.deepEqual(
    filterClientsByStatus(clients, "Attention needed").map((client) => client.id),
    ["moderate", "critical"]
  );
  assert.deepEqual(
    filterClientsByStatus(clients, "All clients").map((client) => client.id),
    ["stable", "moderate", "critical", "missing"]
  );
  assert.equal(clients.at(-1).status, "stable");
});

test("recognized Signal severity is authoritative over type and urgent text", () => {
  assert.equal(
    getSignalAppearance({
      severity: "stable",
      type: "roas_drop",
      title: "Critical issue to fix today",
    }).tone,
    "stable"
  );
  assert.equal(getSignalAppearance({ severity: "critical", title: "Normal" }).tone, "critical");
  assert.equal(getSignalAppearance({ severity: "moderate", title: "Normal" }).tone, "warning");
});

test("Signal text heuristics run only without a recognized severity", () => {
  assert.equal(getSignalAppearance({ title: "Critical issue to fix today" }).tone, "critical");
  assert.equal(
    getSignalAppearance({ severity: "legacy_value", title: "Critical issue to fix today" }).tone,
    "critical"
  );
});

test("null and empty Signal severity use the existing text fallback", () => {
  const urgent = { title: "Fix this critical issue today" };
  assert.equal(getSignalAppearance({ ...urgent, severity: null }).tone, "critical");
  assert.equal(getSignalAppearance({ ...urgent, severity: "" }).tone, "critical");
});

test("recognized Signal severity normalization is case insensitive", () => {
  const urgent = { type: "roas_drop", title: "Fix this critical issue today" };
  assert.equal(getSignalAppearance({ ...urgent, severity: "STABLE" }).tone, "stable");
  assert.equal(getSignalAppearance({ ...urgent, severity: "Moderate" }).tone, "warning");
  assert.equal(getSignalAppearance({ ...urgent, severity: "CRITICAL" }).tone, "critical");
});

test("unknown Signal severity uses existing safe type and text fallbacks", () => {
  assert.equal(
    getSignalAppearance({ severity: "legacy_value", title: "Fix this critical issue today" }).tone,
    "critical"
  );
  assert.equal(getSignalAppearance({ severity: "legacy_value", title: "Routine note" }).tone, "neutral");
});

test("legacy Signal type appearances remain covered by the normal test suite", () => {
  assert.equal(getSignalAppearance({ type: "data_quality_issue" }).tone, "info");
  assert.equal(getSignalAppearance({ type: "healthy_scaling" }).tone, "success");
  assert.equal(getSignalAppearance({ title: "No recent signal" }).tone, "neutral");
});

test("Active and Archived navigation remains above Active-only status filters", async () => {
  const source = await readFile(new URL("../src/pages/Clients.jsx", import.meta.url), "utf8");
  const primaryTabs = source.indexOf("<PageTabs");
  const statusFilters = source.indexOf('aria-label="Client status filters"');

  assert.ok(primaryTabs >= 0);
  assert.ok(statusFilters > primaryTabs);
  assert.match(source, /navigate\("\/clients\/archived"\)/);
});
