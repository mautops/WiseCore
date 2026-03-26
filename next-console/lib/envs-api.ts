import { apiRequest } from "./api-utils";

export interface EnvVar {
  key: string;
  value: string;
}

export const envsApi = {
  list: () => apiRequest<EnvVar[]>("/envs"),

  /** Full replacement: keys omitted from `envs` are removed on server. */
  putAll: (envs: Record<string, string>) =>
    apiRequest<EnvVar[]>("/envs", {
      method: "PUT",
      body: JSON.stringify(envs),
    }),

  deleteKey: (key: string) =>
    apiRequest<EnvVar[]>(`/envs/${encodeURIComponent(key)}`, {
      method: "DELETE",
    }),
};