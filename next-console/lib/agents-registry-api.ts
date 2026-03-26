import { apiRequest } from "./api-utils";

export interface AgentSummary {
  id: string;
  name: string;
  description: string;
  workspace_dir: string;
  /** Builtin QA helper; server refuses DELETE for this profile. */
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