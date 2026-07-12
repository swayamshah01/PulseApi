import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FormError } from "../../components/auth/FormError.jsx";
import { MonitorForm } from "../../components/monitors/MonitorForm.jsx";
import { useAuth } from "../../lib/auth-context.jsx";

export function MonitorEditPage() {
  const { monitorId } = useParams();
  const { request } = useAuth();
  const navigate = useNavigate();
  const [monitor, setMonitor] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setMonitor(await request(`/monitors/${monitorId}`));
      } catch (requestError) {
        setError(requestError);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [monitorId]);

  async function updateMonitor(payload) {
    const updated = await request(`/monitors/${monitorId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    navigate(`/monitors/${updated.id}`, { replace: true });
  }

  if (loading) return <main className="mx-auto max-w-3xl px-6 py-10 text-slate-400">Loading monitor...</main>;

  if (!monitor) {
    return <main className="mx-auto max-w-3xl px-6 py-10"><FormError error={error} /></main>;
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link className="text-sm font-semibold text-slate-400 hover:text-white" to={`/monitors/${monitor.id}`}>← Back to monitor</Link>
      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">Configuration</p>
        <h1 className="mt-2 text-3xl font-black">Edit {monitor.name}</h1>
        <p className="mt-2 text-slate-400">Health and historical fields cannot be edited.</p>
        <div className="mt-8">
          <MonitorForm
            initialValues={{
              name: monitor.name,
              url: monitor.url,
              expectedStatusCode: monitor.expectedStatusCode,
              timeoutMs: monitor.timeoutMs,
              intervalSeconds: monitor.intervalSeconds,
            }}
            onSubmit={updateMonitor}
            submitLabel="Save changes"
          />
        </div>
      </div>
    </main>
  );
}
