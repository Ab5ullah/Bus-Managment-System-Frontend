"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ApiException, type AuthSession, type AuthUser, type PassengerProfile } from "../types";
import { isJwtExpired } from "./jwt";

interface AuthContextValue {
  user: AuthUser | null;
  profile: PassengerProfile | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<AuthSession>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<string | null>;
  getValidAccessToken: () => Promise<string | null>;
  setProfile: (profile: PassengerProfile | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: React.ReactNode;
  /** Skip automatic silent refresh on mount (useful for unit tests) */
  skipInitialRefresh?: boolean;
}

export function AuthProvider({ children, skipInitialRefresh = false }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!skipInitialRefresh);

  const accessTokenRef = useRef<string | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    accessTokenRef.current = session?.accessToken ?? null;
  }, [session]);

  const refreshSession = useCallback(async (): Promise<string | null> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const promise = (async () => {
      try {
        const res = await fetch("/api/session/refresh", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
          accessTokenRef.current = null;
          setSession(null);
          return null;
        }

        const json = (await res.json()) as {
          success?: boolean;
          data?: { accessToken?: string; user?: AuthUser; profile?: PassengerProfile | null };
        };

        const token = json?.data?.accessToken ?? null;
        const user = json?.data?.user ?? null;
        if (!token || !user) {
          accessTokenRef.current = null;
          setSession(null);
          return null;
        }

        const nextSession: AuthSession = {
          accessToken: token,
          user,
          profile: json.data?.profile ?? null,
        };
        accessTokenRef.current = token;
        setSession(nextSession);
        return token;
      } catch {
        accessTokenRef.current = null;
        setSession(null);
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = promise;
    return promise;
  }, []);

  useEffect(() => {
    if (skipInitialRefresh) return;
    let active = true;
    void refreshSession().finally(() => {
      if (active) setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [refreshSession, skipInitialRefresh]);

  const login = useCallback(async (identifier: string, password: string): Promise<AuthSession> => {
    const res = await fetch("/api/session/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) {
      const errObj = json?.error ?? {};
      throw new ApiException(
        errObj.message || "Authentication failed.",
        res.status,
        errObj.code || "AUTH_FAILED",
        errObj.details || {}
      );
    }

    const nextSession: AuthSession = {
      accessToken: json.data.accessToken,
      user: json.data.user,
      profile: json.data.profile ?? null,
    };
    accessTokenRef.current = nextSession.accessToken;
    setSession(nextSession);
    return nextSession;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    const token = accessTokenRef.current;
    accessTokenRef.current = null;
    setSession(null);

    await fetch("/api/session/logout", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }).catch(() => undefined);
  }, []);

  const getValidAccessToken = useCallback(async (): Promise<string | null> => {
    const current = accessTokenRef.current;
    if (current && !isJwtExpired(current, 20)) {
      return current;
    }
    return refreshSession();
  }, [refreshSession]);

  const setProfile = useCallback((profile: PassengerProfile | null) => {
    setSession((prev: AuthSession | null) => (prev ? { ...prev, profile } : prev));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      profile: session?.profile ?? null,
      accessToken: session?.accessToken ?? null,
      isAuthenticated: Boolean(session?.accessToken && session?.user),
      isLoading,
      login,
      logout,
      refreshSession,
      getValidAccessToken,
      setProfile,
    }),
    [session, isLoading, login, logout, refreshSession, getValidAccessToken, setProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return ctx;
}
