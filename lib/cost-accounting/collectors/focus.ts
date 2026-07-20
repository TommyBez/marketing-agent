import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { vercelBillingCharges } from "@/lib/db/schema";
import type { CollectorWindow } from "./types";

type FocusRow = Record<string, unknown>;
type FocusChargeInsert = typeof vercelBillingCharges.$inferInsert;

export type FocusJsonLine =
  | { kind: "row"; lineNumber: number; row: FocusRow }
  | { kind: "warning"; lineNumber: number; message: string };

const FOCUS_WRITE_BATCH_SIZE = 250;

export type FocusCollectorResult = {
  service: "vercel_focus";
  status: "complete" | "partial";
  rowsRead: number;
  rowsImported: number;
  rowsOutsideProject: number;
  billedCostUsd: number;
  effectiveCostUsd: number;
  warnings: Array<{ operation: string; resourceId?: string; message: string }>;
};

export async function collectFocusCharges(input: {
  reconciliationRunId: string;
  window: CollectorWindow;
}): Promise<FocusCollectorResult> {
  const token = process.env.VERCEL_BILLING_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !teamId || !projectId) {
    throw new Error(
      "VERCEL_BILLING_TOKEN, VERCEL_TEAM_ID and VERCEL_PROJECT_ID are required",
    );
  }

  const url = new URL("https://api.vercel.com/v1/billing/charges");
  url.searchParams.set("teamId", teamId);
  url.searchParams.set("from", input.window.start.toISOString());
  url.searchParams.set("to", input.window.end.toISOString());

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/x-ndjson, application/json",
      "accept-encoding": "gzip",
    },
  });
  if (!response.ok || !response.body) {
    throw new Error(
      `Vercel billing charges request failed (${response.status}): ${await response.text()}`,
    );
  }

  let rowsRead = 0;
  let rowsImported = 0;
  let rowsOutsideProject = 0;
  let billedCostUsd = 0;
  let effectiveCostUsd = 0;
  const warnings: FocusCollectorResult["warnings"] = [];
  const charges: FocusChargeInsert[] = [];

  for await (const parsedLine of parseFocusJsonLines(response.body)) {
    rowsRead += 1;
    if (parsedLine.kind === "warning") {
      warnings.push({
        operation: "parseCharge",
        resourceId: `line:${parsedLine.lineNumber}`,
        message: parsedLine.message,
      });
      continue;
    }

    const row = parsedLine.row;
    if (!belongsToProjectOrSharedCharge(row, projectId)) {
      rowsOutsideProject += 1;
      continue;
    }

    try {
      const normalized = normalizeFocusRow(row);
      charges.push({
        reconciliationRunId: input.reconciliationRunId,
        sourceChargeKey: normalized.sourceChargeKey,
        serviceName: normalized.serviceName,
        skuId: normalized.skuId,
        skuName: normalized.skuName,
        chargeCategory: normalized.chargeCategory,
        chargePeriodStart: normalized.chargePeriodStart,
        chargePeriodEnd: normalized.chargePeriodEnd,
        usageQuantity: normalized.usageQuantity,
        usageUnit: normalized.usageUnit,
        listCostUsd: normalized.listCostUsd,
        billedCostUsd: normalized.billedCostUsd,
        effectiveCostUsd: normalized.effectiveCostUsd,
        currency: normalized.currency,
        rawCharge: row,
      });
    } catch (error) {
      warnings.push({
        operation: "normalizeCharge",
        resourceId: stringField(row, "ChargeId", "chargeId"),
        message: errorMessage(error),
      });
    }
  }

  const upsertBatches = focusUpsertBatches(charges);
  const uniqueCharges = upsertBatches.flat();
  rowsImported = uniqueCharges.length;
  billedCostUsd = uniqueCharges.reduce(
    (total, charge) => total + Number(charge.billedCostUsd),
    0,
  );
  effectiveCostUsd = uniqueCharges.reduce(
    (total, charge) => total + Number(charge.effectiveCostUsd),
    0,
  );

  await db.transaction(async (tx) => {
    for (const batch of upsertBatches) {
      await tx
        .insert(vercelBillingCharges)
        .values(batch)
        .onConflictDoUpdate({
          target: [
            vercelBillingCharges.reconciliationRunId,
            vercelBillingCharges.sourceChargeKey,
          ],
          set: {
            billedCostUsd: sql`excluded."billedCostUsd"`,
            effectiveCostUsd: sql`excluded."effectiveCostUsd"`,
            listCostUsd: sql`excluded."listCostUsd"`,
            usageQuantity: sql`excluded."usageQuantity"`,
            rawCharge: sql`excluded."rawCharge"`,
            importedAt: new Date(),
          },
        });
    }
  });

  return {
    service: "vercel_focus",
    status: warnings.length > 0 ? "partial" : "complete",
    rowsRead,
    rowsImported,
    rowsOutsideProject,
    billedCostUsd,
    effectiveCostUsd,
    warnings,
  };
}

export function focusUpsertBatches<T extends { sourceChargeKey: string }>(
  rows: T[],
  batchSize = FOCUS_WRITE_BATCH_SIZE,
): T[][] {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("FOCUS batch size must be a positive integer");
  }

  const deduped = new Map<string, T>();
  for (const row of rows) {
    deduped.set(row.sourceChargeKey, row);
  }

  const uniqueRows = [...deduped.values()];
  const batches: T[][] = [];
  for (let index = 0; index < uniqueRows.length; index += batchSize) {
    batches.push(uniqueRows.slice(index, index + batchSize));
  }
  return batches;
}

export function normalizeFocusRow(row: FocusRow) {
  const chargePeriodStart = dateField(
    row,
    "ChargePeriodStart",
    "chargePeriodStart",
    "charge_period_start",
  );
  const chargePeriodEnd = dateField(
    row,
    "ChargePeriodEnd",
    "chargePeriodEnd",
    "charge_period_end",
  );
  if (chargePeriodEnd <= chargePeriodStart) {
    throw new Error("ChargePeriodEnd must be after ChargePeriodStart");
  }

  const currency =
    stringField(row, "BillingCurrency", "billingCurrency", "billing_currency") ??
    "USD";
  if (currency.toUpperCase() !== "USD") {
    throw new Error(`Unsupported billing currency ${currency}`);
  }

  const sourceChargeKey =
    stringField(row, "ChargeId", "chargeId", "charge_id") ?? stableRowHash(row);
  const billedCost = requiredDecimalField(
    row,
    "BilledCost",
    "billedCost",
    "billed_cost",
  );
  const effectiveCost = requiredDecimalField(
    row,
    "EffectiveCost",
    "effectiveCost",
    "effective_cost",
  );

  return {
    sourceChargeKey,
    serviceName:
      stringField(row, "ServiceName", "serviceName", "service_name") ??
      "Unknown",
    skuId: stringField(
      row,
      "SkuId",
      "skuId",
      "sku_id",
      "SkuPriceId",
      "skuPriceId",
    ),
    skuName: stringField(
      row,
      "SkuName",
      "skuName",
      "SkuPriceId",
      "skuPriceId",
    ),
    chargeCategory: stringField(
      row,
      "ChargeCategory",
      "chargeCategory",
      "charge_category",
    ),
    chargePeriodStart,
    chargePeriodEnd,
    usageQuantity: decimalField(
      row,
      "ConsumedQuantity",
      "consumedQuantity",
      "consumed_quantity",
    ),
    usageUnit: stringField(
      row,
      "ConsumedUnit",
      "consumedUnit",
      "consumed_unit",
    ),
    listCostUsd: decimalField(row, "ListCost", "listCost", "list_cost"),
    billedCostUsd: billedCost,
    effectiveCostUsd: effectiveCost,
    currency: currency.toUpperCase(),
  };
}

export function belongsToProjectOrSharedCharge(
  row: FocusRow,
  projectId: string,
): boolean {
  const scopedIds = [
    stringField(row, "SubAccountId", "subAccountId", "sub_account_id"),
    stringField(row, "x_Vercel_ProjectId", "x_vercel_project_id", "projectId"),
  ].filter((value): value is string => Boolean(value));
  if (scopedIds.some((value) => value === projectId)) {
    return true;
  }

  const embeddedValues = [
    stringField(row, "ResourceId", "resourceId", "resource_id"),
    ...Object.values(objectField(row, "Tags", "tags") ?? {}).map(String),
  ].filter((value): value is string => Boolean(value));
  if (embeddedValues.some((value) => containsProjectIdToken(value, projectId))) {
    return true;
  }

  const category = (
    stringField(row, "ChargeCategory", "chargeCategory") ?? ""
  ).toLowerCase();
  const subAccountId = stringField(
    row,
    "SubAccountId",
    "subAccountId",
    "sub_account_id",
  );

  // Team-wide credits and adjustments have no project scope. They are retained
  // and allocated to platform_shared instead of being attributed to a tester.
  return !subAccountId && (category === "credit" || category === "adjustment");
}

function containsProjectIdToken(value: string, projectId: string): boolean {
  const escapedProjectId = projectId.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(
    `(?:^|[^A-Za-z0-9_])${escapedProjectId}(?:$|[^A-Za-z0-9_])`,
    "u",
  ).test(value);
}

function parseFocusJsonLine(line: string, lineNumber: number): FocusJsonLine {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line) as unknown;
  } catch {
    return {
      kind: "warning",
      lineNumber,
      message: "Malformed JSON record",
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      kind: "warning",
      lineNumber,
      message: "Expected a JSON object",
    };
  }

  return { kind: "row", lineNumber, row: parsed as FocusRow };
}

export async function* parseFocusJsonLines(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<FocusJsonLine> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lineNumber = 0;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split(/\r?\n/u);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      lineNumber += 1;
      if (!line.trim()) continue;
      yield parseFocusJsonLine(line, lineNumber);
    }

    if (done) break;
  }

  if (buffer.trim()) {
    lineNumber += 1;
    yield parseFocusJsonLine(buffer, lineNumber);
  }
}

function stableRowHash(row: FocusRow): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalJson(row)))
    .digest("hex");
}

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalJson);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalJson(nested)]),
  );
}

function field(row: FocusRow, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return row[key];
  }
  return undefined;
}

function stringField(row: FocusRow, ...keys: string[]): string | undefined {
  const value = field(row, ...keys);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function decimalField(row: FocusRow, ...keys: string[]): string | undefined {
  const value = field(row, ...keys);
  if (value === undefined) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : undefined;
  }
  if (typeof value !== "string") return undefined;

  const normalized = value.trim();
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu.test(normalized)
    ? normalized
    : undefined;
}

function requiredDecimalField(row: FocusRow, ...keys: string[]): string {
  const value = decimalField(row, ...keys);
  if (value === undefined) {
    throw new Error(`Invalid or missing numeric field ${keys[0]}`);
  }
  return value;
}

function objectField(
  row: FocusRow,
  ...keys: string[]
): Record<string, unknown> | undefined {
  const value = field(row, ...keys);
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function dateField(row: FocusRow, ...keys: string[]): Date {
  const value = field(row, ...keys);
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date field ${keys[0]}`);
  }
  return date;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
