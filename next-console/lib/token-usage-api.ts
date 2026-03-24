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

function buildQuery(params: Record<string, string | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") u.set(k, v);
  }
  const q = u.toString();
  return q ? `?${q}` : "";
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

export interface TokenUsageStats {
  prompt_tokens: number;
  completion_tokens: number;
  call_count: number;
}

export interface TokenUsageByModel extends TokenUsageStats {
  provider_id: string;
  model: string;
}

export interface TokenUsageSummary {
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_calls: number;
  by_model: Record<string, TokenUsageByModel>;
  by_provider: Record<string, TokenUsageStats>;
  by_date: Record<string, TokenUsageStats>;
}

export interface TokenUsageQuery {
  start_date?: string;
  end_date?: string;
  model?: string;
  provider?: string;
}

export const tokenUsageApi = {
  getSummary: (q?: TokenUsageQuery) =>
    apiRequest<TokenUsageSummary>(
      `/token-usage${buildQuery({
        start_date: q?.start_date,
        end_date: q?.end_date,
        model: q?.model,
        provider: q?.provider,
      })}`,
    ),
};
