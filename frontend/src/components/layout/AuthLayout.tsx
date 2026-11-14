import { useRef } from "react";
import { Outlet } from "react-router-dom";
import { Check, FileCode2, Sparkles } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";
import { EASE_OUT, gsap, prefersReducedMotion, SplitText, useGSAP } from "../../motion/gsap";
import { Logo } from "../Logo";
import { MockModeBadge } from "../MockModeBadge";
import { ThemeToggle } from "../ThemeToggle";

const CITATIONS = ["JwtAuthFilter.java:31-58", "JwtService.java:40-62"];

/**
 * The product, shown working: a question, the model reading, the answer streaming in, citations
 * landing. Plays once on load; hovering or focusing the card replays it.
 */
function ProductPreview() {
  const { t } = useTranslation();
  const scope = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const answer = t("auth.preview.answer");

  const { contextSafe } = useGSAP(
    () => {
      const reduce = prefersReducedMotion();
      const textEl = scope.current?.querySelector<HTMLElement>("[data-answer]");
      if (!textEl) return;
      if (reduce) {
        textEl.textContent = answer;
        return;
      }
      play();
    },
    { scope },
  );

  const play = contextSafe(() => {
    const root = scope.current;
    const textEl = root?.querySelector<HTMLElement>("[data-answer]");
    if (!root || !textEl) return;
    if (timeline.current?.isActive()) return; // a hover mid-play does not restart it
    timeline.current?.kill();
    const typed = { n: 0 };
    textEl.textContent = "";

    timeline.current = gsap
      .timeline({ defaults: { ease: EASE_OUT } })
      .fromTo("[data-q]", { autoAlpha: 0, y: 8, scale: 0.98 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.35 }, 0.7)
      .fromTo("[data-typing]", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 1.0)
      .to("[data-typing]", { autoAlpha: 0, duration: 0.15 }, 1.75)
      .set("[data-caret]", { autoAlpha: 1 }, 1.8)
      .to(
        typed,
        {
          n: answer.length,
          duration: 1.6,
          ease: "none",
          onUpdate: () => {
            textEl.textContent = answer.slice(0, Math.round(typed.n));
          },
        },
        1.8,
      )
      .to("[data-caret]", { autoAlpha: 0, duration: 0.1 }, 3.45)
      .fromTo(
        "[data-cite]",
        { autoAlpha: 0, y: 4, scale: 0.96 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.3, stagger: 0.07 },
        3.5,
      );
  });

  return (
    <div
      ref={scope}
      data-enter-preview
      onPointerEnter={() => {
        if (!prefersReducedMotion()) play();
      }}
      aria-label={t("auth.preview.label")}
      role="img"
      className="relative w-full max-w-md rounded-xl bg-surface p-4 shadow-float"
    >
      <div className="flex items-center gap-1.5 border-b border-line pb-3">
        <span className="size-2.5 rounded-full bg-surface-3" />
        <span className="size-2.5 rounded-full bg-surface-3" />
        <span className="size-2.5 rounded-full bg-surface-3" />
        <span className="ml-auto font-mono text-[0.6875rem] text-faint">qwen2.5-coder:7b</span>
      </div>
      <div className="space-y-4 pt-4" aria-hidden="true">
        <div
          data-q
          className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-sm bg-primary px-3 py-2 text-[0.8125rem] text-on-primary"
        >
          {t("auth.preview.question")}
        </div>
        <div className="flex gap-2.5">
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
            <Sparkles className="size-3.5" />
          </span>
          <div className="relative min-w-0 flex-1">
            <span data-typing className="rl-typing invisible absolute top-2 left-0 text-muted">
              <span />
              <span />
              <span />
            </span>
            <p className="min-h-[4.5rem] text-[0.8125rem] leading-relaxed text-ink-2">
              <span data-answer />
              <span data-caret className="rl-caret invisible" />
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CITATIONS.map((c) => (
                <span
                  key={c}
                  data-cite
                  className="invisible inline-flex h-6 items-center gap-1 rounded-sm border border-line bg-surface-2 px-1.5 font-mono text-[0.6875rem] text-ink-2"
                >
                  <FileCode2 className="size-3 text-accent" /> {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthLayout() {
  const { t } = useTranslation();
  const hero = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const split = SplitText.create("[data-hero-title]", { type: "lines", mask: "lines", linesClass: "rl-line" });
      gsap
        .timeline({ defaults: { ease: EASE_OUT } })
        .from(split.lines, { yPercent: 100, duration: 0.8, stagger: 0.09 }, 0)
        .from("[data-hero-sub]", { autoAlpha: 0, y: 8, duration: 0.55 }, 0.15)
        .from(
          "[data-hero-point]",
          { autoAlpha: 0, y: 6, duration: 0.45, stagger: { each: 0.06, ease: "power1.in" } },
          0.25,
        )
        .from("[data-enter-preview]", { autoAlpha: 0, y: 18, scale: 0.98, duration: 0.7 }, 0.3);
      return () => split.revert();
    },
    { scope: hero },
  );

  const points = [t("auth.hero.point1"), t("auth.hero.point2"), t("auth.hero.point3")];

  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo to="/login" />
          <div className="flex items-center gap-1.5">
            <MockModeBadge />
            <ThemeToggle />
          </div>
        </div>
        <main id="main" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <Outlet />
        </main>
        <p className="text-center text-[0.75rem] text-faint lg:text-left">{t("app.tagline")}</p>
      </div>

      <div
        ref={hero}
        className="relative hidden overflow-hidden border-l border-line bg-surface-2/70 lg:flex lg:flex-col lg:justify-center lg:px-14 xl:px-20"
      >
        {/* lit ground: a faint grid fading out from the top-right */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 [background-image:linear-gradient(var(--rl-line)_1px,transparent_1px),linear-gradient(90deg,var(--rl-line)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_70%_60%_at_80%_10%,black,transparent)] [background-size:32px_32px] opacity-60"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -right-40 size-[32rem] rounded-full bg-accent/10 blur-3xl dark:bg-accent/[0.07]"
        />

        <div className="relative max-w-xl">
          <p className="inline-flex items-center gap-2 text-[0.75rem] font-medium text-accent-strong dark:text-accent">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
            {t("auth.hero.eyebrow")}
          </p>
          <h2
            data-hero-title
            className="mt-4 text-[2.5rem] leading-[1.08] font-semibold tracking-[-0.035em] xl:text-5xl"
          >
            <span className="block">{t("auth.hero.title")}</span>
            <span className="block text-muted">{t("auth.hero.titleLine2")}</span>
          </h2>
          <p data-hero-sub className="mt-4 max-w-lg text-[0.9375rem] leading-relaxed text-muted">
            {t("auth.hero.subtitle")}
          </p>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
            {points.map((point) => (
              <li data-hero-point key={point} className="flex items-center gap-1.5 text-[0.8125rem] text-ink-2">
                <Check className="size-3.5 text-success" aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
          <div className="mt-10">
            <ProductPreview />
          </div>
        </div>
      </div>
    </div>
  );
}
