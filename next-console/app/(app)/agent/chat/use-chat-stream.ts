import type { ChatSpec, ContentPart, ToolCallInfo } from "@/lib/chat-api";
import { chatApi } from "@/lib/chat-api";
import { llmModelsApi } from "@/lib/llm-models-api";
import { workflowApi } from "@/lib/workflow-api";
import { qkWorkflowRuns } from "@/app/(app)/agent/workflows/workflow-domain";
import type { ChatStatus, FileUIPart } from "ai";
import type { QueryClient } from "@tanstack/react-query";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef } from "react";
import {
  expandChatReferenceText,
  uniqueWorkflowFilenames,
} from "./chat-expand-refs";
import { chatsListQueryKey } from "./chat-query-keys";
import { useSessionStreams } from "./use-session-streams";
import {
  DEFAULT_CHANNEL,
  type LocalMessage,
  dataUrlToFile,
  parseHistory,
  truncateTitle,
} from "./types";

interface UseChatStreamOptions {
  userId: string;
  sessions: ChatSpec[];
  currentChatId: string | null;
  setCurrentChatId: (id: string) => void;
  createChat: {
    mutateAsync: (
      data: Parameters<typeof chatApi.createChat>[0],
    ) => Promise<ChatSpec>;
  };
  queryClient: QueryClient;
  chatHistory: { messages: Array<Record<string, unknown>> } | undefined;
}

export function useChatStream({
  userId,
  sessions,
  currentChatId,
  setCurrentChatId,
  createChat,
  queryClient,
  chatHistory,
}: UseChatStreamOptions) {
  const {
    getSessionState,
    setSessionMessages,
    setStreamingContent,
    setStreamingThinking,
    setIsThinkingStreaming,
    addOrUpdateTool,
    updateTool,
    setStatus,
    setAbortController,
    resetStreamingState,
    clearSession,
    isGenerating,
    markSessionRunning,
    markSessionStopped,
    getRunningSessionsInfo,
  } = useSessionStreams();

  const currentChatIdRef = useRef<string | null>(null);
  currentChatIdRef.current = currentChatId;

  // Load messages from history when currentChatId changes
  useEffect(() => {
    if (!currentChatId || !chatHistory) return;
    const state = getSessionState(currentChatId);
    // Don't overwrite if already has local messages (optimistic updates)
    if (state.messages.length > 0) return;

    const parsed = parseHistory(
      chatHistory.messages as Parameters<typeof parseHistory>[0],
    );
    if (parsed.length > 0) {
      setSessionMessages(currentChatId, parsed);
    }
  }, [currentChatId, chatHistory, getSessionState, setSessionMessages]);

  const handleStop = useCallback(
    (chatId: string) => {
      const state = getSessionState(chatId);
      state.abortController?.abort();
      markSessionStopped(chatId);
      chatApi.stopChat(chatId).catch(() => {});
    },
    [getSessionState, markSessionStopped],
  );

  const handleSubmit = useCallback(
    async ({
      text,
      files,
      forceNewChat,
      chatName,
      workflowExecContext,
      targetChatId,
    }: {
      text: string;
      files: FileUIPart[];
      /** Ignore current session and always create a new chat before sending. */
      forceNewChat?: boolean;
      /** Optional display name for the new chat (defaults to truncated message). */
      chatName?: string;
      /** When set with forceNewChat, append workflow run with real session_id after chat is created. */
      workflowExecContext?: { filename: string; userId: string };
      /** Target chat ID to send message to (defaults to current chat) */
      targetChatId?: string;
    }) => {
      if (!text.trim()) return;

      // Determine which chat to use
      let chatId = targetChatId ?? (forceNewChat ? null : currentChatIdRef.current);

      // Check if this specific chat is already generating
      if (chatId && isGenerating(chatId)) return;

      let hasActiveLlm = false;
      try {
        const active = await llmModelsApi.getActive();
        const slot = active?.active_llm;
        hasActiveLlm = Boolean(slot?.provider_id && slot?.model);
      } catch {
        hasActiveLlm = false;
      }
      if (!hasActiveLlm) {
        window.alert(
          "未配置对话模型. 请点击顶部「选择模型」或前往 设置 → 模型 完成配置后再发送.",
        );
        return;
      }

      let textForApi = text;
      try {
        textForApi = await expandChatReferenceText(text);
      } catch {
        /* 展开失败时仍发送原文 */
      }

      // Create chat if needed
      if (!chatId) {
        const titleForChat = chatName?.trim() || truncateTitle(text);
        const chatSpec = await createChat.mutateAsync({
          session_id: nanoid(),
          name: titleForChat,
          user_id: userId,
          channel: DEFAULT_CHANNEL,
        });
        chatId = chatSpec.id;
        setCurrentChatId(chatId);
      }

      // Now we have a valid chatId
      const resolvedChatId = chatId;

      // Get current state for this session
      const currentState = getSessionState(resolvedChatId);
      const isFirstMessage = currentState.messages.length === 0;

      // Add user message
      const userMsg: LocalMessage = {
        id: nanoid(),
        role: "user",
        content: text,
        createdAt: Date.now(),
        type: "text",
      };
      setSessionMessages(resolvedChatId, (prev) => [...prev, userMsg]);

      // Setup abort controller
      const abort = new AbortController();
      setAbortController(resolvedChatId, abort);
      setStatus(resolvedChatId, "submitted");
      setStreamingContent(resolvedChatId, "");

      let finalContent = "";
      let finalThinking = "";
      let finalTools: ToolCallInfo[] = [];

      const titleForChat = chatName?.trim() || truncateTitle(text);

      try {
        const currentSpec = sessions.find((s) => s.id === resolvedChatId);
        const sessionId = currentSpec?.session_id ?? resolvedChatId;
        const resolvedUserId = currentSpec?.user_id ?? userId;
        const channel = currentSpec?.channel ?? DEFAULT_CHANNEL;

        // Mark session as running for reconnect support
        markSessionRunning(resolvedChatId, sessionId, resolvedUserId, channel);

        if (workflowExecContext && forceNewChat) {
          try {
            await workflowApi.appendRun(workflowExecContext.filename, {
              user_id: workflowExecContext.userId,
              session_id: sessionId,
              trigger: "ui_execute",
            });
            void queryClient.invalidateQueries({
              queryKey: qkWorkflowRuns(workflowExecContext.filename),
            });
          } catch {
            /* 不阻断发送 */
          }
        }

        const atWorkflows = uniqueWorkflowFilenames(text);
        await Promise.all(
          atWorkflows.map(async (filename) => {
            if (workflowExecContext?.filename === filename && forceNewChat) {
              return;
            }
            try {
              await workflowApi.appendRun(filename, {
                user_id: resolvedUserId,
                session_id: sessionId,
                trigger: "chat_at",
              });
              void queryClient.invalidateQueries({
                queryKey: qkWorkflowRuns(filename),
              });
            } catch {
              /* 无效路径或未授权时不记录 */
            }
          }),
        );

        const fileParts: ContentPart[] = await Promise.all(
          files.map(async (f) => {
            const file = dataUrlToFile(
              f.url ?? "",
              f.filename ?? "file",
              f.mediaType ?? "",
            );
            const storedName = await chatApi.uploadFile(file);
            const mime = f.mediaType ?? "";
            if (mime.startsWith("image/"))
              return { type: "image" as const, image_url: storedName };
            if (mime.startsWith("audio/"))
              return { type: "audio" as const, data: storedName };
            if (mime.startsWith("video/"))
              return { type: "video" as const, video_url: storedName };
            return {
              type: "file" as const,
              file_url: storedName,
              filename: f.filename,
            };
          }),
        );

        const contentParts: ContentPart[] = [
          { type: "text", text: textForApi },
          ...fileParts,
        ];
        const input = [
          {
            id: nanoid(),
            type: "message",
            role: "user",
            content: contentParts,
          },
        ];

        setStatus(resolvedChatId, "streaming");

        const result = await chatApi.streamChat({
          input,
          session_id: sessionId,
          user_id: resolvedUserId,
          channel,
          signal: abort.signal,
          onChunk: (content) => setStreamingContent(resolvedChatId, content),
          onThinkingChunk: (thinking) =>
            setStreamingThinking(resolvedChatId, thinking),
          onThinkingStart: () => setIsThinkingStreaming(resolvedChatId, true),
          onThinkingEnd: () => setIsThinkingStreaming(resolvedChatId, false),
          onToolStart: (tool) => addOrUpdateTool(resolvedChatId, tool),
          onToolUpdate: (tool) => updateTool(resolvedChatId, tool),
        });
        finalContent = result.content;
        finalThinking = result.thinking;
        finalTools = result.tools;
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setStatus(resolvedChatId, "error");
          markSessionStopped(resolvedChatId);
          return;
        }
      } finally {
        // Append final messages
        const newMessages: LocalMessage[] = [];
        if (finalThinking) {
          newMessages.push({
            id: nanoid(),
            role: "assistant",
            content: finalThinking,
            createdAt: Date.now(),
            type: "thinking",
          });
        }
        for (const tool of finalTools) {
          newMessages.push({
            id: nanoid(),
            role: "assistant",
            content: "",
            createdAt: Date.now(),
            type: "tool",
            tool,
          });
        }
        if (finalContent) {
          newMessages.push({
            id: nanoid(),
            role: "assistant",
            content: finalContent,
            createdAt: Date.now(),
            type: "text",
          });
        }
        if (newMessages.length > 0) {
          setSessionMessages(resolvedChatId, (prev) => [...prev, ...newMessages]);
        }
        resetStreamingState(resolvedChatId);
        markSessionStopped(resolvedChatId);

        // Update session metadata
        const updatedAt = new Date().toISOString();
        if (isFirstMessage) {
          const currentSpec = sessions.find((s) => s.id === resolvedChatId);
          if (currentSpec) {
            const newName = titleForChat;
            chatApi
              .updateChat(resolvedChatId, { ...currentSpec, name: newName })
              .then((updated) => {
                queryClient.setQueryData<ChatSpec[]>(
                  chatsListQueryKey(userId),
                  (prev = []) =>
                    prev.map((s) => (s.id === resolvedChatId ? updated : s)),
                );
              })
              .catch(() => {});
          }
        } else {
          queryClient.setQueryData<ChatSpec[]>(
            chatsListQueryKey(userId),
            (prev = []) =>
              prev.map((s) =>
                s.id === resolvedChatId
                  ? { ...s, updated_at: updatedAt, status: "idle" }
                  : s,
              ),
          );
        }
      }
    },
    [
      sessions,
      userId,
      createChat,
      queryClient,
      getSessionState,
      setSessionMessages,
      setStreamingContent,
      setStreamingThinking,
      setIsThinkingStreaming,
      addOrUpdateTool,
      updateTool,
      setStatus,
      setAbortController,
      resetStreamingState,
      isGenerating,
      setCurrentChatId,
      markSessionRunning,
      markSessionStopped,
    ],
  );

  /** Reconnect to a running session's stream */
  const handleReconnect = useCallback(
    async (chatId: string) => {
      const currentSpec = sessions.find((s) => s.id === chatId);
      if (!currentSpec) return false;

      const sessionId = currentSpec.session_id;
      const resolvedUserId = currentSpec.user_id ?? userId;
      const channel = currentSpec.channel ?? DEFAULT_CHANNEL;

      // Setup abort controller
      const abort = new AbortController();
      setAbortController(chatId, abort);
      setStatus(chatId, "streaming");

      // Mark as running again
      markSessionRunning(chatId, sessionId, resolvedUserId, channel);

      try {
        const result = await chatApi.reconnectStream({
          session_id: sessionId,
          user_id: resolvedUserId,
          channel,
          signal: abort.signal,
          onChunk: (content) => setStreamingContent(chatId, content),
          onThinkingChunk: (thinking) => setStreamingThinking(chatId, thinking),
          onThinkingStart: () => setIsThinkingStreaming(chatId, true),
          onThinkingEnd: () => setIsThinkingStreaming(chatId, false),
          onToolStart: (tool) => addOrUpdateTool(chatId, tool),
          onToolUpdate: (tool) => updateTool(chatId, tool),
        });

        if (!result.reconnected) {
          // No running session, just reset
          resetStreamingState(chatId);
          markSessionStopped(chatId);
          return false;
        }

        // Append final messages
        const newMessages: LocalMessage[] = [];
        if (result.thinking) {
          newMessages.push({
            id: nanoid(),
            role: "assistant",
            content: result.thinking,
            createdAt: Date.now(),
            type: "thinking",
          });
        }
        for (const tool of result.tools) {
          newMessages.push({
            id: nanoid(),
            role: "assistant",
            content: "",
            createdAt: Date.now(),
            type: "tool",
            tool,
          });
        }
        if (result.content) {
          newMessages.push({
            id: nanoid(),
            role: "assistant",
            content: result.content,
            createdAt: Date.now(),
            type: "text",
          });
        }
        if (newMessages.length > 0) {
          setSessionMessages(chatId, (prev) => [...prev, ...newMessages]);
        }

        resetStreamingState(chatId);
        markSessionStopped(chatId);
        return true;
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setStatus(chatId, "error");
          markSessionStopped(chatId);
        }
        return false;
      }
    },
    [
      sessions,
      userId,
      setStreamingContent,
      setStreamingThinking,
      setIsThinkingStreaming,
      addOrUpdateTool,
      updateTool,
      setStatus,
      setAbortController,
      resetStreamingState,
      setSessionMessages,
      markSessionRunning,
      markSessionStopped,
    ],
  );

  // Return current session's state for UI binding
  const currentSessionState = currentChatId
    ? getSessionState(currentChatId)
    : {
        messages: [],
        streamingContent: "",
        streamingThinking: "",
        isThinkingStreaming: false,
        streamingTools: [],
        status: "ready" as ChatStatus,
      };

  const currentIsGenerating = currentChatId ? isGenerating(currentChatId) : false;

  return {
    // Current session state for UI
    status: currentSessionState.status,
    streamingContent: currentSessionState.streamingContent,
    streamingThinking: currentSessionState.streamingThinking,
    isThinkingStreaming: currentSessionState.isThinkingStreaming,
    streamingTools: currentSessionState.streamingTools,
    isGenerating: currentIsGenerating,
    messages: currentSessionState.messages,
    // Actions
    handleSubmit,
    handleStop,
    handleReconnect,
    resetStreaming: () => currentChatId && resetStreamingState(currentChatId),
    // Expose for advanced use
    getSessionState,
    setSessionMessages,
    clearSession,
    isGeneratingSession: isGenerating,
    getRunningSessionsInfo,
  };
}