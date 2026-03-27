"use client";

import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { ToolInfo } from "@/lib/tools-api";
import { Loader2Icon } from "lucide-react";

export function ToolCard({
  tool,
  toggling,
  onToggle,
}: {
  tool: ToolInfo;
  toggling: boolean;
  onToggle: () => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!toggling) onToggle();
    }
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => !toggling && onToggle()}
      onKeyDown={handleKeyDown}
      className={cn(
        "group cursor-pointer text-base shadow-sm ring-1 transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "active:scale-[0.99]",
        tool.enabled
          ? "ring-primary/40 bg-primary/5 hover:shadow-md hover:ring-primary/60"
          : "ring-border/40 hover:shadow-md hover:ring-border/60",
      )}
    >
      <CardContent className="space-y-3 px-5 pt-5 pb-0">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 flex-1 truncate font-mono text-base font-semibold leading-snug text-foreground">
            {tool.name}
          </h3>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                "size-2 shrink-0 rounded-full transition-colors",
                tool.enabled ? "bg-emerald-500" : "bg-muted-foreground/30",
              )}
            />
            <span
              className={cn(
                "whitespace-nowrap text-xs font-medium",
                tool.enabled
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground",
              )}
            >
              {toggling ? "切换中..." : tool.enabled ? "已启用" : "未启用"}
            </span>
          </div>
        </div>
        <p
          className="mb-5 line-clamp-2 min-h-10 text-sm leading-relaxed text-muted-foreground"
          title={tool.description || undefined}
        >
          {tool.description || "—"}
        </p>
      </CardContent>
      <CardFooter className="justify-end border-t border-border/40 bg-transparent px-5 pt-4 pb-5">
        <div className="relative">
          <Switch
            checked={tool.enabled}
            disabled={toggling}
            onCheckedChange={() => onToggle()}
            aria-label={`切换 ${tool.name}`}
            className="data-[state=checked]:bg-primary"
          />
          {toggling && (
            <Loader2Icon className="absolute -left-1 -top-1 size-6 animate-spin text-primary" />
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
