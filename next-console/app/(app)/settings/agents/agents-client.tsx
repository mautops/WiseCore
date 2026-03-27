"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  consolePrimaryButtonClass,
  ConsoleMirrorPanel,
  ConsoleMirrorScrollPadding,
} from "@/components/console-mirror";
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
import { Textarea } from "@/components/ui/textarea";
import type { AgentSummary } from "@/lib/agents-registry-api";
import { agentsRegistryApi } from "@/lib/agents-registry-api";
import { useAppShell } from "../../app-shell";
import { AgentsToolbar } from "./agents-toolbar";
import {
  agentDetailKey,
  agentMatchesFilter,
  QK_AGENTS_LIST,
} from "./agents-domain";
import { BotIcon, EyeIcon, EyeOffIcon, Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";

const PAGE_SIZE = 10;

function pickBasics(raw: Record<string, unknown>): {
  name: string;
  description: string;
  language: string;
} {
  return {
    name: typeof raw.name === "string" ? raw.name : "",
    description: typeof raw.description === "string" ? raw.description : "",
    language: typeof raw.language === "string" ? raw.language : "zh",
  };
}

export function AgentsSettingsClient() {
  const queryClient = useQueryClient();
  const { showLeftSidebar, toggleLeftSidebar } = useAppShell();
  const [filterQuery, setFilterQuery] = useState("");
  const [listPage, setListPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [cName, setCName] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [cLang, setCLang] = useState("zh");
  const [cWs, setCWs] = useState("");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eLang, setELang] = useState("zh");
  const detailHydratedRef = useRef<string | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: QK_AGENTS_LIST,
    queryFn: async () => {
      const r = await agentsRegistryApi.list();
      return r.agents;
    },
  });

  const detailQuery = useQuery({
    queryKey: agentDetailKey(editId),
    queryFn: () =>
      agentsRegistryApi.get(editId!) as Promise<Record<string, unknown>>,
    enabled: Boolean(sheetOpen && editId),
  });

  useEffect(() => {
    if (!sheetOpen || !editId) {
      detailHydratedRef.current = null;
      return;
    }
    const d = detailQuery.data;
    if (!d || typeof d.id !== "string" || d.id !== editId) return;
    if (
      detailHydratedRef.current === `${editId}:${detailQuery.dataUpdatedAt}`
    ) {
      return;
    }
    const b = pickBasics(d);
    setEName(b.name);
    setEDesc(b.description);
    setELang(b.language);
    detailHydratedRef.current = `${editId}:${detailQuery.dataUpdatedAt}`;
  }, [sheetOpen, editId, detailQuery.data, detailQuery.dataUpdatedAt]);

  const invalidateList = () =>
    void queryClient.invalidateQueries({ queryKey: QK_AGENTS_LIST });

  const createMutation = useMutation({
    mutationFn: () =>
      agentsRegistryApi.create({
        name: cName.trim(),
        description: cDesc.trim(),
        language: cLang,
        workspace_dir: cWs.trim() || undefined,
      }),
    onSuccess: async () => {
      setCreateOpen(false);
      setCName("");
      setCDesc("");
      setCLang("zh");
      setCWs("");
      await invalidateList();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (vars: {
      id: string;
      name: string;
      description: string;
      language: string;
    }) =>
      agentsRegistryApi.update(vars.id, {
        id: vars.id,
        name: vars.name,
        description: vars.description,
        language: vars.language,
      }),
    onSuccess: async (_d, vars) => {
      setSheetOpen(false);
      setEditId(null);
      await invalidateList();
      await queryClient.invalidateQueries({
        queryKey: agentDetailKey(vars.id),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => agentsRegistryApi.delete(id),
    onSuccess: async () => {
      setDeleteId(null);
      await invalidateList();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (vars: { id: string; enabled: boolean }) =>
      agentsRegistryApi.toggle(vars.id, vars.enabled),
    onSuccess: async () => {
      await invalidateList();
    },
  });

  const rows = useMemo(() => {
    const list = listQuery.data ?? [];
    return list.filter((a) => agentMatchesFilter(a, filterQuery));
  }, [listQuery.data, filterQuery]);

  useEffect(() => {
    setListPage(1);
  }, [filterQuery]);

  useEffect(() => {
    const tp = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    setListPage((p) => Math.min(p, tp));
  }, [rows.length]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(listPage, totalPages);
  const pagedRows = rows.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const openEdit = (row: AgentSummary) => {
    detailHydratedRef.current = null;
    setEditId(row.id);
    setEName(row.name);
    setEDesc(row.description);
    setELang("zh");
    setSheetOpen(true);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background text-base">
      <AgentsToolbar
        showLeftSidebar={showLeftSidebar}
        onToggleLeftSidebar={toggleLeftSidebar}
        filterQuery={filterQuery}
        onFilterQueryChange={setFilterQuery}
      />

      <ScrollArea className="min-h-0 flex-1">
        <ConsoleMirrorScrollPadding className="space-y-4">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="mb-1 text-2xl font-semibold tracking-tight text-foreground">
                智能体注册
              </h1>
              <p className="m-0 text-sm text-muted-foreground">
                此处管理根配置中的智能体注册表.
                控制台当前会话使用哪一智能体由网关 / JWT / 请求头决定,
                与下表无直接绑定.
              </p>
            </div>
            <Button
              className="shrink-0 gap-2 bg-primary px-5 text-sm font-medium shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md active:scale-95"
              onClick={() => {
                setCName("");
                setCDesc("");
                setCLang("zh");
                setCWs("");
                setCreateOpen(true);
              }}
            >
              <PlusIcon className="size-4" />
              新建智能体
            </Button>
          </div>

          {listQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>加载失败</AlertTitle>
              <AlertDescription>{listQuery.error.message}</AlertDescription>
            </Alert>
          ) : null}

          {listQuery.isLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              <Loader2Icon className="mx-auto mb-3 size-8 animate-spin" />
              <p className="m-0">加载中</p>
            </div>
          ) : null}

          {!listQuery.isLoading &&
            !listQuery.isError &&
            (listQuery.data?.length ?? 0) === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                暂无智能体, 点击「新建智能体」添加.
              </p>
            )}

          {!listQuery.isLoading &&
            !listQuery.isError &&
            (listQuery.data?.length ?? 0) > 0 &&
            rows.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                无匹配项, 调整筛选条件.
              </p>
            )}

          {!listQuery.isLoading && !listQuery.isError && rows.length > 0 && (
            <ConsoleMirrorPanel className="mb-0 overflow-hidden rounded-lg border border-border/50 p-0 shadow-sm transition-all duration-200 hover:border-border hover:shadow-md">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="border-b border-border/50 bg-muted/30">
                    <tr>
                      <th className="px-4 py-3 text-sm font-semibold text-foreground">
                        名称
                      </th>
                      <th className="px-4 py-3 text-sm font-semibold text-foreground">
                        ID
                      </th>
                      <th className="px-4 py-3 text-sm font-semibold text-foreground">
                        描述
                      </th>
                      <th className="px-4 py-3 text-sm font-semibold text-foreground">
                        工作区
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((row, rowIndex) => (
                      <tr
                        key={`${row.id}:${rowIndex}`}
                        className={`group border-b border-border/50 last:border-0 transition-colors duration-150 hover:bg-accent/50 ${!row.enabled ? "opacity-50" : ""}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <BotIcon
                              className="size-4 shrink-0 text-primary"
                              aria-hidden
                            />
                            <span className="truncate font-medium text-foreground">
                              {row.name}
                            </span>
                            {row.is_builtin ? (
                              <Badge
                                variant="secondary"
                                className="shrink-0 border border-border/50 bg-secondary/50 text-xs font-medium"
                              >
                                内置 QA
                              </Badge>
                            ) : null}
                            {!row.enabled ? (
                              <Badge
                                variant="outline"
                                className="shrink-0 border-slate-400/50 bg-slate-100 text-xs font-medium text-slate-600 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-slate-400"
                              >
                                已禁用
                              </Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">
                          {row.id}
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-3 text-muted-foreground">
                          {row.description || "—"}
                        </td>
                        <td
                          className="max-w-[240px] truncate px-4 py-3 font-mono text-xs text-muted-foreground"
                          title={row.workspace_dir}
                        >
                          {row.workspace_dir}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={row.id === "default"}
                              title={
                                row.id === "default"
                                  ? "不能编辑 default"
                                  : undefined
                              }
                              className="h-8 px-3 text-sm font-medium text-primary transition-all duration-150 hover:bg-primary/10 active:scale-95 disabled:opacity-50"
                              onClick={() => openEdit(row)}
                            >
                              编辑
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={row.id === "default" || toggleMutation.isPending}
                              title={
                                row.id === "default"
                                  ? "不能禁用 default"
                                  : undefined
                              }
                              className="h-8 gap-1.5 px-3 text-sm font-medium text-muted-foreground transition-all duration-150 hover:bg-muted active:scale-95 disabled:opacity-50"
                              onClick={() =>
                                toggleMutation.mutate({
                                  id: row.id,
                                  enabled: !row.enabled,
                                })
                              }
                            >
                              {row.enabled ? (
                                <EyeOffIcon className="size-3.5" />
                              ) : (
                                <EyeIcon className="size-3.5" />
                              )}
                              {row.enabled ? "禁用" : "启用"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={
                                row.id === "default" || Boolean(row.is_builtin)
                              }
                              title={
                                row.id === "default"
                                  ? "不能删除 default"
                                  : row.is_builtin
                                    ? "不能删除内置 QA 智能体"
                                    : undefined
                              }
                              className="h-8 gap-1.5 px-3 text-sm font-medium text-destructive transition-all duration-150 hover:bg-destructive/10 active:scale-95 disabled:opacity-50"
                              onClick={() => setDeleteId(row.id)}
                            >
                              <Trash2Icon className="size-3.5" />
                              删除
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 ? (
                <div className="flex items-center justify-end gap-2 border-t border-border/50 px-4 py-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-sm shadow-sm transition-all duration-150 hover:shadow active:scale-95"
                    disabled={safePage <= 1}
                    onClick={() => setListPage((p) => Math.max(1, p - 1))}
                  >
                    上一页
                  </Button>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {safePage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-sm shadow-sm transition-all duration-150 hover:shadow active:scale-95"
                    disabled={safePage >= totalPages}
                    onClick={() =>
                      setListPage((p) => Math.min(totalPages, p + 1))
                    }
                  >
                    下一页
                  </Button>
                </div>
              ) : null}
            </ConsoleMirrorPanel>
          )}
        </ConsoleMirrorScrollPadding>
      </ScrollArea>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="text-base sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">
              新建智能体
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              服务端生成短 ID; 工作区目录留空则使用默认路径.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="名称 *"
            value={cName}
            onChange={(e) => setCName(e.target.value)}
            className="h-10 rounded-lg text-base"
          />
          <Textarea
            placeholder="描述"
            rows={3}
            value={cDesc}
            onChange={(e) => setCDesc(e.target.value)}
            className="rounded-lg border-border/60 text-base focus:border-primary/50"
          />
          <div className="space-y-1.5">
            <div className="text-sm font-medium">语言</div>
            <Select value={cLang} onValueChange={setCLang}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh">zh</SelectItem>
                <SelectItem value="en">en</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input
            placeholder="工作区目录 (可选)"
            className="h-10 rounded-lg font-mono text-sm"
            value={cWs}
            onChange={(e) => setCWs(e.target.value)}
          />
          {createMutation.isError ? (
            <p className="text-destructive">
              {(createMutation.error as Error).message}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              disabled={createMutation.isPending || !cName.trim()}
              className="gap-2 bg-primary font-medium shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md active:scale-95"
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? (
                <Loader2Icon className="size-4 shrink-0 animate-spin" />
              ) : null}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) setEditId(null);
        }}
      >
        <SheetContent
          aria-describedby={undefined}
          className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[600px]"
        >
          <SheetHeader className="shrink-0 border-b border-border/50 px-6 py-4">
            <SheetTitle className="text-lg font-semibold text-foreground">
              {editId ? `编辑: ${editId}` : "编辑"}
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="min-h-0 flex-1 px-6">
            <div className="space-y-4 pb-4">
              {detailQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">加载详情...</p>
              ) : null}
              {detailQuery.isError ? (
                <Alert variant="destructive">
                  <AlertTitle>详情加载失败</AlertTitle>
                  <AlertDescription>
                    {detailQuery.error.message} (仍可根据列表数据编辑名称与描述)
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-1.5">
                <div className="text-sm font-medium">名称</div>
                <Input
                  value={eName}
                  onChange={(e) => setEName(e.target.value)}
                  className="h-10 rounded-lg text-base"
                />
              </div>
              <div className="space-y-1.5">
                <div className="text-sm font-medium">描述</div>
                <Textarea
                  rows={4}
                  value={eDesc}
                  onChange={(e) => setEDesc(e.target.value)}
                  className="rounded-lg border-border/60 text-base focus:border-primary/50"
                />
              </div>
              <div className="space-y-1.5">
                <div className="text-sm font-medium">语言</div>
                <Select value={eLang} onValueChange={setELang}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh">zh</SelectItem>
                    <SelectItem value="en">en</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <p className="text-xs text-muted-foreground">
                保存使用 PUT 合并; 仅提交名称, 描述与语言.
              </p>

              {updateMutation.isError ? (
                <Alert variant="destructive">
                  <AlertTitle>保存失败</AlertTitle>
                  <AlertDescription>
                    {updateMutation.error.message}
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
          </ScrollArea>

          <SheetFooter className="border-t border-border/50 bg-transparent px-6 py-3">
            <div className="flex w-full justify-end gap-2">
              <Button variant="outline" onClick={() => setSheetOpen(false)}>
                取消
              </Button>
              <Button
                disabled={updateMutation.isPending || !editId || !eName.trim()}
                className="gap-2 bg-primary font-medium shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md active:scale-95"
                onClick={() => {
                  if (!editId) return;
                  updateMutation.mutate({
                    id: editId,
                    name: eName.trim(),
                    description: eDesc.trim(),
                    language: eLang,
                  });
                }}
              >
                {updateMutation.isPending ? (
                  <Loader2Icon className="size-4 shrink-0 animate-spin" />
                ) : null}
                保存
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={deleteId != null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="text-base">
          <DialogHeader>
            <DialogTitle className="font-semibold">删除智能体</DialogTitle>
            <DialogDescription>
              将注销{" "}
              <span className="font-mono font-medium text-foreground">{deleteId}</span>.
              工作区目录不会自动删除.
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
              className="gap-2 font-medium shadow-sm transition-all duration-200 hover:shadow-md active:scale-95"
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
