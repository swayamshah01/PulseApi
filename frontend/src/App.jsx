import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/auth/ProtectedRoute.jsx";
import { AppShell } from "./components/layout/AppShell.jsx";
import { useAuth } from "./lib/auth-context.jsx";
import { LoginPage } from "./pages/auth/LoginPage.jsx";
import { RegisterPage } from "./pages/auth/RegisterPage.jsx";
import { DashboardPage } from "./pages/dashboard/DashboardPage.jsx";
import { MonitorDetailsPage } from "./pages/monitors/MonitorDetailsPage.jsx";
import { MonitorEditPage } from "./pages/monitors/MonitorEditPage.jsx";
import { MonitorNewPage } from "./pages/monitors/MonitorNewPage.jsx";
import { ProjectDetailsPage } from "./pages/projects/ProjectDetailsPage.jsx";
import { ProjectEditPage } from "./pages/projects/ProjectEditPage.jsx";
import { ProjectListPage } from "./pages/projects/ProjectListPage.jsx";
import { ProjectNewPage } from "./pages/projects/ProjectNewPage.jsx";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-slate-100">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
          Restoring your session…
        </p>
      </main>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectListPage />} />
          <Route path="/projects/new" element={<ProjectNewPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailsPage />} />
          <Route path="/projects/:projectId/edit" element={<ProjectEditPage />} />
          <Route path="/projects/:projectId/endpoints/new" element={<MonitorNewPage />} />
          <Route path="/endpoints/:monitorId" element={<MonitorDetailsPage />} />
          <Route path="/endpoints/:monitorId/edit" element={<MonitorEditPage />} />
          <Route path="/monitors" element={<Navigate to="/projects" replace />} />
          <Route path="/monitors/new" element={<Navigate to="/projects" replace />} />
          <Route path="/monitors/:monitorId" element={<MonitorDetailsPage />} />
          <Route path="/monitors/:monitorId/edit" element={<MonitorEditPage />} />
        </Route>
        <Route path="/app" element={<Navigate to="/dashboard" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
