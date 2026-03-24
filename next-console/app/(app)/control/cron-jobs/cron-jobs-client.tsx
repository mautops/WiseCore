"use client";

import { useCallback, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { CronJobRequest, CronJobSpec } from "@/lib/cron-jobs-api";
import { cronJobsApi } from "@/lib/cron-jobs-api";
import { useAppShell } from "../../app-shell";
import { CronJobsToolbar } from "./cron-jobs-toolbar";
import {
  cloneSpec,
  cronJobDetailKey,
  defaultNewCronJob,
  formatCronIso,
  jobMatchesSearch,
  QK_CRON_JOBS,
  validateCronFields,
} from "./cron-jobs-domain";
import {
  Loader2Icon,
  PauseIcon,
  PlayIcon,
  Trash2Icon,
  ZapIcon,
} from "lucide-react";

function alignAgentRequest(d: CronJobSpec): CronJobSpec {
  if (d.task_type !== "agent" || !d.request) return d;
  const t = d.dispatch.target;
  return {
    ...d,
    request: {
      ...d.request,
      user_id: t.user_id,
      session_id: t.session_id,
    },
  };
}

export function CronJobsClient() {
  const queryClient = useQueryClient();
  const { showLeftSidebar, toggleLeftSidebar } = useAppShell();
  const [filterQuery, setFilterQuery] = useState("");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("edit");
  const [editJobId, setEditJobId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CronJobSpec | null>(null);
  const [requestJson, setRequestJson] = useState("{}");
  const [metaJson, setMetaJson] = useState("{}");
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: QK_CRON_JOBS,
    queryFn: () => cronJobsApi.list(),
  });

  const detailQuery = useQuery({
    queryKey: cronJobDetailKey(editJobId),
    queryFn: () => cronJobsApi.get(editJobId!),
    enabled: Boolean(sheetOpen && sheetMode === "edit" && editJobId),
  });

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: QK_CRON_JOBS });
    if (editJobId) {
      await queryClient.invalidateQueries({
        queryKey: cronJobDetailKey(editJobId),
      });
    }
  }, [queryClient, editJobId]);

  const replaceMutation = useMutation({
    mutationFn: ({ id, spec }: { id: string; spec: CronJobSpec }) =>
      cronJobsApi.replace(id, spec),
    onSuccess: async () => {
      await invalidate();
    },
  });

  const createMutation = useMutation({
    mutationFn: (spec: CronJobSpec) => cronJobsApi.create(spec),
    onSuccess: async () => {
      setSheetOpen(false);
      await queryClient.invalidateQueries({ queryKey: QK_CRON_JOBS });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => cronJobsApi.delete(id),
    onSuccess: async () => {
      setDeleteId(null);
      setSheetOpen(false);
      await queryClient.invalidateQueries({ queryKey: QK_CRON_JOBS });
    },
  });

  const runMutation = useMutation({
    mutationFn: (id: string) => cronJobsApi.run(id),
    onSuccess: async () => {
      await invalidate();
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => cronJobsApi.pause(id),
    onSuccess: async () => {
      await invalidate();
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => cronJobsApi.resume(id),
    onSuccess: async () => {
      await invalidate();
    },
  });

  const openCreate = () => {
    const d = defaultNewCronJob();
    setSheetMode("create");
    setEditJobId(null);
    setDraft(d);
    setRequestJson(JSON.stringify(d.request ?? {}, null, 2));
    setMetaJson(JSON.stringify(d.meta ?? {}, null, 2));
    setFormError(null);
    setSheetOpen(true);
  };

  const openEdit = (job: CronJobSpec) => {
    const d = cloneSpec(job);
    setSheetMode("edit");
    setEditJobId(job.id);
    setDraft(d);
    setRequestJson(JSON.stringify(d.request ?? {}, null, 2));
    setMetaJson(JSON.stringify(d.meta ?? {}, null, 2));
    setFormError(null);
    setSheetOpen(true);
  };

  const patchDraft = useCallback((patch: Partial<CronJobSpec>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const patchSchedule = useCallback(
    (patch: Partial<CronJobSpec["schedule"]>) => {
      setDraft((prev) =>
        prev ? { ...prev, schedule: { ...prev.schedule, ...patch } } : prev,
      );
    },
    [],
  );

  const patchDispatch = useCallback(
    (patch: Partial<CronJobSpec["dispatch"]>) => {
      setDraft((prev) =>
        prev ? { ...prev, dispatch: { ...prev.dispatch, ...patch } } : prev,
      );
    },
    [],
  );

  const patchTarget = useCallback(
    (patch: Partial<CronJobSpec["dispatch"]["target"]>) => {
      setDraft((prev) =>
        prev
          ? {
              ...prev,
              dispatch: {
                ...prev.dispatch,
                target: { ...prev.dispatch.target, ...patch },
              },
            }
          : prev,
      );
    },
    [],
  );

  const patchRuntime = useCallback((patch: Partial<CronJobSpec["runtime"]>) => {
    setDraft((prev) =>
      prev ? { ...prev, runtime: { ...prev.runtime, ...patch } } : prev,
    );
  }, []);

  const buildSpecFromForm = useCallback((): CronJobSpec | null => {
    if (!draft) return null;
    const cronErr = validateCronFields(draft.schedule.cron);
    if (cronErr) {
      setFormError(cronErr);
      return null;
    }
    let meta: Record<string, unknown> = {};
    try {
      meta = metaJson.trim()
        ? (JSON.parse(metaJson) as Record<string, unknown>)
        : {};
    } catch {
      setFormError("meta 须为合法 JSON");
      return null;
    }
    if (draft.task_type === "text") {
      if (!draft.text?.trim()) {
        setFormError("文本任务须填写 text");
        return null;
      }
      const spec: CronJobSpec = {
        ...draft,
        text: draft.text.trim(),
        request: null,
        meta,
      };
      setFormError(null);
      return spec;
    }
    let request: CronJobRequest;
    try {
      request = JSON.parse(requestJson) as CronJobRequest;
    } catch {
      setFormError("request 须为合法 JSON");
      return null;
    }
    if (!request || typeof request !== "object" || !("input" in request)) {
      setFormError("agent 任务 request 须包含 input");
      return null;
    }
    const spec: CronJobSpec = {
      ...draft,
      text: null,
      request,
      meta,
    };
    setFormError(null);
    return alignAgentRequest(spec);
  }, [draft, metaJson, requestJson]);

  const handleSave = async () => {
    const spec = buildSpecFromForm();
    if (!spec) return;
    try {
      if (sheetMode === "create") {
        await createMutation.mutateAsync({ ...spec, id: "" });
        return;
      }
      if (editJobId) {
        await replaceMutation.mutateAsync({
          id: editJobId,
          spec: { ...spec, id: editJobId },
        });
      }
    } catch {
      /* surfaced via mutation isError */
    }
  };

  const toggleEnabled = (job: CronJobSpec, enabled: boolean) => {
    const next = alignAgentRequest({ ...cloneSpec(job), enabled });
    void replaceMutation.mutateAsync({ id: job.id, spec: next });
  };

  const rows = useMemo(() => {
    const list = listQuery.data ?? [];
    return list.filter((j) => jobMatchesSearch(j, filterQuery));
  }, [listQuery.data, filterQuery]);

  const saving = createMutation.isPending || replaceMutation.isPending;
  const state = detailQuery.data?.state;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background text-base">
      <CronJobsToolbar
        showLeftSidebar={showLeftSidebar}
        onToggleLeftSidebar={toggleLeftSidebar}
        filterQuery={filterQuery}
        onFilterQueryChange={setFilterQuery}
        onCreateClick={openCreate}
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground">
            Cron 为 5 段 (分 时 日 月 周). 启用关闭会写入任务配置并重新调度;
            「暂停/恢复」仅作用于调度器任务, 与 enabled 不同.
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

          {replaceMutation.isError ? (
            <Alert variant="destructive">
              <AlertTitle>更新失败</AlertTitle>
              <AlertDescription>
                {replaceMutation.error.message}
              </AlertDescription>
            </Alert>
          ) : null}

          {!listQuery.isLoading && !listQuery.isError && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">暂无任务.</p>
          )}

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-3 py-2 font-medium">名称</th>
                  <th className="px-3 py-2 font-medium">Cron</th>
                  <th className="px-3 py-2 font-medium">时区</th>
                  <th className="px-3 py-2 font-medium">类型</th>
                  <th className="px-3 py-2 font-medium">通道</th>
                  <th className="px-3 py-2 font-medium">启用</th>
                  <th className="px-3 py-2 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((job) => (
                  <tr
                    key={job.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="max-w-[140px] truncate px-3 py-2 font-medium">
                      {job.name}
                    </td>
                    <td
                      className="max-w-[200px] truncate px-3 py-2 font-mono text-xs"
                      title={job.schedule.cron}
                    >
                      {job.schedule.cron}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {job.schedule.timezone}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">{job.task_type}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary">{job.dispatch.channel}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Switch
                        checked={job.enabled}
                        disabled={
                          replaceMutation.isPending &&
                          replaceMutation.variables?.id === job.id
                        }
                        onCheckedChange={(v) => toggleEnabled(job, v)}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-base"
                          onClick={() => openEdit(job)}
                        >
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-base"
                          title="立即执行一次"
                          disabled={
                            runMutation.isPending &&
                            runMutation.variables === job.id
                          }
                          onClick={() => runMutation.mutate(job.id)}
                        >
                          <ZapIcon className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-base"
                          title="暂停调度"
                          disabled={
                            pauseMutation.isPending &&
                            pauseMutation.variables === job.id
                          }
                          onClick={() => pauseMutation.mutate(job.id)}
                        >
                          <PauseIcon className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-base"
                          title="恢复调度"
                          disabled={
                            resumeMutation.isPending &&
                            resumeMutation.variables === job.id
                          }
                          onClick={() => resumeMutation.mutate(job.id)}
                        >
                          <PlayIcon className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive text-base"
                          onClick={() => setDeleteId(job.id)}
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
          if (!o) {
            setEditJobId(null);
            setDraft(null);
            setFormError(null);
          }
        }}
      >
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <SheetHeader className="shrink-0">
            <SheetTitle>
              {sheetMode === "create" ? "新建定时任务" : "编辑定时任务"}
            </SheetTitle>
            {sheetMode === "edit" && editJobId ? (
              <p className="text-left font-mono text-xs text-muted-foreground">
                {editJobId}
              </p>
            ) : null}
          </SheetHeader>

          <ScrollArea className="min-h-0 flex-1 px-4">
            <div className="space-y-4 pb-4">
              {sheetMode === "edit" && detailQuery.isError ? (
                <Alert variant="destructive">
                  <AlertTitle>状态加载失败</AlertTitle>
                  <AlertDescription>
                    {detailQuery.error.message} (表单数据来自列表, 仍可编辑保存)
                  </AlertDescription>
                </Alert>
              ) : null}

              {sheetMode === "edit" && detailQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">加载运行状态...</p>
              ) : null}

              {sheetMode === "edit" && state ? (
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
                  <div className="grid gap-1 sm:grid-cols-2">
                    <div>
                      <span className="text-muted-foreground">下次运行: </span>
                      {formatCronIso(state.next_run_at)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">上次运行: </span>
                      {formatCronIso(state.last_run_at)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">上次状态: </span>
                      {state.last_status ?? "—"}
                    </div>
                    {state.last_error ? (
                      <div className="text-destructive sm:col-span-2">
                        {state.last_error}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {draft ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <div className="text-sm font-medium">名称</div>
                      <Input
                        value={draft.name}
                        onChange={(e) => patchDraft({ name: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={draft.enabled}
                        onCheckedChange={(v) => patchDraft({ enabled: v })}
                      />
                      <span className="text-sm text-muted-foreground">
                        启用 (写入配置)
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-sm font-medium">任务类型</div>
                      <Select
                        value={draft.task_type}
                        onValueChange={(v) =>
                          patchDraft({
                            task_type: v as "text" | "agent",
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="agent">agent</SelectItem>
                          <SelectItem value="text">text</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <div className="text-sm font-medium">Cron (5 段)</div>
                      <Input
                        className="font-mono text-sm"
                        value={draft.schedule.cron}
                        onChange={(e) =>
                          patchSchedule({ cron: e.target.value })
                        }
                        placeholder="0 9 * * *"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <div className="text-sm font-medium">时区</div>
                      <Input
                        value={draft.schedule.timezone}
                        onChange={(e) =>
                          patchSchedule({ timezone: e.target.value })
                        }
                        placeholder="UTC"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <div className="text-sm font-medium">派发通道</div>
                      <Input
                        className="font-mono text-sm"
                        value={draft.dispatch.channel}
                        onChange={(e) =>
                          patchDispatch({ channel: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-sm font-medium">派发模式</div>
                      <Select
                        value={draft.dispatch.mode}
                        onValueChange={(v) =>
                          patchDispatch({
                            mode: v as "stream" | "final",
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="stream">stream</SelectItem>
                          <SelectItem value="final">final</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-sm font-medium">目标 user_id</div>
                      <Input
                        className="font-mono text-sm"
                        value={draft.dispatch.target.user_id}
                        onChange={(e) =>
                          patchTarget({ user_id: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-sm font-medium">目标 session_id</div>
                      <Input
                        className="font-mono text-sm"
                        value={draft.dispatch.target.session_id}
                        onChange={(e) =>
                          patchTarget({ session_id: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <Separator />

                  {draft.task_type === "text" ? (
                    <div className="space-y-1.5">
                      <div className="text-sm font-medium">文本内容 (text)</div>
                      <Textarea
                        rows={4}
                        value={draft.text ?? ""}
                        onChange={(e) => patchDraft({ text: e.target.value })}
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="text-sm font-medium">
                        Agent request (JSON)
                      </div>
                      <p className="text-xs text-muted-foreground">
                        须含 input; 保存时会将 user_id / session_id
                        与上方目标对齐.
                      </p>
                      <Textarea
                        className="min-h-[200px] font-mono text-xs"
                        spellCheck={false}
                        value={requestJson}
                        onChange={(e) => setRequestJson(e.target.value)}
                      />
                    </div>
                  )}

                  <Separator />

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <div className="text-xs font-medium">max_concurrency</div>
                      <Input
                        type="number"
                        min={1}
                        value={draft.runtime.max_concurrency}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10);
                          if (!Number.isNaN(n)) {
                            patchRuntime({ max_concurrency: n });
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-xs font-medium">timeout_seconds</div>
                      <Input
                        type="number"
                        min={1}
                        value={draft.runtime.timeout_seconds}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10);
                          if (!Number.isNaN(n)) {
                            patchRuntime({ timeout_seconds: n });
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-xs font-medium">
                        misfire_grace_seconds
                      </div>
                      <Input
                        type="number"
                        min={0}
                        value={draft.runtime.misfire_grace_seconds}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10);
                          if (!Number.isNaN(n)) {
                            patchRuntime({ misfire_grace_seconds: n });
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-sm font-medium">meta (JSON)</div>
                    <Textarea
                      className="min-h-[80px] font-mono text-xs"
                      spellCheck={false}
                      value={metaJson}
                      onChange={(e) => setMetaJson(e.target.value)}
                    />
                  </div>
                </>
              ) : null}

              {formError ? (
                <Alert variant="destructive">
                  <AlertTitle>校验</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : null}

              {createMutation.isError ? (
                <Alert variant="destructive">
                  <AlertTitle>创建失败</AlertTitle>
                  <AlertDescription>
                    {createMutation.error.message}
                  </AlertDescription>
                </Alert>
              ) : null}

              {replaceMutation.isError ? (
                <Alert variant="destructive">
                  <AlertTitle>保存失败</AlertTitle>
                  <AlertDescription>
                    {replaceMutation.error.message}
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
          </ScrollArea>

          <SheetFooter className="border-t border-border px-4">
            <div className="flex w-full flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setSheetOpen(false)}
                className="text-base"
              >
                取消
              </Button>
              <Button
                onClick={() => void handleSave()}
                disabled={saving || !draft}
                className="inline-flex gap-2 text-base"
              >
                {saving ? (
                  <Loader2Icon className="size-4 shrink-0 animate-spin" />
                ) : null}
                {sheetMode === "create" ? "创建" : "保存"}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={deleteId != null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="text-base">
          <DialogHeader>
            <DialogTitle>删除任务</DialogTitle>
            <DialogDescription>
              将永久删除{" "}
              <span className="font-mono text-foreground">{deleteId}</span>.
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
