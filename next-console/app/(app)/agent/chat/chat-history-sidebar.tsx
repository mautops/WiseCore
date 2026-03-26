"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ChatSpec } from "@/lib/chat-api";
import {
  MessageSquareIcon,
  PlusIcon,
  Trash2Icon,
  PencilIcon,
  CheckIcon,
  XIcon,
  Loader2Icon,
} from "lucide-react";
import { ChevronRightIcon } from "lucide-react";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";

// ── Date grouping ─────────────────────────────────────────────────────────────

interface SessionGroup {
  label: string;
  sessions: ChatSpec[];
}

function getGroupLabel(dateStr: string | null, now: Date): string {
  if (!dateStr) return "更早";
  const date = new Date(dateStr);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sessionDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diffDays = Math.round(
    (today.getTime() - sessionDay.getTime()) / 86400000,
  );

  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays < 3) return "过去 3 天";

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (year === now.getFullYear()) return `${month} 月 ${day} 日`;
  return `${year} 年 ${month} 月 ${day} 日`;
}

function groupSessions(sessions: ChatSpec[]): SessionGroup[] {
  const now = new Date();
  const sorted = [...sessions].sort((a, b) => {
    const at = a.updated_at
      ? new Date(a.updated_at).getTime()
      : a.created_at
        ? new Date(a.created_at).getTime()
        : 0;
    const bt = b.updated_at
      ? new Date(b.updated_at).getTime()
      : b.created_at
        ? new Date(b.created_at).getTime()
        : 0;
    return bt - at;
  });

  const map = new Map<string, ChatSpec[]>();
  for (const s of sorted) {
    const label = getGroupLabel(s.updated_at ?? s.created_at, now);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(s);
  }

  return Array.from(map.entries()).map(([label, sessions]) => ({
    label,
    sessions,
  }));
}

export const SIDEBAR_DEFAULT_WIDTH = 336;

interface ChatHistorySidebarProps {
  sessions: ChatSpec[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => Promise<void>;
  onRenameSession: (id: string, name: string) => Promise<void>;
  width?: number;
  onWidthChange?: (width: number) => void;
  /** Check if a specific session is generating */
  isGeneratingSession?: (chatId: string) => boolean;
}

interface SessionItemProps {
  session: ChatSpec;
  isActive: boolean;
  isGenerating: boolean;
  onSelect: () => void;
  onDelete: () => Promise<void>;
  onRename: (name: string) => Promise<void>;
}

function SessionItem({
  session,
  isActive,
  isGenerating,
  onSelect,
  onDelete,
  onRename,
}: SessionItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(session.name);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const startEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditValue(session.name);
      setIsEditing(true);
    },
    [session.name],
  );

  const confirmEdit = useCallback(async () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== session.name) {
      await onRename(trimmed);
    }
    setIsEditing(false);
  }, [editValue, session.name, onRename]);

  const cancelEdit = useCallback(() => {
    setEditValue(session.name);
    setIsEditing(false);
  }, [session.name]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") confirmEdit();
      if (e.key === "Escape") cancelEdit();
    },
    [confirmEdit, cancelEdit],
  );

  const handleDelete = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      await onDelete();
    },
    [onDelete],
  );

  return (
    <li
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isEditing ? (
        <div className="flex items-center gap-1 px-2 py-1.5">
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-8 text-base md:text-base"
          />
          <Button
            size="icon"
            variant="ghost"
            className="size-6 shrink-0"
            onClick={confirmEdit}
          >
            <CheckIcon className="size-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-6 shrink-0"
            onClick={cancelEdit}
          >
            <XIcon className="size-3" />
          </Button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={onSelect}
          onKeyDown={(e) => e.key === "Enter" && onSelect()}
          className={cn(
            "group relative w-full cursor-pointer rounded-md px-3 py-2 text-left transition-colors hover:bg-accent",
            isActive && "bg-accent text-accent-foreground",
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            {isGenerating ? (
              <Loader2Icon className="size-3.5 shrink-0 animate-spin text-primary" />
            ) : (
              <MessageSquareIcon className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="flex-1 truncate">{session.name}</span>

            {(isHovered || isActive) && (
              <div
                className="flex shrink-0 items-center gap-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-5 opacity-60 hover:opacity-100"
                  onClick={startEdit}
                  title="重命名"
                >
                  <PencilIcon className="size-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-5 opacity-60 hover:opacity-100 hover:text-destructive"
                  onClick={handleDelete}
                  title="删除"
                >
                  <Trash2Icon className="size-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

interface GroupSectionProps {
  group: SessionGroup;
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => Promise<void>;
  onRenameSession: (id: string, name: string) => Promise<void>;
  isGeneratingSession?: (chatId: string) => boolean;
}

function GroupSection({
  group,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  isGeneratingSession,
}: GroupSectionProps) {
  const collapsible = group.label !== "今天" && group.label !== "昨天";
  const [collapsed, setCollapsed] = useState(collapsible);

  return (
    <div>
      <button
        onClick={() => collapsible && setCollapsed((v) => !v)}
        className={cn(
          "mb-1 flex w-full items-center gap-1 rounded px-2 py-0.5 font-medium text-muted-foreground",
          collapsible &&
            "cursor-pointer hover:text-foreground transition-colors",
        )}
      >
        {collapsible && (
          <ChevronRightIcon
            className={cn(
              "size-3 shrink-0 transition-transform",
              !collapsed && "rotate-90",
            )}
          />
        )}
        {group.label}
      </button>
      {!collapsed && (
        <ul className="space-y-0.5">
          {group.sessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              isActive={session.id === currentSessionId}
              isGenerating={isGeneratingSession?.(session.id) ?? false}
              onSelect={() => onSelectSession(session.id)}
              onDelete={() => onDeleteSession(session.id)}
              onRename={(name) => onRenameSession(session.id, name)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

const MIN_WIDTH = 240;
const MAX_WIDTH = 600;

export function ChatHistorySidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  width = SIDEBAR_DEFAULT_WIDTH,
  onWidthChange,
  isGeneratingSession,
}: ChatHistorySidebarProps) {
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const groups = useMemo(() => groupSessions(sessions), [sessions]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      startX.current = e.clientX;
      startWidth.current = width;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width],
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startX.current - e.clientX;
      const next = Math.min(
        MAX_WIDTH,
        Math.max(MIN_WIDTH, startWidth.current + delta),
      );
      onWidthChange?.(next);
    };
    const onMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-l border-border bg-card"
      style={{ width }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 left-0 h-full w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
      />

      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="font-medium text-foreground">历史记录</span>
        <Button
          onClick={onNewChat}
          size="icon-sm"
          variant="ghost"
          title="新建对话"
        >
          <PlusIcon className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {groups.length === 0 ? (
          <p className="px-2 py-6 text-center text-muted-foreground">
            暂无对话记录
          </p>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <GroupSection
                key={group.label}
                group={group}
                currentSessionId={currentSessionId}
                onSelectSession={onSelectSession}
                onDeleteSession={onDeleteSession}
                onRenameSession={onRenameSession}
                isGeneratingSession={isGeneratingSession}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}