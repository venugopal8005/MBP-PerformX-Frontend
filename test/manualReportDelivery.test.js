import assert from "node:assert/strict";
import { test } from "node:test";

import { getManualReportDeliveryOutcome } from "../src/utils/manualReportDelivery.js";

test("frontend confirms success only after backend confirms delivery", () => {
  const outcome = getManualReportDeliveryOutcome({
    success: true,
    message: "Internal report sent.",
    delivery: { confirmed: true, message: "Internal report sent." },
  });

  assert.deepEqual(outcome, {
    confirmed: true,
    message: "Internal report sent.",
  });
});

test("frontend rejects a misleading 2xx payload without confirmed delivery", () => {
  const outcome = getManualReportDeliveryOutcome({
    success: true,
    delivery: {
      confirmed: false,
      message: "Email webhook returned HTTP 500.",
    },
  });

  assert.equal(outcome.confirmed, false);
  assert.equal(outcome.message, "Email webhook returned HTTP 500.");
});

test("frontend surfaces backend delivery failure messages", () => {
  const outcome = getManualReportDeliveryOutcome({
    success: false,
    message: "REPORT_EMAIL_WEBHOOK_URL is not configured.",
  });

  assert.equal(outcome.confirmed, false);
  assert.equal(outcome.message, "REPORT_EMAIL_WEBHOOK_URL is not configured.");
});
