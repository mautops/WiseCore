"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import type { HeartbeatPayload } from "@/lib/heartbeat-api";
import { heartbeatApi } from "@/lib/heartbeat-api";
import { useAppShell } from "../../app-shell";
import { HeartbeatToolbar } from "./heartbeat-toolbar";
import {
  normalizeHeartbeat,
  QK_HEARTBEAT,
  validateHeartbeatEvery,
  validateTimeHm,
} from "./heartbeat-domain";

export function HeartbeatClient() {
  const queryClient = useQueryClient();
  const { showLeftSidebar, toggleLeftSidebar } = useAppShell();
  const [draft, setDraft] = useState<HeartbeatPayload | null>(null);
  const [dirty, setDirty] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const heartbeatQuery = useQuery({
    queryKey: QK_HEARTBEAT,
    queryFn: () => heartbeatApi.get(),
  });

  useEffect(() => {
    if (heartbeatQuery.data != null && !dirty) {
      setDraft(normalizeHeartbeat(heartbeatQuery.data));
    }
  }, [heartbeatQuery.data, heartbeatQuery.dataUpdatedAt, dirty]);

  const putMutation = useMutation({
    mutationFn: (body: HeartbeatPayload) => heartbeatApi.put(body),
    onSuccess: async () => {
      setDirty(false);
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: QK_HEARTBEAT });
    },
  });

  const patch = useCallback((partial: Partial<HeartbeatPayload>) => {
    setDraft((d) => (d ? { ...d, ...partial } : d));
    setDirty(true);
  }, []);

  const setUseActiveWindow = useCallback((on: boolean) => {
    setDraft((d) => {
      if (!d) return d;
      if (on) {
        return {
          ...d,
          activeHours: d.activeHours ?? { start: "08:00", end: "22:00" },
        };
      }
      return { ...d, activeHours: null };
    });
    setDirty(true);
  }, []);

  const patchActiveHours = useCallback(
    (partial: Partial<{ start: string; end: string }>) => {
      setDraft((d) => {
        if (!d || !d.activeHours) return d;
        return {
          ...d,
          activeHours: { ...d.activeHours, ...partial },
        };
      });
      setDirty(true);
    },
    [],
  );

  const handleSave = async () => {
    if (!draft) return;
    setFormError(null);
    const ev = validateHeartbeatEvery(draft.every);
    if (ev) {
      setFormError(ev);
      return;
    }
    if (draft.target.trim() === "") {
      setFormError("target 不能为空");
      return;
    }
    if (draft.activeHours) {
      if (
        !validateTimeHm(draft.activeHours.start) ||
        !validateTimeHm(draft.activeHours.end)
      ) {
        setFormError("活跃时段须为 HH:MM (00:00–23:59)");
        return;
      }
    }
    const body: HeartbeatPayload = {
      enabled: draft.enabled,
      every: draft.every.trim(),
      target: draft.target.trim(),
      activeHours: draft.activeHours,
    };
    try {
      await putMutation.mutateAsync(body);
    } catch {
      /* mutation error */
    }
  };

  const server = heartbeatQuery.data
    ? normalizeHeartbeat(heartbeatQuery.data)
    : null;
  const useWindow = Boolean(draft?.activeHours);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background text-base">
      <HeartbeatToolbar
        showLeftSidebar={showLeftSidebar}
        onToggleLeftSidebar={toggleLeftSidebar}
        onSave={() => void handleSave()}
        saving={putMutation.isPending}
        saveDisabled={!dirty || !draft}
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground">
            心跳按间隔读取工作区中的{" "}
            <Link
              href="/agent/workspace"
              className="text-primary underline-offset-4 hover:underline"
            >
              HEARTBEAT.md
            </Link>{" "}
            等内容触发代理运行. 保存后会尝试重调度 Cron 中的心跳任务 (需
            CronManager 可用).
          </p>

          {heartbeatQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>加载失败</AlertTitle>
              <AlertDescription>
                {heartbeatQuery.error.message}
              </AlertDescription>
            </Alert>
          ) : null}

          {putMutation.isError ? (
            <Alert variant="destructive">
              <AlertTitle>保存失败</AlertTitle>
              <AlertDescription>{putMutation.error.message}</AlertDescription>
            </Alert>
          ) : null}

          {formError ? (
            <Alert variant="destructive">
              <AlertTitle>校验</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}

          {heartbeatQuery.isLoading || !draft ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : null}

          {server && heartbeatQuery.isSuccess ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">当前服务端配置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div>
                  启用:{" "}
                  <span className="text-foreground">
                    {server.enabled ? "是" : "否"}
                  </span>
                </div>
                <div>
                  间隔 every:{" "}
                  <span className="font-mono text-foreground">
                    {server.every}
                  </span>
                </div>
                <div>
                  目标 target:{" "}
                  <span className="font-mono text-foreground">
                    {server.target}
                  </span>
                </div>
                <div>
                  活跃时段:{" "}
                  {server.activeHours ? (
                    <span className="font-mono text-foreground">
                      {server.activeHours.start} – {server.activeHours.end}{" "}
                      (用户时区下判断)
                    </span>
                  ) : (
                    <span className="text-foreground">未限制 (全天)</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {draft ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">编辑</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draft.enabled}
                    onCheckedChange={(v) => patch({ enabled: v })}
                  />
                  <span className="text-sm text-muted-foreground">
                    启用心跳调度
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="text-sm font-medium">间隔 (every)</div>
                  <p className="text-xs text-muted-foreground">
                    例如 30m, 1h, 2h30m, 90s
                  </p>
                  <Input
                    className="font-mono text-sm"
                    value={draft.every}
                    onChange={(e) => patch({ every: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="text-sm font-medium">目标 (target)</div>
                  <p className="text-xs text-muted-foreground">
                    通常为 main 或 last, 与后端 HEARTBEAT 解析一致
                  </p>
                  <Input
                    className="font-mono text-sm"
                    value={draft.target}
                    onChange={(e) => patch({ target: e.target.value })}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={useWindow}
                      onCheckedChange={setUseActiveWindow}
                    />
                    <span className="text-sm text-muted-foreground">
                      仅在每日时段内运行 (activeHours)
                    </span>
                  </div>
                  {draft.activeHours ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <div className="text-sm font-medium">开始 (HH:MM)</div>
                        <Input
                          className="font-mono text-sm"
                          value={draft.activeHours.start}
                          onChange={(e) =>
                            patchActiveHours({ start: e.target.value })
                          }
                          placeholder="08:00"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <div className="text-sm font-medium">结束 (HH:MM)</div>
                        <Input
                          className="font-mono text-sm"
                          value={draft.activeHours.end}
                          onChange={(e) =>
                            patchActiveHours({ end: e.target.value })
                          }
                          placeholder="22:00"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
