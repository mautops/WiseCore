"use client";

/**
 * 工作流步骤只读展示组件
 * 用于在预览模式下展示步骤列表
 */

import { Badge } from "@/components/ui/badge";
import type { WorkflowStep } from "./workflow-types";
import { WORKFLOW_LANGUAGE_OPTIONS } from "./workflow-types";
import { cn } from "@/lib/utils";

interface WorkflowStepsViewerProps {
  steps: WorkflowStep[];
  className?: string;
}

export function WorkflowStepsViewer({
  steps,
  className,
}: WorkflowStepsViewerProps) {
  if (steps.length === 0) {
    return (
      <div className={cn("text-muted-foreground text-sm", className)}>
        暂无执行步骤
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {steps.map((step, index) => (
        <div
          key={step.id}
          className="rounded-lg border bg-card/50 p-3"
        >
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
              {index + 1}
            </div>
            <span className="font-medium">{step.title || "未命名步骤"}</span>
            {step.language && (
              <Badge variant="outline" className="ml-auto text-xs">
                {WORKFLOW_LANGUAGE_OPTIONS.find((o) => o.value === step.language)?.label || step.language}
              </Badge>
            )}
          </div>

          {step.description && (
            <p className="mt-1.5 text-muted-foreground text-sm">
              {step.description}
            </p>
          )}

          {step.code && (
            <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-2 font-mono text-sm">
              {step.code}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

/** 简洁的步骤列表展示 */
export function WorkflowStepsList({
  steps,
  className,
}: WorkflowStepsViewerProps) {
  if (steps.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {steps.map((step, index) => (
        <div
          key={step.id}
          className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-sm"
        >
          <span className="font-medium text-primary">{index + 1}.</span>
          <span className="truncate">{step.title || "未命名步骤"}</span>
        </div>
      ))}
    </div>
  );
}