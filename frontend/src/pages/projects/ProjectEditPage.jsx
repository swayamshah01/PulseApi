import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FormError } from "../../components/auth/FormError.jsx";
import { ProjectForm } from "../../components/projects/ProjectForm.jsx";
import { useAuth } from "../../lib/auth-context.jsx";

export function ProjectEditPage() {
  const { projectId } = useParams();
  const { request } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { request(`/projects/${projectId}`).then(setProject).catch(setError); }, [projectId]);

  if (!project) return <main className="mx-auto max-w-3xl px-6 py-10">{error ? <FormError error={error} /> : <p className="text-slate-400">Loading project...</p>}</main>;
  async function updateProject(payload) {
    const updated = await request(`/projects/${projectId}`, { method: "PATCH", body: JSON.stringify(payload) });
    navigate(`/projects/${updated.id}`, { replace: true });
  }
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link className="text-sm font-semibold text-slate-400 hover:text-white" to={`/projects/${project.id}`}>← Back to project</Link>
      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <h1 className="text-3xl font-black">Edit project</h1>
        <div className="mt-8"><ProjectForm initialValues={project} onSubmit={updateProject} submitLabel="Save project" /></div>
      </section>
    </main>
  );
}
