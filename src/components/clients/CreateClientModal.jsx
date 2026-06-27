import { X } from "lucide-react";

import ClientForm from "./ClientForm";

export default function CreateClientModal({
  title = "Add Client",
  description = "Create a client workspace before connecting Meta accounts and reports.",
  initialValues,
  isSubmitting = false,
  onClose,
  onCreate,
  submitLabel = "Create Client",
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-50">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
              {description}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close add client modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-6">
          <ClientForm
            initialValues={initialValues}
            isSubmitting={isSubmitting}
            submitLabel={submitLabel}
            onCancel={onClose}
            onSubmit={onCreate}
          />
        </div>
      </div>
    </div>
  );
}
