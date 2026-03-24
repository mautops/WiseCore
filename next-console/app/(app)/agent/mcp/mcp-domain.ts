import type { MCPClientInfo } from "@/lib/mcp-api";

export const QK_MCP_LIST = ["copaw", "mcp", "list"] as const;

export function mcpClientKey(client: MCPClientInfo, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (client.key.toLowerCase().includes(q)) return true;
  if (client.name.toLowerCase().includes(q)) return true;
  if (client.description.toLowerCase().includes(q)) return true;
  if (client.transport.toLowerCase().includes(q)) return true;
  return false;
}

/** Parse ``KEY=value`` lines; ``#`` starts comment. */
export function parseKeyValueLines(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

export function formatKeyValueLines(obj: Record<string, string>): string {
  return Object.entries(obj)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
}

/** Split command args by whitespace (no quotes). */
export function parseArgsLine(line: string): string[] {
  return line.trim().split(/\s+/).filter(Boolean);
}

export function transportLabel(t: string): string {
  switch (t) {
    case "stdio":
      return "stdio";
    case "streamable_http":
      return "HTTP";
    case "sse":
      return "SSE";
    default:
      return t;
  }
}
