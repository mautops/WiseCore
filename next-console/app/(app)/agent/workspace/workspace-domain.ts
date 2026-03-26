import type { WorkingMdFile } from "@/lib/workspace-api";

/** Persisted key for last workspace agent (browser). */
export const WORKSPACE_SELECTED_AGENT_STORAGE_KEY =
  "wisecore.workspace.selectedAgentId";

export function qkWorkspaceFiles(agentId: string) {
  return ["core", "workspace", agentId, "working-mds"] as const;
}

export function qkWorkspaceMemoryFiles(agentId: string) {
  return ["core", "workspace", agentId, "memory-mds"] as const;
}

export function qkWorkspaceSystemPrompt(agentId: string) {
  return ["core", "workspace", agentId, "system-prompt-files"] as const;
}

export function workspaceFileContentKey(
  agentId: string,
  filename: string | null,
) {
  return [...qkWorkspaceFiles(agentId), "file", filename ?? ""] as const;
}

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

export function stripFrontmatter(s: string): string {
  return s.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

export function getParentDir(filePath: string): string {
  const match = filePath.match(/^(.*)[/\\]/);
  return match ? match[1]! : filePath;
}

export function sortFilesByEnabled(
  fileList: WorkingMdFile[],
  enabled: string[],
): WorkingMdFile[] {
  const safe = Array.isArray(enabled) ? enabled : [];
  return [...fileList].sort((a, b) => {
    const ai = safe.indexOf(a.filename);
    const bi = safe.indexOf(b.filename);
    const aEn = ai !== -1;
    const bEn = bi !== -1;
    if (aEn && bEn) return ai - bi;
    if (aEn) return -1;
    if (bEn) return 1;
    return a.filename.localeCompare(b.filename);
  });
}

export function isDailyMemoryFilename(name: string): boolean {
  return /^\d{4}-\d{2}-\d{2}\.md$/i.test(name);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatTimeAgoFromIso(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const seconds = Math.floor((Date.now() - t) / 1000);
  if (seconds < 60) return "刚刚";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
  return `${Math.floor(seconds / 86400)} 天前`;
}

export function formatWorkspaceTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleString();
}
