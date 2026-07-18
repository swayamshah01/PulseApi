import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FormError } from "../../components/auth/FormError.jsx";
import { useAuth } from "../../lib/auth-context.jsx";
import { formatDateTime } from "../../lib/formatters.js";

const healthStyles = {
  UP: "bg-emerald-400/15 text-emerald-300",
  DOWN: "bg-rose-400/15 text-rose-300",
  UNKNOWN: "bg-slate-700 text-slate-300",
  PAUSED: "bg-amber-400/15 text-amber-200",
  EMPTY: "bg-slate-800 text-slate-400",
};
const healthLabels = { UP: "Up", DOWN: "Down", UNKNOWN: "Not checked", PAUSED: "Paused", EMPTY: "No endpoints" };

export function ProjectListPage() {
  const { request } = useAuth();
  const [projects, setProjects] = useState([]);
  const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "12", sortBy: "updatedAt", sortOrder: "desc" });
    if (search) params.set("search", search);
    request(`/projects?${params}`)
      .then((result) => {
        if (active) {
          setProjects(result.data);
          setMeta(result.meta);
        }
      })
      .catch((requestError) => active && setError(requestError))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [page, search]);

  function applySearch(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">API portfolio</p>
          <h1 className="mt-2 text-4xl font-black">Projects</h1>
          <p className="mt-3 text-slate-400">Group every endpoint belonging to the same application.</p>
        </div>
        <Link className="rounded-xl bg-emerald-400 px-5 py-3 font-bold text-slate-950 hover:bg-emerald-300" to="/projects/new">New project</Link>
      </div>

      <form className="mt-8 flex max-w-xl gap-3" onSubmit={applySearch}>
        <input className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-emerald-400" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search projects" />
        <button className="rounded-xl border border-slate-700 px-4 py-3 font-semibold hover:border-slate-500">Search</button>
      </form>
      <div className="mt-5"><FormError error={error} /></div>

      {loading ? <p className="mt-8 text-slate-400">Loading projects...</p> : projects.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-10 text-center">
          <h2 className="text-xl font-bold">No projects yet</h2>
          <p className="mt-2 text-slate-400">Create one project, then add all of its API endpoints.</p>
          <Link className="mt-5 inline-block text-sm font-bold text-emerald-400" to="/projects/new">Create your first project</Link>
        </section>
      ) : (
        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`} className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:-translate-y-0.5 hover:border-slate-600">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-black group-hover:text-emerald-300">{project.name}</h2>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${healthStyles[project.health]}`}>{healthLabels[project.health]}</span>
              </div>
              <p className="mt-3 min-h-10 text-sm text-slate-400">{project.description || "No description"}</p>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-slate-950 p-3"><strong className="block text-lg text-white">{project.endpointCounts.total}</strong>Endpoints</div>
                <div className="rounded-lg bg-slate-950 p-3"><strong className="block text-lg text-emerald-300">{project.endpointCounts.up}</strong>Up</div>
                <div className="rounded-lg bg-slate-950 p-3"><strong className="block text-lg text-rose-300">{project.endpointCounts.down}</strong>Down</div>
              </div>
              <p className="mt-4 text-xs text-slate-500">Last check: {formatDateTime(project.lastCheckedAt)}</p>
            </Link>
          ))}
        </section>
      )}

      <div className="mt-7 flex items-center justify-between text-sm text-slate-400">
        <span>{meta.total} project{meta.total === 1 ? "" : "s"}</span>
        <div className="flex gap-2">
          <button className="rounded-lg border border-slate-700 px-3 py-2 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
          <button className="rounded-lg border border-slate-700 px-3 py-2 disabled:opacity-40" disabled={page >= meta.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
        </div>
      </div>
    </main>
  );
}
