import { useState } from "react";
import { avatarSrc } from "../../api/profile";
import { cn } from "./cn";

/**
 * Profile picture, or the first letter on an ember gradient when there is none (or it fails to
 * load — e.g. an expired provider URL). Decorative: the name is always shown next to it.
 */
export function Avatar({
  url,
  name,
  size = "sm",
  className,
}: {
  url?: string | null;
  name: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  const src = avatarSrc(url);
  const [failed, setFailed] = useState<string | null>(null);
  const initial = (name.trim().charAt(0) || "?").toUpperCase();

  if (src && failed !== src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        referrerPolicy="no-referrer"
        onError={() => setFailed(src)}
        className={cn(
          "shrink-0 rounded-full bg-surface-3 object-cover",
          size === "lg" ? "size-20" : "size-7",
          className,
        )}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-strong font-semibold text-on-accent",
        size === "lg" ? "size-20 text-3xl" : "size-7 text-[0.75rem]",
        className,
      )}
    >
      {initial}
    </span>
  );
}
