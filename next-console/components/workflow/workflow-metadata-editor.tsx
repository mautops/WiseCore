"use client";

/**
 * 工作流元信息编辑组件
 * 用于编辑工作流的名称、描述、目录、状态、版本、标签等基本信息
 */

import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { XIcon } from "lucide-react";
import {
  type WorkflowData,
  WORKFLOW_STATUS_OPTIONS,
  WORKFLOW_SUGGESTED_TAGS,
} from "./workflow-types";

interface WorkflowMetadataEditorProps {
  data: WorkflowData;
  onChange: (data: WorkflowData) => void;
  /** 是否显示文件名字段 */
  showFilename?: boolean;
  /** 文件名（仅当 showFilename 为 true 时使用） */
  filename?: string;
  /** 文件名变更回调 */
  onFilenameChange?: (filename: string) => void;
  /** 是否为只读模式 */
  readOnly?: boolean;
}

export function WorkflowMetadataEditor({
  data,
  onChange,
  showFilename = false,
  filename = "",
  onFilenameChange,
  readOnly = false,
}: WorkflowMetadataEditorProps) {
  const [tagInput, setTagInput] = useState("");

  const updateData = useCallback(
    <K extends keyof WorkflowData>(key: K, value: WorkflowData[K]) => {
      onChange({ ...data, [key]: value });
    },
    [data, onChange],
  );

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim();
      if (trimmed && !data.tags.includes(trimmed)) {
        updateData("tags", [...data.tags, trimmed]);
      }
      setTagInput("");
    },
    [data.tags, updateData],
  );

  const removeTag = useCallback(
    (tag: string) => {
      updateData(
        "tags",
        data.tags.filter((t) => t !== tag),
      );
    },
    [data.tags, updateData],
  );

  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <h3 className="font-medium">基本信息</h3>

      <div className="grid grid-cols-2 gap-3">
        {showFilename && (
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-sm">文件名 *</label>
            <Input
              placeholder="my-workflow"
              value={filename}
              onChange={(e) => onFilenameChange?.(e.target.value)}
              disabled={readOnly}
            />
          </div>
        )}
        <div className={showFilename ? "grid gap-1.5" : "col-span-2 grid gap-1.5"}>
          <label className="text-muted-foreground text-sm">
            显示名称 {showFilename && "*"}
          </label>
          <Input
            placeholder="我的工作流"
            value={data.name}
            onChange={(e) => updateData("name", e.target.value)}
            disabled={readOnly}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-sm">描述</label>
        <Input
          placeholder="简短说明工作流用途"
          value={data.description}
          onChange={(e) => updateData("description", e.target.value)}
          disabled={readOnly}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-1.5">
          <label className="text-muted-foreground text-sm">目录</label>
          <Input
            placeholder="运维工具"
            value={data.catalog}
            onChange={(e) => updateData("catalog", e.target.value)}
            disabled={readOnly}
          />
        </div>
        <div className="grid gap-1.5">
          <label className="text-muted-foreground text-sm">版本</label>
          <Input
            placeholder="1.0"
            value={data.version}
            onChange={(e) => updateData("version", e.target.value)}
            disabled={readOnly}
          />
        </div>
        <div className="grid gap-1.5">
          <label className="text-muted-foreground text-sm">状态</label>
          <Select
            value={data.status}
            onValueChange={(v) => updateData("status", v)}
            disabled={readOnly}
          >
            <SelectTrigger>
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
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-sm">标签</label>
        <div className="flex flex-wrap gap-1">
          {data.tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1 pr-1 text-xs"
            >
              {tag}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <XIcon className="size-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <Input
              placeholder="输入标签后按 Enter"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag(tagInput);
                }
              }}
              className="h-8 flex-1 text-sm"
            />
            <div className="flex flex-wrap gap-1">
              {WORKFLOW_SUGGESTED_TAGS.filter((t) => !data.tags.includes(t))
                .slice(0, 3)
                .map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addTag(tag)}
                    className="text-muted-foreground text-xs hover:text-foreground"
                  >
                    +{tag}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}