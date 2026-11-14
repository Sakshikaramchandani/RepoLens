import { Navigate, Outlet, useLocation } from "react-router-dom";
import { FullPageLoader } from "../components/ui/FullPageLoader";
import { useAuth } from "../hooks/useAuth";

/** Only signed-in users pass. Others go to /login and come back afterwards. */
export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "checking") return <FullPageLoader />;
  if (status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}
