"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PanelLeftCloseIcon, PanelLeftOpenIcon, SearchIcon } from "lucide-react";

export function ToolsToolbar({
  showLeftSidebar,
  onToggleLeftSidebar,
  filterQuery,
  onFilterQueryChange,
}: {
  showLeftSidebar: boolean;
  onToggleLeftSidebar: () => void;
  filterQuery: string;
  onFilterQueryChange: (v: string) => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border/50 bg-background/95 px-4 backdrop-blur-lg backdrop-saturate-150 supports-backdrop-filter:bg-background/80">
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
      <div className="relative min-w-0 flex-1 max-w-md">
        <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
        <Input
          placeholder="搜索工具名称或描述..."
          value={filterQuery}
          onChange={(e) => onFilterQueryChange(e.target.value)}
          className="h-9 w-full pl-9 text-base"
        />
      </div>
      <div className="flex-1" />
    </header>
  );
}
