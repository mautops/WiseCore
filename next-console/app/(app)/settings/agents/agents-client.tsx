"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Loader2Icon, PencilIcon, Trash2Icon } from "lucide-react";

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

  const rows = useMemo(() => {
    const list = listQuery.data ?? [];
    return list.filter((a) => agentMatchesFilter(a, filterQuery));
  }, [listQuery.data, filterQuery]);

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
        onCreateClick={() => {
          setCName("");
          setCDesc("");
          setCLang("zh");
          setCWs("");
          setCreateOpen(true);
        }}
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground">
            此处管理根配置中的智能体注册表. 控制台当前会话使用哪一智能体由网关 /
            JWT / 请求头决定, 与下表无直接绑定.
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

          {!listQuery.isLoading && !listQuery.isError && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">无匹配项.</p>
          )}

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-3 py-2 font-medium">ID</th>
                  <th className="px-3 py-2 font-medium">名称</th>
                  <th className="px-3 py-2 font-medium">描述</th>
                  <th className="px-3 py-2 font-medium">工作区</th>
                  <th className="px-3 py-2 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-3 py-2 font-mono text-xs font-medium">
                      {row.id}
                    </td>
                    <td className="max-w-[140px] truncate px-3 py-2">
                      {row.name}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-muted-foreground">
                      {row.description || "—"}
                    </td>
                    <td
                      className="max-w-[220px] truncate px-3 py-2 font-mono text-xs text-muted-foreground"
                      title={row.workspace_dir}
                    >
                      {row.workspace_dir}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-base"
                          onClick={() => openEdit(row)}
                        >
                          <PencilIcon className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive text-base"
                          disabled={row.id === "default"}
                          title={
                            row.id === "default" ? "不能删除 default" : "删除"
                          }
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="text-base">
          <DialogHeader>
            <DialogTitle>新建智能体</DialogTitle>
            <DialogDescription>
              服务端生成短 ID; 工作区目录留空则使用默认路径.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="名称 *"
            value={cName}
            onChange={(e) => setCName(e.target.value)}
          />
          <Textarea
            placeholder="描述"
            rows={3}
            value={cDesc}
            onChange={(e) => setCDesc(e.target.value)}
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
            className="font-mono text-sm"
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
              className="inline-flex gap-2"
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
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <SheetHeader className="shrink-0 px-4">
            <SheetTitle className="font-mono">
              {editId ? `编辑: ${editId}` : "编辑"}
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="min-h-0 flex-1 px-4">
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
                />
              </div>
              <div className="space-y-1.5">
                <div className="text-sm font-medium">描述</div>
                <Textarea
                  rows={4}
                  value={eDesc}
                  onChange={(e) => setEDesc(e.target.value)}
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

          <SheetFooter className="border-t border-border px-4">
            <div className="flex w-full justify-end gap-2">
              <Button variant="outline" onClick={() => setSheetOpen(false)}>
                取消
              </Button>
              <Button
                disabled={updateMutation.isPending || !editId || !eName.trim()}
                className="inline-flex gap-2"
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
            <DialogTitle>删除智能体</DialogTitle>
            <DialogDescription>
              将注销{" "}
              <span className="font-mono text-foreground">{deleteId}</span>.
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
