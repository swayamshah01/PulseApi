import { useState } from "react";
import { FormError } from "../auth/FormError.jsx";

export function ProjectForm({ initialValues = {}, onSubmit, submitLabel }) {
  const [name, setName] = useState(initialValues.name ?? "");
  const [description, setDescription] = useState(initialValues.description ?? "");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError({ message: "Project name must contain at least two characters." });
      return;
    }
    if (description.trim().length > 500) {
      setError({ message: "Project description cannot exceed 500 characters." });
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({ name, description });
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
      <label className="block">
        <span className="text-sm font-semibold">Project name</span>
        <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required autoFocus />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">Description <span className="font-normal text-slate-500">(optional)</span></span>
        <textarea className={`${inputClass} min-h-32 resize-y`} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} />
        <span className="mt-2 block text-right text-xs text-slate-500">{description.length}/500</span>
      </label>
      <button className="rounded-xl bg-emerald-400 px-5 py-3 font-bold text-slate-950 hover:bg-emerald-300 disabled:opacity-60" type="submit" disabled={submitting}>
        {submitting ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
