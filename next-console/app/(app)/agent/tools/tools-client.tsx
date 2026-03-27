"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConsoleMirrorScrollPadding } from "@/components/console-mirror";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toolsApi, type ToolInfo } from "@/lib/tools-api";
import { cn } from "@/lib/utils";
import { useAppShell } from "../../app-shell";
import { ToolCard } from "./tool-card";
import { matchesToolFilter, QK_TOOLS } from "./tools-domain";
import { ToolsToolbar } from "./tools-toolbar";
import { Loader2Icon, WrenchIcon } from "lucide-react";

export function ToolsClient() {
  const queryClient = useQueryClient();
  const { showLeftSidebar, toggleLeftSidebar } = useAppShell();
  const [filterQuery, setFilterQuery] = useState("");
  const [toggleName, setToggleName] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: QK_TOOLS,
    queryFn: () => toolsApi.list(),
  });

  const tools = listQuery.data ?? [];
  const sorted = useMemo(
    () => [...tools].sort((a, b) => a.name.localeCompare(b.name)),
    [tools],
  );

  const filtered = useMemo(
    () => sorted.filter((t) => matchesToolFilter(t, filterQuery)),
    [sorted, filterQuery],
  );

  const enabledCount = sorted.filter((t) => t.enabled).length;
  const totalCount = sorted.length;

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: QK_TOOLS });
  }, [queryClient]);

  const toggleMutation = useMutation({
    mutationFn: (name: string) => toolsApi.toggle(name),
    onSuccess: () => invalidate(),
    onError: () => invalidate(),
    onSettled: () => setToggleName(null),
  });

  const batchMutation = useMutation({
    mutationFn: async (mode: "enable" | "disable") => {
      const current = await toolsApi.list();
      const targets =
        mode === "enable"
          ? current.filter((t) => !t.enabled)
          : current.filter((t) => t.enabled);
      await Promise.all(targets.map((t) => toolsApi.toggle(t.name)));
    },
    onSuccess: () => invalidate(),
    onError: () => invalidate(),
  });

  const handleToggle = (tool: ToolInfo) => {
    setToggleName(tool.name);
    toggleMutation.mutate(tool.name);
  };

  const batchBusy = batchMutation.isPending || listQuery.isLoading;
  const allEnabled = totalCount > 0 && enabledCount === totalCount;
  const allDisabled = enabledCount === 0;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background text-base">
      <ToolsToolbar
        showLeftSidebar={showLeftSidebar}
        onToggleLeftSidebar={toggleLeftSidebar}
        filterQuery={filterQuery}
        onFilterQueryChange={setFilterQuery}
      />

      <ScrollArea className="min-h-0 flex-1">
        <ConsoleMirrorScrollPadding className="space-y-4">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="mb-1 text-2xl font-semibold tracking-tight text-foreground">
                内置工具
              </h1>
              <p className="m-0 text-sm leading-relaxed text-muted-foreground">
                内置工具开关由当前活动智能体配置保存. 工具调用拦截与文件防护见{" "}
                <Link
                  href="/settings/security"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  安全
                </Link>{" "}
                页.
              </p>
              {totalCount > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  已启用 {enabledCount}/{totalCount} 个工具
                </p>
              )}
            </div>
            <div
              className="flex shrink-0 gap-1 self-center rounded-lg bg-muted/60 p-1"
              role="group"
              aria-label="批量开关"
            >
              <button
                type="button"
                disabled={batchBusy || allEnabled}
                onClick={() => batchMutation.mutate("enable")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border-none px-3.5 py-1.5 text-sm font-medium transition-all",
                  allEnabled
                    ? "cursor-not-allowed bg-primary text-primary-foreground shadow-sm"
                    : batchBusy
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-pointer bg-transparent text-muted-foreground hover:bg-background hover:text-foreground hover:shadow-sm active:scale-95",
                )}
              >
                {batchMutation.isPending && batchMutation.variables === "enable" && (
                  <Loader2Icon className="size-3.5 animate-spin" />
                )}
                全部启用
              </button>
              <button
                type="button"
                disabled={batchBusy || allDisabled}
                onClick={() => batchMutation.mutate("disable")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border-none px-3.5 py-1.5 text-sm font-medium transition-all",
                  allDisabled
                    ? "cursor-not-allowed bg-primary text-primary-foreground shadow-sm"
                    : batchBusy
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-pointer bg-transparent text-muted-foreground hover:bg-background hover:text-foreground hover:shadow-sm active:scale-95",
                )}
              >
                {batchMutation.isPending && batchMutation.variables === "disable" && (
                  <Loader2Icon className="size-3.5 animate-spin" />
                )}
                全部关闭
              </button>
            </div>
          </div>

          {listQuery.isError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {(listQuery.error as Error).message}
            </div>
          )}
          {listQuery.isLoading && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2Icon className="mb-3 size-8 animate-spin" />
              <p className="m-0 text-sm">加载中...</p>
            </div>
          )}
          {!listQuery.isLoading &&
            !listQuery.isError &&
            sorted.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <WrenchIcon className="mb-3 size-10 opacity-40" />
                <p className="m-0 text-sm">暂无内置工具配置, 请检查服务端 agent 配置.</p>
              </div>
            )}
          {!listQuery.isLoading &&
            sorted.length > 0 &&
            filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <WrenchIcon className="mb-3 size-10 opacity-40" />
                <p className="m-0 text-sm">无匹配项, 调整搜索条件.</p>
              </div>
            )}
          {!listQuery.isLoading &&
            !listQuery.isError &&
            filtered.length > 0 && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-5">
                {filtered.map((tool) => (
                  <ToolCard
                    key={tool.name}
                    tool={tool}
                    toggling={
                      toggleMutation.isPending && toggleName === tool.name
                    }
                    onToggle={() => handleToggle(tool)}
                  />
                ))}
              </div>
            )}
        </ConsoleMirrorScrollPadding>
      </ScrollArea>
    </div>
  );
}
