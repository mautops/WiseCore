import { API_BASE, parseErrorMessage } from "./api-utils";

export interface WorkingMdFile {
  filename: string;
  path: string;
  size: number;
  created_time: string;
  modified_time: string;
}

/** Extended apiRequest with required agentId header */
async function apiRequest<T>(
  path: string,
  agentId: string,
  init?: RequestInit,
): Promise<T> {
  const { mergeAuthHeaders } = await import("./auth-headers");
  const headers = await mergeAuthHeaders({
    "Content-Type": "application/json",
    "X-Agent-Id": agentId,
  });
  new Headers(init?.headers).forEach((v, k) => headers.set(k, v));
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...init,
    headers,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function parseDownloadFilename(disposition: string | null): string | null {
  if (!disposition) return null;
  const m = disposition.match(/filename="([^"]+)"/i);
  return m?.[1] ?? null;
}

async function getAuthHeadersWithAgent(
  agentId: string,
): Promise<Headers> {
  const { mergeAuthHeaders } = await import("./auth-headers");
  const headers = await mergeAuthHeaders();
  headers.set("X-Agent-Id", agentId);
  return headers;
}

export const workspaceApi = {
  listWorkingFiles: (agentId: string) =>
    apiRequest<WorkingMdFile[]>("/agent/files", agentId),

  getWorkingFile: (agentId: string, filename: string) =>
    apiRequest<{ content: string }>(
      `/agent/files/${encodeURIComponent(filename)}`,
      agentId,
    ),

  saveWorkingFile: (agentId: string, filename: string, content: string) =>
    apiRequest<{ written?: boolean }>(
      `/agent/files/${encodeURIComponent(filename)}`,
      agentId,
      { method: "PUT", body: JSON.stringify({ content }) },
    ),

  listMemoryFiles: (agentId: string) =>
    apiRequest<WorkingMdFile[]>("/agent/memory", agentId),

  getMemoryFile: (agentId: string, filename: string) =>
    apiRequest<{ content: string }>(
      `/agent/memory/${encodeURIComponent(filename)}`,
      agentId,
    ),

  saveMemoryFile: (agentId: string, filename: string, content: string) =>
    apiRequest<{ written?: boolean }>(
      `/agent/memory/${encodeURIComponent(filename)}`,
      agentId,
      { method: "PUT", body: JSON.stringify({ content }) },
    ),

  /** Full workspace zip (browser download). */
  downloadZip: async (
    agentId: string,
  ): Promise<{ blob: Blob; filename: string }> => {
    const headers = await getAuthHeadersWithAgent(agentId);
    const res = await fetch(`${API_BASE}/api/workspace/download`, {
      headers,
    });
    if (!res.ok) throw new Error(await parseErrorMessage(res));
    const blob = await res.blob();
    const fn =
      parseDownloadFilename(res.headers.get("Content-Disposition")) ??
      `workspace_export_${Date.now()}.zip`;
    return { blob, filename: fn };
  },

  /** Merge zip into workspace (multipart). */
  uploadZip: async (
    agentId: string,
    file: File,
  ): Promise<{ success: boolean }> => {
    const fd = new FormData();
    fd.append("file", file);
    const headers = await getAuthHeadersWithAgent(agentId);
    const res = await fetch(`${API_BASE}/api/workspace/upload`, {
      method: "POST",
      headers,
      body: fd,
    });
    if (!res.ok) throw new Error(await parseErrorMessage(res));
    return res.json() as Promise<{ success: boolean }>;
  },
};