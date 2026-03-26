import type { ToolInfo } from "@/lib/tools-api";

export const QK_TOOLS = ["core", "tools", "list"] as const;

export function matchesToolFilter(tool: ToolInfo, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (tool.name.toLowerCase().includes(q)) return true;
  if (tool.description.toLowerCase().includes(q)) return true;
  return false;
}
