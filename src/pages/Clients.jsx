import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import PageHeader from "../components/ui/PageHeader";
import { ListSkeleton } from "../components/ui/Skeleton";

import ActivityPanel from "../components/activity/ActivityPanel";
import ClientCard from "../components/clients/ClientCard";
import CreateClientModal from "../components/clients/CreateClientModal";

import api from "../api/axios";

const mapBackendClient = (client) => ({
  id: client._id,
  _id: client._id,
  name: client.name,
  account:
    client.meta_ad_account?.name ||
    client.account ||
    client.ad_account_name ||
    "Meta account not assigned",
  metaAdAccount: client.meta_ad_account || null,
  reports: client.reports || 0,
  campaigns: client.campaigns || 0,
  updated: client.updatedAt ? "Recently updated" : "Just now",
  updatedAt: client.updatedAt,
  createdAt: client.createdAt,
  status: client.status || "stable",
  industry: client.industry,
  notes: client.notes,
});

export default function Clients() {
  const navigate = useNavigate();
  const [clientList, setClientList] = useState([]);
  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [clientPendingDelete, setClientPendingDelete] = useState(null);
  const [activeClientFilter, setActiveClientFilter] = useState("All clients");
  const [sortMode, setSortMode] = useState("recent");
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [isUpdatingClient, setIsUpdatingClient] = useState(false);
  const [isDeletingClient, setIsDeletingClient] = useState(false);
  const [pageError, setPageError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const visibleClients = useMemo(() => {
    const filtered = clientList.filter((client) => {
      if (activeClientFilter === "Critical") return client.status === "critical";
      if (activeClientFilter === "Attention needed") {
        return client.status === "moderate" || client.status === "critical";
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === "name") return a.name.localeCompare(b.name);

      return (
        new Date(b.updatedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.createdAt || 0).getTime()
      );
    });
  }, [activeClientFilter, clientList, sortMode]);

  useEffect(() => {
    let cancelled = false;

    const loadInitialClients = async () => {
      try {
        const res = await api.get("/clients");

        if (!cancelled) {
          setClientList((res.data?.clients || []).map(mapBackendClient));
        }
      } catch (err) {
        if (!cancelled) {
          setPageError(err.response?.data?.message || "Could not load clients.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingClients(false);
        }
      }
    };

    loadInitialClients();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreateClient = async (clientDraft) => {
    setIsSavingClient(true);
    setPageError("");

    try {
      const res = await api.post("/clients", {
        name: clientDraft.name,
        industry: clientDraft.industry,
        notes: clientDraft.notes,
        status: clientDraft.status || "stable",
      });
      const nextClient = mapBackendClient(res.data.client);

      setClientList((current) => [nextClient, ...current]);
      setIsCreateClientOpen(false);
    } catch (err) {
      setPageError(err.response?.data?.message || "Could not create client.");
    } finally {
      setIsSavingClient(false);
    }
  };

  const handleUpdateClient = async (clientDraft) => {
    if (!editingClient?.id) return;

    setIsUpdatingClient(true);
    setPageError("");

    try {
      const res = await api.patch(`/clients/${editingClient.id}`, {
        name: clientDraft.name,
        industry: clientDraft.industry,
        notes: clientDraft.notes,
        status: clientDraft.status || "stable",
      });
      const updatedClient = mapBackendClient(res.data.client);

      setClientList((current) =>
        current.map((client) => (client.id === updatedClient.id ? updatedClient : client))
      );
      setEditingClient(null);
    } catch (err) {
      setPageError(err.response?.data?.message || "Could not update client.");
    } finally {
      setIsUpdatingClient(false);
    }
  };

  const openDeleteClientDialog = (clientId) => {
    const client = clientList.find((item) => item.id === clientId);
    if (!client) return;

    setClientPendingDelete(client);
    setDeleteError("");
  };

  const closeDeleteClientDialog = () => {
    if (isDeletingClient) return;
    setClientPendingDelete(null);
    setDeleteError("");
  };

  const confirmDeleteClient = async () => {
    if (!clientPendingDelete?.id) return;

    setIsDeletingClient(true);
    setDeleteError("");
    setPageError("");

    try {
      await api.delete(`/clients/${clientPendingDelete.id}`);
      setClientList((current) =>
        current.filter((client) => client.id !== clientPendingDelete.id)
      );
      setClientPendingDelete(null);
    } catch (err) {
      setDeleteError(err.response?.data?.message || "Could not delete this client.");
    } finally {
      setIsDeletingClient(false);
    }
  };

  return (
    <>
      <div className="flex h-full min-h-0">
        {/* LEFT */}
        <div className="flex-1 overflow-y-auto px-8 py-3">
          <div className="w-full max-w-[1250px]">
            <PageHeader
              title="Clients"
              meta={`${clientList.length} total`}
              subtitle="Monitor connected ad accounts and reporting coverage."
              actions={
                <button
                  onClick={() => setIsCreateClientOpen(true)}
                  className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 cursor-pointer text-sm font-medium text-white hover:bg-slate-800"
                >
                  <Plus size={16} />
                  Add Client
                </button>
              }
            />

            {pageError && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {pageError}
              </div>
            )}

            <div className="mb-6 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-8">
                {["All clients", "Attention needed", "Critical"].map((filter) => {
                  const active = activeClientFilter === filter;

                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setActiveClientFilter(filter)}
                      className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                        active
                          ? "border-slate-900 text-slate-900 dark:border-slate-100 dark:text-slate-50"
                          : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                      }`}
                    >
                      {filter}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setSortMode((current) => (current === "recent" ? "name" : "recent"))}
                className="pb-3 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Sort: {sortMode === "recent" ? "Recent" : "Name"}
              </button>
            </div>

            <div className="space-y-3">
              {isLoadingClients ? (
                <ListSkeleton count={4} />
              ) : visibleClients.length ? (
                visibleClients.map((client) => (
                  <ClientCard
                    key={client.id}
                    {...client}
                    onOpen={(clientId) => navigate(`/clients/${clientId}`)}
                    onEdit={() => setEditingClient(client)}
                    onDelete={openDeleteClientDialog}
                    isEditing={isUpdatingClient && editingClient?.id === client.id}
                    isDeleting={isDeletingClient && clientPendingDelete?.id === client.id}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                  <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                    {clientList.length ? "No clients match this filter" : "No clients yet"}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {clientList.length
                      ? "Try another status filter to see more clients."
                      : "Add a client, then connect Meta from the report creation flow."}
                  </p>
                </div>
              )}

              <button
                onClick={() => setIsCreateClientOpen(true)}
                className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-slate-300 px-5 py-5 text-sm font-medium text-slate-400 hover:bg-white hover:text-slate-700 dark:border-slate-700 dark:text-slate-500 dark:hover:bg-slate-900 dark:hover:text-slate-200"
              >
                <Plus size={16} />
                Add a new client to your workspace
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="w-[360px] overflow-y-auto border-l border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950/60">
          <ActivityPanel />
        </div>
      </div>

      {isCreateClientOpen && (
        <CreateClientModal
          onClose={() => setIsCreateClientOpen(false)}
          onCreate={handleCreateClient}
          isSubmitting={isSavingClient}
          submitLabel={isSavingClient ? "Creating..." : "Create Client"}
        />
      )}

      {editingClient && (
        <CreateClientModal
          title="Edit Client"
          description="Update the client workspace details used across reports and monitoring."
          initialValues={editingClient}
          onClose={() => {
            if (!isUpdatingClient) setEditingClient(null);
          }}
          onCreate={handleUpdateClient}
          isSubmitting={isUpdatingClient}
          submitLabel={isUpdatingClient ? "Saving..." : "Save Changes"}
        />
      )}

      {clientPendingDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                  <Trash2 size={20} />
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Delete client?</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    This removes the client, its reports, saved signals, activity, and Meta connection.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
                <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                  {clientPendingDelete.name}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {clientPendingDelete.reports} reports - {clientPendingDelete.campaigns} campaigns
                </p>
              </div>

              {deleteError && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {deleteError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
              <button
                type="button"
                onClick={closeDeleteClientDialog}
                disabled={isDeletingClient}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDeleteClient}
                disabled={isDeletingClient}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 size={16} />
                {isDeletingClient ? "Deleting..." : "Delete client"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
