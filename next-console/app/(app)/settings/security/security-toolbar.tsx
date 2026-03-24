"use client";

import { Button } from "@/components/ui/button";
import {
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  RefreshCwIcon,
} from "lucide-react";

export function SecurityToolbar({
  showLeftSidebar,
  onToggleLeftSidebar,
  onRefresh,
  refreshing,
}: {
  showLeftSidebar: boolean;
  onToggleLeftSidebar: () => void;
  onRefresh: () => void;
  refreshing: boolean;
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
      <h1 className="text-base font-semibold tracking-tight">安全</h1>
      <div className="flex-1" />
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 text-base"
        disabled={refreshing}
        onClick={onRefresh}
      >
        <RefreshCwIcon
          className={`size-4 ${refreshing ? "animate-spin" : ""}`}
        />
        刷新
      </Button>
    </header>
  );
}
