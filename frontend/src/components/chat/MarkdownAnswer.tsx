import { useMemo, useState } from "react";
import { Check, Copy, FileCode2 } from "lucide-react";
import Markdown, { type Components } from "react-markdown";
import { Link } from "react-router-dom";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import { isLanguageName, languageFor, SyntaxHighlighter, type LanguageName } from "../explorer/languages";

/** Fence names the model uses → registered Prism grammars (see explorer/languages.ts). */
const FENCE_ALIASES: Record<string, LanguageName> = {
  py: "python",
  python: "python",
  js: "javascript",
  javascript: "javascript",
  ts: "typescript",
  typescript: "typescript",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  console: "bash",
  yml: "yaml",
  rs: "rust",
  cs: "csharp",
  "c#": "csharp",
  "c++": "cpp",
  golang: "go",
  kt: "kotlin",
  rb: "ruby",
  html: "markup",
  xml: "markup",
  vue: "markup",
  dockerfile: "docker",
  tf: "hcl",
  terraform: "hcl",
  ps1: "powershell",
  md: "markdown",
  objc: "objectivec",
};

function fenceLanguage(name: string): string {
  const lower = name.toLowerCase();
  if (FENCE_ALIASES[lower]) return FENCE_ALIASES[lower];
  return languageFor(lower, `x.${lower}`) ?? (isLanguageName(lower) ? lower : "text");
}

const CITE_PREFIX = "#cite:";

/**
 * The AI cites like [AuthController.java:42-60] (Apoorv's prompt rule 3).
 * Turn those into markdown links with a special "#cite:" href, so the <a> renderer below
 * can make them clickable. Code (```blocks``` and `inline`) is left untouched.
 */
function linkCitations(text: string): string {
  return text
    .split(/(```[\s\S]*?```|`[^`\n]*`)/)
    .map((part, i) =>
      i % 2 === 1
        ? part // code → unchanged
        : part.replace(
            /\[([\w$.+-]+:\d+(?:-\d+)?)\](?!\()/g,
            (_match, label: string) => `[${label}](${CITE_PREFIX}${encodeURIComponent(label)})`,
          ),
    )
    .join("");
}

/** ```java block: language label + copy, dark editor surface in both themes for contrast. */
function CodeBlock({ language, text }: { language: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="not-prose my-3 overflow-hidden rounded-lg border border-line bg-[#16161a]">
      <div className="flex h-8 items-center justify-between border-b border-white/[0.06] px-3">
        <span className="font-mono text-[0.6875rem] text-zinc-400">{language === "text" ? "code" : language}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="rl-press inline-flex h-6 items-center gap-1 rounded px-1.5 text-[0.6875rem] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? <Check className="size-3" aria-hidden="true" /> : <Copy className="size-3" aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: 0,
          background: "transparent",
          fontSize: "0.8rem",
          padding: "0.85rem 1rem",
        }}
        codeTagProps={{ className: `language-${language}`, style: { fontFamily: "var(--font-mono)" } }}
      >
        {text}
      </SyntaxHighlighter>
    </div>
  );
}

/**
 * Element overrides. Typography comes from .rl-prose (styles/index.css).
 * Raw HTML in the answer is NEVER rendered (react-markdown default) — no XSS from model output.
 */
const baseComponents: Components = {
  code({ className, children }) {
    const match = /language-([\w-]+)/.exec(className ?? "");
    const text = String(children).replace(/\n$/, "");
    const isBlock = Boolean(match) || text.includes("\n");
    if (!isBlock) return <code>{children}</code>;
    const language = match ? fenceLanguage(match[1]) : "text";
    return <CodeBlock language={language} text={text} />;
  },
  pre({ children }) {
    return <>{children}</>;
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto">
        <table>{children}</table>
      </div>
    );
  },
};

interface MarkdownAnswerProps {
  text: string;
  /** "AuthController.java:42-60" → explorer URL, or null if the file cannot be found. */
  citationLink?: (label: string) => string | null;
}

/** Renders the AI's markdown answer. Works while streaming too (half-finished blocks render as far as they go). */
export function MarkdownAnswer({ text, citationLink }: MarkdownAnswerProps) {
  const components = useMemo<Components>(
    () => ({
      ...baseComponents,
      a({ href, children }) {
        if (href?.startsWith(CITE_PREFIX)) {
          const label = decodeURIComponent(href.slice(CITE_PREFIX.length));
          const to = citationLink?.(label) ?? null;
          const chip =
            "inline-flex translate-y-[-1px] items-center gap-1 rounded-sm border border-line bg-surface-2 px-1 align-middle font-mono text-[0.72rem] no-underline";
          return to ? (
            <Link to={to} className={`${chip} text-ink-2 transition-colors hover:border-accent/60 hover:text-ink`}>
              <FileCode2 className="size-3 text-accent" aria-hidden="true" />
              {children}
            </Link>
          ) : (
            <span className={`${chip} text-muted`}>{children}</span>
          );
        }
        return (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-link">
            {children}
          </a>
        );
      },
    }),
    [citationLink],
  );

  return (
    <div className="rl-prose break-words">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {linkCitations(text)}
      </Markdown>
    </div>
  );
}
