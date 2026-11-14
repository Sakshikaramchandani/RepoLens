import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronsUpDown, LogOut, Settings, UserRound } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { displayName } from "../../lib/user";
import { Avatar } from "../ui/Avatar";
import { useTranslation } from "../../hooks/useTranslation";
import { Button } from "../ui/Button";
import { cn } from "../ui/cn";
import { Modal } from "../ui/Modal";

/** Account button at the bottom of the sidebar. The menu opens upward, from its trigger. */
export function UserMenu({ collapsed }: { collapsed?: boolean }) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;
  const name = displayName(user);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t("user.menu")}
        className={cn(
          "rl-press flex h-11 w-full items-center gap-2.5 rounded-md px-2 text-left hover:bg-surface-3/60",
          collapsed && "lg:justify-center lg:px-0",
        )}
      >
        <Avatar url={user.avatarUrl} name={name} />
        <span className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
          <span className="block truncate text-[0.8125rem] font-medium text-ink">{name}</span>
          <span className="block truncate text-[0.6875rem] text-muted">{user.email}</span>
        </span>
        <ChevronsUpDown className={cn("size-3.5 shrink-0 text-faint", collapsed && "lg:hidden")} aria-hidden="true" />
      </button>

      {open ? (
        <div
          id={menuId}
          className="absolute bottom-full left-0 z-50 mb-2 w-64 origin-bottom-left animate-pop rounded-lg bg-surface p-1.5 shadow-pop"
        >
          <div className="px-2.5 py-2">
            <p className="text-[0.6875rem] text-muted">{t("user.signedInAs")}</p>
            <p className="truncate text-[0.8125rem] font-medium text-ink">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="flex h-8 items-center gap-2 rounded-md px-2.5 text-[0.8125rem] text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <UserRound className="size-4" aria-hidden="true" /> {t("user.profile")}
          </Link>
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex h-8 items-center gap-2 rounded-md px-2.5 text-[0.8125rem] text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <Settings className="size-4" aria-hidden="true" /> {t("user.settings")}
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setConfirmOpen(true);
            }}
            className="flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[0.8125rem] text-ink-2 hover:bg-danger-soft hover:text-danger"
          >
            <LogOut className="size-4" aria-hidden="true" /> {t("user.logout")}
          </button>
        </div>
      ) : null}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t("user.logoutConfirmTitle")}
        description={t("user.logoutConfirmBody")}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              {t("user.cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmOpen(false);
                logout();
              }}
            >
              {t("user.logout")}
            </Button>
          </>
        }
      />
    </div>
  );
}
