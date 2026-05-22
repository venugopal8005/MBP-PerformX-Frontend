import { Plus, X } from "lucide-react";

import PageHeader from "../components/ui/PageHeader";

import ClientCard from "../components/clients/ClientCard";

import { clients } from "../data/mockData";

export default function Clients() {
  return (
    <div className="flex h-full">
      {/* LEFT */}
      <div className="flex-1 overflow-y-auto px-12 py-10">
        <div className="w-full max-w-[1250px]">
          <PageHeader
            title="Clients"
            meta="4 total"
            subtitle="Monitor connected ad accounts and reporting coverage."
            action={
              <button className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                <Plus size={16} />
                Add Client
              </button>
            }
          />

          <div className="mb-6 flex items-center justify-between border-b border-slate-200">
            <div className="flex items-center gap-8">
              <button className="border-b-2 border-slate-900 pb-3 text-sm font-medium text-slate-900">
                All clients
              </button>

              <button className="pb-3 text-sm text-slate-500">
                Attention needed
              </button>

              <button className="pb-3 text-sm text-slate-500">Critical</button>
            </div>

            <button className="pb-3 text-sm text-slate-500">
              Sort: Last signal
            </button>
          </div>

          <div className="space-y-3">
            {clients.map((client) => (
              <ClientCard key={client.id} {...client} />
            ))}

            <button className="flex w-full items-center gap-3 rounded-xl border border-dashed border-slate-300 px-5 py-5 text-sm text-slate-400 hover:bg-slate-50">
              <Plus size={16} />
              Add a new client to your workspace
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex h-full w-[360px] flex-col border-l border-slate-200 bg-white p-6">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">Add Client</h2>

          <button className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <p className="mb-8 text-sm leading-6 text-slate-500">
          Connect a new client and their Meta ad account to start generating
          reports.
        </p>
        <div className="flex-1 space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Client Name
            </label>

            <input
              type="text"
              value="Adidas"
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none"
              readOnly
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Meta Ad Account
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                value="Search or paste account ID..."
                className="flex-1 rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-400 outline-none"
                readOnly
              />

              <button className="rounded-lg border border-slate-200 px-4 text-sm font-medium">
                Connect
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-400">
              Must be a Business Manager account you have access to.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Notes (optional)
            </label>

            <textarea
              rows="4"
              className="w-full rounded-lg border border-slate-200 p-4 text-sm outline-none"
              placeholder="e.g. Brand campaign focus, EU market..."
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-700">
              Connected Account Preview
            </p>

            <div className="mt-4 space-y-3 text-sm text-slate-500">
              <div>Meta Business: Adidas Group Global</div>

              <div>4 ad accounts available</div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex items-center justify-between">
          <button className="text-sm text-slate-500">Cancel</button>

          <button className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800">
            Create Client
          </button>
        </div>
      </div>
    </div>
  );
}
