import { Check, Plus, Search, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ListSkeleton } from "../ui/Skeleton";

export default function ReportClientSelectModal({
  clients,
  error = "",
  isLoading = false,
  selectedClient,
  onClose,
  onCreateClient,
  onContinue,
  onSelectClient,
}) {
  const [query, setQuery] = useState("");
  const filteredClients = useMemo(() => {
    const term = query.trim().toLowerCase();

    if (!term) return clients;

    return clients.filter((client) => {
      return [client.name, client.account, client.industry]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term));
    });
  }, [clients, query]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-50">Choose a client</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Select the client this report should monitor.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close client selection"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search clients..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-700"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {error}
            </div>
          )}

          <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
            {isLoading && (
              <ListSkeleton count={3} compact />
            )}

            {filteredClients.map((client) => {
              const isSelected = selectedClient?.id === client.id;

              return (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => onSelectClient(client)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-4 text-left transition ${
                    isSelected
                      ? "border-slate-900 bg-slate-50 dark:border-slate-100 dark:bg-slate-800"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        isSelected
                          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {isSelected ? <Check size={16} /> : <Users size={16} />}
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">{client.name}</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {client.account || "No Meta account selected"}
                      </p>
                    </div>
                  </div>

                  <div className="hidden items-center gap-4 text-sm text-slate-500 dark:text-slate-400 sm:flex">
                    <span>{client.reports || 0} reports</span>
                    <span>{client.campaigns || 0} campaigns</span>
                  </div>
                </button>
              );
            })}

            {!isLoading && !filteredClients.length && (
              <div className="rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center dark:border-slate-700">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No clients found</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Create a client to start the report flow.
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onCreateClient}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50"
          >
            <Plus size={16} />
            Create new client
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/50">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!selectedClient}
            onClick={() => selectedClient && onContinue(selectedClient)}
            className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
