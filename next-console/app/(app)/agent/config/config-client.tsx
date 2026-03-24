"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { AgentsRunningConfig } from "@/lib/agent-config-api";
import { agentConfigApi } from "@/lib/agent-config-api";
import { useAppShell } from "../../app-shell";
import { AgentConfigToolbar } from "./config-toolbar";
import {
  normalizeRunning,
  parsePromptLines,
  QK_AGENT_RUNNING_CONFIG,
  QK_SYSTEM_PROMPT_FILES,
  validateRunning,
} from "./config-domain";

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="text-sm font-medium text-foreground">{label}</div>
      {hint ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
      {children}
    </div>
  );
}

export function AgentConfigClient() {
  const queryClient = useQueryClient();
  const { showLeftSidebar, toggleLeftSidebar } = useAppShell();

  const runningQuery = useQuery({
    queryKey: QK_AGENT_RUNNING_CONFIG,
    queryFn: () => agentConfigApi.getRunningConfig(),
  });

  const filesQuery = useQuery({
    queryKey: QK_SYSTEM_PROMPT_FILES,
    queryFn: () => agentConfigApi.getSystemPromptFiles(),
  });

  const [draft, setDraft] = useState<AgentsRunningConfig | null>(null);
  const [runningDirty, setRunningDirty] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [promptDirty, setPromptDirty] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (runningQuery.data && !runningDirty) {
      setDraft(normalizeRunning(runningQuery.data));
    }
  }, [runningQuery.data, runningQuery.dataUpdatedAt, runningDirty]);

  useEffect(() => {
    if (filesQuery.data && !promptDirty) {
      setPromptText(filesQuery.data.join("\n"));
    }
  }, [filesQuery.data, filesQuery.dataUpdatedAt, promptDirty]);

  const patchRunning = useCallback((patch: Partial<AgentsRunningConfig>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setRunningDirty(true);
  }, []);

  const patchEmbedding = useCallback(
    (patch: Partial<AgentsRunningConfig["embedding_config"]>) => {
      setDraft((d) =>
        d
          ? {
              ...d,
              embedding_config: { ...d.embedding_config, ...patch },
            }
          : d,
      );
      setRunningDirty(true);
    },
    [],
  );

  const putRunningMutation = useMutation({
    mutationFn: (body: AgentsRunningConfig) =>
      agentConfigApi.putRunningConfig(body),
  });

  const putPromptsMutation = useMutation({
    mutationFn: (files: string[]) => agentConfigApi.putSystemPromptFiles(files),
  });

  const saving = putRunningMutation.isPending || putPromptsMutation.isPending;
  const saveDisabled = !runningDirty && !promptDirty;
  const showForm = Boolean(draft) && runningQuery.isSuccess;

  const handleSave = async () => {
    setFormError(null);
    setSaveError(null);
    try {
      if (runningDirty) {
        if (!draft) {
          setFormError("运行配置尚未加载");
          return;
        }
        const err = validateRunning(draft);
        if (err) {
          setFormError(err);
          return;
        }
        await putRunningMutation.mutateAsync(draft);
        setRunningDirty(false);
      }
      if (promptDirty) {
        await putPromptsMutation.mutateAsync(parsePromptLines(promptText));
        setPromptDirty(false);
      }
      putRunningMutation.reset();
      putPromptsMutation.reset();
      await queryClient.invalidateQueries({
        queryKey: QK_AGENT_RUNNING_CONFIG,
      });
      await queryClient.invalidateQueries({
        queryKey: QK_SYSTEM_PROMPT_FILES,
      });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "保存失败");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background text-base">
      <AgentConfigToolbar
        showLeftSidebar={showLeftSidebar}
        onToggleLeftSidebar={toggleLeftSidebar}
        onSave={() => void handleSave()}
        saving={saving}
        saveDisabled={saveDisabled}
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground">
            以下配置作用于当前活动智能体. 对话使用的 LLM 与 Provider 在{" "}
            <Link
              href="/settings/models"
              className="text-primary underline-offset-4 hover:underline"
            >
              设置 / 模型
            </Link>{" "}
            中维护, 与本页运行参数相互独立.
          </p>

          {runningQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>运行配置加载失败</AlertTitle>
              <AlertDescription>{runningQuery.error.message}</AlertDescription>
            </Alert>
          ) : null}
          {runningQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">加载运行配置...</p>
          ) : null}

          {formError ? (
            <Alert variant="destructive">
              <AlertTitle>校验未通过</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}

          {saveError ? (
            <Alert variant="destructive">
              <AlertTitle>保存失败</AlertTitle>
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          ) : null}

          {putRunningMutation.isError ? (
            <Alert variant="destructive">
              <AlertTitle>运行配置未保存</AlertTitle>
              <AlertDescription>
                {putRunningMutation.error.message}
              </AlertDescription>
            </Alert>
          ) : null}

          {putPromptsMutation.isError ? (
            <Alert variant="destructive">
              <AlertTitle>系统提示文件未保存</AlertTitle>
              <AlertDescription>
                {putPromptsMutation.error.message}
              </AlertDescription>
            </Alert>
          ) : null}

          {showForm && draft ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">推理与上下文</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="最大迭代次数 (max_iters)"
                    hint="ReAct 推理-行动循环上限."
                  >
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={draft.max_iters}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (!Number.isNaN(n)) patchRunning({ max_iters: n });
                      }}
                    />
                  </Field>
                  <Field
                    label="Token 计数模型 (token_count_model)"
                    hint="用于计数的模型标识, 常用 default."
                  >
                    <Input
                      value={draft.token_count_model}
                      onChange={(e) =>
                        patchRunning({ token_count_model: e.target.value })
                      }
                    />
                  </Field>
                  <Field
                    label="字符估算除数 (token_count_estimate_divisor)"
                    hint="按字符长度估算 token 时: len / 除数, 须大于 1."
                  >
                    <Input
                      type="number"
                      step="0.01"
                      min={1.01}
                      value={draft.token_count_estimate_divisor}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value);
                        if (!Number.isNaN(n)) {
                          patchRunning({ token_count_estimate_divisor: n });
                        }
                      }}
                    />
                  </Field>
                  <Field label="使用镜像 Token 计数 (token_count_use_mirror)">
                    <div className="flex items-center gap-2 pt-1">
                      <Switch
                        checked={draft.token_count_use_mirror}
                        onCheckedChange={(v) =>
                          patchRunning({ token_count_use_mirror: v })
                        }
                      />
                      <span className="text-sm text-muted-foreground">
                        {draft.token_count_use_mirror ? "开启" : "关闭"}
                      </span>
                    </div>
                  </Field>
                  <Field
                    label="最大输入长度 / 上下文窗口 (max_input_length)"
                    hint="单位: tokens, 与模型能力对应."
                    className="md:col-span-2"
                  >
                    <Input
                      type="number"
                      min={1000}
                      step={1024}
                      value={draft.max_input_length}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (!Number.isNaN(n)) {
                          patchRunning({ max_input_length: n });
                        }
                      }}
                    />
                  </Field>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">记忆与工具结果</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="记忆压缩比例 (memory_compact_ratio)"
                    hint="0.3–0.9, 记忆占满时的压缩比例."
                  >
                    <Input
                      type="number"
                      step="0.05"
                      min={0.3}
                      max={0.9}
                      value={draft.memory_compact_ratio}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value);
                        if (!Number.isNaN(n)) {
                          patchRunning({ memory_compact_ratio: n });
                        }
                      }}
                    />
                  </Field>
                  <Field
                    label="记忆预留比例 (memory_reserve_ratio)"
                    hint="0.05–0.3, 压缩时预留比例."
                  >
                    <Input
                      type="number"
                      step="0.01"
                      min={0.05}
                      max={0.3}
                      value={draft.memory_reserve_ratio}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value);
                        if (!Number.isNaN(n)) {
                          patchRunning({ memory_reserve_ratio: n });
                        }
                      }}
                    />
                  </Field>
                  <Field
                    label="工具结果压缩: 最近条数 (tool_result_compact_recent_n)"
                    hint="1–10."
                  >
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      step={1}
                      value={draft.tool_result_compact_recent_n}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (!Number.isNaN(n)) {
                          patchRunning({ tool_result_compact_recent_n: n });
                        }
                      }}
                    />
                  </Field>
                  <Field
                    label="旧消息字符阈值 (tool_result_compact_old_threshold)"
                    hint=">= 100."
                  >
                    <Input
                      type="number"
                      min={100}
                      step={100}
                      value={draft.tool_result_compact_old_threshold}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (!Number.isNaN(n)) {
                          patchRunning({
                            tool_result_compact_old_threshold: n,
                          });
                        }
                      }}
                    />
                  </Field>
                  <Field
                    label="最近消息字符阈值 (tool_result_compact_recent_threshold)"
                    hint=">= 1000."
                  >
                    <Input
                      type="number"
                      min={1000}
                      step={1000}
                      value={draft.tool_result_compact_recent_threshold}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (!Number.isNaN(n)) {
                          patchRunning({
                            tool_result_compact_recent_threshold: n,
                          });
                        }
                      }}
                    />
                  </Field>
                  <Field
                    label="工具结果保留天数 (tool_result_compact_retention_days)"
                    hint="1–30."
                  >
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      step={1}
                      value={draft.tool_result_compact_retention_days}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (!Number.isNaN(n)) {
                          patchRunning({
                            tool_result_compact_retention_days: n,
                          });
                        }
                      }}
                    />
                  </Field>
                  <Field
                    label="/history 最大长度 (history_max_length)"
                    hint=">= 1000."
                  >
                    <Input
                      type="number"
                      min={1000}
                      step={500}
                      value={draft.history_max_length}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (!Number.isNaN(n)) {
                          patchRunning({ history_max_length: n });
                        }
                      }}
                    />
                  </Field>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Embedding</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <Field label="后端 (backend)">
                    <Input
                      value={draft.embedding_config.backend}
                      onChange={(e) =>
                        patchEmbedding({ backend: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="模型名 (model_name)">
                    <Input
                      value={draft.embedding_config.model_name}
                      onChange={(e) =>
                        patchEmbedding({ model_name: e.target.value })
                      }
                    />
                  </Field>
                  <Field
                    label="API Key (api_key)"
                    hint="写入 agent 配置, 请妥善保管."
                    className="md:col-span-2"
                  >
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={draft.embedding_config.api_key}
                      onChange={(e) =>
                        patchEmbedding({ api_key: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Base URL (base_url)" className="md:col-span-2">
                    <Input
                      value={draft.embedding_config.base_url}
                      onChange={(e) =>
                        patchEmbedding({ base_url: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="维度 (dimensions)">
                    <Input
                      type="number"
                      min={1}
                      step={256}
                      value={draft.embedding_config.dimensions}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (!Number.isNaN(n)) {
                          patchEmbedding({ dimensions: n });
                        }
                      }}
                    />
                  </Field>
                  <Field label="最大缓存条数 (max_cache_size)">
                    <Input
                      type="number"
                      min={1}
                      step={100}
                      value={draft.embedding_config.max_cache_size}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (!Number.isNaN(n)) {
                          patchEmbedding({ max_cache_size: n });
                        }
                      }}
                    />
                  </Field>
                  <Field label="Embedding 最大输入长度 (max_input_length)">
                    <Input
                      type="number"
                      min={1}
                      step={512}
                      value={draft.embedding_config.max_input_length}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (!Number.isNaN(n)) {
                          patchEmbedding({ max_input_length: n });
                        }
                      }}
                    />
                  </Field>
                  <Field label="批大小 (max_batch_size)">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={draft.embedding_config.max_batch_size}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (!Number.isNaN(n)) {
                          patchEmbedding({ max_batch_size: n });
                        }
                      }}
                    />
                  </Field>
                  <Field label="启用缓存 (enable_cache)">
                    <div className="flex items-center gap-2 pt-1">
                      <Switch
                        checked={draft.embedding_config.enable_cache}
                        onCheckedChange={(v) =>
                          patchEmbedding({ enable_cache: v })
                        }
                      />
                    </div>
                  </Field>
                  <Field label="使用自定义维度 (use_dimensions)">
                    <div className="flex items-center gap-2 pt-1">
                      <Switch
                        checked={draft.embedding_config.use_dimensions}
                        onCheckedChange={(v) =>
                          patchEmbedding({ use_dimensions: v })
                        }
                      />
                    </div>
                  </Field>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">系统提示文件</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    每行一个相对于工作区的 Markdown 文件名, 将并入系统提示.
                    文件内容可在{" "}
                    <Link
                      href="/agent/workspace"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      工作区
                    </Link>{" "}
                    编辑.
                  </p>
                  {filesQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">
                      加载系统提示文件列表...
                    </p>
                  ) : (
                    <>
                      {filesQuery.isError ? (
                        <Alert variant="destructive">
                          <AlertTitle>列表加载失败</AlertTitle>
                          <AlertDescription>
                            {filesQuery.error.message}
                          </AlertDescription>
                        </Alert>
                      ) : null}
                      <Textarea
                        value={promptText}
                        onChange={(e) => {
                          setPromptText(e.target.value);
                          setPromptDirty(true);
                        }}
                        rows={8}
                        className="font-mono text-sm"
                        placeholder="例如: HEARTBEAT.md"
                      />
                    </>
                  )}
                </CardContent>
              </Card>

              <Separator className="my-2" />
            </>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
