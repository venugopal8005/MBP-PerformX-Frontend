import PageHeader from "../components/ui/PageHeader";

import ReportCard from "../components/reports/ReportCard";

import ActivityPanel from "../components/activity/ActivityPanel";
import { Plus } from "lucide-react";

import { reports } from "../data/mockData";

export default function Reports() {
  return (
    <div className="flex h-full">
      {/* LEFT CONTENT */}
      <div className="flex-1 overflow-y-auto px-10 py-8">
      <div className="w-full max-w-[1100px]">
          <PageHeader
            title="Reports"
            meta="3 total"
            subtitle="Operational narrative monitoring across all clients."
            action={
              <button className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                <Plus size={16} />
                New Report
              </button>
            }
          />

          <div className="space-y-4">
            {reports.map((report) => (
              <ReportCard key={report.id} {...report} />
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-[360px] border-l border-slate-200 bg-white p-5">
        <ActivityPanel />
      </div>
    </div>
  );
}
