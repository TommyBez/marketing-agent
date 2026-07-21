import { randomUUID } from "node:crypto";
import { and, eq, inArray, like } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  aiCreditAccounts,
  aiCreditLedgerEntries,
  companyProfiles,
} from "@/lib/db/schema";
import { PILOT_GRANT_MICROUSD } from "@/lib/cost-accounting/money";
import { ledgerAdjustmentToTarget } from "@/lib/cost-accounting/ledger-math";

export type PilotGrantResult = {
  selected: number;
  granted: number;
  alreadyGranted: number;
};

export async function grantPilotCredits(input: {
  all?: boolean;
  workspaceIds?: string[];
}): Promise<PilotGrantResult> {
  if (!input.all && (!input.workspaceIds || input.workspaceIds.length === 0)) {
    throw new Error("Select --all or at least one workspace");
  }

  const profiles = input.all
    ? await db
        .select({
          workspaceId: companyProfiles.id,
          organizationId: companyProfiles.organizationId,
        })
        .from(companyProfiles)
    : await db
        .select({
          workspaceId: companyProfiles.id,
          organizationId: companyProfiles.organizationId,
        })
        .from(companyProfiles)
        .where(inArray(companyProfiles.id, input.workspaceIds ?? []));

  let granted = 0;

  for (const profile of profiles) {
    const didGrant = await db.transaction(async (tx) => {
      await tx
        .insert(aiCreditAccounts)
        .values({
          workspaceId: profile.workspaceId,
          organizationId: profile.organizationId,
        })
        .onConflictDoNothing();

      const [account] = await tx
        .select({ balanceMicrousd: aiCreditAccounts.balanceMicrousd })
        .from(aiCreditAccounts)
        .where(eq(aiCreditAccounts.workspaceId, profile.workspaceId))
        .for("update");

      if (!account) {
        throw new Error(`Missing account for workspace ${profile.workspaceId}`);
      }

      const idempotencyKey = `pilot:v1:${profile.workspaceId}`;
      const [existing] = await tx
        .select({ id: aiCreditLedgerEntries.id })
        .from(aiCreditLedgerEntries)
        .where(
          and(
            eq(aiCreditLedgerEntries.workspaceId, profile.workspaceId),
            eq(aiCreditLedgerEntries.idempotencyKey, idempotencyKey),
          ),
        )
        .limit(1);

      if (existing) {
        return false;
      }

      const balanceAfterMicrousd =
        account.balanceMicrousd + PILOT_GRANT_MICROUSD;

      await tx.insert(aiCreditLedgerEntries).values({
        workspaceId: profile.workspaceId,
        kind: "pilot_grant",
        amountMicrousd: PILOT_GRANT_MICROUSD,
        balanceAfterMicrousd,
        idempotencyKey,
        reason: "One-time pilot allocation of 25 AI credits",
        metadata: { credits: 25, campaign: "pilot-v1" },
        occurredAt: new Date(),
      });

      await tx
        .update(aiCreditAccounts)
        .set({
          balanceMicrousd: balanceAfterMicrousd,
          updatedAt: new Date(),
        })
        .where(eq(aiCreditAccounts.workspaceId, profile.workspaceId));

      return true;
    });

    if (didGrant) {
      granted += 1;
    }
  }

  return {
    selected: profiles.length,
    granted,
    alreadyGranted: profiles.length - granted,
  };
}

export async function applyGatewaySpendAdjustment(input: {
  workspaceId: string;
  userId: string;
  windowKey: string;
  gatewayUserId: string;
  targetResidualCostMicrousd: bigint;
  reportedCostUsd: number;
  localCostUsd: number;
  occurredAt: Date;
}): Promise<bigint> {
  const prefix = `gateway-report:${input.windowKey}:${input.gatewayUserId}:`;

  return db.transaction(async (tx) => {
    const [account] = await tx
      .select({ balanceMicrousd: aiCreditAccounts.balanceMicrousd })
      .from(aiCreditAccounts)
      .where(eq(aiCreditAccounts.workspaceId, input.workspaceId))
      .for("update");

    if (!account) {
      throw new Error(`Missing account for workspace ${input.workspaceId}`);
    }

    const priorEntries = await tx
      .select({ amountMicrousd: aiCreditLedgerEntries.amountMicrousd })
      .from(aiCreditLedgerEntries)
      .where(
        and(
          eq(aiCreditLedgerEntries.workspaceId, input.workspaceId),
          like(
            aiCreditLedgerEntries.idempotencyKey,
            `${escapeLikePattern(prefix)}%`,
          ),
        ),
      );
    const priorLedgerAmount = priorEntries.reduce(
      (total, entry) => total + entry.amountMicrousd,
      BigInt(0),
    );
    const targetLedgerAmount = -input.targetResidualCostMicrousd;
    const adjustment = ledgerAdjustmentToTarget(
      priorLedgerAmount,
      targetLedgerAmount,
    );

    if (adjustment === BigInt(0)) {
      return adjustment;
    }

    const balanceAfterMicrousd = account.balanceMicrousd + adjustment;
    const idempotencyKey = `${prefix}${randomUUID()}`;
    const [inserted] = await tx
      .insert(aiCreditLedgerEntries)
      .values({
        workspaceId: input.workspaceId,
        userId: input.userId,
        kind: "reconciliation_adjustment",
        amountMicrousd: adjustment,
        balanceAfterMicrousd,
        idempotencyKey,
        reason: "AI Gateway spend report reconciliation",
        metadata: {
          gatewayUserId: input.gatewayUserId,
          windowKey: input.windowKey,
          reportedCostUsd: input.reportedCostUsd,
          localCostUsd: input.localCostUsd,
        },
        occurredAt: input.occurredAt,
      })
      .onConflictDoNothing({ target: aiCreditLedgerEntries.idempotencyKey })
      .returning({ id: aiCreditLedgerEntries.id });

    if (!inserted) {
      return BigInt(0);
    }

    await tx
      .update(aiCreditAccounts)
      .set({
        balanceMicrousd: balanceAfterMicrousd,
        updatedAt: new Date(),
      })
      .where(eq(aiCreditAccounts.workspaceId, input.workspaceId));

    return adjustment;
  });
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/gu, "\\$&");
}
