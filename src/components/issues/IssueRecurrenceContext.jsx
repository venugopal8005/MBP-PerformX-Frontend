import { ArrowRight, History, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getIssue } from "../../api/issues";
import {
  issueDate,
  issueLabel,
  issueStablePeriodLabel,
  mapIssue,
} from "../../utils/issues";
import { evaluationConfidenceLabel, evaluationResultLabel } from "../../utils/evaluations";

const unavailableMessage = "Earlier occurrence details are unavailable in this workspace.";

export default function IssueRecurrenceContext({ issue }) {
  const [state, setState] = useState({ owner: null, predecessor: null, loading: false, error: "" });
  const predecessorId = issue?.predecessorIssueId || null;

  useEffect(() => {
    if (!predecessorId) return undefined;
    const controller = new AbortController();
    const owner = predecessorId;
    queueMicrotask(() => setState({ owner, predecessor: null, loading: true, error: "" }));
    getIssue(predecessorId, { signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        const predecessor = mapIssue(response?.issue);
        if (predecessor.id !== owner) throw new Error("Predecessor ownership mismatch.");
        setState({ owner, predecessor, loading: false, error: "" });
      })
      .catch((error) => {
        if (controller.signal.aborted || error?.name === "AbortError" || error?.code === "ERR_CANCELED") return;
        setState({ owner, predecessor: null, loading: false, error: unavailableMessage });
      });
    return () => controller.abort();
  }, [predecessorId]);

  if (!predecessorId && !(issue?.reopenCount > 0)) return null;

  if (!predecessorId) {
    return (
      <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900/70 dark:bg-amber-950/20" aria-labelledby="recurrence-title">
        <div className="flex items-start gap-3">
          <History size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <div>
            <h2 id="recurrence-title" className="text-sm font-semibold text-slate-950 dark:text-slate-50">Reopened Issue</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              This same Issue has reopened {issue.reopenCount} {issue.reopenCount === 1 ? "time" : "times"}.
              {issue.reopenedAt ? ` Most recently reopened ${issueDate(issue.reopenedAt)}.` : ""}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const predecessor = state.owner === predecessorId ? state.predecessor : null;
  const stablePeriod = predecessor ? issueStablePeriodLabel(predecessor, issue) : "";
  return (
    <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900/70 dark:bg-amber-950/20" aria-labelledby="recurrence-title">
      <div className="flex items-start gap-3">
        <History size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id="recurrence-title" className="text-sm font-semibold text-slate-950 dark:text-slate-50">New recurrence after an earlier Issue</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Narrative linked this as a new occurrence rather than reopening the earlier Issue record.
          </p>

          {state.loading ? (
            <p role="status" className="mt-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <RefreshCw size={14} className="animate-spin" aria-hidden="true" /> Loading earlier occurrence summary...
            </p>
          ) : state.error || !predecessor ? (
            <p role="status" className="mt-4 text-sm text-slate-600 dark:text-slate-300">{unavailableMessage}</p>
          ) : (
            <div className="mt-4 rounded-lg border border-amber-200/80 bg-white/80 p-4 dark:border-amber-900/60 dark:bg-slate-950/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950 dark:text-slate-50">{predecessor.title || "Earlier Issue"}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Opened {issueDate(predecessor.openedAt)} · Resolved {issueDate(predecessor.resolvedAt)}
                  </p>
                </div>
                <span className="rounded-md border border-amber-200 px-2 py-1 text-xs font-medium text-amber-800 dark:border-amber-800 dark:text-amber-300">
                  {stablePeriod === "Stable period unavailable" ? stablePeriod : `${stablePeriod} stable`}
                </span>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div><dt className="text-xs text-slate-500 dark:text-slate-400">Previous actions</dt><dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{predecessor.interventionCount}</dd></div>
                <div><dt className="text-xs text-slate-500 dark:text-slate-400">Latest outcome</dt><dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{evaluationResultLabel(predecessor.latestEvaluationResult)}</dd></div>
                <div><dt className="text-xs text-slate-500 dark:text-slate-400">Confidence</dt><dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{evaluationConfidenceLabel(predecessor.latestEvaluationConfidence)}</dd></div>
              </dl>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Earlier status: {issueLabel(predecessor.status)}. Open the predecessor to review its paginated actions, Evaluations, and evidence timeline.
              </p>
              <Link
                to={`/issues/${encodeURIComponent(predecessor.id)}`}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-amber-800 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-amber-300"
              >
                View predecessor history <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
