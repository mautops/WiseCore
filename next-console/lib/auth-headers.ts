import { authClient } from "./auth-client";

/** Keycloak access token for API (Bearer). Throws if not signed in. */
export async function mergeAuthHeaders(
  base?: HeadersInit,
): Promise<Headers> {
  const h = new Headers(base ?? undefined);
  const { data, error } = await authClient.getAccessToken({
    providerId: "keycloak",
  });
  const token = data?.accessToken?.trim();
  if (error || !token) {
    const msg =
      error && typeof (error as { message?: string }).message === "string"
        ? (error as { message: string }).message
        : "Keycloak access token required";
    throw new Error(msg);
  }
  h.set("Authorization", `Bearer ${token}`);
  return h;
}
