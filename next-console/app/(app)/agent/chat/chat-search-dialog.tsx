"use client";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { ChatSpec } from "@/lib/chat-api";
import { MessageSquareIcon } from "lucide-react";

interface ChatSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: ChatSpec[];
  onSelect: (id: string) => void;
}

export function ChatSearchDialog({
  open,
  onOpenChange,
  sessions,
  onSelect,
}: ChatSearchDialogProps) {
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <Command>
        <CommandInput placeholder="搜索对话..." className="text-base" />
        <CommandList>
          <CommandEmpty>未找到对话</CommandEmpty>
          {sessions.length > 0 && (
            <CommandGroup heading="历史对话" className="[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide">
              {sessions.map((s) => (
                <CommandItem
                  key={s.id}
                  value={s.name}
                  onSelect={() => {
                    onSelect(s.id);
                    onOpenChange(false);
                  }}
                  className="gap-2.5 transition-colors duration-150"
                >
                  <MessageSquareIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {s.name}
                  </span>
                  {s.updated_at && (
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground tabular-nums">
                      {new Date(s.updated_at).toLocaleDateString("zh-CN")}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
