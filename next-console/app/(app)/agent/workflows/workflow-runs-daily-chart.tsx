"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { workflowApi } from "@/lib/workflow-api";
import {
  dailyRunCountsForChart,
  qkWorkflowRuns,
  WORKFLOW_RUNS_CHART_DAYS,
} from "./workflow-domain";

const chartConfig = {
  count: {
    label: "执行次数",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function WorkflowRunsDailyChart({ filename }: { filename: string }) {
  const query = useQuery({
    queryKey: qkWorkflowRuns(filename),
    queryFn: () => workflowApi.listRuns(filename).then((r) => r.runs),
    staleTime: 60_000,
  });

  if (query.isPending) {
    return (
      <div
        className="mt-2 h-22 w-full animate-pulse rounded-md bg-muted/50"
        aria-hidden
      />
    );
  }

  if (query.isError) {
    return null;
  }

  const data = dailyRunCountsForChart(
    query.data ?? [],
    WORKFLOW_RUNS_CHART_DAYS,
  );
  const lastIdx = data.length > 0 ? data.length - 1 : -1;

  return (
    <div className="mt-2 w-full">
      <p className="mb-0.5 text-xs text-muted-foreground">
        近 {WORKFLOW_RUNS_CHART_DAYS} 日执行
      </p>
      <ChartContainer
        config={chartConfig}
        className="h-21 w-full aspect-auto! p-0 [&_.recharts-responsive-container]:aspect-auto"
      >
        <LineChart
          data={data}
          margin={{ top: 2, right: 2, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            vertical={false}
            strokeDasharray="3 3"
            className="stroke-border/40"
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            interval="preserveStartEnd"
            fontSize={10}
          />
          <YAxis
            width={22}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tickMargin={2}
            fontSize={10}
          />
          <ChartTooltip
            cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
            content={
              <ChartTooltipContent
                labelFormatter={(_value, payload) => {
                  const row = payload?.[0]?.payload as
                    | { date?: string; label?: string }
                    | undefined;
                  return row?.date ?? row?.label ?? "";
                }}
              />
            }
          />
          <Line
            key={`runs-line-${filename}`}
            type="monotone"
            dataKey="count"
            stroke="var(--color-count)"
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, index } = props;
              const dotKey =
                typeof index === "number"
                  ? `run-dot-${index}`
                  : `run-dot-${String(cx)}-${String(cy)}`;
              if (index !== lastIdx || cx == null || cy == null) {
                return <g key={`${dotKey}-slot`} />;
              }
              return (
                <circle
                  key={dotKey}
                  cx={cx}
                  cy={cy}
                  r={3.5}
                  fill="var(--color-count)"
                  stroke="hsl(var(--background))"
                  strokeWidth={1}
                />
              );
            }}
            activeDot={{ r: 4, strokeWidth: 1 }}
          >
            <LabelList
              key="run-count-labels"
              dataKey="count"
              position="top"
              content={(props) => {
                const { index, x, y, value } = props;
                const labelKey =
                  typeof index === "number"
                    ? `run-label-${index}`
                    : `run-label-${String(x)}-${String(y)}`;
                if (index !== lastIdx || x == null || y == null) {
                  return <g key={`${labelKey}-slot`} />;
                }
                const xn = typeof x === "number" ? x : Number(x);
                const yn = typeof y === "number" ? y : Number(y);
                if (Number.isNaN(xn) || Number.isNaN(yn)) {
                  return <g key={`${labelKey}-nan`} />;
                }
                return (
                  <text
                    key={labelKey}
                    x={xn}
                    y={yn}
                    dy={-8}
                    textAnchor="middle"
                    className="fill-foreground text-[10px] font-medium tabular-nums"
                  >
                    {String(value ?? "")}
                  </text>
                );
              }}
            />
          </Line>
        </LineChart>
      </ChartContainer>
    </div>
  );
}
