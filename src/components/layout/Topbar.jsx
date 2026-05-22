import {
  Bell,
  Search,
} from "lucide-react";

export default function Topbar() {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div className="relative w-105">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />

        <input
          type="text"
          placeholder="Search reports, campaigns, clients..."
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm outline-none focus:border-slate-300"
        />
      </div>

      <div className="flex items-center gap-4">
        <button className="rounded-full p-2 hover:bg-slate-100">
          <Bell size={18} />
        </button>

        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-medium text-white">
          AM
        </div>
      </div>
    </header>
  );
}