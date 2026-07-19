import { Filter, ListChecks, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { getReviewFilterClients, getReviewItems } from "../api/reviews";
import { ListSkeleton } from "../components/ui/Skeleton";
import useCursorHistory from "../hooks/useCursorHistory";
import {
  REVIEW_PRIORITIES,
  REVIEW_STATES,
  REVIEW_TYPES,
  normalizeReviewPage,
  reviewAge,
  reviewError,
  reviewLabel,
} from "../utils/reviews";

const DEFAULT_STATES = "open,acknowledged";
const controlClass = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-slate-800";
const priorityClass = { critical: "border-rose-200 bg-rose-50 text-rose-700", high: "border-amber-200 bg-amber-50 text-amber-700", normal: "border-slate-200 bg-slate-50 text-slate-600" };

function ReviewActions({ item }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link to={`/reviews/${item.id}`} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-400 dark:border-slate-700 dark:text-slate-200">View details</Link>
    </div>
  );
}

export default function Reviews() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [clients, setClients] = useState([]);
  const campaignInputRef = useRef(null);

  const filters = useMemo(() => ({
    state: searchParams.get("state") || DEFAULT_STATES,
    type: searchParams.get("type") || "",
    priority: searchParams.get("priority") || "",
    clientId: searchParams.get("clientId") || "",
    campaignId: searchParams.get("campaignId") || "",
  }), [searchParams]);
  const filterKey = new URLSearchParams(filters).toString();

  useEffect(() => {
    const controller = new AbortController();
    getReviewFilterClients({ signal: controller.signal }).then((items) => {
      if (controller.signal.aborted) return;
      setClients(items.map((client) => ({ id: client.id || client._id, name: client.name })).filter((client) => client.id && client.name));
    }).catch(() => {});
    return () => controller.abort();
  }, []);

  const loadPage = useCallback(async ({ cursor, signal }) => {
    try {
      const response = await getReviewItems({ ...filters, cursor, limit: 25, signal });
      return normalizeReviewPage(response);
    } catch (error) {
      throw new Error(reviewError(error).message, { cause: error });
    }
  }, [filters]);
  const queue = useCursorHistory({ loadPage, resetKey: `review-queue:${filterKey}` });

  const updateFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (!value || (key === "state" && value === DEFAULT_STATES)) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };
  const filtered = filters.type || filters.priority || filters.clientId || filters.campaignId || filters.state !== DEFAULT_STATES;

  const reset = () => setSearchParams({}, { replace: true });

  return (
    <div className="h-full overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1280px]">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
          <div><div className="flex items-center gap-2"><ListChecks size={21} /><h1 className="text-2xl font-semibold text-slate-950 dark:text-slate-50">Review</h1></div><p className="mt-1 text-sm text-slate-500">Prioritized workspace decisions from persisted Issues and Evaluations.</p></div>
        </header>

        <form onSubmit={(event) => { event.preventDefault(); updateFilter("campaignId", campaignInputRef.current?.value.trim() || ""); }} className="mt-5 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/80">
          <fieldset><legend className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><Filter size={15} /> Queue filters</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <label className="text-xs font-medium text-slate-500">State<select aria-label="Review state" value={filters.state} onChange={(event) => updateFilter("state", event.target.value)} className={`mt-1 w-full ${controlClass}`}><option value={DEFAULT_STATES}>Open and acknowledged</option>{REVIEW_STATES.map((state) => <option key={state} value={state}>{reviewLabel(state)}</option>)}</select></label>
              <label className="text-xs font-medium text-slate-500">Type<select aria-label="Review type" value={filters.type} onChange={(event) => updateFilter("type", event.target.value)} className={`mt-1 w-full ${controlClass}`}><option value="">All types</option>{REVIEW_TYPES.map((type) => <option key={type} value={type}>{reviewLabel(type)}</option>)}</select></label>
              <label className="text-xs font-medium text-slate-500">Priority<select aria-label="Review priority" value={filters.priority} onChange={(event) => updateFilter("priority", event.target.value)} className={`mt-1 w-full ${controlClass}`}><option value="">All priorities</option>{REVIEW_PRIORITIES.map((priority) => <option key={priority} value={priority}>{reviewLabel(priority)}</option>)}</select></label>
              <label className="text-xs font-medium text-slate-500">Client<select aria-label="Review Client" value={filters.clientId} onChange={(event) => updateFilter("clientId", event.target.value)} className={`mt-1 w-full ${controlClass}`}><option value="">All Clients</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
              <label className="text-xs font-medium text-slate-500">Campaign ID<div className="mt-1 flex gap-2"><input key={filters.campaignId} ref={campaignInputRef} aria-label="Exact campaign ID" defaultValue={filters.campaignId} className={`min-w-0 flex-1 ${controlClass}`} /><button type="submit" className="rounded-lg border border-slate-300 px-3 text-xs font-semibold dark:border-slate-700">Apply</button></div></label>
            </div>
          </fieldset>
          {filtered && <button type="button" onClick={reset} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-600 underline"><RotateCcw size={13} /> Reset filters</button>}
        </form>

        <section className="mt-5" aria-labelledby="review-queue-heading">
          <h2 id="review-queue-heading" className="sr-only">Review queue</h2>
          {queue.isLoading && queue.items.length === 0 ? <div role="status"><span className="sr-only">Loading Review queue.</span><ListSkeleton count={5} /></div> : queue.error && queue.items.length === 0 ? <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800"><p>{queue.error}</p><button type="button" onClick={queue.retry} className="mt-2 font-semibold underline">Retry</button></div> : queue.items.length === 0 ? <div className="rounded-lg border border-slate-200 bg-white px-5 py-12 text-center dark:border-slate-800 dark:bg-slate-900/80"><h3 className="text-sm font-semibold">{filtered ? "No Review items match these filters" : "Review queue is clear"}</h3><p className="mt-2 text-sm text-slate-500">{filtered ? "Adjust the filters to see other persisted Review items." : "New persisted review items will appear here."}</p></div> : <>
            <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block dark:border-slate-800 dark:bg-slate-900/80"><table className="w-full table-fixed text-left text-sm"><caption className="sr-only">Workspace Review queue in backend priority order</caption><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950/60"><tr><th className="w-[10%] px-4 py-3">Priority</th><th className="w-[15%] px-4 py-3">Client</th><th className="w-[17%] px-4 py-3">Campaign</th><th className="w-[23%] px-4 py-3">Reason</th><th className="w-[13%] px-4 py-3">State</th><th className="w-[8%] px-4 py-3">Age</th><th className="w-[14%] px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-800">{queue.items.map((item) => <tr key={item.id}><td className="px-4 py-4"><span className={`rounded-full border px-2 py-1 text-xs font-semibold ${priorityClass[item.priority]}`}>{reviewLabel(item.priority)}</span></td><td className="break-words px-4 py-4 font-medium">{item.client.name || "Unavailable"}</td><td className="break-words px-4 py-4 text-slate-600 dark:text-slate-300">{item.campaign.name || "All campaign context"}</td><td className="px-4 py-4"><p className="font-medium">{reviewLabel(item.reason)}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500">{reviewLabel(item.type)} · {item.source.title || "Persisted source"}</p></td><td className="px-4 py-4">{reviewLabel(item.state)}</td><td className="px-4 py-4 text-slate-500">{reviewAge(item.latestEvidenceAt)}</td><td className="px-4 py-4"><ReviewActions item={item} /></td></tr>)}</tbody></table></div>
            <div className="space-y-3 md:hidden" aria-label="Review queue mobile list">{queue.items.map((item) => <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/80"><div className="flex items-center justify-between gap-3"><span className={`rounded-full border px-2 py-1 text-xs font-semibold ${priorityClass[item.priority]}`}>{reviewLabel(item.priority)} priority</span><span className="text-xs text-slate-500">{reviewAge(item.latestEvidenceAt)}</span></div><h3 className="mt-3 font-semibold">{reviewLabel(item.reason)}</h3><dl className="mt-3 grid grid-cols-[100px_1fr] gap-2 text-sm"><dt className="text-slate-500">Client</dt><dd>{item.client.name || "Unavailable"}</dd><dt className="text-slate-500">Campaign</dt><dd className="break-words">{item.campaign.name || "All campaign context"}</dd><dt className="text-slate-500">Source</dt><dd>{reviewLabel(item.type)}</dd><dt className="text-slate-500">State</dt><dd>{reviewLabel(item.state)}</dd></dl><div className="mt-4"><ReviewActions item={item} /></div></article>)}</div>
            {queue.error && <div role="alert" className="mt-4 text-sm text-amber-700">More Review items could not be loaded. Existing items are still shown. <button type="button" onClick={queue.retry} className="font-semibold underline">Retry</button></div>}
            {queue.hasMore && <button type="button" onClick={queue.loadMore} disabled={queue.isLoadingMore} className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-slate-700">{queue.isLoadingMore ? "Loading..." : "Load more"}</button>}
          </>}
        </section>
      </div>
    </div>
  );
}
