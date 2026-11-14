import { FolderGit2, LayoutGrid, type LucideIcon } from "lucide-react";
import type { TranslationKey } from "../../i18n/locales/en";

export interface NavItem {
  to: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  /** Restrict to roles once they are agreed (see auth/permissions.ts). Empty = all users. */
  roles?: readonly string[];
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: "/dashboard", labelKey: "nav.overview", icon: LayoutGrid },
  { to: "/projects", labelKey: "nav.projects", icon: FolderGit2 },
];
