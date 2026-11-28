const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface AvailabilityWindow {
  days: string[];
  startMinutes: number;
  endMinutes: number;
}

function parseTime(value: unknown): number | null {
  if (typeof value !== "string") return null;

  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (minutes > 59) return null;

  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (meridiem === "PM" ? 12 : 0);
  } else if (hours > 23) {
    return null;
  }

  return hours * 60 + minutes;
}

function getDays(dayValue: unknown): string[] {
  if (typeof dayValue !== "string") return [];

  const matches = [...dayValue.matchAll(/mon|tue|wed|thu|fri|sat|sun/gi)];
  const dayIndexes = matches.map((match) => {
    const prefix = match[0].toLowerCase();
    return DAYS_OF_WEEK.findIndex((day) => day.toLowerCase().startsWith(prefix));
  });
  const validDayIndexes = dayIndexes.filter((index) => index >= 0);
  if (validDayIndexes.length === 0) return [];

  const hasRangeSeparator = /[-–—]|\bto\b/i.test(dayValue);
  if (hasRangeSeparator && validDayIndexes.length >= 2) {
    const first = validDayIndexes[0];
    const last = validDayIndexes[validDayIndexes.length - 1];
    if (first <= last) return DAYS_OF_WEEK.slice(first, last + 1);
  }

  return [...new Set(validDayIndexes.map((index) => DAYS_OF_WEEK[index]))];
}

function getSlots(value: unknown): unknown[] {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }

  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed !== "object" || parsed === null) return [];

  const record = parsed as Record<string, unknown>;
  if ("day" in record) return [record];
  if (Object.keys(record).every((key) => /^\d+$/.test(key))) {
    return Object.values(record);
  }

  return [];
}

function getAvailabilityWindows(availability: unknown): AvailabilityWindow[] {
  return getSlots(availability).flatMap((slot) => {
    if (typeof slot !== "object" || slot === null) return [];

    const record = slot as Record<string, unknown>;
    const days = getDays(record.day);
    const startMinutes = parseTime(record.startTime ?? record.start_time);
    const endMinutes = parseTime(record.endTime ?? record.end_time);
    if (
      days.length === 0 ||
      startMinutes === null ||
      endMinutes === null ||
      endMinutes <= startMinutes
    ) {
      return [];
    }

    return [{ days, startMinutes, endMinutes }];
  });
}

export function isTeacherTimeWithinAvailability(
  availability: unknown,
  day: string,
  startTime: string,
  endTime: string,
): boolean {
  const startMinutes = parseTime(startTime);
  const endMinutes = parseTime(endTime);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return false;
  }

  const configuredWindows = getAvailabilityWindows(availability);
  const windows =
    configuredWindows.length > 0
      ? configuredWindows
      : DAYS_OF_WEEK.map((availableDay) => ({
          days: [availableDay],
          startMinutes: 7 * 60,
          endMinutes: 22 * 60,
        }));

  return windows.some(
    (window) =>
      window.days.some(
        (availableDay) => availableDay.toLowerCase() === day.toLowerCase(),
      ) &&
      startMinutes >= window.startMinutes &&
      endMinutes <= window.endMinutes,
  );
}