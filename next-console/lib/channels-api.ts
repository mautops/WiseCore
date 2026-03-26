import { apiRequest } from "./api-utils";

/** GET /config/channels: map of channel key -> config object (includes isBuiltin). */
export type ChannelMap = Record<string, Record<string, unknown>>;

export const channelsApi = {
  list: () => apiRequest<ChannelMap>("/config/channels"),

  listTypes: () => apiRequest<string[]>("/config/channels/types"),

  putOne: (channelName: string, body: Record<string, unknown>) =>
    apiRequest<unknown>(`/config/channels/${encodeURIComponent(channelName)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};