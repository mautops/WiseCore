"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProviderInfo } from "@/lib/llm-models-api";
import { cn } from "@/lib/utils";
import {
  maskApiKey,
  providerIsAvailable,
  providerIsConfigured,
  providerTotalModels,
} from "./models-domain";
import { ProviderSettingsPanel } from "./provider-settings-panel";
import { LayoutGridIcon, PencilIcon } from "lucide-react";

export function ProviderSummaryCard({
  provider: p,
  activeProviderId,
  activeModelId,
  isHover,
  onMouseEnter,
  onMouseLeave,
  onSetActive,
}: {
  provider: ProviderInfo;
  activeProviderId: string;
  activeModelId: string;
  isHover: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onSetActive: (providerId: string, modelId: string) => void;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const total = providerTotalModels(p);
  const configured = providerIsConfigured(p);
  const available = providerIsAvailable(p);

  const statusLabel = available ? "可用" : configured ? "未添加模型" : "未配置";
  const statusType = available
    ? "enabled"
    : configured
      ? "partial"
      : "disabled";

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setPanelOpen(true);
          }
        }}
        className={cn(
          "group flex min-w-[min(100%,432px)] flex-[1_1_calc(33.333%-11px)] cursor-pointer flex-col rounded-2xl border bg-card shadow-sm transition-all duration-200 sm:flex-[1_1_calc(33.333%-16px)]",
          available
            ? "border-2 border-primary shadow-md ring-4 ring-primary/10"
            : isHover
              ? "border-primary/50 shadow-md hover:scale-[1.01]"
              : "border-border/50 hover:border-primary/30 hover:shadow-md",
        )}
      >
        <div className="flex flex-1 flex-col px-6 py-5">
          <div className="mb-3.5 flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-lg font-semibold text-foreground">
                {p.name}
              </span>
              {p.is_local ? (
                <Badge
                  variant="secondary"
                  className="h-5 px-2 text-xs font-medium"
                >
                  本地
                </Badge>
              ) : p.is_custom ? (
                <Badge className="h-5 border-blue-500/50 bg-blue-500/15 px-2 text-xs font-medium text-blue-700 dark:text-blue-300">
                  自定义
                </Badge>
              ) : (
                <Badge className="h-5 border-emerald-500/50 bg-emerald-500/15 px-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  内置
                </Badge>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full ring-2",
                  statusType === "enabled" && "bg-emerald-500 ring-emerald-500/30",
                  statusType === "partial" && "bg-amber-500 ring-amber-500/30",
                  statusType === "disabled" && "bg-slate-300 ring-slate-300/30 dark:bg-slate-600 dark:ring-slate-600/30",
                )}
              />
              <span
                className={cn(
                  "text-xs font-medium",
                  statusType === "enabled" && "text-emerald-600 dark:text-emerald-400",
                  statusType === "partial" && "text-amber-600 dark:text-amber-400",
                  statusType === "disabled" && "text-muted-foreground",
                )}
              >
                {statusLabel}
              </span>
            </div>
          </div>

          <div className="mb-4 flex min-h-[66px] flex-col gap-1.5">
            {p.is_local ? (
              <>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="min-w-[70px] shrink-0 font-medium text-muted-foreground/70">
                    类型:
                  </span>
                  <span className="min-w-0 font-mono text-xs text-foreground/80">
                    本地 / 嵌入式
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="min-w-[70px] shrink-0 font-medium text-muted-foreground/70">
                    模型:
                  </span>
                  <span className="min-w-0 truncate font-mono text-xs text-foreground/80">
                    {total > 0 ? `${total} 个模型` : "请先下载 / 添加模型"}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="min-w-[70px] shrink-0 font-medium text-muted-foreground/70">
                    Base URL:
                  </span>
                  {p.base_url ? (
                    <span
                      className="min-w-0 flex-1 truncate font-mono text-xs text-foreground/80 text-left"
                      title={p.base_url}
                    >
                      {p.base_url}
                    </span>
                  ) : (
                    <span className="italic text-muted-foreground/50">
                      未设置
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="min-w-[70px] shrink-0 font-medium text-muted-foreground/70">
                    API Key:
                  </span>
                  {p.api_key ? (
                    <span className="min-w-0 truncate font-mono text-xs text-foreground/80">
                      {maskApiKey(p.api_key)}
                    </span>
                  ) : (
                    <span className="italic text-muted-foreground/50">
                      未设置
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="min-w-[70px] shrink-0 font-medium text-muted-foreground/70">
                    模型:
                  </span>
                  <span className="min-w-0 truncate font-mono text-xs text-foreground/80">
                    {total > 0 ? `${total} 个模型` : "无模型"}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-border/50 pt-3.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-3 text-sm text-muted-foreground transition-all duration-150 hover:bg-primary/10 hover:text-primary active:scale-95"
              onClick={(e) => {
                e.stopPropagation();
                setPanelOpen(true);
              }}
            >
              <LayoutGridIcon className="size-3.5" />
              管理模型
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-3 text-sm text-muted-foreground transition-all duration-150 hover:bg-primary/10 hover:text-primary active:scale-95"
              onClick={(e) => {
                e.stopPropagation();
                setPanelOpen(true);
              }}
            >
              <PencilIcon className="size-3.5" />
              设置
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={panelOpen} onOpenChange={setPanelOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0 text-base"
        >
          <DialogHeader className="shrink-0 border-b border-border/50 px-6 py-4 text-left">
            <DialogTitle className="text-lg font-semibold">
              {p.name}
              <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">
                {p.id}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <ProviderSettingsPanel
              p={p}
              activeModelId={activeModelId}
              activeProviderId={activeProviderId}
              onSetActive={onSetActive}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
