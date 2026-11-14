import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { filesApi } from "../../api/files";
import { useApiErrorMessage } from "../../hooks/useApiErrorMessage";
import { useApiResource } from "../../hooks/useApiResource";
import { useTheme } from "../../hooks/useTheme";
import { useTranslation } from "../../hooks/useTranslation";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { languageFor, languageLabel, SyntaxHighlighter } from "./languages";

/** Highlighting very large files freezes the browser, so they are shown as plain text. */
const MAX_HIGHLIGHT_CHARS = 200_000;

/** Line that a chat citation points to (Week 4+): ?line=42 */
const HIGHLIGHT_LINE_STYLE: CSSProperties = {
  display: "block",
  backgroundColor: "color-mix(in srgb, var(--rl-accent) 14%, transparent)",
  boxShadow: "inset 2px 0 0 var(--rl-accent)",
};

const lineId = (line: number) => `rl-line-${line}`;

interface CodeViewerProps {
  fileId: number;
  /** 1-based line number to scroll to and highlight, or null */
  highlightLine: number | null;
  /** Shown before the path in the header (e.g. the show/hide files button). */
  leading?: ReactNode;
}

export function CodeViewer({ fileId, highlightLine, leading }: CodeViewerProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const apiErrorMessage = useApiErrorMessage();
  const file = useApiResource(() => filesApi.content(fileId), [fileId]);
  const [copied, setCopied] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const content = file.data;
  const language = content ? languageFor(content.extension, content.path) : null;
  const tooLarge = content ? content.content.length > MAX_HIGHLIGHT_CHARS : false;
  const lineCount = content ? content.content.replace(/\n$/, "").split("\n").length : 0;

  // Scroll the highlighted line into the middle of the viewer.
  useEffect(() => {
    if (file.status !== "ready" || !highlightLine) return;
    const target = bodyRef.current?.querySelector(`#${lineId(highlightLine)}`);
    target?.scrollIntoView({ block: "center" });
  }, [file.status, highlightLine]);

  // Reset the "Copied" tick after 2 seconds.
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content.content);
      setCopied(true);
    } catch {
      /* clipboard blocked by the browser — nothing to do */
    }
  };

  const errorText = file.error ? apiErrorMessage(file.error) : null;

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label={content?.path ?? t("explorer.loadingFile")}>
      {/* Header: path, language, line count, copy */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        {leading}
        <p className="min-w-0 flex-1 truncate font-mono text-[0.8125rem] text-ink" title={content?.path}>
          {content?.path ?? "…"}
        </p>
        {content ? (
          <>
            <Badge tone="neutral">{languageLabel(language) ?? t("explorer.plainText")}</Badge>
            <span className="text-xs text-muted">{t("explorer.lines", { count: lineCount })}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void copy()}
              leftIcon={
                copied ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <Copy className="size-4" aria-hidden="true" />
                )
              }
            >
              {copied ? t("explorer.copied") : t("explorer.copy")}
            </Button>
          </>
        ) : null}
      </div>

      {/* Body */}
      <div ref={bodyRef} className="max-h-[70vh] min-h-0 flex-1 overflow-auto lg:max-h-none">
        {file.status === "loading" ? (
          <p role="status" className="flex items-center gap-2 p-6 text-[0.8125rem] text-muted">
            <Spinner /> {t("explorer.loadingFile")}
          </p>
        ) : file.status === "error" && errorText ? (
          <div className="p-4">
            <Alert tone="error" title={t("explorer.fileError")}>
              <p>{errorText.title}</p>
              {errorText.detail ? <p>{errorText.detail}</p> : null}
              <Button variant="ghost" size="sm" className="mt-3" onClick={file.reload}>
                {t("projects.retry")}
              </Button>
            </Alert>
          </div>
        ) : content && tooLarge ? (
          <>
            <p className="border-b border-line bg-warning-soft px-4 py-2 text-[0.75rem] text-ink-2">
              {t("explorer.tooLarge")}
            </p>
            <pre className="p-4 font-mono text-[0.8125rem] leading-relaxed whitespace-pre text-ink">
              {content.content}
            </pre>
          </>
        ) : content ? (
          <SyntaxHighlighter
            language={language ?? "text"}
            style={theme === "dark" ? oneDark : oneLight}
            showLineNumbers
            wrapLines
            lineProps={(lineNumber: number) => ({
              id: lineId(lineNumber),
              style: lineNumber === highlightLine ? HIGHLIGHT_LINE_STYLE : { display: "block" },
            })}
            lineNumberStyle={{
              minWidth: "3.25em",
              paddingRight: "1em",
              color: "var(--rl-muted)",
              opacity: 0.75,
              userSelect: "none",
            }}
            customStyle={{
              margin: 0,
              padding: "0.75rem 0",
              background: "transparent",
              fontSize: "0.8125rem",
              lineHeight: 1.65,
            }}
            codeTagProps={{ style: { fontFamily: "var(--font-mono)" } }}
          >
            {content.content}
          </SyntaxHighlighter>
        ) : null}
      </div>
    </section>
  );
}
