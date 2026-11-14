import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Camera, Github, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { toApiError } from "../api/errors";
import { profileApi, USERNAME_PATTERN, type Profile } from "../api/profile";
import { PageHeader } from "../components/layout/PageHeader";
import { Alert } from "../components/ui/Alert";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";
import { TextField } from "../components/ui/TextField";
import { useApiErrorMessage } from "../hooks/useApiErrorMessage";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "../hooks/useTranslation";
import { cropToSquare, isAcceptedImage, MAX_INPUT_BYTES } from "../lib/cropImage";

/** The Google "G" in its own colours (lucide has no brand icons for Google). */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z"
      />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
    </svg>
  );
}

export function ProfilePage() {
  const { t } = useTranslation();
  const apiErrorMessage = useApiErrorMessage();
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"username" | "upload" | "github" | "google" | "remove" | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    profileApi
      .get()
      .then((p) => {
        if (!active) return;
        setProfile(p);
        setUsername(p.username);
      })
      .catch(() => active && setLoadFailed(true));
    return () => {
      active = false;
    };
  }, []);

  /** Every change returns the new profile; the sidebar and greeting follow it. */
  const apply = (next: Profile) => {
    setProfile(next);
    updateUser({ username: next.username, avatarUrl: next.avatarUrl });
  };

  const run = async (kind: NonNullable<typeof busy>, action: () => Promise<Profile>, success: string) => {
    setBusy(kind);
    try {
      apply(await action());
      toast.success(success);
    } catch (err) {
      const message = apiErrorMessage(toApiError(err));
      toast.error(message.title, { description: message.detail });
    } finally {
      setBusy(null);
    }
  };

  const onPickFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // picking the same file again still triggers a change
    if (!file) return;
    if (!isAcceptedImage(file)) {
      toast.error(t("profile.pictureType"));
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      toast.error(t("profile.pictureTooBig"));
      return;
    }
    await run("upload", async () => profileApi.uploadAvatar(await cropToSquare(file)), t("profile.pictureSaved"));
  };

  const onSaveUsername = async (event: FormEvent) => {
    event.preventDefault();
    const value = username.trim();
    if (!USERNAME_PATTERN.test(value)) {
      setUsernameError(t("profile.usernameInvalid"));
      return;
    }
    setUsernameError(null);
    setBusy("username");
    try {
      const next = await profileApi.setUsername(value);
      apply(next);
      setUsername(next.username);
      toast.success(t("profile.usernameSaved"));
    } catch (err) {
      const error = toApiError(err);
      // "That username is taken" / validation messages belong under the field
      setUsernameError(error.serverMessage ?? apiErrorMessage(error).title);
    } finally {
      setBusy(null);
    }
  };

  if (loadFailed) {
    return (
      <div className="max-w-3xl">
        <PageHeader title={t("profile.title")} />
        <Alert tone="error" title={t("profile.loadError")} />
      </div>
    );
  }

  const github = profile?.providerAvatars.find((p) => p.source === "GITHUB");
  const google = profile?.providerAvatars.find((p) => p.source === "GOOGLE");
  const changed = profile !== null && username.trim() !== profile.username;

  return (
    <div className="max-w-3xl">
      <PageHeader title={t("profile.title")} description={t("profile.subtitle")} />

      <div className="space-y-4">
        <Card data-enter="support" aria-labelledby="picture-heading">
          <CardHeader id="picture-heading" title={t("profile.picture")} description={t("profile.pictureHint")} />
          {profile ? (
            <div className="flex flex-wrap items-center gap-5">
              <div className="relative">
                <Avatar
                  key={profile.avatarUrl ?? "none"}
                  url={profile.avatarUrl}
                  name={profile.username}
                  size="lg"
                  className="animate-pop ring-1 ring-line"
                />
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={busy !== null}
                  aria-hidden="true"
                  tabIndex={-1}
                  className="rl-press absolute -right-1 -bottom-1 grid size-8 place-items-center rounded-full border border-line bg-surface text-ink-2 shadow-pop hover:text-ink disabled:opacity-50"
                >
                  <Camera className="size-4" aria-hidden="true" />
                </button>
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                {profile.avatarSource && profile.avatarSource !== "NONE" && profile.avatarUrl ? (
                  <Badge tone="neutral">
                    {t(`profile.source.${profile.avatarSource as "GITHUB" | "GOOGLE" | "UPLOAD"}`)}
                  </Badge>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={(e) => void onPickFile(e)}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busy === "upload"}
                    disabled={busy !== null}
                    leftIcon={<Camera className="size-3.5" aria-hidden="true" />}
                    onClick={() => fileInput.current?.click()}
                  >
                    {profile.avatarUrl ? t("profile.change") : t("profile.upload")}
                  </Button>
                  {github && profile.avatarSource !== "GITHUB" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busy === "github"}
                      disabled={busy !== null}
                      leftIcon={<Github className="size-3.5" aria-hidden="true" />}
                      onClick={() =>
                        void run("github", () => profileApi.useProviderAvatar("GITHUB"), t("profile.pictureSaved"))
                      }
                    >
                      {t("profile.useGithub")}
                    </Button>
                  ) : null}
                  {google && profile.avatarSource !== "GOOGLE" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busy === "google"}
                      disabled={busy !== null}
                      leftIcon={<GoogleMark />}
                      onClick={() =>
                        void run("google", () => profileApi.useProviderAvatar("GOOGLE"), t("profile.pictureSaved"))
                      }
                    >
                      {t("profile.useGoogle")}
                    </Button>
                  ) : null}
                  {profile.avatarUrl ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={busy === "remove"}
                      disabled={busy !== null}
                      leftIcon={<Trash2 className="size-3.5" aria-hidden="true" />}
                      onClick={() => void run("remove", () => profileApi.removeAvatar(), t("profile.pictureRemoved"))}
                    >
                      {t("profile.remove")}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-5" role="status" aria-label={t("common.loading")}>
              <Skeleton className="size-20 rounded-full" />
              <Skeleton className="h-8 w-56" />
            </div>
          )}
        </Card>

        <Card data-enter="support" aria-labelledby="username-heading">
          <CardHeader id="username-heading" title={t("profile.username")} />
          {profile ? (
            <form onSubmit={(e) => void onSaveUsername(e)} noValidate className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1 basis-64">
                <TextField
                  label={t("profile.username")}
                  hideLabel
                  value={username}
                  maxLength={30}
                  autoComplete="username"
                  spellCheck={false}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setUsernameError(null);
                  }}
                  error={usernameError ?? undefined}
                  hint={t("profile.usernameHint")}
                  startAdornment={<span className="text-[0.8125rem]">@</span>}
                />
              </div>
              <Button type="submit" loading={busy === "username"} disabled={!changed || busy !== null} className="h-10">
                {t("profile.save")}
              </Button>
            </form>
          ) : (
            <Skeleton className="h-10" />
          )}
        </Card>

        {profile ? (
          <Card data-enter="support" aria-labelledby="account-heading">
            <CardHeader id="account-heading" title={t("settings.account")} />
            <dl className="grid gap-3 text-[0.8125rem] sm:grid-cols-2">
              <div>
                <dt className="text-muted">{t("profile.email")}</dt>
                <dd className="mt-0.5 font-medium break-all text-ink">{profile.email}</dd>
              </div>
              <div>
                <dt className="text-muted">{t("user.role")}</dt>
                <dd className="mt-1">
                  <Badge>{profile.role}</Badge>
                </dd>
              </div>
            </dl>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
