import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../../api/axios";
import { ListSkeleton } from "../ui/Skeleton";
import { getSignalAppearance } from "../../utils/signalAppearance";
import ActivityIcon from "./ActivityIcon";
import { getActivityPresentation } from "./activityPresentation";

const severityClass = {
  stable: "bg-emerald-50 text-emerald-700 border-emerald-200",
  moderate: "bg-amber-50 text-amber-700 border-amber-200",
  critical: "bg-rose-50 text-rose-700 border-rose-200",
};

const formatSeverity = (severity = "stable") =>
  `${severity.charAt(0).toUpperCase()}${severity.slice(1)}`;

const signalAppearanceFromActivity = (activity) =>
  getSignalAppearance({
    ...activity,
    signal_type: activity.signal_type || activity.metadata?.signal_type,
    signal_category: activity.signal_category || activity.metadata?.signal_category,
  });

const badgeForActivity = (activity) => {
  if (activity.type === "signal_detected") {
    const appearance = signalAppearanceFromActivity(activity);
    return {
      label: appearance.label,
      className: appearance.badgeClassName,
    };
  }

  return {
    label: formatSeverity(activity.severity),
    className: severityClass[activity.severity] || severityClass.stable,
  };
};

const reportActivityTypes = new Set([
  "report_created",
  "report_started",
  "report_paused",
  "report_archived",
  "report_executed",
  "report_sent",
  "report_failed",
]);

const idFromRef = (value) => {
  if (!value) return "";
  if (typeof value === "object") return value._id || value.id || "";
  return value;
};

const activityDestination = (activity) => {
  const reportId = idFromRef(activity.report_id);
  if (reportId) return `/reports/${reportId}`;

  const clientId = idFromRef(activity.client_id);
  if (clientId) return `/clients/${clientId}`;

  return "";
};

const timeAgo = (value) => {
  if (!value) return "Just now";

  const diffMs = new Date(value).getTime() - new Date().getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) return formatter.format(diffMinutes, "minute");

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return formatter.format(diffHours, "hour");

  return formatter.format(Math.round(diffHours / 24), "day");
};

export default function ActivityFeed({ activeFilter = "All" }) {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const visibleActivities = useMemo(() => {
    return activities.filter((item) => {
      if (activeFilter === "Critical") {
        return (
          item.severity === "critical" ||
          (item.type === "signal_detected" &&
            signalAppearanceFromActivity(item).tone === "critical")
        );
      }
      if (activeFilter === "Signals") return item.type === "signal_detected";
      if (activeFilter === "Decisions") return item.type === "decision_generated";
      if (activeFilter === "Reports") return reportActivityTypes.has(item.type);

      return true;
    });
  }, [activeFilter, activities]);

  useEffect(() => {
    let cancelled = false;

    const loadActivities = async () => {
      try {
        const res = await api.get("/activities", {
          params: { limit: 100 },
        });

        if (!cancelled) {
          setActivities(res.data?.activities || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || "Could not load activity.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadActivities();

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return <ListSkeleton count={5} />;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        {error}
      </div>
    );
  }

  if (!visibleActivities.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
        <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">
          {activities.length ? "No activity matches this filter" : "No activity yet"}
        </h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {activities.length
            ? "Try another activity filter to see more timeline items."
            : "Client creation, Meta connections, reports, and signals will appear here."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {visibleActivities.map((item, index) => {
        const presentation = getActivityPresentation(item);
        const badge = badgeForActivity(item);
        const destination = activityDestination(item);
        const isLinked = Boolean(destination);

        return (
          <div
            key={item._id}
            role={isLinked ? "button" : undefined}
            tabIndex={isLinked ? 0 : undefined}
            onClick={() => {
              if (destination) navigate(destination);
            }}
            onKeyDown={(event) => {
              if (!destination || (event.key !== "Enter" && event.key !== " ")) return;
              event.preventDefault();
              navigate(destination);
            }}
            className={`relative rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-[var(--shadow-card)] transition dark:border-slate-800 dark:bg-slate-900/80 ${
              isLinked ? "cursor-pointer hover:-translate-y-px hover:border-slate-300 hover:shadow-md dark:hover:border-slate-700" : ""
            }`}
          >
            {index < visibleActivities.length - 1 && (
              <span className="pointer-events-none absolute left-[2.45rem] top-[4.15rem] -bottom-5 w-px bg-slate-200 dark:bg-slate-800" />
            )}

            <div className="relative flex items-start gap-4">
              <div className="pt-0.5">
                <ActivityIcon activity={item} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold leading-6 text-slate-950 dark:text-slate-50">
                      {presentation.title}
                    </h3>

                    {presentation.description && (
                      <p className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {presentation.description}
                      </p>
                    )}
                  </div>

                  <span
                    className={`shrink-0 rounded-md border px-2 py-1 text-xs font-medium ${
                      badge.className
                    }`}
                  >
                    {badge.label}
                  </span>
                </div>

                <div className="mt-3 text-xs font-medium text-slate-400 dark:text-slate-500">
                  {timeAgo(item.createdAt)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
