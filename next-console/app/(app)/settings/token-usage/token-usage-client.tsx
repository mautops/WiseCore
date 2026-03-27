"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ConsoleMirrorScrollPadding,
  ConsoleMirrorSectionHeader,
} from "@/components/console-mirror";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { TokenUsageQuery } from "@/lib/token-usage-api";
import { tokenUsageApi } from "@/lib/token-usage-api";
import { Loader2Icon } from "lucide-react";
import { useAppShell } from "../../app-shell";
import { TokenUsageToolbar } from "./token-usage-toolbar";
import {
  defaultDateRange,
  formatTokens,
  tokenUsageQueryKey,
} from "./token-usage-domain";

export function TokenUsageClient() {
  const queryClient = useQueryClient();
  const { showLeftSidebar, toggleLeftSidebar } = useAppShell();

  const dr = useMemo(() => defaultDateRange(), []);
  const [draftStart, setDraftStart] = useState(dr.start);
  const [draftEnd, setDraftEnd] = useState(dr.end);
  const [draftModel, setDraftModel] = useState("");
  const [draftProvider, setDraftProvider] = useState("");

  const [applied, setApplied] = useState<TokenUsageQuery>(() => ({
    start_date: dr.start,
    end_date: dr.end,
  }));

  const summaryQuery = useQuery({
    queryKey: tokenUsageQueryKey(applied),
    queryFn: () => tokenUsageApi.getSummary(applied),
  });

  const applyFilters = () => {
    setApplied({
      start_date: draftStart,
      end_date: draftEnd,
      model: draftModel.trim() || undefined,
      provider: draftProvider.trim() || undefined,
    });
  };

  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: tokenUsageQueryKey(applied),
    });
  };

  const data = summaryQuery.data;
  const empty =
    data &&
    data.total_calls === 0 &&
    Object.keys(data.by_date).length === 0 &&
    Object.keys(data.by_model).length === 0;

  const datesSorted = useMemo(() => {
    if (!data?.by_date) return [];
    return Object.keys(data.by_date).sort();
  }, [data]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background text-base">
      <TokenUsageToolbar
        showLeftSidebar={showLeftSidebar}
        onToggleLeftSidebar={toggleLeftSidebar}
        onRefresh={refresh}
        refreshing={summaryQuery.isFetching}
      />

      <ScrollArea className="min-h-0 flex-1">
        <ConsoleMirrorScrollPadding className="space-y-4">
          <ConsoleMirrorSectionHeader
            title="Token 用量"
            description="数据来自 Wisecore 本地聚合; 默认最近 30 天. 可按模型名或 Provider ID 过滤."
          />

          <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-card p-4 shadow-sm transition-all duration-200 hover:border-primary/20 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">
                开始日期
              </div>
              <Input
                type="date"
                value={draftStart}
                onChange={(e) => setDraftStart(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">
                结束日期
              </div>
              <Input
                type="date"
                value={draftEnd}
                onChange={(e) => setDraftEnd(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="min-w-[140px] flex-1 space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">
                模型 (可选)
              </div>
              <Input
                placeholder="模型名"
                value={draftModel}
                onChange={(e) => setDraftModel(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="min-w-[140px] flex-1 space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">
                Provider (可选)
              </div>
              <Input
                placeholder="provider_id"
                value={draftProvider}
                onChange={(e) => setDraftProvider(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <Button
              className="gap-1.5 bg-primary px-5 text-base font-medium text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md active:scale-95"
              onClick={applyFilters}
            >
              查询
            </Button>
          </div>

          {summaryQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>加载失败</AlertTitle>
              <AlertDescription>{summaryQuery.error.message}</AlertDescription>
            </Alert>
          ) : null}

          {summaryQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              加载中...
            </div>
          ) : null}

          {data && !summaryQuery.isLoading ? (
            <>
              {empty ? (
                <Alert>
                  <AlertTitle>暂无用量</AlertTitle>
                  <AlertDescription>
                    所选范围内没有调用记录, 或尚未产生 Token 统计.
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="transition-all duration-200 hover:shadow-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Prompt tokens
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold tabular-nums text-foreground">
                    {formatTokens(data.total_prompt_tokens)}
                  </CardContent>
                </Card>
                <Card className="transition-all duration-200 hover:shadow-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Completion tokens
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold tabular-nums text-foreground">
                    {formatTokens(data.total_completion_tokens)}
                  </CardContent>
                </Card>
                <Card className="transition-all duration-200 hover:shadow-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      调用次数
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold tabular-nums text-foreground">
                    {formatTokens(data.total_calls)}
                  </CardContent>
                </Card>
              </div>

              <Separator className="my-2" />

              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-foreground">按日</h2>
                <div className="overflow-x-auto rounded-lg border border-border/50 shadow-sm">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="border-b border-border/50 bg-muted/30">
                      <tr>
                        <th className="px-3 py-2.5 text-sm font-semibold text-foreground">日期</th>
                        <th className="px-3 py-2.5 text-sm font-semibold text-foreground">Prompt</th>
                        <th className="px-3 py-2.5 text-sm font-semibold text-foreground">Completion</th>
                        <th className="px-3 py-2.5 text-sm font-semibold text-foreground">次数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datesSorted.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-2.5 text-sm text-muted-foreground"
                          >
                            无按日数据
                          </td>
                        </tr>
                      ) : (
                        datesSorted.map((d) => {
                          const s = data.by_date[d];
                          if (!s) return null;
                          return (
                            <tr
                              key={d}
                              className="border-b border-border/50 last:border-0 transition-colors duration-150 hover:bg-accent/50"
                            >
                              <td className="px-3 py-2.5 font-mono text-xs font-medium text-foreground">
                                {d}
                              </td>
                              <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                                {formatTokens(s.prompt_tokens)}
                              </td>
                              <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                                {formatTokens(s.completion_tokens)}
                              </td>
                              <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                                {formatTokens(s.call_count)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-foreground">按 Provider</h2>
                <div className="overflow-x-auto rounded-lg border border-border/50 shadow-sm">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="border-b border-border/50 bg-muted/30">
                      <tr>
                        <th className="px-3 py-2.5 text-sm font-semibold text-foreground">Provider</th>
                        <th className="px-3 py-2.5 text-sm font-semibold text-foreground">Prompt</th>
                        <th className="px-3 py-2.5 text-sm font-semibold text-foreground">Completion</th>
                        <th className="px-3 py-2.5 text-sm font-semibold text-foreground">次数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(data.by_provider).length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-2.5 text-sm text-muted-foreground"
                          >
                            无
                          </td>
                        </tr>
                      ) : (
                        Object.entries(data.by_provider).map(([pid, s]) => (
                          <tr
                            key={pid}
                            className="border-b border-border/50 last:border-0 transition-colors duration-150 hover:bg-accent/50"
                          >
                            <td className="px-3 py-2.5 font-mono text-xs font-medium text-foreground">
                              {pid || "(空)"}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                              {formatTokens(s.prompt_tokens)}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                              {formatTokens(s.completion_tokens)}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                              {formatTokens(s.call_count)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-foreground">按模型</h2>
                <div className="overflow-x-auto rounded-lg border border-border/50 shadow-sm">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="border-b border-border/50 bg-muted/30">
                      <tr>
                        <th className="px-3 py-2.5 text-sm font-semibold text-foreground">键</th>
                        <th className="px-3 py-2.5 text-sm font-semibold text-foreground">Provider</th>
                        <th className="px-3 py-2.5 text-sm font-semibold text-foreground">模型</th>
                        <th className="px-3 py-2.5 text-sm font-semibold text-foreground">Prompt</th>
                        <th className="px-3 py-2.5 text-sm font-semibold text-foreground">Completion</th>
                        <th className="px-3 py-2.5 text-sm font-semibold text-foreground">次数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(data.by_model).length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-3 py-2.5 text-sm text-muted-foreground"
                          >
                            无
                          </td>
                        </tr>
                      ) : (
                        Object.entries(data.by_model).map(([k, m]) => (
                          <tr
                            key={k}
                            className="border-b border-border/50 last:border-0 transition-colors duration-150 hover:bg-accent/50"
                          >
                            <td className="max-w-[140px] truncate px-3 py-2.5 font-mono text-xs font-medium text-foreground">
                              {k}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                              {m.provider_id || "—"}
                            </td>
                            <td className="max-w-[160px] truncate px-3 py-2.5 text-xs text-muted-foreground">
                              {m.model}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                              {formatTokens(m.prompt_tokens)}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                              {formatTokens(m.completion_tokens)}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                              {formatTokens(m.call_count)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </ConsoleMirrorScrollPadding>
      </ScrollArea>
    </div>
  );
}
