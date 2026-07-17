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
  focus: TimeWindow;
  workflow: TimeWindow;
  sandbox: TimeWindow;
} {
  const end = now;
  const today = startOfUtcDay(now);

  return {
    aiGateway: { start: addUtcDays(today, -7), end },
    focus: { start: addUtcDays(today, -7), end },
    workflow: { start: new Date(now.getTime() - 30 * 60 * 60 * 1_000), end },
    sandbox: { start: addUtcDays(today, -2), end },
  };
}

export function previousFullUtcWeek(now = new Date(), weeksAgo = 1): TimeWindow {
  const today = startOfUtcDay(now);
  const mondayOffset = (today.getUTCDay() + 6) % 7;
  const currentMonday = addUtcDays(today, -mondayOffset);
  const end = addUtcDays(currentMonday, -7 * (weeksAgo - 1));

  return {
    start: addUtcDays(end, -7),
    end,
  };
}

export function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

