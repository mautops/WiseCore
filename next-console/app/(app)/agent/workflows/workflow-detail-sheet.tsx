"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageResponse } from "@/components/ai-elements/message";
import { cn } from "@/lib/utils";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  formatSize,
  qkWorkflowRuns,
  workflowFixedMetaLine,
  workflowTags,
} from "./workflow-domain";

function WorkflowSourceEditor({
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
  const [draft, setDraft] = useState(serverRaw);
  const dirty = draft !== serverRaw;
  return (
    <div className="relative flex min-h-[min(70vh,32rem)] flex-1 flex-col rounded-lg border border-border bg-muted/20">
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
        className={cn(
          "min-h-0 flex-1 resize-none rounded-lg border-0 bg-transparent px-3 py-2.5 font-mono text-sm leading-relaxed shadow-none focus-visible:ring-0 dark:bg-transparent",
          dirty && "pb-11 pr-26",
        )}
        placeholder="Markdown 源码"
      />
      {dirty && updateMutation.isError ? (
        <p
          className="pointer-events-none absolute bottom-2 left-3 max-w-[calc(100%-7rem)] truncate text-xs text-destructive"
          title={(updateMutation.error as Error).message}
        >
          {(updateMutation.error as Error).message}
        </p>
      ) : null}
      {dirty ? (
        <Button
          type="button"
          className="absolute right-2 bottom-2 text-base shadow-sm"
          disabled={!selectedFilename || updateMutation.isPending || !detailOk}
          onClick={() =>
            selectedFilename &&
            updateMutation.mutate({
              filename: selectedFilename,
              content: draft,
            })
          }
        >
          {updateMutation.isPending && <Loader2Icon className="animate-spin" />}
          保存
        </Button>
      ) : null}
    </div>
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
  const sourceSyncKey = `${selectedFilename ?? ""}-${detailQuery.dataUpdatedAt}`;
  const serverRaw = detailQuery.data?.raw ?? "";

  const runsQuery = useQuery({
    queryKey: selectedFilename
      ? qkWorkflowRuns(selectedFilename)
      : ["copaw", "workflow", "__none__", "runs"],
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
            工作流 Markdown 预览与源码, 可删除当前文件
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
                <TabsTrigger value="source" className="min-w-0">
                  源码
                </TabsTrigger>
                <TabsTrigger value="runs" className="min-w-0">
                  执行记录
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value="preview"
                className="min-h-0 flex-1 overflow-y-auto pr-1 data-[state=inactive]:hidden"
              >
                <MessageResponse>{detailQuery.data.content}</MessageResponse>
              </TabsContent>
              <TabsContent
                value="source"
                className="flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
              >
                <WorkflowSourceEditor
                  key={sourceSyncKey}
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
