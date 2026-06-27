export default function PageHeader({
  title,
  subtitle,
  meta,
  tabs,
  activeTab,
  onTabChange,
  actions,
  rightSlot,
}) {
  return (
    <div className="mb-6 border-b border-slate-200/80 pb-4 dark:border-slate-800">
      {/* TOP ROW */}
      <div className="flex items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
              {title}
            </h1>

            {meta && (
              <span className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                {meta}
              </span>
            )}
          </div>

          {subtitle && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {rightSlot}
          {actions}
        </div>
      </div>

      {/* TABS */}
      {tabs && (
        <div className="mt-6 flex items-center gap-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange?.(tab)}
              className={`pb-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "border-b-2 border-slate-900 text-slate-900 dark:border-slate-100 dark:text-slate-50"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
