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
  CpuIcon,
  FolderTreeIcon,
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
import { signOut } from "@/lib/auth-client";

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`用户菜单, ${displayName}`}
          aria-haspopup="menu"
        >
          <Avatar size="sm">
            <AvatarImage src={user.image ?? undefined} alt={displayName} />
            <AvatarFallback>{initials}</AvatarFallback>
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
        sideOffset={6}
        className="min-w-52 max-w-[min(100vw-1rem,20rem)]"
      >
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">{displayName}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <DropdownMenuSeparator />
        {MENU_GROUPS.map((group, gi) => (
          <Fragment key={group.label}>
            {gi > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuGroup>
              <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
              {group.items.map(({ label, href, icon: Icon }) => (
                <DropdownMenuItem key={href} asChild>
                  <Link href={href} className="cursor-default gap-2">
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
        >
          <LogOutIcon className="size-4" aria-hidden />
          {signingOut ? "正在登出..." : "登出"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
