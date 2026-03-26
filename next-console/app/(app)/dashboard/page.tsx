import type { Metadata } from "next";
import { AppStubPage } from "@/components/layout/app-stub-page";

export const metadata: Metadata = { title: "工作台" };

const LINKS = [
  { href: "/agent/chat", label: "聊天" },
  { href: "/agent/workflows", label: "工作流" },
  { href: "/agent/skills", label: "Skills" },
  { href: "/control/channels", label: "通道" },
  { href: "/settings/models", label: "模型" },
  { href: "/settings/agents", label: "智能体注册" },
] as const;

export default function DashboardPage() {
  return (
    <AppStubPage
      title="工作台"
      description="进入 Wisecore 智能体, 控制面与设置. 侧栏可打开全部模块, 下方为常用跳转."
      links={[...LINKS]}
    />
  );
}
