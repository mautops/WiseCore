import { apiRequest } from "./api-utils";

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