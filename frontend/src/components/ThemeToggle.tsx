import { useState, type CSSProperties } from "react";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../hooks/useTranslation";
import { IconButton } from "./ui/Button";

const BLADES = [0, 60, 120, 180, 240, 300];

/**
 * Theme switch drawn as a camera lens. Light = the iris is open and the ember light shows
 * through; dark = the iris stops down to a pinhole. The barrel turns half a revolution on every
 * switch (always clockwise), its index dot showing the turn. CSS transitions, so a double click
 * reverses mid-turn instead of restarting; reduced motion makes it instant (global rule).
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const dark = theme === "dark";

  // count theme changes (from here or from Settings) so the barrel keeps turning one way
  const [seen, setSeen] = useState(theme);
  const [turns, setTurns] = useState(0);
  if (seen !== theme) {
    setSeen(theme);
    setTurns((n) => n + 1);
  }

  return (
    <IconButton label={dark ? t("theme.toggleToLight") : t("theme.toggleToDark")} onClick={toggleTheme}>
      <svg viewBox="0 0 24 24" className="rl-lens size-5" data-closed={dark} aria-hidden="true">
        <defs>
          <clipPath id="rl-lens-glass">
            <circle cx="12" cy="12" r="7.75" />
          </clipPath>
          <radialGradient id="rl-lens-light">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="55%" stopColor="var(--rl-accent)" />
            <stop offset="100%" stopColor="var(--rl-accent)" />
          </radialGradient>
        </defs>

        <g className="rl-lens-barrel" style={{ transform: `rotate(${turns * 180}deg)` }}>
          <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="1.5" r="1.4" fill="var(--rl-accent)" />
        </g>

        <g clipPath="url(#rl-lens-glass)">
          <circle cx="12" cy="12" r="7.75" className="rl-lens-iris" />
          {/* the opening: light shows through a hexagon that shrinks and twists as the iris closes */}
          <polygon
            className="rl-lens-light"
            points="18,12 15,17.196 9,17.196 6,12 9,6.804 15,6.804"
            fill="url(#rl-lens-light)"
          />
          {/* six blade edges, each from a corner of the opening out to the rim (pinwheel) */}
          {BLADES.map((angle) => (
            <line
              key={angle}
              className="rl-lens-blade"
              x1="9"
              y1="17.2"
              x2="30"
              y2="17.2"
              style={{ "--blade": `${angle}deg` } as CSSProperties}
            />
          ))}
          <path d="M7.3 9.3a5.4 5.4 0 0 1 2.8-3.1" className="rl-lens-glint" />
        </g>
      </svg>
    </IconButton>
  );
}
