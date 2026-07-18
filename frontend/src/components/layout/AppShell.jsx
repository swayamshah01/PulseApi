import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../lib/auth-context.jsx";

function navClass({ isActive }) {
  return `rounded-lg px-3 py-2 text-sm font-semibold transition ${
    isActive
      ? "bg-emerald-400 text-slate-950"
      : "text-slate-300 hover:bg-slate-800 hover:text-white"
  }`;
}

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-8">
            <NavLink to="/dashboard" className="text-lg font-black tracking-tight text-emerald-400">
              PulseAPI
            </NavLink>
            <nav className="flex items-center gap-2" aria-label="Primary navigation">
              <NavLink to="/dashboard" className={navClass}>Dashboard</NavLink>
              <NavLink to="/projects" className={navClass}>Projects</NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-400 sm:inline">{user.email}</span>
            <button
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold hover:border-slate-500 disabled:opacity-60"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
