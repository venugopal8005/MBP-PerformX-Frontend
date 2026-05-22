import { Clock3, Pencil, Trash2 } from "lucide-react";

import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";

export default function ReportCard({
  title,
  client,
  campaigns,
  insight,
  frequency,
  status,
  nextRun,
}) {
  return (
    <Card className="space-y-4 py-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />

            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          </div>

          <p className="mt-1 text-sm text-slate-500">
            {client} • {campaigns} campaigns
          </p>
        </div>

        <div>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            {frequency}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm italic text-slate-600">"{insight}"</p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusBadge variant={status}>{status}</StatusBadge>

          <div className="flex items-center gap-1 text-sm text-slate-400">
            <Clock3 size={14} />
            {nextRun}
          </div>
        </div>

        <div className="flex items-center gap-3 text-slate-400">
          <button className="hover:text-slate-700">
            <Pencil size={16} />
          </button>

          <button className="hover:text-rose-600">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </Card>
  );
}
