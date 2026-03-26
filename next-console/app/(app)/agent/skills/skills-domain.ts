import type { SkillSpec } from "@/lib/skills-api";

export const QK_SKILLS = ["core", "skills", "list"] as const;

/** Default SKILL.md body for new skills (YAML front matter required by backend). */
export const DEFAULT_NEW_SKILL_MARKDOWN = `---
name: my_skill
description: 简短说明该 skill 的用途与触发时机
---

# 标题

在此编写 skill 正文与步骤说明.
`;

export function matchesSkillFilter(skill: SkillSpec, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (skill.name.toLowerCase().includes(q)) return true;
  if (skill.description.toLowerCase().includes(q)) return true;
  if (skill.source.toLowerCase().includes(q)) return true;
  return false;
}

export function sourceLabel(source: string): string {
  if (source === "builtin") return "内置";
  if (source === "customized") return "自定义";
  if (source === "active") return "激活";
  return source;
}
