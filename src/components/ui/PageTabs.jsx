export default function PageTabs({
  tabs,
  activeTab,
  onChange,
}) {
  return (
    <div className="mt-6 flex items-center gap-6 border-b border-slate-200/80 dark:border-slate-800">
      {tabs.map((tab) => {
        const active = activeTab === tab;

        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
              active
                ? "border-slate-900 text-slate-900 dark:border-slate-100 dark:text-slate-50"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            }`}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}
