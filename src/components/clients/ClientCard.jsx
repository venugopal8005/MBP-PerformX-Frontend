import { ChevronRight, Clock3 } from "lucide-react";

export default function ClientCard({
  name,
  account,
  reports,
  campaigns,
  updated,
  status,
}) {
  return (
    <div
      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]hover:shadow-md hover:-translate-y-px
transition-all duration-200"
    >
      <div className="flex items-center gap-4">
        <div
          className={`
            h-2.5 w-2.5 rounded-full
            ${status === "stable" ? "bg-emerald-500" : "bg-amber-500"}
          `}
        />

        <div>
          <h3 className="text-lg font-semibold text-slate-900">{name}</h3>

          <p className="mt-1 text-sm text-slate-500">{account}</p>
        </div>
      </div>

      <div className="flex items-center gap-10">
        <div className="text-sm text-slate-500">{reports} reports</div>

        <div className="text-sm text-slate-500">{campaigns} campaigns</div>

        <div className="flex items-center gap-1 text-sm text-slate-400">
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

        <ChevronRight size={18} className="text-slate-400" />
      </div>
    </div>
  );
}
