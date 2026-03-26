"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo, useCallback } from "react";
import {
  useQuery,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  formatWorkflowTimestamp,
  workflowApi,
  type WorkflowDetailBody,
  type WorkflowInfo,
} from "@/lib/workflow-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Loader2Icon,
  Trash2Icon,
  SaveIcon,
  RotateCcwIcon,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  formatSize,
  qkWorkflowRuns,
  workflowFixedMetaLine,
  workflowTags,
} from "./workflow-domain";
import {
  type WorkflowData,
  DEFAULT_WORKFLOW_DATA,
  parseWorkflowYaml,
  buildWorkflowYaml,
  WorkflowMetadataEditor,
  WorkflowStepsEditor,
  WorkflowStepsViewer,
} from "@/components/workflow";

function WorkflowEditorPanel({
  serverRaw,
  selectedFilename,
  detailOk,
  updateMutation,
}: {
  serverRaw: string;
  selectedFilename: string | null;
  detailOk: boolean;
  updateMutation: UseMutationResult<
    unknown,
    Error,
    { filename: string; content: string }
  >;
}) {
  // 从 serverRaw 派生初始数据
  const initialData = useMemo(
    () => parseWorkflowYaml(serverRaw),
    [serverRaw]
  );

  // 用户编辑的数据
  const [data, setData] = useState<WorkflowData>(initialData);
  const [dirty, setDirty] = useState(false);

  // 当 serverRaw 变化时重置编辑状态（由父组件 key 触发重新挂载）
  // 这里使用 useMemo 派生初始值，避免在 effect 中调用 setState

  const handleDataChange = useCallback((newData: WorkflowData) => {
    setData(newData);
    setDirty(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedFilename || !detailOk) return;
    const yaml = buildWorkflowYaml(data);
    updateMutation.mutate(
      { filename: selectedFilename, content: yaml },
      { onSuccess: () => setDirty(false) }
    );
  }, [data, selectedFilename, detailOk, updateMutation]);

  const handleReset = useCallback(() => {
    setData(initialData);
    setDirty(false);
  }, [initialData]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      {/* 工具栏 */}
      {dirty && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-3 py-2">
          <span className="text-muted-foreground text-sm">有未保存的修改</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={updateMutation.isPending}
            >
              <RotateCcwIcon className="size-4" />
              重置
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!selectedFilename || updateMutation.isPending || !detailOk}
            >
              {updateMutation.isPending ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <SaveIcon className="size-4" />
              )}
              保存
            </Button>
          </div>
        </div>
      )}

      {updateMutation.isError && (
        <p className="text-destructive text-sm">
          {(updateMutation.error as Error).message}
        </p>
      )}

      {/* 编辑区域 */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-4 pr-4">
          <WorkflowMetadataEditor data={data} onChange={handleDataChange} />
          <WorkflowStepsEditor
            steps={data.steps}
            onChange={(steps) => handleDataChange({ ...data, steps })}
          />
        </div>
      </ScrollArea>
    </div>
  );
}

function WorkflowPreviewPanel({
  data,
  raw,
}: {
  data: WorkflowData;
  raw: string;
}) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="grid gap-4 pr-4">
        {/* 基本信息 */}
        <div className="grid gap-3 rounded-lg border p-3">
          <h3 className="font-medium">基本信息</h3>
          <div className="grid gap-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">名称：</span>
              <span className="font-medium">{data.name || "未命名工作流"}</span>
            </div>
            {data.description && (
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground shrink-0">描述：</span>
                <span>{data.description}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-4">
              {data.catalog && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">目录：</span>
                  <Badge variant="secondary">{data.catalog}</Badge>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">版本：</span>
                <span>{data.version || "1.0"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">状态：</span>
                <Badge
                  variant={
                    data.status === "active"
                      ? "default"
                      : data.status === "deprecated"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {data.status === "active"
                    ? "启用"
                    : data.status === "deprecated"
                      ? "已废弃"
                      : "草稿"}
                </Badge>
              </div>
            </div>
            {data.tags.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground shrink-0">标签：</span>
                <div className="flex flex-wrap gap-1">
                  {data.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 执行步骤 */}
        <div className="grid gap-2">
          <h3 className="font-medium">执行步骤</h3>
          <WorkflowStepsViewer steps={data.steps} />
        </div>

        {/* YAML 源码 */}
        <details className="group">
          <summary className="cursor-pointer text-muted-foreground text-sm hover:text-foreground">
            查看 YAML 源码
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">
            {raw}
          </pre>
        </details>
      </div>
    </ScrollArea>
  );
}

export function WorkflowDetailSheet({
  open,
  onOpenChange,
  selectedFilename,
  selectedMeta,
  detailQuery,
  updateMutation,
  onRequestDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFilename: string | null;
  selectedMeta: WorkflowInfo | undefined;
  detailQuery: UseQueryResult<WorkflowDetailBody, Error>;
  updateMutation: UseMutationResult<
    unknown,
    Error,
    { filename: string; content: string }
  >;
  onRequestDelete: () => void;
}) {
  const router = useRouter();
  const serverRaw = detailQuery.data?.raw ?? "";

  // 解析 YAML 数据用于预览
  const workflowData = parseWorkflowYaml(serverRaw);

  const runsQuery = useQuery({
    queryKey: selectedFilename
      ? qkWorkflowRuns(selectedFilename)
      : ["core", "workflow", "__none__", "runs"],
    queryFn: () => workflowApi.listRuns(selectedFilename!).then((r) => r.runs),
    enabled: Boolean(open && selectedFilename),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="max-w-full text-base sm:max-w-2xl"
        showCloseButton
      >
        <SheetHeader className="gap-2">
          <SheetDescription className="sr-only">
            工作流预览与编辑
          </SheetDescription>
          <div className="flex min-w-0 items-start justify-between gap-2 pr-8">
            <div className="min-w-0 flex-1">
              <SheetTitle className="font-mono leading-snug">
                {selectedFilename ?? ""}
              </SheetTitle>
              {selectedMeta ? (
                <div className="space-y-1.5 text-base text-muted-foreground">
                  {selectedMeta.name?.trim() ? (
                    <p className="font-medium text-foreground">
                      {selectedMeta.name.trim()}
                    </p>
                  ) : null}
                  {selectedMeta.description?.trim() ? (
                    <p>{selectedMeta.description.trim()}</p>
                  ) : null}
                  {workflowFixedMetaLine(selectedMeta).length > 0 ? (
                    <p>{workflowFixedMetaLine(selectedMeta).join(" · ")}</p>
                  ) : null}
                  {workflowTags(selectedMeta).length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {workflowTags(selectedMeta).map((t) => (
                        <Badge
                          key={t}
                          variant="secondary"
                          className="font-normal"
                        >
                          {t}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  <p>
                    {formatSize(selectedMeta.size)} · 更新{" "}
                    {formatWorkflowTimestamp(selectedMeta.modified_time)}
                  </p>
                </div>
              ) : null}
            </div>
            <Button
              variant="destructive"
              className="shrink-0 text-base"
              disabled={!selectedFilename}
              onClick={onRequestDelete}
            >
              <Trash2Icon />
              删除
            </Button>
          </div>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4">
          {detailQuery.isLoading && (
            <div className="flex flex-1 items-center justify-center py-16">
              <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {detailQuery.isError && (
            <p className="text-destructive">
              {(detailQuery.error as Error).message}
            </p>
          )}
          {detailQuery.isSuccess && detailQuery.data && (
            <Tabs
              defaultValue="preview"
              className="flex min-h-0 flex-1 flex-col gap-3"
            >
              <TabsList
                variant="line"
                className="grid h-auto min-h-8 w-full shrink-0 grid-cols-3 gap-0"
              >
                <TabsTrigger value="preview" className="min-w-0">
                  预览
                </TabsTrigger>
                <TabsTrigger value="edit" className="min-w-0">
                  编辑
                </TabsTrigger>
                <TabsTrigger value="runs" className="min-w-0">
                  执行记录
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value="preview"
                className="min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
              >
                <WorkflowPreviewPanel data={workflowData} raw={serverRaw} />
              </TabsContent>
              <TabsContent
                value="edit"
                className="flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
              >
                <WorkflowEditorPanel
                  key={`${selectedFilename ?? ""}-${detailQuery.dataUpdatedAt}`}
                  serverRaw={serverRaw}
                  selectedFilename={selectedFilename}
                  detailOk={detailQuery.isSuccess}
                  updateMutation={updateMutation}
                />
              </TabsContent>
              <TabsContent
                value="runs"
                className="flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
              >
                {runsQuery.isLoading ? (
                  <div className="flex flex-1 items-center justify-center py-12">
                    <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
                  </div>
                ) : runsQuery.isError ? (
                  <p className="text-destructive">
                    {(runsQuery.error as Error).message}
                  </p>
                ) : runsQuery.data?.length === 0 ? (
                  <p className="py-8 text-center text-muted-foreground">
                    暂无执行记录, 在列表卡片点击「执行」后会在此留痕
                  </p>
                ) : (
                  <ScrollArea className="max-h-[min(70vh,32rem)] rounded-lg border border-border">
                    <ul className="divide-y divide-border p-1">
                      {runsQuery.data?.map((run) => (
                        <li
                          key={run.run_id}
                          role={run.session_id ? "button" : undefined}
                          tabIndex={run.session_id ? 0 : undefined}
                          onClick={
                            run.session_id
                              ? () => {
                                  onOpenChange(false);
                                  router.push(
                                    `/agent/chat?openSession=${encodeURIComponent(run.session_id)}`,
                                  );
                                }
                              : undefined
                          }
                          onKeyDown={
                            run.session_id
                              ? (e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    onOpenChange(false);
                                    router.push(
                                      `/agent/chat?openSession=${encodeURIComponent(run.session_id)}`,
                                    );
                                  }
                                }
                              : undefined
                          }
                          className={cn(
                            "space-y-1 px-3 py-2.5 text-base outline-none",
                            run.session_id
                              ? "cursor-pointer rounded-md transition-colors hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring"
                              : "cursor-default opacity-80",
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium tabular-nums text-foreground">
                              {formatWorkflowTimestamp(run.executed_at)}
                            </span>
                            {run.status?.trim() ? (
                              <Badge variant="outline" className="font-normal">
                                {run.status.trim()}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground/80">
                              {run.trigger}
                            </span>
                            {run.user_id ? (
                              <>
                                {" "}
                                · 用户{" "}
                                <span className="font-mono">{run.user_id}</span>
                              </>
                            ) : null}
                          </p>
                          {run.session_id ? (
                            <p
                              className="font-mono text-xs text-muted-foreground"
                              title={run.session_id}
                            >
                              session: {run.session_id}
                            </p>
                          ) : null}
                          <p className="font-mono text-xs text-muted-foreground">
                            {run.run_id}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}