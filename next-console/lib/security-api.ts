import { apiRequest } from "./api-utils";

export interface ToolGuardRuleConfig {
  id: string;
  tools: string[];
  params: string[];
  category: string;
  severity: string;
  patterns: string[];
  exclude_patterns: string[];
  description: string;
  remediation: string;
}

export interface ToolGuardConfig {
  enabled: boolean;
  guarded_tools: string[] | null;
  denied_tools: string[];
  custom_rules: ToolGuardRuleConfig[];
  disabled_rules: string[];
}

export interface FileGuardState {
  enabled: boolean;
  paths: string[];
}

export interface FileGuardUpdate {
  enabled?: boolean;
  paths?: string[] | null;
}

export interface SkillScannerWhitelistEntry {
  skill_name: string;
  content_hash: string;
  added_at: string;
}

export type SkillScannerMode = "block" | "warn" | "off";

export interface SkillScannerConfig {
  mode: SkillScannerMode;
  timeout: number;
  whitelist: SkillScannerWhitelistEntry[];
}

export interface BlockedSkillRecord {
  skill_name: string;
  blocked_at: string;
  max_severity: string;
  findings: unknown[];
  content_hash: string;
  action: string;
}

export const securityApi = {
  getToolGuard: () =>
    apiRequest<ToolGuardConfig>("/config/security/tool-guard"),
  putToolGuard: (body: ToolGuardConfig) =>
    apiRequest<ToolGuardConfig>("/config/security/tool-guard", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  getBuiltinRules: () =>
    apiRequest<ToolGuardRuleConfig[]>(
      "/config/security/tool-guard/builtin-rules",
    ),
  getFileGuard: () => apiRequest<FileGuardState>("/config/security/file-guard"),
  putFileGuard: (body: FileGuardUpdate) =>
    apiRequest<FileGuardState>("/config/security/file-guard", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  getSkillScanner: () =>
    apiRequest<SkillScannerConfig>("/config/security/skill-scanner"),
  putSkillScanner: (body: SkillScannerConfig) =>
    apiRequest<SkillScannerConfig>("/config/security/skill-scanner", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  getBlockedHistory: () =>
    apiRequest<BlockedSkillRecord[]>(
      "/config/security/skill-scanner/blocked-history",
    ),
  clearBlockedHistory: () =>
    apiRequest<{ cleared: boolean }>(
      "/config/security/skill-scanner/blocked-history",
      { method: "DELETE" },
    ),
  removeBlockedEntry: (index: number) =>
    apiRequest<{ removed: boolean }>(
      `/config/security/skill-scanner/blocked-history/${index}`,
      { method: "DELETE" },
    ),
  addWhitelist: (skill_name: string, content_hash?: string) =>
    apiRequest<{ whitelisted: boolean; skill_name: string }>(
      "/config/security/skill-scanner/whitelist",
      {
        method: "POST",
        body: JSON.stringify({ skill_name, content_hash: content_hash ?? "" }),
      },
    ),
  removeWhitelist: (skillName: string) =>
    apiRequest<{ removed: boolean; skill_name: string }>(
      `/config/security/skill-scanner/whitelist/${encodeURIComponent(skillName)}`,
      { method: "DELETE" },
    ),
};