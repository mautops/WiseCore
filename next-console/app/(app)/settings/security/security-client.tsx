"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type {
  SkillScannerConfig,
  ToolGuardConfig,
  ToolGuardRuleConfig,
} from "@/lib/security-api";
import { securityApi } from "@/lib/security-api";
import { useAppShell } from "../../app-shell";
import { SecurityToolbar } from "./security-toolbar";
import {
  applyGuardedToolsMode,
  guardedToolsMode,
  linesFromList,
  listFromLines,
  QK_BLOCKED_HISTORY,
  QK_BUILTIN_RULES,
  QK_FILE_GUARD,
  QK_SKILL_SCANNER,
  QK_TOOL_GUARD,
  type GuardedToolsMode,
} from "./security-domain";
import {
  ChevronDownIcon,
  Loader2Icon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

function emptyRule(): ToolGuardRuleConfig {
  return {
    id: "",
    tools: [],
    params: [],
    category: "command_injection",
    severity: "HIGH",
    patterns: [],
    exclude_patterns: [],
    description: "",
    remediation: "",
  };
}

export function SecurityClient() {
  const queryClient = useQueryClient();
  const { showLeftSidebar, toggleLeftSidebar } = useAppShell();

  const toolGuardQuery = useQuery({
    queryKey: QK_TOOL_GUARD,
    queryFn: () => securityApi.getToolGuard(),
  });
  const builtinQuery = useQuery({
    queryKey: QK_BUILTIN_RULES,
    queryFn: () => securityApi.getBuiltinRules(),
  });
  const fileGuardQuery = useQuery({
    queryKey: QK_FILE_GUARD,
    queryFn: () => securityApi.getFileGuard(),
  });
  const skillScannerQuery = useQuery({
    queryKey: QK_SKILL_SCANNER,
    queryFn: () => securityApi.getSkillScanner(),
  });
  const blockedQuery = useQuery({
    queryKey: QK_BLOCKED_HISTORY,
    queryFn: () => securityApi.getBlockedHistory(),
  });

  const [tgDraft, setTgDraft] = useState<ToolGuardConfig | null>(null);
  const [fgPathsText, setFgPathsText] = useState("");
  const [fgEnabled, setFgEnabled] = useState(true);
  const [scDraft, setScDraft] = useState<SkillScannerConfig | null>(null);

  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleEdit, setRuleEdit] = useState<ToolGuardRuleConfig | null>(null);
  const [ruleIdx, setRuleIdx] = useState<number | null>(null);

  const [wlOpen, setWlOpen] = useState(false);
  const [wlName, setWlName] = useState("");
  const [wlHash, setWlHash] = useState("");

  useEffect(() => {
    const d = toolGuardQuery.data;
    if (d) setTgDraft(d);
  }, [toolGuardQuery.data]);

  useEffect(() => {
    const d = fileGuardQuery.data;
    if (d) {
      setFgEnabled(d.enabled);
      setFgPathsText(linesFromList(d.paths));
    }
  }, [fileGuardQuery.data]);

  useEffect(() => {
    const d = skillScannerQuery.data;
    if (d) setScDraft(d);
  }, [skillScannerQuery.data]);

  const tgMode = tgDraft ? guardedToolsMode(tgDraft) : "default";

  const invalidateAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: QK_TOOL_GUARD });
    void queryClient.invalidateQueries({ queryKey: QK_BUILTIN_RULES });
    void queryClient.invalidateQueries({ queryKey: QK_FILE_GUARD });
    void queryClient.invalidateQueries({ queryKey: QK_SKILL_SCANNER });
    void queryClient.invalidateQueries({ queryKey: QK_BLOCKED_HISTORY });
  }, [queryClient]);

  const fetching =
    toolGuardQuery.isFetching ||
    builtinQuery.isFetching ||
    fileGuardQuery.isFetching ||
    skillScannerQuery.isFetching ||
    blockedQuery.isFetching;

  const putTg = useMutation({
    mutationFn: (body: ToolGuardConfig) => securityApi.putToolGuard(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QK_TOOL_GUARD });
    },
  });

  const putFg = useMutation({
    mutationFn: () =>
      securityApi.putFileGuard({
        enabled: fgEnabled,
        paths: listFromLines(fgPathsText),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QK_FILE_GUARD });
    },
  });

  const putSc = useMutation({
    mutationFn: (body: SkillScannerConfig) => securityApi.putSkillScanner(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QK_SKILL_SCANNER });
    },
  });

  const clearHistory = useMutation({
    mutationFn: () => securityApi.clearBlockedHistory(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QK_BLOCKED_HISTORY });
    },
  });

  const removeBlocked = useMutation({
    mutationFn: (index: number) => securityApi.removeBlockedEntry(index),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QK_BLOCKED_HISTORY });
    },
  });

  const addWl = useMutation({
    mutationFn: () =>
      securityApi.addWhitelist(wlName.trim(), wlHash.trim() || undefined),
    onSuccess: async () => {
      setWlOpen(false);
      setWlName("");
      setWlHash("");
      await queryClient.invalidateQueries({ queryKey: QK_SKILL_SCANNER });
    },
  });

  const removeWl = useMutation({
    mutationFn: (name: string) => securityApi.removeWhitelist(name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QK_SKILL_SCANNER });
    },
  });

  const setTgMode = (mode: GuardedToolsMode) => {
    setTgDraft((prev) => {
      if (!prev) return prev;
      if (mode === "list") {
        const lines = linesFromList(prev.guarded_tools ?? []);
        return applyGuardedToolsMode(prev, "list", lines);
      }
      return applyGuardedToolsMode(prev, mode, "");
    });
  };

  const saveRule = () => {
    if (!ruleEdit || !tgDraft) return;
    const id = ruleEdit.id.trim();
    if (!id) return;
    const next = { ...ruleEdit, id };
    const rules = [...tgDraft.custom_rules];
    if (ruleIdx !== null && ruleIdx >= 0) rules[ruleIdx] = next;
    else rules.push(next);
    setTgDraft({ ...tgDraft, custom_rules: rules });
    setRuleOpen(false);
    setRuleEdit(null);
    setRuleIdx(null);
  };

  const openNewRule = () => {
    setRuleIdx(null);
    setRuleEdit(emptyRule());
    setRuleOpen(true);
  };

  const openEditRule = (idx: number) => {
    if (!tgDraft) return;
    setRuleIdx(idx);
    setRuleEdit({ ...tgDraft.custom_rules[idx] });
    setRuleOpen(true);
  };

  const deleteRule = (idx: number) => {
    if (!tgDraft) return;
    const rules = tgDraft.custom_rules.filter((_, i) => i !== idx);
    setTgDraft({ ...tgDraft, custom_rules: rules });
  };

  const [biOpen, setBiOpen] = useState(false);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background text-base">
      <SecurityToolbar
        showLeftSidebar={showLeftSidebar}
        onToggleLeftSidebar={toggleLeftSidebar}
        onRefresh={invalidateAll}
        refreshing={fetching}
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground">
            Tool Guard, File Guard 与 Skill 扫描与{" "}
            <Link href="/agent/tools" className="text-primary underline">
              内置工具
            </Link>{" "}
            协同, 规则变更后保存生效.
          </p>

          {toolGuardQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>加载 Tool Guard 失败</AlertTitle>
              <AlertDescription>
                {toolGuardQuery.error instanceof Error
                  ? toolGuardQuery.error.message
                  : "未知错误"}
              </AlertDescription>
            </Alert>
          ) : null}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tool Guard</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {toolGuardQuery.isLoading || !tgDraft ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" />
                  加载中
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm">启用 Tool Guard</span>
                    <Switch
                      checked={tgDraft.enabled}
                      onCheckedChange={(v) =>
                        setTgDraft({ ...tgDraft, enabled: v })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm font-medium leading-none">
                      保护范围
                    </span>
                    <Select
                      value={tgMode}
                      onValueChange={(v) => setTgMode(v as GuardedToolsMode)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">内置默认工具集</SelectItem>
                        <SelectItem value="none">不保护任何工具</SelectItem>
                        <SelectItem value="list">仅列表中的工具</SelectItem>
                      </SelectContent>
                    </Select>
                    {tgMode === "list" ? (
                      <Textarea
                        value={linesFromList(tgDraft.guarded_tools ?? [])}
                        onChange={(e) =>
                          setTgDraft(
                            applyGuardedToolsMode(
                              tgDraft,
                              "list",
                              e.target.value,
                            ),
                          )
                        }
                        placeholder="每行一个工具名"
                        rows={4}
                        className="font-mono text-sm"
                      />
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm font-medium leading-none">
                      全局拒绝的工具名 (每行)
                    </span>
                    <Textarea
                      value={linesFromList(tgDraft.denied_tools)}
                      onChange={(e) =>
                        setTgDraft({
                          ...tgDraft,
                          denied_tools: listFromLines(e.target.value),
                        })
                      }
                      rows={3}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm font-medium leading-none">
                      禁用的规则 ID (每行或逗号分隔)
                    </span>
                    <Textarea
                      value={linesFromList(tgDraft.disabled_rules)}
                      onChange={(e) =>
                        setTgDraft({
                          ...tgDraft,
                          disabled_rules: listFromLines(
                            e.target.value.replace(/,/g, "\n"),
                          ),
                        })
                      }
                      rows={2}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium leading-none">
                        自定义规则
                      </span>
                      <Button size="sm" variant="outline" onClick={openNewRule}>
                        添加规则
                      </Button>
                    </div>
                    {tgDraft.custom_rules.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        暂无自定义规则
                      </p>
                    ) : (
                      <div className="space-y-2 rounded-md border border-border p-2">
                        {tgDraft.custom_rules.map((r, i) => (
                          <div
                            key={`${r.id}-${i}`}
                            className="flex items-start justify-between gap-2 border-b border-border pb-2 last:border-0 last:pb-0"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-mono text-sm font-medium">
                                {r.id}
                              </p>
                              <p className="line-clamp-2 text-xs text-muted-foreground">
                                {r.description || r.category}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                onClick={() => openEditRule(i)}
                              >
                                <PencilIcon className="size-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                onClick={() => deleteRule(i)}
                              >
                                <Trash2Icon className="size-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {putTg.isError ? (
                    <Alert variant="destructive">
                      <AlertTitle>保存失败</AlertTitle>
                      <AlertDescription>
                        {putTg.error instanceof Error
                          ? putTg.error.message
                          : "未知错误"}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <Button
                    disabled={putTg.isPending}
                    onClick={() => tgDraft && putTg.mutate(tgDraft)}
                  >
                    {putTg.isPending ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : null}
                    保存 Tool Guard
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">内置规则 (只读)</CardTitle>
            </CardHeader>
            <CardContent>
              {builtinQuery.isLoading ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : builtinQuery.isError ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    {builtinQuery.error instanceof Error
                      ? builtinQuery.error.message
                      : "加载失败"}
                  </AlertDescription>
                </Alert>
              ) : (
                <Collapsible open={biOpen} onOpenChange={setBiOpen}>
                  <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm font-medium">
                    <ChevronDownIcon
                      className={`size-4 transition-transform ${biOpen ? "rotate-180" : ""}`}
                    />
                    展开 {builtinQuery.data?.length ?? 0} 条内置规则
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4">
                    <ScrollArea className="max-h-[320px] rounded-md border border-border p-2">
                      <ul className="space-y-3 text-sm">
                        {(builtinQuery.data ?? []).map((r) => (
                          <li
                            key={r.id}
                            className="border-b border-border/60 pb-3 last:border-0"
                          >
                            <p className="font-mono font-medium">{r.id}</p>
                            <p className="text-xs text-muted-foreground">
                              {r.severity} · {r.category}
                            </p>
                            {r.description ? (
                              <p className="mt-1 text-xs">{r.description}</p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">File Guard</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {fileGuardQuery.isLoading ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm">启用路径保护</span>
                    <Switch
                      checked={fgEnabled}
                      onCheckedChange={setFgEnabled}
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm font-medium leading-none">
                      敏感路径 (每行)
                    </span>
                    <Textarea
                      value={fgPathsText}
                      onChange={(e) => setFgPathsText(e.target.value)}
                      rows={8}
                      className="font-mono text-sm"
                    />
                  </div>
                  {putFg.isError ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        {putFg.error instanceof Error
                          ? putFg.error.message
                          : "保存失败"}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <Button
                    disabled={putFg.isPending}
                    onClick={() => putFg.mutate()}
                  >
                    {putFg.isPending ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : null}
                    保存 File Guard
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Skill 扫描</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {skillScannerQuery.isLoading || !scDraft ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <>
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="space-y-2">
                      <span className="text-sm font-medium leading-none">
                        模式
                      </span>
                      <Select
                        value={scDraft.mode}
                        onValueChange={(v) =>
                          setScDraft({
                            ...scDraft,
                            mode: v as SkillScannerConfig["mode"],
                          })
                        }
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="block">block</SelectItem>
                          <SelectItem value="warn">warn</SelectItem>
                          <SelectItem value="off">off</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <span className="text-sm font-medium leading-none">
                        超时 (秒)
                      </span>
                      <Input
                        type="number"
                        min={5}
                        max={300}
                        className="w-[120px]"
                        value={scDraft.timeout}
                        onChange={(e) =>
                          setScDraft({
                            ...scDraft,
                            timeout: Number(e.target.value) || 30,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium leading-none">
                        白名单
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setWlOpen(true)}
                      >
                        添加技能
                      </Button>
                    </div>
                    {scDraft.whitelist.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        暂无白名单
                      </p>
                    ) : (
                      <div className="space-y-2 rounded-md border border-border p-2">
                        {scDraft.whitelist.map((w) => (
                          <div
                            key={w.skill_name}
                            className="flex items-center justify-between gap-2 text-sm"
                          >
                            <span className="truncate font-mono">
                              {w.skill_name}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={removeWl.isPending}
                              onClick={() => removeWl.mutate(w.skill_name)}
                            >
                              移除
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {putSc.isError ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        {putSc.error instanceof Error
                          ? putSc.error.message
                          : "保存失败"}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <Button
                    disabled={putSc.isPending}
                    onClick={() => putSc.mutate(scDraft)}
                  >
                    {putSc.isPending ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : null}
                    保存 Skill 扫描
                  </Button>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium leading-none">
                        拦截 / 警告记录
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          clearHistory.isPending ||
                          (blockedQuery.data?.length ?? 0) === 0
                        }
                        onClick={() => clearHistory.mutate()}
                      >
                        清空全部
                      </Button>
                    </div>
                    {blockedQuery.isLoading ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : blockedQuery.isError ? (
                      <Alert variant="destructive">
                        <AlertDescription>
                          {blockedQuery.error instanceof Error
                            ? blockedQuery.error.message
                            : "加载失败"}
                        </AlertDescription>
                      </Alert>
                    ) : (blockedQuery.data?.length ?? 0) === 0 ? (
                      <p className="text-sm text-muted-foreground">暂无记录</p>
                    ) : (
                      <div className="space-y-2 rounded-md border border-border p-2">
                        {(blockedQuery.data ?? []).map((rec, i) => (
                          <div
                            key={`${rec.skill_name}-${rec.blocked_at}-${i}`}
                            className="flex flex-wrap items-end justify-between gap-2 border-b border-border/60 pb-2 text-sm last:border-0"
                          >
                            <div className="min-w-0">
                              <p className="font-mono font-medium">
                                {rec.skill_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {rec.blocked_at} · {rec.action} ·{" "}
                                {rec.max_severity}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={removeBlocked.isPending}
                              onClick={() => removeBlocked.mutate(i)}
                            >
                              删除
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {ruleIdx !== null ? "编辑规则" : "新建规则"}
            </DialogTitle>
            <DialogDescription>
              与后端 ToolGuardRuleConfig 一致, patterns 每行一条.
            </DialogDescription>
          </DialogHeader>
          {ruleEdit ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-sm font-medium">id</span>
                <Input
                  value={ruleEdit.id}
                  onChange={(e) =>
                    setRuleEdit({ ...ruleEdit, id: e.target.value })
                  }
                  className="font-mono"
                />
              </div>
              <div className="space-y-1">
                <span className="text-sm font-medium">tools (每行)</span>
                <Textarea
                  rows={2}
                  value={linesFromList(ruleEdit.tools)}
                  onChange={(e) =>
                    setRuleEdit({
                      ...ruleEdit,
                      tools: listFromLines(e.target.value),
                    })
                  }
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1">
                <span className="text-sm font-medium">params (每行)</span>
                <Textarea
                  rows={2}
                  value={linesFromList(ruleEdit.params)}
                  onChange={(e) =>
                    setRuleEdit({
                      ...ruleEdit,
                      params: listFromLines(e.target.value),
                    })
                  }
                  className="font-mono text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-sm font-medium">category</span>
                  <Input
                    value={ruleEdit.category}
                    onChange={(e) =>
                      setRuleEdit({ ...ruleEdit, category: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-sm font-medium">severity</span>
                  <Input
                    value={ruleEdit.severity}
                    onChange={(e) =>
                      setRuleEdit({ ...ruleEdit, severity: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-sm font-medium">patterns (每行)</span>
                <Textarea
                  rows={4}
                  value={linesFromList(ruleEdit.patterns)}
                  onChange={(e) =>
                    setRuleEdit({
                      ...ruleEdit,
                      patterns: listFromLines(e.target.value),
                    })
                  }
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1">
                <span className="text-sm font-medium">
                  exclude_patterns (每行)
                </span>
                <Textarea
                  rows={2}
                  value={linesFromList(ruleEdit.exclude_patterns)}
                  onChange={(e) =>
                    setRuleEdit({
                      ...ruleEdit,
                      exclude_patterns: listFromLines(e.target.value),
                    })
                  }
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1">
                <span className="text-sm font-medium">description</span>
                <Textarea
                  rows={2}
                  value={ruleEdit.description}
                  onChange={(e) =>
                    setRuleEdit({ ...ruleEdit, description: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <span className="text-sm font-medium">remediation</span>
                <Textarea
                  rows={2}
                  value={ruleEdit.remediation}
                  onChange={(e) =>
                    setRuleEdit({ ...ruleEdit, remediation: e.target.value })
                  }
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleOpen(false)}>
              取消
            </Button>
            <Button onClick={saveRule}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={wlOpen} onOpenChange={setWlOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>白名单技能</DialogTitle>
            <DialogDescription>
              与后端 SkillScannerWhitelistEntry 一致, content_hash
              可留空表示任意内容.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-sm font-medium">skill_name</span>
              <Input
                value={wlName}
                onChange={(e) => setWlName(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1">
              <span className="text-sm font-medium">content_hash (可选)</span>
              <Input
                value={wlHash}
                onChange={(e) => setWlHash(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            {addWl.isError ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {addWl.error instanceof Error
                    ? addWl.error.message
                    : "添加失败"}
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWlOpen(false)}>
              取消
            </Button>
            <Button
              disabled={!wlName.trim() || addWl.isPending}
              onClick={() => addWl.mutate()}
            >
              {addWl.isPending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : null}
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
