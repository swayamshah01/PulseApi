import { Link, useNavigate } from "react-router-dom";
import { ProjectForm } from "../../components/projects/ProjectForm.jsx";
import { useAuth } from "../../lib/auth-context.jsx";

export function ProjectNewPage() {
  const { request } = useAuth();
  const navigate = useNavigate();
  async function createProject(payload) {
    const project = await request("/projects", { method: "POST", body: JSON.stringify(payload) });
    navigate(`/projects/${project.id}`, { replace: true });
  }
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link className="text-sm font-semibold text-slate-400 hover:text-white" to="/projects">← Back to projects</Link>
      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">New project</p>
        <h1 className="mt-2 text-3xl font-black">Group an application</h1>
        <p className="mt-2 text-slate-400">After creating it, add every public endpoint that should be monitored.</p>
        <div className="mt-8"><ProjectForm onSubmit={createProject} submitLabel="Create project" /></div>
      </section>
    </main>
  );
}
