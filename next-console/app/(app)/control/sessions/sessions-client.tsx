"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import type { ChatSpec } from "@/lib/sessions-api";
import { sessionsApi } from "@/lib/sessions-api";
import { useAppShell } from "../../app-shell";
import { SessionsToolbar } from "./sessions-toolbar";
import {
  chatDetailKey,
  chatsQueryKey,
  formatSessionTime,
  rowMatchesSearch,
  messageStableKey,
  summarizeMessage,
} from "./sessions-domain";
import { Loader2Icon, Trash2Icon } from "lucide-react";

export function SessionsClient() {
  const queryClient = useQueryClient();
  const { showLeftSidebar, toggleLeftSidebar } = useAppShell();
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [userIdInput, setUserIdInput] = useState("");
  const [debouncedUserId, setDebouncedUserId] = useState("");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<ChatSpec | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedUserId(userIdInput.trim()), 400);
    return () => clearTimeout(t);
  }, [userIdInput]);

  const filters = useMemo(
    () => ({
      channel: channelFilter || undefined,
      user_id: debouncedUserId || undefined,
    }),
    [channelFilter, debouncedUserId],
  );

  const listQuery = useQuery({
    queryKey: chatsQueryKey(filters),
    queryFn: () => sessionsApi.list(filters),
  });

  const detailQuery = useQuery({
    queryKey: chatDetailKey(selected?.id ?? null),
    queryFn: () => sessionsApi.get(selected!.id),
    enabled: Boolean(sheetOpen && selected?.id),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.delete(id),
    onSuccess: async () => {
      setDeleteId(null);
      setSheetOpen(false);
      setSelected(null);
      await queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });

  const channelOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of listQuery.data ?? []) {
      if (c.channel) set.add(c.channel);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [listQuery.data]);

  const displayRows = useMemo(() => {
    const rows = listQuery.data ?? [];
    return rows.filter((r) => rowMatchesSearch(r, searchQuery));
  }, [listQuery.data, searchQuery]);

  const openDetail = useCallback((row: ChatSpec) => {
    setSelected(row);
    setSheetOpen(true);
  }, []);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["chats"] });
  }, [queryClient]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background text-base">
      <SessionsToolbar
        showLeftSidebar={showLeftSidebar}
        onToggleLeftSidebar={toggleLeftSidebar}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        channelFilter={channelFilter}
        onChannelFilterChange={setChannelFilter}
        userIdInput={userIdInput}
        onUserIdInputChange={setUserIdInput}
        channelOptions={channelOptions}
        onRefresh={refresh}
        listLoading={listQuery.isFetching}
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground">
            列表来自当前活动智能体的 Chat 注册表. 服务端可按用户 ID 过滤;
            搜索框仅在当前页结果内匹配. 删除仅移除 Chat 记录,
            会话状态文件可能仍存在.
          </p>

          {listQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>加载失败</AlertTitle>
              <AlertDescription>{listQuery.error.message}</AlertDescription>
            </Alert>
          ) : null}

          {listQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : null}

          {!listQuery.isLoading &&
            !listQuery.isError &&
            displayRows.length === 0 && (
              <p className="text-sm text-muted-foreground">暂无会话.</p>
            )}

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-3 py-2 font-medium">名称</th>
                  <th className="px-3 py-2 font-medium">通道</th>
                  <th className="px-3 py-2 font-medium">用户</th>
                  <th className="px-3 py-2 font-medium">session_id</th>
                  <th className="px-3 py-2 font-medium">状态</th>
                  <th className="px-3 py-2 font-medium">更新</th>
                  <th className="px-3 py-2 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="max-w-[160px] truncate px-3 py-2 font-medium">
                      {row.name}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">{row.channel}</Badge>
                    </td>
                    <td className="max-w-[120px] truncate px-3 py-2 font-mono text-xs">
                      {row.user_id}
                    </td>
                    <td
                      className="max-w-[220px] truncate px-3 py-2 font-mono text-xs"
                      title={row.session_id}
                    >
                      {row.session_id}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={
                          row.status === "running" ? "default" : "secondary"
                        }
                      >
                        {row.status}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                      {formatSessionTime(row.updated_at)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-base"
                          onClick={() => openDetail(row)}
                        >
                          详情
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive text-base"
                          onClick={() => setDeleteId(row.id)}
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </ScrollArea>

      <Sheet
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) setSelected(null);
        }}
      >
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <SheetHeader className="shrink-0">
            <SheetTitle className="line-clamp-2 pr-8">
              {selected?.name ?? "会话"}
            </SheetTitle>
            {selected ? (
              <p className="text-left text-xs text-muted-foreground">
                <span className="font-mono">{selected.id}</span>
              </p>
            ) : null}
          </SheetHeader>

          <ScrollArea className="min-h-0 flex-1 px-4">
            <div className="space-y-4 pb-4">
              {selected ? (
                <dl className="grid gap-2 text-sm">
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <dt className="text-muted-foreground">通道</dt>
                    <dd className="font-mono">{selected.channel}</dd>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <dt className="text-muted-foreground">用户</dt>
                    <dd className="break-all font-mono">{selected.user_id}</dd>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <dt className="text-muted-foreground">session_id</dt>
                    <dd className="break-all font-mono text-xs">
                      {selected.session_id}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <dt className="text-muted-foreground">状态</dt>
                    <dd>
                      <Badge
                        variant={
                          selected.status === "running"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {selected.status}
                      </Badge>
                      {detailQuery.data ? (
                        <span className="ml-2 text-muted-foreground">
                          (内存: {detailQuery.data.status})
                        </span>
                      ) : null}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <dt className="text-muted-foreground">创建</dt>
                    <dd className="text-xs text-muted-foreground">
                      {formatSessionTime(selected.created_at)}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <dt className="text-muted-foreground">更新</dt>
                    <dd className="text-xs text-muted-foreground">
                      {formatSessionTime(selected.updated_at)}
                    </dd>
                  </div>
                </dl>
              ) : null}

              <Separator />

              <div>
                <h3 className="mb-2 text-sm font-medium">消息</h3>
                {detailQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">加载消息...</p>
                ) : null}
                {detailQuery.isError ? (
                  <Alert variant="destructive">
                    <AlertTitle>消息加载失败</AlertTitle>
                    <AlertDescription>
                      {detailQuery.error.message}
                    </AlertDescription>
                  </Alert>
                ) : null}
                {detailQuery.data ? (
                  <div className="space-y-2">
                    {detailQuery.data.messages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        无消息或会话状态为空.
                      </p>
                    ) : (
                      detailQuery.data.messages.map((m, i) => {
                        const { role, text } = summarizeMessage(m);
                        return (
                          <div
                            key={messageStableKey(m, i)}
                            className="rounded-md border border-border bg-card p-3"
                          >
                            <div className="mb-1 flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {role}
                              </Badge>
                            </div>
                            <pre className="max-h-48 overflow-auto whitespace-pre-wrap wrap-break-word font-mono text-xs text-foreground">
                              {text || "(空)"}
                            </pre>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </div>

              {selected ? (
                <div className="pt-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="text-base"
                    onClick={() => setDeleteId(selected.id)}
                  >
                    <Trash2Icon className="size-4" />
                    删除此会话
                  </Button>
                </div>
              ) : null}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Dialog open={deleteId != null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="text-base">
          <DialogHeader>
            <DialogTitle>删除会话</DialogTitle>
            <DialogDescription>
              将删除 Chat 记录{" "}
              <span className="font-mono text-foreground">{deleteId}</span>.
              此操作不可恢复.
            </DialogDescription>
          </DialogHeader>
          {deleteMutation.isError ? (
            <p className="text-destructive">
              {(deleteMutation.error as Error).message}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              className="inline-flex gap-2"
              disabled={deleteMutation.isPending || !deleteId}
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              {deleteMutation.isPending ? (
                <Loader2Icon className="size-4 shrink-0 animate-spin" />
              ) : null}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
