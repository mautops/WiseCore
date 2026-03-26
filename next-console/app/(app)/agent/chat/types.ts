import type { ToolCallInfo } from "@/lib/chat-api";
import type { BackendMessage } from "@/lib/chat-api";
import type { ChatStatus } from "ai";
import { nanoid } from "nanoid";

// ── Constants ────────────────────────────────────────────────────────────────

export const DEFAULT_CHANNEL = "console";

export const TOOL_CALL_TYPES = new Set([
  "plugin_call",
  "function_call",
  "mcp_tool_call",
]);
export const TOOL_OUTPUT_TYPES = new Set([
  "plugin_call_output",
  "function_call_output",
  "mcp_call_output",
  "component_call_output",
]);

// ── Types ────────────────────────────────────────────────────────────────────

export type LocalMessageType = "text" | "thinking" | "tool";

export interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  type: LocalMessageType;
  tool?: ToolCallInfo;
}

/** Streaming state for a single session - supports parallel multi-session output */
export interface SessionStreamState {
  messages: LocalMessage[];
  streamingContent: string;
  streamingThinking: string;
  isThinkingStreaming: boolean;
  streamingTools: ToolCallInfo[];
  status: ChatStatus;
  abortController: AbortController | null;
}

// ── Content extraction ───────────────────────────────────────────────────────

export function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return (content as Array<{ type?: string; text?: string }>)
      .filter((p) => p.type === "text" && p.text)
      .map((p) => p.text ?? "")
      .join("");
  }
  return "";
}

export function extractDataField(
  content: unknown,
  field: string,
): string | undefined {
  if (!Array.isArray(content)) return undefined;
  for (const c of content as Array<{
    type?: string;
    data?: Record<string, unknown>;
  }>) {
    if (c.type === "data" && c.data?.[field] !== undefined) {
      return String(c.data[field]);
    }
  }
  return undefined;
}

export function extractToolInput(content: unknown): unknown {
  const raw = extractDataField(content, "arguments");
  if (raw === undefined) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function truncateTitle(text: string): string {
  return text.length > 40 ? `${text.slice(0, 40)}...` : text;
}

// ── File helpers ─────────────────────────────────────────────────────────────

export function dataUrlToFile(
  dataUrl: string,
  filename: string,
  mimeType: string,
): File {
  const [, base64 = ""] = dataUrl.split(",");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mimeType });
}

// ── History parsing ──────────────────────────────────────────────────────────

export function parseHistory(messages: BackendMessage[]): LocalMessage[] {
  const loaded: LocalMessage[] = [];
  const pendingToolCalls = new Map<string, LocalMessage>();

  for (const m of messages) {
    const msgType = String(m["type"] ?? "message");
    const role = m.role as string;

    if (role === "user") {
      loaded.push({
        id: nanoid(),
        role: "user",
        content: extractText(m.content),
        createdAt: Date.now(),
        type: "text",
      });
      continue;
    }

    if (msgType === "reasoning") {
      loaded.push({
        id: nanoid(),
        role: "assistant",
        content: extractText(m.content),
        createdAt: Date.now(),
        type: "thinking",
      });
      continue;
    }

    if (TOOL_CALL_TYPES.has(msgType)) {
      const callId = extractDataField(m.content, "call_id") ?? nanoid();
      const name = extractDataField(m.content, "name") ?? "tool";
      const input = extractToolInput(m.content);
      const msg: LocalMessage = {
        id: nanoid(),
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        type: "tool",
        tool: { callId, name, input, state: "done" },
      };
      pendingToolCalls.set(callId, msg);
      loaded.push(msg);
      continue;
    }

    if (TOOL_OUTPUT_TYPES.has(msgType)) {
      const callId = extractDataField(m.content, "call_id");
      const output = extractDataField(m.content, "output") ?? "";
      if (callId) {
        const callMsg = pendingToolCalls.get(callId);
        if (callMsg?.tool) {
          callMsg.tool.output = output;
        }
      }
      continue;
    }

    if (role === "assistant" && msgType === "message") {
      const content = extractText(m.content);
      if (content) {
        loaded.push({
          id: nanoid(),
          role: "assistant",
          content,
          createdAt: Date.now(),
          type: "text",
        });
      }
    }
  }

  return loaded;
}
