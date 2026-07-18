import { Link, useNavigate, useParams } from "react-router-dom";
import { MonitorForm } from "../../components/monitors/MonitorForm.jsx";
import { useAuth } from "../../lib/auth-context.jsx";

export function MonitorNewPage() {
  const { request } = useAuth();
  const navigate = useNavigate();
  const { projectId } = useParams();

  async function createMonitor(payload) {
    const monitor = await request("/endpoints", {
      method: "POST",
      body: JSON.stringify({ ...payload, projectId }),
    });
    navigate(`/endpoints/${monitor.id}`, { replace: true });
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link className="text-sm font-semibold text-slate-400 hover:text-white" to={`/projects/${projectId}`}>← Back to project</Link>
      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">New configuration</p>
        <h1 className="mt-2 text-3xl font-black">Add an endpoint</h1>
        <p className="mt-2 text-slate-400">Define the endpoint, expected response, timeout, and automatic check interval.</p>
        <div className="mt-8"><MonitorForm onSubmit={createMonitor} submitLabel="Create endpoint" /></div>
      </div>
    </main>
  );
}
