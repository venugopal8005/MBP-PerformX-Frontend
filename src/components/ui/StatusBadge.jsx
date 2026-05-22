const variants = {
  high: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-slate-100 text-slate-600",
  critical: "bg-rose-50 text-rose-700",
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