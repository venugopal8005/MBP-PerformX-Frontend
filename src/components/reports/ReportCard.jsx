import { Clock3, Eye, Pencil, Send, Trash2 } from "lucide-react";

import Card from "../ui/Card";
import FrequencyBadge from "../ui/FrequencyBadge";
import StatusBadge from "../ui/StatusBadge";

export default function ReportCard({
  id,
  title,
  client,
  campaigns,
  insight,
  frequency,
  status,
  nextRun,
  clientDeliveryMode,
  latestRunId,
  latestInternalStatus,
  latestClientStatus,
  latestDateRange,
  latestSafetyStatus,
  latestSafetyReasons = [],
  latestGeneratedAt,
  latestSentAt,
  canApproveLatest = false,
  onOpen,
  onPreview,
  onApproveLatest,
  onEdit,
  onDelete,
  isApprovingLatest = false,
  isEditing = false,
  isDeleting = false,
}) {
  const deliveryLabel = clientDeliveryMode
    ? clientDeliveryMode.replaceAll("_", " ")
    : "generate only";
  const latestGenerated = latestGeneratedAt
    ? new Date(latestGeneratedAt).toLocaleString()
    : "";
  const latestSent = latestSentAt ? new Date(latestSentAt).toLocaleString() : "";
  const safetyClassName =
    latestSafetyStatus === "Needs review"
      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300"
      : latestSafetyStatus === "Passed"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300"
        : "border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400";

  return (
    <Card
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={() => onOpen?.(id)}
      onKeyDown={(event) => {
        if (!onOpen || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        onOpen(id);
      }}
      className={`space-y-4 py-4 ${onOpen ? "cursor-pointer transition hover:-translate-y-px hover:border-slate-300 hover:shadow-md dark:hover:border-slate-700" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />

            <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">{title}</h3>
          </div>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {client} - {campaigns} campaigns
          </p>
        </div>

        <FrequencyBadge frequency={frequency} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
        <p className="text-sm italic text-slate-600 dark:text-slate-300">"{insight}"</p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium capitalize text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {deliveryLabel}
        </span>
        {latestInternalStatus && (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium capitalize text-emerald-700">
            Internal {latestInternalStatus}
          </span>
        )}
        {latestClientStatus && (
          <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 font-medium capitalize text-sky-700">
            Client {latestClientStatus.replaceAll("_", " ")}
          </span>
        )}
        {latestSafetyStatus && (
          <span
            title={latestSafetyReasons.length ? latestSafetyReasons.join(" ") : undefined}
            className={`rounded-full border px-2.5 py-1 font-medium ${safetyClassName}`}
          >
            Safety {latestSafetyStatus}
          </span>
        )}
        {latestDateRange && (
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            Range {latestDateRange}
          </span>
        )}
        {latestGenerated && (
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            Generated {latestGenerated}
          </span>
        )}
        {latestSent && (
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            Sent {latestSent}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusBadge variant={status}>{status}</StatusBadge>

          <div className="flex items-center gap-1 text-sm text-slate-400 dark:text-slate-500">
            <Clock3 size={14} />
            {nextRun}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 text-slate-400 dark:text-slate-500">
          {latestRunId && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onPreview?.(id, "client");
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label={`Preview client report for ${title}`}
              >
                <Eye size={14} />
                Client
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onPreview?.(id, "internal");
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label={`Preview internal report for ${title}`}
              >
                <Eye size={14} />
                Internal
              </button>
            </>
          )}

          {canApproveLatest && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onApproveLatest?.(id);
              }}
              disabled={isApprovingLatest}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
              aria-label={`Approve and send client report for ${title}`}
            >
              <Send size={14} />
              {isApprovingLatest ? "Sending" : "Approve"}
            </button>
          )}

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit?.(id);
            }}
            disabled={isEditing}
            className="rounded-md p-1 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label={`Edit ${title}`}
          >
            <Pencil size={16} />
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete?.(id);
            }}
            disabled={isDeleting}
            className="rounded-md p-1 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
            aria-label={`Delete ${title}`}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </Card>
  );
}
