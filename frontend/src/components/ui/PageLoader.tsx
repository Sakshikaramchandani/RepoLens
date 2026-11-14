import { useTranslation } from "../../hooks/useTranslation";
import { Skeleton } from "./Skeleton";

/** Shown inside the app shell while a page's code downloads: the page's shape, not a spinner. */
export function PageLoader() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t("common.loading")} className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    </div>
  );
}
