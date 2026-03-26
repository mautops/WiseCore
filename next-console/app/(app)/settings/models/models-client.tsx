"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChatModelName, ProviderInfo } from "@/lib/llm-models-api";
import { llmModelsApi } from "@/lib/llm-models-api";
import { useAppShell } from "../../app-shell";
import { ModelsToolbar } from "./models-toolbar";
import { ProviderSummaryCard } from "./provider-summary-card";
import {
  allModelsForProvider,
  CHAT_MODEL_OPTIONS,
  eligibleProvidersForSlot,
  QK_MODELS_ACTIVE,
  QK_MODELS_PROVIDERS,
} from "./models-domain";
import { Loader2Icon, SaveIcon, SearchIcon } from "lucide-react";

export function ModelsSettingsClient() {
  const queryClient = useQueryClient();
  const { showLeftSidebar, toggleLeftSidebar } = useAppShell();
  const [customOpen, setCustomOpen] = useState(false);
  const [cid, setCid] = useState("");
  const [cname, setCname] = useState("");
  const [cbase, setCbase] = useState("");
  const [cprefix, setCprefix] = useState("");
  const [cchat, setCchat] = useState<string>("OpenAIChatModel");

  /** Local edits vs server ``active``; null means UI follows query data. */
  const [slotDraft, setSlotDraft] = useState<{
    provider_id: string;
    model: string;
  } | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const providersQuery = useQuery({
    queryKey: QK_MODELS_PROVIDERS,
    queryFn: () => llmModelsApi.listProviders(),
  });

  const activeQuery = useQuery({
    queryKey: QK_MODELS_ACTIVE,
    queryFn: () => llmModelsApi.getActive(),
  });

  const active = activeQuery.data?.active_llm;
  const activeProviderId = active?.provider_id ?? "";
  const activeModelId = active?.model ?? "";
  const selProvider = slotDraft?.provider_id ?? activeProviderId;
  const selModel = slotDraft?.model ?? activeModelId;
  const dirty =
    slotDraft !== null &&
    (slotDraft.provider_id !== activeProviderId ||
      slotDraft.model !== activeModelId);

  const sortedProviders = useMemo(() => {
    const list = providersQuery.data ?? [];
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [providersQuery.data]);

  const eligible = useMemo(
    () => eligibleProvidersForSlot(sortedProviders),
    [sortedProviders],
  );

  const { regularProviders, embeddedProviders } = useMemo(() => {
    const regular: ProviderInfo[] = [];
    const embedded: ProviderInfo[] = [];
    for (const p of sortedProviders) {
      if (p.is_local) embedded.push(p);
      else regular.push(p);
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return { regularProviders: regular, embeddedProviders: embedded };
    }
    return {
      regularProviders: regular.filter((p) => p.name.toLowerCase().includes(q)),
      embeddedProviders: embedded.filter((p) =>
        p.name.toLowerCase().includes(q),
      ),
    };
  }, [sortedProviders, searchQuery]);

  const modelsForSelectedProvider = useMemo(() => {
    const p = eligible.find((x) => x.id === selProvider);
    return p ? allModelsForProvider(p) : [];
  }, [eligible, selProvider]);

  const setActiveMutation = useMutation({
    mutationFn: (body: { provider_id: string; model: string }) =>
      llmModelsApi.setActive(body),
    onSuccess: async () => {
      setSlotDraft(null);
      await queryClient.invalidateQueries({ queryKey: QK_MODELS_ACTIVE });
    },
  });

  const createCustomMutation = useMutation({
    mutationFn: () =>
      llmModelsApi.createCustomProvider({
        id: cid.trim(),
        name: cname.trim(),
        default_base_url: cbase.trim(),
        api_key_prefix: cprefix.trim(),
        chat_model: cchat as ChatModelName,
        models: [],
      }),
    onSuccess: async () => {
      setCustomOpen(false);
      setCid("");
      setCname("");
      setCbase("");
      setCprefix("");
      await queryClient.invalidateQueries({ queryKey: QK_MODELS_PROVIDERS });
    },
  });

  const onSetActive = useCallback(
    (providerId: string, modelId: string) => {
      void setActiveMutation.mutateAsync({
        provider_id: providerId,
        model: modelId,
      });
    },
    [setActiveMutation],
  );

  const handleSaveSlot = () => {
    if (!selProvider || !selModel) return;
    void setActiveMutation.mutateAsync({
      provider_id: selProvider,
      model: selModel,
    });
  };

  const isSlotMatchingActive =
    !dirty && selProvider === activeProviderId && selModel === activeModelId;
  const canSaveSlot =
    dirty && !!selProvider && !!selModel && !setActiveMutation.isPending;

  const refetchProviders = () => void providersQuery.refetch();

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background text-base">
      <ModelsToolbar
        showLeftSidebar={showLeftSidebar}
        onToggleLeftSidebar={toggleLeftSidebar}
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-6">
          {providersQuery.isLoading || activeQuery.isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2Icon className="size-8 animate-spin opacity-60" />
              <p className="text-sm">加载中...</p>
            </div>
          ) : providersQuery.isError ? (
            <Alert variant="destructive" className="mb-6">
              <AlertTitle>Provider 列表加载失败</AlertTitle>
              <AlertDescription>
                {providersQuery.error.message}
              </AlertDescription>
            </Alert>
          ) : activeQuery.isError ? (
            <Alert variant="destructive" className="mb-6">
              <AlertTitle>活动模型加载失败</AlertTitle>
              <AlertDescription>{activeQuery.error.message}</AlertDescription>
            </Alert>
          ) : (
            <>
              <p className="mb-8 text-sm text-[#999] dark:text-white/35">
                活动模型写入当前智能体配置. Provider 与密钥由 Wisecore
                服务端持久化, 与{" "}
                <span className="font-mono text-foreground">/agent/config</span>{" "}
                中的运行参数相互独立.
              </p>

              {/* ---- LLM slot (console slotSection) ---- */}
              <div className="mb-8 rounded-2xl border border-[#e8e8e8] bg-card p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200 hover:border-[#d9d9d9] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:border-white/[0.08] dark:bg-[#2a2a2a] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] dark:hover:border-white/[0.15] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#f0f0f0] pb-4 dark:border-white/[0.08]">
                  <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-white/85">
                    大模型 (LLM) 配置
                  </h3>
                  {active?.provider_id && active?.model ? (
                    <span className="rounded-full border border-[#b7eb8f] bg-[#f6ffed] px-3 py-1 font-mono text-[13px] text-[#52c41a] dark:border-[rgba(82,196,26,0.3)] dark:bg-[rgba(82,196,26,0.1)]">
                      当前: {active.provider_id} / {active.model}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-end gap-5">
                  <div className="min-w-[200px] flex-1 space-y-2">
                    <label className="text-sm font-medium text-[#666] dark:text-white/50">
                      Provider
                    </label>
                    <Select
                      value={selProvider || "__none__"}
                      onValueChange={(v) => {
                        const id = v === "__none__" ? "" : v;
                        setSlotDraft({
                          provider_id: id,
                          model: id === activeProviderId ? activeModelId : "",
                        });
                      }}
                    >
                      <SelectTrigger className="h-10 w-full text-base">
                        <SelectValue placeholder="选择 Provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">(未选)</SelectItem>
                        {eligible.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-[200px] flex-1 space-y-2">
                    <label className="text-sm font-medium text-[#666] dark:text-white/50">
                      模型
                    </label>
                    <Select
                      value={selModel || "__none__"}
                      onValueChange={(v) => {
                        const m = v === "__none__" ? "" : v;
                        setSlotDraft((prev) => ({
                          provider_id: prev?.provider_id ?? activeProviderId,
                          model: m,
                        }));
                      }}
                      disabled={
                        !selProvider || modelsForSelectedProvider.length === 0
                      }
                    >
                      <SelectTrigger className="h-10 w-full text-base">
                        <SelectValue
                          placeholder={
                            modelsForSelectedProvider.length
                              ? "选择模型"
                              : "请先添加模型"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">(未选)</SelectItem>
                        {modelsForSelectedProvider.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name} ({m.id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-full min-w-[120px] shrink-0 space-y-2 sm:w-auto">
                    <label className="invisible text-sm font-medium">.</label>
                    <Button
                      className="h-10 w-full gap-2 bg-[#615ced] text-base hover:bg-[#615ced]/90 sm:w-[120px]"
                      disabled={!canSaveSlot}
                      onClick={handleSaveSlot}
                    >
                      {setActiveMutation.isPending ? (
                        <Loader2Icon className="size-4 animate-spin" />
                      ) : (
                        <SaveIcon className="size-4" />
                      )}
                      {isSlotMatchingActive ? "已保存" : "保存"}
                    </Button>
                  </div>
                </div>
                {setActiveMutation.isError ? (
                  <p className="mt-3 text-sm text-destructive">
                    {(setActiveMutation.error as Error).message}
                  </p>
                ) : null}
              </div>

              {/* ---- Providers (console providersBlock) ---- */}
              <div className="mt-8">
                <div className="mb-0 flex flex-wrap items-start justify-between gap-4">
                  <section>
                    <h2 className="mb-1 text-2xl font-semibold tracking-tight">
                      模型提供方
                    </h2>
                    <p className="m-0 max-w-2xl text-sm text-[#999] dark:text-white/35">
                      管理远程与本地推理服务, API 密钥与可用模型列表.
                    </p>
                  </section>
                  <Button
                    className="mt-1 shrink-0 gap-2 bg-[#615ced] text-base hover:bg-[#615ced]/90"
                    onClick={() => setCustomOpen(true)}
                  >
                    添加 Provider
                  </Button>
                </div>

                <div className="my-4 flex flex-wrap items-center gap-3">
                  <div className="relative max-w-[400px] flex-1">
                    <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="h-10 pl-9 text-base"
                      placeholder="按名称筛选..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    className="h-10 shrink-0 gap-2 bg-[#615ced] text-base hover:bg-[#615ced]/90"
                    onClick={refetchProviders}
                    disabled={providersQuery.isFetching}
                  >
                    {providersQuery.isFetching ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <SearchIcon className="size-4" />
                    )}
                    刷新
                  </Button>
                </div>

                {regularProviders.length > 0 ? (
                  <div className="mb-6 flex flex-wrap gap-4">
                    {regularProviders.map((p) => (
                      <ProviderSummaryCard
                        key={p.id}
                        provider={p}
                        activeProviderId={active?.provider_id ?? ""}
                        activeModelId={active?.model ?? ""}
                        isHover={hoveredCard === p.id}
                        onMouseEnter={() => setHoveredCard(p.id)}
                        onMouseLeave={() => setHoveredCard(null)}
                        onSetActive={onSetActive}
                      />
                    ))}
                  </div>
                ) : null}

                {embeddedProviders.length > 0 ? (
                  <div className="mb-6">
                    <h4 className="mb-3 text-sm font-semibold tracking-wide text-[#666] dark:text-white/40">
                      本地 / 嵌入式
                    </h4>
                    <div className="flex flex-wrap gap-4">
                      {embeddedProviders.map((p) => (
                        <ProviderSummaryCard
                          key={p.id}
                          provider={p}
                          activeProviderId={active?.provider_id ?? ""}
                          activeModelId={active?.model ?? ""}
                          isHover={hoveredCard === p.id}
                          onMouseEnter={() => setHoveredCard(p.id)}
                          onMouseLeave={() => setHoveredCard(null)}
                          onSetActive={onSetActive}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {regularProviders.length === 0 &&
                embeddedProviders.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    没有匹配的 Provider
                  </p>
                ) : null}
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="text-base sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建自定义 Provider</DialogTitle>
            <DialogDescription>
              id 创建后不可改; 可在卡片中打开配置并添加模型.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Input
              placeholder="id (唯一)"
              className="font-mono"
              value={cid}
              onChange={(e) => setCid(e.target.value)}
            />
            <Input
              placeholder="显示名称"
              value={cname}
              onChange={(e) => setCname(e.target.value)}
            />
            <Input
              placeholder="默认 Base URL"
              className="font-mono text-sm"
              value={cbase}
              onChange={(e) => setCbase(e.target.value)}
            />
            <Input
              placeholder="API Key 前缀提示 (可选)"
              className="font-mono text-sm"
              value={cprefix}
              onChange={(e) => setCprefix(e.target.value)}
            />
            <Select value={cchat} onValueChange={setCchat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHAT_MODEL_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {createCustomMutation.isError ? (
            <p className="text-destructive">
              {(createCustomMutation.error as Error).message}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomOpen(false)}>
              取消
            </Button>
            <Button
              disabled={
                createCustomMutation.isPending || !cid.trim() || !cname.trim()
              }
              onClick={() => createCustomMutation.mutate()}
            >
              {createCustomMutation.isPending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : null}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
