"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import type { MCPClientCreateBody, MCPClientInfo } from "@/lib/mcp-api";
import { mcpApi } from "@/lib/mcp-api";
import { useAppShell } from "../../app-shell";
import { McpClientSheet } from "./mcp-client-sheet";
import { mcpClientKey, QK_MCP_LIST, transportLabel } from "./mcp-domain";
import { McpToolbar } from "./mcp-toolbar";
import { Loader2Icon, PencilIcon, Trash2Icon } from "lucide-react";

export function McpClientsView() {
  const queryClient = useQueryClient();
  const { showLeftSidebar, toggleLeftSidebar } = useAppShell();
  const [filterQuery, setFilterQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<MCPClientInfo | null>(null);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [toggleKey, setToggleKey] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: QK_MCP_LIST,
    queryFn: () => mcpApi.list(),
  });

  const rows = listQuery.data ?? [];
  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.key.localeCompare(b.key)),
    [rows],
  );
  const filtered = useMemo(
    () => sorted.filter((c) => mcpClientKey(c, filterQuery)),
    [sorted, filterQuery],
  );

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: QK_MCP_LIST });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: (body: MCPClientCreateBody) => mcpApi.create(body),
    onSuccess: async () => {
      setSheetOpen(false);
      await invalidate();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      key: k,
      body,
    }: {
      key: string;
      body: Parameters<typeof mcpApi.update>[1];
    }) => mcpApi.update(k, body),
    onSuccess: async () => {
      setSheetOpen(false);
      setEditing(null);
      await invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (k: string) => mcpApi.delete(k),
    onSuccess: async () => {
      setDeleteKey(null);
      await invalidate();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (k: string) => mcpApi.toggle(k),
    onSuccess: () => invalidate(),
    onError: () => invalidate(),
    onSettled: () => setToggleKey(null),
  });

  const openCreate = () => {
    setSheetMode("create");
    setEditing(null);
    setSheetOpen(true);
  };

  const openEdit = (c: MCPClientInfo) => {
    setSheetMode("edit");
    setEditing(c);
    setSheetOpen(true);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background text-base">
      <McpToolbar
        showLeftSidebar={showLeftSidebar}
        onToggleLeftSidebar={toggleLeftSidebar}
        filterQuery={filterQuery}
        onFilterQueryChange={setFilterQuery}
        onCreateClick={openCreate}
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">
          <p className="mb-4 text-sm text-muted-foreground">
            MCP 客户端配置保存在当前活动智能体中; 启用状态表示加载该客户端,
            实时连接状态由运行时决定.
          </p>
          {listQuery.isError && (
            <p className="text-destructive">
              {(listQuery.error as Error).message}
            </p>
          )}
          {listQuery.isLoading && (
            <div className="flex justify-center py-16">
              <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {!listQuery.isLoading &&
            !listQuery.isError &&
            sorted.length === 0 && (
              <p className="py-12 text-center text-muted-foreground">
                暂无 MCP 客户端, 点击「新建客户端」添加.
              </p>
            )}
          {!listQuery.isLoading &&
            sorted.length > 0 &&
            filtered.length === 0 && (
              <p className="py-12 text-center text-muted-foreground">
                无匹配项.
              </p>
            )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => (
              <Card key={c.key} className="shadow-none">
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                  <div className="min-w-0">
                    <h3 className="font-mono text-base font-semibold leading-snug">
                      {c.key}
                    </h3>
                    <p className="text-sm text-muted-foreground">{c.name}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="outline">
                        {transportLabel(c.transport)}
                      </Badge>
                      <Badge variant={c.enabled ? "default" : "secondary"}>
                        {c.enabled ? "配置启用" : "配置关闭"}
                      </Badge>
                    </div>
                  </div>
                  <Switch
                    checked={c.enabled}
                    disabled={toggleMutation.isPending && toggleKey === c.key}
                    onCheckedChange={() => {
                      setToggleKey(c.key);
                      toggleMutation.mutate(c.key);
                    }}
                  />
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {c.description || "—"}
                  </p>
                  <p className="break-all font-mono text-xs text-muted-foreground">
                    {c.transport === "stdio"
                      ? c.command
                        ? `${c.command} ${c.args.join(" ")}`.trim()
                        : "—"
                      : c.url || "—"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-base"
                      onClick={() => openEdit(c)}
                    >
                      <PencilIcon className="size-4" />
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-base text-destructive hover:text-destructive"
                      onClick={() => setDeleteKey(c.key)}
                    >
                      <Trash2Icon className="size-4" />
                      删除
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </ScrollArea>

      <McpClientSheet
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) setEditing(null);
        }}
        mode={sheetMode}
        client={editing}
        isPending={createMutation.isPending || updateMutation.isPending}
        errorMessage={
          (createMutation.error as Error | undefined)?.message ||
          (updateMutation.error as Error | undefined)?.message ||
          null
        }
        onCreate={async (body) => {
          await createMutation.mutateAsync(body);
        }}
        onUpdate={async (key, body) => {
          await updateMutation.mutateAsync({ key, body });
        }}
      />

      <Dialog open={deleteKey != null} onOpenChange={() => setDeleteKey(null)}>
        <DialogContent className="text-base">
          <DialogHeader>
            <DialogTitle>删除 MCP 客户端</DialogTitle>
            <DialogDescription>
              确定删除{" "}
              <span className="font-mono text-foreground">{deleteKey}</span>?
            </DialogDescription>
          </DialogHeader>
          {deleteMutation.isError && (
            <p className="text-destructive">
              {(deleteMutation.error as Error).message}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteKey(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending || !deleteKey}
              onClick={() => deleteKey && deleteMutation.mutate(deleteKey)}
            >
              {deleteMutation.isPending && (
                <Loader2Icon className="animate-spin" />
              )}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
