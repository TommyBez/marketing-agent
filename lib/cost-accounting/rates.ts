import { usdDecimal } from "@/lib/cost-accounting/money";

const DECIMAL_GIGABYTE = 1_000_000_000;
const SECONDS_PER_HOUR = 3_600;
const DAYS_PER_BILLING_MONTH = 30;

export const COST_RATE_VERSION = "vercel-public-2026-07-17";

export const PUBLIC_RATES = {
  sandbox: {
    activeCpuHourUsd: 0.128,
    provisionedMemoryGbHourUsd: 0.0212,
    networkGbUsd: 0.15,
    creationUsd: 0.6 / 1_000_000,
    snapshotGbMonthUsd: 0.08,
  },
  workflow: {
    eventUsd: 0.02 / 1_000,
    dataWrittenGbUsd: 0.5,
    dataRetainedGbMonthUsd: 0.5,
  },
} as const;

export function sandboxCpuCost(activeCpuSeconds: number): number {
  return (activeCpuSeconds / SECONDS_PER_HOUR) * PUBLIC_RATES.sandbox.activeCpuHourUsd;
}

export function billedMemorySeconds(durationSeconds: number): number {
  if (durationSeconds <= 0) {
    return 0;
  }

  return Math.ceil(durationSeconds / 60) * 60;
}

export function sandboxMemoryCost(memoryGb: number, durationSeconds: number): number {
  return (
    (memoryGb * billedMemorySeconds(durationSeconds)) /
    SECONDS_PER_HOUR
  ) * PUBLIC_RATES.sandbox.provisionedMemoryGbHourUsd;
}

export function sandboxNetworkCost(bytes: number): number {
  return (bytes / DECIMAL_GIGABYTE) * PUBLIC_RATES.sandbox.networkGbUsd;
}

export function sandboxCreationCost(count = 1): number {
  return count * PUBLIC_RATES.sandbox.creationUsd;
}

export function sandboxSnapshotCost(sizeBytes: number, retainedDays: number): number {
  return (
    (sizeBytes / DECIMAL_GIGABYTE) *
    (retainedDays / DAYS_PER_BILLING_MONTH) *
    PUBLIC_RATES.sandbox.snapshotGbMonthUsd
  );
}

export function workflowEventCost(eventCount: number): number {
  return eventCount * PUBLIC_RATES.workflow.eventUsd;
}

export function workflowDataWrittenCost(bytes: number): number {
  return (
    bytes / DECIMAL_GIGABYTE
  ) * PUBLIC_RATES.workflow.dataWrittenGbUsd;
}

export function workflowDataRetainedCost(
  bytes: number,
  retainedHours: number,
): number {
  return (
    (bytes / DECIMAL_GIGABYTE) *
    (retainedHours / (DAYS_PER_BILLING_MONTH * 24)) *
    PUBLIC_RATES.workflow.dataRetainedGbMonthUsd
  );
}

export function asCostDecimal(value: number): string {
  return usdDecimal(value);
}
