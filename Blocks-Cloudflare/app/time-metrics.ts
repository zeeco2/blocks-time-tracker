import { eachDayOfInterval, endOfMonth, endOfWeek, isBefore, isSameDay, startOfMonth, startOfWeek } from "date-fns";

export const STANDARD_DAY_MINUTES = 8 * 60;
export const WEEKLY_TARGET_MINUTES = 5 * STANDARD_DAY_MINUTES;
const WORK_START_MINUTE = 9 * 60;

export function isWeekday(date: Date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

export function elapsedWorkMinutes(date: Date) {
  if (!isWeekday(date)) return 0;
  const minute = date.getHours() * 60 + date.getMinutes();
  return Math.max(0, Math.min(STANDARD_DAY_MINUTES, minute - WORK_START_MINUTE));
}

export function monthlyTargetMinutes(date: Date) {
  return eachDayOfInterval({ start: startOfMonth(date), end: endOfMonth(date) })
    .filter(isWeekday).length * STANDARD_DAY_MINUTES;
}

function expectedMinutesInPeriod(start: Date, end: Date, now: Date) {
  return eachDayOfInterval({ start, end }).reduce((total, day) => {
    if (!isWeekday(day) || isBefore(now, day)) return total;
    if (isSameDay(day, now)) return total + elapsedWorkMinutes(now);
    return total + STANDARD_DAY_MINUTES;
  }, 0);
}

export function weeklyExpectedMinutes(now: Date) {
  return expectedMinutesInPeriod(
    startOfWeek(now, { weekStartsOn: 1 }),
    endOfWeek(now, { weekStartsOn: 1 }),
    now,
  );
}

export function monthlyExpectedMinutes(now: Date) {
  return expectedMinutesInPeriod(startOfMonth(now), endOfMonth(now), now);
}

export function chartSegments(minutes: number, maxOvertimeMinutes: number) {
  const regular = Math.min(minutes, STANDARD_DAY_MINUTES);
  const overtime = Math.max(0, minutes - STANDARD_DAY_MINUTES);
  const overtimeScale = Math.max(2 * 60, maxOvertimeMinutes);
  return {
    regularHeight: regular / STANDARD_DAY_MINUTES * 80,
    overtimeHeight: overtime / overtimeScale * 20,
  };
}
