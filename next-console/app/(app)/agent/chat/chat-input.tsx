"use client";

import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import type { ChatStatus, FileUIPart } from "ai";

// ── Attachment list (needs PromptInput context) ──────────────────────────────

function AttachmentList() {
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0) return null;
  return (
    <Attachments variant="inline" className="px-3 pt-2">
      {attachments.files.map((file) => (
        <Attachment
          key={file.id}
          data={file}
          onRemove={() => attachments.remove(file.id)}
        >
          <AttachmentPreview />
          <AttachmentInfo />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>
  );
}

// ── ChatInput ────────────────────────────────────────────────────────────────

interface ChatInputProps {
  status: ChatStatus;
  onSubmit: (msg: { text: string; files: FileUIPart[] }) => void;
  onStop: () => void;
}

export function ChatInput({ status, onSubmit, onStop }: ChatInputProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 border-t border-border bg-muted/90 py-4 backdrop-blur-md backdrop-saturate-150 supports-backdrop-filter:bg-muted/75">
      <div className="mx-auto w-full max-w-3xl px-6">
        <PromptInput onSubmit={onSubmit} multiple globalDrop>
          <PromptInputHeader>
            <AttachmentList />
          </PromptInputHeader>
          <PromptInputTextarea placeholder="发送消息..." />
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments label="添加附件" />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
            </PromptInputTools>
            <PromptInputSubmit status={status} onStop={onStop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
