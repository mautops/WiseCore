import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import {
  genericOAuth,
  keycloak,
} from "better-auth/plugins";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
const usePgAdapter = Boolean(databaseUrl);

function stripTrailingSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

/** Public site URL(s) for CSRF / origin checks behind HTTPS ingress. */
function trustedOriginsFromEnv(): string[] | undefined {
  const fromList = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((s) => stripTrailingSlash(s.trim()))
    .filter(Boolean);
  const single = [
    process.env.BETTER_AUTH_URL?.trim(),
    process.env.NEXT_PUBLIC_APP_URL?.trim(),
  ]
    .filter((u): u is string => Boolean(u))
    .map(stripTrailingSlash);
  const merged = [...new Set([...single, ...fromList])];
  return merged.length > 0 ? merged : undefined;
}

/** Check if Keycloak OAuth is configured. */
function isKeycloakConfigured(): boolean {
  return Boolean(
    process.env.KEYCLOAK_CLIENT_ID?.trim() &&
    process.env.KEYCLOAK_CLIENT_SECRET?.trim() &&
    process.env.KEYCLOAK_ISSUER?.trim(),
  );
}

/** Build plugins array - nextCookies must be last. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPlugins(): any[] {
  const plugins = [];

  if (isKeycloakConfigured()) {
    plugins.push(
      genericOAuth({
        config: [
          keycloak({
            clientId: process.env.KEYCLOAK_CLIENT_ID!.trim(),
            clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!.trim(),
            issuer: stripTrailingSlash(process.env.KEYCLOAK_ISSUER!.trim()),
          }),
        ],
      }),
    );
  }

  // nextCookies must be the last plugin
  plugins.push(nextCookies());

  return plugins;
}

export const auth = betterAuth({
  trustedOrigins: trustedOriginsFromEnv(),
  ...(usePgAdapter
    ? {
        database: new Pool({
          connectionString: databaseUrl as string,
        }),
      }
    : {}),
  user: {
    additionalFields: {
      username: { type: "string", required: false, defaultValue: "" },
    },
  },
  plugins: buildPlugins(),
});