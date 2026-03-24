"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FilePlusIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
} from "lucide-react";

export function McpToolbar({
  showLeftSidebar,
  onToggleLeftSidebar,
  filterQuery,
  onFilterQueryChange,
  onCreateClick,
}: {
  showLeftSidebar: boolean;
  onToggleLeftSidebar: () => void;
  filterQuery: string;
  onFilterQueryChange: (v: string) => void;
  onCreateClick: () => void;
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
      <Input
        placeholder="搜索 key, 名称或传输方式..."
        value={filterQuery}
        onChange={(e) => onFilterQueryChange(e.target.value)}
        className="h-9 max-w-md flex-1 text-base"
      />
      <div className="flex-1" />
      <Button className="shrink-0 text-base" onClick={onCreateClick}>
        <FilePlusIcon />
        新建客户端
      </Button>
    </header>
  );
}
