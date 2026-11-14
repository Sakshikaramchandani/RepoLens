import { createContext } from "react";
import type { CurrentUser, LoginRequest, RegisterRequest } from "../api/contract";

/** checking = restoring a saved session on page load. */
export type AuthStatus = "checking" | "authenticated" | "unauthenticated";

export interface AuthContextValue {
  status: AuthStatus;
  user: CurrentUser | null;
  /** True after the backend rejected a saved/expired token. Shown on the login page. */
  sessionExpired: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  /** Finish a sign-in that produced a token elsewhere (e.g. GitHub OAuth). */
  loginWithToken: (token: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  /** After a profile edit: merge the new username / picture into the signed-in user. */
  updateUser: (changes: Partial<CurrentUser>) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
