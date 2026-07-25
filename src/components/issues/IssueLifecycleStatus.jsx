import { Activity, CheckCircle2, Clock3, TriangleAlert } from "lucide-react";

import { issueLifecycleMessages } from "../../utils/issues";

const icons = {
  action_recorded: CheckCircle2,
  monitoring: Activity,
  one_concern: TriangleAlert,
  reopened: TriangleAlert,
  clean_evidence: Clock3,
  resolved: CheckCircle2,
};

export default function IssueLifecycleStatus({ issue }) {
  const messages = issueLifecycleMessages(issue);
  if (messages.length === 0) return null;

  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80" aria-labelledby="lifecycle-status-title">
      <h2 id="lifecycle-status-title" className="text-base font-semibold text-slate-950 dark:text-slate-50">Lifecycle status</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Persisted evidence state, without assuming an outcome early.</p>
      <ol className="mt-5 space-y-4">
        {messages.map((message) => {
          const Icon = icons[message.key] || Clock3;
          return (
            <li key={message.key} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                <Icon size={14} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{message.title}</p>
                <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">{message.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
