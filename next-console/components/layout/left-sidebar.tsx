"use client";

import Link from "next/link";
import { UserProfileMenu } from "./user-profile-menu";
import { SidebarNav } from "./sidebar-nav";

interface LeftSidebarUser {
  name: string;
  email: string;
  image?: string | null;
  username?: string | null;
}

interface LeftSidebarProps {
  user?: LeftSidebarUser | null;
  appVersion?: string;
}

export function LeftSidebar({ user, appVersion }: LeftSidebarProps) {
  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-border/50 bg-card">
      <Link
        href="/dashboard"
        className="flex items-center gap-3 px-4 py-5 transition-all duration-200 hover:bg-accent/50 active:scale-[0.99]"
      >
        <span className="text-3xl leading-none" aria-hidden>
          🦀
        </span>
        <div className="min-w-0">
          <p className="text-lg font-semibold tracking-tight text-foreground">
            Hi-Ops
          </p>
          <p className="text-xs text-muted-foreground">DevOps Platform</p>
        </div>
      </Link>

      <div className="border-t border-border/50" />

      <SidebarNav />

      <div className="border-t border-border/50 px-2 py-3">
        {appVersion ? (
          <p
            className="mb-2 px-2 text-[10px] tabular-nums text-muted-foreground/60"
            aria-label={`应用版本 ${appVersion}`}
          >
            v{appVersion}
          </p>
        ) : null}
        {user ? (
          <UserProfileMenu user={user} />
        ) : (
          <div
            className="flex items-center gap-3 px-2 py-2"
            aria-busy="true"
            aria-label="加载用户信息"
          >
            <div className="size-6 rounded-full bg-muted animate-pulse" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3 w-24 rounded bg-muted animate-pulse" />
              <div className="h-2.5 w-32 rounded bg-muted/60 animate-pulse" />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
