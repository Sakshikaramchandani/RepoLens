import { createContext } from "react";

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

export interface ThemeContextValue {
  /** What the user chose (system = follow the operating system). */
  preference: ThemePreference;
  /** What is actually on screen right now. */
  theme: Theme;
  setPreference: (preference: ThemePreference) => void;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
