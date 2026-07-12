import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/auth/ProtectedRoute.jsx";
import { useAuth } from "./lib/auth-context.jsx";
import { LoginPage } from "./pages/auth/LoginPage.jsx";
import { RegisterPage } from "./pages/auth/RegisterPage.jsx";
import { AccountPage } from "./pages/dashboard/AccountPage.jsx";

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
      <Route path="/" element={<Navigate to={user ? "/app" : "/login"} replace />} />
      <Route path="/login" element={user ? <Navigate to="/app" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/app" replace /> : <RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AccountPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
