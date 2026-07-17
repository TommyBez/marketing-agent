import { createHash } from "node:crypto";

export function gatewayUserIdForIdentity(
  workspaceId: string,
  userId: string,
): string {
  const digest = createHash("sha256")
    .update(`${workspaceId}:${userId}`)
    .digest("base64url");
  return `brz_${digest}`;
}
