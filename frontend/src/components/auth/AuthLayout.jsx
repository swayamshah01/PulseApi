import { Link } from "react-router-dom";

export function AuthLayout({ eyebrow, title, description, alternate, children }) {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100 sm:py-20">
      <section className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col justify-between bg-emerald-400 p-8 text-slate-950 sm:p-12">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em]">PulseAPI</p>
            <h1 className="mt-10 text-4xl font-bold tracking-tight sm:text-5xl">
              Know when your APIs need attention.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-slate-800">
              Secure, scheduled API monitoring with history and uptime analytics.
            </p>
          </div>
          <p className="mt-16 text-sm font-semibold">PulseAPI · Monitoring dashboard</p>
        </div>

        <div className="p-8 sm:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-400">
            {eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">{title}</h2>
          <p className="mt-3 text-slate-400">{description}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-sm text-slate-400">
            {alternate.text}{" "}
            <Link className="font-semibold text-emerald-400 hover:text-emerald-300" to={alternate.to}>
              {alternate.label}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
