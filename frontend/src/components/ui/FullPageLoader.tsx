import { useTranslation } from "../../hooks/useTranslation";
import { LogoMark } from "../Logo";
import { Spinner } from "./Spinner";

export function FullPageLoader() {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas" role="status" aria-live="polite">
      <div className="flex animate-fade flex-col items-center gap-4">
        <LogoMark className="size-9" />
        <p className="flex items-center gap-2 text-[0.8125rem] text-muted">
          <Spinner /> {t("common.loading")}
        </p>
      </div>
    </div>
  );
}
