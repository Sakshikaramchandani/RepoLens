import { Navigate, Outlet, useLocation } from "react-router-dom";
import { FullPageLoader } from "../components/ui/FullPageLoader";
import { useAuth } from "../hooks/useAuth";

function safeRedirect(from: unknown): string {
  // Only allow in-app paths, and never bounce back to login/register (avoids loops).
  if (typeof from === "string" && from.startsWith("/") && !from.startsWith("//")) {
    if (!from.startsWith("/login") && !from.startsWith("/register")) return from;
  }
  return "/dashboard";
}

/** Login/Register: signed-in users are sent to where they wanted to go (or the dashboard). */
export function PublicOnlyRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "checking") return <FullPageLoader />;
  if (status === "authenticated") {
    const from = (location.state as { from?: unknown } | null)?.from;
    return <Navigate to={safeRedirect(from)} replace />;
  }
  return <Outlet />;
}
