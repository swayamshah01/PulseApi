import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FormError } from "../../components/auth/FormError.jsx";
import { useAuth } from "../../lib/auth-context.jsx";
import {
  formatDateTime,
  formatInterval,
  healthClass,
  healthLabel,
} from "../../lib/formatters.js";

export function MonitorListPage() {
  const { request } = useAuth();
  const [monitors, setMonitors] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [health, setHealth] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function loadMonitors() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        sortBy,
        sortOrder: sortBy === "name" ? "asc" : "desc",
      });
      if (status) params.set("status", status);
      if (health) params.set("health", health);
      if (search) params.set("search", search);

      const response = await request(`/monitors?${params}`);
      setMonitors(response.data);
      setMeta(response.meta);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMonitors();
  }, [page, status, health, sortBy, search]);

  function applySearch(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function toggleStatus(monitor) {
    setBusyId(monitor.id);
    try {
      const action = monitor.status === "ACTIVE" ? "pause" : "resume";
      await request(`/monitors/${monitor.id}/${action}`, { method: "POST" });
      await loadMonitors();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteMonitor(monitor) {
    if (!window.confirm(`Delete "${monitor.name}"? This cannot be undone.`)) return;

    setBusyId(monitor.id);
    try {
      await request(`/monitors/${monitor.id}`, { method: "DELETE" });
      if (monitors.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await loadMonitors();
      }
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusyId(null);
    }
  }

  const selectClass = "rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm outline-none focus:border-emerald-400";

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">Configuration</p>
          <h1 className="mt-2 text-3xl font-black">Monitors</h1>
          <p className="mt-2 text-slate-400">Manage endpoint settings. Health remains unknown until checks begin.</p>
        </div>
        <Link className="rounded-xl bg-emerald-400 px-5 py-3 font-bold text-slate-950 hover:bg-emerald-300" to="/monitors/new">
          Add monitor
        </Link>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <form className="flex flex-wrap gap-3" onSubmit={applySearch}>
          <input className="min-w-56 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm outline-none focus:border-emerald-400" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search name or URL" />
          <button className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold hover:border-slate-500" type="submit">Search</button>
          <select className={selectClass} value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }} aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
          </select>
          <select className={selectClass} value={health} onChange={(event) => { setPage(1); setHealth(event.target.value); }} aria-label="Filter by health">
            <option value="">All health</option>
            <option value="up">Up</option>
            <option value="down">Down</option>
            <option value="unknown">Not Checked</option>
          </select>
          <select className={selectClass} value={sortBy} onChange={(event) => { setPage(1); setSortBy(event.target.value); }} aria-label="Sort monitors">
            <option value="createdAt">Newest</option>
            <option value="updatedAt">Recently updated</option>
            <option value="name">Name</option>
            <option value="lastCheckedAt">Last checked</option>
          </select>
        </form>
      </div>

      <div className="mt-6"><FormError error={error} /></div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        {loading ? (
          <p className="p-8 text-slate-400">Loading monitors...</p>
        ) : monitors.length === 0 ? (
          <div className="p-10 text-center">
            <h2 className="text-xl font-bold">No monitors found</h2>
            <p className="mt-2 text-slate-400">Add your first GET endpoint or change the filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-950/50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-4">Monitor</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Health</th>
                  <th className="px-5 py-4">Expected</th>
                  <th className="px-5 py-4">Interval</th>
                  <th className="px-5 py-4">Last checked</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {monitors.map((monitor) => (
                  <tr key={monitor.id} className="align-top">
                    <td className="px-5 py-5">
                      <Link className="font-bold hover:text-emerald-400" to={`/monitors/${monitor.id}`}>{monitor.name}</Link>
                      <p className="mt-1 max-w-sm truncate text-xs text-slate-500">{monitor.url}</p>
                    </td>
                    <td className="px-5 py-5"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${monitor.status === "ACTIVE" ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-200"}`}>{monitor.status}</span></td>
                    <td className="px-5 py-5"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${healthClass(monitor.isUp)}`}>{healthLabel(monitor.isUp)}</span></td>
                    <td className="px-5 py-5 text-slate-300">{monitor.expectedStatusCode}</td>
                    <td className="px-5 py-5 text-slate-300">{formatInterval(monitor.intervalSeconds)}</td>
                    <td className="px-5 py-5 text-slate-400">{formatDateTime(monitor.lastCheckedAt)}</td>
                    <td className="px-5 py-5">
                      <div className="flex flex-wrap gap-2">
                        <Link className="rounded-lg border border-slate-700 px-2.5 py-1.5 hover:border-slate-500" to={`/monitors/${monitor.id}`}>View</Link>
                        <Link className="rounded-lg border border-slate-700 px-2.5 py-1.5 hover:border-slate-500" to={`/monitors/${monitor.id}/edit`}>Edit</Link>
                        <button className="rounded-lg border border-slate-700 px-2.5 py-1.5 hover:border-slate-500 disabled:opacity-50" onClick={() => toggleStatus(monitor)} disabled={busyId === monitor.id}>{monitor.status === "ACTIVE" ? "Pause" : "Resume"}</button>
                        <button className="rounded-lg border border-rose-500/30 px-2.5 py-1.5 text-rose-300 hover:border-rose-400 disabled:opacity-50" onClick={() => deleteMonitor(monitor)} disabled={busyId === monitor.id}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between text-sm text-slate-400">
        <span>{meta.total} monitor{meta.total === 1 ? "" : "s"}</span>
        <div className="flex items-center gap-3">
          <button className="rounded-lg border border-slate-700 px-3 py-2 disabled:opacity-40" onClick={() => setPage((current) => current - 1)} disabled={page <= 1}>Previous</button>
          <span>Page {meta.page} of {Math.max(meta.totalPages, 1)}</span>
          <button className="rounded-lg border border-slate-700 px-3 py-2 disabled:opacity-40" onClick={() => setPage((current) => current + 1)} disabled={page >= meta.totalPages}>Next</button>
        </div>
      </div>
    </main>
  );
}
