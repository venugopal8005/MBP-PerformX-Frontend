import { ArrowRight, Ban, RefreshCw, UserRound } from "lucide-react";

import { HistoryCollectionState } from "../history/HistoryPrimitives";
import StatusBadge from "../ui/StatusBadge";
import {
  interventionStatusLabel,
  interventionStatusVariant,
  interventionSummary,
  mapIntervention,
} from "../../utils/interventions";
import { issueDate } from "../../utils/issues";

const sameActor = (left, right) =>
  left?.displayName && right?.displayName && left.displayName === right.displayName;

export function InterventionHistoryCard({ value, highlighted = false, onOpen }) {
  const intervention = mapIntervention(value);
  return (
    <article
      className={`rounded-lg border bg-white p-4 shadow-sm transition dark:bg-slate-900/80 ${
        highlighted
          ? "border-emerald-400 ring-2 ring-emerald-100 dark:border-emerald-700 dark:ring-emerald-950"
          : "border-slate-200 dark:border-slate-800"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-950 dark:text-slate-50">
              {interventionSummary(intervention)}
            </h3>
            <StatusBadge variant={interventionStatusVariant(intervention.status)}>
              {interventionStatusLabel(intervention.status)}
            </StatusBadge>
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <UserRound size={13} aria-hidden="true" />
              {intervention.performedBy?.displayName || "Performer unavailable"}
            </span>
            <span>Performed {issueDate(intervention.performedAt)}</span>
            <span>Recorded {issueDate(intervention.recordedAt)}</span>
          </p>
          {!sameActor(intervention.performedBy, intervention.recordedBy) && intervention.recordedBy && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Recorded by {intervention.recordedBy.displayName}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onOpen(intervention.id)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
        >
          View details <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>

      {intervention.reason && (
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {intervention.reason}
        </p>
      )}
      {intervention.note && (
        <p className="mt-2 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
          Note: {intervention.note}
        </p>
      )}

      {intervention.status === "superseded" && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <RefreshCw size={13} aria-hidden="true" /> A replacement record was created.
        </div>
      )}
      {intervention.status === "cancelled" && intervention.cancellation && (
        <div className="mt-3 rounded-lg border border-rose-100 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-950 dark:bg-rose-950/30 dark:text-rose-200">
          <p className="flex items-center gap-2 font-semibold"><Ban size={14} aria-hidden="true" /> Cancelled</p>
          <p className="mt-1">{intervention.cancellation.reason}</p>
          <p className="mt-1 text-xs opacity-80">
            {intervention.cancellation.cancelledBy?.displayName
              ? `By ${intervention.cancellation.cancelledBy.displayName} · `
              : ""}
            {issueDate(intervention.cancellation.cancelledAt)}
          </p>
        </div>
      )}
    </article>
  );
}

export default function InterventionHistory({ state, highlightedId, onOpen }) {
  return (
    <HistoryCollectionState
      state={state}
      preserveItemsOnError
      emptyTitle="No actions recorded"
      emptyDescription="Human actions recorded after this Issue will appear here."
    >
      <div className="space-y-3">
        {state.items.map((value) => {
          const id = mapIntervention(value).id;
          return (
            <InterventionHistoryCard
              key={id}
              value={value}
              highlighted={id === highlightedId}
              onOpen={onOpen}
            />
          );
        })}
      </div>
    </HistoryCollectionState>
  );
}
