import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth-context.jsx";

export function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">PulseAPI</p>
            <h1 className="mt-2 text-2xl font-bold">Protected application</h1>
          </div>
          <button
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold hover:border-slate-500 disabled:opacity-60"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </header>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-400">Signed in</p>
            <h2 className="mt-3 text-3xl font-bold">Welcome, {user.name}</h2>
            <p className="mt-4 max-w-xl leading-7 text-slate-400">
              Your account, access token, refresh rotation, and protected API access are working. Monitor management is intentionally not part of this phase.
            </p>
          </div>
          <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
            <h2 className="font-semibold">Account details</h2>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="text-slate-500">Email</dt>
                <dd className="mt-1 break-all text-slate-200">{user.email}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Member since</dt>
                <dd className="mt-1 text-slate-200">{new Date(user.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>
          </aside>
        </section>
      </div>
    </main>
  );
}
