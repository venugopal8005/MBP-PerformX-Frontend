import { Download } from "lucide-react";
import { useState } from "react";

import PageHeader from "../components/ui/PageHeader";
import PageTabs from "../components/ui/PageTabs";

import ActivityFeed from "../components/activity/ActivityFeed";
import ActivitySidebar from "../components/activity/ActivitySidebar";

export default function Activity() {
  const [activeTab, setActiveTab] = useState("All");
  const tabs = [
    "All",
    "Critical",
    "Signals",
    "Decisions",
    "Reports",
  ];

  return (
    <div className="flex h-full min-h-0">
      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto px-8 py-3">
        <PageHeader
          title="Activity"
          subtitle="Live operational monitoring across all connected clients."
          rightSlot={
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
              Updated live
            </div>
          }
          actions={
            <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
              <Download size={16} />
              Export
            </button>
          }
        />

        <PageTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        <div className="mt-6">
          <ActivityFeed activeFilter={activeTab} />
        </div>
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="w-[360px] overflow-y-auto border-l border-slate-200/80 bg-[#FCFCFB] p-5 dark:border-slate-800 dark:bg-slate-950/60">
        <ActivitySidebar />
      </div>
    </div>
  );
}
