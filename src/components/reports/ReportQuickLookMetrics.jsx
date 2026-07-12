import { useEffect, useMemo, useState } from "react";
import { CalendarDays, RefreshCw } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import api from "../../api/axios";

const RANGE_OPTIONS = [
  { value: "last_available", label: "Latest available" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_14_days", label: "Last 14 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "lifetime", label: "Lifetime" },
  { value: "custom", label: "Custom" },
];

const METRIC_ORDER = ["ctr", "clicks", "cpc", "cpa", "conversions", "spend", "roas"];

const isValidRange = (value) => RANGE_OPTIONS.some((option) => option.value === value);

const formatDate = (value) => {
  if (!value) return "";

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const metricTone = (metric) => {
  if (!metric?.available) {
    return {
      card: "border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60",
      badge: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    };
  }

  if (metric.direction === "positive") {
    return {
      card:
        "border-emerald-200 bg-emerald-50/85 dark:border-emerald-900/60 dark:bg-emerald-950/25",
      badge:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    };
  }

  if (metric.direction === "negative") {
    return {
      card: "border-rose-200 bg-rose-50/85 dark:border-rose-900/60 dark:bg-rose-950/25",
      badge: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    };
  }

  return {
    card: "border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60",
    badge: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };
};

const subtitleForQuickLook = (quickLook, selectedRange) => {
  if (!quickLook) return "Latest available data for this report.";
  if (quickLook.range?.isFallback) {
    return "Latest available data, not the scheduled report window.";
  }
  if (selectedRange === "lifetime") {
    return "Showing all available performance data for this account.";
  }
  if (selectedRange === "custom" && quickLook.range?.startDate && quickLook.range?.endDate) {
    return `Showing performance from ${formatDate(quickLook.range.startDate)} to ${formatDate(
      quickLook.range.endDate
    )}.`;
  }
  if (
    selectedRange !== "last_available" &&
    quickLook.range?.startDate &&
    quickLook.range?.endDate
  ) {
    return `Showing performance from ${formatDate(quickLook.range.startDate)} to ${formatDate(
      quickLook.range.endDate
    )}.`;
  }

  return "Latest available data for this report.";
};

function MetricCard({ metric }) {
  const tone = metricTone(metric);

  return (
    <div className={`min-h-[112px] rounded-2xl border p-4 transition ${tone.card}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          {metric?.label || "Metric"}
        </p>
        {metric?.displayDelta && (
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone.badge}`}>
            {metric.displayDelta}
          </span>
        )}
      </div>

      <p className="mt-3 text-xl font-semibold tracking-normal text-slate-950 dark:text-slate-50">
        {metric?.displayValue || "N/A"}
      </p>

      {metric?.helperText && (
        <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {metric.helperText}
        </p>
      )}
    </div>
  );
}

function MetricSkeleton() {
  return (
    <div className="min-h-[112px] animate-pulse rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="h-3 w-16 rounded-full bg-slate-200 dark:bg-slate-800" />
      <div className="mt-5 h-6 w-24 rounded-full bg-slate-200 dark:bg-slate-800" />
      <div className="mt-4 h-3 w-32 rounded-full bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}

export default function ReportQuickLookMetrics({ reportRunId, variant = "internal" }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRange = searchParams.get("quickRange");
  const [selectedRange, setSelectedRange] = useState(
    isValidRange(initialRange) ? initialRange : "last_available"
  );
  const [customStartDate, setCustomStartDate] = useState(searchParams.get("start") || "");
  const [customEndDate, setCustomEndDate] = useState(searchParams.get("end") || "");
  const [appliedCustomRange, setAppliedCustomRange] = useState({
    startDate: searchParams.get("start") || "",
    endDate: searchParams.get("end") || "",
  });
  const [quickLook, setQuickLook] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const showCustomControls = selectedRange === "custom";
  const customRangeReady =
    !showCustomControls || (appliedCustomRange.startDate && appliedCustomRange.endDate);
  const displayQuickLook = customRangeReady ? quickLook : null;
  const metrics = useMemo(
    () =>
      METRIC_ORDER.map((key) => displayQuickLook?.metrics?.[key] || { label: key.toUpperCase() }),
    [displayQuickLook]
  );

  const updateUrlRange = (range, dates = {}) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("quickRange", range);

    if (range === "custom") {
      if (dates.startDate) nextParams.set("start", dates.startDate);
      if (dates.endDate) nextParams.set("end", dates.endDate);
    } else {
      nextParams.delete("start");
      nextParams.delete("end");
    }

    setSearchParams(nextParams, { replace: true });
  };

  const handleRangeChange = (event) => {
    const nextRange = event.target.value;
    setSelectedRange(nextRange);
    setError("");

    if (nextRange === "custom") {
      updateUrlRange(nextRange, appliedCustomRange);
      return;
    }

    updateUrlRange(nextRange);
  };

  const applyCustomRange = () => {
    if (!customStartDate || !customEndDate) {
      setError("Choose a start and end date, then apply.");
      return;
    }

    setAppliedCustomRange({
      startDate: customStartDate,
      endDate: customEndDate,
    });
    updateUrlRange("custom", {
      startDate: customStartDate,
      endDate: customEndDate,
    });
  };

  useEffect(() => {
    if (!reportRunId) return;
    if (
      selectedRange === "custom" &&
      (!appliedCustomRange.startDate || !appliedCustomRange.endDate)
    ) {
      return;
    }

    let cancelled = false;

    const loadQuickLook = async () => {
      setIsLoading(true);
      setError("");

      try {
        const params = {
          range: selectedRange,
        };

        if (selectedRange === "custom") {
          params.startDate = appliedCustomRange.startDate;
          params.endDate = appliedCustomRange.endDate;
        }

        const res = await api.get(`/report-runs/${reportRunId}/quick-look`, { params });
        if (!cancelled) {
          setQuickLook(res.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || "Could not load quick look numbers.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadQuickLook();

    return () => {
      cancelled = true;
    };
  }, [reportRunId, selectedRange, appliedCustomRange.startDate, appliedCustomRange.endDate]);

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)] dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-950 dark:text-slate-50">
              {displayQuickLook?.range?.isFallback ? "Fallback numbers" : "Quick look numbers"}
            </h2>
            {isLoading && <RefreshCw size={14} className="animate-spin text-slate-400" />}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {subtitleForQuickLook(displayQuickLook, selectedRange)}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
            <CalendarDays size={15} />
            <select
              value={selectedRange}
              onChange={handleRangeChange}
              className="bg-transparent text-sm font-medium text-slate-800 outline-none dark:text-slate-100"
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {showCustomControls && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(event) => setCustomStartDate(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-100"
              />
              <input
                type="date"
                value={customEndDate}
                onChange={(event) => setCustomEndDate(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={applyCustomRange}
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="p-5">
        {error && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
            {error}
          </div>
        )}

        {showCustomControls && !customRangeReady && !isLoading && !displayQuickLook && (
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
            Choose a start and end date, then apply.
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {isLoading
            ? Array.from({ length: 7 }).map((_, index) => <MetricSkeleton key={index} />)
            : metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
        </div>

        {variant === "internal" &&
          (displayQuickLook?.range?.fallbackReason ||
            displayQuickLook?.dataQuality?.warnings?.length > 0) && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
              <p className="font-semibold text-slate-800 dark:text-slate-100">Reliability notes</p>
              {displayQuickLook.range?.fallbackReason && (
                <p className="mt-1">{displayQuickLook.range.fallbackReason}</p>
              )}
              {displayQuickLook.dataQuality?.warnings
                ?.filter((warning) => warning !== displayQuickLook.range?.fallbackReason)
                .map((warning) => (
                  <p key={warning} className="mt-1">
                    {warning}
                  </p>
                ))}
            </div>
          )}
      </div>
    </section>
  );
}
