"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  allModelsForProvider,
  CHAT_MODEL_OPTIONS,
  QK_MODELS_ACTIVE,
  QK_MODELS_PROVIDERS,
} from "./models-domain";
import { ProviderSettingsPanel } from "./provider-settings-panel";
import { Loader2Icon } from "lucide-react";

export function ModelsSettingsClient() {
  const queryClient = useQueryClient();
  const { showLeftSidebar, toggleLeftSidebar } = useAppShell();
  const [customOpen, setCustomOpen] = useState(false);
  const [cid, setCid] = useState("");
  const [cname, setCname] = useState("");
  const [cbase, setCbase] = useState("");
  const [cprefix, setCprefix] = useState("");
  const [cchat, setCchat] = useState<string>("OpenAIChatModel");

  const [selProvider, setSelProvider] = useState("");
  const [selModel, setSelModel] = useState("");

  const providersQuery = useQuery({
    queryKey: QK_MODELS_PROVIDERS,
    queryFn: () => llmModelsApi.listProviders(),
  });

  const activeQuery = useQuery({
    queryKey: QK_MODELS_ACTIVE,
    queryFn: () => llmModelsApi.getActive(),
  });

  const active = activeQuery.data?.active_llm;

  useEffect(() => {
    if (active) {
      setSelProvider(active.provider_id);
      setSelModel(active.model);
    }
  }, [active?.provider_id, active?.model]);

  const sortedProviders = useMemo(() => {
    const list = providersQuery.data ?? [];
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [providersQuery.data]);

  const modelsForSelectedProvider = useMemo(() => {
    const p = sortedProviders.find((x) => x.id === selProvider);
    return p ? allModelsForProvider(p) : [];
  }, [sortedProviders, selProvider]);

  const setActiveMutation = useMutation({
    mutationFn: (body: { provider_id: string; model: string }) =>
      llmModelsApi.setActive(body),
    onSuccess: async () => {
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

  const applyActiveSelection = () => {
    if (!selProvider || !selModel) return;
    void setActiveMutation.mutateAsync({
      provider_id: selProvider,
      model: selModel,
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background text-base">
      <ModelsToolbar
        showLeftSidebar={showLeftSidebar}
        onToggleLeftSidebar={toggleLeftSidebar}
        onCreateCustom={() => setCustomOpen(true)}
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground">
            活动模型写入当前智能体配置. Provider 与密钥由 CoPaw 服务端持久化, 与{" "}
            <span className="font-mono">/agent/config</span>{" "}
            中的运行参数相互独立.
          </p>

          {providersQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Provider 列表加载失败</AlertTitle>
              <AlertDescription>
                {providersQuery.error.message}
              </AlertDescription>
            </Alert>
          ) : null}

          {activeQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>活动模型加载失败</AlertTitle>
              <AlertDescription>{activeQuery.error.message}</AlertDescription>
            </Alert>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">当前活动模型</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">加载中...</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {active ? (
                    <>
                      <span className="font-mono text-foreground">
                        {active.provider_id}
                      </span>
                      {" / "}
                      <span className="font-mono text-foreground">
                        {active.model}
                      </span>
                    </>
                  ) : (
                    "未设置 (将使用全局或后端默认)"
                  )}
                </p>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="text-sm font-medium">Provider</div>
                  <Select
                    value={selProvider || "__none__"}
                    onValueChange={(v) => {
                      const id = v === "__none__" ? "" : v;
                      setSelProvider(id);
                      setSelModel("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择 Provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">(未选)</SelectItem>
                      {sortedProviders.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="text-sm font-medium">模型</div>
                  <Select
                    value={selModel || "__none__"}
                    onValueChange={(v) =>
                      setSelModel(v === "__none__" ? "" : v)
                    }
                    disabled={!selProvider}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择模型" />
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
                <Button
                  className="text-base"
                  disabled={
                    !selProvider || !selModel || setActiveMutation.isPending
                  }
                  onClick={applyActiveSelection}
                >
                  {setActiveMutation.isPending ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : null}
                  应用
                </Button>
              </div>
              {setActiveMutation.isError ? (
                <p className="text-sm text-destructive">
                  {(setActiveMutation.error as Error).message}
                </p>
              ) : null}
            </CardContent>
          </Card>

          {providersQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">加载 Provider...</p>
          ) : null}

          <Accordion type="multiple" className="w-full space-y-2">
            {sortedProviders.map((p: ProviderInfo) => (
              <AccordionItem
                key={p.id}
                value={p.id}
                className="rounded-lg border border-border bg-card px-3"
              >
                <AccordionTrigger className="text-left text-base hover:no-underline">
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {p.id}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ProviderSettingsPanel
                    p={p}
                    activeModelId={active?.model ?? ""}
                    activeProviderId={active?.provider_id ?? ""}
                    onSetActive={onSetActive}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </ScrollArea>

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="text-base sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建自定义 Provider</DialogTitle>
            <DialogDescription>
              id 创建后不可改; 可在展开后配置 URL 与密钥并添加模型.
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
