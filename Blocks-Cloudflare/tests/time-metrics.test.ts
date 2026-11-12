import { describe, expect, it } from "vitest";
import { chartSegments, elapsedWorkMinutes, monthlyExpectedMinutes, monthlyTargetMinutes, weeklyExpectedMinutes } from "../app/time-metrics";

describe("time targets", () => {
  it("counts weekdays for the monthly target", () => {
    expect(monthlyTargetMinutes(new Date(2026, 10, 11))).toBe(21 * 8 * 60);
    expect(monthlyTargetMinutes(new Date(2027, 0, 1))).toBe(21 * 8 * 60);
  });

  it("counts only elapsed working time today", () => {
    expect(elapsedWorkMinutes(new Date(2026, 10, 11, 8, 59))).toBe(0);
    expect(elapsedWorkMinutes(new Date(2026, 10, 11, 10))).toBe(60);
    expect(elapsedWorkMinutes(new Date(2026, 10, 11, 15))).toBe(360);
    expect(elapsedWorkMinutes(new Date(2026, 10, 11, 18))).toBe(480);
    expect(elapsedWorkMinutes(new Date(2026, 10, 14, 12))).toBe(0);
  });

  it("calculates weekly and monthly expected progress across boundaries", () => {
    expect(weeklyExpectedMinutes(new Date(2026, 10, 11, 12))).toBe(2 * 480 + 180);
    expect(weeklyExpectedMinutes(new Date(2026, 10, 14, 12))).toBe(5 * 480);
    expect(monthlyExpectedMinutes(new Date(2026, 10, 2, 10))).toBe(60);
    expect(monthlyExpectedMinutes(new Date(2027, 0, 1, 10))).toBe(60);
  });
});

describe("weekly chart segments", () => {
  it("keeps the first eight hours on the fixed reference and stacks overtime", () => {
    expect(chartSegments(4 * 60, 2 * 60)).toEqual({ regularHeight: 40, overtimeHeight: 0 });
    expect(chartSegments(8 * 60, 2 * 60)).toEqual({ regularHeight: 80, overtimeHeight: 0 });
    expect(chartSegments(10 * 60, 2 * 60)).toEqual({ regularHeight: 80, overtimeHeight: 20 });
  });
});
