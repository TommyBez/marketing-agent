const MICRO_USD_PER_USD = BigInt(1_000_000);

export function usdToMicrousd(value: number | string): bigint {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    throw new Error(`Invalid USD amount: ${value}`);
  }

  return BigInt(Math.round(numericValue * Number(MICRO_USD_PER_USD)));
}

export function microusdToUsd(value: bigint): number {
  return Number(value) / Number(MICRO_USD_PER_USD);
}

export function usdDecimal(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid USD amount: ${value}`);
  }

  return value.toFixed(12);
}

export function sumUsd(values: Array<number | string | null | undefined>): number {
  return values.reduce<number>((total, value) => {
    if (value === null || value === undefined) {
      return total;
    }

    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? total + parsed : total;
  }, 0);
}

export function pricingFloorForMargin(costUsd: number, targetMargin: number): number {
  if (targetMargin < 0 || targetMargin >= 1) {
    throw new Error("Target margin must be greater than or equal to 0 and below 1");
  }

  return costUsd / (1 - targetMargin);
}

export const PILOT_GRANT_MICROUSD = BigInt(25) * MICRO_USD_PER_USD;
