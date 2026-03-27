"use client";

import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from "@/components/ai-elements/confirmation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ToolCallInfo } from "@/lib/chat-api";
import type { ChatStatus, DynamicToolUIPart } from "ai";
import { AssistantPlanOrText } from "./chat-assistant-plan";
import { BotIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { LocalMessage } from "./types";

// ── Avatar helpers ───────────────────────────────────────────────────────────

function BotAvatar({ center = false }: { center?: boolean }) {
  return (
    <Avatar
      size="default"
      className={`shrink-0 ring-2 ring-border/60 shadow-sm${center ? "" : " mt-0.5"}`}
    >
      <AvatarFallback className="bg-primary/10">
        <BotIcon className="size-3.5 text-primary" />
      </AvatarFallback>
    </Avatar>
  );
}

function UserAvatar({
  image,
  name,
  initials,
}: {
  image?: string;
  name?: string;
  initials: string;
}) {
  return (
    <Avatar size="default" className="mt-0.5 shrink-0 ring-2 ring-border/60 shadow-sm">
      <AvatarImage src={image} alt={name ?? "User"} />
      <AvatarFallback className="bg-muted font-medium">{initials}</AvatarFallback>
    </Avatar>
  );
}

const AVATAR_PLACEHOLDER = <div className="size-8 shrink-0" />;

function deriveDynamicToolState(
  tool: ToolCallInfo,
): DynamicToolUIPart["state"] {
  if (tool.state === "error") return "output-error";
  if (tool.output !== undefined && tool.state === "done")
    return "output-available";
  if (tool.toolUiState) return tool.toolUiState;
  if (tool.output !== undefined) return "output-available";
  return "input-available";
}

// ── Tool block ───────────────────────────────────────────────────────────────

function ToolBlock({
  tool,
  defaultOpen = false,
}: {
  tool: ToolCallInfo;
  defaultOpen?: boolean;
}) {
  const uiState = deriveDynamicToolState(tool);
  const showHitl =
    tool.hitlApproval &&
    uiState !== "input-available" &&
    uiState !== "input-streaming" &&
    !(
      uiState === "output-available" && tool.hitlApproval.approved === undefined
    );

  return (
    <Tool defaultOpen={defaultOpen} className="min-w-0 flex-1">
      <ToolHeader
        title={tool.name}
        type="dynamic-tool"
        toolName={tool.name}
        state={uiState}
      />
      <ToolContent>
        {tool.input != null && (
          <ToolInput input={tool.input as Record<string, unknown>} />
        )}
        {showHitl ? (
          <Confirmation
            approval={{
              id: tool.hitlApproval!.id,
              approved: tool.hitlApproval!.approved,
            }}
            state={uiState}
          >
            <ConfirmationRequest>
              <ConfirmationTitle>
                此工具调用需通过安全策略确认
              </ConfirmationTitle>
              <p className="text-muted-foreground">
                {`请按助手在对话中的说明在会话里回复以批准或拒绝. 流式 data.guard_approval === "requested" 时会显示此区域.`}
              </p>
            </ConfirmationRequest>
            <ConfirmationAccepted>
              <p className="text-muted-foreground">已批准并执行.</p>
            </ConfirmationAccepted>
            <ConfirmationRejected>
              <p className="text-muted-foreground">已拒绝执行.</p>
            </ConfirmationRejected>
          </Confirmation>
        ) : null}
        {tool.output !== undefined && (
          <ToolOutput
            output={tool.output}
            errorText={tool.state === "error" ? tool.output : undefined}
          />
        )}
      </ToolContent>
    </Tool>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

interface ChatMessageListProps {
  messages: LocalMessage[];
  status: ChatStatus;
  streamingContent: string;
  streamingThinking: string;
  isThinkingStreaming: boolean;
  streamingTools: ToolCallInfo[];
  isGenerating: boolean;
  userImage?: string;
  userName?: string;
  userInitials: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ChatMessageList({
  messages,
  status,
  streamingContent,
  streamingThinking,
  isThinkingStreaming,
  streamingTools,
  isGenerating,
  userImage,
  userName,
  userInitials,
}: ChatMessageListProps) {
  // Note: Auto-scroll is handled by use-stick-to-bottom in Conversation component
  // which only scrolls when user is already at the bottom, allowing users to
  // scroll up and view history without being interrupted

  return (
    <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col px-6">
      {messages.map((msg, idx) => {
        const isUser = msg.role === "user";
        const prevRole = idx > 0 ? messages[idx - 1].role : null;
        const showAvatar = prevRole !== msg.role;
        const marginTop = idx === 0 ? "" : showAvatar ? "mt-8" : "mt-2";

        if (msg.type === "thinking") {
          return (
            <div
              key={`${msg.id}-${idx}`}
              className={`${marginTop} flex flex-row items-center gap-3`}
            >
              {showAvatar ? <BotAvatar center /> : AVATAR_PLACEHOLDER}
              <Reasoning className="min-w-0 flex-1" defaultOpen={false}>
                <ReasoningTrigger />
                <ReasoningContent>{msg.content || " "}</ReasoningContent>
              </Reasoning>
            </div>
          );
        }

        if (msg.type === "tool" && msg.tool) {
          return (
            <div
              key={`${msg.id}-${idx}`}
              className={`${marginTop} flex flex-row items-start gap-3`}
            >
              {showAvatar ? <BotAvatar /> : AVATAR_PLACEHOLDER}
              <div className="min-w-0 flex-1">
                <ToolBlock tool={msg.tool} />
              </div>
            </div>
          );
        }

        return (
          <div
            key={`${msg.id}-${idx}`}
            className={`${marginTop} ${isUser ? "flex flex-row-reverse items-start gap-3" : "flex flex-row items-start gap-3"}`}
          >
            {showAvatar ? (
              isUser ? (
                <UserAvatar
                  image={userImage}
                  name={userName}
                  initials={userInitials}
                />
              ) : (
                <BotAvatar />
              )
            ) : (
              AVATAR_PLACEHOLDER
            )}
            <div className="min-w-0 flex-1">
              <Message from={msg.role} className="max-w-full">
                <MessageContent>
                  {msg.role === "assistant" ? (
                    <AssistantPlanOrText
                      content={msg.content}
                      isStreaming={false}
                    />
                  ) : (
                    <MessageResponse
                      mode="static"
                      parseIncompleteMarkdown={false}
                    >
                      {msg.content}
                    </MessageResponse>
                  )}
                </MessageContent>
              </Message>
            </div>
          </div>
        );
      })}

      {/* ── Streaming area ── */}
      {isGenerating && (
        <StreamingBlock
          messages={messages}
          status={status}
          streamingContent={streamingContent}
          streamingThinking={streamingThinking}
          isThinkingStreaming={isThinkingStreaming}
          streamingTools={streamingTools}
        />
      )}
    </div>
  );
}

// ── Streaming block ──────────────────────────────────────────────────────────

function StreamingBlock({
  messages,
  status,
  streamingContent,
  streamingThinking,
  isThinkingStreaming,
  streamingTools,
}: {
  messages: LocalMessage[];
  status: ChatStatus;
  streamingContent: string;
  streamingThinking: string;
  isThinkingStreaming: boolean;
  streamingTools: ToolCallInfo[];
}) {
  const prevIsAssistant = messages.at(-1)?.role === "assistant";
  const showThinking = isThinkingStreaming || !!streamingThinking;
  const showShimmer =
    status === "submitted" &&
    !showThinking &&
    streamingTools.length === 0 &&
    !streamingContent;
  // Do not gate text on !isThinkingStreaming: answer tokens often overlap reasoning in time.
  // Hiding MessageResponse until thinking ends makes streamingContent jump in as one block.
  const showText =
    !showShimmer &&
    (!!streamingContent ||
      (streamingTools.length === 0 &&
        !streamingThinking &&
        !isThinkingStreaming));

  type StreamRow = {
    key: string;
    align: "items-start" | "items-center";
    centerAvatar?: boolean;
    body: ReactNode;
  };
  const rows: StreamRow[] = [];
  if (showShimmer) {
    rows.push({
      key: "shimmer",
      align: "items-start",
      body: (
        <div className="min-w-0 flex-1">
          <Message from="assistant" className="max-w-full">
            <MessageContent>
              <Shimmer>思考中...</Shimmer>
            </MessageContent>
          </Message>
        </div>
      ),
    });
  }
  if (showThinking) {
    rows.push({
      key: "thinking",
      align: "items-center",
      centerAvatar: true,
      body: (
        <Reasoning isStreaming={isThinkingStreaming} className="min-w-0 flex-1">
          <ReasoningTrigger />
          <ReasoningContent>{streamingThinking || " "}</ReasoningContent>
        </Reasoning>
      ),
    });
  }
  for (const tool of streamingTools) {
    rows.push({
      key: `tool-${tool.callId}`,
      align: "items-start",
      body: (
        <div className="min-w-0 flex-1">
          <ToolBlock tool={tool} />
        </div>
      ),
    });
  }
  if (showText) {
    rows.push({
      key: "text",
      align: "items-start",
      body: (
        <div className="min-w-0 flex-1">
          <Message from="assistant" className="max-w-full">
            <MessageContent>
              <AssistantPlanOrText
                content={streamingContent || " "}
                isStreaming={status === "streaming"}
                isAnimating={status === "streaming"}
              />
            </MessageContent>
          </Message>
        </div>
      ),
    });
  }

  return (
    <>
      {rows.map((row, i) => {
        const mt = i === 0 ? (prevIsAssistant ? "mt-2" : "mt-8") : "mt-2";
        return (
          <div
            key={row.key}
            className={`${mt} flex flex-row ${row.align} gap-3`}
          >
            {i === 0 ? (
              <BotAvatar center={row.centerAvatar} />
            ) : (
              AVATAR_PLACEHOLDER
            )}
            {row.body}
          </div>
        );
      })}
    </>
  );
}
