"use client";

import { useState, useCallback, useMemo, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeftIcon,
  Loader2Icon,
  GripVerticalIcon,
  PlusIcon,
  Trash2Icon,
  ChevronRightIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  type WorkflowData,
  type WorkflowStep,
  DEFAULT_WORKFLOW_DATA,
  buildWorkflowYaml,
  WORKFLOW_STATUS_OPTIONS,
  WORKFLOW_LANGUAGE_OPTIONS,
  WORKFLOW_SUGGESTED_TAGS,
} from "@/components/workflow";
import { workflowApi, ensureWorkflowMarkdownFilename } from "@/lib/workflow-api";

/** 可排序的步骤卡片 */
function SortableStepCard({
  step,
  index,
  onUpdate,
  onRemove,
}: {
  step: WorkflowStep;
  index: number;
  onUpdate: (updates: Partial<WorkflowStep>) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-xl border bg-card transition-all",
        isDragging && "shadow-lg ring-2 ring-primary/50"
      )}
    >
      {/* 步骤头部 */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        >
          <GripVerticalIcon className="size-5" />
        </span>
        <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
          {index + 1}
        </div>
        <input
          type="text"
          placeholder="步骤标题"
          value={step.title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ title: e.target.value })}
          className="flex-1 bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground/60"
        />
        <Select
          value={step.language}
          onValueChange={(v) => onUpdate({ language: v })}
        >
          <SelectTrigger className="h-7 w-auto border-0 bg-muted px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WORKFLOW_LANGUAGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        >
          <Trash2Icon className="size-4" />
        </button>
      </div>

      {/* 步骤内容 */}
      <div className="grid gap-3 p-4">
        <input
          type="text"
          placeholder="步骤说明（可选）"
          value={step.description}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ description: e.target.value })}
          className="bg-transparent text-sm text-muted-foreground outline-none placeholder:text-muted-foreground/50"
        />
        <Textarea
          placeholder="输入代码或命令..."
          value={step.code}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onUpdate({ code: e.target.value })}
          className="min-h-[100px] resize-none rounded-lg border border-border/60 bg-muted/30 p-3 font-mono text-sm focus:border-primary/50 focus:bg-background"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

export default function NewWorkflowPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [filename, setFilename] = useState("");
  const [data, setData] = useState<WorkflowData>(DEFAULT_WORKFLOW_DATA);
  const [tagInput, setTagInput] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const createMutation = useMutation({
    mutationFn: (body: { filename: string; content: string }) => {
      const normalizedFilename = ensureWorkflowMarkdownFilename(body.filename);
      return workflowApi.create({
        ...body,
        filename: normalizedFilename,
      });
    },
    onSuccess: (result) => {
      router.push(`/agent/workflows?highlight=${encodeURIComponent(result.filename)}`);
    },
  });

  const canProceedFromMetadata = useMemo(() => {
    return filename.trim().length > 0 && data.name.trim().length > 0;
  }, [filename, data.name]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = data.steps.findIndex((s) => s.id === active.id);
      const newIndex = data.steps.findIndex((s) => s.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        setData((prev) => ({
          ...prev,
          steps: arrayMove(prev.steps, oldIndex, newIndex),
        }));
      }
    },
    [data.steps]
  );

  const addStep = useCallback(() => {
    const newStep: WorkflowStep = {
      id: `step${Date.now().toString(36)}`,
      title: "",
      description: "",
      language: "bash",
      code: "",
    };
    setData((prev) => ({ ...prev, steps: [...prev.steps, newStep] }));
  }, []);

  const updateStep = useCallback(
    (stepId: string, updates: Partial<WorkflowStep>) => {
      setData((prev) => ({
        ...prev,
        steps: prev.steps.map((s) =>
          s.id === stepId ? { ...s, ...updates } : s
        ),
      }));
    },
    []
  );

  const removeStep = useCallback((stepId: string) => {
    setData((prev) => ({
      ...prev,
      steps: prev.steps.filter((s) => s.id !== stepId),
    }));
  }, []);

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim();
      if (trimmed && !data.tags.includes(trimmed)) {
        setData((prev) => ({ ...prev, tags: [...prev.tags, trimmed] }));
      }
      setTagInput("");
    },
    [data.tags]
  );

  const removeTag = useCallback((tag: string) => {
    setData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  }, []);

  const handleCreate = useCallback(() => {
    const yaml = buildWorkflowYaml(data);
    createMutation.mutate({
      filename: filename.trim(),
      content: yaml,
    });
  }, [createMutation, filename, data]);

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="flex items-center gap-4 border-b bg-background/80 px-6 py-4 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/agent/workflows")}
        >
          <ArrowLeftIcon className="size-4" />
          返回
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">新建工作流</h1>
          <p className="text-sm text-muted-foreground">
            创建包含多个执行步骤的自动化工作流
          </p>
        </div>

        {/* 步骤指示器 */}
        <div className="flex items-center gap-2">
          {["基本信息", "执行步骤"].map((label, idx) => (
            <div
              key={label}
              className="flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => idx < currentStep && setCurrentStep(idx)}
                disabled={idx > currentStep}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all",
                  idx === currentStep
                    ? "bg-primary text-primary-foreground"
                    : idx < currentStep
                      ? "bg-primary/10 text-primary cursor-pointer hover:bg-primary/20"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {idx < currentStep ? (
                  <span className="size-4 rounded-full bg-primary text-[10px] text-primary-foreground">✓</span>
                ) : (
                  <span className="flex size-4 items-center justify-center rounded-full bg-background/50 text-xs">
                    {idx + 1}
                  </span>
                )}
                {label}
              </button>
              {idx < 1 && <ChevronRightIcon className="size-4 text-muted-foreground" />}
            </div>
          ))}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-4xl">
          {/* Step 1: Metadata */}
          {currentStep === 0 && (
            <div className="space-y-6">
              {/* 文件名和显示名称 */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    文件名 <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder="my-workflow"
                    value={filename}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilename(e.target.value)}
                    className="h-10"
                  />
                  <p className="text-xs text-muted-foreground">
                    无需后缀，将自动添加 .md
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    显示名称 <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder="我的工作流"
                    value={data.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData((p) => ({ ...p, name: e.target.value }))}
                    className="h-10"
                  />
                </div>
              </div>

              {/* 描述 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">描述</label>
                <Input
                  placeholder="简短说明工作流用途..."
                  value={data.description}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData((p) => ({ ...p, description: e.target.value }))}
                  className="h-10"
                />
              </div>

              {/* 目录、版本、状态 */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">目录</label>
                  <Input
                    placeholder="运维工具"
                    value={data.catalog}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData((p) => ({ ...p, catalog: e.target.value }))}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">版本</label>
                  <Input
                    placeholder="1.0"
                    value={data.version}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData((p) => ({ ...p, version: e.target.value }))}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">状态</label>
                  <Select
                    value={data.status}
                    onValueChange={(v) => setData((p) => ({ ...p, status: v }))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WORKFLOW_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 标签 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">标签</label>
                <div className="flex flex-wrap gap-1.5">
                  {data.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="gap-1 pr-1"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-1 rounded-full p-0.5 hover:bg-foreground/10"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="输入标签后按 Enter..."
                    value={tagInput}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTagInput(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === "Enter" && tagInput.trim()) {
                        e.preventDefault();
                        addTag(tagInput);
                      }
                    }}
                    className="h-9 flex-1"
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {WORKFLOW_SUGGESTED_TAGS.filter((t) => !data.tags.includes(t)).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => addTag(tag)}
                      className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Steps */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">执行步骤</h2>
                  <p className="text-sm text-muted-foreground">
                    拖拽卡片调整执行顺序，每个步骤可包含代码或命令
                  </p>
                </div>
                <Button variant="outline" onClick={addStep} className="gap-1.5">
                  <PlusIcon className="size-4" />
                  添加步骤
                </Button>
              </div>

              {data.steps.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed py-16">
                  <div className="rounded-full bg-muted p-4">
                    <PlusIcon className="size-8 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium">暂无执行步骤</p>
                    <p className="text-sm text-muted-foreground">
                      点击下方按钮添加第一个步骤
                    </p>
                  </div>
                  <Button onClick={addStep}>添加步骤</Button>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={data.steps.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {data.steps.map((step, index) => (
                        <SortableStepCard
                          key={step.id}
                          step={step}
                          index={index}
                          onUpdate={(updates) => updateStep(step.id, updates)}
                          onRemove={() => removeStep(step.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              {data.steps.length > 0 && (
                <Button
                  variant="outline"
                  onClick={addStep}
                  className="w-full gap-1.5 border-dashed"
                >
                  <PlusIcon className="size-4" />
                  添加更多步骤
                </Button>
              )}
            </div>
          )}

          {/* Error */}
          {createMutation.isError && (
            <div className="mt-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="text-sm text-destructive">
                {(createMutation.error as Error).message}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <footer className="border-t bg-background px-8 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Button
            variant="outline"
            onClick={() =>
              currentStep === 0
                ? router.push("/agent/workflows")
                : setCurrentStep(0)
            }
            disabled={createMutation.isPending}
          >
            {currentStep === 0 ? "取消" : "上一步"}
          </Button>

          <div className="flex gap-2">
            {currentStep === 0 ? (
              <Button
                onClick={() => setCurrentStep(1)}
                disabled={!canProceedFromMetadata}
              >
                下一步
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending && (
                  <Loader2Icon className="animate-spin" />
                )}
                创建工作流
              </Button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}