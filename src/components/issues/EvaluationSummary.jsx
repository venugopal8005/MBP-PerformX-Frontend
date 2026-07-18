import { ArrowRight, Clock3 } from "lucide-react";

import {
  evaluationMetricLabel,
  evaluationResultLabel,
  evaluationStatusLabel,
  formatEvaluationMetric,
  formatEvaluationRelativeDelta,
} from "../../utils/evaluations";
import StatusBadge from "../ui/StatusBadge";

export default function EvaluationSummary({ intervention, evaluation, onOpen }) {
  if (!intervention?.id || !evaluation) return null;

  const awaiting = evaluation.status === "awaiting_follow_up";
  const status = evaluation.effectiveStatus || evaluation.status;

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Persisted evaluation</span>
            <StatusBadge variant={awaiting ? "low" : "medium"}>{evaluationStatusLabel(status)}</StatusBadge>
            <span className="text-xs text-slate-400 dark:text-slate-500">Version {evaluation.sequence}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700 dark:text-slate-300">
            <span className="font-medium">{evaluationMetricLabel(evaluation.primaryMetric)}</span>
            {evaluation.baselineValue !== null && <span>Baseline {formatEvaluationMetric(evaluation.primaryMetric, evaluation.baselineValue)}</span>}
            {evaluation.followUpValue !== null && <span>Follow-up {formatEvaluationMetric(evaluation.primaryMetric, evaluation.followUpValue)}</span>}
            {evaluation.relativeDelta !== null && <span>Change {formatEvaluationRelativeDelta(evaluation.relativeDelta)}</span>}
          </div>
          {evaluation.observedResult && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{evaluationResultLabel(evaluation.observedResult)}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onOpen(intervention.id)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-slate-400 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          {awaiting ? <Clock3 size={13} aria-hidden="true" /> : null}
          {awaiting ? "View evidence status" : "View evaluation"}
          <ArrowRight size={13} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
