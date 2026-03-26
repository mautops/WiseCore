"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  QK_MODELS_ACTIVE,
  QK_MODELS_PROVIDERS,
  allModelsForProvider,
  eligibleProvidersForSlot,
} from "@/app/(app)/settings/models/models-domain";
import type { ProviderInfo } from "@/lib/llm-models-api";
import { llmModelsApi } from "@/lib/llm-models-api";
import { CheckIcon, ChevronDownIcon, Loader2Icon } from "lucide-react";

function activeDisplayLabel(
  eligible: ProviderInfo[],
  providerId: string | undefined,
  modelId: string | undefined,
): string {
  if (!providerId || !modelId) return "选择模型";
  for (const p of eligible) {
    if (p.id !== providerId) continue;
    const models = allModelsForProvider(p);
    const m = models.find((x) => x.id === modelId);
    return m?.name || m?.id || modelId;
  }
  return modelId;
}

export const CORE_MODEL_SWITCHED_EVENT = "core-model-switched";

export function ChatModelSelector() {
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

  const providersQuery = useQuery({
    queryKey: QK_MODELS_PROVIDERS,
    queryFn: () => llmModelsApi.listProviders(),
  });

  const activeQuery = useQuery({
    queryKey: QK_MODELS_ACTIVE,
    queryFn: () => llmModelsApi.getActive(),
    staleTime: 15_000,
  });

  const eligible = useMemo(
    () => eligibleProvidersForSlot(providersQuery.data ?? []),
    [providersQuery.data],
  );

  const activePid = activeQuery.data?.active_llm?.provider_id;
  const activeMid = activeQuery.data?.active_llm?.model;
  const label = activeDisplayLabel(eligible, activePid, activeMid);

  const setMutation = useMutation({
    mutationFn: (body: { provider_id: string; model: string }) =>
      llmModelsApi.setActive(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QK_MODELS_ACTIVE });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(CORE_MODEL_SWITCHED_EVENT));
      }
    },
    onError: (e) => {
      window.alert(e instanceof Error ? e.message : "切换模型失败");
    },
  });

  return (
    <DropdownMenu
      open={menuOpen}
      onOpenChange={(o) => {
        setMenuOpen(o);
        if (o) void activeQuery.refetch();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 max-w-[min(14rem,calc(100vw-12rem))] gap-1 px-2 font-normal"
          disabled={providersQuery.isLoading && !providersQuery.data}
        >
          {setMutation.isPending ? (
            <Loader2Icon className="size-3.5 shrink-0 animate-spin" />
          ) : null}
          <span className="min-w-0 flex-1 truncate text-left">
            {providersQuery.isLoading && !providersQuery.data ? "加载…" : label}
          </span>
          <ChevronDownIcon className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>对话模型</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {providersQuery.isError ? (
          <div className="px-2 py-2 text-destructive">无法加载模型列表</div>
        ) : providersQuery.isLoading ? (
          <div className="px-2 py-3 text-center text-muted-foreground">
            加载中…
          </div>
        ) : eligible.length === 0 ? (
          <div className="space-y-2 px-2 py-2">
            <p className="text-muted-foreground">
              没有已配置且含模型的供应商, 请先到设置中配置.
            </p>
            <Button variant="secondary" size="sm" className="w-full" asChild>
              <Link href="/settings/models">打开模型设置</Link>
            </Button>
          </div>
        ) : (
          eligible.map((p) => (
            <DropdownMenuSub key={p.id}>
              <DropdownMenuSubTrigger>
                <span className="truncate">{p.name}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                {allModelsForProvider(p).map((m) => {
                  const isActive = p.id === activePid && m.id === activeMid;
                  return (
                    <DropdownMenuItem
                      key={m.id}
                      disabled={setMutation.isPending}
                      className="gap-2"
                      onClick={() => {
                        if (isActive) return;
                        setMutation.mutate({
                          provider_id: p.id,
                          model: m.id,
                        });
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {m.name || m.id}
                      </span>
                      {isActive ? (
                        <CheckIcon className="size-3.5 shrink-0 text-primary" />
                      ) : null}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
