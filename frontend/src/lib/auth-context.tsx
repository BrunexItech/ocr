"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, getRole, getToken, setRole as persistRole, setToken } from "./api";

type AuthUser = { id: string; email: string; name: string; role: string };

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      // Defer to a microtask so this doesn't call setState synchronously within the
      // effect body itself - keeps the same shape as the async branch below.
      Promise.resolve().then(() => setLoading(false));
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => {
        setToken(null);
        persistRole(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.login(email, password);
    setToken(res.access_token);
    persistRole(res.role);
    const me = await api.me();
    setUser(me);
    router.push("/documents");
  }

  function logout() {
    setToken(null);
    persistRole(null);
    setUser(null);
    router.push("/login");
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function roleFallback(): string | null {
  return getRole();
}
