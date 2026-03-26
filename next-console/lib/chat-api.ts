import type { DynamicToolUIPart } from "ai";

import { API_BASE } from "./api-utils";
import { mergeAuthHeaders } from "./auth-headers";

export type ChatStatus = "idle" | "running";

export interface ChatSpec {
  id: string;
  name: string;
  session_id: string;
  user_id: string;
  channel: string;
  created_at: string | null;
  updated_at: string | null;
  meta?: Record<string, unknown>;
  status?: ChatStatus;
}

export interface BackendMessage {
  role: string;
  content: unknown;
  [key: string]: unknown;
}

export interface ChatHistory {
  messages: BackendMessage[];
  status?: ChatStatus;
}

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; image_url: string }
  | { type: "file"; file_url: string; filename?: string }
  | { type: "audio"; data: string }
  | { type: "video"; video_url: string };

export interface StreamInput {
  id: string;
  type: string;
  role: string;
  content: ContentPart[];
}

export interface ToolCallInfo {
  callId: string;
  name: string;
  input: unknown;
  output?: string;
  state: "running" | "done" | "error";
  /**
   * When set, drives ai-elements Tool/Confirmation (e.g. tool-guard pending approval).
   * Populate from stream `data` when backend adds guard fields.
   */
  hitlApproval?: { id: string; approved?: boolean; reason?: string };
  /** Override UI state for Tool header / Confirmation; derived from `state` when absent. */
  toolUiState?: DynamicToolUIPart["state"];
}

export interface StreamParams {
  input: StreamInput[];
  session_id: string;
  user_id: string;
  channel: string;
  signal?: AbortSignal;
  onChunk: (text: string) => void;
  onThinkingChunk?: (text: string) => void;
  onThinkingStart?: () => void;
  onThinkingEnd?: () => void;
  onToolStart?: (tool: ToolCallInfo) => void;
  onToolUpdate?: (tool: ToolCallInfo) => void;
}

/** Parameters for reconnecting to an existing stream */
export interface ReconnectParams {
  session_id: string;
  user_id: string;
  channel: string;
  signal?: AbortSignal;
  onChunk: (text: string) => void;
  onThinkingChunk?: (text: string) => void;
  onThinkingStart?: () => void;
  onThinkingEnd?: () => void;
  onToolStart?: (tool: ToolCallInfo) => void;
  onToolUpdate?: (tool: ToolCallInfo) => void;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await mergeAuthHeaders();
  headers.set("Content-Type", "application/json");
  new Headers(init?.headers).forEach((v, k) => headers.set(k, v));
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...init,
    headers,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// MessageType values emitted by agentscope_runtime
const TOOL_CALL_TYPES = new Set([
  "plugin_call",
  "function_call",
  "mcp_tool_call",
]);
const TOOL_OUTPUT_TYPES = new Set([
  "plugin_call_output",
  "function_call_output",
  "mcp_call_output",
  "component_call_output",
]);

/** AgentScope / runtime may emit these before content deltas (not only ``in_progress``). */
const LIVE_MESSAGE_STATUSES = new Set(["generating", "created", "in_progress"]);

function isLiveMessageStatus(status: unknown): boolean {
  return (
    typeof status === "string" &&
    LIVE_MESSAGE_STATUSES.has(status.toLowerCase())
  );
}

function isCompletedStatus(status: unknown): boolean {
  return typeof status === "string" && status.toLowerCase() === "completed";
}

/**
 * Yield so React can paint between SSE chunks. A single fetch read() often
 * contains many lines; sync setState in a loop still collapses to one frame
 * without an async boundary (and batching can hide intermediate strings).
 */
async function deferToMain(): Promise<void> {
  const root = globalThis as unknown as {
    scheduler?: { yield?: () => void | Promise<void> };
  };
  const sch = root.scheduler;
  if (sch && typeof sch.yield === "function") {
    await sch.yield();
    return;
  }
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

/** Process SSE stream response - shared between streamChat and reconnectStream */
async function processStreamResponse(
  res: Response,
  signal: AbortSignal | undefined,
  onChunk: (text: string) => void,
  onThinkingChunk?: (text: string) => void,
  onThinkingStart?: () => void,
  onThinkingEnd?: () => void,
  onToolStart?: (tool: ToolCallInfo) => void,
  onToolUpdate?: (tool: ToolCallInfo) => void,
): Promise<{ content: string; thinking: string; tools: ToolCallInfo[] }> {
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";
  let fullThinking = "";
  let hasTextDelta = false;

  // "text" | "reasoning" | "tool_call" | "tool_output" | null
  type MsgSubType = "text" | "reasoning" | "tool_call" | "tool_output" | null;
  let subType: MsgSubType = null;

  // Tool calls tracked by callId
  const toolsMap = new Map<string, ToolCallInfo>();
  const toolsOrder: string[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "[DONE]") continue;
        const jsonStr = trimmed.startsWith("data: ")
          ? trimmed.slice(6)
          : trimmed;
        try {
          const msg = JSON.parse(jsonStr) as Record<string, unknown>;

          // ── Message phase start ──────────────────────────────────────
          if (msg.object === "message" && isLiveMessageStatus(msg.status)) {
            const msgType: string = (msg.type as string) ?? "";
            if (msgType === "reasoning") {
              subType = "reasoning";
              onThinkingStart?.();
            } else if (TOOL_CALL_TYPES.has(msgType)) {
              subType = "tool_call";
            } else if (TOOL_OUTPUT_TYPES.has(msgType)) {
              subType = "tool_output";
            } else {
              subType = "text";
            }
            continue;
          }

          // ── Streaming text delta ─────────────────────────────────────
          if (isStreamingTextDelta(msg)) {
            const piece = msg.text as string;
            if (subType === "reasoning") {
              fullThinking += piece;
              onThinkingChunk?.(fullThinking);
              assertNotAborted(signal);
              await deferToMain();
            } else if (subType === "text" || subType === null) {
              if (subType === null) subType = "text";
              hasTextDelta = true;
              fullContent += piece;
              onChunk(fullContent);
              assertNotAborted(signal);
              await deferToMain();
            }
            continue;
          }

          // ── Tool data content (call details or output) ───────────────
          if (msg.object === "content" && msg.type === "data" && msg.data) {
            const data = msg.data as {
              call_id?: string;
              name?: string;
              arguments?: string;
              output?: string;
              guard_approval?: string;
            };
            if (subType === "tool_call" && data.call_id) {
              const isNew = !toolsMap.has(data.call_id);
              const tool: ToolCallInfo = toolsMap.get(data.call_id) ?? {
                callId: data.call_id,
                name: data.name ?? "tool",
                input: null,
                state: "running",
              };
              if (data.name) tool.name = data.name;
              if (data.arguments !== undefined) {
                try {
                  tool.input = JSON.parse(data.arguments);
                } catch {
                  tool.input = data.arguments;
                }
              }
              if (data.guard_approval === "requested") {
                tool.hitlApproval = { id: data.call_id };
                tool.toolUiState = "approval-requested";
              }
              toolsMap.set(data.call_id, tool);
              if (isNew) {
                toolsOrder.push(data.call_id);
                onToolStart?.({ ...tool });
              }
            } else if (subType === "tool_output" && data.call_id) {
              const tool = toolsMap.get(data.call_id);
              if (tool) {
                tool.output = data.output ?? "";
                tool.state = "done";
                if (
                  tool.hitlApproval &&
                  tool.hitlApproval.approved === undefined
                ) {
                  tool.hitlApproval = {
                    ...tool.hitlApproval,
                    approved: true,
                  };
                }
                onToolUpdate?.({ ...tool });
              }
            }
            continue;
          }

          // ── Message phase end ────────────────────────────────────────
          if (msg.object === "message" && isCompletedStatus(msg.status)) {
            if (subType === "reasoning") {
              onThinkingEnd?.();
            } else if (
              subType === "text" &&
              !hasTextDelta &&
              Array.isArray(msg.content)
            ) {
              const parts = msg.content as Array<{
                type?: string;
                text?: string;
                delta?: boolean;
              }>;
              for (const part of parts) {
                if (
                  part.type !== "text" ||
                  typeof part.text !== "string" ||
                  !part.text ||
                  part.delta === true
                ) {
                  continue;
                }
                const fragment = part.text;
                const step =
                  fragment.length <= 80
                    ? fragment.length
                    : Math.max(6, Math.ceil(fragment.length / 36));
                for (let i = 0; i < fragment.length; i += step) {
                  fullContent += fragment.slice(i, i + step);
                  onChunk(fullContent);
                  assertNotAborted(signal);
                  await deferToMain();
                }
              }
            }
            subType = null;
            continue;
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") throw e;
          /* ignore unparseable lines */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {
    content: fullContent,
    thinking: fullThinking,
    tools: toolsOrder.map((id) => toolsMap.get(id)!),
  };
}

/** Treat as stream delta unless explicitly ``delta: false`` (snapshots use that). */
function isStreamingTextDelta(msg: Record<string, unknown>): boolean {
  if (msg.object !== "content" || msg.type !== "text") return false;
  if (msg.delta === false) return false;
  const text = msg.text;
  return typeof text === "string" && text.length > 0;
}

export const chatApi = {
  listChats: () => apiRequest<ChatSpec[]>("/chats"),

  createChat: (data: {
    session_id: string;
    name?: string;
    channel?: string;
    user_id?: string;
  }) =>
    apiRequest<ChatSpec>("/chats", {
      method: "POST",
      body: JSON.stringify({
        user_id: "default",
        channel: "console",
        name: "New Chat",
        ...data,
      }),
    }),

  getChat: (id: string) =>
    apiRequest<ChatHistory>(`/chats/${encodeURIComponent(id)}`),

  updateChat: (id: string, data: Partial<ChatSpec>) =>
    apiRequest<ChatSpec>(`/chats/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteChat: (id: string) =>
    apiRequest<{ success: boolean; chat_id: string }>(
      `/chats/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    ),

  stopChat: (chatId: string) =>
    apiRequest<{ stopped: boolean }>(
      `/console/chat/stop?chat_id=${encodeURIComponent(chatId)}`,
      { method: "POST" },
    ),

  /** Upload a file for chat attachment. Returns the server-side stored name. */
  uploadFile: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const headers = await mergeAuthHeaders();
    const res = await fetch(`${API_BASE}/api/console/upload`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`);
    const data = (await res.json()) as { url: string };
    return data.url;
  },

  /** SSE streaming chat — streams content/thinking/tools in real time. */
  streamChat: async ({
    input,
    session_id,
    user_id,
    channel,
    signal,
    onChunk,
    onThinkingChunk,
    onThinkingStart,
    onThinkingEnd,
    onToolStart,
    onToolUpdate,
  }: StreamParams): Promise<{
    content: string;
    thinking: string;
    tools: ToolCallInfo[];
  }> => {
    const headers = await mergeAuthHeaders();
    headers.set("Content-Type", "application/json");
    const res = await fetch(`${API_BASE}/api/console/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        input,
        session_id,
        user_id,
        channel,
        stream: true,
      }),
      signal,
    });

    return processStreamResponse(res, signal, onChunk, onThinkingChunk, onThinkingStart, onThinkingEnd, onToolStart, onToolUpdate);
  },

  /** Reconnect to an existing streaming session (e.g., after page navigation). */
  reconnectStream: async ({
    session_id,
    user_id,
    channel,
    signal,
    onChunk,
    onThinkingChunk,
    onThinkingStart,
    onThinkingEnd,
    onToolStart,
    onToolUpdate,
  }: ReconnectParams): Promise<{
    content: string;
    thinking: string;
    tools: ToolCallInfo[];
    reconnected: boolean;
  }> => {
    const headers = await mergeAuthHeaders();
    headers.set("Content-Type", "application/json");
    const res = await fetch(`${API_BASE}/api/console/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        session_id,
        user_id,
        channel,
        reconnect: true,
      }),
      signal,
    });

    // 404 means no running chat for this session
    if (res.status === 404) {
      return { content: "", thinking: "", tools: [], reconnected: false };
    }

    const result = await processStreamResponse(res, signal, onChunk, onThinkingChunk, onThinkingStart, onThinkingEnd, onToolStart, onToolUpdate);
    return { ...result, reconnected: true };
  },
};
