import { randomUUID, timingSafeEqual } from "node:crypto";
import { Redis } from "@upstash/redis";
import { gatewayReportingTag } from "@/lib/cost-accounting/gateway-identity";

export const COST_ACCOUNTING_LOCK_TTL_MS = 330_000;

const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

export type AccountingCronLock = {
  runId: string;
  release: () => Promise<void>;
};

export class CronLockUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CronLockUnavailableError";
  }
}

function getRedis(): Redis {
  if (!hasRedisEnvironment()) {
    throw new CronLockUnavailableError(
      "Upstash Redis REST URL and token are required",
    );
  }

  return Redis.fromEnv();
}

export function hasRedisEnvironment(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  return Boolean(url && token);
}

export function costAccountingLockKey(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  return `${gatewayReportingTag(env)}:cron:cost-accounting:v1`;
}

export function isAccountingCronEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env.VERCEL_ENV !== "preview";
}

export async function acquireAccountingCronLock(): Promise<
  AccountingCronLock | null
> {
  const redis = getRedis();
  const runId = randomUUID();
  const lockKey = costAccountingLockKey();

  let result;
  try {
    result = await redis.set(lockKey, runId, {
      nx: true,
      px: COST_ACCOUNTING_LOCK_TTL_MS,
    });
  } catch (error) {
    throw new CronLockUnavailableError("Unable to acquire accounting cron lock", {
      cause: error,
    });
  }

  if (result !== "OK") {
    return null;
  }

  return {
    runId,
    release: async () => {
      try {
        await redis.eval(RELEASE_LOCK_SCRIPT, [lockKey], [runId]);
      } catch (error) {
        console.error("[cost-accounting] unable to release cron lock", {
          runId,
          error,
        });
      }
    },
  };
}

export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  const provided = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!secret || !provided) {
    return false;
  }

  const expectedBuffer = Buffer.from(secret);
  const providedBuffer = Buffer.from(provided);

  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}
