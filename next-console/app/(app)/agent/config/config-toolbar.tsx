"use client";

import { Button } from "@/components/ui/button";
import {
  Loader2Icon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
} from "lucide-react";

export function AgentConfigToolbar({
  showLeftSidebar,
  onToggleLeftSidebar,
  onSave,
  saving,
  saveDisabled,
}: {
  showLeftSidebar: boolean;
  onToggleLeftSidebar: () => void;
  onSave: () => void;
  saving: boolean;
  saveDisabled: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-[52px] shrink-0 items-center gap-3 border-b border-border bg-muted/90 px-4 backdrop-blur-md backdrop-saturate-150 supports-backdrop-filter:bg-muted/75">
      <Button
        size="icon"
        variant="ghost"
        className="shrink-0 text-base"
        onClick={onToggleLeftSidebar}
        title={showLeftSidebar ? "收起侧边栏" : "展开侧边栏"}
      >
        {showLeftSidebar ? (
          <PanelLeftCloseIcon className="size-4" />
        ) : (
          <PanelLeftOpenIcon className="size-4" />
        )}
      </Button>
      <h1 className="text-base font-semibold tracking-tight">智能体运行配置</h1>
      <div className="flex-1" />
      <Button
        className="inline-flex shrink-0 gap-2 text-base"
        disabled={saveDisabled || saving}
        onClick={onSave}
      >
        {saving ? (
          <Loader2Icon className="size-4 shrink-0 animate-spin" />
        ) : null}
        保存
      </Button>
    </header>
  );
}
