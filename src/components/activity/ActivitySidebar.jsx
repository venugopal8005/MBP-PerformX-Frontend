import { useEffect, useState } from "react";

import api from "../../api/axios";
import { Skeleton } from "../ui/Skeleton";
import { getSignalAppearance } from "../../utils/signalAppearance";
import ActivityIcon from "./ActivityIcon";

const formatSignalType = (type = "signal") =>
  String(type)
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const latestSignalCardClass = {
  critical: "border-rose-200 bg-rose-50 dark:border-rose-900/70 dark:bg-rose-950/30",
  warning: "border-amber-200 bg-amber-50 dark:border-amber-900/70 dark:bg-amber-950/30",
  info: "border-sky-200 bg-sky-50 dark:border-sky-900/70 dark:bg-sky-950/30",
  success: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-950/30",
  neutral: "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50",
};

export default function ActivitySidebar() {
  const [summary, setSummary] = useState({
    activeReports: 0,
    criticalSignals: 0,
    latestSignal: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const latestAppearance = summary.latestSignal
    ? getSignalAppearance(summary.latestSignal)
    : null;

  useEffect(() => {
    let cancelled = false;

    const loadSummary = async () => {
      const [reportsResult, signalsResult] = await Promise.allSettled([
        api.get("/reports/get-reports"),
        api.get("/signals", { params: { limit: 20 } }),
      ]);

      if (cancelled) return;

      const reports = reportsResult.status === "fulfilled" ? reportsResult.value.data || [] : [];
      const signals =
        signalsResult.status === "fulfilled" ? signalsResult.value.data?.signals || [] : [];

      setSummary({
        activeReports: reports.filter((report) => report.status === "active").length,
        criticalSignals: signals.filter(
          (signal) => getSignalAppearance(signal).tone === "critical"
        ).length,
        latestSignal: signals[0] || null,
      });
      setIsLoading(false);
    };

    loadSummary();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-card)] dark:border-slate-800 dark:bg-slate-900/80">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Workspace Summary
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Active Reports</p>

            {isLoading ? (
              <Skeleton className="mt-2 h-8 w-12" />
            ) : (
              <p className="mt-1 text-3xl font-semibold text-slate-950 dark:text-slate-50">
                {summary.activeReports}
              </p>
            )}
          </div>

          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Critical Signals</p>

            {isLoading ? (
              <Skeleton className="mt-2 h-8 w-12" />
            ) : (
              <p className="mt-1 text-3xl font-semibold text-red-600 dark:text-rose-300">
                {summary.criticalSignals}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-card)] dark:border-slate-800 dark:bg-slate-900/80">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Latest Signal
        </p>

        {isLoading ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-3 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-2/3" />
          </div>
        ) : summary.latestSignal ? (
          <div
            className={`mt-4 rounded-xl border p-4 ${
              latestSignalCardClass[latestAppearance?.tone] || latestSignalCardClass.neutral
            }`}
          >
            <div className="flex items-start gap-3">
              <ActivityIcon
                activity={{
                  type: "signal_detected",
                  severity: summary.latestSignal.severity,
                  title: summary.latestSignal.title,
                  description: summary.latestSignal.description,
                  metadata: {
                    signal_type: summary.latestSignal.type,
                    signal_category: summary.latestSignal.category,
                  },
                }}
                size="sm"
              />

              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-950 dark:text-slate-50">
                  {summary.latestSignal.title || formatSignalType(summary.latestSignal.type)}
                </p>

                {summary.latestSignal.description && (
                  <p className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-300">
                    {summary.latestSignal.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No signals detected yet.
          </div>
        )}
      </div>
    </div>
  );
}
