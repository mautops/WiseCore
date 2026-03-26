import { type ChatSpec, chatApi } from "@/lib/chat-api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { nanoid } from "nanoid";
import { chatsListQueryKey } from "./chat-query-keys";
import { DEFAULT_CHANNEL } from "./types";

export function useChatSessions({
  userId,
  skipInitialAutoSelect = false,
}: {
  userId: string;
  /** When true, do not auto-pick newest session (e.g. chat opened with ?execWorkflow=1). */
  skipInitialAutoSelect?: boolean;
}) {
  const queryClient = useQueryClient();
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const listKey = chatsListQueryKey(userId);

  const { data: sessions = [], isPending: sessionsPending } = useQuery({
    queryKey: listKey,
    queryFn: () => chatApi.listChats(),
  });

  const { data: chatHistory } = useQuery({
    queryKey: ["chat", currentChatId],
    queryFn: () => chatApi.getChat(currentChatId!),
    enabled: !!currentChatId,
  });

  // Sort sessions by updated_at (newest first), then created_at as fallback
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const aTime = a.updated_at
        ? new Date(a.updated_at).getTime()
        : a.created_at
          ? new Date(a.created_at).getTime()
          : 0;
      const bTime = b.updated_at
        ? new Date(b.updated_at).getTime()
        : b.created_at
          ? new Date(b.created_at).getTime()
          : 0;
      return bTime - aTime; // Descending order (newest first)
    });
  }, [sessions]);

  // Select the newest session on initial load (unless workflow-exec handoff)
  useEffect(() => {
    if (
      !skipInitialAutoSelect &&
      sortedSessions.length > 0 &&
      currentChatId === null
    ) {
      setCurrentChatId(sortedSessions[0].id);
    }
  }, [skipInitialAutoSelect, sortedSessions, currentChatId]);

  // ── Mutations ────────────────────────────────────────────────────────────

  const createChat = useMutation({
    mutationFn: chatApi.createChat,
    onSuccess: (chatSpec) => {
      queryClient.setQueryData<ChatSpec[]>(listKey, (prev = []) => [
        chatSpec,
        ...prev,
      ]);
    },
  });

  const updateChat = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ChatSpec> }) =>
      chatApi.updateChat(id, data),
    onSuccess: (updated) => {
      queryClient.setQueryData<ChatSpec[]>(listKey, (prev = []) =>
        prev.map((s) => (s.id === updated.id ? updated : s)),
      );
    },
  });

  const deleteChat = useMutation({
    mutationFn: chatApi.deleteChat,
    onSuccess: (_, id) => {
      queryClient.setQueryData<ChatSpec[]>(listKey, (prev = []) =>
        prev.filter((s) => s.id !== id),
      );
      if (id === currentChatId) {
        setCurrentChatId(null);
      }
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSelectSession = useCallback(
    (id: string) => {
      if (id === currentChatId) return;
      setCurrentChatId(id);
    },
    [currentChatId],
  );

  const handleNewChat = useCallback(async () => {
    const chatSpec = await createChat.mutateAsync({
      session_id: nanoid(),
      name: "新对话",
      user_id: userId,
      channel: DEFAULT_CHANNEL,
    });
    setCurrentChatId(chatSpec.id);
    return chatSpec.id;
  }, [createChat, userId]);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      await deleteChat.mutateAsync(id);
    },
    [deleteChat],
  );

  const handleRenameSession = useCallback(
    async (id: string, name: string) => {
      const current = sessions.find((s) => s.id === id);
      if (!current) return;
      await updateChat.mutateAsync({ id, data: { ...current, name } });
    },
    [updateChat, sessions],
  );

  return {
    sessions,
    sessionsPending,
    currentChatId,
    setCurrentChatId,
    chatHistory,
    createChat,
    queryClient,
    handleSelectSession,
    handleNewChat,
    handleDeleteSession,
    handleRenameSession,
  };
}