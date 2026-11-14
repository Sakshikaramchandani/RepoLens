import type { FileNode } from "../../api/files";

/** All files (not folders) in the tree, in display order. */
export function flattenFiles(nodes: FileNode[]): FileNode[] {
  const files: FileNode[] = [];
  const walk = (list: FileNode[]) => {
    for (const node of list) {
      if (node.type === "FILE") files.push(node);
      else if (node.children) walk(node.children);
    }
  };
  walk(nodes);
  return files;
}

/** Paths of the folders that contain a file, e.g. ["src", "src/main"]. null if the file is not in the tree. */
export function ancestorPaths(nodes: FileNode[], fileId: number): string[] | null {
  for (const node of nodes) {
    if (node.type === "FILE" && node.fileId === fileId) return [];
    if (node.type === "DIR" && node.children) {
      const inner = ancestorPaths(node.children, fileId);
      if (inner) return [node.path, ...inner];
    }
  }
  return null;
}

/** File to open first: README at the top level, otherwise the first file. */
export function defaultFileId(nodes: FileNode[]): number | null {
  const readme = nodes.find((n) => n.type === "FILE" && /^readme(\.md)?$/i.test(n.name));
  if (readme?.fileId != null) return readme.fileId;
  return flattenFiles(nodes)[0]?.fileId ?? null;
}
