export function Skeleton({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer rounded-lg bg-slate-200/80 dark:bg-slate-800 ${className}`}
    />
  );
}

export function ListSkeleton({ count = 3, compact = false }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
        >
          <div className="flex items-start gap-4">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-11/12" />
              {!compact && <Skeleton className="h-3 w-2/3" />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ rows = 4, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 ${className}`}
    >
      <div className="space-y-4">
        <Skeleton className="h-5 w-1/3" />
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton
            key={index}
            className={`h-3 ${index % 3 === 0 ? "w-11/12" : index % 3 === 1 ? "w-2/3" : "w-4/5"}`}
          />
        ))}
      </div>
    </div>
  );
}
