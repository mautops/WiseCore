import type { ToolCallInfo } from "@/lib/chat-api";
import type { ChatStatus } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LocalMessage, SessionStreamState } from "./types";

const DEFAULT_STATUS: ChatStatus = "ready";

/** Key for storing running sessions in sessionStorage */
const RUNNING_SESSIONS_KEY = "hi-ops:running-sessions";

/** Session info persisted across page navigations */
interface RunningSessionInfo {
  chatId: string;
  sessionId: string;
  userId: string;
  channel: string;
}

function createEmptySessionState(): SessionStreamState {
  return {
    messages: [],
    streamingContent: "",
    streamingThinking: "",
    isThinkingStreaming: false,
    streamingTools: [],
    status: DEFAULT_STATUS,
    abortController: null,
  };
}

/** Get running sessions from sessionStorage */
function getRunningSessions(): RunningSessionInfo[] {
  try {
    const raw = sessionStorage.getItem(RUNNING_SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Save running sessions to sessionStorage */
function saveRunningSessions(sessions: RunningSessionInfo[]): void {
  try {
    sessionStorage.setItem(RUNNING_SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    /* ignore */
  }
}

export function useSessionStreams() {
  // Map<chatId, SessionStreamState> - stores independent state for each session
  const sessionsRef = useRef<Map<string, SessionStreamState>>(new Map());
  // Force re-render when current session state changes
  const [, forceUpdate] = useState(0);

  const getSessionState = useCallback((chatId: string): SessionStreamState => {
    let state = sessionsRef.current.get(chatId);
    if (!state) {
      state = createEmptySessionState();
      sessionsRef.current.set(chatId, state);
    }
    return state;
  }, []);

  const updateSessionState = useCallback(
    (chatId: string, updater: (state: SessionStreamState) => SessionStreamState) => {
      const currentState = getSessionState(chatId);
      const newState = updater(currentState);
      sessionsRef.current.set(chatId, newState);
      forceUpdate((n) => n + 1);
    },
    [getSessionState],
  );

  const setSessionMessages = useCallback(
    (chatId: string, messages: LocalMessage[] | ((prev: LocalMessage[]) => LocalMessage[])) => {
      updateSessionState(chatId, (state) => ({
        ...state,
        messages: typeof messages === "function" ? messages(state.messages) : messages,
      }));
    },
    [updateSessionState],
  );

  const setStreamingContent = useCallback(
    (chatId: string, content: string) => {
      updateSessionState(chatId, (state) => ({ ...state, streamingContent: content }));
    },
    [updateSessionState],
  );

  const setStreamingThinking = useCallback(
    (chatId: string, thinking: string) => {
      updateSessionState(chatId, (state) => ({ ...state, streamingThinking: thinking }));
    },
    [updateSessionState],
  );

  const setIsThinkingStreaming = useCallback(
    (chatId: string, value: boolean) => {
      updateSessionState(chatId, (state) => ({ ...state, isThinkingStreaming: value }));
    },
    [updateSessionState],
  );

  const addOrUpdateTool = useCallback(
    (chatId: string, tool: ToolCallInfo) => {
      updateSessionState(chatId, (state) => {
        const idx = state.streamingTools.findIndex((t) => t.callId === tool.callId);
        const newTools =
          idx >= 0
            ? state.streamingTools.map((t, i) => (i === idx ? tool : t))
            : [...state.streamingTools, tool];
        return { ...state, streamingTools: newTools };
      });
    },
    [updateSessionState],
  );

  const updateTool = useCallback(
    (chatId: string, tool: ToolCallInfo) => {
      updateSessionState(chatId, (state) => ({
        ...state,
        streamingTools: state.streamingTools.map((t) =>
          t.callId === tool.callId ? tool : t,
        ),
      }));
    },
    [updateSessionState],
  );

  const setStatus = useCallback(
    (chatId: string, status: ChatStatus) => {
      updateSessionState(chatId, (state) => ({ ...state, status }));
    },
    [updateSessionState],
  );

  const setAbortController = useCallback(
    (chatId: string, controller: AbortController | null) => {
      updateSessionState(chatId, (state) => ({ ...state, abortController: controller }));
    },
    [updateSessionState],
  );

  const resetStreamingState = useCallback(
    (chatId: string) => {
      updateSessionState(chatId, (state) => ({
        ...state,
        streamingContent: "",
        streamingThinking: "",
        isThinkingStreaming: false,
        streamingTools: [],
        status: DEFAULT_STATUS,
      }));
    },
    [updateSessionState],
  );

  const clearSession = useCallback((chatId: string) => {
    sessionsRef.current.delete(chatId);
    // Remove from running sessions
    const running = getRunningSessions().filter((s) => s.chatId !== chatId);
    saveRunningSessions(running);
    forceUpdate((n) => n + 1);
  }, []);

  const isGenerating = useCallback(
    (chatId: string): boolean => {
      const state = sessionsRef.current.get(chatId);
      return state?.status === "submitted" || state?.status === "streaming";
    },
    [],
  );

  const hasAnyGenerating = useCallback((): boolean => {
    for (const state of sessionsRef.current.values()) {
      if (state.status === "submitted" || state.status === "streaming") {
        return true;
      }
    }
    return false;
  }, []);

  /** Mark a session as running (persist to sessionStorage) */
  const markSessionRunning = useCallback(
    (chatId: string, sessionId: string, userId: string, channel: string) => {
      const running = getRunningSessions();
      const existing = running.find((s) => s.chatId === chatId);
      if (!existing) {
        running.push({ chatId, sessionId, userId, channel });
        saveRunningSessions(running);
      }
    },
    [],
  );

  /** Mark a session as stopped (remove from sessionStorage) */
  const markSessionStopped = useCallback((chatId: string) => {
    const running = getRunningSessions().filter((s) => s.chatId !== chatId);
    saveRunningSessions(running);
  }, []);

  /** Get all running sessions info */
  const getRunningSessionsInfo = useCallback((): RunningSessionInfo[] => {
    return getRunningSessions();
  }, []);

  return {
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
    hasAnyGenerating,
    markSessionRunning,
    markSessionStopped,
    getRunningSessionsInfo,
  };
}