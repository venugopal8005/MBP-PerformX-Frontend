import { CheckCircle2, CircleHelp, History } from "lucide-react";

import { getIdentityPresentation, getIdentitySourceLabel } from "../../utils/history";

const tones = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  slate: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const icons = {
  emerald: CheckCircle2,
  amber: History,
  slate: CircleHelp,
};

export default function IdentityProvenance({ completeness, sources, compact = false }) {
  const presentation = getIdentityPresentation(completeness);
  const Icon = icons[presentation.tone];
  const availableSources = Object.entries(sources || {}).filter(([, value]) => value);

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${tones[presentation.tone]}`}
        title={presentation.description}
      >
        <Icon size={13} />
        {presentation.label}
      </span>

      {!compact && availableSources.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          {availableSources.map(([key, value]) => (
            <span key={key}>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {key === "metaAccount" ? "Meta account" : key}:
              </span>{" "}
              {getIdentitySourceLabel(value)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
