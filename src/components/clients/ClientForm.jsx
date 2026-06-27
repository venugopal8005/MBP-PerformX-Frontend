import { useState } from "react";

const DEFAULT_VALUES = {
  name: "",
  industry: "",
  status: "stable",
  notes: "",
};

export default function ClientForm({
  initialValues = {},
  submitLabel = "Create Client",
  isSubmitting = false,
  onCancel,
  onSubmit,
}) {
  const [form, setForm] = useState({ ...DEFAULT_VALUES, ...initialValues });
  const [error, setError] = useState("");

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const name = form.name.trim();

    if (!name) {
      setError("Client name is required.");
      return;
    }

    setError("");
    onSubmit?.({
      ...form,
      name,
      industry: form.industry.trim(),
      notes: form.notes.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="client-name"
          className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Client Name
        </label>
        <input
          id="client-name"
          name="clientName"
          type="text"
          value={form.name}
          onChange={(event) => updateField("name", event.target.value)}
          placeholder="e.g. Adidas"
          autoComplete="organization"
          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-700"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="client-industry"
            className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Industry
          </label>
          <input
            id="client-industry"
            name="industry"
            type="text"
            value={form.industry}
            onChange={(event) => updateField("industry", event.target.value)}
            placeholder="e.g. Ecommerce"
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-700"
          />
        </div>

        <div>
          <label
            htmlFor="client-status"
            className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Status
          </label>
          <select
            id="client-status"
            name="status"
            value={form.status}
            onChange={(event) => updateField("status", event.target.value)}
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-100 dark:focus:border-slate-700"
          >
            <option value="stable">Stable</option>
            <option value="moderate">Moderate</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor="client-notes"
          className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Notes
        </label>
        <textarea
          id="client-notes"
          name="notes"
          rows="4"
          value={form.notes}
          onChange={(event) => updateField("notes", event.target.value)}
          placeholder="e.g. Brand campaign focus, EU market..."
          className="w-full resize-none rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-700"
        />
      </div>

      {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

      <div className="flex items-center justify-between border-t border-slate-100 pt-5 dark:border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
