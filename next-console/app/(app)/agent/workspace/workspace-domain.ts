import type { WorkingMdFile } from "@/lib/workspace-api";

export const QK_WORKSPACE_FILES = [
  "copaw",
  "workspace",
  "working-mds",
] as const;

export const DEFAULT_NEW_MD_BODY = `# 新文件

在此编写 Markdown 内容.
`;

/** Do not load into editor above this size (bytes from API). */
export const MAX_EDITOR_BYTES = 900_000;

/** Zip upload limit aligned with server workspace router. */
export const MAX_ZIP_UPLOAD_BYTES = 100 * 1024 * 1024;

export function safeWorkingMdFilename(raw: string): string {
  let s = raw.trim().replace(/\\/g, "/");
  const base = s.split("/").pop() ?? s;
  const name = base.replace(/^\.\/+/, "").replace(/\.\.+/g, "");
  if (!name || name.includes("/")) return "";
  if (!name.toLowerCase().endsWith(".md")) {
    return `${name}.md`;
  }
  return name;
}

export function matchesWorkspaceFilter(
  f: WorkingMdFile,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return f.filename.toLowerCase().includes(q);
}

export function formatWorkspaceTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleString();
}
