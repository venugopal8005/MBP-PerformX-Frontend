export default function Card({
  children,
  className = "",
  ...props
}) {
  return (
    <div
      {...props}
      className={`
        rounded-2xl border border-slate-200/90 bg-white p-5
        shadow-[var(--shadow-card)]
        dark:border-slate-800 dark:bg-slate-900/80
        ${className}
      `}
    >
      {children}
    </div>
  );
}
