"use client";

import type { CSSProperties } from "react";
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
import { GripVerticalIcon, PlusIcon, Trash2Icon } from "lucide-react";
import type { WorkflowStep } from "./workflow-types";
import { WORKFLOW_LANGUAGE_OPTIONS } from "./workflow-types";
import { generateStepId } from "./workflow-yaml";

interface SortableStepItemProps {
  step: WorkflowStep;
  index: number;
  totalSteps: number;
  onUpdate: (stepId: string, updates: Partial<WorkflowStep>) => void;
  onRemove: (stepId: string) => void;
  readOnly?: boolean;
}

function SortableStepItem({
  step,
  index,
  totalSteps,
  onUpdate,
  onRemove,
  readOnly = false,
}: SortableStepItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id, disabled: readOnly });

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
        "group rounded-lg border bg-card transition-all",
        isDragging && "shadow-lg ring-2 ring-primary/50"
      )}
    >
      {/* 步骤头部 */}
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        {!readOnly && (
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          >
            <GripVerticalIcon className="size-4" />
          </span>
        )}
        <Badge variant="outline" className="shrink-0 text-xs">
          Step {index + 1}
        </Badge>
        <Input
          placeholder="步骤标题"
          value={step.title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onUpdate(step.id, { title: e.target.value })
          }
          className="h-7 flex-1 border-0 bg-transparent px-0 text-sm font-medium shadow-none focus-visible:ring-0"
          disabled={readOnly}
        />
        <Select
          value={step.language}
          onValueChange={(v) => onUpdate(step.id, { language: v })}
          disabled={readOnly}
        >
          <SelectTrigger className="h-7 w-auto border-0 bg-muted px-2 text-xs shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WORKFLOW_LANGUAGE_OPTIONS.map((opt: { value: string; label: string }) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!readOnly && (
          <button
            type="button"
            onClick={() => onRemove(step.id)}
            className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          >
            <Trash2Icon className="size-4" />
          </button>
        )}
      </div>

      {/* 步骤内容 */}
      <div className="grid gap-2 p-3">
        <Input
          placeholder="步骤说明（可选）"
          value={step.description}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onUpdate(step.id, { description: e.target.value })
          }
          className="h-7 border-0 bg-transparent px-0 text-sm text-muted-foreground shadow-none focus-visible:ring-0"
          disabled={readOnly}
        />
        <Textarea
          placeholder="输入代码或命令..."
          value={step.code}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            onUpdate(step.id, { code: e.target.value })
          }
          className="min-h-[80px] resize-none rounded-md border border-border/60 bg-muted/30 p-2 font-mono text-sm focus:border-primary/50"
          spellCheck={false}
          disabled={readOnly}
        />
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";

interface WorkflowStepsEditorProps {
  steps: WorkflowStep[];
  onChange: (steps: WorkflowStep[]) => void;
  readOnly?: boolean;
}

export function WorkflowStepsEditor({
  steps,
  onChange,
  readOnly = false,
}: WorkflowStepsEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const addStep = () => {
    const newStep: WorkflowStep = {
      id: generateStepId(),
      title: "",
      description: "",
      language: "bash",
      code: "",
    };
    onChange([...steps, newStep]);
  };

  const updateStep = (stepId: string, updates: Partial<WorkflowStep>) => {
    onChange(
      steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s))
    );
  };

  const removeStep = (stepId: string) => {
    onChange(steps.filter((s) => s.id !== stepId));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      onChange(arrayMove(steps, oldIndex, newIndex));
    }
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">执行步骤</h3>
        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addStep}
            className="gap-1"
          >
            <PlusIcon className="size-4" />
            添加步骤
          </Button>
        )}
      </div>

      {steps.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-8 text-muted-foreground">
          <p className="text-sm">暂无步骤</p>
          {!readOnly && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addStep}
            >
              添加第一个步骤
            </Button>
          )}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={steps.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {steps.map((step, index) => (
                <SortableStepItem
                  key={step.id}
                  step={step}
                  index={index}
                  totalSteps={steps.length}
                  onUpdate={updateStep}
                  onRemove={removeStep}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {!readOnly && steps.length > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addStep}
          className="mt-1 w-full border-dashed"
        >
          <PlusIcon className="size-4" />
          添加更多步骤
        </Button>
      )}
    </div>
  );
}