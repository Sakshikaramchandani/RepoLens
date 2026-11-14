import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileSearch, FolderGit2, PanelLeft, PanelLeftClose } from "lucide-react";
import { CodeViewer } from "../../components/explorer/CodeViewer";
import { FileTree } from "../../components/explorer/FileTree";
import { defaultFileId } from "../../components/explorer/treeUtils";
import { Alert } from "../../components/ui/Alert";
import { Button, IconButton } from "../../components/ui/Button";
import { cn } from "../../components/ui/cn";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { useApiErrorMessage } from "../../hooks/useApiErrorMessage";
import { useTranslation } from "../../hooks/useTranslation";
import { useProject } from "../../projects/ProjectContext";

const TREE_KEY = "repolens.code.treeOpen";

function readTreeOpen(): boolean {
  try {
    return localStorage.getItem(TREE_KEY) !== "false";
  } catch {
    return true;
  }
}

function positiveInt(value: string | null): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * /projects/:id?file=<fileId>&line=<n> — file + line live in the URL, so chat citations,
 * review issues and risk rows can link straight to a line.
 */
export function ProjectCodePage() {
  const { t } = useTranslation();
  const apiErrorMessage = useApiErrorMessage();
  const { tree, treeStatus, treeError, reloadTree, files } = useProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedFileId = positiveInt(searchParams.get("file"));
  const highlightLine = positiveInt(searchParams.get("line"));
  const [treeOpen, setTreeOpen] = useState(readTreeOpen);
  // with nothing open the tree is the only way to pick a file, so it can't be hidden then
  const showTree = treeOpen || selectedFileId === null;

  const toggleTree = () =>
    setTreeOpen((value) => {
      try {
        localStorage.setItem(TREE_KEY, String(!value));
      } catch {
        /* ignore */
      }
      return !value;
    });

  // Nothing selected yet → open the README (or the first file)
  useEffect(() => {
    if (selectedFileId !== null || treeStatus !== "ready" || !tree) return;
    const first = defaultFileId(tree);
    if (first !== null) setSearchParams({ file: String(first) }, { replace: true });
  }, [selectedFileId, treeStatus, tree, setSearchParams]);

  if (treeStatus === "ready" && files.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line-strong">
        <EmptyState
          icon={<FolderGit2 className="size-5" aria-hidden="true" />}
          title={t("explorer.emptyTitle")}
          body={t("explorer.emptyBody")}
        />
      </div>
    );
  }

  return (
    <div className={cn("grid min-h-0 flex-1 gap-3 lg:min-h-[32rem]", showTree && "lg:grid-cols-[17rem_minmax(0,1fr)]")}>
      {showTree ? (
        <aside className="flex max-h-80 min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-surface lg:max-h-none">
          {treeStatus === "loading" || treeStatus === "idle" ? (
            <div className="space-y-1.5 p-3" role="status" aria-label={t("explorer.loadingTree")}>
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-6" />
              ))}
            </div>
          ) : treeStatus === "error" && treeError ? (
            <div className="p-3">
              <Alert
                tone="error"
                title={t("explorer.treeError")}
                action={
                  <Button variant="secondary" size="sm" onClick={reloadTree}>
                    {t("common.retry")}
                  </Button>
                }
              >
                {apiErrorMessage(treeError).title}
              </Alert>
            </div>
          ) : tree ? (
            <FileTree
              nodes={tree}
              selectedFileId={selectedFileId}
              onSelect={(fileId) => setSearchParams({ file: String(fileId) })}
            />
          ) : null}
        </aside>
      ) : null}

      <div className="min-h-[24rem] min-w-0 overflow-hidden rounded-lg border border-line bg-surface lg:min-h-0">
        {selectedFileId !== null ? (
          <CodeViewer
            key={selectedFileId}
            fileId={selectedFileId}
            highlightLine={highlightLine}
            leading={
              <IconButton
                label={treeOpen ? t("explorer.hideFiles") : t("explorer.showFiles")}
                aria-expanded={treeOpen}
                size="sm"
                onClick={toggleTree}
                className="-ml-1.5"
              >
                {treeOpen ? (
                  <PanelLeftClose className="size-4" aria-hidden="true" />
                ) : (
                  <PanelLeft className="size-4" aria-hidden="true" />
                )}
              </IconButton>
            }
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-[0.8125rem] text-muted">
            <FileSearch className="size-6 text-faint" aria-hidden="true" />
            {t("explorer.pickFile")}
          </div>
        )}
      </div>
    </div>
  );
}
