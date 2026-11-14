import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "./auth/AuthProvider";
import { useTheme } from "./hooks/useTheme";
import { I18nProvider } from "./i18n/I18nProvider";
import { ThemeProvider } from "./theme/ThemeProvider";

/** Toasts follow the app theme and use the design tokens, not Sonner's defaults. */
function ThemedToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      gap={8}
      toastOptions={{
        classNames: {
          toast: "!rounded-lg !border-line !bg-surface !text-ink !shadow-pop !font-sans",
          description: "!text-muted",
        },
      }}
    />
  );
}

/** All app-wide providers in one place (also reused by tests). */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          {children}
          <ThemedToaster />
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
