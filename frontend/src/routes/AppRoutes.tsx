import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { GOOGLE_CALLBACK_PATH } from "../api/auth";
import { GITHUB_CALLBACK_PATH } from "../api/github";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { PublicOnlyRoute } from "../auth/PublicOnlyRoute";
import { AppLayout } from "../components/layout/AppLayout";
import { AuthLayout } from "../components/layout/AuthLayout";
import { PageLoader } from "../components/ui/PageLoader";
import { DashboardPage } from "../pages/DashboardPage";
import { GithubCallbackPage } from "../pages/GithubCallbackPage";
import { GoogleCallbackPage } from "../pages/GoogleCallbackPage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { ProfilePage } from "../pages/ProfilePage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { RegisterPage } from "../pages/RegisterPage";
import { SettingsPage } from "../pages/SettingsPage";

// The project workspace pulls in the syntax highlighter and markdown renderer:
// download it only when a project is opened.
const ProjectLayout = lazy(() => import("../pages/project/ProjectLayout").then((m) => ({ default: m.ProjectLayout })));
const ProjectCodePage = lazy(() =>
  import("../pages/project/ProjectCodePage").then((m) => ({ default: m.ProjectCodePage })),
);
const ProjectChatPage = lazy(() =>
  import("../pages/project/ProjectChatPage").then((m) => ({ default: m.ProjectChatPage })),
);
const ProjectReviewPage = lazy(() =>
  import("../pages/project/ProjectReviewPage").then((m) => ({ default: m.ProjectReviewPage })),
);
const ProjectRiskPage = lazy(() =>
  import("../pages/project/ProjectRiskPage").then((m) => ({ default: m.ProjectRiskPage })),
);

const lazyPage = (node: ReactNode) => <Suspense fallback={<PageLoader />}>{node}</Suspense>;

/**
 * Route map
 *   Public only : /login, /register (signed-in users are redirected away)
 *   Protected   : /dashboard, /projects, /projects/:id[/chat|/review|/risk], /settings
 *   Public      : /integrations/github/callback (GitHub sign-in and connect), /auth/google/callback
 */
export function AppRoutes() {
  const location = useLocation();

  // GitHub returns to whatever callback URL the OAuth app has saved (e.g. just http://localhost:5173).
  // Wherever its ?code&state lands, hand it to the callback page.
  const query = new URLSearchParams(location.search);
  // (Google's result always arrives on its own callback page — never hand that one to GitHub.)
  const onCallbackPage = location.pathname === GITHUB_CALLBACK_PATH || location.pathname === GOOGLE_CALLBACK_PATH;
  if (!onCallbackPage && query.has("state") && (query.has("code") || query.has("error"))) {
    return <Navigate to={`${GITHUB_CALLBACK_PATH}${location.search}`} replace />;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route element={<PublicOnlyRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={lazyPage(<ProjectLayout />)}>
            <Route index element={lazyPage(<ProjectCodePage />)} />
            <Route path="chat" element={lazyPage(<ProjectChatPage />)} />
            <Route path="review" element={lazyPage(<ProjectReviewPage />)} />
            <Route path="risk" element={lazyPage(<ProjectRiskPage />)} />
          </Route>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          {/* old links */}
          <Route path="/chat" element={<Navigate to="/projects" replace />} />
          <Route path="/review" element={<Navigate to="/projects" replace />} />
        </Route>
      </Route>

      {/* public: GitHub sign-in (signed out) and connect (signed in) share this callback */}
      <Route path={GITHUB_CALLBACK_PATH} element={<GithubCallbackPage />} />
      {/* public: the backend forwards Google's redirect here */}
      <Route path={GOOGLE_CALLBACK_PATH} element={<GoogleCallbackPage />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
