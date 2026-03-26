import type { ChatSpec } from "@/lib/sessions-api";
import { scopeUserFromSessionUser } from "@/lib/workflow-username";

export type SessionsShellUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  username?: string | null;
};

/** True when ``row.user_id`` matches mailbox local-part (same as JWT ``sub`` / chat ``user_id``). */
export function chatRowBelongsToCurrentUser(
  row: ChatSpec,
  user: SessionsShellUser | null | undefined,
): boolean {
  if (!user) return false;
  const scope = scopeUserFromSessionUser(user);
  if (scope && row.user_id === scope) return true;
  const em = user.email?.trim();
  if (em && row.user_id === em) return true;
  return false;
}

export function chatsQueryKey(filters: { channel?: string; user_id?: string }) {
  return [
    "chats",
    "list",
    filters.channel ?? "",
    filters.user_id ?? "",
  ] as const;
}

export function chatDetailKey(chatId: string | null) {
  return ["chats", "detail", chatId ?? ""] as const;
}

export function formatSessionTime(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function rowMatchesSearch(row: ChatSpec, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const hay = [
    row.name,
    row.id,
    row.session_id,
    row.user_id,
    row.channel,
    row.status,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(s);
}

export function messageStableKey(m: unknown, index: number): string {
  if (m && typeof m === "object") {
    const o = m as Record<string, unknown>;
    const meta = o.metadata;
    if (meta && typeof meta === "object") {
      const mid = (meta as Record<string, unknown>).original_id;
      if (typeof mid === "string" || typeof mid === "number") {
        return String(mid);
      }
    }
    const id = o.id;
    if (typeof id === "string") return id;
  }
  return `msg-${index}`;
}

export function summarizeMessage(m: unknown): { role: string; text: string } {
  if (m == null) return { role: "?", text: "" };
  if (typeof m !== "object") {
    return { role: "?", text: String(m) };
  }
  const o = m as Record<string, unknown>;
  const role = typeof o.role === "string" ? o.role : "?";
  const content = o.content;
  if (typeof content === "string") {
    return { role, text: content };
  }
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content) {
      if (block && typeof block === "object") {
        const b = block as Record<string, unknown>;
        if (b.type === "text" && typeof b.text === "string") {
          parts.push(b.text);
        } else {
          parts.push(JSON.stringify(block));
        }
      }
    }
    const joined = parts.join("\n").trim();
    return {
      role,
      text: joined || JSON.stringify(content, null, 2),
    };
  }
  try {
    return { role, text: JSON.stringify(m, null, 2) };
  } catch {
    return { role, text: String(m) };
  }
}
