import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "./api-client.js";

const ACCESS_TOKEN_KEY = "pulseapi_access_token";
const AuthContext = createContext(null);

function saveAccessToken(token) {
  if (token) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() =>
    sessionStorage.getItem(ACCESS_TOKEN_KEY),
  );
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        let token = accessToken;

        if (token) {
          try {
            const currentUser = await apiRequest("/auth/me", { accessToken: token });
            if (active) setUser(currentUser);
            return;
          } catch {
            saveAccessToken(null);
          }
        }

        const refreshed = await apiRequest("/auth/refresh", { method: "POST" });
        token = refreshed.accessToken;
        saveAccessToken(token);
        if (active) setAccessToken(token);

        const currentUser = await apiRequest("/auth/me", { accessToken: token });
        if (active) setUser(currentUser);
      } catch {
        saveAccessToken(null);
        if (active) {
          setAccessToken(null);
          setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  async function authenticate(endpoint, credentials) {
    const session = await apiRequest(`/auth/${endpoint}`, {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    saveAccessToken(session.accessToken);
    setAccessToken(session.accessToken);
    setUser(session.user);
  }

  async function logout() {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } catch {
      // Local sign-out must still complete if the server is temporarily unavailable.
    } finally {
      saveAccessToken(null);
      setAccessToken(null);
      setUser(null);
    }
  }

  async function authenticatedRequest(path, options = {}) {
    try {
      return await apiRequest(path, { ...options, accessToken });
    } catch (error) {
      if (error.status !== 401) throw error;

      try {
        const refreshed = await apiRequest("/auth/refresh", { method: "POST" });
        saveAccessToken(refreshed.accessToken);
        setAccessToken(refreshed.accessToken);
        return await apiRequest(path, {
          ...options,
          accessToken: refreshed.accessToken,
        });
      } catch (refreshError) {
        saveAccessToken(null);
        setAccessToken(null);
        setUser(null);
        throw refreshError;
      }
    }
  }

  const value = useMemo(
    () => ({
      accessToken,
      user,
      loading,
      login: (credentials) => authenticate("login", credentials),
      register: (details) => authenticate("register", details),
      logout,
      request: authenticatedRequest,
    }),
    [accessToken, user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
