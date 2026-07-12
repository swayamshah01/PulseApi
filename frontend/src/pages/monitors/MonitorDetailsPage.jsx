import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FormError } from "../../components/auth/FormError.jsx";
import { useAuth } from "../../lib/auth-context.jsx";
import {
  formatDateTime,
  formatInterval,
  healthClass,
  healthLabel,
} from "../../lib/formatters.js";

export function MonitorDetailsPage() {
  const { monitorId } = useParams();
  const { request } = useAuth();
  const navigate = useNavigate();
  const [monitor, setMonitor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [latestResult, setLatestResult] = useState(null);
  const [error, setError] = useState(null);

  async function loadMonitor() {
    setLoading(true);
    setError(null);
    try {
      setMonitor(await request(`/monitors/${monitorId}`));
    } catch (requestError) {
      setError(requestError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMonitor();
  }, [monitorId]);

  async function toggleStatus() {
    setBusy(true);
    try {
      const action = monitor.status === "ACTIVE" ? "pause" : "resume";
      setMonitor(await request(`/monitors/${monitor.id}/${action}`, { method: "POST" }));
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  }

  async function deleteMonitor() {
    if (!window.confirm(`Delete "${monitor.name}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await request(`/monitors/${monitor.id}`, { method: "DELETE" });
      navigate("/monitors", { replace: true });
    } catch (requestError) {
      setError(requestError);
      setBusy(false);
    }
  }

  async function runCheck() {
    setChecking(true);
    setError(null);
    try {
      const result = await request(`/monitors/${monitor.id}/check`, {
        method: "POST",
      });
      setLatestResult(result);
      setMonitor(await request(`/monitors/${monitor.id}`));
    } catch (requestError) {
      setError(requestError);
    } finally {
      setChecking(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-5xl px-6 py-10 text-slate-400">Loading monitor...</main>;

  if (!monitor) {
    return <main className="mx-auto max-w-5xl px-6 py-10"><FormError error={error} /><Link className="mt-5 inline-block text-emerald-400" to="/monitors">Back to monitors</Link></main>;
  }

  const details = [
    ["Method", monitor.method],
    ["Expected status", monitor.expectedStatusCode],
    ["Timeout", `${monitor.timeoutMs} ms`],
    ["Check interval", formatInterval(monitor.intervalSeconds)],
    ["Last checked", formatDateTime(monitor.lastCheckedAt)],
    ["Last status code", monitor.lastStatusCode ?? "Not available"],
    ["Last response time", monitor.lastResponseTimeMs === null ? "Not available" : `${monitor.lastResponseTimeMs} ms`],
    ["Consecutive failures", monitor.consecutiveFailures],
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link className="text-sm font-semibold text-slate-400 hover:text-white" to="/monitors">← Back to monitors</Link>
      <div className="mt-6"><FormError error={error} /></div>
      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-black">{monitor.name}</h1>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${monitor.status === "ACTIVE" ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-200"}`}>{monitor.status}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${healthClass(monitor.isUp)}`}>{healthLabel(monitor.isUp)}</span>
            </div>
            <a className="mt-3 block break-all text-sm text-sky-300 hover:text-sky-200" href={monitor.url} target="_blank" rel="noreferrer">{monitor.url}</a>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-300 disabled:opacity-50" onClick={runCheck} disabled={busy || checking}>{checking ? "Checking..." : "Run check"}</button>
            <Link className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold hover:border-slate-500" to={`/monitors/${monitor.id}/edit`}>Edit</Link>
            <button className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold hover:border-slate-500 disabled:opacity-50" onClick={toggleStatus} disabled={busy || checking}>{monitor.status === "ACTIVE" ? "Pause" : "Resume"}</button>
            <button className="rounded-xl border border-rose-500/30 px-4 py-2.5 text-sm font-bold text-rose-300 hover:border-rose-400 disabled:opacity-50" onClick={deleteMonitor} disabled={busy || checking}>Delete</button>
          </div>
        </div>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {details.map(([label, value]) => (
            <div className="rounded-xl bg-slate-950 p-4" key={label}>
              <dt className="text-xs uppercase tracking-wider text-slate-500">{label}</dt>
              <dd className="mt-2 text-sm font-semibold text-slate-200">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <h2 className="font-bold">Latest manual check</h2>
        {latestResult ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div><p className="text-xs uppercase text-slate-500">Result</p><p className={`mt-1 font-bold ${latestResult.success ? "text-emerald-300" : "text-rose-300"}`}>{latestResult.success ? "Successful" : "Failed"}</p></div>
            <div><p className="text-xs uppercase text-slate-500">Status</p><p className="mt-1 font-bold">{latestResult.statusCode ?? latestResult.errorType}</p></div>
            <div><p className="text-xs uppercase text-slate-500">Response time</p><p className="mt-1 font-bold">{latestResult.responseTimeMs} ms</p></div>
            {latestResult.errorMessage && <p className="text-sm text-slate-400 sm:col-span-3">{latestResult.errorMessage}</p>}
          </div>
        ) : monitor.lastCheckedAt ? (
          <p className="mt-2 text-slate-400">Last checked {formatDateTime(monitor.lastCheckedAt)}. Open history after Phase 6 to inspect every result.</p>
        ) : (
          <p className="mt-2 text-slate-400">No checks have been run yet.</p>
        )}
      </section>
    </main>
  );
}
