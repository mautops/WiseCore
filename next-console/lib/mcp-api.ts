const API_BASE = "/api/copaw";

export type MCPTransport = "stdio" | "streamable_http" | "sse";

export interface MCPClientInfo {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  transport: MCPTransport;
  url: string;
  headers: Record<string, string>;
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd: string;
}

export interface MCPClientCreateBody {
  client_key: string;
  client: {
    name: string;
    description?: string;
    enabled?: boolean;
    transport?: MCPTransport;
    url?: string;
    headers?: Record<string, string>;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
  };
}

export type MCPClientUpdateBody = Partial<{
  name: string;
  description: string;
  enabled: boolean;
  transport: MCPTransport;
  url: string;
  headers: Record<string, string>;
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd: string;
}>;

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

export const mcpApi = {
  list: () => apiRequest<MCPClientInfo[]>("/mcp"),

  get: (clientKey: string) =>
    apiRequest<MCPClientInfo>(`/mcp/${encodeURIComponent(clientKey)}`),

  create: (body: MCPClientCreateBody) =>
    apiRequest<MCPClientInfo>("/mcp", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (clientKey: string, body: MCPClientUpdateBody) =>
    apiRequest<MCPClientInfo>(`/mcp/${encodeURIComponent(clientKey)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  toggle: (clientKey: string) =>
    apiRequest<MCPClientInfo>(`/mcp/${encodeURIComponent(clientKey)}/toggle`, {
      method: "PATCH",
    }),

  delete: (clientKey: string) =>
    apiRequest<{ message: string }>(`/mcp/${encodeURIComponent(clientKey)}`, {
      method: "DELETE",
    }),
};
