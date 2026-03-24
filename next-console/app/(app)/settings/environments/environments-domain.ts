import type { EnvVar } from "@/lib/envs-api";

export const QK_ENVS = ["envs"] as const;

export function isSensitiveEnvKey(key: string): boolean {
  const k = key.toLowerCase();
  return (
    k.includes("secret") ||
    k.includes("password") ||
    k.includes("token") ||
    k.includes("api_key") ||
    k.endsWith("_key") ||
    k.includes("credential") ||
    k.includes("auth")
  );
}

export function maskEnvValue(value: string): string {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return "•".repeat(Math.min(24, value.length));
}

export function rowMatchesEnvFilter(row: EnvVar, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return (
    row.key.toLowerCase().includes(s) || row.value.toLowerCase().includes(s)
  );
}

export function envListToRecord(rows: EnvVar[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    out[r.key] = r.value;
  }
  return out;
}
