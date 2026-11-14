import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { LogoMark } from "../components/Logo";
import { useTranslation } from "../hooks/useTranslation";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-canvas px-6">
      <div className="flex max-w-sm animate-rise flex-col items-center text-center">
        <LogoMark className="size-9" />
        <p className="mt-6 font-mono text-[0.75rem] text-faint">404</p>
        <h1 className="mt-2 text-2xl font-semibold">{t("notFound.title")}</h1>
        <p className="mt-2 text-muted">{t("notFound.body")}</p>
        <Link
          to="/dashboard"
          className="rl-press mt-6 inline-flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-3.5 text-sm font-medium text-ink shadow-card hover:bg-surface-2"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("notFound.back")}
        </Link>
      </div>
    </main>
  );
}
