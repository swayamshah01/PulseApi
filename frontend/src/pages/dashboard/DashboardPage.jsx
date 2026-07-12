import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FormError } from "../../components/auth/FormError.jsx";
import { useAuth } from "../../lib/auth-context.jsx";
import { formatDateTime } from "../../lib/formatters.js";

export function DashboardPage() {
  const { user, request } = useAuth();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    request("/dashboard/summary").then(setSummary).catch(setError);
  }, []);

  const cards = summary
    ? [
        ["Total monitors", summary.counts.total],
        ["Up", summary.counts.up],
        ["Down", summary.counts.down],
        ["Not checked", summary.counts.unknown],
        ["Paused", summary.counts.paused],
        ["Average uptime", summary.averageUptimePercentage === null ? "No data" : `${summary.averageUptimePercentage}%`],
      ]
    : [];

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">Live overview</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">Welcome, {user.name}</h1>
          <p className="mt-3 text-slate-400">Automatic checks, current health, uptime, and recent failures from your monitors.</p>
        </div>
        <Link className="rounded-xl bg-emerald-400 px-5 py-3 font-bold text-slate-950 hover:bg-emerald-300" to="/monitors/new">Add monitor</Link>
      </div>

      <div className="mt-6"><FormError error={error} /></div>
      {!summary ? (
        <p className="mt-8 text-slate-400">Loading dashboard...</p>
      ) : (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-black">{value}</p>
              </div>
            ))}
          </section>

          <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold">Recent failures</h2>
              <Link className="text-sm font-semibold text-emerald-400" to="/monitors">All monitors</Link>
            </div>
            {summary.recentFailures.length === 0 ? (
              <p className="mt-6 text-slate-400">No failed checks recorded.</p>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500"><tr><th className="pb-3">Monitor</th><th className="pb-3">Failure</th><th className="pb-3">Response</th><th className="pb-3">Time</th></tr></thead>
                  <tbody className="divide-y divide-slate-800">
                    {summary.recentFailures.map((failure) => (
                      <tr key={failure.id}>
                        <td className="py-4"><Link className="font-bold hover:text-emerald-400" to={`/monitors/${failure.monitorId}`}>{failure.monitorName}</Link></td>
                        <td className="py-4 text-rose-300">{failure.errorType}</td>
                        <td className="py-4 text-slate-300">{failure.responseTimeMs} ms</td>
                        <td className="py-4 text-slate-400">{formatDateTime(failure.checkedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
