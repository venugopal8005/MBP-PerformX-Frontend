import {
  FileText,
  Bell,
  Loader2,
  Moon,
  Search,
  Sun,
  Target,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import api from "../../api/axios";

const normalizeText = (value = "") => String(value || "").trim().toLowerCase();

const idFromRef = (value) => {
  if (!value) return "";
  if (typeof value === "object") return value._id || value.id || "";
  return value;
};

const clientNameOfReport = (report) => {
  if (report.client_id && typeof report.client_id === "object") {
    return report.client_id.name || "Client";
  }

  return report.client_name || report.client || "Client";
};

const campaignsOfReport = (report) =>
  Array.isArray(report.monitored_campaigns)
    ? report.monitored_campaigns
    : Array.isArray(report.campaigns)
      ? report.campaigns
      : [];

export default function Topbar() {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.user);
  const [theme, setTheme] = useState(() => {
    return document.documentElement.dataset.theme || "light";
  });
  const [query, setQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchData, setSearchData] = useState({
    clients: [],
    reports: [],
  });
  const searchRef = useRef(null);
  const avatar = user?.avatar || user?.avatar_url;
  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";
  const isDark = theme === "dark";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("narrative-theme", theme);
  }, [isDark, theme]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!searchRef.current?.contains(event.target)) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    const term = query.trim();

    if (term.length < 2) {
      setSearchData({ clients: [], reports: [] });
      setSearchError("");
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    setSearchError("");

    const timer = window.setTimeout(async () => {
      try {
        const [clientsResult, reportsResult] = await Promise.allSettled([
          api.get("/clients"),
          api.get("/reports/get-reports"),
        ]);

        if (cancelled) return;

        if (clientsResult.status === "rejected" && reportsResult.status === "rejected") {
          setSearchError("Search is unavailable right now.");
          setSearchData({ clients: [], reports: [] });
          return;
        }

        setSearchData({
          clients:
            clientsResult.status === "fulfilled"
              ? clientsResult.value.data?.clients || []
              : [],
          reports: reportsResult.status === "fulfilled" ? reportsResult.value.data || [] : [],
        });
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const searchResults = useMemo(() => {
    const term = normalizeText(query);
    if (term.length < 2) return [];

    const clientResults = searchData.clients
      .filter((client) =>
        [client.name, client.account, client.ad_account_name, client.industry]
          .filter(Boolean)
          .some((value) => normalizeText(value).includes(term))
      )
      .slice(0, 4)
      .map((client) => ({
        id: `client-${client._id || client.id}`,
        type: "Client",
        title: client.name || "Unnamed client",
        subtitle: client.account || client.ad_account_name || client.industry || "Client workspace",
        path: `/clients/${client._id || client.id}`,
        Icon: Users,
      }));

    const reportResults = searchData.reports
      .filter((report) =>
        [report.name, clientNameOfReport(report), report.last_summary]
          .filter(Boolean)
          .some((value) => normalizeText(value).includes(term))
      )
      .slice(0, 4)
      .map((report) => ({
        id: `report-${report._id || report.id}`,
        type: "Report",
        title: report.name || "Untitled report",
        subtitle: `${clientNameOfReport(report)} - ${campaignsOfReport(report).length || 0} campaigns`,
        path: `/reports/${report._id || report.id}`,
        Icon: FileText,
      }));

    const campaignResults = searchData.reports
      .flatMap((report) =>
        campaignsOfReport(report).map((campaign) => {
          const campaignName =
            campaign.campaign_name || campaign.name || campaign.campaign_id || "Campaign";

          return {
            campaignName,
            report,
            id: `campaign-${report._id || report.id}-${campaign.campaign_id || campaign.id || campaignName}`,
          };
        })
      )
      .filter((item) => normalizeText(item.campaignName).includes(term))
      .slice(0, 4)
      .map((item) => ({
        id: item.id,
        type: "Campaign",
        title: item.campaignName,
        subtitle: `In ${item.report.name || "report"} - ${clientNameOfReport(item.report)}`,
        path: `/reports/${item.report._id || item.report.id}`,
        Icon: Target,
      }));

    return [...clientResults, ...reportResults, ...campaignResults].slice(0, 8);
  }, [query, searchData.clients, searchData.reports]);

  const openSearchResult = (result) => {
    if (!result?.path) return;
    setQuery("");
    setIsSearchOpen(false);
    navigate(result.path);
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === "Escape") {
      setIsSearchOpen(false);
      return;
    }

    if (event.key === "Enter" && searchResults[0]) {
      event.preventDefault();
      openSearchResult(searchResults[0]);
    }
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-6 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
      <div ref={searchRef} className="relative w-[420px]">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
        />

        <input
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsSearchOpen(true);
          }}
          onFocus={() => setIsSearchOpen(true)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search reports, campaigns, clients..."
          className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2 pl-10 pr-10 text-sm text-slate-900 outline-none shadow-sm placeholder:text-slate-400 focus:border-slate-300 focus:bg-white dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-700 dark:focus:bg-slate-900"
        />

        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSearchError("");
              setIsSearchOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        ) : null}

        {isSearchOpen && query.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:text-slate-500">
              Search results
            </div>

            {isSearching ? (
              <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-500 dark:text-slate-400">
                <Loader2 size={15} className="animate-spin" />
                Searching workspace...
              </div>
            ) : searchError ? (
              <div className="px-4 py-4 text-sm text-amber-700 dark:text-amber-300">
                {searchError}
              </div>
            ) : searchResults.length ? (
              <div className="max-h-[420px] overflow-y-auto p-2">
                {searchResults.map((result) => {
                  const Icon = result.Icon;

                  return (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => openSearchResult(result)}
                      className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/70"
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">
                            {result.title}
                          </span>
                          <span className="shrink-0 rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                            {result.type}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                          {result.subtitle}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">
                No matching clients, reports, or campaigns.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Light mode" : "Dark mode"}
        >
          {isDark ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <button className="rounded-full p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">
          <Bell size={18} />
        </button>

        <div className="flex min-w-0 items-center gap-3">
          <div className="hidden min-w-0 text-right sm:block">
            <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
              {user?.fullName || "User"}
            </div>

            <div className="truncate text-xs text-slate-500 dark:text-slate-400">
              {user?.email || "Signed in"}
            </div>
          </div>

          {avatar ? (
            <img
              src={avatar}
              alt={user?.fullName || "User"}
              className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-medium text-white ring-1 ring-slate-900/10 dark:bg-slate-100 dark:text-slate-950 dark:ring-white/10">
              {initials}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
