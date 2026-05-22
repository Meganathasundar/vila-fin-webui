import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { login as apiLogin, logout as apiLogout, getMe } from "@/api/auth";
import { setAccessToken, getAccessToken } from "@/api/client";
import type { Profile } from "@/types/api";

interface AuthUser {
  id: string;
  email: string | null;
  role: "admin" | "manager" | "agent";
  full_name: string;
  phone: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function profileToUser(p: Profile): AuthUser {
  return {
    id: p.id ?? "",
    email: p.email ?? null,
    role: p.role ?? "agent",
    full_name: p.full_name ?? "",
    phone: p.phone ?? "",
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Attempt silent restore via refresh token cookie
    const token = getAccessToken();
    if (token) {
      getMe()
        .then((profile) => setUser(profileToUser(profile)))
        .catch(() => setAccessToken(null))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (phone: string, password: string) => {
    const tokens = await apiLogin({ phone, password });
    if (!tokens.access_token) throw new Error("No token");
    setAccessToken(tokens.access_token);
    const profile = await getMe();
    setUser(profileToUser(profile));
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // ignore
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, accessToken: getAccessToken(), login, logout, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
