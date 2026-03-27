"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  SearchIcon,
} from "lucide-react";

interface ContentTopbarProps {
  showLeftSidebar: boolean;
  onToggleLeftSidebar: () => void;
  showRightSidebar: boolean;
  onToggleRightSidebar: () => void;
  onSearchOpen: () => void;
  searchPlaceholder?: string;
  /** Shown right of the search bar, before the history sidebar toggle. */
  endSlot?: ReactNode;
}

export function ContentTopbar({
  showLeftSidebar,
  onToggleLeftSidebar,
  showRightSidebar,
  onToggleRightSidebar,
  onSearchOpen,
  searchPlaceholder = "搜索...",
  endSlot,
}: ContentTopbarProps) {
  return (
    <header className="absolute inset-x-0 top-0 z-20 flex h-14 items-center border-b border-border/50 bg-background/95 backdrop-blur-lg backdrop-saturate-150 supports-backdrop-filter:bg-background/80">
      {/* Left: toggle left sidebar */}
      <div className="flex shrink-0 items-center px-3">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onToggleLeftSidebar}
          title={showLeftSidebar ? "收起侧边栏" : "展开侧边栏"}
          className="transition-all duration-200 hover:bg-accent/80 active:scale-95"
        >
          {showLeftSidebar ? (
            <PanelLeftCloseIcon className="size-4" />
          ) : (
            <PanelLeftOpenIcon className="size-4" />
          )}
        </Button>
      </div>

      {/* Center: search trigger — absolute so it's always truly centered */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
        <button
          type="button"
          onClick={onSearchOpen}
          className="pointer-events-auto flex h-10 w-full max-w-md items-center gap-2.5 rounded-lg border border-border/60 bg-muted/30 px-3.5 text-sm text-muted-foreground shadow-sm transition-all duration-200 hover:border-primary/30 hover:bg-muted/50 hover:shadow"
        >
          <SearchIcon className="size-4 shrink-0 opacity-70" />
          <span className="min-w-0 flex-1 truncate text-left">
            {searchPlaceholder}
          </span>
          <kbd className="pointer-events-none hidden h-6 select-none items-center gap-0.5 rounded border border-border/60 bg-muted/50 px-2 font-mono text-[11px] font-medium text-muted-foreground shadow-sm sm:inline-flex">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: optional slot + toggle right sidebar */}
      <div className="ml-auto flex shrink-0 items-center gap-2 px-3">
        {endSlot}
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onToggleRightSidebar}
          title={showRightSidebar ? "收起历史" : "展开历史"}
          className="transition-all duration-200 hover:bg-accent/80 active:scale-95"
        >
          {showRightSidebar ? (
            <PanelRightCloseIcon className="size-4" />
          ) : (
            <PanelRightOpenIcon className="size-4" />
          )}
        </Button>
      </div>

      {/* Fade gradient below header */}
      <div className="pointer-events-none absolute inset-x-0 top-full h-8 bg-linear-to-b from-background/30 to-transparent" />
    </header>
  );
}
