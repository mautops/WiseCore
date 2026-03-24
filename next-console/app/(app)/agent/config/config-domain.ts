import type {
  AgentsRunningConfig,
  EmbeddingConfig,
} from "@/lib/agent-config-api";

export const QK_AGENT_RUNNING_CONFIG = ["agent", "running-config"] as const;
export const QK_SYSTEM_PROMPT_FILES = ["agent", "system-prompt-files"] as const;

export function defaultEmbedding(): EmbeddingConfig {
  return {
    backend: "openai",
    api_key: "",
    base_url: "",
    model_name: "",
    dimensions: 1024,
    enable_cache: true,
    use_dimensions: false,
    max_cache_size: 2000,
    max_input_length: 8192,
    max_batch_size: 10,
  };
}

export function defaultRunning(): AgentsRunningConfig {
  return {
    max_iters: 50,
    token_count_model: "default",
    token_count_estimate_divisor: 3.75,
    token_count_use_mirror: false,
    max_input_length: 128 * 1024,
    memory_compact_ratio: 0.75,
    memory_reserve_ratio: 0.1,
    tool_result_compact_recent_n: 2,
    tool_result_compact_old_threshold: 1000,
    tool_result_compact_recent_threshold: 30000,
    tool_result_compact_retention_days: 7,
    history_max_length: 10000,
    embedding_config: defaultEmbedding(),
  };
}

export function normalizeRunning(
  raw: AgentsRunningConfig,
): AgentsRunningConfig {
  const base = defaultRunning();
  const embIn = raw.embedding_config ?? {};
  return {
    ...base,
    ...raw,
    embedding_config: {
      ...base.embedding_config,
      ...embIn,
    },
  };
}

export function validateRunning(c: AgentsRunningConfig): string | null {
  if (!Number.isFinite(c.max_iters) || c.max_iters < 1) {
    return "最大迭代次数须为 >= 1 的整数";
  }
  if (
    !Number.isFinite(c.token_count_estimate_divisor) ||
    c.token_count_estimate_divisor <= 1
  ) {
    return "Token 估算除数须为大于 1 的数字";
  }
  if (!Number.isFinite(c.max_input_length) || c.max_input_length < 1000) {
    return "最大输入长度 (tokens) 须 >= 1000";
  }
  if (
    !Number.isFinite(c.memory_compact_ratio) ||
    c.memory_compact_ratio < 0.3 ||
    c.memory_compact_ratio > 0.9
  ) {
    return "记忆压缩比例须在 0.3 与 0.9 之间";
  }
  if (
    !Number.isFinite(c.memory_reserve_ratio) ||
    c.memory_reserve_ratio < 0.05 ||
    c.memory_reserve_ratio > 0.3
  ) {
    return "记忆预留比例须在 0.05 与 0.3 之间";
  }
  if (
    !Number.isInteger(c.tool_result_compact_recent_n) ||
    c.tool_result_compact_recent_n < 1 ||
    c.tool_result_compact_recent_n > 10
  ) {
    return "工具结果压缩「最近条数」须在 1–10";
  }
  if (
    !Number.isFinite(c.tool_result_compact_old_threshold) ||
    c.tool_result_compact_old_threshold < 100
  ) {
    return "旧消息字符阈值须 >= 100";
  }
  if (
    !Number.isFinite(c.tool_result_compact_recent_threshold) ||
    c.tool_result_compact_recent_threshold < 1000
  ) {
    return "最近消息字符阈值须 >= 1000";
  }
  if (
    !Number.isInteger(c.tool_result_compact_retention_days) ||
    c.tool_result_compact_retention_days < 1 ||
    c.tool_result_compact_retention_days > 30
  ) {
    return "工具结果保留天数须在 1–30";
  }
  if (!Number.isFinite(c.history_max_length) || c.history_max_length < 1000) {
    return "历史输出最大长度须 >= 1000";
  }
  const e = c.embedding_config;
  if (!Number.isFinite(e.dimensions) || e.dimensions < 1) {
    return "Embedding dimensions 须 >= 1";
  }
  if (!Number.isFinite(e.max_cache_size) || e.max_cache_size < 1) {
    return "Embedding 缓存条数须 >= 1";
  }
  if (!Number.isFinite(e.max_input_length) || e.max_input_length < 1) {
    return "Embedding 最大输入长度须 >= 1";
  }
  if (!Number.isFinite(e.max_batch_size) || e.max_batch_size < 1) {
    return "Embedding 批大小须 >= 1";
  }
  return null;
}

export function parsePromptLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}
