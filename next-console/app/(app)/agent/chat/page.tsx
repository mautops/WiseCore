"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { useAppShell } from "@/app/(app)/app-shell";
import { ContentTopbar } from "@/components/layout/content-topbar";
import {
  WORKFLOW_CHAT_EXEC_STORAGE_KEY,
  type WorkflowChatExecPayload,
} from "@/lib/workflow-chat-bridge";
import {
  ChatHistorySidebar,
  SIDEBAR_DEFAULT_WIDTH,
} from "./chat-history-sidebar";
import { ChatModelSelector } from "./chat-model-selector";
import { ChatInput } from "./chat-input";
import { ChatMessageList } from "./chat-message-list";
import { ChatSearchDialog } from "./chat-search-dialog";
import { scopeUserFromSessionUser } from "@/lib/workflow-username";
import { useChatSessions } from "./use-chat-sessions";
import { useChatStream } from "./use-chat-stream";

function ChatPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openSessionParam = searchParams.get("openSession")?.trim() ?? "";
  const skipInitialAutoSelect =
    searchParams.get("execWorkflow") === "1" || Boolean(openSessionParam);

  const { showLeftSidebar, toggleLeftSidebar, user } = useAppShell();

  const userId = (user && scopeUserFromSessionUser(user)) || "default";

  const userInitials = (user?.name || user?.username || user?.email || "U")
    .split(/[\s@]/)
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(
    SIDEBAR_DEFAULT_WIDTH,
  );
  const [searchOpen, setSearchOpen] = useState(false);

  const {
    sessions,
    sessionsPending,
    currentChatId,
    setCurrentChatId,
    chatHistory,
    messages,
    setMessages,
    createChat,
    queryClient,
    handleSelectSession,
    handleNewChat,
    handleDeleteSession,
    handleRenameSession,
  } = useChatSessions({ userId, skipInitialAutoSelect });

  const pendingOpenSessionRef = useRef<string | null>(null);

  const {
    status,
    streamingContent,
    streamingThinking,
    isThinkingStreaming,
    streamingTools,
    isGenerating,
    handleSubmit,
    handleStop,
    resetStreaming,
  } = useChatStream({
    userId,
    sessions,
    currentChatId,
    setCurrentChatId,
    messages,
    setMessages,
    createChat,
    queryClient,
    chatHistory,
  });

  useEffect(() => {
    const v = searchParams.get("openSession")?.trim();
    if (v) pendingOpenSessionRef.current = v;
  }, [searchParams]);

  useEffect(() => {
    const target = pendingOpenSessionRef.current;
    if (!target || sessionsPending) return;
    const found = sessions.find(
      (s) => s.session_id === target || s.id === target,
    );
    pendingOpenSessionRef.current = null;
    router.replace(pathname);
    if (!found) return;
    resetStreaming();
    handleSelectSession(found.id);
    void queryClient.refetchQueries({ queryKey: ["chat", found.id] });
  }, [
    sessions,
    sessionsPending,
    pathname,
    router,
    resetStreaming,
    handleSelectSession,
    queryClient,
  ]);

  useEffect(() => {
    if (searchParams.get("execWorkflow") !== "1") return;
    const raw = sessionStorage.getItem(WORKFLOW_CHAT_EXEC_STORAGE_KEY);
    router.replace(pathname);
    if (!raw) return;
    sessionStorage.removeItem(WORKFLOW_CHAT_EXEC_STORAGE_KEY);
    let payload: WorkflowChatExecPayload;
    try {
      payload = JSON.parse(raw) as WorkflowChatExecPayload;
    } catch {
      return;
    }
    if (!payload.markdown?.trim()) return;
    resetStreaming();
    setMessages([]);
    void handleSubmit({
      text: payload.markdown,
      files: [],
      forceNewChat: true,
      chatName: payload.sessionTitle,
      workflowExecContext:
        payload.workflowFilename && payload.userId
          ? {
              filename: payload.workflowFilename,
              userId: payload.userId,
            }
          : undefined,
    });
  }, [
    searchParams,
    router,
    pathname,
    resetStreaming,
    setMessages,
    handleSubmit,
  ]);

  const onNewChat = useCallback(async () => {
    resetStreaming();
    await handleNewChat();
  }, [resetStreaming, handleNewChat]);

  const handleSuggestion = useCallback(
    (text: string) => {
      handleSubmit({ text, files: [] });
    },
    [handleSubmit],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <ChatSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        sessions={sessions}
        onSelect={handleSelectSession}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <ContentTopbar
            showLeftSidebar={showLeftSidebar}
            onToggleLeftSidebar={toggleLeftSidebar}
            showRightSidebar={showRightSidebar}
            onToggleRightSidebar={() => setShowRightSidebar((p) => !p)}
            onSearchOpen={() => setSearchOpen(true)}
            searchPlaceholder="搜索对话..."
            endSlot={<ChatModelSelector />}
          />

          <Conversation className="min-h-0 flex-1">
            <ConversationContent
              className="px-0 pt-15 pb-[max(18rem,calc(11rem+28vh))]"
              scrollClassName="scroll-pb-[max(18rem,calc(11rem+28vh))]"
            >
              {messages.length === 0 && !isGenerating ? (
                <ConversationEmptyState
                  title="开始对话"
                  description="发送消息，与 AI 智能体开始聊天"
                >
                  <div className="mt-2">
                    <Suggestions>
                      <Suggestion
                        suggestion="你能做什么？"
                        onClick={handleSuggestion}
                      />
                      <Suggestion
                        suggestion="帮我分析系统运行状态"
                        onClick={handleSuggestion}
                      />
                      <Suggestion
                        suggestion="查询最新的任务日志"
                        onClick={handleSuggestion}
                      />
                      <Suggestion
                        suggestion="有哪些可用的工具？"
                        onClick={handleSuggestion}
                      />
                    </Suggestions>
                  </div>
                </ConversationEmptyState>
              ) : (
                <ChatMessageList
                  messages={messages}
                  status={status}
                  streamingContent={streamingContent}
                  streamingThinking={streamingThinking}
                  isThinkingStreaming={isThinkingStreaming}
                  streamingTools={streamingTools}
                  isGenerating={isGenerating}
                  userImage={user?.image ?? undefined}
                  userName={user?.name ?? undefined}
                  userInitials={userInitials}
                />
              )}
            </ConversationContent>
            <ConversationScrollButton className="z-30 bottom-[calc(11rem+env(safe-area-inset-bottom,0px))]" />
          </Conversation>

          <ChatInput
            status={status}
            onSubmit={handleSubmit}
            onStop={handleStop}
            showFollowUpSuggestions={messages.length > 0}
            onSuggestionClick={handleSuggestion}
          />
        </div>

        <div
          className="h-full shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out"
          style={{ width: showRightSidebar ? rightSidebarWidth : 0 }}
        >
          <ChatHistorySidebar
            sessions={sessions}
            currentSessionId={currentChatId}
            onSelectSession={handleSelectSession}
            onNewChat={onNewChat}
            onDeleteSession={handleDeleteSession}
            onRenameSession={handleRenameSession}
            width={rightSidebarWidth}
            onWidthChange={setRightSidebarWidth}
          />
        </div>
      </div>
    </>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          加载中…
        </div>
      }
    >
      <ChatPageInner />
    </Suspense>
  );
}
