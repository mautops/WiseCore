"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type {
  MCPClientCreateBody,
  MCPClientInfo,
  MCPClientUpdateBody,
  MCPTransport,
} from "@/lib/mcp-api";
import {
  formatKeyValueLines,
  parseArgsLine,
  parseKeyValueLines,
} from "./mcp-domain";
import { Loader2Icon } from "lucide-react";

const TRANSPORTS: MCPTransport[] = ["stdio", "streamable_http", "sse"];

export function McpClientSheet({
  open,
  onOpenChange,
  mode,
  client,
  onCreate,
  onUpdate,
  isPending,
  errorMessage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  client: MCPClientInfo | null;
  onCreate: (body: MCPClientCreateBody) => Promise<void>;
  onUpdate: (key: string, body: MCPClientUpdateBody) => Promise<void>;
  isPending: boolean;
  errorMessage?: string | null;
}) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [transport, setTransport] = useState<MCPTransport>("stdio");
  const [url, setUrl] = useState("");
  const [headersText, setHeadersText] = useState("");
  const [command, setCommand] = useState("");
  const [argsLine, setArgsLine] = useState("");
  const [envText, setEnvText] = useState("");
  const [cwd, setCwd] = useState("");
  const snapRef = useRef({ env: "", headers: "" });

  const remote = transport !== "stdio";

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      setKey("");
      setName("");
      setDescription("");
      setEnabled(true);
      setTransport("stdio");
      setUrl("");
      setHeadersText("");
      setCommand("");
      setArgsLine("");
      setEnvText("");
      setCwd("");
      snapRef.current = { env: "", headers: "" };
    } else if (client) {
      setKey(client.key);
      setName(client.name);
      setDescription(client.description);
      setEnabled(client.enabled);
      setTransport(client.transport);
      setUrl(client.url);
      setHeadersText(formatKeyValueLines(client.headers));
      setCommand(client.command);
      setArgsLine(client.args.join(" "));
      setEnvText(formatKeyValueLines(client.env));
      setCwd(client.cwd);
      snapRef.current = {
        env: formatKeyValueLines(client.env),
        headers: formatKeyValueLines(client.headers),
      };
    }
  }, [open, mode, client]);

  const handleSubmit = async () => {
    if (mode === "create") {
      const k = key.trim();
      if (!k || !name.trim()) return;
      await onCreate({
        client_key: k,
        client: {
          name: name.trim(),
          description: description.trim(),
          enabled,
          transport,
          url: transport !== "stdio" ? url.trim() : "",
          headers: transport !== "stdio" ? parseKeyValueLines(headersText) : {},
          command: transport === "stdio" ? command.trim() : "",
          args: transport === "stdio" ? parseArgsLine(argsLine) : [],
          env: parseKeyValueLines(envText),
          cwd: cwd.trim(),
        },
      });
    } else if (client) {
      const body: MCPClientUpdateBody = {
        name: name.trim(),
        description: description.trim(),
        enabled,
        transport,
        url: url.trim(),
        command: command.trim(),
        args: parseArgsLine(argsLine),
        cwd: cwd.trim(),
      };
      if (remote && headersText !== snapRef.current.headers) {
        body.headers = parseKeyValueLines(headersText);
      }
      if (envText !== snapRef.current.env) {
        body.env = parseKeyValueLines(envText);
      }
      await onUpdate(client.key, body);
    }
  };

  const canSubmit =
    mode === "create"
      ? key.trim().length > 0 && name.trim().length > 0
      : name.trim().length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="text-left">
          <SheetTitle>
            {mode === "create" ? "新建 MCP 客户端" : "编辑 MCP 客户端"}
          </SheetTitle>
          <SheetDescription>
            {remote
              ? "远程传输需填写 URL, 可选请求头."
              : "stdio 需填写启动命令与工作目录等."}
            {" 列表中的 env 可能已脱敏, 仅修改需变更的行再保存."}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
          {mode === "create" && (
            <div className="grid gap-2">
              <label htmlFor="mcp-key" className="text-sm font-medium">
                Key (唯一标识)
              </label>
              <Input
                id="mcp-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="my_mcp"
                className="font-mono"
                spellCheck={false}
              />
            </div>
          )}
          {mode === "edit" && (
            <p className="font-mono text-sm text-muted-foreground">{key}</p>
          )}
          <div className="grid gap-2">
            <label htmlFor="mcp-name" className="text-sm font-medium">
              显示名称
            </label>
            <Input
              id="mcp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="mcp-desc" className="text-sm font-medium">
              说明
            </label>
            <Textarea
              id="mcp-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="mcp-en"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
            <label htmlFor="mcp-en" className="text-sm font-medium">
              启用
            </label>
          </div>
          <div className="grid gap-2">
            <span className="text-sm font-medium">传输</span>
            <Select
              value={transport}
              onValueChange={(v) => setTransport(v as MCPTransport)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSPORTS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {remote && (
            <>
              <div className="grid gap-2">
                <label htmlFor="mcp-url" className="text-sm font-medium">
                  URL
                </label>
                <Input
                  id="mcp-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="font-mono text-sm"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="mcp-h" className="text-sm font-medium">
                  Headers (每行 KEY=value)
                </label>
                <Textarea
                  id="mcp-h"
                  value={headersText}
                  onChange={(e) => setHeadersText(e.target.value)}
                  rows={4}
                  className="font-mono text-sm"
                />
              </div>
            </>
          )}
          {!remote && (
            <>
              <div className="grid gap-2">
                <label htmlFor="mcp-cmd" className="text-sm font-medium">
                  命令
                </label>
                <Input
                  id="mcp-cmd"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="npx"
                  className="font-mono text-sm"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="mcp-args" className="text-sm font-medium">
                  参数 (空格分隔)
                </label>
                <Input
                  id="mcp-args"
                  value={argsLine}
                  onChange={(e) => setArgsLine(e.target.value)}
                  placeholder="-y @some/mcp-server"
                  className="font-mono text-sm"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="mcp-cwd" className="text-sm font-medium">
                  工作目录
                </label>
                <Input
                  id="mcp-cwd"
                  value={cwd}
                  onChange={(e) => setCwd(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            </>
          )}
          <div className="grid gap-2">
            <label htmlFor="mcp-env" className="text-sm font-medium">
              环境变量 (每行 KEY=value)
            </label>
            <Textarea
              id="mcp-env"
              value={envText}
              onChange={(e) => setEnvText(e.target.value)}
              rows={5}
              className="font-mono text-sm"
            />
          </div>
        </div>
        {errorMessage ? (
          <p className="px-4 text-sm text-destructive">{errorMessage}</p>
        ) : null}
        <SheetFooter className="border-t border-border px-4 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button disabled={!canSubmit || isPending} onClick={handleSubmit}>
            {isPending && <Loader2Icon className="animate-spin" />}
            {mode === "create" ? "创建" : "保存"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
