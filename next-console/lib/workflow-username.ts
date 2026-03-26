/** Match ``core.app.auth._UUID_WORKFLOW_SEGMENT`` (reject uuid-looking local parts). */
const UUID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidScopeSegment(local: string): boolean {
  if (!local || local.includes("..")) return false;
  if (UUID_SEGMENT.test(local)) return false;
  if (/[\x00-\x1f/\\]/.test(local)) return false;
  return true;
}

/**
 * Stable tenant key for chat, workflows, and workspace binding: the mailbox
 * local-part of the verified session email (before ``@``). Not Better Auth ``user.id``.
 */
export function scopeUserFromSessionUser(user: {
  email?: string | null;
}): string | null {
  const em = typeof user.email === "string" ? user.email.trim() : "";
  if (!em || !em.includes("@")) return null;
  const local = em.split("@", 1)[0]!.trim();
  if (!isValidScopeSegment(local)) return null;
  return local;
}

/** @deprecated Use ``scopeUserFromSessionUser`` */
export const resolvedWorkflowUsernameFromSessionUser =
  scopeUserFromSessionUser;
