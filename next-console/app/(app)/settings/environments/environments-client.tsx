"use client";

import { useCallback, useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import type { EnvVar } from "@/lib/envs-api";
import { envsApi } from "@/lib/envs-api";
import { useAppShell } from "../../app-shell";
import { EnvironmentsToolbar } from "./environments-toolbar";
import {
  envListToRecord,
  isSensitiveEnvKey,
  maskEnvValue,
  QK_ENVS,
  rowMatchesEnvFilter,
} from "./environments-domain";
import {
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

export function EnvironmentsClient() {
  const queryClient = useQueryClient();
  const { showLeftSidebar, toggleLeftSidebar } = useAppShell();
  const [filterQuery, setFilterQuery] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const [addOpen, setAddOpen] = useState(false);
  const [addKey, setAddKey] = useState("");
  const [addValue, setAddValue] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editKey, setEditKey] = useState("");
  const [editValue, setEditValue] = useState("");

  const [deleteKey, setDeleteKey] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: QK_ENVS,
    queryFn: () => envsApi.list(),
  });

  const putAllMutation = useMutation({
    mutationFn: (envs: Record<string, string>) => envsApi.putAll(envs),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QK_ENVS });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (key: string) => envsApi.deleteKey(key),
    onSuccess: async () => {
      setDeleteKey(null);
      await queryClient.invalidateQueries({ queryKey: QK_ENVS });
    },
  });

  const rows = useMemo(() => {
    const list = listQuery.data ?? [];
    return list.filter((r) => rowMatchesEnvFilter(r, filterQuery));
  }, [listQuery.data, filterQuery]);

  const toggleReveal = useCallback((key: string) => {
    setRevealed((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const openEdit = (row: EnvVar) => {
    setEditKey(row.key);
    setEditValue(row.value);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    const list = listQuery.data ?? [];
    const map = envListToRecord(list);
    map[editKey] = editValue;
    try {
      await putAllMutation.mutateAsync(map);
      setEditOpen(false);
    } catch {
      /* surfaced */
    }
  };

  const saveAdd = async () => {
    const k = addKey.trim();
    if (!k) return;
    const list = listQuery.data ?? [];
    const map = envListToRecord(list);
    if (k in map) {
      return;
    }
    map[k] = addValue;
    try {
      await putAllMutation.mutateAsync(map);
      setAddOpen(false);
      setAddKey("");
      setAddValue("");
    } catch {
      /* surfaced */
    }
  };

  const duplicateAddKey =
    addKey.trim() !== "" &&
    (listQuery.data ?? []).some((e) => e.key === addKey.trim());

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background text-base">
      <EnvironmentsToolbar
        showLeftSidebar={showLeftSidebar}
        onToggleLeftSidebar={toggleLeftSidebar}
        filterQuery={filterQuery}
        onFilterQueryChange={setFilterQuery}
        onAddClick={() => {
          setAddKey("");
          setAddValue("");
          setAddOpen(true);
        }}
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          <Alert>
            <AlertTitle>全量保存</AlertTitle>
            <AlertDescription>
              保存与新增会调用 PUT /envs 覆盖服务端全部键值; 未包含的键会被删除.
              行内「删除」使用 DELETE 单键接口. 请勿多终端同时改同一套环境变量.
            </AlertDescription>
          </Alert>

          {listQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>加载失败</AlertTitle>
              <AlertDescription>{listQuery.error.message}</AlertDescription>
            </Alert>
          ) : null}

          {putAllMutation.isError ? (
            <Alert variant="destructive">
              <AlertTitle>保存失败</AlertTitle>
              <AlertDescription>
                {putAllMutation.error.message}
              </AlertDescription>
            </Alert>
          ) : null}

          {listQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : null}

          {!listQuery.isLoading && !listQuery.isError && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">无匹配项.</p>
          )}

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-3 py-2 font-medium">键名</th>
                  <th className="px-3 py-2 font-medium">值</th>
                  <th className="px-3 py-2 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const sens = isSensitiveEnvKey(row.key);
                  const show = !sens || revealed[row.key];
                  return (
                    <tr
                      key={row.key}
                      className="border-b border-border last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-3 py-2 font-mono text-xs font-medium">
                        {row.key}
                      </td>
                      <td className="max-w-[360px] px-3 py-2">
                        <div className="flex items-start gap-2">
                          <span
                            className="min-w-0 flex-1 wrap-break-word font-mono text-xs"
                            title={show ? row.value : undefined}
                          >
                            {show
                              ? row.value || "(空)"
                              : maskEnvValue(row.value)}
                          </span>
                          {sens ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-8 shrink-0"
                              title={revealed[row.key] ? "隐藏" : "显示"}
                              onClick={() => toggleReveal(row.key)}
                            >
                              {revealed[row.key] ? (
                                <EyeOffIcon className="size-4" />
                              ) : (
                                <EyeIcon className="size-4" />
                              )}
                            </Button>
                          ) : null}
                        </div>
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
                            onClick={() => setDeleteKey(row.key)}
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </ScrollArea>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="text-base">
          <DialogHeader>
            <DialogTitle>新增环境变量</DialogTitle>
            <DialogDescription>
              键名保存前会 trim, 不可与现有键重复.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="KEY"
            className="font-mono"
            value={addKey}
            onChange={(e) => setAddKey(e.target.value)}
          />
          <Textarea
            placeholder="值"
            className="font-mono text-sm"
            rows={4}
            value={addValue}
            onChange={(e) => setAddValue(e.target.value)}
          />
          {duplicateAddKey ? (
            <p className="text-sm text-destructive">键名已存在</p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              取消
            </Button>
            <Button
              disabled={
                putAllMutation.isPending || !addKey.trim() || duplicateAddKey
              }
              className="inline-flex gap-2"
              onClick={() => void saveAdd()}
            >
              {putAllMutation.isPending ? (
                <Loader2Icon className="size-4 shrink-0 animate-spin" />
              ) : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="text-base">
          <DialogHeader>
            <DialogTitle>编辑值</DialogTitle>
            <DialogDescription>
              键名 <span className="font-mono text-foreground">{editKey}</span>{" "}
              不可在此修改; 需删除后重建.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            className="font-mono text-sm"
            rows={6}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              取消
            </Button>
            <Button
              disabled={putAllMutation.isPending}
              className="inline-flex gap-2"
              onClick={() => void saveEdit()}
            >
              {putAllMutation.isPending ? (
                <Loader2Icon className="size-4 shrink-0 animate-spin" />
              ) : null}
              保存 (全量 PUT)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteKey != null} onOpenChange={() => setDeleteKey(null)}>
        <DialogContent className="text-base">
          <DialogHeader>
            <DialogTitle>删除环境变量</DialogTitle>
            <DialogDescription>
              确定删除{" "}
              <span className="font-mono text-foreground">{deleteKey}</span>?
            </DialogDescription>
          </DialogHeader>
          {deleteMutation.isError ? (
            <p className="text-destructive">
              {(deleteMutation.error as Error).message}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteKey(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              className="inline-flex gap-2"
              disabled={deleteMutation.isPending || !deleteKey}
              onClick={() => deleteKey && deleteMutation.mutate(deleteKey)}
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
