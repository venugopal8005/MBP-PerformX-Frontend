# Phase 5 Review Frontend Contracts

Backend authority: `phase5-backend-complete` at `898a249`.

## Reads

- `GET /api/review-items`: query supports comma-separated `state`, `type`, and
  `priority`, plus `clientId`, `campaignId`, opaque `cursor`, and `limit`.
  The default states are `open,acknowledged`. Response:
  `{ success, reviewItems, page: { limit, returned, scanned, nextCursor } }`.
- `GET /api/clients/:clientId/review-items`: same query and response, scoped to
  the authenticated workspace and Client.
- `GET /api/review-items/:reviewItemId`: response
  `{ success, reviewItem }`, using the detail serializer.
- `GET /api/review-items/:reviewItemId/actions`: query supports the previous
  action `sequence` as opaque frontend cursor plus `limit`. Response:
  `{ success, actions, page: { limit, nextCursor } }`.
- `GET /api/review-items/summary`: workspace summary. This is the implemented
  route; there is no standalone `/api/review-summary` route.
- `GET /api/clients/:clientId/review-summary`: Client summary.
- `GET /api/issues/:issueId/timeline`: query supports opaque `cursor` and
  `limit`. Response:
  `{ success, timeline, page: { limit, snapshotAt, nextCursor } }`.

Summary responses are either complete, with exact `counts`, or partial, with
`counts: null`, bounded `observedCounts`, and an opaque `nextCursor`. Partial
observations must never be presented as exact totals. Client summaries also
include the archived state.

## Review serializers

List items expose only: `id`, `type`, effective `state`, `priority`, `reason`,
`generation`, bounded Client/account/campaign/Issue/source snapshots,
`openedAt`, `latestEvidenceAt`, acknowledgement/snooze/review summaries,
effective mutation `permissions`, and bounded route identifiers.

Detail extends the list projection with `persistedState`, `effectiveState`,
`effectiveCloseReason`, `isSourceCurrent`, `sourceRevisionSynchronized`,
`revision`, bounded `context`, linked Intervention/Evaluation summaries, and
the first ReviewAction page. Snapshot context outranks mutable identity.

Actor projections expose `displayName`, `workspaceRole`, `provenance`, and
`capturedAt`; actor email is never a frontend field.

ReviewAction projections expose `id`, `reviewItemId`, `sequence`,
`actionType`, `actorType`, `decisionType`, bounded actor, prior/resulting
state, note, bounded linked IDs, `occurredAt`, and `recordedAt`.

## Mutations

- `POST /api/review-items/:reviewItemId/acknowledge`
  `{ expectedRevision, idempotencyKey }`.
- `POST /api/review-items/:reviewItemId/snooze`
  `{ expectedRevision, idempotencyKey, snoozedUntil, note? }`. The time must
  be in the future and no more than 30 days away; note maximum is 1,000.
- `POST /api/review-items/:reviewItemId/review`
  `{ expectedRevision, idempotencyKey, decision: "interpretation_recorded", note }`.
  Note is required and limited to 2,000.
- `POST /api/review-items/:reviewItemId/interventions`: existing Phase 3
  Intervention fields plus `expectedReviewRevision` and `idempotencyKey`.
  The backend derives Issue revision authority. `internal_note` is rejected.

Review lifecycle mutations return HTTP 201 for a new action or 200 for an
exact replay, with `{ success, idempotentReplay, reviewItem }`.

Review-originated Intervention returns HTTP 201 or replay HTTP 200 with
`{ success, idempotentReplay, intervention, reviewCompletionStatus,
reviewItem }`. `reviewCompletionStatus` is exactly `completed` or `pending`.
A pending completion means the Intervention was committed and must not be
resubmitted automatically.

## Effective authority

Types: `issue_review`, `evaluation_review`.

States: `open`, `acknowledged`, `snoozed`, `reviewed`, `closed`,
`superseded`.

Priorities: `critical`, `high`, `normal`.

Mutations are rendered only when the corresponding effective permission is
exactly true: `canAcknowledge`, `canSnooze`, `canReview`, or
`canRecordIntervention`. Archived, source-stale, invalidated, closed, and
superseded authority remains readable and non-actionable.

## Controlled errors

The frontend handles these codes without exposing raw server details:

- `REVIEW_INDEXES_NOT_READY`
- `REVIEW_REVISION_STALE`
- `REVIEW_INVALID_STATE`
- `REVIEW_IDEMPOTENCY_CONFLICT`
- `REVIEW_SOURCE_STALE`
- `CLIENT_ARCHIVED`
- `CLIENT_LIFECYCLE_OPERATION_IN_PROGRESS`
- `INVALID_REVIEW_CURSOR`
- `INVALID_TIMELINE_CURSOR`
- `INTERVENTION_IDEMPOTENCY_CONFLICT`

Readiness is Review-only and retryable. Revision/source conflicts fail closed.
Idempotency conflicts end the current intent and require an explicit new one.
All cursors are opaque and are returned unchanged to their owning endpoint.
