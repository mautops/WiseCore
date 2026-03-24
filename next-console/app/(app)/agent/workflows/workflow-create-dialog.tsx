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

/** 新建工作流时 Textarea 的初始正文, 用户可直接在此基础上修改. */
export const DEFAULT_NEW_WORKFLOW_MARKDOWN = `---
name: 显示名称
description: 简短说明
category: 分类
status: draft
version: "1.0"
tags:
  - 运维
  - 自动化
---

# 标题

在此编写工作流说明与步骤.
`;

export function WorkflowCreateDialog({
  open,
  onOpenChange,
  newName,
  onNewNameChange,
  newContent,
  onNewContentChange,
  canCreate,
  createMutation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newName: string;
  onNewNameChange: (v: string) => void;
  newContent: string;
  onNewContentChange: (v: string) => void;
  canCreate: boolean;
  createMutation: UseMutationResult<
    unknown,
    Error,
    { filename: string; content: string }
  >;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] text-base sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>新建工作流</DialogTitle>
          <DialogDescription>
            文件名无需写后缀, 未以 .md / .markdown 结尾时将自动补全为 .md.
            内容为完整 Markdown (可含 YAML 头信息).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <label className="font-medium text-muted-foreground">文件名</label>
            <Input
              placeholder="example"
              value={newName}
              onChange={(e) => onNewNameChange(e.target.value)}
            />
          </div>
          <div className="grid min-h-0 gap-1.5">
            <label className="font-medium text-muted-foreground">
              内容 (Markdown)
            </label>
            <Textarea
              value={newContent}
              onChange={(e) => onNewContentChange(e.target.value)}
              spellCheck={false}
              className="min-h-[200px] font-mono"
            />
          </div>
          {createMutation.isError && (
            <p className="text-destructive">
              {(createMutation.error as Error).message}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="text-base"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            className="text-base"
            disabled={!canCreate || createMutation.isPending}
            onClick={() =>
              createMutation.mutate({
                filename: newName.trim(),
                content: newContent,
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
