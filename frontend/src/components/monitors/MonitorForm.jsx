import { useMemo, useState } from "react";
import { FormError } from "../auth/FormError.jsx";

const defaultValues = {
  name: "",
  url: "",
  expectedStatusCode: "200",
  timeoutMs: "5000",
  intervalSeconds: "300",
};

export function MonitorForm({ initialValues, onSubmit, submitLabel }) {
  const [form, setForm] = useState(() => ({
    ...defaultValues,
    ...Object.fromEntries(
      Object.entries(initialValues ?? {}).map(([key, value]) => [key, String(value)]),
    ),
  }));
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const urlPreview = useMemo(() => {
    try {
      const url = new URL(form.url);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
        return null;
      }
      url.hash = "";
      return url.toString();
    } catch {
      return null;
    }
  }, [form.url]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (form.name.trim().length < 2) {
      setError({ message: "Monitor name must contain at least two characters." });
      return;
    }
    if (!urlPreview) {
      setError({ message: "Enter an absolute HTTP or HTTPS URL without credentials." });
      return;
    }

    const payload = {
      name: form.name,
      url: form.url,
      expectedStatusCode: Number(form.expectedStatusCode),
      timeoutMs: Number(form.timeoutMs),
      intervalSeconds: Number(form.intervalSeconds),
    };

    if (
      payload.expectedStatusCode < 100 ||
      payload.expectedStatusCode > 599 ||
      payload.timeoutMs < 1000 ||
      payload.timeoutMs > 30000 ||
      payload.intervalSeconds < 60 ||
      payload.intervalSeconds > 86400
    ) {
      setError({ message: "One or more numeric settings are outside the allowed range." });
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(payload);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20";

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      <FormError error={error} />
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold">Monitor name</span>
          <input className={inputClass} value={form.name} onChange={(event) => update("name", event.target.value)} maxLength={100} required />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold">Endpoint URL</span>
          <input className={inputClass} type="url" value={form.url} onChange={(event) => update("url", event.target.value)} maxLength={2048} placeholder="https://api.example.com/health" required />
          <span className="mt-2 block text-xs text-slate-500">
            {urlPreview ? `Stored as ${urlPreview}` : "Absolute HTTP or HTTPS URL; fragments are removed."}
          </span>
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Expected status code</span>
          <input className={inputClass} type="number" min="100" max="599" value={form.expectedStatusCode} onChange={(event) => update("expectedStatusCode", event.target.value)} required />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Timeout (milliseconds)</span>
          <input className={inputClass} type="number" min="1000" max="30000" step="100" value={form.timeoutMs} onChange={(event) => update("timeoutMs", event.target.value)} required />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold">Check interval (seconds)</span>
          <input className={inputClass} type="number" min="60" max="86400" value={form.intervalSeconds} onChange={(event) => update("intervalSeconds", event.target.value)} required />
          <span className="mt-2 block text-xs text-slate-500">Minimum 60 seconds. Checks are not executed until Phase 4.</span>
        </label>
      </div>
      <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm text-sky-100">
        PulseAPI supports GET monitoring only. This phase stores configuration but does not contact the endpoint.
      </div>
      <button className="rounded-xl bg-emerald-400 px-5 py-3 font-bold text-slate-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={submitting}>
        {submitting ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
