import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu, PanelLeft, PanelLeftClose } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";
import { PageEnter } from "../../motion/PageEnter";
import { ProjectsProvider } from "../../projects/ProjectsProvider";
import { Logo } from "../Logo";
import { MockModeBadge } from "../MockModeBadge";
import { ThemeToggle } from "../ThemeToggle";
import { IconButton } from "../ui/Button";
import { cn } from "../ui/cn";
import { Breadcrumbs } from "./Breadcrumbs";
import { Sidebar } from "./Sidebar";

const COLLAPSED_KEY = "repolens.sidebar.collapsed";
const HIDDEN_KEY = "repolens.sidebar.hidden";

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
const HIDE_SHORTCUT = isMac ? "⌘B" : "Ctrl+B";

/** /projects/5/chat and /projects/5/review share one entrance: the project header stays put. */
function sectionKey(pathname: string): string {
  return pathname.split("/").slice(0, 3).join("/");
}

/**
 * Signed-in shell: sidebar on the canvas, the page on a raised panel (desktop),
 * a translucent top bar that content scrolls under, and a drawer on phones.
 */
export function AppLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => readFlag(COLLAPSED_KEY));
  // desktop "focus": the sidebar is gone entirely, like closing the explorer in VS Code
  const [hidden, setHidden] = useState(() => readFlag(HIDDEN_KEY));
  const [mobileOpen, setMobileOpen] = useState(false);
  // inside a project (code, chat, review, risk) the work itself should own the screen
  const workspace = /^\/projects\/\d+/.test(location.pathname);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((value) => {
      writeFlag(COLLAPSED_KEY, !value);
      return !value;
    });
  }, []);

  const toggleHidden = useCallback(() => {
    setHidden((value) => {
      writeFlag(HIDDEN_KEY, !value);
      return !value;
    });
  }, []);

  // ⌘B / Ctrl+B toggles the sidebar, as in VS Code
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "b" || event.shiftKey || event.altKey) return;
      if (!(isMac ? event.metaKey : event.ctrlKey)) return;
      if (!window.matchMedia("(min-width: 1024px)").matches) return;
      event.preventDefault();
      toggleHidden();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggleHidden]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <ProjectsProvider>
      <div className="min-h-dvh bg-canvas lg:flex lg:h-dvh lg:overflow-hidden lg:bg-surface-2/60 dark:lg:bg-canvas">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-on-primary focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          {t("a11y.skipToContent")}
        </a>

        <Sidebar
          hidden={hidden}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <div className={cn("flex min-w-0 flex-1 flex-col lg:h-dvh lg:py-2 lg:pr-2", hidden && "lg:pl-2")}>
          <div
            id="app-scroll"
            className="flex min-h-dvh flex-1 flex-col bg-canvas lg:h-full lg:min-h-0 lg:overflow-y-auto lg:rounded-xl lg:border lg:border-line lg:bg-surface lg:shadow-card"
          >
            <header className="rl-glass sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-line px-4 sm:px-6 lg:h-12 lg:rounded-t-xl lg:px-8">
              <IconButton
                label={t("nav.openMenu")}
                onClick={() => setMobileOpen(true)}
                aria-expanded={mobileOpen}
                aria-controls="app-sidebar"
                className="-ml-2 lg:hidden"
              >
                <Menu className="size-4" aria-hidden="true" />
              </IconButton>
              <span className="lg:hidden">
                <Logo compact />
              </span>
              <IconButton
                label={hidden ? t("nav.showSidebar") : t("nav.hideSidebar")}
                title={`${hidden ? t("nav.showSidebar") : t("nav.hideSidebar")} (${HIDE_SHORTCUT})`}
                aria-keyshortcuts={isMac ? "Meta+B" : "Control+B"}
                aria-expanded={!hidden}
                aria-controls="app-sidebar"
                size="sm"
                onClick={toggleHidden}
                className="-ml-2 hidden lg:inline-flex"
              >
                {hidden ? (
                  <PanelLeft className="size-4" aria-hidden="true" />
                ) : (
                  <PanelLeftClose className="size-4" aria-hidden="true" />
                )}
              </IconButton>
              <span className="hidden min-w-0 lg:block">
                <Breadcrumbs />
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                <MockModeBadge />
                <ThemeToggle />
              </div>
            </header>

            <main
              id="main"
              tabIndex={-1}
              className={cn(
                "flex min-h-0 flex-1 flex-col px-4 py-6 outline-none sm:px-6 lg:px-8",
                workspace ? "lg:py-5" : "lg:py-8",
              )}
            >
              <PageEnter
                key={sectionKey(location.pathname)}
                className={cn("mx-auto flex min-h-0 w-full flex-1 flex-col", workspace ? "max-w-[96rem]" : "max-w-6xl")}
              >
                <Outlet />
              </PageEnter>
            </main>
          </div>
        </div>
      </div>
    </ProjectsProvider>
  );
}
