import { useEffect, useState } from "react";
import { Database, RefreshCw, Sparkles } from "lucide-react";
import { aiApi, type AiStatus, type ModelStatus } from "../../api/ai";
import { useTranslation } from "../../hooks/useTranslation";
import type { TranslationKey } from "../../i18n/locales/en";
import { Badge } from "../ui/Badge";
import { IconButton } from "../ui/Button";
import { Skeleton } from "../ui/Skeleton";

const ROLE_KEY: Record<ModelStatus["role"], TranslationKey> = {
  primary: "ai.role.primary",
  embedding: "ai.role.embedding",
};

const ROLE_ICON = { primary: Sparkles, embedding: Database } as const;

function Row({ status }: { status: ModelStatus }) {
  const { t } = useTranslation();
  const Icon = ROLE_ICON[status.role];
  const ok = status.configured && status.reachable;
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-md border border-line bg-surface-2 text-muted">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.75rem] text-muted">{t(ROLE_KEY[status.role])}</p>
        <p className="truncate font-mono text-[0.8125rem] text-ink">{status.model}</p>
        {!ok ? (
          <p className="mt-0.5 text-[0.75rem] text-muted">
            {status.configured ? t("ai.notReachable") : t("ai.notConfigured")}
          </p>
        ) : null}
      </div>
      <Badge tone={ok ? "success" : "warning"} dot>
        {ok ? t("ai.ready") : t("ai.unavailable")}
      </Badge>
    </li>
  );
}

/** Live status of the chat model and the embedding model. */
export function AiModelsList() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setFailed(false);
    aiApi
      .status()
      .then((s) => active && setStatus(s))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [nonce]);

  if (failed) {
    return (
      <div className="flex items-center justify-between gap-3 py-2 text-[0.8125rem] text-muted">
        {t("ai.loadError")}
        <IconButton label={t("common.retry")} size="sm" onClick={() => setNonce((n) => n + 1)}>
          <RefreshCw className="size-3.5" aria-hidden="true" />
        </IconButton>
      </div>
    );
  }
  if (!status) {
    return (
      <div className="space-y-2 py-1" role="status" aria-label={t("common.loading")}>
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
      </div>
    );
  }
  return (
    <ul className="divide-y divide-line">
      {status.chat.map((s) => (
        <Row key={`${s.role}-${s.model}`} status={s} />
      ))}
      <Row status={status.embedding} />
    </ul>
  );
}
