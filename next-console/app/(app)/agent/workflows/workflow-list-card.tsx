"use client";

import { LayoutGridIcon, TagIcon } from "lucide-react";
import { formatWorkflowTimestamp, type WorkflowInfo } from "@/lib/workflow-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  TAGS_VISIBLE,
  WORKFLOW_STATUS_BADGE,
  workflowDisplayTitle,
  workflowStatusTone,
  workflowTags,
} from "./workflow-domain";
import { WorkflowRunsDailyChart } from "./workflow-runs-daily-chart";

export function WorkflowListCard({
  w,
  onOpen,
  onExecute,
}: {
  w: WorkflowInfo;
  onOpen: (item: WorkflowInfo) => void;
  onExecute?: (item: WorkflowInfo) => void | Promise<void>;
}) {
  const tags = workflowTags(w);
  const restTags = tags.length - TAGS_VISIBLE;
  const statusTone = workflowStatusTone(w.status);
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpen(w)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(w);
        }
      }}
      className="group cursor-pointer text-base shadow-sm ring-1 ring-border/40 transition-all duration-200 hover:scale-[1.01] hover:shadow-md hover:ring-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
    >
      <CardHeader className="gap-2 border-b border-border/40 pb-4">
        <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2">
          <CardTitle className="col-start-1 row-start-1 block min-w-0 max-w-full text-lg font-semibold leading-snug tracking-tight text-foreground">
            <span className="inline-flex min-w-0 max-w-full items-center gap-2">
              <span className="min-w-0 truncate">
                {workflowDisplayTitle(w)}
              </span>
              {w.version?.trim() ? (
                <>
                  <Separator
                    orientation="vertical"
                    className="h-7 shrink-0"
                    decorative
                  />
                  <span className="shrink-0 whitespace-nowrap font-normal text-sm tabular-nums text-muted-foreground">
                    (v{w.version.trim()})
                  </span>
                </>
              ) : null}
            </span>
          </CardTitle>
          <div className="col-start-2 row-start-1 flex justify-end self-start">
            {w.status?.trim() ? (
              <Badge
                variant="outline"
                className={cn(
                  "shrink-0 border px-2.5 py-0.5 text-xs font-medium tracking-wide transition-colors",
                  WORKFLOW_STATUS_BADGE[statusTone],
                )}
              >
                {w.status.trim()}
              </Badge>
            ) : null}
          </div>
          <p
            className="col-start-1 row-start-2 min-w-0 truncate font-mono text-sm text-muted-foreground"
            title={w.path}
          >
            {w.filename}
          </p>
          <span className="col-start-2 row-start-2 shrink-0 justify-self-end text-right text-sm tabular-nums text-muted-foreground">
            更新 {formatWorkflowTimestamp(w.modified_time)}
          </span>
          <div className="col-span-2 col-start-1 row-start-3 min-w-0">
            <WorkflowRunsDailyChart filename={w.filename} />
          </div>
        </div>
      </CardHeader>
      <div className="flex min-h-0 flex-1 flex-col">
        {w.description?.trim() ? (
          <CardContent className="min-w-0 max-w-full overflow-hidden pb-4">
            <p
              className="line-clamp-2 max-h-12 min-w-0 overflow-hidden text-sm leading-relaxed text-muted-foreground/90"
              title={w.description.trim()}
            >
              {w.description.trim()}
            </p>
          </CardContent>
        ) : (
          <div className="flex-1" />
        )}
        <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-4 mt-auto">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-2 text-sm text-muted-foreground">
            {w.category?.trim() ? (
              <div className="flex min-w-0 max-w-full items-center gap-1.5">
                <LayoutGridIcon
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <Badge
                  variant="secondary"
                  className="max-w-[min(10rem,100%)] truncate border border-border/50 bg-secondary/50 px-2.5 py-0.5 text-xs font-medium transition-colors group-hover:border-primary/20"
                >
                  {w.category.trim()}
                </Badge>
              </div>
            ) : null}
            {w.category?.trim() && tags.length > 0 ? (
              <Separator orientation="vertical" className="h-4" decorative />
            ) : null}
            {tags.length > 0 ? (
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <TagIcon
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                {tags.slice(0, TAGS_VISIBLE).map((t) => (
                  <Badge
                    key={t}
                    variant="outline"
                    className="max-w-28 truncate border-border/50 px-2 py-0.5 text-xs font-medium transition-colors group-hover:border-primary/20 group-hover:bg-primary/5"
                  >
                    {t}
                  </Badge>
                ))}
                {restTags > 0 ? (
                  <span className="text-sm text-muted-foreground">
                    +{restTags}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          {onExecute ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              className="pointer-events-auto shrink-0 gap-1.5 bg-primary px-4 text-sm font-medium shadow-sm transition-all hover:bg-primary/90 hover:shadow-md active:scale-95"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void onExecute(w);
              }}
            >
              执行
            </Button>
          ) : null}
        </CardFooter>
      </div>
    </Card>
  );
}
