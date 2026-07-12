import { env } from "./config/env.js";

export default function App() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-20 text-slate-100">
      <section className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-10 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
          Phase 1 · Project foundation
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">PulseAPI</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
          The React client and Express API foundation are ready. Authentication,
          monitors, API checks, and dashboard features begin in later phases.
        </p>
        <div className="mt-8 rounded-lg bg-slate-950 p-4 font-mono text-sm text-slate-400">
          API base URL: {env.apiBaseUrl}
        </div>
      </section>
    </main>
  );
}
