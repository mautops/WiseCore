"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ConsoleMirrorPanel,
  ConsoleMirrorScrollPadding,
  consolePrimaryButtonClass,
} from "@/components/console-mirror";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  mergeToolGuardRules,
  QK_BLOCKED_HISTORY,
  QK_BUILTIN_RULES,
  QK_FILE_GUARD,
  QK_SKILL_SCANNER,
  QK_TOOL_GUARD,
  type GuardedToolsMode,
  type MergedToolGuardRule,
} from "./security-domain";
import {
  EyeIcon,
  FileLock2Icon,
  Loader2Icon,
  PencilIcon,
  PlusCircleIcon,
  ScanLineIcon,
  ShieldIcon,
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

  const [previewRule, setPreviewRule] = useState<MergedToolGuardRule | null>(
    null,
  );

  const mergedRules = useMemo(() => {
    if (!tgDraft || !builtinQuery.data) return [];
    return mergeToolGuardRules(
      builtinQuery.data,
      tgDraft.custom_rules,
      tgDraft.disabled_rules,
    );
  }, [tgDraft, builtinQuery.data]);

  const toggleMergedRule = (ruleId: string, currentlyDisabled: boolean) => {
    setTgDraft((prev) => {
      if (!prev) return prev;
      const next = new Set(prev.disabled_rules);
      if (currentlyDisabled) next.delete(ruleId);
      else next.add(ruleId);
      return { ...prev, disabled_rules: [...next] };
    });
  };

  const deleteCustomRuleById = (ruleId: string) => {
    setTgDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        custom_rules: prev.custom_rules.filter((r) => r.id !== ruleId),
        disabled_rules: prev.disabled_rules.filter((id) => id !== ruleId),
      };
    });
  };

  const openEditMergedRule = (record: MergedToolGuardRule) => {
    if (record.source !== "custom" || !tgDraft) return;
    const idx = tgDraft.custom_rules.findIndex((r) => r.id === record.id);
    if (idx < 0) return;
    setRuleIdx(idx);
    setRuleEdit({ ...tgDraft.custom_rules[idx] });
    setRuleOpen(true);
  };

  const handleResetToolGuard = () => {
    void toolGuardQuery.refetch();
    void builtinQuery.refetch();
  };

  const severityBadgeClass = (sev: string) => {
    switch (sev) {
      case "CRITICAL":
        return "bg-red-600/15 text-red-700 dark:text-red-400";
      case "HIGH":
        return "bg-orange-500/15 text-orange-700 dark:text-orange-400";
      case "MEDIUM":
        return "bg-amber-500/15 text-amber-800 dark:text-amber-400";
      case "LOW":
        return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full min-h-0 flex-1 flex-col bg-background text-base">
        <SecurityToolbar
          showLeftSidebar={showLeftSidebar}
          onToggleLeftSidebar={toggleLeftSidebar}
          onRefresh={invalidateAll}
          refreshing={fetching}
        />

        <ScrollArea className="min-h-0 flex-1">
          <ConsoleMirrorScrollPadding className="space-y-0">
            <header className="mb-5">
              <h1 className="text-[22px] font-bold tracking-tight text-foreground">
                安全
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Tool Guard, File Guard 与 Skill 扫描与{" "}
                <Link
                  href="/agent/tools"
                  className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  内置工具
                </Link>{" "}
                协同, 在「Tool Guard」页签保存规则后生效.
              </p>
            </header>

            <Tabs defaultValue="tool-guard" className="w-full">
              <TabsList
                variant="line"
                className="mb-5 h-auto min-h-10 w-full flex-wrap justify-start gap-6 rounded-none border-0 border-b border-border/50 bg-transparent p-0"
              >
                <TabsTrigger
                  value="tool-guard"
                  className="relative flex-none gap-1.5 rounded-none border-0 bg-transparent px-1 py-2.5 text-sm font-medium text-muted-foreground shadow-none transition-colors duration-150 hover:text-foreground data-[state=active]:font-semibold data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:after:bg-primary [&_svg]:size-4"
                >
                  <ShieldIcon className="size-4" />
                  Tool Guard
                </TabsTrigger>
                <TabsTrigger
                  value="file-guard"
                  className="relative flex-none gap-1.5 rounded-none border-0 bg-transparent px-1 py-2.5 text-sm font-medium text-muted-foreground shadow-none transition-colors duration-150 hover:text-foreground data-[state=active]:font-semibold data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:after:bg-primary [&_svg]:size-4"
                >
                  <FileLock2Icon className="size-4" />
                  文件防护
                </TabsTrigger>
                <TabsTrigger
                  value="skill-scanner"
                  className="relative flex-none gap-1.5 rounded-none border-0 bg-transparent px-1 py-2.5 text-sm font-medium text-muted-foreground shadow-none transition-colors duration-150 hover:text-foreground data-[state=active]:font-semibold data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:after:bg-primary [&_svg]:size-4"
                >
                  <ScanLineIcon className="size-4" />
                  Skill 扫描
                </TabsTrigger>
              </TabsList>

              <TabsContent value="tool-guard" className="mt-0 space-y-0">
                <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                  配置需拦截的高风险工具调用与自定义规则.
                  内置规则与自定义规则合并展示, 可通过开关单独禁用某条规则.
                </p>

                {toolGuardQuery.isError ? (
                  <Alert variant="destructive" className="mb-5">
                    <AlertTitle>加载 Tool Guard 失败</AlertTitle>
                    <AlertDescription>
                      {toolGuardQuery.error instanceof Error
                        ? toolGuardQuery.error.message
                        : "未知错误"}
                    </AlertDescription>
                  </Alert>
                ) : null}
                {builtinQuery.isError ? (
                  <Alert variant="destructive" className="mb-5">
                    <AlertTitle>加载内置规则失败</AlertTitle>
                    <AlertDescription>
                      {builtinQuery.error instanceof Error
                        ? builtinQuery.error.message
                        : "未知错误"}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <ConsoleMirrorPanel className="mb-5 space-y-5">
                  {toolGuardQuery.isLoading || !tgDraft ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2Icon className="size-4 animate-spin" />
                      加载中
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm font-medium text-foreground">
                          启用 Tool Guard
                        </span>
                        <Switch
                          checked={tgDraft.enabled}
                          onCheckedChange={(v) =>
                            setTgDraft({ ...tgDraft, enabled: v })
                          }
                          className="transition-all duration-200"
                        />
                      </div>
                      <div className="space-y-2">
                        <span className="text-sm font-medium text-foreground">
                          保护范围
                        </span>
                        <Select
                          value={tgMode}
                          onValueChange={(v) =>
                            setTgMode(v as GuardedToolsMode)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">
                              内置默认工具集
                            </SelectItem>
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
                        <span className="text-sm font-medium text-foreground">
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
                    </>
                  )}
                </ConsoleMirrorPanel>

                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-foreground">
                    规则列表
                  </h2>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-primary px-4 text-sm font-medium shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md active:scale-95"
                    onClick={openNewRule}
                    disabled={!tgDraft?.enabled}
                  >
                    <PlusCircleIcon className="size-4" />
                    添加规则
                  </Button>
                </div>

                <ConsoleMirrorPanel className="overflow-hidden rounded-lg border border-border/50 p-0 shadow-sm">
                  {toolGuardQuery.isLoading ||
                  builtinQuery.isLoading ||
                  !tgDraft ? (
                    <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                      <Loader2Icon className="size-4 animate-spin" />
                      加载规则
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="border-b border-border/50 bg-muted/30">
                          <tr>
                            <th className="px-4 py-3 text-sm font-semibold text-foreground">
                              规则 ID
                            </th>
                            <th className="px-4 py-3 text-sm font-semibold text-foreground">
                              严重级别
                            </th>
                            <th className="px-4 py-3 text-sm font-semibold text-foreground">
                              描述
                            </th>
                            <th className="px-4 py-3 text-sm font-semibold text-foreground">
                              来源
                            </th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                              操作
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {mergedRules.map((r) => (
                            <tr
                              key={`${r.source}-${r.id}`}
                              className={`group border-b border-border/50 last:border-0 transition-colors duration-150 hover:bg-accent/50 ${r.disabled ? "opacity-40" : ""}`}
                            >
                              <td className="max-w-[220px] truncate px-4 py-3 font-mono text-xs">
                                {r.id}
                              </td>
                              <td className="px-4 py-3">
                                <Badge
                                  variant="secondary"
                                  className={severityBadgeClass(r.severity)}
                                >
                                  {r.severity}
                                </Badge>
                              </td>
                              <td
                                className="max-w-[280px] truncate px-4 py-3 text-muted-foreground"
                                title={r.description}
                              >
                                {r.description || r.category || "—"}
                              </td>
                              <td className="px-4 py-3">
                                <Badge
                                  variant="outline"
                                  className={
                                    r.source === "builtin"
                                      ? "border-blue-500/50 bg-blue-500/15 text-blue-700 dark:text-blue-300"
                                      : "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                  }
                                >
                                  {r.source === "builtin" ? "内置" : "自定义"}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap items-center justify-end gap-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span>
                                        <Switch
                                          checked={!r.disabled}
                                          disabled={!tgDraft.enabled}
                                          onCheckedChange={() =>
                                            toggleMergedRule(r.id, r.disabled)
                                          }
                                          className="transition-all duration-200"
                                        />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {r.disabled ? "启用规则" : "禁用规则"}
                                    </TooltipContent>
                                  </Tooltip>
                                  {r.source === "builtin" ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 gap-1 px-2 text-sm transition-all duration-150 hover:bg-muted active:scale-95"
                                      disabled={!tgDraft.enabled}
                                      onClick={() => setPreviewRule(r)}
                                    >
                                      <EyeIcon className="size-3.5" />
                                      预览
                                    </Button>
                                  ) : (
                                    <>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 transition-all duration-150 hover:bg-primary/10 hover:text-primary active:scale-90"
                                        disabled={!tgDraft.enabled}
                                        onClick={() => openEditMergedRule(r)}
                                      >
                                        <PencilIcon className="size-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 text-destructive transition-all duration-150 hover:bg-destructive/10 active:scale-90"
                                        disabled={!tgDraft.enabled}
                                        onClick={() =>
                                          deleteCustomRuleById(r.id)
                                        }
                                      >
                                        <Trash2Icon className="size-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </ConsoleMirrorPanel>

                {putTg.isError ? (
                  <Alert variant="destructive" className="mt-4">
                    <AlertTitle>保存失败</AlertTitle>
                    <AlertDescription>
                      {putTg.error instanceof Error
                        ? putTg.error.message
                        : "未知错误"}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <div className="mt-2 flex justify-end gap-2 border-t border-border/50 pt-4">
                  <Button
                    variant="outline"
                    disabled={putTg.isPending}
                    onClick={handleResetToolGuard}
                  >
                    重置
                  </Button>
                  <Button
                    className={consolePrimaryButtonClass()}
                    disabled={putTg.isPending || !tgDraft}
                    onClick={() => tgDraft && putTg.mutate(tgDraft)}
                  >
                    {putTg.isPending ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : null}
                    保存
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="file-guard" className="mt-0">
                <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                  限制智能体可读取或修改的文件路径, 降低敏感文件泄露风险.
                </p>
                <ConsoleMirrorPanel className="space-y-4">
                  {fileGuardQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2Icon className="size-4 animate-spin" />
                      加载中
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm font-medium text-foreground">
                          启用路径保护
                        </span>
                        <Switch
                          checked={fgEnabled}
                          onCheckedChange={setFgEnabled}
                          className="transition-all duration-200"
                        />
                      </div>
                      <div className="space-y-2">
                        <span className="text-sm font-medium text-foreground">
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
                        className={consolePrimaryButtonClass()}
                        disabled={putFg.isPending}
                        onClick={() => putFg.mutate()}
                      >
                        {putFg.isPending ? (
                          <Loader2Icon className="size-4 animate-spin" />
                        ) : null}
                        保存
                      </Button>
                    </>
                  )}
                </ConsoleMirrorPanel>
              </TabsContent>

              <TabsContent value="skill-scanner" className="mt-0">
                <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                  扫描工作区自定义 Skill 的静态风险 (例如可疑外部调用),
                  可配置拦截, 警告或关闭, 并维护白名单与扫描记录.
                </p>
                <ConsoleMirrorPanel className="space-y-4">
                  {skillScannerQuery.isLoading || !scDraft ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2Icon className="size-4 animate-spin" />
                      加载中
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-end gap-4">
                        <div className="space-y-2">
                          <span className="text-sm font-medium leading-none text-foreground">
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
                          <span className="text-sm font-medium leading-none text-foreground">
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
                          <span className="text-sm font-medium leading-none text-foreground">
                            白名单
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="transition-all duration-150 hover:bg-accent active:scale-95"
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
                          <div className="space-y-1.5 rounded-lg border border-border/50 bg-muted/20 p-2">
                            {scDraft.whitelist.map((w) => (
                              <div
                                key={w.skill_name}
                                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-accent/50"
                              >
                                <span className="truncate font-mono text-foreground">
                                  {w.skill_name}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs text-muted-foreground transition-all duration-150 hover:bg-destructive/10 hover:text-destructive active:scale-95"
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
                        className={consolePrimaryButtonClass()}
                        disabled={putSc.isPending}
                        onClick={() => putSc.mutate(scDraft)}
                      >
                        {putSc.isPending ? (
                          <Loader2Icon className="size-4 animate-spin" />
                        ) : null}
                        保存
                      </Button>

                      <Separator />

                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium leading-none text-foreground">
                            拦截 / 警告记录
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="transition-all duration-150 hover:bg-destructive/10 hover:text-destructive active:scale-95"
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
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2Icon className="size-4 animate-spin" />
                            加载中
                          </div>
                        ) : blockedQuery.isError ? (
                          <Alert variant="destructive">
                            <AlertDescription>
                              {blockedQuery.error instanceof Error
                                ? blockedQuery.error.message
                                : "加载失败"}
                            </AlertDescription>
                          </Alert>
                        ) : (blockedQuery.data?.length ?? 0) === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            暂无记录
                          </p>
                        ) : (
                          <div className="space-y-1.5 rounded-lg border border-border/50 bg-muted/20 p-2">
                            {(blockedQuery.data ?? []).map((rec, i) => (
                              <div
                                key={`${rec.skill_name}-${rec.blocked_at}-${i}`}
                                className="flex flex-wrap items-end justify-between gap-2 border-b border-border/50 px-2 py-2 text-sm last:border-0 transition-colors duration-150 hover:bg-accent/50"
                              >
                                <div className="min-w-0">
                                  <p className="font-mono font-medium text-foreground">
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
                                  className="h-7 px-2 text-xs text-muted-foreground transition-all duration-150 hover:bg-destructive/10 hover:text-destructive active:scale-95"
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
                </ConsoleMirrorPanel>
              </TabsContent>
            </Tabs>
          </ConsoleMirrorScrollPadding>
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
                  <span className="text-sm font-medium text-foreground">id</span>
                  <Input
                    value={ruleEdit.id}
                    onChange={(e) =>
                      setRuleEdit({ ...ruleEdit, id: e.target.value })
                    }
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-sm font-medium text-foreground">tools (每行)</span>
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
                  <span className="text-sm font-medium text-foreground">params (每行)</span>
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
                    <span className="text-sm font-medium text-foreground">category</span>
                    <Input
                      value={ruleEdit.category}
                      onChange={(e) =>
                        setRuleEdit({ ...ruleEdit, category: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-foreground">severity</span>
                    <Input
                      value={ruleEdit.severity}
                      onChange={(e) =>
                        setRuleEdit({ ...ruleEdit, severity: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-sm font-medium text-foreground">patterns (每行)</span>
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
                  <span className="text-sm font-medium text-foreground">
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
                  <span className="text-sm font-medium text-foreground">description</span>
                  <Textarea
                    rows={2}
                    value={ruleEdit.description}
                    onChange={(e) =>
                      setRuleEdit({ ...ruleEdit, description: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-sm font-medium text-foreground">remediation</span>
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
              <Button variant="outline" className="transition-all duration-150 hover:bg-accent active:scale-95" onClick={() => setRuleOpen(false)}>
                取消
              </Button>
              <Button className="bg-primary text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 active:scale-95" onClick={saveRule}>确定</Button>
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
                <span className="text-sm font-medium text-foreground">skill_name</span>
                <Input
                  value={wlName}
                  onChange={(e) => setWlName(e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1">
                <span className="text-sm font-medium text-foreground">content_hash (可选)</span>
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
              <Button variant="outline" className="transition-all duration-150 hover:bg-accent active:scale-95" onClick={() => setWlOpen(false)}>
                取消
              </Button>
              <Button
                className="bg-primary text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 active:scale-95"
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

        <Dialog
          open={previewRule != null}
          onOpenChange={(open) => {
            if (!open) setPreviewRule(null);
          }}
        >
          <DialogContent className="max-h-[85vh] overflow-y-auto text-base sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="break-all font-mono text-base">
                {previewRule?.id ?? "规则"}
              </DialogTitle>
              <DialogDescription>内置规则只读预览</DialogDescription>
            </DialogHeader>
            {previewRule ? (
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium text-foreground">严重级别</span>
                  <p className="mt-1 text-muted-foreground">
                    {previewRule.severity} · {previewRule.category}
                  </p>
                </div>
                {previewRule.description ? (
                  <div>
                    <span className="font-medium text-foreground">描述</span>
                    <p className="mt-1 text-muted-foreground">
                      {previewRule.description}
                    </p>
                  </div>
                ) : null}
                <div>
                  <span className="font-medium text-foreground">patterns</span>
                  <pre className="mt-1 max-h-40 overflow-auto rounded-md border border-border bg-muted/40 p-2 font-mono text-xs whitespace-pre-wrap">
                    {previewRule.patterns.length
                      ? previewRule.patterns.join("\n")
                      : "—"}
                  </pre>
                </div>
                <div>
                  <span className="font-medium text-foreground">
                    exclude_patterns
                  </span>
                  <pre className="mt-1 max-h-32 overflow-auto rounded-md border border-border bg-muted/40 p-2 font-mono text-xs whitespace-pre-wrap">
                    {previewRule.exclude_patterns.length
                      ? previewRule.exclude_patterns.join("\n")
                      : "—"}
                  </pre>
                </div>
                {previewRule.remediation ? (
                  <div>
                    <span className="font-medium text-foreground">
                      remediation
                    </span>
                    <p className="mt-1 text-muted-foreground">
                      {previewRule.remediation}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="outline" className="transition-all duration-150 hover:bg-accent active:scale-95" onClick={() => setPreviewRule(null)}>
                关闭
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
