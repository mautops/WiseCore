import { apiRequest, buildQuery } from "./api-utils";

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