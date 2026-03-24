"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { LeftSidebar } from "@/components/layout/left-sidebar";

interface AppShellUser {
  name: string;
  email: string;
  image?: string | null;
  username?: string | null;
}

interface AppShellContextValue {
  showLeftSidebar: boolean;
  toggleLeftSidebar: () => void;
  user?: AppShellUser | null;
}

const AppShellContext = createContext<AppShellContextValue>({
  showLeftSidebar: true,
  toggleLeftSidebar: () => {},
});

export function useAppShell() {
  return useContext(AppShellContext);
}

// w-56 = 14rem = 224px — must match LeftSidebar's own width class
const LEFT_WIDTH = 224;

export function AppShell({
  children,
  user,
  appVersion,
}: {
  children: React.ReactNode;
  user?: AppShellUser | null;
  appVersion?: string;
}) {
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const toggleLeftSidebar = useCallback(
    () => setShowLeftSidebar((p) => !p),
    [],
  );

  return (
    <AppShellContext.Provider
      value={{ showLeftSidebar, toggleLeftSidebar, user }}
    >
      <div className="flex h-screen overflow-hidden">
        <div
          className="shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out"
          style={{ width: showLeftSidebar ? LEFT_WIDTH : 0 }}
        >
          <LeftSidebar user={user} appVersion={appVersion} />
        </div>
        <div className="flex flex-1 overflow-hidden">{children}</div>
      </div>
    </AppShellContext.Provider>
  );
}
