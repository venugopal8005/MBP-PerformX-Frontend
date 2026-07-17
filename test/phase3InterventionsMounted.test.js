import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { JSDOM } from "jsdom";
import { createElement, useState } from "react";
import { createServer } from "vite";

let vite;
let api;
let originalGet;
let originalPost;
let render;
let cleanup;
let fireEvent;
let waitFor;
let act;
let InterventionActionModal;
let InterventionDetailModal;
let InterventionHistory;
let useCursorHistory;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
let consoleMessages = [];

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});

for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "Node",
  "Event",
  "KeyboardEvent",
  "MouseEvent",
  "MutationObserver",
  "getComputedStyle",
]) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: key === "window" || key === "document" || key === "navigator"
      ? dom.window[key]
      : dom.window[key],
  });
}
globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const staleError = () =>
  Object.assign(new Error("stale"), {
    response: {
      status: 409,
      data: { code: "INTERVENTION_REVISION_STALE" },
    },
  });

const issueValue = (overrides = {}) => ({
  id: "issue-1",
  lifecycleRevision: 7,
  openedAt: "2026-07-15T08:00:00.000Z",
  ...overrides,
});

const interventionValue = (overrides = {}) => ({
  id: "intervention-1",
  issueId: "issue-1",
  actionType: "monitor_only",
  actionPayload: {},
  reason: "Continue monitoring retained performance evidence.",
  note: "",
  performedAt: "2026-07-16T09:00:00.000Z",
  recordedAt: "2026-07-16T09:05:00.000Z",
  performedBy: {
    displayName: "Asha",
    workspaceRole: "member",
    provenance: "workspace_member",
  },
  performedByUserId: "aaaaaaaaaaaaaaaaaaaaaaaa",
  recordedBy: {
    displayName: "Owner",
    workspaceRole: "owner",
    provenance: "workspace_member",
  },
  status: "active",
  revision: 2,
  permissions: { canCorrect: true, canCancel: true },
  issueSnapshot: { openedAt: "2026-07-15T08:00:00.000Z" },
  scopeSnapshot: {},
  latestSignalSnapshot: {},
  ...overrides,
});

const clickReviewAndSubmit = async (view, submitName) => {
  const reason = view.queryByLabelText(/^Reason/);
  if (reason && !reason.value) {
    fireEvent.change(reason, {
      target: { value: "Continue monitoring retained performance evidence." },
    });
  }
  fireEvent.click(view.getByRole("button", { name: "Review action" }));
  const submit = await view.findByRole("button", { name: submitName });
  fireEvent.click(submit);
};

before(async () => {
  ({ render, cleanup, fireEvent, waitFor, act } = await import(
    "@testing-library/react"
  ));
  vite = await createServer({
    root: new URL("..", import.meta.url).pathname,
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  ({ default: api } = await vite.ssrLoadModule("/src/api/axios.js"));
  ({ default: InterventionActionModal } = await vite.ssrLoadModule(
    "/src/components/issues/InterventionActionModal.jsx"
  ));
  ({ default: InterventionDetailModal } = await vite.ssrLoadModule(
    "/src/components/issues/InterventionDetailModal.jsx"
  ));
  ({ default: InterventionHistory } = await vite.ssrLoadModule(
    "/src/components/issues/InterventionHistory.jsx"
  ));
  ({ default: useCursorHistory } = await vite.ssrLoadModule(
    "/src/hooks/useCursorHistory.js"
  ));
  originalGet = api.get;
  originalPost = api.post;
});

beforeEach(() => {
  consoleMessages = [];
  console.error = (...args) => {
    consoleMessages.push(`[error] ${args.map(String).join(" ")}`);
  };
  console.warn = (...args) => {
    consoleMessages.push(`[warn] ${args.map(String).join(" ")}`);
  };
});

afterEach(() => {
  cleanup();
  api.get = originalGet;
  api.post = originalPost;
  document.body.innerHTML = "";
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  assert.deepEqual(
    consoleMessages,
    [],
    `Mounted interaction emitted console warnings:\n${consoleMessages.join("\n")}`
  );
});

after(async () => {
  await vite?.close();
  dom.window.close();
});

test("mounted correction fails closed, retries authority, requires review, and uses the new revision", async () => {
  const posts = [];
  api.post = async (url, body) => {
    posts.push({ url, body });
    if (posts.length === 1) throw staleError();
    return { data: { intervention: interventionValue({ revision: 4 }) } };
  };
  let refreshCalls = 0;
  const successes = [];
  const view = render(createElement(InterventionActionModal, {
    issue: issueValue(),
    intervention: interventionValue(),
    members: [{ userId: "aaaaaaaaaaaaaaaaaaaaaaaa", name: "Asha" }],
    currentUserId: "bbbbbbbbbbbbbbbbbbbbbbbb",
    mode: "correct",
    onClose: () => {},
    onSuccess: (...args) => successes.push(args),
    onStale: async () => {
      refreshCalls += 1;
      if (refreshCalls === 1) throw new Error("refresh unavailable");
      return {
        intervention: interventionValue({ revision: 3 }),
        canWrite: true,
      };
    },
  }));

  await clickReviewAndSubmit(view, "Create correction");
  const retry = await view.findByRole("button", { name: "Retry refresh" });
  assert.equal(view.getByRole("button", { name: "Review action" }).disabled, true);
  assert.equal(view.queryByRole("button", { name: "Review refreshed data" }), null);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].body.expectedRevision, 2);

  fireEvent.click(retry);
  const reviewRefresh = await view.findByRole("button", {
    name: "Review refreshed data",
  });
  assert.equal(posts.length, 1, "refresh must not auto-submit a correction");
  fireEvent.click(reviewRefresh);
  fireEvent.click(await view.findByRole("button", { name: "Create correction" }));

  await waitFor(() => assert.equal(posts.length, 2));
  assert.equal(posts[1].body.expectedRevision, 3);
  assert.equal(posts[1].body.idempotencyKey, posts[0].body.idempotencyKey);
  assert.equal(successes.length, 1);
});

for (const [name, refreshed] of [
  ["missing record", {}],
  ["invalid revision", { intervention: interventionValue({ revision: "3" }), canWrite: true }],
  ["removed permission", { intervention: interventionValue({ revision: 3, permissions: { canCorrect: false, canCancel: true } }), canWrite: true }],
  ["superseded status", { intervention: interventionValue({ revision: 3, status: "superseded" }), canWrite: true }],
  ["cancelled status", { intervention: interventionValue({ revision: 3, status: "cancelled" }), canWrite: true }],
]) {
  test(`mounted stale correction remains unavailable for ${name}`, async () => {
    let postCount = 0;
    api.post = async () => {
      postCount += 1;
      throw staleError();
    };
    const view = render(createElement(InterventionActionModal, {
      issue: issueValue(),
      intervention: interventionValue(),
      mode: "correct",
      onClose: () => {},
      onSuccess: () => {},
      onStale: async () => refreshed,
    }));
    await clickReviewAndSubmit(view, "Create correction");
    await view.findByRole("button", { name: "Retry refresh" });
    assert.equal(view.getByRole("button", { name: "Review action" }).disabled, true);
    assert.equal(view.queryByRole("button", { name: "Review refreshed data" }), null);
    assert.equal(postCount, 1);
  });
}

test("mounted duplicate correction clicks issue exactly one request", async () => {
  const pending = deferred();
  let calls = 0;
  api.post = () => {
    calls += 1;
    return pending.promise;
  };
  const view = render(createElement(InterventionActionModal, {
    issue: issueValue(),
    intervention: interventionValue(),
    mode: "correct",
    onClose: () => {},
    onSuccess: () => {},
  }));
  fireEvent.click(view.getByRole("button", { name: "Review action" }));
  const submit = await view.findByRole("button", { name: "Create correction" });
  fireEvent.click(submit);
  fireEvent.click(submit);
  assert.equal(calls, 1);
  await act(async () => pending.resolve({ data: { intervention: interventionValue() } }));
});

test("mounted creation aborts silently on unmount and invokes no continuation", async () => {
  const pending = deferred();
  api.post = () => pending.promise;
  const successes = [];
  const closes = [];
  const view = render(createElement(InterventionActionModal, {
    issue: issueValue(),
    onClose: () => closes.push(true),
    onSuccess: () => successes.push(true),
  }));
  await clickReviewAndSubmit(view, "Record action");
  view.unmount();
  await act(async () => pending.resolve({ data: { intervention: interventionValue() } }));
  assert.equal(successes.length, 0);
  assert.equal(closes.length, 0);
});

test("mounted correction unmount suppresses stale refresh and success callbacks", async () => {
  const pending = deferred();
  api.post = () => pending.promise;
  let staleCalls = 0;
  let successCalls = 0;
  const view = render(createElement(InterventionActionModal, {
    issue: issueValue(),
    intervention: interventionValue(),
    mode: "correct",
    onClose: () => {},
    onSuccess: () => { successCalls += 1; },
    onStale: () => { staleCalls += 1; },
  }));
  await clickReviewAndSubmit(view, "Create correction");
  view.unmount();
  await act(async () => pending.reject(staleError()));
  assert.equal(staleCalls, 0);
  assert.equal(successCalls, 0);
});

test("mounted cancellation fails closed after stale refresh and retries with authoritative revision", async () => {
  let getCount = 0;
  api.get = async () => {
    getCount += 1;
    if (getCount === 1) return { data: { intervention: interventionValue() } };
    if (getCount === 2) throw new Error("refresh failed");
    return { data: { intervention: interventionValue({ revision: 5 }) } };
  };
  const posts = [];
  api.post = async (url, body) => {
    posts.push({ url, body });
    if (posts.length === 1) throw staleError();
    return { data: { intervention: interventionValue({ status: "cancelled", revision: 6 }) } };
  };
  const view = render(createElement(InterventionDetailModal, {
    interventionId: "intervention-1",
    canWrite: true,
    onClose: () => {},
    onCorrect: () => {},
    onMutation: () => {},
    onOpenRelated: () => {},
  }));
  fireEvent.click(await view.findByRole("button", { name: "Cancel record" }));
  fireEvent.change(view.getByLabelText("Cancellation reason"), {
    target: { value: "Recorded against the wrong scope." },
  });
  fireEvent.click(view.getByRole("button", { name: "Confirm cancellation" }));
  const retry = await view.findByRole("button", { name: "Retry refresh" });
  assert.equal(view.getByRole("button", { name: "Confirm cancellation" }).disabled, true);
  fireEvent.click(retry);
  fireEvent.click(await view.findByRole("button", { name: "Review refreshed record" }));
  fireEvent.click(view.getByRole("button", { name: "Confirm cancellation" }));
  await waitFor(() => assert.equal(posts.length, 2));
  assert.equal(posts[0].body.expectedRevision, 2);
  assert.equal(posts[1].body.expectedRevision, 5);
  assert.equal(posts[1].body.idempotencyKey, posts[0].body.idempotencyKey);
});

for (const [name, refreshed] of [
  [
    "removed cancellation permission",
    interventionValue({
      revision: 5,
      permissions: { canCorrect: true, canCancel: false },
    }),
  ],
  [
    "cancelled authoritative status",
    interventionValue({ status: "cancelled", revision: 5 }),
  ],
]) {
  test(`mounted stale cancellation remains unavailable after ${name}`, async () => {
    let getCount = 0;
    api.get = async () => {
      getCount += 1;
      return {
        data: {
          intervention: getCount === 1 ? interventionValue() : refreshed,
        },
      };
    };
    let postCount = 0;
    api.post = async () => {
      postCount += 1;
      throw staleError();
    };
    const view = render(createElement(InterventionDetailModal, {
      interventionId: "intervention-1",
      canWrite: true,
      onClose: () => {},
      onCorrect: () => {},
      onMutation: () => {},
      onOpenRelated: () => {},
    }));

    fireEvent.click(await view.findByRole("button", { name: "Cancel record" }));
    fireEvent.change(view.getByLabelText("Cancellation reason"), {
      target: { value: "Recorded against the wrong scope." },
    });
    fireEvent.click(view.getByRole("button", { name: "Confirm cancellation" }));

    await view.findByText(/can no longer be changed/i);
    const confirm = view.getByRole("button", { name: "Confirm cancellation" });
    assert.equal(confirm.disabled, true);
    assert.equal(view.queryByRole("button", { name: "Review refreshed record" }), null);
    fireEvent.click(confirm);
    assert.equal(postCount, 1, "blocked authority must not issue a second cancellation");
    assert.equal(getCount, 2);
  });
}

test("mounted duplicate cancellation and unmount produce one request and no callback", async () => {
  api.get = async () => ({ data: { intervention: interventionValue() } });
  const pending = deferred();
  let calls = 0;
  api.post = () => {
    calls += 1;
    return pending.promise;
  };
  let mutations = 0;
  const view = render(createElement(InterventionDetailModal, {
    interventionId: "intervention-1",
    canWrite: true,
    onClose: () => {},
    onCorrect: () => {},
    onMutation: () => { mutations += 1; },
    onOpenRelated: () => {},
  }));
  fireEvent.click(await view.findByRole("button", { name: "Cancel record" }));
  fireEvent.change(view.getByLabelText("Cancellation reason"), {
    target: { value: "Recorded against the wrong scope." },
  });
  const submit = view.getByRole("button", { name: "Confirm cancellation" });
  fireEvent.click(submit);
  fireEvent.click(submit);
  assert.equal(calls, 1);
  view.unmount();
  await act(async () => pending.resolve({ data: { intervention: interventionValue() } }));
  assert.equal(mutations, 0);
});

test("mounted creation preserves its idempotency key through retry and rotates it for a new intent", async () => {
  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  const uuids = ["intent-one", "after-one", "intent-two", "after-two"];
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: { randomUUID: () => uuids.shift() },
  });
  const firstAttempt = deferred();
  const posts = [];
  api.post = async (url, body) => {
    posts.push({ url, body });
    if (posts.length === 1) return firstAttempt.promise;
    return { data: { intervention: interventionValue({ id: `created-${posts.length}` }) } };
  };
  let successes = 0;

  function Harness({ onSaved }) {
    const [open, setOpen] = useState(false);
    return createElement(
      "div",
      null,
      createElement(
        "button",
        { type: "button", onClick: () => setOpen(true) },
        "Open record action"
      ),
      open && createElement(InterventionActionModal, {
        issue: issueValue(),
        onClose: () => setOpen(false),
        onSuccess: () => {
          onSaved();
          setOpen(false);
        },
      })
    );
  }

  try {
    const view = render(createElement(Harness, {
      onSaved: () => {
        successes += 1;
      },
    }));
    fireEvent.click(view.getByRole("button", { name: "Open record action" }));
    fireEvent.change(await view.findByLabelText(/^Reason/), {
      target: { value: "Continue monitoring retained performance evidence." },
    });
    fireEvent.click(view.getByRole("button", { name: "Review action" }));
    const firstSubmit = await view.findByRole("button", { name: "Record action" });
    fireEvent.click(firstSubmit);
    fireEvent.click(firstSubmit);
    assert.equal(posts.length, 1, "pending double-click must issue one create request");

    await act(async () => firstAttempt.reject(Object.assign(new Error("transaction unavailable"), {
      response: {
        status: 503,
        data: { code: "INTERVENTION_TRANSACTION_REQUIRED" },
      },
    })));
    await view.findByText("Action recording is temporarily unavailable.");
    fireEvent.click(view.getByRole("button", { name: "Record action" }));
    await waitFor(() => assert.equal(posts.length, 2));
    assert.equal(posts[0].body.idempotencyKey, "record:intent-one");
    assert.equal(posts[1].body.idempotencyKey, posts[0].body.idempotencyKey);
    await waitFor(() => assert.equal(view.queryByRole("dialog"), null));
    assert.equal(successes, 1);

    fireEvent.click(view.getByRole("button", { name: "Open record action" }));
    fireEvent.change(await view.findByLabelText(/^Reason/), {
      target: { value: "Continue monitoring a new action intent." },
    });
    fireEvent.click(view.getByRole("button", { name: "Review action" }));
    fireEvent.click(await view.findByRole("button", { name: "Record action" }));
    await waitFor(() => assert.equal(posts.length, 3));
    assert.equal(posts[2].body.idempotencyKey, "record:intent-two");
    assert.notEqual(posts[2].body.idempotencyKey, posts[0].body.idempotencyKey);
    assert.equal(successes, 2);
  } finally {
    if (originalCrypto) Object.defineProperty(globalThis, "crypto", originalCrypto);
    else delete globalThis.crypto;
  }
});

test("mounted action modal traps focus, handles Escape by pending state, restores focus, and links field errors", { timeout: 5000 }, async () => {
  const pending = deferred();
  api.post = () => pending.promise;
  function Harness() {
    const [open, setOpen] = useState(false);
    return createElement(
      "div",
      null,
      createElement("button", { type: "button", onClick: () => setOpen(true) }, "Open action"),
      open && createElement(InterventionActionModal, {
        issue: issueValue(),
        onClose: () => setOpen(false),
        onSuccess: () => {},
      })
    );
  }
  const view = render(createElement(Harness));
  const trigger = view.getByRole("button", { name: "Open action" });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = await view.findByRole("dialog");
  const initialControl = dialog.querySelector("select");
  const trapFirst = view.getByRole("button", { name: "Close action form" });
  assert.ok(initialControl);
  await waitFor(() => assert.equal(document.activeElement, initialControl));

  const focusable = [...dialog.querySelectorAll("button, select, input, textarea")]
    .filter((element) => !element.disabled);
  const last = focusable.at(-1);
  last.focus();
  fireEvent.keyDown(document, { key: "Tab" });
  assert.equal(document.activeElement, trapFirst);

  fireEvent.click(view.getByRole("button", { name: "Review action" }));
  const reason = view.getByLabelText(/^Reason/);
  assert.equal(reason.getAttribute("aria-invalid"), "true");
  const errorId = reason.getAttribute("aria-describedby");
  assert.ok(errorId);
  assert.ok(document.getElementById(errorId));

  fireEvent.change(reason, { target: { value: "Continue monitoring." } });
  fireEvent.click(view.getByRole("button", { name: "Review action" }));
  fireEvent.click(await view.findByRole("button", { name: "Record action" }));
  fireEvent.keyDown(document, { key: "Escape" });
  assert.ok(view.getByRole("dialog"), "pending Escape must not close the modal");
  pending.reject(new Error("offline"));
  await view.findByText(/Network error/);
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => assert.equal(view.queryByRole("dialog"), null));
  assert.equal(document.activeElement, trigger);
});

test("mounted action modal wraps Shift+Tab from its first control", { timeout: 5000 }, async () => {
  const view = render(createElement(InterventionActionModal, {
    issue: issueValue(),
    onClose: () => {},
    onSuccess: () => {},
  }));
  const dialog = await view.findByRole("dialog");
  const initialControl = dialog.querySelector("select");
  const trapFirst = view.getByRole("button", { name: "Close action form" });
  const focusable = [...dialog.querySelectorAll("button, select, input, textarea")]
    .filter((element) => !element.disabled);
  const last = focusable.at(-1);
  await waitFor(() => assert.equal(document.activeElement, initialControl));
  trapFirst.focus();
  document.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
    key: "Tab",
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  }));
  assert.equal(document.activeElement, last);
});

function MountedHistory({ loadPage, owner = "issue-a", showRevalidate = false }) {
  const state = useCursorHistory({ loadPage, resetKey: owner, enabled: true });
  return createElement(
    "div",
    null,
    showRevalidate && createElement(
      "button",
      {
        type: "button",
        onClick: () => state.revalidate({
          failureMessage: "The action was saved, but the history could not be refreshed.",
        }),
      },
      "Simulate saved action"
    ),
    createElement(InterventionHistory, {
      state,
      highlightedId: null,
      onOpen: () => {},
    })
  );
}

test("mounted post-mutation revalidation preserves history, warns, retries, and replaces without duplicates", async () => {
  const refresh = deferred();
  let calls = 0;
  const loadPage = async () => {
    calls += 1;
    if (calls === 1) {
      return { items: [interventionValue({ reason: "Original retained action." })], page: { hasMore: false, nextCursor: null } };
    }
    if (calls === 2) return refresh.promise;
    return {
      items: [
        interventionValue({ reason: "Authoritative corrected action.", revision: 3 }),
        interventionValue({ reason: "Duplicate must be removed.", revision: 3 }),
        interventionValue({ id: "intervention-2", reason: "New retained action." }),
      ],
      page: { hasMore: false, nextCursor: null },
    };
  };
  const view = render(createElement(MountedHistory, { loadPage, showRevalidate: true }));
  await view.findByText("Original retained action.");
  fireEvent.click(view.getByRole("button", { name: "Simulate saved action" }));
  assert.ok(view.getByText("Original retained action."));
  await act(async () => refresh.reject(new Error("offline")));
  await view.findByText("The action was saved, but the history could not be refreshed.");
  assert.ok(view.getByText("Original retained action."));
  fireEvent.click(view.getByRole("button", { name: "Retry refresh" }));
  await view.findByText("Authoritative corrected action.");
  assert.equal(view.queryByText("Original retained action."), null);
  assert.equal(view.getAllByRole("button", { name: /View details/ }).length, 2);
});

test("mounted cursor retry reuses the failed cursor and deduplicates appended records", async () => {
  const cursors = [];
  let calls = 0;
  const loadPage = async ({ cursor }) => {
    cursors.push(cursor);
    calls += 1;
    if (calls === 1) {
      return { items: [interventionValue()], page: { hasMore: true, nextCursor: "cursor-a" } };
    }
    if (calls === 2) throw new Error("page failed");
    return {
      items: [interventionValue(), interventionValue({ id: "intervention-2" })],
      page: { hasMore: false, nextCursor: null },
    };
  };
  const view = render(createElement(MountedHistory, { loadPage }));
  fireEvent.click(await view.findByRole("button", { name: "Load more" }));
  fireEvent.click(await view.findByRole("button", { name: "Retry load more" }));
  await waitFor(() => assert.equal(view.getAllByRole("button", { name: /View details/ }).length, 2));
  assert.deepEqual(cursors, [null, "cursor-a", "cursor-a"]);
});

test("mounted route-owner change aborts old history and keeps the new Issue authoritative", async () => {
  const issueA = deferred();
  const issueB = deferred();
  const loadPage = ({ signal }) => {
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    return loadPage.owner === "issue-a" ? issueA.promise : issueB.promise;
  };
  loadPage.owner = "issue-a";
  const view = render(createElement(MountedHistory, { loadPage, owner: "issue-a" }));
  loadPage.owner = "issue-b";
  view.rerender(createElement(MountedHistory, { loadPage, owner: "issue-b" }));
  await act(async () => issueB.resolve({
    items: [interventionValue({ id: "b", reason: "Issue B action." })],
    page: { hasMore: false, nextCursor: null },
  }));
  await view.findByText("Issue B action.");
  await act(async () => issueA.resolve({
    items: [interventionValue({ id: "a", reason: "Stale Issue A action." })],
    page: { hasMore: false, nextCursor: null },
  }));
  assert.ok(view.getByText("Issue B action."));
  assert.equal(view.queryByText("Stale Issue A action."), null);
});
