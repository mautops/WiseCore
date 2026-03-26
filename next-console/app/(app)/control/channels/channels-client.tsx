"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ConsoleMirrorScrollPadding,
  ConsoleMirrorSectionHeader,
} from "@/components/console-mirror";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { channelsApi } from "@/lib/channels-api";
import { useAppShell } from "../../app-shell";
import { ChannelsToolbar } from "./channels-toolbar";
import {
  channelMatchesFilter,
  COMMON_CHANNEL_KEYS,
  isSecretFieldName,
  QK_CHANNELS,
  sortChannelKeys,
  stripBuiltin,
} from "./channels-domain";
import { Loader2Icon, PencilIcon } from "lucide-react";

const COMMON = new Set<string>(COMMON_CHANNEL_KEYS);

function ExtraValueEditor({
  k,
  v,
  onChange,
}: {
  k: string;
  v: unknown;
  onChange: (next: unknown) => void;
}) {
  if (v === null) {
    return (
      <Input
        type="number"
        step="any"
        value=""
        placeholder="(未设置, 留空保持 null)"
        className="font-mono text-sm"
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") onChange(null);
          else {
            const n = Number(raw);
            if (!Number.isNaN(n)) onChange(n);
          }
        }}
      />
    );
  }
  if (typeof v === "boolean") {
    return (
      <div className="flex items-center gap-2">
        <Switch checked={v} onCheckedChange={onChange} />
        <span className="text-sm text-muted-foreground">{v ? "是" : "否"}</span>
      </div>
    );
  }
  if (typeof v === "number") {
    return (
      <Input
        type="number"
        step="any"
        value={Number.isFinite(v) ? String(v) : ""}
        className="font-mono text-sm"
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return;
          const n = Number(raw);
          if (!Number.isNaN(n)) onChange(n);
        }}
      />
    );
  }
  if (typeof v === "string") {
    return (
      <Input
        type={isSecretFieldName(k) ? "password" : "text"}
        value={v}
        autoComplete="off"
        className="font-mono text-sm"
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (Array.isArray(v)) {
    return (
      <Textarea
        className="min-h-[100px] font-mono text-xs"
        value={JSON.stringify(v, null, 2)}
        spellCheck={false}
        onChange={(e) => {
          try {
            onChange(JSON.parse(e.target.value));
          } catch {
            /* keep editing */
          }
        }}
      />
    );
  }
  if (typeof v === "object") {
    return (
      <Textarea
        className="min-h-[120px] font-mono text-xs"
        value={JSON.stringify(v, null, 2)}
        spellCheck={false}
        onChange={(e) => {
          try {
            onChange(JSON.parse(e.target.value));
          } catch {
            /* keep editing */
          }
        }}
      />
    );
  }
  return (
    <Input
      value={String(v)}
      className="font-mono text-sm"
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function CommonFields({
  local,
  allowFromText,
  onPatch,
  onAllowFromText,
}: {
  local: Record<string, unknown>;
  allowFromText: string;
  onPatch: (key: string, value: unknown) => void;
  onAllowFromText: (v: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1.5 md:col-span-2">
        <div className="text-sm font-medium">启用</div>
        <div className="flex items-center gap-2">
          <Switch
            checked={Boolean(local.enabled)}
            onCheckedChange={(v) => onPatch("enabled", v)}
          />
        </div>
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <div className="text-sm font-medium">机器人前缀 (bot_prefix)</div>
        <Input
          value={typeof local.bot_prefix === "string" ? local.bot_prefix : ""}
          onChange={(e) => onPatch("bot_prefix", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <div className="text-sm font-medium">过滤工具消息</div>
        <div className="flex items-center gap-2">
          <Switch
            checked={Boolean(local.filter_tool_messages)}
            onCheckedChange={(v) => onPatch("filter_tool_messages", v)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="text-sm font-medium">过滤思考过程</div>
        <div className="flex items-center gap-2">
          <Switch
            checked={Boolean(local.filter_thinking)}
            onCheckedChange={(v) => onPatch("filter_thinking", v)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="text-sm font-medium">私聊策略 (dm_policy)</div>
        <Select
          value={
            local.dm_policy === "allowlist" || local.dm_policy === "open"
              ? (local.dm_policy as string)
              : "open"
          }
          onValueChange={(v) => onPatch("dm_policy", v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">open</SelectItem>
            <SelectItem value="allowlist">allowlist</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <div className="text-sm font-medium">群聊策略 (group_policy)</div>
        <Select
          value={
            local.group_policy === "allowlist" || local.group_policy === "open"
              ? (local.group_policy as string)
              : "open"
          }
          onValueChange={(v) => onPatch("group_policy", v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">open</SelectItem>
            <SelectItem value="allowlist">allowlist</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <div className="text-sm font-medium">允许列表 (allow_from)</div>
        <p className="text-xs text-muted-foreground">
          每行一个 ID, 与策略 allowlist 配合使用.
        </p>
        <Textarea
          value={allowFromText}
          onChange={(e) => onAllowFromText(e.target.value)}
          rows={4}
          className="font-mono text-sm"
          placeholder="一行一个"
        />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <div className="text-sm font-medium">拒绝提示 (deny_message)</div>
        <Input
          value={
            typeof local.deny_message === "string" ? local.deny_message : ""
          }
          onChange={(e) => onPatch("deny_message", e.target.value)}
        />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <div className="text-sm font-medium">
          需要 @ 才响应 (require_mention)
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={Boolean(local.require_mention)}
            onCheckedChange={(v) => onPatch("require_mention", v)}
          />
        </div>
      </div>
    </div>
  );
}

export function ChannelsClient() {
  const queryClient = useQueryClient();
  const { showLeftSidebar, toggleLeftSidebar } = useAppShell();
  const [filterQuery, setFilterQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, unknown>>({});
  const [allowFromText, setAllowFromText] = useState("");

  const listQuery = useQuery({
    queryKey: QK_CHANNELS,
    queryFn: () => channelsApi.list(),
  });

  const patchLocal = useCallback((key: string, value: unknown) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }, []);

  const openEdit = useCallback(
    (key: string) => {
      const row = listQuery.data?.[key];
      if (!row) return;
      const clean = stripBuiltin({ ...row } as Record<string, unknown>);
      setLocal(clean);
      const af = clean.allow_from;
      setAllowFromText(
        Array.isArray(af) && af.every((x) => typeof x === "string")
          ? (af as string[]).join("\n")
          : "",
      );
      setEditKey(key);
      setSheetOpen(true);
    },
    [listQuery.data],
  );

  const putMutation = useMutation({
    mutationFn: ({
      key,
      body,
    }: {
      key: string;
      body: Record<string, unknown>;
    }) => channelsApi.putOne(key, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QK_CHANNELS });
    },
  });

  const saveMutation = useMutation({
    mutationFn: ({
      key,
      body,
    }: {
      key: string;
      body: Record<string, unknown>;
    }) => channelsApi.putOne(key, body),
    onSuccess: async () => {
      setSheetOpen(false);
      setEditKey(null);
      await queryClient.invalidateQueries({ queryKey: QK_CHANNELS });
    },
  });

  const rows = useMemo(() => {
    const data = listQuery.data;
    if (!data) return [];
    return sortChannelKeys(Object.keys(data)).filter((k) =>
      channelMatchesFilter(k, filterQuery),
    );
  }, [listQuery.data, filterQuery]);

  const extraKeys = useMemo(() => {
    return sortChannelKeys(Object.keys(local)).filter((k) => !COMMON.has(k));
  }, [local]);

  const handleSaveSheet = () => {
    if (!editKey) return;
    const lines = allowFromText
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const body = stripBuiltin({ ...local, allow_from: lines });
    saveMutation.mutate({ key: editKey, body });
  };

  const onToggleEnabled = (key: string, checked: boolean) => {
    const row = listQuery.data?.[key];
    if (!row) return;
    const body = stripBuiltin({
      ...(row as Record<string, unknown>),
      enabled: checked,
    });
    putMutation.mutate({ key, body });
  };

  const pendingToggleKey =
    putMutation.isPending && putMutation.variables
      ? putMutation.variables.key
      : null;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background text-base">
      <ChannelsToolbar
        showLeftSidebar={showLeftSidebar}
        onToggleLeftSidebar={toggleLeftSidebar}
        filterQuery={filterQuery}
        onFilterQueryChange={setFilterQuery}
      />

      <ScrollArea className="min-h-0 flex-1">
        <ConsoleMirrorScrollPadding className="space-y-4">
          <ConsoleMirrorSectionHeader
            title="通道"
            description="通道配置绑定当前活动智能体. 修改后服务端会尝试热加载; 若失败请查看 Wisecore 日志."
          />

          {listQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>加载失败</AlertTitle>
              <AlertDescription>{listQuery.error.message}</AlertDescription>
            </Alert>
          ) : null}

          {listQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : null}

          {putMutation.isError ? (
            <Alert variant="destructive">
              <AlertTitle>更新失败</AlertTitle>
              <AlertDescription>{putMutation.error.message}</AlertDescription>
            </Alert>
          ) : null}

          {!listQuery.isLoading &&
            listQuery.data &&
            rows.length === 0 &&
            !listQuery.isError && (
              <p className="text-sm text-muted-foreground">无匹配通道.</p>
            )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((key) => {
              const row = listQuery.data?.[key] as
                | Record<string, unknown>
                | undefined;
              if (!row) return null;
              const builtin = Boolean(row.isBuiltin);
              const enabled = Boolean(row.enabled);
              const prefix =
                typeof row.bot_prefix === "string" ? row.bot_prefix : "";
              return (
                <Card key={key} className="overflow-hidden">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono text-sm font-semibold">
                          {key}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {builtin ? (
                            <Badge variant="secondary">内置</Badge>
                          ) : (
                            <Badge variant="outline">扩展</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={enabled}
                          disabled={pendingToggleKey === key}
                          onCheckedChange={(v) => onToggleEnabled(key, v)}
                        />
                        {pendingToggleKey === key ? (
                          <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                        ) : null}
                      </div>
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      前缀: {prefix || "(空)"}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-base"
                      onClick={() => openEdit(key)}
                    >
                      <PencilIcon className="size-4" />
                      编辑
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ConsoleMirrorScrollPadding>
      </ScrollArea>

      <Sheet
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) setEditKey(null);
        }}
      >
        <SheetContent
          aria-describedby={undefined}
          className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        >
          <SheetHeader>
            <SheetTitle className="font-mono">
              {editKey ? `通道: ${editKey}` : "通道"}
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="min-h-0 flex-1 px-4">
            <div className="space-y-6 pb-4">
              <div>
                <h3 className="mb-3 text-sm font-medium text-foreground">
                  通用行为
                </h3>
                <CommonFields
                  local={local}
                  allowFromText={allowFromText}
                  onPatch={patchLocal}
                  onAllowFromText={setAllowFromText}
                />
              </div>

              {extraKeys.length > 0 ? (
                <div>
                  <h3 className="mb-3 text-sm font-medium text-foreground">
                    通道专有字段
                  </h3>
                  <div className="space-y-4">
                    {extraKeys.map((k) => (
                      <div key={k} className="space-y-1.5">
                        <div className="font-mono text-xs text-muted-foreground">
                          {k}
                        </div>
                        <ExtraValueEditor
                          k={k}
                          v={local[k]}
                          onChange={(next) => patchLocal(k, next)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </ScrollArea>

          <SheetFooter className="px-4">
            {saveMutation.isError ? (
              <Alert variant="destructive" className="mb-3 w-full">
                <AlertTitle>保存失败</AlertTitle>
                <AlertDescription>
                  {saveMutation.error.message}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="flex w-full justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setSheetOpen(false)}
                className="text-base"
              >
                取消
              </Button>
              <Button
                onClick={handleSaveSheet}
                disabled={!editKey || saveMutation.isPending}
                className="inline-flex gap-2 text-base"
              >
                {saveMutation.isPending ? (
                  <Loader2Icon className="size-4 shrink-0 animate-spin" />
                ) : null}
                保存
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
