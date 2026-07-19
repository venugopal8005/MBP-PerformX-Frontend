import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const frontend = new URL("../src/", import.meta.url);
const read = (path) => readFile(new URL(path, frontend), "utf8");

test("Phase 5 routes and Sidebar position Review between Clients and Activity", async () => {
  const [router, sidebar] = await Promise.all([read("routes/router.jsx"), read("components/layout/Sidebar.jsx")]);
  assert.match(router, /path:\s*"\/reviews"/);
  assert.match(router, /path:\s*"\/reviews\/:reviewItemId"/);
  const clients = sidebar.indexOf('label: "Clients"');
  const review = sidebar.indexOf('label: "Review"');
  const activity = sidebar.indexOf('label: "Activity"');
  assert.ok(clients < review && review < activity);
});

test("Phase 5 authored interface copy avoids causal Intervention outcome claims", async () => {
  const sources = await Promise.all([
    read("pages/Reviews.jsx"),
    read("pages/ReviewDetail.jsx"),
    read("components/reviews/ReviewMutationDialog.jsx"),
    read("components/reviews/ReviewInterventionModal.jsx"),
    read("components/reviews/ReviewActionHistory.jsx"),
    read("components/reviews/IssueTimeline.jsx"),
  ]);
  const prohibited = /successful Intervention|failed Intervention|\bcaused\b|\bineffective\b|\bworked\b|did not work|led to|resulted in/i;
  for (const source of sources) assert.equal(prohibited.test(source), false);
});

test("Phase 5 authored views do not expose private transport or Review authority fields", async () => {
  const sources = await Promise.all([read("pages/Reviews.jsx"), read("pages/ReviewDetail.jsx"), read("components/reviews/ReviewActionHistory.jsx"), read("components/reviews/IssueTimeline.jsx")]);
  const prohibited = /requestHash|review_origin|processing_lock|actor\.email|emailHtml|webhook/i;
  for (const source of sources) assert.equal(prohibited.test(source), false);
});
