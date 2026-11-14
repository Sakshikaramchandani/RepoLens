import { useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronsLeft, ChevronsRight, Github, Package, X } from "lucide-react";
import { canAccess } from "../../auth/permissions";
import { useAuth } from "../../hooks/useAuth";
import { useSlidingIndicator } from "../../hooks/useSlidingIndicator";
import { useTranslation } from "../../hooks/useTranslation";
import { useProjects } from "../../projects/projectsContext";
import { Logo } from "../Logo";
import { IconButton } from "../ui/Button";
import { cn } from "../ui/cn";
import { NAV_ITEMS, type NavItem } from "./navItems";
import { UserMenu } from "./UserMenu";

const RECENT_LIMIT = 6;

interface SidebarProps {
  /** Desktop only: removed entirely (focus on the content). Phones keep the drawer. */
  hidden?: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const rowClass = (collapsed: boolean) =>
  cn(
    "relative z-10 flex h-8 items-center gap-2.5 rounded-md px-2 text-[0.8125rem] font-medium transition-colors duration-150",
    collapsed && "lg:justify-center lg:px-0",
  );

function isActivePath(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

function NavEntry({ item, collapsed, active }: { item: NavItem; collapsed: boolean; active: boolean }) {
  const { t } = useTranslation();
  const label = t(item.labelKey);
  const Icon = item.icon;
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.to === "/projects"}
        title={collapsed ? label : undefined}
        data-active={active}
        className={cn(rowClass(collapsed), active ? "text-ink" : "text-muted hover:text-ink")}
      >
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span className={cn("truncate", collapsed && "lg:sr-only")}>{label}</span>
      </NavLink>
    </li>
  );
}

/**
 * Light, structural sidebar. One pill slides between the active rows (primary nav and recent projects
 * share it), so moving around the app reads as one continuous motion.
 */
export function Sidebar({ hidden = false, collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { projects, status } = useProjects();
  const { pathname } = useLocation();
  const navRef = useRef<HTMLElement>(null);

  const primary = NAV_ITEMS.filter((item) => canAccess(user, item.roles));
  const recent = projects.slice(0, RECENT_LIMIT);
  const activeProject = /^\/projects\/(\d+)/.exec(pathname)?.[1];
  const pill = useSlidingIndicator(navRef, [pathname, collapsed, recent.length, mobileOpen]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-30 bg-[var(--rl-scrim)] transition-opacity duration-300 lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      <aside
        id="app-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-canvas transition-[transform,visibility] duration-300 ease-[var(--ease-drawer)] lg:bg-transparent",
          mobileOpen ? "visible translate-x-0 shadow-float" : "invisible -translate-x-full",
          "lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 lg:overflow-hidden lg:shadow-none lg:transition-[width,visibility]",
          hidden ? "lg:invisible lg:w-0" : cn("lg:visible", collapsed ? "lg:w-[3.75rem]" : "lg:w-60"),
        )}
      >
        <div className={cn("flex h-14 items-center justify-between px-4", collapsed && "lg:justify-center lg:px-0")}>
          <Logo compact={collapsed} className={cn(collapsed && "lg:[&>span]:hidden")} />
          <IconButton label={t("nav.closeMenu")} onClick={onCloseMobile} className="lg:hidden">
            <X className="size-4" aria-hidden="true" />
          </IconButton>
        </div>

        <nav
          ref={navRef}
          aria-label={t("nav.mainMenu")}
          className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3"
        >
          {pill ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-0 left-0 rounded-md bg-surface shadow-card ring-1 ring-line transition-[transform,width,height] duration-[280ms] ease-[var(--ease-out)]"
              style={{ transform: `translate(${pill.x}px, ${pill.y}px)`, width: pill.w, height: pill.h }}
            />
          ) : null}

          <ul className="space-y-0.5">
            {primary.map((item) => (
              <NavEntry
                key={item.to}
                item={item}
                collapsed={collapsed}
                active={item.to === "/projects" ? pathname === "/projects" : isActivePath(pathname, item.to)}
              />
            ))}
          </ul>

          <div className={cn("mt-6", collapsed && "lg:hidden")}>
            <p className="px-2 pb-1.5 text-[0.6875rem] font-medium tracking-wide text-faint uppercase">
              {t("nav.recent")}
            </p>
            {status === "ready" && recent.length === 0 ? (
              <p className="px-2 text-[0.8125rem] text-faint">{t("nav.noRecent")}</p>
            ) : (
              <ul className="space-y-0.5">
                {recent.map((project) => {
                  const active = activeProject === String(project.id);
                  const Icon = project.sourceType === "GITHUB" ? Github : Package;
                  return (
                    <li key={project.id}>
                      <NavLink
                        to={`/projects/${project.id}`}
                        data-active={active}
                        className={cn(rowClass(false), active ? "text-ink" : "text-muted hover:text-ink")}
                      >
                        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{project.name}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </nav>

        <div className="space-y-1 border-t border-line p-2">
          <UserMenu collapsed={collapsed} />
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
            aria-expanded={!collapsed}
            aria-controls="app-sidebar"
            title={collapsed ? t("nav.expand") : t("nav.collapse")}
            className={cn(
              "rl-press hidden h-8 w-full items-center gap-2 rounded-md px-2 text-[0.8125rem] text-faint hover:bg-surface-3/60 hover:text-ink lg:flex",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? (
              <ChevronsRight className="size-4" aria-hidden="true" />
            ) : (
              <ChevronsLeft className="size-4" aria-hidden="true" />
            )}
            {!collapsed && <span>{t("nav.collapse")}</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
