import { AlertTriangle, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import { interpretReviewItem, snoozeReviewItem } from "../../api/reviews";
import useModalFocusTrap from "../../hooks/useModalFocusTrap";
import useRequestOwnership from "../../hooks/useRequestOwnership";
import { createReviewIntentKey, normalizeReviewItem, reviewError } from "../../utils/reviews";

const inputClass = "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-slate-800";
const aborted = (error) => error?.name === "AbortError" || error?.name === "CanceledError" || error?.code === "ERR_CANCELED";

export default function ReviewMutationDialog({ mode, reviewItem, onClose, onSuccess, onAuthorityChanged }) {
  const snooze = mode === "snooze";
  const titleId = useId();
  const descriptionId = useId();
  const fieldId = useId();
  const dialogRef = useRef(null);
  const firstControlRef = useRef(null);
  const [intentKey, setIntentKey] = useState(() =>
    createReviewIntentKey(snooze ? "review-snooze" : "review-interpretation")
  );
  const [note, setNote] = useState("");
  const [snoozedUntil, setSnoozedUntil] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [authorityBlocked, setAuthorityBlocked] = useState(false);
  const requests = useRequestOwnership(reviewItem.id);

  useModalFocusTrap({ containerRef: dialogRef, initialFocusRef: firstControlRef, pending, onClose });

  const validate = () => {
    if (snooze) {
      const until = new Date(snoozedUntil);
      const now = Date.now();
      if (!snoozedUntil || !Number.isFinite(until.getTime()) || until.getTime() <= now || until.getTime() - now > 30 * 24 * 60 * 60 * 1000) {
        return "Choose a future time within the next 30 days.";
      }
      if (note.trim().length > 1000) return "Note must be 1,000 characters or fewer.";
      return null;
    }
    if (!note.trim() || note.trim().length > 2000) return "Enter an interpretation of 2,000 characters or fewer.";
    return null;
  };

  const submit = async () => {
    if (pending || authorityBlocked) return;
    const validation = validate();
    if (validation) {
      setError({ message: validation, validation: true });
      return;
    }
    const request = requests.begin();
    setPending(true);
    setError(null);
    try {
      const common = { expectedRevision: reviewItem.revision, idempotencyKey: intentKey };
      const response = snooze
        ? await snoozeReviewItem(reviewItem.id, {
            ...common,
            snoozedUntil: new Date(snoozedUntil).toISOString(),
            ...(note.trim() ? { note: note.trim() } : {}),
          }, { signal: request.signal })
        : await interpretReviewItem(reviewItem.id, {
            ...common,
            decision: "interpretation_recorded",
            note: note.trim(),
          }, { signal: request.signal });
      if (!request.isCurrent()) return;
      onSuccess(normalizeReviewItem(response.reviewItem, { detail: true }), response);
    } catch (requestError) {
      if (!request.isCurrent() || aborted(requestError)) return;
      const controlled = reviewError(requestError, "This Review action could not be recorded.");
      setError(controlled);
      if (controlled.stale || controlled.sourceStale) {
        setAuthorityBlocked(true);
        onAuthorityChanged?.(controlled);
      }
    } finally {
      if (request.isCurrent()) setPending(false);
      requests.finish(request);
    }
  };

  const startNewIntent = () => {
    setIntentKey(createReviewIntentKey(snooze ? "review-snooze" : "review-interpretation"));
    setAuthorityBlocked(false);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && !pending && onClose()}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1} className="max-h-[calc(100vh-3rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-slate-950 dark:text-slate-50">{snooze ? "Snooze Review item" : "Record Evaluation interpretation"}</h2>
            <p id={descriptionId} className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{snooze ? "Pause this item until a specific time. New source authority can still change its state." : "Record a bounded observational interpretation of the persisted Evaluation."}</p>
          </div>
          <button type="button" onClick={onClose} disabled={pending} aria-label="Close dialog" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
        </div>

        {error && <div role="alert" className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><div><p>{error.message}</p>{error.conflict && <button type="button" onClick={startNewIntent} className="mt-2 font-semibold underline">Start a new attempt</button>}{authorityBlocked && <button type="button" onClick={onClose} className="mt-2 block font-semibold underline">Close and review the latest item</button>}</div></div>}

        <div className="mt-5 space-y-4">
          {snooze && <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Snoozed until<input ref={firstControlRef} id={`${fieldId}-until`} type="datetime-local" value={snoozedUntil} onChange={(event) => { setSnoozedUntil(event.target.value); setError(null); }} aria-invalid={error?.validation || undefined} aria-describedby={error?.validation ? `${fieldId}-error` : undefined} className={inputClass} /></label>}
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">{snooze ? "Note (optional)" : "Interpretation"}<textarea ref={snooze ? undefined : firstControlRef} rows={5} maxLength={snooze ? 1000 : 2000} value={note} onChange={(event) => { setNote(event.target.value); setError(null); }} aria-invalid={error?.validation || undefined} aria-describedby={error?.validation ? `${fieldId}-error` : undefined} className={inputClass} /></label>
          <p className="text-right text-xs text-slate-400">{note.length}/{snooze ? 1000 : 2000}</p>
          {error?.validation && <p id={`${fieldId}-error`} className="sr-only">{error.message}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={pending} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-slate-700">Cancel</button>
          <button type="button" onClick={submit} disabled={pending || authorityBlocked} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950">{pending ? "Saving..." : snooze ? "Snooze" : "Record interpretation"}</button>
        </div>
      </section>
    </div>
  );
}
