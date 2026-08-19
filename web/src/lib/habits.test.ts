import { describe, it, expect } from "vitest";
import {
  formatDate,
  parseDateKey,
  todayKey,
  getPeriod,
  calcStreak,
  longestStreak,
  restDaysLeft,
  getRestDayAllowance,
  pickAtRiskHabit,
  pickRestOfferHabit,
  allHabitsMetOnDate,
  currentPerfectDayStreak,
  habitToRow,
  rowToHabit,
  newHabit,
  backfillCreatedAt,
  type Habit,
} from "./habits";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDate(d);
}

function baseHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    name: "Test habit",
    target: 1,
    periodValue: 1,
    periodUnit: "day",
    createdAt: daysAgo(30),
    completions: [],
    milestonesHit: [],
    restDays: [],
    archivedAt: null,
    restDayAllowance: 3,
    shared: false,
    ...overrides,
  };
}

describe("date helpers", () => {
  it("parseDateKey reads a YYYY-MM-DD as a local date, not UTC", () => {
    // The classic bug this guards against: new Date("2024-01-01") parses as UTC midnight,
    // which is Dec 31 in any timezone behind UTC. parseDateKey must not do that.
    const d = parseDateKey("2024-01-15");
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(15);
  });

  it("formatDate/parseDateKey round-trip", () => {
    const key = todayKey();
    expect(formatDate(parseDateKey(key))).toBe(key);
  });
});

describe("getPeriod back-compat", () => {
  it("reads periodValue/periodUnit when present", () => {
    const h = baseHabit({ periodValue: 3, periodUnit: "week" });
    expect(getPeriod(h)).toEqual({ value: 3, unit: "week" });
  });

  it("falls back to legacy timeframe when periodUnit is absent", () => {
    const h = baseHabit({ periodUnit: undefined as never, timeframe: "week" });
    expect(getPeriod(h)).toEqual({ value: 1, unit: "week" });
  });
});

describe("calcStreak — rolling window with 'still alive until proven broken' leniency", () => {
  it("is 0 with no completions", () => {
    const h = baseHabit();
    expect(calcStreak(h.completions, 1, 1)).toBe(0);
  });

  it("counts a single day streak", () => {
    const completions = [daysAgo(0)];
    expect(calcStreak(completions, 1, 1)).toBe(1);
  });

  it("counts consecutive daily completions", () => {
    const completions = [daysAgo(0), daysAgo(1), daysAgo(2)];
    expect(calcStreak(completions, 1, 1)).toBe(3);
  });

  it("does not break the streak just because today isn't done yet — falls back to yesterday's window", () => {
    const completions = [daysAgo(1), daysAgo(2), daysAgo(3)]; // today blank
    expect(calcStreak(completions, 1, 1)).toBe(3);
  });

  it("breaks the streak once a real gap exists", () => {
    const completions = [daysAgo(0), daysAgo(1), daysAgo(3)]; // gap at daysAgo(2)
    expect(calcStreak(completions, 1, 1)).toBe(2);
  });

  it("rest days count toward the window like a completion", () => {
    const completions = [daysAgo(0), daysAgo(2)];
    const restDays = [daysAgo(1)];
    expect(calcStreak(completions, 1, 1, restDays)).toBe(3);
  });

  it("respects a target greater than 1 per period", () => {
    const completions = [daysAgo(0), daysAgo(0), daysAgo(1), daysAgo(1)];
    expect(calcStreak(completions, 2, 1)).toBe(2);
  });
});

describe("longestStreak", () => {
  it("is 0 with no completions", () => {
    expect(longestStreak(baseHabit())).toBe(0);
  });

  it("finds the longest run even if it's not the current one", () => {
    // A 5-day streak from 20-16 days ago, then a gap, then today only.
    const completions = [
      daysAgo(20),
      daysAgo(19),
      daysAgo(18),
      daysAgo(17),
      daysAgo(16),
      daysAgo(0),
    ];
    const h = baseHabit({ completions, createdAt: daysAgo(25) });
    expect(longestStreak(h)).toBe(5);
  });
});

describe("rest days", () => {
  it("defaults to an allowance of 3", () => {
    const h = baseHabit({ restDayAllowance: undefined as never });
    expect(getRestDayAllowance(h)).toBe(3);
  });

  it("respects a configured per-habit allowance", () => {
    const h = baseHabit({ restDayAllowance: 5 });
    expect(getRestDayAllowance(h)).toBe(5);
  });

  it("restDaysLeft subtracts this month's usage from the allowance", () => {
    const thisMonth = todayKey().slice(0, 7);
    const h = baseHabit({ restDayAllowance: 3, restDays: [`${thisMonth}-01`, `${thisMonth}-02`] });
    expect(restDaysLeft(h)).toBe(1);
  });

  it("never goes negative", () => {
    const thisMonth = todayKey().slice(0, 7);
    const h = baseHabit({
      restDayAllowance: 1,
      restDays: [`${thisMonth}-01`, `${thisMonth}-02`, `${thisMonth}-03`],
    });
    expect(restDaysLeft(h)).toBe(0);
  });
});

describe("pickAtRiskHabit", () => {
  it("flags a daily habit not yet done today as at risk (0 days left in the window)", () => {
    const h = baseHabit({ completions: [], createdAt: daysAgo(10) });
    const result = pickAtRiskHabit([h]);
    expect(result).not.toBeNull();
    expect(result?.habit.id).toBe("h1");
  });

  it("does not flag a habit whose target is already met today", () => {
    const h = baseHabit({ completions: [daysAgo(0)], createdAt: daysAgo(10) });
    expect(pickAtRiskHabit([h])).toBeNull();
  });

  it("picks the habit with the longer current streak when multiple qualify", () => {
    const short = baseHabit({ id: "short", completions: [daysAgo(1)], createdAt: daysAgo(10) });
    const long = baseHabit({
      id: "long",
      completions: [daysAgo(1), daysAgo(2), daysAgo(3), daysAgo(4)],
      createdAt: daysAgo(10),
    });
    const result = pickAtRiskHabit([short, long]);
    expect(result?.habit.id).toBe("long");
  });
});

describe("pickRestOfferHabit", () => {
  it("offers a rest day for a single missed day in the previous period when one is available", () => {
    // A daily habit created 10 days ago, done every day except yesterday.
    const completions = [daysAgo(0), daysAgo(2), daysAgo(3), daysAgo(4)];
    const h = baseHabit({ completions, createdAt: daysAgo(10) });
    const offer = pickRestOfferHabit([h], new Set());
    expect(offer).not.toBeNull();
    expect(offer?.blankDates).toEqual([daysAgo(1)]);
  });

  it("does not offer when no rest days are left", () => {
    const thisMonth = todayKey().slice(0, 7);
    const completions = [daysAgo(0), daysAgo(2)];
    const h = baseHabit({
      completions,
      createdAt: daysAgo(10),
      restDayAllowance: 1,
      restDays: [`${thisMonth}-01`],
    });
    expect(pickRestOfferHabit([h], new Set())).toBeNull();
  });

  it("respects a dismissed offer key", () => {
    const completions = [daysAgo(0), daysAgo(2)];
    const h = baseHabit({ completions, createdAt: daysAgo(10) });
    const first = pickRestOfferHabit([h], new Set());
    expect(first).not.toBeNull();
    const dismissed = new Set([first!.key]);
    expect(pickRestOfferHabit([h], dismissed)).toBeNull();
  });
});

describe("perfect day / milestone helpers", () => {
  it("allHabitsMetOnDate is false with zero habits", () => {
    expect(allHabitsMetOnDate([], new Date())).toBe(false);
  });

  it("currentPerfectDayStreak counts back only while every habit was met", () => {
    const h1 = baseHabit({ id: "a", completions: [daysAgo(0), daysAgo(1)], createdAt: daysAgo(5) });
    const h2 = baseHabit({ id: "b", completions: [daysAgo(0)], createdAt: daysAgo(5) }); // missed yesterday
    expect(currentPerfectDayStreak([h1, h2])).toBe(1);
  });
});

describe("habitToRow / rowToHabit round-trip", () => {
  it("preserves every field through a round trip", () => {
    const h = baseHabit({ completions: [daysAgo(0)], milestonesHit: [7], restDays: [daysAgo(3)] });
    const row = habitToRow(h, "user-1");
    const back = rowToHabit({ ...row, position: 0 });
    expect(back).toEqual(h);
  });
});

describe("newHabit / backfillCreatedAt", () => {
  it("newHabit stamps today as createdAt and empty arrays", () => {
    const h = newHabit("Read", 1, 1, "day");
    expect(h.createdAt).toBe(todayKey());
    expect(h.completions).toEqual([]);
    expect(h.restDayAllowance).toBe(3);
  });

  it("backfillCreatedAt uses the earliest completion when present", () => {
    const h = baseHabit({ createdAt: null, completions: [daysAgo(5), daysAgo(1)] });
    const changed = backfillCreatedAt(h);
    expect(changed).toBe(true);
    expect(h.createdAt).toBe(daysAgo(5));
  });

  it("backfillCreatedAt is a no-op once createdAt is set", () => {
    const h = baseHabit({ createdAt: daysAgo(5) });
    expect(backfillCreatedAt(h)).toBe(false);
    expect(h.createdAt).toBe(daysAgo(5));
  });
});
