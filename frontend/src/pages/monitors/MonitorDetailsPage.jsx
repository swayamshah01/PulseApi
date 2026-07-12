import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FormError } from "../../components/auth/FormError.jsx";
import { ResponseTimeChart } from "../../components/charts/ResponseTimeChart.jsx";
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
  const [history, setHistory] = useState({ data: [], meta: { page: 1, total: 0, totalPages: 0 } });
  const [stats, setStats] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyResult, setHistoryResult] = useState("all");
  const [statsRange, setStatsRange] = useState("24h");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [latestResult, setLatestResult] = useState(null);
  const [error, setError] = useState(null);

  async function loadData(showLoading = true) {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const [monitorData, historyData, statsData] = await Promise.all([
        request(`/monitors/${monitorId}`),
        request(`/monitors/${monitorId}/checks?page=${historyPage}&limit=10&result=${historyResult}`),
        request(`/monitors/${monitorId}/stats?range=${statsRange}`),
      ]);
      setMonitor(monitorData);
      setHistory(historyData);
      setStats(statsData);
    } catch (requestError) {
      setError(requestError);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [monitorId, historyPage, historyResult, statsRange]);

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
    if (!window.confirm(`Delete "${monitor.name}" and all check history? This cannot be undone.`)) return;
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
      setLatestResult(await request(`/monitors/${monitor.id}/check`, { method: "POST" }));
      await loadData(false);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setChecking(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-6xl px-6 py-10 text-slate-400">Loading monitor analytics...</main>;
  if (!monitor) return <main className="mx-auto max-w-6xl px-6 py-10"><FormError error={error} /><Link className="mt-5 inline-block text-emerald-400" to="/monitors">Back to monitors</Link></main>;

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

  const statCards = stats ? [
    ["Uptime", stats.uptimePercentage === null ? "No data" : `${stats.uptimePercentage}%`],
    ["Successful", stats.successfulChecks],
    ["Failed", stats.failedChecks],
    ["Average", stats.averageResponseTimeMs === null ? "No data" : `${stats.averageResponseTimeMs} ms`],
    ["Minimum", stats.minimumResponseTimeMs === null ? "No data" : `${stats.minimumResponseTimeMs} ms`],
    ["Maximum", stats.maximumResponseTimeMs === null ? "No data" : `${stats.maximumResponseTimeMs} ms`],
  ] : [];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
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
          {details.map(([label, value]) => <div className="rounded-xl bg-slate-950 p-4" key={label}><dt className="text-xs uppercase tracking-wider text-slate-500">{label}</dt><dd className="mt-2 text-sm font-semibold text-slate-200">{value}</dd></div>)}
        </dl>
      </section>

      {latestResult && (
        <section className={`mt-6 rounded-2xl border p-5 ${latestResult.success ? "border-emerald-400/30 bg-emerald-400/10" : "border-rose-400/30 bg-rose-400/10"}`}>
          <p className="font-bold">Manual check {latestResult.success ? "succeeded" : "failed"} in {latestResult.responseTimeMs} ms</p>
          <p className="mt-1 text-sm text-slate-300">{latestResult.statusCode ? `HTTP ${latestResult.statusCode}` : latestResult.errorType}{latestResult.errorMessage ? ` — ${latestResult.errorMessage}` : ""}</p>
        </section>
      )}

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-bold">Performance</h2>
          <select className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={statsRange} onChange={(event) => setStatsRange(event.target.value)}>
            <option value="1h">Last hour</option><option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="all">All time</option>
          </select>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {statCards.map(([label, value]) => <div className="rounded-xl bg-slate-950 p-4" key={label}><p className="text-xs uppercase text-slate-500">{label}</p><p className="mt-2 text-lg font-black">{value}</p></div>)}
        </div>
        <div className="mt-6"><ResponseTimeChart series={stats?.series} /></div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-bold">Check history</h2>
          <select className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={historyResult} onChange={(event) => { setHistoryPage(1); setHistoryResult(event.target.value); }}>
            <option value="all">All results</option><option value="successful">Successful</option><option value="failed">Failed</option>
          </select>
        </div>
        {history.data.length === 0 ? <p className="mt-6 text-slate-400">No checks match this filter.</p> : (
          <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="pb-3">Checked</th><th className="pb-3">Result</th><th className="pb-3">Status</th><th className="pb-3">Response</th><th className="pb-3">Error</th></tr></thead><tbody className="divide-y divide-slate-800">{history.data.map((result) => <tr key={result.id}><td className="py-4 text-slate-400">{formatDateTime(result.checkedAt)}</td><td className={`py-4 font-bold ${result.success ? "text-emerald-300" : "text-rose-300"}`}>{result.success ? "Success" : "Failure"}</td><td className="py-4">{result.statusCode ?? "—"}</td><td className="py-4">{result.responseTimeMs} ms</td><td className="py-4 text-slate-400">{result.errorType ?? "—"}</td></tr>)}</tbody></table></div>
        )}
        <div className="mt-5 flex items-center justify-between text-sm text-slate-400"><span>{history.meta.total} checks</span><div className="flex gap-2"><button className="rounded-lg border border-slate-700 px-3 py-2 disabled:opacity-40" disabled={historyPage <= 1} onClick={() => setHistoryPage((page) => page - 1)}>Previous</button><button className="rounded-lg border border-slate-700 px-3 py-2 disabled:opacity-40" disabled={historyPage >= history.meta.totalPages} onClick={() => setHistoryPage((page) => page + 1)}>Next</button></div></div>
      </section>
    </main>
  );
}
