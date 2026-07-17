import { randomUUID, timingSafeEqual } from "node:crypto";
import { Redis } from "@upstash/redis";

export const COST_ACCOUNTING_LOCK_KEY =
  "branderize:production:cron:cost-accounting:v1";
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
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    throw new CronLockUnavailableError(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required",
    );
  }

  return Redis.fromEnv();
}

export async function acquireAccountingCronLock(): Promise<
  AccountingCronLock | null
> {
  const redis = getRedis();
  const runId = randomUUID();

  let result;
  try {
    result = await redis.set(COST_ACCOUNTING_LOCK_KEY, runId, {
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
        await redis.eval(RELEASE_LOCK_SCRIPT, [COST_ACCOUNTING_LOCK_KEY], [runId]);
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
