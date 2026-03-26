import { apiRequest } from "./api-utils";

/** Allowed workflow file extensions (Markdown). */
export const WORKFLOW_MARKDOWN_EXTS = [".md", ".markdown"] as const;

export function isWorkflowMarkdownFilename(name: string): boolean {
  const n = name.trim().toLowerCase();
  return WORKFLOW_MARKDOWN_EXTS.some((ext) => n.endsWith(ext));
}

/**
 * If the last path segment has no ``.md`` / ``.markdown`` suffix, append ``.md``.
 * Preserves relative paths like ``ops/daily``.
 */
export function ensureWorkflowMarkdownFilename(raw: string): string {
  const t = raw.trim().replace(/\\/g, "/");
  if (!t) return t;
  const parts = t.split("/").filter((p) => p.length > 0);
  if (parts.length === 0) return t;
  const last = parts[parts.length - 1]!;
  const low = last.toLowerCase();
  const hasExt = WORKFLOW_MARKDOWN_EXTS.some((ext) => low.endsWith(ext));
  if (!hasExt) {
    parts[parts.length - 1] = `${last}.md`;
  }
  return parts.join("/");
}

/** Parsed from YAML frontmatter in the Markdown file. */
export interface WorkflowMeta {
  name?: string | null;
  description?: string | null;
  tags: string[];
  category?: string | null;
  /** List/catalog bucket; YAML `catalog` or fallback to `category`. */
  catalog?: string | null;
  status?: string | null;
  version?: string | null;
}

export interface WorkflowInfo {
  filename: string;
  path: string;
  size: number;
  created_time: string;
  modified_time: string;
  name?: string | null;
  description?: string | null;
  tags: string[];
  category?: string | null;
  /** Normalized list bucket; null if uncategorized. */
  catalog: string | null;
  status?: string | null;
  version?: string | null;
}

export interface WorkflowListResponse {
  workflows: WorkflowInfo[];
}

/** GET /workflows/:filename — body for preview, full raw for source tab. */
export interface WorkflowDetailBody {
  content: string;
  raw: string;
  meta: WorkflowMeta;
}

/** POST /workflows/:filename/runs — append one execution record. */
export interface WorkflowRunCreate {
  user_id?: string;
  session_id?: string;
  trigger: string;
  status?: string | null;
  /** ISO datetime; omit to let server default to now */
  executed_at?: string | null;
}

/** One persisted workflow run (backend `workflow_id` is the filename). */
export interface WorkflowRun {
  run_id: string;
  workflow_id: string;
  user_id: string;
  session_id: string;
  trigger: string;
  executed_at: string;
  status?: string | null;
}

export interface WorkflowRunListResponse {
  runs: WorkflowRun[];
}

function workflowPath(filename: string) {
  return `/workflows/${encodeURIComponent(filename)}`;
}

function workflowRunsPath(filename: string) {
  return `${workflowPath(filename)}/runs`;
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.filter((t): t is string => typeof t === "string");
}

export const workflowApi = {
  list: async () => {
    const r = await apiRequest<WorkflowListResponse>("/workflows");
    return {
      workflows: r.workflows.map((w) => ({
        ...w,
        tags: normalizeTags(w.tags),
        catalog:
          (typeof w.catalog === "string" ? w.catalog : null)?.trim() ||
          (typeof w.category === "string" ? w.category : null)?.trim() ||
          null,
      })),
    };
  },

  get: async (filename: string) => {
    const d = await apiRequest<WorkflowDetailBody>(workflowPath(filename));
    const metaTags = normalizeTags(d.meta?.tags);
    const cat = d.meta?.catalog?.trim() || d.meta?.category?.trim() || null;
    return {
      ...d,
      meta: {
        ...d.meta,
        tags: metaTags,
        catalog: cat ?? undefined,
      },
    };
  },

  create: (body: { filename: string; content: string }) =>
    apiRequest<{ success: boolean; filename: string; path: string }>(
      "/workflows",
      { method: "POST", body: JSON.stringify(body) },
    ),

  update: (filename: string, content: string) =>
    apiRequest<{ success: boolean; filename: string; path: string }>(
      workflowPath(filename),
      { method: "PUT", body: JSON.stringify({ content }) },
    ),

  delete: (filename: string) =>
    apiRequest<{ success: boolean; filename: string }>(workflowPath(filename), {
      method: "DELETE",
    }),

  listRuns: (filename: string) =>
    apiRequest<WorkflowRunListResponse>(workflowRunsPath(filename)),

  getRun: (filename: string, runId: string) =>
    apiRequest<WorkflowRun>(
      `${workflowRunsPath(filename)}/${encodeURIComponent(runId)}`,
    ),

  appendRun: (filename: string, body: WorkflowRunCreate) =>
    apiRequest<WorkflowRun>(workflowRunsPath(filename), {
      method: "POST",
      body: JSON.stringify({
        user_id: body.user_id ?? "",
        session_id: body.session_id ?? "",
        trigger: body.trigger,
        status: body.status ?? undefined,
        executed_at: body.executed_at ?? undefined,
      }),
    }),
};

export function formatWorkflowTimestamp(raw: string): string {
  const n = Number(raw);
  const ms = Number.isFinite(n) ? n * 1000 : Date.parse(raw);
  if (!Number.isFinite(ms)) return raw;
  return new Date(ms).toLocaleString();
}