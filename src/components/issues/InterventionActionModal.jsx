import { AlertTriangle, ArrowLeft, Check, RotateCcw, X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";

import { correctIntervention, createIntervention } from "../../api/interventions";
import useModalFocusTrap from "../../hooks/useModalFocusTrap";
import useRequestOwnership from "../../hooks/useRequestOwnership";
import {
  BID_STRATEGIES,
  EXCLUSION_TYPES,
  INTERVENTION_ACTIONS,
  INTERVENTION_ACTION_BY_VALUE,
  TARGETING_DIMENSIONS,
  TRACKING_AREAS,
  buildInterventionMutationPayload,
  changeInterventionActionType,
  createInterventionIntentController,
  defaultInterventionForm,
  interventionError,
  interventionFieldA11y,
  interventionLabel,
  mapIntervention,
  validateAuthoritativeIntervention,
  validateInterventionForm,
} from "../../utils/interventions";
import { issueDate, issueLabel } from "../../utils/issues";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800";
const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-200";

const optionLabel = (value) => issueLabel(value, value);
const requestWasAborted = (error) =>
  error?.name === "AbortError" ||
  error?.name === "CanceledError" ||
  error?.code === "ERR_CANCELED";

function FieldError({ id, children }) {
  if (!children) return null;
  return <p id={id} className="mt-1 text-xs text-rose-600 dark:text-rose-300">{children}</p>;
}

function ActionFields({ definition, form, errors, update, fieldA11y }) {
  const has = (field) => definition?.fields.includes(field);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {has("mode") && (
        <label className={labelClass}>
          Budget mode
          <select {...fieldA11y("mode")} value={form.mode} onChange={(event) => update("mode", event.target.value)} className={inputClass}>
            <option value="percent">Percentage</option>
            <option value="absolute">Absolute amount</option>
          </select>
          <FieldError id={fieldA11y("mode")["aria-describedby"]}>{errors.mode}</FieldError>
        </label>
      )}
      {has("amount") && (
        <label className={labelClass}>
          Amount
          <input
            type="text"
            inputMode="decimal"
            value={form.amount}
            onChange={(event) => update("amount", event.target.value)}
            className={inputClass}
            placeholder={form.mode === "percent" ? "10" : "5000"}
            {...fieldA11y("amount")}
          />
          <FieldError id={fieldA11y("amount")["aria-describedby"]}>{errors.amount}</FieldError>
        </label>
      )}
      {has("currency") && form.mode === "absolute" && (
        <label className={labelClass}>
          Currency
          <input
            type="text"
            maxLength={3}
            value={form.currency}
            onChange={(event) => update("currency", event.target.value.toUpperCase())}
            className={inputClass}
            placeholder="INR"
            {...fieldA11y("currency")}
          />
          <FieldError id={fieldA11y("currency")["aria-describedby"]}>{errors.currency}</FieldError>
        </label>
      )}
      {has("dimension") && (
        <label className={labelClass}>
          Targeting dimension
          <select {...fieldA11y("dimension")} value={form.dimension} onChange={(event) => update("dimension", event.target.value)} className={inputClass}>
            {TARGETING_DIMENSIONS.map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}
          </select>
          <FieldError id={fieldA11y("dimension")["aria-describedby"]}>{errors.dimension}</FieldError>
        </label>
      )}
      {has("exclusionType") && (
        <label className={labelClass}>
          Exclusion type
          <select {...fieldA11y("exclusionType")} value={form.exclusionType} onChange={(event) => update("exclusionType", event.target.value)} className={inputClass}>
            {EXCLUSION_TYPES.map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}
          </select>
          <FieldError id={fieldA11y("exclusionType")["aria-describedby"]}>{errors.exclusionType}</FieldError>
        </label>
      )}
      {has("strategy") && (
        <label className={labelClass}>
          Bid strategy
          <select {...fieldA11y("strategy")} value={form.strategy} onChange={(event) => update("strategy", event.target.value)} className={inputClass}>
            {BID_STRATEGIES.map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}
          </select>
          <FieldError id={fieldA11y("strategy")["aria-describedby"]}>{errors.strategy}</FieldError>
        </label>
      )}
      {has("area") && (
        <label className={labelClass}>
          Tracking area
          <select {...fieldA11y("area")} value={form.area} onChange={(event) => update("area", event.target.value)} className={inputClass}>
            {TRACKING_AREAS.map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}
          </select>
          <FieldError id={fieldA11y("area")["aria-describedby"]}>{errors.area}</FieldError>
        </label>
      )}
      {has("label") && (
        <label className={`${labelClass} sm:col-span-2`}>
          Action label
          <input {...fieldA11y("label")} type="text" maxLength={100} value={form.label} onChange={(event) => update("label", event.target.value)} className={inputClass} />
          <FieldError id={fieldA11y("label")["aria-describedby"]}>{errors.label}</FieldError>
        </label>
      )}
      {has("summary") && (
        <label className={`${labelClass} sm:col-span-2`}>
          Change summary
          <textarea {...fieldA11y("summary")} rows={3} maxLength={500} value={form.summary} onChange={(event) => update("summary", event.target.value)} className={inputClass} />
          <FieldError id={fieldA11y("summary")["aria-describedby"]}>{errors.summary}</FieldError>
        </label>
      )}
      {has("assetCount") && (
        <label className={labelClass}>
          Asset count <span className="font-normal text-slate-400">(optional)</span>
          <input {...fieldA11y("assetCount")} type="text" inputMode="numeric" value={form.assetCount} onChange={(event) => update("assetCount", event.target.value)} className={inputClass} />
          <FieldError id={fieldA11y("assetCount")["aria-describedby"]}>{errors.assetCount}</FieldError>
        </label>
      )}
    </div>
  );
}

function ReviewRow({ label, children }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-3 last:border-b-0 sm:grid-cols-[150px_1fr] dark:border-slate-800">
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-900 dark:text-slate-100">{children}</dd>
    </div>
  );
}

export default function InterventionActionModal({
  issue,
  intervention = null,
  members = [],
  currentUserId,
  mode = "create",
  onClose,
  onSuccess,
  onStale,
  actionOptions = INTERVENTION_ACTIONS,
  initialRevision = null,
  createPayloadBuilder = null,
  createRequest = null,
  createTitle = "Record action",
  createDescription = "Record what a person did after this Issue was detected.",
  errorMapper = interventionError,
  authorityLabel = "Issue",
}) {
  const correction = mode === "correct";
  const titleId = useId();
  const fieldIdPrefix = useId();
  const dialogRef = useRef(null);
  const firstControl = useRef(null);
  const [form, setForm] = useState(() =>
    defaultInterventionForm({ intervention, members, currentUserId })
  );
  const [step, setStep] = useState("edit");
  const [errors, setErrors] = useState({});
  const [requestState, setRequestState] = useState(null);
  const [intentController] = useState(() =>
    createInterventionIntentController(correction ? "correction" : "record")
  );
  const [pending, setPending] = useState(false);
  const [currentRevision, setCurrentRevision] = useState(
    correction ? intervention?.revision : (initialRevision ?? issue?.lifecycleRevision)
  );
  const [staleNeedsReview, setStaleNeedsReview] = useState(false);
  const [mutationAllowed, setMutationAllowed] = useState(true);
  const [authoritativeIntervention, setAuthoritativeIntervention] = useState(
    correction ? intervention : null
  );
  const [authorityRefreshState, setAuthorityRefreshState] = useState("idle");
  const requests = useRequestOwnership();
  const definition = INTERVENTION_ACTION_BY_VALUE[form.actionType];
  const openedAt = issue?.openedAt || intervention?.issueSnapshot?.openedAt;

  useModalFocusTrap({
    containerRef: dialogRef,
    initialFocusRef: firstControl,
    pending,
    onClose,
  });

  const fieldA11y = (field) =>
    interventionFieldA11y(errors, fieldIdPrefix, field);

  const update = (field, value) => {
    setForm((current) =>
      field === "actionType"
        ? changeInterventionActionType(current, value)
        : { ...current, [field]: value }
    );
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (!staleNeedsReview) setRequestState(null);
  };

  const validateAndReview = () => {
    const nextErrors = validateInterventionForm(form, { openedAt, members });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      setStep("review");
      setRequestState(null);
    }
  };

  const resetIntent = () => {
    setForm(defaultInterventionForm({ intervention, members, currentUserId }));
    intentController.reset();
    setStep("edit");
    setErrors({});
    setRequestState(null);
  };

  const startNewSubmission = () => {
    intentController.reset();
    setStep("edit");
    setRequestState(null);
  };

  const reviewRefreshedData = () => {
    if (
      !mutationAllowed ||
      authorityRefreshState !== "ready" ||
      !Number.isInteger(currentRevision) ||
      (correction && authoritativeIntervention?.id !== intervention?.id)
    ) return;
    setStaleNeedsReview(false);
    validateAndReview();
  };

  const applyAuthoritativeRefresh = (refreshed, controlled, request) => {
    if (!request.isCurrent()) return false;
    if (correction) {
      const rawIntervention = refreshed?.intervention;
      const next = mapIntervention(rawIntervention);
      const authority = validateAuthoritativeIntervention({
        intervention: rawIntervention,
        expectedId: intervention?.id,
        operation: "correct",
        canWrite: refreshed?.canWrite === true,
      });
      setAuthoritativeIntervention(authority.complete ? next : null);
      setCurrentRevision(authority.complete ? next.revision : null);
      setMutationAllowed(authority.mutationAllowed);
      setAuthorityRefreshState(authority.mutationAllowed ? "ready" : "blocked");
      setRequestState({ ...controlled, message: authority.message });
      if (authority.complete) {
        const restored = defaultInterventionForm({
          intervention: next,
          members,
          currentUserId,
        });
        setForm((current) => ({
          ...current,
          performerMode: restored.performerMode,
          memberUserId: restored.memberUserId,
          manualName: restored.manualName,
          manualEmail: restored.manualEmail,
        }));
      }
      return authority.mutationAllowed;
    }

    const refreshedIssue = refreshed?.issue;
    const complete =
      String(refreshedIssue?.id || "") === String(issue?.id || "") &&
      Number.isSafeInteger(refreshedIssue?.lifecycleRevision) &&
      refreshedIssue.lifecycleRevision >= 0 &&
      refreshed?.canWrite === true;
    setCurrentRevision(complete ? refreshedIssue.lifecycleRevision : null);
    setMutationAllowed(complete);
    setAuthorityRefreshState(complete ? "ready" : "blocked");
    setRequestState({
      ...controlled,
      message: complete
        ? `Latest ${authorityLabel} data loaded. Review it before submitting again.`
        : `The latest ${authorityLabel} authority could not be verified. Retry the refresh.`,
    });
    return complete;
  };

  const refreshAuthoritativeState = async (controlled, activeRequest = null) => {
    const request = activeRequest || requests.begin();
    if (request.isCurrent()) {
      setAuthorityRefreshState("loading");
      setMutationAllowed(false);
      setCurrentRevision(null);
      setAuthoritativeIntervention(null);
    }
    try {
      if (typeof onStale !== "function") throw new Error("Refresh is unavailable.");
      const refreshed = await onStale({
        correction,
        interventionId: intervention?.id,
        signal: request.signal,
      });
      applyAuthoritativeRefresh(refreshed, controlled, request);
    } catch (error) {
      if (!request.isCurrent() || requestWasAborted(error)) return;
      setAuthorityRefreshState("failed");
      setMutationAllowed(false);
      setCurrentRevision(null);
      setAuthoritativeIntervention(null);
      setRequestState({
        ...controlled,
        message: `${controlled.message} The latest authoritative record could not be loaded. Retry the refresh.`,
      });
    } finally {
      requests.finish(request);
    }
  };

  const retryAuthoritativeRefresh = () => {
    refreshAuthoritativeState(
      requestState || {
        stale: true,
        message: correction
          ? "This action record changed. Refresh and review before resubmitting."
          : `The ${authorityLabel} changed. Refresh and review before resubmitting.`,
      }
    );
  };

  const submit = async () => {
    if (pending || staleNeedsReview || !mutationAllowed || !Number.isInteger(currentRevision)) return;
    const intentKey = intentController.begin();
    if (!intentKey) return;
    const request = requests.begin();
    setPending(true);
    setRequestState(null);
    try {
      const payload = buildInterventionMutationPayload({
        form,
        idempotencyKey: intentKey,
        expectedRevision: currentRevision,
        correction,
      });
      const response = correction
        ? await correctIntervention(intervention.id, payload, { signal: request.signal })
        : createRequest
          ? await createRequest(
              createPayloadBuilder
                ? createPayloadBuilder({ form, idempotencyKey: intentKey, expectedRevision: currentRevision, payload })
                : payload,
              { signal: request.signal }
            )
          : await createIntervention(issue.id, payload, { signal: request.signal });
      if (!request.isCurrent()) return;
      intentController.complete();
      onSuccess(response.intervention, { idempotentReplay: response.idempotentReplay === true, response });
    } catch (error) {
      if (!request.isCurrent() || requestWasAborted(error)) return;
      intentController.fail();
      const controlled = errorMapper(error);
      setRequestState(controlled);
      if (controlled.stale || controlled.sourceStale) {
        setStep("edit");
        setStaleNeedsReview(true);
        setMutationAllowed(false);
        setCurrentRevision(null);
        setAuthoritativeIntervention(null);
        await refreshAuthoritativeState(controlled, request);
      }
    } finally {
      if (request.isCurrent()) setPending(false);
      requests.finish(request);
    }
  };

  const performerLabel = useMemo(() => {
    if (form.performerMode === "manual") return form.manualName || "Manual performer";
    if (form.performerMode === "workspace_member") {
      return members.find(
        (member) => member.userId === form.memberUserId
      )?.name || "Workspace member";
    }
    return "You";
  }, [form.manualName, form.memberUserId, form.performerMode, members]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 px-3 py-5 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex max-h-[calc(100vh-2.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">
              {step === "review" ? "Review submission" : correction ? "Create replacement record" : "Human action record"}
            </p>
            <h2 id={titleId} className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
              {correction ? "Correct recorded action" : createTitle}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {correction
                ? "The original remains in history and will be marked superseded."
                : createDescription}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={pending} aria-label="Close action form" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          {requestState && (
            <div role="alert" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold">Submission not completed</p>
                  <p className="mt-1">{requestState.message}</p>
                  {requestState.conflict && (
                    <button type="button" onClick={startNewSubmission} className="mt-3 font-semibold underline">
                      Start a new submission
                    </button>
                  )}
                  {staleNeedsReview && mutationAllowed && (
                    <button type="button" onClick={reviewRefreshedData} className="mt-3 block font-semibold underline">
                      Review refreshed data
                    </button>
                  )}
                  {staleNeedsReview && ["failed", "blocked"].includes(authorityRefreshState) && (
                    <button type="button" onClick={retryAuthoritativeRefresh} className="mt-3 block font-semibold underline">
                      Retry refresh
                    </button>
                  )}
                  {authorityRefreshState === "loading" && (
                    <p className="mt-3 font-medium">Refreshing latest authority...</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === "edit" ? (
            <div className="space-y-6">
              <label className={labelClass}>
                Action type
                <select ref={firstControl} {...fieldA11y("actionType")} value={form.actionType} onChange={(event) => update("actionType", event.target.value)} className={inputClass}>
                  {actionOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{definition?.description}</p>
                <FieldError id={fieldA11y("actionType")["aria-describedby"]}>{errors.actionType}</FieldError>
              </label>

              <ActionFields definition={definition} form={form} errors={errors} update={update} fieldA11y={fieldA11y} />

              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>
                  Performer
                  <select {...fieldA11y("performerMode")} value={form.performerMode} onChange={(event) => update("performerMode", event.target.value)} className={inputClass}>
                    <option value="self">Me</option>
                    {members.length > 0 && <option value="workspace_member">Workspace member</option>}
                    <option value="manual">Someone else</option>
                  </select>
                  <FieldError id={fieldA11y("performerMode")["aria-describedby"]}>{errors.performerMode}</FieldError>
                </label>
                <label className={labelClass}>
                  Performed at
                  <input {...fieldA11y("performedAt")} type="datetime-local" value={form.performedAt} onChange={(event) => update("performedAt", event.target.value)} className={inputClass} />
                  <FieldError id={fieldA11y("performedAt")["aria-describedby"]}>{errors.performedAt}</FieldError>
                </label>
                {form.performerMode === "workspace_member" && (
                  <label className={`${labelClass} sm:col-span-2`}>
                    Workspace member
                    <select {...fieldA11y("memberUserId")} value={form.memberUserId} onChange={(event) => update("memberUserId", event.target.value)} className={inputClass}>
                      <option value="">Choose a member</option>
                      {members.map((member) => <option key={member.membershipId || member.userId} value={member.userId}>{member.name || "Workspace member"}</option>)}
                    </select>
                    <FieldError id={fieldA11y("memberUserId")["aria-describedby"]}>{errors.memberUserId}</FieldError>
                  </label>
                )}
                {form.performerMode === "manual" && (
                  <>
                    <label className={labelClass}>
                      Performer name
                      <input {...fieldA11y("manualName")} type="text" maxLength={256} value={form.manualName} onChange={(event) => update("manualName", event.target.value)} className={inputClass} />
                      <FieldError id={fieldA11y("manualName")["aria-describedby"]}>{errors.manualName}</FieldError>
                    </label>
                    <label className={labelClass}>
                      Performer email <span className="font-normal text-slate-400">(optional)</span>
                      <input {...fieldA11y("manualEmail")} type="email" maxLength={254} value={form.manualEmail} onChange={(event) => update("manualEmail", event.target.value)} className={inputClass} autoComplete="off" />
                      <FieldError id={fieldA11y("manualEmail")["aria-describedby"]}>{errors.manualEmail}</FieldError>
                    </label>
                  </>
                )}
              </div>

              {form.actionType !== "internal_note" && (
                <label className={labelClass}>
                  Reason
                  <textarea {...fieldA11y("reason")} rows={3} maxLength={1000} value={form.reason} onChange={(event) => update("reason", event.target.value)} className={inputClass} />
                  <FieldError id={fieldA11y("reason")["aria-describedby"]}>{errors.reason}</FieldError>
                </label>
              )}
              <label className={labelClass}>
                {form.actionType === "internal_note" ? "Internal note" : "Note (optional)"}
                <textarea {...fieldA11y("note")} rows={3} maxLength={2000} value={form.note} onChange={(event) => update("note", event.target.value)} className={inputClass} />
                <FieldError id={fieldA11y("note")["aria-describedby"]}>{errors.note}</FieldError>
              </label>
            </div>
          ) : (
            <div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 dark:border-slate-800 dark:bg-slate-950/60">
                <dl>
                  <ReviewRow label="Action">{interventionLabel(form.actionType)}</ReviewRow>
                  <ReviewRow label="Performer">{performerLabel}</ReviewRow>
                  <ReviewRow label="Performed">{issueDate(new Date(form.performedAt).toISOString())}</ReviewRow>
                  {form.summary && <ReviewRow label="Change">{form.summary}</ReviewRow>}
                  {form.label && <ReviewRow label="Label">{form.label}</ReviewRow>}
                  {form.amount && <ReviewRow label="Budget">{form.mode === "percent" ? `${form.amount}%` : `${form.currency.toUpperCase()} ${form.amount}`}</ReviewRow>}
                  {form.reason && <ReviewRow label="Reason">{form.reason}</ReviewRow>}
                  {form.note && <ReviewRow label="Note">{form.note}</ReviewRow>}
                </dl>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <Check size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                This records a human action and its timing. It does not change Meta campaigns or claim an outcome.
              </div>
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6 dark:border-slate-800 dark:bg-slate-950/50">
          {step === "edit" ? (
            <button type="button" onClick={resetIntent} disabled={pending} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100">
              <RotateCcw size={15} aria-hidden="true" /> Reset
            </button>
          ) : (
            <button type="button" onClick={() => setStep("edit")} disabled={pending} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800">
              <ArrowLeft size={15} aria-hidden="true" /> Edit
            </button>
          )}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} disabled={pending} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
              Cancel
            </button>
            {step === "edit" ? (
              <button type="button" onClick={validateAndReview} disabled={staleNeedsReview || !mutationAllowed} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white">
                Review action
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={pending || staleNeedsReview || !mutationAllowed || !Number.isInteger(currentRevision)} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white">
                {pending ? "Recording..." : correction ? "Create correction" : "Record action"}
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
