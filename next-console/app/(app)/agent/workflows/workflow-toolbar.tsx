"use client";

import { consolePrimaryButtonClass } from "@/components/console-mirror";
import { Button } from "@/components/ui/button";
import {
  FilePlusIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SearchIcon,
} from "lucide-react";

export function WorkflowToolbar({
  showLeftSidebar,
  onToggleLeftSidebar,
  filterQuery,
  onOpenSearch,
  onCreateClick,
  modifierKeyPrefix,
}: {
  showLeftSidebar: boolean;
  onToggleLeftSidebar: () => void;
  filterQuery: string;
  onOpenSearch: () => void;
  onCreateClick: () => void;
  modifierKeyPrefix: string;
}) {
  return (
    <header className="sticky top-0 z-20 grid h-14 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-border/50 bg-background/95 px-6 backdrop-blur-lg backdrop-saturate-150 supports-backdrop-filter:bg-background/80">
      <div className="flex justify-start">
        <Button
          size="icon"
          variant="ghost"
          className="text-base"
          onClick={onToggleLeftSidebar}
          title={showLeftSidebar ? "收起侧边栏" : "展开侧边栏"}
        >
          {showLeftSidebar ? (
            <PanelLeftCloseIcon className="size-4" />
          ) : (
            <PanelLeftOpenIcon className="size-4" />
          )}
        </Button>
      </div>
      <div className="flex w-full min-w-0 items-center justify-center">
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full max-w-md justify-start gap-2.5 border-border/60 bg-muted/30 text-sm text-muted-foreground shadow-sm transition-all hover:border-primary/30 hover:bg-muted/50 hover:shadow"
          onClick={onOpenSearch}
        >
          <SearchIcon className="size-4 shrink-0 opacity-70" />
          <span className="min-w-0 flex-1 truncate text-left text-sm">
            {filterQuery.trim()
              ? filterQuery
              : "搜索名称 · category:运维 · tag:或 #标签"}
          </span>
          <kbd className="pointer-events-none hidden h-6 select-none items-center gap-0.5 rounded border border-border/60 bg-muted/50 px-2 font-mono text-[11px] font-medium text-muted-foreground shadow-sm sm:inline-flex">
            {modifierKeyPrefix}K
          </kbd>
        </Button>
      </div>
      <div className="flex justify-end">
        <Button
          className={consolePrimaryButtonClass("gap-2 bg-primary px-5 text-sm font-medium shadow-sm transition-all hover:bg-primary/90 hover:shadow-md active:scale-95")}
          onClick={onCreateClick}
        >
          <FilePlusIcon className="size-4" />
          新建
        </Button>
      </div>
    </header>
  );
}
