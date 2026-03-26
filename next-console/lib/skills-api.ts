import { API_BASE, parseErrorMessage } from "./api-utils";

export interface SkillSpec {
  name: string;
  description: string;
  content: string;
  source: string;
  path: string;
  references: Record<string, unknown>;
  scripts: Record<string, unknown>;
  enabled: boolean;
}

/** Extended error parser for skills API with security scan support */
async function parseSkillErrorMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as {
      detail?: unknown;
      type?: string;
    };
    if (j?.type === "security_scan_failed" && typeof j.detail === "string") {
      return j.detail;
    }
  } catch {
    /* ignore */
  }
  return parseErrorMessage(res);
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { mergeAuthHeaders } = await import("./auth-headers");
  const headers = await mergeAuthHeaders();
  headers.set("Content-Type", "application/json");
  new Headers(init?.headers).forEach((v, k) => headers.set(k, v));
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...init,
    headers,
  });
  if (!res.ok) throw new Error(await parseSkillErrorMessage(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const skillsApi = {
  list: () => apiRequest<SkillSpec[]>("/skills"),

  create: (body: {
    name: string;
    content: string;
    overwrite?: boolean;
    references?: Record<string, unknown> | null;
    scripts?: Record<string, unknown> | null;
  }) =>
    apiRequest<{ created: boolean }>("/skills", {
      method: "POST",
      body: JSON.stringify({
        name: body.name,
        content: body.content,
        overwrite: body.overwrite ?? false,
        references: body.references ?? undefined,
        scripts: body.scripts ?? undefined,
      }),
    }),

  enable: (skillName: string) =>
    apiRequest<{ enabled: boolean }>(
      `/skills/${encodeURIComponent(skillName)}/enable`,
      { method: "POST" },
    ),

  disable: (skillName: string) =>
    apiRequest<{ disabled: boolean }>(
      `/skills/${encodeURIComponent(skillName)}/disable`,
      { method: "POST" },
    ),

  delete: (skillName: string) =>
    apiRequest<{ deleted: boolean }>(
      `/skills/${encodeURIComponent(skillName)}`,
      { method: "DELETE" },
    ),
};