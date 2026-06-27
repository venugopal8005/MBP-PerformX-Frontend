import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../../api/axios";
import { Skeleton } from "../ui/Skeleton";
import ActivityIcon from "./ActivityIcon";
import { getActivityPresentation } from "./activityPresentation";

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

export default function ActivityPanel() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadActivities = async () => {
      try {
        const res = await api.get("/activities", {
          params: { limit: 8 },
        });

        if (!cancelled) {
          setActivities(res.data?.activities || []);
        }
      } catch {
        if (!cancelled) {
          setActivities([]);
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Activity</h2>

        <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
          Live
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex gap-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : activities.length ? (
        <div>
          {activities.map((item, index) => {
            const presentation = getActivityPresentation(item);
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
                className={`relative flex gap-3 pb-6 last:pb-0 ${
                  isLinked ? "cursor-pointer rounded-lg transition hover:bg-slate-50 dark:hover:bg-slate-900/70" : ""
                }`}
              >
                {index < activities.length - 1 && (
                  <span className="pointer-events-none absolute left-4 top-10 bottom-0 w-px bg-slate-200 dark:bg-slate-800" />
                )}

                <div className="relative mt-0.5">
                  <ActivityIcon activity={item} size="sm" />
                </div>

                <div className="min-w-0 pr-1">
                  <p className="text-sm font-semibold leading-5 text-slate-900 dark:text-slate-50">
                    {presentation.title}
                  </p>

                  {presentation.description && (
                    <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
                      {presentation.description}
                    </p>
                  )}

                  <p className="mt-1 text-xs font-medium text-slate-400 dark:text-slate-500">
                    {timeAgo(item.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No activity yet.
        </div>
      )}
    </div>
  );
}
