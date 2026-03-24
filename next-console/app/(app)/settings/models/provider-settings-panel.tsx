"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChatModelName, ProviderInfo } from "@/lib/llm-models-api";
import { llmModelsApi } from "@/lib/llm-models-api";
import {
  allModelsForProvider,
  CHAT_MODEL_OPTIONS,
  maskApiKey,
  QK_MODELS_PROVIDERS,
} from "./models-domain";
import { Loader2Icon, Trash2Icon, ZapIcon } from "lucide-react";

export function ProviderSettingsPanel({
  p,
  activeModelId,
  activeProviderId,
  onSetActive,
}: {
  p: ProviderInfo;
  activeModelId: string;
  activeProviderId: string;
  onSetActive: (providerId: string, modelId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [baseUrl, setBaseUrl] = useState(p.base_url);
  const [apiKey, setApiKey] = useState(p.api_key);
  const [chatModel, setChatModel] = useState(p.chat_model);

  const [addOpen, setAddOpen] = useState(false);
  const [addId, setAddId] = useState("");
  const [addName, setAddName] = useState("");
  const [removeModelId, setRemoveModelId] = useState<string | null>(null);
  const [deleteProviderOpen, setDeleteProviderOpen] = useState(false);

  const [testHint, setTestHint] = useState<string | null>(null);
  const [discoverHint, setDiscoverHint] = useState<string | null>(null);
  const [modelTestLine, setModelTestLine] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  useEffect(() => {
    setBaseUrl(p.base_url);
    setApiKey(p.api_key);
    setChatModel(p.chat_model);
  }, [p]);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: QK_MODELS_PROVIDERS });

  const cfgMutation = useMutation({
    mutationFn: () =>
      llmModelsApi.configureProvider(p.id, {
        api_key: apiKey,
        base_url: baseUrl,
        chat_model: chatModel as ChatModelName,
        generate_kwargs: p.generate_kwargs ?? {},
      }),
    onSuccess: () => invalidate(),
  });

  const testMutation = useMutation({
    mutationFn: () =>
      llmModelsApi.testProvider(p.id, {
        api_key: apiKey || undefined,
        base_url: baseUrl || undefined,
        chat_model: chatModel as ChatModelName,
      }),
    onSuccess: (r) => {
      setTestHint(r.success ? r.message : r.message);
    },
    onError: (e: Error) => setTestHint(e.message),
  });

  const discoverMutation = useMutation({
    mutationFn: () =>
      llmModelsApi.discover(p.id, {
        api_key: apiKey || undefined,
        base_url: baseUrl || undefined,
        chat_model: chatModel as ChatModelName,
      }),
    onSuccess: (r) => {
      setDiscoverHint(
        r.success
          ? `发现 ${r.models.length} 个模型${r.message ? `: ${r.message}` : ""}`
          : `发现失败${r.message ? `: ${r.message}` : ""}`,
      );
      void invalidate();
    },
    onError: (e: Error) => setDiscoverHint(e.message),
  });

  const testModelMutation = useMutation({
    mutationFn: (modelId: string) => llmModelsApi.testModel(p.id, modelId),
    onSuccess: (r) => {
      setModelTestLine({ ok: r.success, text: r.message });
    },
    onError: (e: Error) => setModelTestLine({ ok: false, text: e.message }),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      llmModelsApi.addModel(p.id, { id: addId.trim(), name: addName.trim() }),
    onSuccess: () => {
      setAddOpen(false);
      setAddId("");
      setAddName("");
      void invalidate();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (modelId: string) => llmModelsApi.removeModel(p.id, modelId),
    onSuccess: () => {
      setRemoveModelId(null);
      void invalidate();
    },
  });

  const deleteCustomMutation = useMutation({
    mutationFn: () => llmModelsApi.deleteCustomProvider(p.id),
    onSuccess: () => {
      setDeleteProviderOpen(false);
      void invalidate();
    },
  });

  const rows = allModelsForProvider(p);

  return (
    <div className="space-y-4 pt-2">
      <div className="flex flex-wrap items-center gap-2">
        {p.is_local ? (
          <Badge variant="secondary">本地</Badge>
        ) : (
          <Badge variant="outline">远程</Badge>
        )}
        {p.is_custom ? <Badge>自定义</Badge> : null}
        {p.support_model_discovery ? (
          <Badge variant="outline">可发现模型</Badge>
        ) : null}
        {p.is_custom ? (
          <Button
            variant="destructive"
            size="sm"
            className="ml-auto text-base"
            onClick={() => setDeleteProviderOpen(true)}
          >
            <Trash2Icon className="size-4" />
            删除 Provider
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <div className="text-sm font-medium">Base URL</div>
          <Input
            className="font-mono text-sm"
            value={baseUrl}
            disabled={p.freeze_url}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
          {p.freeze_url ? (
            <p className="text-xs text-muted-foreground">
              URL 由 Provider 固定
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <div className="text-sm font-medium">API Key</div>
          <p className="text-xs text-muted-foreground">
            已配置: {maskApiKey(p.api_key) || "无"} (保存时写入完整密钥)
          </p>
          <Input
            type="password"
            autoComplete="new-password"
            className="font-mono text-sm"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={p.require_api_key ? "必填" : "可选"}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <div className="text-sm font-medium">协议 (chat_model)</div>
          <Select value={chatModel} onValueChange={setChatModel}>
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
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={cfgMutation.isPending}
          onClick={() => cfgMutation.mutate()}
          className="text-base"
        >
          {cfgMutation.isPending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : null}
          保存配置
        </Button>
        {p.support_connection_check ? (
          <Button
            variant="outline"
            size="sm"
            disabled={testMutation.isPending}
            onClick={() => {
              setTestHint(null);
              testMutation.mutate();
            }}
            className="text-base"
          >
            {testMutation.isPending ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : null}
            测试连接
          </Button>
        ) : null}
        {p.support_model_discovery ? (
          <Button
            variant="outline"
            size="sm"
            disabled={discoverMutation.isPending}
            onClick={() => {
              setDiscoverHint(null);
              discoverMutation.mutate();
            }}
            className="text-base"
          >
            {discoverMutation.isPending ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : null}
            发现模型
          </Button>
        ) : null}
      </div>

      {testHint ? (
        <Alert>
          <AlertTitle>连接测试</AlertTitle>
          <AlertDescription>{testHint}</AlertDescription>
        </Alert>
      ) : null}

      {discoverHint ? (
        <Alert
          variant={
            discoverHint.startsWith("发现失败") ? "destructive" : "default"
          }
        >
          <AlertTitle>发现模型</AlertTitle>
          <AlertDescription>{discoverHint}</AlertDescription>
        </Alert>
      ) : null}

      {cfgMutation.isError ? (
        <Alert variant="destructive">
          <AlertTitle>保存失败</AlertTitle>
          <AlertDescription>{cfgMutation.error.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">模型列表</h3>
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            添加模型
          </Button>
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">名称</th>
                <th className="px-3 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-muted-foreground">
                    暂无模型
                  </td>
                </tr>
              ) : (
                rows.map((m) => {
                  const isActive =
                    activeProviderId === p.id && activeModelId === m.id;
                  return (
                    <tr
                      key={m.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="max-w-[200px] truncate px-3 py-2 font-mono text-xs">
                        {m.id}
                      </td>
                      <td className="px-3 py-2">{m.name}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {isActive ? (
                            <Badge>当前</Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="text-base"
                              onClick={() => onSetActive(p.id, m.id)}
                            >
                              设为活动
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            title="测试模型"
                            disabled={testModelMutation.isPending}
                            onClick={() => {
                              setModelTestLine(null);
                              void testModelMutation.mutateAsync(m.id);
                            }}
                          >
                            {testModelMutation.isPending &&
                            testModelMutation.variables === m.id ? (
                              <Loader2Icon className="size-4 animate-spin" />
                            ) : (
                              <ZapIcon className="size-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setRemoveModelId(m.id)}
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modelTestLine ? (
        <Alert variant={modelTestLine.ok ? "default" : "destructive"}>
          <AlertTitle>模型测试</AlertTitle>
          <AlertDescription>{modelTestLine.text}</AlertDescription>
        </Alert>
      ) : null}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="text-base">
          <DialogHeader>
            <DialogTitle>添加模型</DialogTitle>
            <DialogDescription>加入 {p.name} 的 extra_models</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              placeholder="模型 ID (API 名)"
              className="font-mono"
              value={addId}
              onChange={(e) => setAddId(e.target.value)}
            />
            <Input
              placeholder="显示名称"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
            />
          </div>
          {addMutation.isError ? (
            <p className="text-destructive">
              {(addMutation.error as Error).message}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              取消
            </Button>
            <Button
              disabled={
                addMutation.isPending || !addId.trim() || !addName.trim()
              }
              onClick={() => addMutation.mutate()}
            >
              {addMutation.isPending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : null}
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={removeModelId != null}
        onOpenChange={() => setRemoveModelId(null)}
      >
        <DialogContent className="text-base">
          <DialogHeader>
            <DialogTitle>移除模型</DialogTitle>
            <DialogDescription>
              确定从列表移除 <span className="font-mono">{removeModelId}</span>?
            </DialogDescription>
          </DialogHeader>
          {removeMutation.isError ? (
            <p className="text-destructive">
              {(removeMutation.error as Error).message}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveModelId(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={removeMutation.isPending || !removeModelId}
              onClick={() =>
                removeModelId && removeMutation.mutate(removeModelId)
              }
            >
              {removeMutation.isPending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : null}
              移除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteProviderOpen} onOpenChange={setDeleteProviderOpen}>
        <DialogContent className="text-base">
          <DialogHeader>
            <DialogTitle>删除自定义 Provider</DialogTitle>
            <DialogDescription>
              将删除 <span className="font-mono">{p.id}</span>, 不可恢复.
            </DialogDescription>
          </DialogHeader>
          {deleteCustomMutation.isError ? (
            <p className="text-destructive">
              {(deleteCustomMutation.error as Error).message}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteProviderOpen(false)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={deleteCustomMutation.isPending}
              onClick={() => deleteCustomMutation.mutate()}
            >
              {deleteCustomMutation.isPending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : null}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
