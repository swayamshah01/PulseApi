import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FormError } from "../../components/auth/FormError.jsx";
import { useAuth } from "../../lib/auth-context.jsx";
import { formatDateTime, formatInterval, healthClass, healthLabel } from "../../lib/formatters.js";

export function ProjectDetailsPage() {
  const { projectId } = useParams();
  const { request } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [endpoints, setEndpoints] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setError(null);
    try {
      const [projectData, endpointData] = await Promise.all([
        request(`/projects/${projectId}`),
        request(`/endpoints?projectId=${projectId}&limit=100&sortBy=name&sortOrder=asc`),
      ]);
      setProject(projectData);
      setEndpoints(endpointData.data);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [projectId]);

  async function toggle(endpoint) {
    setBusyId(endpoint.id);
    try {
      await request(`/endpoints/${endpoint.id}/${endpoint.status === "ACTIVE" ? "pause" : "resume"}`, { method: "POST" });
      await load();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteProject() {
    if (!window.confirm(`Delete "${project.name}", all endpoints, and all check history? This cannot be undone.`)) return;
    try {
      await request(`/projects/${project.id}`, { method: "DELETE" });
      navigate("/projects", { replace: true });
    } catch (requestError) {
      setError(requestError);
    }
  }

  if (loading) return <main className="mx-auto max-w-7xl px-6 py-10 text-slate-400">Loading project...</main>;
  if (!project) return <main className="mx-auto max-w-7xl px-6 py-10"><FormError error={error} /></main>;

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <Link className="text-sm font-semibold text-slate-400 hover:text-white" to="/projects">&larr; Back to projects</Link>
      <div className="mt-5"><FormError error={error} /></div>
      <section className="mt-5 rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">Project</p>
            <h1 className="mt-2 text-4xl font-black">{project.name}</h1>
            <p className="mt-3 max-w-2xl text-slate-400">{project.description || "No description provided."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-300" to={`/projects/${project.id}/endpoints/new`}>Add endpoint</Link>
            <Link className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold hover:border-slate-500" to={`/projects/${project.id}/edit`}>Edit project</Link>
            <button className="rounded-xl border border-rose-500/30 px-4 py-2.5 text-sm font-bold text-rose-300 hover:border-rose-400" onClick={deleteProject}>Delete project</button>
          </div>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[['Endpoints', project.endpointCounts.total], ['Active', project.endpointCounts.active], ['Paused', project.endpointCounts.paused], ['Up', project.endpointCounts.up], ['Down', project.endpointCounts.down], ['Not checked', project.endpointCounts.unknown]].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-slate-950 p-4"><p className="text-xs uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>
          ))}
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5"><h2 className="text-xl font-bold">Endpoints</h2><span className="text-sm text-slate-500">Each endpoint is checked independently</span></div>
        {endpoints.length === 0 ? (
          <div className="p-10 text-center"><p className="text-slate-400">This project has no endpoints yet.</p><Link className="mt-4 inline-block font-bold text-emerald-400" to={`/projects/${project.id}/endpoints/new`}>Add the first endpoint</Link></div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-950/50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-4">Endpoint</th><th className="px-5 py-4">Health</th><th className="px-5 py-4">Interval</th><th className="px-5 py-4">Last checked</th><th className="px-5 py-4">Actions</th></tr></thead><tbody className="divide-y divide-slate-800">{endpoints.map((endpoint) => (
            <tr key={endpoint.id}><td className="px-5 py-5"><Link className="font-bold hover:text-emerald-300" to={`/endpoints/${endpoint.id}`}>{endpoint.name}</Link><p className="mt-1 max-w-md truncate text-xs text-slate-500">{endpoint.url}</p></td><td className="px-5 py-5"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${healthClass(endpoint.isUp)}`}>{healthLabel(endpoint.isUp)}</span></td><td className="px-5 py-5">{formatInterval(endpoint.intervalSeconds)}</td><td className="px-5 py-5 text-slate-400">{formatDateTime(endpoint.lastCheckedAt)}</td><td className="px-5 py-5"><div className="flex gap-2"><Link className="rounded-lg border border-slate-700 px-3 py-2 hover:border-slate-500" to={`/endpoints/${endpoint.id}`}>View</Link><button className="rounded-lg border border-slate-700 px-3 py-2 hover:border-slate-500 disabled:opacity-50" disabled={busyId === endpoint.id} onClick={() => toggle(endpoint)}>{endpoint.status === "ACTIVE" ? "Pause" : "Resume"}</button></div></td></tr>
          ))}</tbody></table></div>
        )}
      </section>
    </main>
  );
}
