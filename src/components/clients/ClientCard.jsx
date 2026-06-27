import { ChevronRight, Clock3, Pencil, Trash2 } from "lucide-react";

export default function ClientCard({
  id,
  name,
  account,
  reports,
  campaigns,
  updated,
  status,
  onOpen,
  onEdit,
  onDelete,
  isEditing = false,
  isDeleting = false,
}) {
  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={() => onOpen?.(id)}
      onKeyDown={(event) => {
        if (!onOpen || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        onOpen(id);
      }}
      className={`flex items-center justify-between rounded-2xl border border-slate-200/90 bg-white px-5 py-5 shadow-[var(--shadow-card)] transition-all duration-200 dark:border-slate-800 dark:bg-slate-900/80 ${
        onOpen ? "cursor-pointer hover:-translate-y-px hover:border-slate-300 hover:shadow-md dark:hover:border-slate-700" : ""
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`
            h-2.5 w-2.5 rounded-full
            ${status === "stable" ? "bg-emerald-500" : "bg-amber-500"}
          `}
        />

        <div>
          <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">{name}</h3>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{account}</p>
        </div>
      </div>

      <div className="flex items-center gap-7">
        <div className="text-sm text-slate-500 dark:text-slate-400">{reports} reports</div>

        <div className="text-sm text-slate-500 dark:text-slate-400">{campaigns} campaigns</div>

        <div className="flex items-center gap-1 text-sm text-slate-400 dark:text-slate-500">
          <Clock3 size={14} />
          {updated}
        </div>

        <span
          className={`
            rounded-md px-2 py-1 text-xs font-medium
            ${
              status === "stable"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }
          `}
        >
          {status}
        </span>

        <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit?.(id);
            }}
            disabled={isEditing}
            className="rounded-md p-1 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label={`Edit ${name}`}
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
            aria-label={`Delete ${name}`}
          >
            <Trash2 size={16} />
          </button>
        </div>

        <ChevronRight size={18} className="text-slate-400 dark:text-slate-500" />
      </div>
    </div>
  );
}
