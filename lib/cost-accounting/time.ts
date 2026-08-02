const DAY_MS = 24 * 60 * 60 * 1_000;

export type TimeWindow = {
  start: Date;
  end: Date;
};

export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function reconciliationWindows(now = new Date()): {
  aiGateway: TimeWindow;
} {
  const end = now;
  const today = startOfUtcDay(now);

  return {
    // Fourteen days keeps a full reported week inside a post-settlement
    // Gateway snapshot.
    aiGateway: { start: addUtcDays(today, -14), end },
  };
}

export function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
