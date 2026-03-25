const API_BASE = "/api/copaw";

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { detail?: unknown };
    const d = j?.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) return JSON.stringify(d);
  } catch {
    /* ignore */
  }
  return `HTTP ${res.status}`;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface AgentSummary {
  id: string;
  name: string;
  description: string;
  workspace_dir: string;
  /** Builtin CoPaw QA helper; server refuses DELETE for this profile. */
  is_builtin?: boolean;
}

export interface AgentListResponse {
  agents: AgentSummary[];
}

export interface CreateAgentRequest {
  name: string;
  description?: string;
  workspace_dir?: string | null;
  language?: string;
}

export interface AgentProfileRef {
  id: string;
  workspace_dir: string;
}

/** Partial body for PUT merge (only send fields to change). */
export interface AgentProfileUpdateBody {
  id: string;
  name?: string;
  description?: string;
  language?: string;
}

export const agentsRegistryApi = {
  list: () => apiRequest<AgentListResponse>("/agents"),

  get: (agentId: string) =>
    apiRequest<Record<string, unknown>>(
      `/agents/${encodeURIComponent(agentId)}`,
    ),

  create: (body: CreateAgentRequest) =>
    apiRequest<AgentProfileRef>("/agents", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (agentId: string, body: AgentProfileUpdateBody) =>
    apiRequest<unknown>(`/agents/${encodeURIComponent(agentId)}`, {
      method: "PUT",
      body: JSON.stringify({ ...body, id: agentId }),
    }),

  delete: (agentId: string) =>
    apiRequest<{ success: boolean; agent_id: string }>(
      `/agents/${encodeURIComponent(agentId)}`,
      { method: "DELETE" },
    ),
};
