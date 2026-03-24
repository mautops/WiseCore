import type { AgentSummary } from "@/lib/agents-registry-api";

export const QK_AGENTS_LIST = ["agents", "registry", "list"] as const;

export function agentDetailKey(id: string | null) {
  return ["agents", "registry", "detail", id ?? ""] as const;
}

export function agentMatchesFilter(row: AgentSummary, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const hay = [row.id, row.name, row.description, row.workspace_dir]
    .join(" ")
    .toLowerCase();
  return hay.includes(s);
}
