import { apiRequest, buildQuery } from "./api-utils";

export interface ChatSpec {
  id: string;
  name: string;
  session_id: string;
  user_id: string;
  channel: string;
  created_at: string;
  updated_at: string;
  meta: Record<string, unknown>;
  status: string;
}

export interface ChatHistory {
  messages: unknown[];
  status: string;
}

export const sessionsApi = {
  list: (params?: { channel?: string; user_id?: string }) =>
    apiRequest<ChatSpec[]>(
      `/chats${buildQuery({
        channel: params?.channel,
        user_id: params?.user_id,
      })}`,
    ),

  get: (chatId: string) =>
    apiRequest<ChatHistory>(`/chats/${encodeURIComponent(chatId)}`),

  delete: (chatId: string) =>
    apiRequest<{ deleted: boolean }>(`/chats/${encodeURIComponent(chatId)}`, {
      method: "DELETE",
    }),
};