import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { authApi } from "../api/auth";
import { setUnauthorizedHandler } from "../api/client";
import type { CurrentUser, LoginRequest, RegisterRequest } from "../api/contract";
import { tokenStorage } from "../api/tokenStorage";
import { AuthContext, type AuthContextValue, type AuthStatus } from "./authContext";

/**
 * Central auth state.
 * - On load: if a token is saved, call /me to restore the session.
 * - login(): success ONLY when the API returns a token AND /me confirms the user.
 * - Any later 401 from a protected call logs the user out (see api/client.ts).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(() => (tokenStorage.get() ? "checking" : "unauthenticated"));
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Restore session once on start-up.
  useEffect(() => {
    if (!tokenStorage.get()) return;
    let cancelled = false;

    authApi
      .me()
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        tokenStorage.clear();
        setUser(null);
        setStatus("unauthenticated");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // React to 401s coming from any protected API call.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setStatus("unauthenticated");
      setSessionExpired(true);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  /** A token only counts once /me confirms it. */
  const loginWithToken = useCallback(async (token: string) => {
    tokenStorage.set(token);
    try {
      const me = await authApi.me();
      setUser(me);
      setSessionExpired(false);
      setStatus("authenticated");
    } catch (error) {
      tokenStorage.clear();
      throw error;
    }
  }, []);

  const login = useCallback(
    async (credentials: LoginRequest) => loginWithToken(await authApi.login(credentials)),
    [loginWithToken],
  );

  const register = useCallback(async (data: RegisterRequest) => {
    await authApi.register(data);
  }, []);

  const logout = useCallback(() => {
    const token = tokenStorage.get();
    if (token) void authApi.logout(token);
    tokenStorage.clear();
    setUser(null);
    setSessionExpired(false);
    setStatus("unauthenticated");
  }, []);

  const updateUser = useCallback((changes: Partial<CurrentUser>) => {
    setUser((current) => (current ? { ...current, ...changes } : current));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, sessionExpired, login, loginWithToken, register, logout, updateUser }),
    [status, user, sessionExpired, login, loginWithToken, register, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
