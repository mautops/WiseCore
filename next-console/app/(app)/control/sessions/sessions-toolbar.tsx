"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SearchIcon,
} from "lucide-react";

export function SessionsToolbar({
  showLeftSidebar,
  onToggleLeftSidebar,
  searchQuery,
  onSearchQueryChange,
  channelFilter,
  onChannelFilterChange,
  userIdInput,
  onUserIdInputChange,
  channelOptions,
  onRefresh,
  listLoading,
}: {
  showLeftSidebar: boolean;
  onToggleLeftSidebar: () => void;
  searchQuery: string;
  onSearchQueryChange: (v: string) => void;
  channelFilter: string;
  onChannelFilterChange: (v: string) => void;
  userIdInput: string;
  onUserIdInputChange: (v: string) => void;
  channelOptions: string[];
  onRefresh: () => void;
  listLoading: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 flex min-h-[52px] shrink-0 flex-wrap items-center gap-2 border-b border-border bg-muted/90 px-4 py-2 backdrop-blur-md backdrop-saturate-150 supports-backdrop-filter:bg-muted/75 sm:gap-3 sm:py-0">
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
      <h1 className="shrink-0 text-base font-semibold tracking-tight">会话</h1>
      <div className="relative min-w-[140px] max-w-xs flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="在当前结果中搜索..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="h-9 pl-8 text-base"
        />
      </div>
      <Select
        value={channelFilter || "__all__"}
        onValueChange={(v) => onChannelFilterChange(v === "__all__" ? "" : v)}
      >
        <SelectTrigger className="h-9 w-[140px] shrink-0 text-base">
          <SelectValue placeholder="通道" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">全部通道</SelectItem>
          {channelOptions.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        placeholder="用户 ID (服务端筛选)"
        value={userIdInput}
        onChange={(e) => onUserIdInputChange(e.target.value)}
        className="h-9 w-[180px] shrink-0 text-base"
      />
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 text-base"
        disabled={listLoading}
        onClick={onRefresh}
      >
        刷新
      </Button>
    </header>
  );
}
