"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { SkillSpec } from "@/lib/skills-api";
import { Loader2Icon, InfoIcon } from "lucide-react";
import { sourceLabel } from "./skills-domain";
import { cn } from "@/lib/utils";

export function SkillDetailSheet({
  open,
  onOpenChange,
  skill,
  editContent,
  onEditContentChange,
  saveMutation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skill: SkillSpec | null;
  editContent: string;
  onEditContentChange: (v: string) => void;
  saveMutation: UseMutationResult<
    { created: boolean },
    Error,
    { name: string; content: string }
  >;
}) {
  const customized = skill?.source === "customized";
  const dirty =
    skill != null && customized && editContent !== skill.content;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        aria-describedby={undefined}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[520px]"
      >
        <SheetHeader className="border-b border-border/60 px-6 py-4 text-left">
          <SheetTitle className="pr-8 text-lg font-semibold">
            {skill?.name ?? "—"}
          </SheetTitle>
          {skill ? (
            <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  skill.enabled
                    ? "animate-pulse bg-emerald-500"
                    : "bg-muted-foreground/40"
                )}
              />
              {skill.enabled ? "已启用" : "未启用"}
            </p>
          ) : null}
        </SheetHeader>

        {skill && (
          <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
            {/* Meta Info */}
            <div className="grid gap-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground/70">来源</span>
                <span
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-medium",
                    customized
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                      : "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400"
                  )}
                >
                  {sourceLabel(skill.source)}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="shrink-0 text-muted-foreground/70">路径</span>
                <div
                  className="flex-1 break-all rounded-md bg-muted/40 px-2.5 py-1.5 font-mono text-xs text-muted-foreground"
                  title={skill.path}
                >
                  {skill.path}
                </div>
              </div>
            </div>

            {/* Description */}
            {skill.description ? (
              <div className="text-sm">
                <div className="mb-1 text-xs text-muted-foreground/70">描述</div>
                <p className="leading-relaxed text-muted-foreground">
                  {skill.description}
                </p>
              </div>
            ) : null}

            {/* Editor */}
            <ScrollArea className="min-h-0 flex-1 rounded-lg border border-border/60 bg-muted/20">
              <Textarea
                value={editContent}
                onChange={(e) => onEditContentChange(e.target.value)}
                readOnly={!customized}
                disabled={!customized}
                spellCheck={false}
                className="min-h-[min(60vh,300px)] resize-none border-0 bg-transparent font-mono text-sm focus-visible:ring-0"
              />
            </ScrollArea>

            {/* Actions */}
            {customized && (
              <div className="flex flex-col gap-2">
                {saveMutation.isError && (
                  <p className="text-sm text-destructive">
                    {(saveMutation.error as Error).message}
                  </p>
                )}
                <Button
                  className="self-end"
                  disabled={!dirty || saveMutation.isPending}
                  onClick={() =>
                    saveMutation.mutate({
                      name: skill.name,
                      content: editContent,
                    })
                  }
                >
                  {saveMutation.isPending && (
                    <Loader2Icon className="animate-spin" />
                  )}
                  保存覆盖
                </Button>
              </div>
            )}

            {/* Read-only Notice */}
            {!customized && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200/60 bg-amber-50/50 px-3 py-2.5 dark:border-amber-500/20 dark:bg-amber-500/10">
                <InfoIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                  内置 Skill 无法直接保存。如需修改，请新建自定义 skill 或复制此内容。
                </p>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
