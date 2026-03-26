import { apiRequest } from "./api-utils";

export interface ToolInfo {
  name: string;
  enabled: boolean;
  description: string;
}

export const toolsApi = {
  list: () => apiRequest<ToolInfo[]>("/tools"),

  toggle: (toolName: string) =>
    apiRequest<ToolInfo>(`/tools/${encodeURIComponent(toolName)}/toggle`, {
      method: "PATCH",
    }),
};