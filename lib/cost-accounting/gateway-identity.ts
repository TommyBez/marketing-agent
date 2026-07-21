import { createHash } from "node:crypto";

const GATEWAY_APP_TAG_PREFIX = "branderize";

export function gatewayUserIdForIdentity(
  workspaceId: string,
  userId: string,
): string {
  const digest = createHash("sha256")
    .update(`${workspaceId}:${userId}`)
    .digest("base64url");
  return `brz_${digest}`;
}

export function gatewayReportingTag(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const environment = env.VERCEL_ENV
    ?? (env.NODE_ENV === "production" ? "production" : "development");
  return `${GATEWAY_APP_TAG_PREFIX}:${environment}`;
}
