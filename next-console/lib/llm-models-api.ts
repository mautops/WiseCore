import { apiRequest } from "./api-utils";

export type ChatModelName =
  | "OpenAIChatModel"
  | "AnthropicChatModel"
  | "GeminiChatModel";

export interface ModelInfo {
  id: string;
  name: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  base_url: string;
  api_key: string;
  chat_model: string;
  models: ModelInfo[];
  extra_models: ModelInfo[];
  api_key_prefix: string;
  is_local: boolean;
  freeze_url: boolean;
  require_api_key: boolean;
  is_custom: boolean;
  support_model_discovery: boolean;
  support_connection_check: boolean;
  generate_kwargs: Record<string, unknown>;
}

export interface ModelSlotConfig {
  provider_id: string;
  model: string;
}

export interface ActiveModelsInfo {
  active_llm: ModelSlotConfig | null;
}

export interface ProviderConfigBody {
  api_key?: string | null;
  base_url?: string | null;
  chat_model?: ChatModelName | null;
  generate_kwargs?: Record<string, unknown>;
}

export interface CreateCustomProviderBody {
  id: string;
  name: string;
  default_base_url: string;
  api_key_prefix: string;
  chat_model: ChatModelName;
  models: ModelInfo[];
}

export interface AddModelBody {
  id: string;
  name: string;
}

export interface TestProviderBody {
  api_key?: string | null;
  base_url?: string | null;
  chat_model?: ChatModelName | null;
}

export interface DiscoverBody {
  api_key?: string | null;
  base_url?: string | null;
  chat_model?: ChatModelName | null;
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
}

export interface DiscoverModelsResponse {
  success: boolean;
  models: ModelInfo[];
  message: string;
  added_count: number;
}

export const llmModelsApi = {
  listProviders: () => apiRequest<ProviderInfo[]>("/models"),

  getActive: () => apiRequest<ActiveModelsInfo>("/models/active"),

  setActive: (body: { provider_id: string; model: string }) =>
    apiRequest<ActiveModelsInfo>("/models/active", {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  configureProvider: (providerId: string, body: ProviderConfigBody) =>
    apiRequest<ProviderInfo>(
      `/models/${encodeURIComponent(providerId)}/config`,
      { method: "PUT", body: JSON.stringify(body) },
    ),

  createCustomProvider: (body: CreateCustomProviderBody) =>
    apiRequest<ProviderInfo>("/models/custom-providers", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deleteCustomProvider: (providerId: string) =>
    apiRequest<ProviderInfo[]>(
      `/models/custom-providers/${encodeURIComponent(providerId)}`,
      { method: "DELETE" },
    ),

  testProvider: (providerId: string, body?: TestProviderBody) =>
    apiRequest<TestConnectionResponse>(
      `/models/${encodeURIComponent(providerId)}/test`,
      { method: "POST", body: JSON.stringify(body ?? {}) },
    ),

  discover: (providerId: string, body?: DiscoverBody) =>
    apiRequest<DiscoverModelsResponse>(
      `/models/${encodeURIComponent(providerId)}/discover`,
      { method: "POST", body: JSON.stringify(body ?? {}) },
    ),

  testModel: (providerId: string, modelId: string) =>
    apiRequest<TestConnectionResponse>(
      `/models/${encodeURIComponent(providerId)}/models/test`,
      { method: "POST", body: JSON.stringify({ model_id: modelId }) },
    ),

  addModel: (providerId: string, body: AddModelBody) =>
    apiRequest<ProviderInfo>(
      `/models/${encodeURIComponent(providerId)}/models`,
      { method: "POST", body: JSON.stringify(body) },
    ),

  removeModel: (providerId: string, modelId: string) =>
    apiRequest<ProviderInfo>(
      `/models/${encodeURIComponent(providerId)}/models/${encodeURIComponent(modelId)}`,
      { method: "DELETE" },
    ),
};