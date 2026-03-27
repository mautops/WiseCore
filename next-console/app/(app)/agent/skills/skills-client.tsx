"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  consolePrimaryButtonClass,
  ConsoleMirrorScrollPadding,
} from "@/components/console-mirror";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { TooltipProvider } from "@/components/ui/tooltip";
import { skillsApi, type SkillSpec } from "@/lib/skills-api";
import { useAppShell } from "../../app-shell";
import { SkillCard } from "./skill-card";
import { SkillCreateDialog } from "./skill-create-dialog";
import { SkillDetailSheet } from "./skill-detail-sheet";
import {
  DEFAULT_NEW_SKILL_MARKDOWN,
  matchesSkillFilter,
  QK_SKILLS,
} from "./skills-domain";
import { SkillsToolbar } from "./skills-toolbar";
import { FilePlusIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Skeleton card for loading state */
function SkillCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/40 bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="size-9 animate-pulse rounded-lg bg-muted" />
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-10 w-full animate-pulse rounded bg-muted" />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-5 w-12 animate-pulse rounded bg-muted" />
        <div className="h-5 flex-1 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

export function SkillsClient() {
  const queryClient = useQueryClient();
  const { showLeftSidebar, toggleLeftSidebar } = useAppShell();
  const [filterQuery, setFilterQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState(DEFAULT_NEW_SKILL_MARKDOWN);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<SkillSpec | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toggleName, setToggleName] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: QK_SKILLS,
    queryFn: () => skillsApi.list(),
  });

  const sorted = useMemo(() => {
    const rows = listQuery.data ?? [];
    return [...rows].sort((a, b) => {
      if (a.enabled && !b.enabled) return -1;
      if (!a.enabled && b.enabled) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [listQuery.data]);

  const filtered = useMemo(
    () => sorted.filter((s) => matchesSkillFilter(s, filterQuery)),
    [sorted, filterQuery],
  );

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: QK_SKILLS });
  }, [queryClient]);

  useEffect(() => {
    if (selected && sheetOpen) {
      setEditContent(selected.content);
    }
  }, [selected, sheetOpen]);

  const createMutation = useMutation({
    mutationFn: async (body: { name: string; content: string }) => {
      const r = await skillsApi.create({ ...body, overwrite: false });
      if (!r.created) {
        throw new Error("创建失败: 已存在同名自定义 skill 或 YAML 校验未通过");
      }
      return r;
    },
    onSuccess: async () => {
      setCreateOpen(false);
      setNewName("");
      setNewContent(DEFAULT_NEW_SKILL_MARKDOWN);
      await invalidate();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (body: { name: string; content: string }) => {
      const r = await skillsApi.create({ ...body, overwrite: true });
      if (!r.created) {
        throw new Error("保存失败: 无法覆盖, 请确认该 skill 为自定义且名称一致");
      }
      return r;
    },
    onSuccess: async (_, vars) => {
      await invalidate();
      setEditContent(vars.content);
      setSelected((prev) =>
        prev?.name === vars.name
          ? { ...prev, content: vars.content }
          : prev,
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (name: string) => {
      const r = await skillsApi.delete(name);
      if (!r.deleted) {
        throw new Error("删除失败: 仅可删除自定义目录下的 skill");
      }
    },
    onSuccess: async () => {
      setDeleteOpen(false);
      setSheetOpen(false);
      setSelected(null);
      await invalidate();
    },
  });

  const enableMutation = useMutation({
    mutationFn: async ({ name, enable }: { name: string; enable: boolean }) => {
      if (enable) await skillsApi.enable(name);
      else await skillsApi.disable(name);
    },
    onSuccess: () => invalidate(),
    onError: () => invalidate(),
    onSettled: () => setToggleName(null),
  });

  const openSheet = (s: SkillSpec) => {
    setSelected(s);
    setEditContent(s.content);
    setSheetOpen(true);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background text-base">
      <SkillsToolbar
        showLeftSidebar={showLeftSidebar}
        onToggleLeftSidebar={toggleLeftSidebar}
        filterQuery={filterQuery}
        onFilterQueryChange={setFilterQuery}
      />

      <ScrollArea className="min-h-0 flex-1">
        <ConsoleMirrorScrollPadding className="space-y-4">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="mb-1 text-2xl font-semibold tracking-tight">
                Skills
              </h1>
              <p className="m-0 text-sm text-muted-foreground">
                管理自定义与内置 skill，可启用/禁用，编辑 Markdown 内容
              </p>
            </div>
            <Button
              className={consolePrimaryButtonClass("shrink-0 text-base")}
              onClick={() => setCreateOpen(true)}
            >
              <FilePlusIcon className="size-4" />
              新建 Skill
            </Button>
          </div>

          {/* Error State */}
          {listQuery.isError && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 py-12">
              <p className="text-sm text-destructive">
                {(listQuery.error as Error).message}
              </p>
              <Button variant="outline" size="sm" onClick={() => listQuery.refetch()}>
                重试
              </Button>
            </div>
          )}

          {/* Loading Skeleton */}
          {listQuery.isLoading && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkillCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Empty State - No Skills */}
          {!listQuery.isLoading &&
            !listQuery.isError &&
            sorted.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-muted/20 py-16">
                <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
                  <SparklesIcon className="size-7 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-base font-medium">暂无 Skill</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    点击上方按钮创建你的第一个 skill
                  </p>
                </div>
                <Button
                  className={consolePrimaryButtonClass("mt-2")}
                  onClick={() => setCreateOpen(true)}
                >
                  <FilePlusIcon className="size-4" />
                  新建 Skill
                </Button>
              </div>
            )}

          {/* Empty Filter Result */}
          {!listQuery.isLoading &&
            sorted.length > 0 &&
            !listQuery.isError &&
            filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-12">
                <p className="text-sm text-muted-foreground">
                  无匹配项，尝试调整搜索条件
                </p>
              </div>
            )}

          {/* Skill Cards Grid */}
          {!listQuery.isLoading && !listQuery.isError && filtered.length > 0 && (
            <TooltipProvider delayDuration={300}>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-5">
                {filtered.map((s) => (
                  <SkillCard
                    key={s.name}
                    skill={s}
                    toggling={
                      enableMutation.isPending && toggleName === s.name
                    }
                    onOpen={() => openSheet(s)}
                    onToggleEnabled={(e) => {
                      e.stopPropagation();
                      setToggleName(s.name);
                      enableMutation.mutate({
                        name: s.name,
                        enable: !s.enabled,
                      });
                    }}
                    onRequestDelete={
                      s.source === "customized"
                        ? (e) => {
                            e.stopPropagation();
                            setSelected(s);
                            setDeleteOpen(true);
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
            </TooltipProvider>
          )}
        </ConsoleMirrorScrollPadding>
      </ScrollArea>

      <SkillCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        name={newName}
        onNameChange={setNewName}
        content={newContent}
        onContentChange={setNewContent}
        createMutation={createMutation}
      />

      <SkillDetailSheet
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) setSelected(null);
        }}
        skill={selected}
        editContent={editContent}
        onEditContentChange={setEditContent}
        saveMutation={saveMutation}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="text-base">
          <DialogHeader>
            <DialogTitle>删除 Skill</DialogTitle>
            <DialogDescription>
              确定删除自定义 skill{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
                {selected?.name}
              </code>
              ？此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          {deleteMutation.isError && (
            <p className="text-sm text-destructive">
              {(deleteMutation.error as Error).message}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending || !selected}
              onClick={() => selected && deleteMutation.mutate(selected.name)}
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
