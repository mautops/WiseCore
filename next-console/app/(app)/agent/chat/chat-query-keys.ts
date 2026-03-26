/** React Query key for chat session list, scoped by tenant user id (mailbox local-part or legacy ``default``). */
export function chatsListQueryKey(userId: string) {
  return ["chats", userId] as const;
}
