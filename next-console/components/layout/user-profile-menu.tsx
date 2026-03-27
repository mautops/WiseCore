"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ActivityIcon,
  BarChart3Icon,
  BotIcon,
  BoxesIcon,
  CalendarClockIcon,
  CheckIcon,
  CopyIcon,
  CpuIcon,
  FolderTreeIcon,
  KeyIcon,
  LogOutIcon,
  MessageSquareIcon,
  MicIcon,
  RadioIcon,
  ShieldIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authClient, signOut } from "@/lib/auth-client";
import { fetchCliTokenInfo } from "@/lib/auth-headers";

interface UserProfileMenuProps {
  user: {
    name: string;
    email: string;
    image?: string | null;
    username?: string | null;
  };
}

const MENU_GROUPS: {
  label: string;
  items: { label: string; href: string; icon: LucideIcon }[];
}[] = [
  {
    label: "智能体与运行",
    items: [
      { label: "工作区", href: "/agent/workspace", icon: FolderTreeIcon },
      {
        label: "智能体配置",
        href: "/agent/config",
        icon: SlidersHorizontalIcon,
      },
    ],
  },
  {
    label: "控制面",
    items: [
      { label: "通道", href: "/control/channels", icon: RadioIcon },
      { label: "会话", href: "/control/sessions", icon: MessageSquareIcon },
      {
        label: "定时任务",
        href: "/control/cron-jobs",
        icon: CalendarClockIcon,
      },
      { label: "心跳", href: "/control/heartbeat", icon: ActivityIcon },
    ],
  },
  {
    label: "平台设置",
    items: [
      { label: "智能体注册", href: "/settings/agents", icon: BotIcon },
      { label: "模型", href: "/settings/models", icon: CpuIcon },
      { label: "环境变量", href: "/settings/environments", icon: BoxesIcon },
      { label: "安全", href: "/settings/security", icon: ShieldIcon },
      {
        label: "Token 用量",
        href: "/settings/token-usage",
        icon: BarChart3Icon,
      },
      { label: "语音转写", href: "/settings/voice", icon: MicIcon },
    ],
  },
];

export function UserProfileMenu({ user }: UserProfileMenuProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [accessTokenCopying, setAccessTokenCopying] = useState(false);
  const [accessTokenCopied, setAccessTokenCopied] = useState(false);
  const [cliTokenCopying, setCliTokenCopying] = useState(false);
  const [cliTokenCopied, setCliTokenCopied] = useState(false);

  const displayName = user.name || user.username || user.email;
  const initials = displayName
    .split(/[\s@]/)
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            router.refresh();
            router.push("/login");
          },
        },
      });
    } finally {
      setSigningOut(false);
    }
  }

  async function handleCopyAccessToken() {
    setAccessTokenCopying(true);
    setAccessTokenCopied(false);
    try {
      const { data, error } = await authClient.getAccessToken({
        providerId: "keycloak",
      });
      if (error || !data?.accessToken) return;
      await navigator.clipboard.writeText(data.accessToken);
      setAccessTokenCopied(true);
      window.setTimeout(() => setAccessTokenCopied(false), 2000);
    } finally {
      setAccessTokenCopying(false);
    }
  }

  async function handleCopyCliToken() {
    setCliTokenCopying(true);
    setCliTokenCopied(false);
    try {
      const info = await fetchCliTokenInfo();
      // Only export the encrypted token - key is hardcoded in CLI binary
      await navigator.clipboard.writeText(info.encrypted_token);
      setCliTokenCopied(true);
      window.setTimeout(() => setCliTokenCopied(false), 2000);
    } finally {
      setCliTokenCopying(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-all duration-200 hover:bg-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
          aria-label={`用户菜单, ${displayName}`}
          aria-haspopup="menu"
        >
          <Avatar size="sm" className="ring-2 ring-border/60 shadow-sm">
            <AvatarImage src={user.image ?? undefined} alt={displayName} />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {displayName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="start"
        sideOffset={8}
        className="min-w-56 max-w-[min(100vw-1rem,20rem)]"
      >
        <div className="flex items-start gap-3 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{displayName}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              disabled={accessTokenCopying}
              onClick={() => void handleCopyAccessToken()}
              onPointerDown={(e) => e.preventDefault()}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-all duration-150 hover:bg-emerald-500/10 hover:text-emerald-600 active:scale-90 disabled:pointer-events-none disabled:opacity-50"
              title={accessTokenCopied ? "已复制" : "复制 Access Token"}
              aria-label={accessTokenCopied ? "已复制 Access Token" : "复制 Access Token"}
            >
              {accessTokenCopied ? (
                <CheckIcon className="size-4 text-emerald-600" aria-hidden />
              ) : (
                <CopyIcon className="size-4" aria-hidden />
              )}
            </button>
            <button
              type="button"
              disabled={cliTokenCopying}
              onClick={() => void handleCopyCliToken()}
              onPointerDown={(e) => e.preventDefault()}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-all duration-150 hover:bg-primary/10 hover:text-primary active:scale-90 disabled:pointer-events-none disabled:opacity-50"
              title={cliTokenCopied ? "已复制 CLI 配置" : "复制 CLI Token 配置"}
              aria-label={cliTokenCopied ? "已复制 CLI Token 配置" : "复制 CLI Token 配置"}
            >
              {cliTokenCopied ? (
                <CheckIcon className="size-4 text-emerald-600" aria-hidden />
              ) : (
                <KeyIcon className="size-4" aria-hidden />
              )}
            </button>
          </div>
        </div>
        <DropdownMenuSeparator />
        {MENU_GROUPS.map((group, gi) => (
          <Fragment key={group.label}>
            {gi > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</DropdownMenuLabel>
              {group.items.map(({ label, href, icon: Icon }) => (
                <DropdownMenuItem key={href} asChild>
                  <Link href={href} className="cursor-default gap-2.5 transition-colors duration-150">
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </Fragment>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={signingOut}
          variant="destructive"
          onClick={() => void handleSignOut()}
          className="transition-colors duration-150"
        >
          <LogOutIcon className="size-4" aria-hidden />
          {signingOut ? "正在登出..." : "登出"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
