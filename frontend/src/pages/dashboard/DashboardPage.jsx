import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth-context.jsx";

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
        <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
          <div className="p-8 sm:p-12">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">
              Phase 3 · Monitor management
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
              Welcome, {user.name}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-400">
              Configure and organize the GET endpoints you plan to monitor. Health remains unknown until manual checking is added in Phase 4.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="rounded-xl bg-emerald-400 px-5 py-3 font-bold text-slate-950 hover:bg-emerald-300" to="/monitors/new">
                Add a monitor
              </Link>
              <Link className="rounded-xl border border-slate-700 px-5 py-3 font-bold hover:border-slate-500" to="/monitors">
                View monitors
              </Link>
            </div>
          </div>
          <aside className="border-t border-slate-800 bg-slate-950/50 p-8 sm:p-12 lg:border-l lg:border-t-0">
            <h2 className="font-bold">Available now</h2>
            <ul className="mt-5 space-y-4 text-sm text-slate-300">
              <li>Configure GET endpoints and expected status codes</li>
              <li>Filter, search, sort, pause, resume, edit, and delete</li>
              <li>Strict per-user ownership and a 20-monitor limit</li>
            </ul>
            <p className="mt-8 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
              No external HTTP requests are made in this phase.
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}
