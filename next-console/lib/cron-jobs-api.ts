const API_BASE = "/api/copaw";

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { detail?: unknown };
    const d = j?.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) return JSON.stringify(d);
  } catch {
    /* ignore */
  }
  return `HTTP ${res.status}`;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface ScheduleSpec {
  type: "cron";
  cron: string;
  timezone: string;
}

export interface DispatchTarget {
  user_id: string;
  session_id: string;
}

export interface DispatchSpec {
  type: "channel";
  channel: string;
  target: DispatchTarget;
  mode: "stream" | "final";
  meta: Record<string, unknown>;
}

export interface JobRuntimeSpec {
  max_concurrency: number;
  timeout_seconds: number;
  misfire_grace_seconds: number;
}

export type CronJobRequest = {
  input: unknown;
  session_id?: string | null;
  user_id?: string | null;
} & Record<string, unknown>;

export interface CronJobSpec {
  id: string;
  name: string;
  enabled: boolean;
  schedule: ScheduleSpec;
  task_type: "text" | "agent";
  text?: string | null;
  request?: CronJobRequest | null;
  dispatch: DispatchSpec;
  runtime: JobRuntimeSpec;
  meta: Record<string, unknown>;
}

export interface CronJobState {
  next_run_at: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
}

export interface CronJobView {
  spec: CronJobSpec;
  state: CronJobState;
}

export const cronJobsApi = {
  list: () => apiRequest<CronJobSpec[]>("/cron/jobs"),

  get: (jobId: string) =>
    apiRequest<CronJobView>(`/cron/jobs/${encodeURIComponent(jobId)}`),

  create: (body: CronJobSpec) =>
    apiRequest<CronJobSpec>("/cron/jobs", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  replace: (jobId: string, body: CronJobSpec) =>
    apiRequest<CronJobSpec>(`/cron/jobs/${encodeURIComponent(jobId)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  delete: (jobId: string) =>
    apiRequest<{ deleted: boolean }>(
      `/cron/jobs/${encodeURIComponent(jobId)}`,
      { method: "DELETE" },
    ),

  pause: (jobId: string) =>
    apiRequest<{ paused: boolean }>(
      `/cron/jobs/${encodeURIComponent(jobId)}/pause`,
      { method: "POST" },
    ),

  resume: (jobId: string) =>
    apiRequest<{ resumed: boolean }>(
      `/cron/jobs/${encodeURIComponent(jobId)}/resume`,
      { method: "POST" },
    ),

  run: (jobId: string) =>
    apiRequest<{ started: boolean }>(
      `/cron/jobs/${encodeURIComponent(jobId)}/run`,
      { method: "POST" },
    ),
};
