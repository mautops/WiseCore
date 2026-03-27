"use client";

import type { UseMutationResult } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { Loader2Icon } from "lucide-react";

export function SkillCreateDialog({
  open,
  onOpenChange,
  name,
  onNameChange,
  content,
  onContentChange,
  createMutation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onNameChange: (v: string) => void;
  content: string;
  onContentChange: (v: string) => void;
  createMutation: UseMutationResult<
    { created: boolean },
    Error,
    { name: string; content: string }
  >;
}) {
  const canSubmit = name.trim().length > 0 && content.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] text-base sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>新建 Skill</DialogTitle>
          <DialogDescription>
            目录名仅允许字母、数字、下划线等（与服务器 skill 目录一致）。正文需含 YAML
            头且包含 name 与 description 字段。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-muted-foreground">
              目录名
            </label>
            <Input
              placeholder="my_skill"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              spellCheck={false}
              className="h-10 rounded-lg font-mono text-sm"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-muted-foreground">
              SKILL.md 正文
            </label>
            <Textarea
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              spellCheck={false}
              className="min-h-[220px] rounded-lg border-border/60 font-mono text-sm"
            />
          </div>

          {createMutation.isError && (
            <p className="text-sm text-destructive">
              {(createMutation.error as Error).message}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={!canSubmit || createMutation.isPending}
            onClick={() =>
              createMutation.mutate({
                name: name.trim(),
                content,
              })
            }
          >
            {createMutation.isPending && (
              <Loader2Icon className="animate-spin" />
            )}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
