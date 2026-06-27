const variants = {
  high: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  medium: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  critical: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
};

export default function StatusBadge({
  children,
  variant = "low",
}) {
  return (
    <span
      className={`
        inline-flex items-center rounded-md px-2 py-1
        text-xs font-medium
        ${variants[variant]}
      `}
    >
      {children}
    </span>
  );
}
