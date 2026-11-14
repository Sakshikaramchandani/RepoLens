import { Monitor, Moon, Sun } from "lucide-react";
import { AiModelsList } from "../components/ai/AiModelsList";
import { GithubConnectionPanel } from "../components/github/GithubConnectionPanel";
import { PageHeader } from "../components/layout/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../hooks/useTranslation";
import type { ThemePreference } from "../theme/themeContext";

export function SettingsPage() {
  const { t } = useTranslation();
  const { preference, setPreference } = useTheme();

  return (
    <div className="max-w-3xl">
      <PageHeader title={t("settings.title")} description={t("settings.subtitle")} />

      <div className="space-y-4">
        <Card data-enter="support" aria-labelledby="appearance-heading">
          <CardHeader
            id="appearance-heading"
            title={t("settings.appearance")}
            description={t("settings.appearanceHint")}
          />
          <SegmentedControl<ThemePreference>
            label={t("settings.appearance")}
            value={preference}
            onChange={setPreference}
            options={[
              { value: "light", label: t("theme.light"), icon: <Sun className="size-3.5" aria-hidden="true" /> },
              { value: "dark", label: t("theme.dark"), icon: <Moon className="size-3.5" aria-hidden="true" /> },
              { value: "system", label: t("theme.system"), icon: <Monitor className="size-3.5" aria-hidden="true" /> },
            ]}
          />
        </Card>

        <Card data-enter="support" aria-labelledby="github-heading">
          <CardHeader id="github-heading" title={t("settings.github")} description={t("settings.githubHint")} />
          <GithubConnectionPanel />
        </Card>

        <Card data-enter="support" aria-labelledby="ai-heading">
          <CardHeader id="ai-heading" title={t("settings.ai")} description={t("settings.aiHint")} />
          <AiModelsList />
        </Card>
      </div>
    </div>
  );
}
