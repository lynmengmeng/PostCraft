"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { API_BASE } from "@/lib/api";
import {
  clearAuth,
  getStoredUser,
  getToken,
  setAuth,
  type StoredUser,
} from "@/lib/auth";

export interface AuthConfig {
  auth_required: boolean;
  allow_register: boolean;
}

async function validateStoredSession(): Promise<StoredUser | null> {
  const token = getToken();
  const stored = getStoredUser();
  if (!token || !stored) return null;
  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) {
      clearAuth();
      return null;
    }
    const user = (await response.json()) as StoredUser;
    setAuth(token, user);
    return user;
  } catch {
    return stored;
  }
}

interface AuthContextValue {
  user: StoredUser | null;
  config: AuthConfig | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshConfig: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchAuthConfig(): Promise<AuthConfig> {
  const response = await fetch(`${API_BASE}/auth/config`, { cache: "no-store" });
  if (!response.ok) {
    return { auth_required: false, allow_register: true };
  }
  return response.json() as Promise<AuthConfig>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshConfig = useCallback(async () => {
    const cfg = await fetchAuthConfig();
    setConfig(cfg);
    return cfg;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cfg = await fetchAuthConfig();
      if (cancelled) return;
      setConfig(cfg);
      const validated = await validateStoredSession();
      if (cancelled) return;
      setUser(validated);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || "登录失败");
    }
    const data = (await response.json()) as {
      access_token: string;
      user: StoredUser;
    };
    setAuth(data.access_token, data.user);
    setUser(data.user);
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || "注册失败");
    }
    const data = (await response.json()) as {
      access_token: string;
      user: StoredUser;
    };
    setAuth(data.access_token, data.user);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      config,
      loading,
      login,
      register,
      logout,
      refreshConfig,
    }),
    [user, config, loading, login, register, logout, refreshConfig],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export function useAuthOptional() {
  return useContext(AuthContext);
}

export function isAuthenticated(): boolean {
  return Boolean(getToken() && getStoredUser());
}
