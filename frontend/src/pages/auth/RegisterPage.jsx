import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "../../components/auth/AuthLayout.jsx";
import { FormError } from "../../components/auth/FormError.jsx";
import { useAuth } from "../../lib/auth-context.jsx";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (form.name.trim().length < 2) {
      setError({ message: "Your name must contain at least two characters." });
      return;
    }
    if (!form.email.includes("@")) {
      setError({ message: "Enter a valid email address." });
      return;
    }
    if (form.password.length < 8) {
      setError({ message: "Your password must contain at least eight characters." });
      return;
    }

    setSubmitting(true);
    try {
      await register(form);
      navigate("/app", { replace: true });
    } catch (requestError) {
      setError(requestError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Get started"
      title="Create your account"
      description="Create an account to configure monitors, run checks, and review uptime history."
      alternate={{ text: "Already registered?", label: "Sign in", to: "/login" }}
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <FormError error={error} />
        <label className="block">
          <span className="text-sm font-medium text-slate-200">Full name</span>
          <input
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
            autoComplete="name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            maxLength={100}
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-200">Email address</span>
          <input
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-200">Password</span>
          <input
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            required
          />
          <span className="mt-2 block text-xs text-slate-500">Use at least eight characters.</span>
        </label>
        <button
          className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
