import { useEffect, useId, useMemo, useState } from "react";
import { ChevronRight, FileCode, FileText, Folder, FolderOpen, Search } from "lucide-react";
import type { FileNode } from "../../api/files";
import { useTranslation } from "../../hooks/useTranslation";
import { cn } from "../ui/cn";
import { ancestorPaths, flattenFiles } from "./treeUtils";

interface FileTreeProps {
  nodes: FileNode[];
  selectedFileId: number | null;
  onSelect: (fileId: number) => void;
}

const TEXT_FILE = /\.(md|txt)$/i;
const MAX_SEARCH_RESULTS = 200;

const rowClass = (selected: boolean) =>
  cn(
    "flex h-7 w-full items-center gap-1.5 rounded-md pr-2 text-left text-[0.8125rem] transition-colors duration-100",
    selected ? "bg-accent-soft font-medium text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
  );

/** Space for the folder arrow, so file names line up with folder names. */
const indent = (depth: number, isFile: boolean) => ({
  paddingLeft: `${0.5 + depth * 0.875 + (isFile ? 1.125 : 0)}rem`,
});

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  selectedFileId: number | null;
  onSelect: (fileId: number) => void;
}

function TreeNode({ node, depth, expanded, onToggle, selectedFileId, onSelect }: TreeNodeProps) {
  if (node.type === "DIR") {
    const open = expanded.has(node.path);
    const FolderIcon = open ? FolderOpen : Folder;
    return (
      <li>
        <button
          type="button"
          onClick={() => onToggle(node.path)}
          aria-expanded={open}
          title={node.path}
          style={indent(depth, false)}
          className={rowClass(false)}
        >
          <ChevronRight
            className={cn("size-3.5 shrink-0 text-muted transition-transform", open && "rotate-90")}
            aria-hidden="true"
          />
          <FolderIcon className="size-4 shrink-0 text-faint" aria-hidden="true" />
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children && node.children.length > 0 ? (
          <ul>
            {node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
                selectedFileId={selectedFileId}
                onSelect={onSelect}
              />
            ))}
          </ul>
        ) : null}
      </li>
    );
  }

  const selected = node.fileId !== null && node.fileId === selectedFileId;
  const Icon = TEXT_FILE.test(node.name) ? FileText : FileCode;
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          if (node.fileId !== null) onSelect(node.fileId);
        }}
        aria-current={selected ? "true" : undefined}
        title={node.path}
        style={indent(depth, true)}
        className={rowClass(selected)}
      >
        <Icon className={cn("size-4 shrink-0", selected ? "text-accent" : "text-faint")} aria-hidden="true" />
        <span className="truncate">{node.name}</span>
      </button>
    </li>
  );
}

/** Folder tree with expand/collapse and a file-name search. */
export function FileTree({ nodes, selectedFileId, onSelect }: FileTreeProps) {
  const { t } = useTranslation();
  const searchId = useId();
  const [query, setQuery] = useState("");
  // Top-level folders start open.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(nodes.filter((n) => n.type === "DIR").map((n) => n.path)),
  );

  // Make sure the folders around the selected file are open (e.g. when opened from a link).
  useEffect(() => {
    if (selectedFileId === null) return;
    const ancestors = ancestorPaths(nodes, selectedFileId);
    if (!ancestors || ancestors.length === 0) return;
    setExpanded((current) => {
      if (ancestors.every((path) => current.has(path))) return current;
      const next = new Set(current);
      ancestors.forEach((path) => next.add(path));
      return next;
    });
  }, [nodes, selectedFileId]);

  const toggle = (path: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const search = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      search
        ? flattenFiles(nodes)
            .filter((file) => file.path.toLowerCase().includes(search))
            .slice(0, MAX_SEARCH_RESULTS)
        : [],
    [nodes, search],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line p-3">
        <label htmlFor={searchId} className="sr-only">
          {t("explorer.filter")}
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint"
            aria-hidden="true"
          />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("explorer.filterPlaceholder")}
            autoComplete="off"
            className="h-8 w-full rounded-md border border-line bg-surface pr-3 pl-8 text-[0.8125rem] text-ink placeholder:text-faint focus:border-accent focus:ring-3 focus:ring-accent/15 focus:outline-none"
          />
        </div>
      </div>

      <nav aria-label={t("explorer.files")} className="min-h-0 flex-1 overflow-auto p-2">
        {search ? (
          matches.length === 0 ? (
            <p className="px-2 py-3 text-[0.8125rem] text-muted">{t("explorer.noMatches", { query: query.trim() })}</p>
          ) : (
            <ul>
              {matches.map((file) => {
                const selected = file.fileId === selectedFileId;
                return (
                  <li key={file.path}>
                    <button
                      type="button"
                      onClick={() => {
                        if (file.fileId !== null) onSelect(file.fileId);
                      }}
                      aria-current={selected ? "true" : undefined}
                      className={cn(rowClass(selected), "h-auto flex-col items-start gap-0 py-1.5 pl-3")}
                    >
                      <span className="w-full truncate font-medium">{file.name}</span>
                      <span className={cn("w-full truncate text-xs", "text-faint")}>{file.path}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : (
          <ul>
            {nodes.map((node) => (
              <TreeNode
                key={node.path}
                node={node}
                depth={0}
                expanded={expanded}
                onToggle={toggle}
                selectedFileId={selectedFileId}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )}
      </nav>
    </div>
  );
}
