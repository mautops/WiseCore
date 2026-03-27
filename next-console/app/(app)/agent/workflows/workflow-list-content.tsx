"use client";

import {
  ConsoleMirrorScrollPadding,
  ConsoleMirrorSectionHeader,
} from "@/components/console-mirror";
import type { UseQueryResult } from "@tanstack/react-query";
import type { WorkflowInfo } from "@/lib/workflow-api";
import { Loader2Icon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkflowListCard } from "./workflow-list-card";
import { PAGE_SIZE, workflowsForCatalogTab } from "./workflow-domain";

export function WorkflowListContent({
  listQuery,
  sorted,
  filtered,
  tabValue,
  onTabChange,
  workflowCatalogTabValues,
  tabCounts,
  page,
  modifierKeyPrefix,
  onOpenWorkflow,
  onExecuteWorkflow,
}: {
  listQuery: Pick<
    UseQueryResult<WorkflowInfo[], Error>,
    "isLoading" | "isError" | "error"
  >;
  sorted: WorkflowInfo[];
  filtered: WorkflowInfo[];
  tabValue: string;
  onTabChange: (tab: string) => void;
  workflowCatalogTabValues: string[];
  tabCounts: Record<string, number>;
  page: number;
  modifierKeyPrefix: string;
  onOpenWorkflow: (w: WorkflowInfo) => void;
  onExecuteWorkflow?: (w: WorkflowInfo) => void | Promise<void>;
}) {
  return (
    <ConsoleMirrorScrollPadding className="space-y-4">
      <ConsoleMirrorSectionHeader
        title="Workflows"
        description="管理 Markdown workflow, 支持搜索, 分类标签与执行."
      />
      {listQuery.isError && (
        <p className="text-destructive">{(listQuery.error as Error).message}</p>
      )}
      {listQuery.isLoading && (
        <div className="flex justify-center py-16">
          <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}
      {!listQuery.isLoading && sorted.length === 0 && !listQuery.isError && (
        <p className="py-12 text-center text-muted-foreground">
          暂无 workflow, 点击新建添加 Markdown 文件
        </p>
      )}
      {!listQuery.isLoading && sorted.length > 0 && !listQuery.isError && (
        <Tabs value={tabValue} onValueChange={onTabChange} className="gap-0">
          <TabsList
            variant="line"
            className="mb-4 h-auto min-h-9 w-full flex-wrap justify-start gap-1 py-1"
          >
            {workflowCatalogTabValues.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="text-base">
                {tab === "all" ? "全部" : tab}
                <span className="tabular-nums text-muted-foreground">
                  {" "}
                  ({tabCounts[tab] ?? 0})
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          {workflowCatalogTabValues.map((tab) => {
            const items = workflowsForCatalogTab(filtered, tab);
            const tp = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
            const ep = tab === tabValue ? Math.min(Math.max(1, page), tp) : 1;
            const slice = items.slice(
              (ep - 1) * PAGE_SIZE,
              (ep - 1) * PAGE_SIZE + PAGE_SIZE,
            );
            return (
              <TabsContent key={tab} value={tab} className="mt-0 outline-none">
                {filtered.length === 0 ? (
                  <p className="py-10 text-center text-muted-foreground">
                    没有符合当前过滤条件的 workflow, 按 {modifierKeyPrefix}K
                    调整关键字
                  </p>
                ) : items.length === 0 ? (
                  <p className="py-10 text-center text-muted-foreground">
                    当前目录下暂无文档, 请切换其他分类
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {slice.map((w) => (
                      <WorkflowListCard
                        key={w.filename}
                        w={w}
                        onOpen={onOpenWorkflow}
                        onExecute={onExecuteWorkflow}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </ConsoleMirrorScrollPadding>
  );
}
