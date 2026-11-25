import type { GeneratedScheduleEntry } from "./autoScheduleValidation";

export interface RepairRoom {
  roomId: string;
  roomName: string;
}

export interface RepairScheduleOptions<T extends GeneratedScheduleEntry> {
  days: string[];
  dayStartMinutes: number;
  dayEndMinutes: number;
  isTimeAllowed: (
    entry: T,
    day: string,
    startTime: string,
    endTime: string,
  ) => boolean;
  isBreakTime: (day: string, startTime: string, endTime: string) => boolean;
  getRooms: (entry: T) => RepairRoom[];
  hasAdditionalConflict?: (first: T, second: T) => boolean;
  forceMoveSubjectIds?: Set<string>;
}

export interface RepairScheduleResult<T> {
  entries: T[];
  complete: boolean;
  movedEntries: number;
}

interface TimedEntry<T> {
  entry: T;
  start: number;
  end: number;
}

function parseTime(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

function formatTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function componentKey(entry: GeneratedScheduleEntry): string {
  return `${entry.sectionCode}|${entry.subjectId}|${entry.componentType}`;
}

function intervalsOverlap(
  first: TimedEntry<GeneratedScheduleEntry>,
  second: TimedEntry<GeneratedScheduleEntry>,
): boolean {
  return first.start < second.end && second.start < first.end;
}

function entriesConflict<T extends GeneratedScheduleEntry>(
  first: TimedEntry<T>,
  second: TimedEntry<T>,
  hasAdditionalConflict?: (first: T, second: T) => boolean,
): boolean {
  if (
    first.entry.day.trim().toLowerCase() !==
      second.entry.day.trim().toLowerCase() ||
    !intervalsOverlap(first, second)
  ) {
    return false;
  }

  return (
    first.entry.sectionCode === second.entry.sectionCode ||
    (!!first.entry.teacherId &&
      first.entry.teacherId === second.entry.teacherId) ||
    (!!first.entry.roomId && first.entry.roomId === second.entry.roomId) ||
    !!hasAdditionalConflict?.(first.entry, second.entry)
  );
}

function hasScheduleConflicts<T extends GeneratedScheduleEntry>(
  entries: T[],
  hasAdditionalConflict?: (first: T, second: T) => boolean,
): boolean {
  const timedEntries: TimedEntry<T>[] = [];
  for (const entry of entries) {
    const start = parseTime(entry.startTime);
    const end = parseTime(entry.endTime);
    if (start === null || end === null || end <= start || !entry.day.trim()) {
      return true;
    }
    timedEntries.push({ entry, start, end });
  }

  for (let firstIndex = 0; firstIndex < timedEntries.length; firstIndex++) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < timedEntries.length;
      secondIndex++
    ) {
      if (
        entriesConflict(
          timedEntries[firstIndex],
          timedEntries[secondIndex],
          hasAdditionalConflict,
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

export function repairGeneratedSchedule<T extends GeneratedScheduleEntry>(
  entries: T[],
  requiredEntries: T[],
  options: RepairScheduleOptions<T>,
): RepairScheduleResult<T> {
  const requiredByKey = new Map(
    requiredEntries.map((entry) => [componentKey(entry), entry]),
  );
  const entriesByKey = new Set(entries.map(componentKey));
  const missingEntries = requiredEntries.filter(
    (entry) => !entriesByKey.has(componentKey(entry)),
  );
  const requiredPrototypes = new Map(requiredByKey);
  const targets = new Set<number>();

  entries.forEach((entry, index) => {
    const start = parseTime(entry.startTime);
    const end = parseTime(entry.endTime);
    if (start === null || end === null || end <= start || !entry.day.trim()) {
      targets.add(index);
    }
    if (options.forceMoveSubjectIds?.has(entry.subjectId)) targets.add(index);
  });

  const timedEntries = entries.flatMap((entry, index) => {
    const start = parseTime(entry.startTime);
    const end = parseTime(entry.endTime);
    return start === null || end === null || end <= start
      ? []
      : [{ entry, start, end, index }];
  });

  for (let firstIndex = 0; firstIndex < timedEntries.length; firstIndex++) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < timedEntries.length;
      secondIndex++
    ) {
      const first = timedEntries[firstIndex];
      const second = timedEntries[secondIndex];
      if (entriesConflict(first, second, options.hasAdditionalConflict)) {
        targets.add(second.index);
      }
    }
  }

  if (targets.size === 0 && missingEntries.length === 0) {
    return {
      entries: entries.map((entry) => ({ ...entry })),
      complete: true,
      movedEntries: 0,
    };
  }

  const durationFor = (entry: T): number => {
    const start = parseTime(entry.startTime);
    const end = parseTime(entry.endTime);
    if (start !== null && end !== null && end > start) return end - start;

    const prototype = requiredPrototypes.get(componentKey(entry));
    const prototypeStart = prototype ? parseTime(prototype.startTime) : null;
    const prototypeEnd = prototype ? parseTime(prototype.endTime) : null;
    return prototypeStart !== null &&
      prototypeEnd !== null &&
      prototypeEnd > prototypeStart
      ? prototypeEnd - prototypeStart
      : 30;
  };

  function placeEntry(entry: T, occupied: T[]): T | null {
    const duration = durationFor(entry);
    const originalStart = parseTime(entry.startTime) ?? options.dayStartMinutes;
    const originalDay = options.days.includes(entry.day)
      ? entry.day
      : options.days[0];
    const roomOptions = options.getRooms(entry);
    if (roomOptions.length === 0) return null;

    const candidates: Array<{
      day: string;
      start: number;
      room: RepairRoom;
      score: number;
    }> = [];

    options.days.forEach((day, dayIndex) => {
      for (
        let start = options.dayStartMinutes;
        start + duration <= options.dayEndMinutes;
        start += 30
      ) {
        const end = start + duration;
        const startTime = formatTime(start);
        const endTime = formatTime(end);
        if (
          options.isBreakTime(day, startTime, endTime) ||
          !options.isTimeAllowed(entry, day, startTime, endTime)
        ) {
          continue;
        }

        for (const room of roomOptions) {
          const candidate = {
            ...entry,
            day,
            startTime,
            endTime,
            roomId: room.roomId,
            roomName: room.roomName,
          } as T;
          const candidateTimed = { entry: candidate, start, end };
          const conflicts = occupied.some((other) => {
            const otherStart = parseTime(other.startTime);
            const otherEnd = parseTime(other.endTime);
            return (
              otherStart !== null &&
              otherEnd !== null &&
              entriesConflict(
                candidateTimed,
                {
                  entry: other,
                  start: otherStart,
                  end: otherEnd,
                },
                options.hasAdditionalConflict,
              )
            );
          });
          if (conflicts) continue;

          const sameDayPenalty = day === originalDay ? 0 : 1440 + dayIndex * 5;
          const roomPenalty = room.roomId === entry.roomId ? 0 : 5;
          candidates.push({
            day,
            start,
            room,
            score:
              sameDayPenalty + Math.abs(start - originalStart) + roomPenalty,
          });
        }
      }
    });

    candidates.sort((first, second) => first.score - second.score);
    const candidate = candidates[0];
    if (!candidate) return null;

    return {
      ...entry,
      day: candidate.day,
      startTime: formatTime(candidate.start),
      endTime: formatTime(candidate.start + duration),
      roomId: candidate.room.roomId,
      roomName: candidate.room.roomName,
    };
  }

  function runAttempt(
    orderedEntries: T[],
    preserveOriginals: boolean,
  ): T[] | null {
    const placed: T[] = [];
    for (const entry of orderedEntries) {
      if (preserveOriginals && !targets.has(entries.indexOf(entry))) {
        const start = parseTime(entry.startTime);
        const end = parseTime(entry.endTime);
        const roomStillExists = options
          .getRooms(entry)
          .some((room) => room.roomId === entry.roomId);
        const originalIsAllowed =
          start !== null &&
          end !== null &&
          end > start &&
          roomStillExists &&
          !options.isBreakTime(entry.day, entry.startTime, entry.endTime) &&
          options.isTimeAllowed(
            entry,
            entry.day,
            entry.startTime,
            entry.endTime,
          );
        if (
          originalIsAllowed &&
          !placed.some((other) => {
            const otherStart = parseTime(other.startTime);
            const otherEnd = parseTime(other.endTime);
            return (
              otherStart !== null &&
              otherEnd !== null &&
              entriesConflict(
                { entry, start, end },
                { entry: other, start: otherStart, end: otherEnd },
                options.hasAdditionalConflict,
              )
            );
          })
        ) {
          placed.push({ ...entry });
          continue;
        }
      }

      const placement = placeEntry(entry, placed);
      if (!placement) return null;
      placed.push(placement);
    }

    return placed;
  }

  const stableEntries = entries.filter((_, index) => !targets.has(index));
  const movedEntries = entries.filter((_, index) => targets.has(index));
  const targetedAttempt = runAttempt(
    [...stableEntries, ...movedEntries, ...missingEntries],
    true,
  );

  if (
    targetedAttempt &&
    requiredEntries.every((required) =>
      targetedAttempt.some(
        (entry) => componentKey(entry) === componentKey(required),
      ),
    ) &&
    !hasScheduleConflicts(targetedAttempt, options.hasAdditionalConflict)
  ) {
    return {
      entries: targetedAttempt,
      complete: true,
      movedEntries: countMovedEntries(entries, targetedAttempt),
    };
  }

  const fallbackEntries = [...entries, ...missingEntries];
  const orderings = [
    fallbackEntries,
    [...fallbackEntries].sort(
      (first, second) => durationFor(second) - durationFor(first),
    ),
    [...fallbackEntries].reverse(),
  ];
  let bestAttempt: T[] | null = null;
  let bestCompleteAttempt: T[] | null = null;

  for (const ordering of orderings) {
    const attempt = runAttempt(ordering, false);
    if (!attempt) continue;
    if (!bestAttempt || isBetterRepair(entries, attempt, bestAttempt)) {
      bestAttempt = attempt;
    }
    if (
      requiredEntries.every((required) =>
        attempt.some((entry) => componentKey(entry) === componentKey(required)),
      ) &&
      !hasScheduleConflicts(attempt, options.hasAdditionalConflict)
    ) {
      if (
        !bestCompleteAttempt ||
        isBetterRepair(entries, attempt, bestCompleteAttempt)
      ) {
        bestCompleteAttempt = attempt;
      }
    }
  }

  if (bestCompleteAttempt) {
    return {
      entries: bestCompleteAttempt,
      complete: true,
      movedEntries: countMovedEntries(entries, bestCompleteAttempt),
    };
  }

  return {
    entries: bestAttempt || entries.map((entry) => ({ ...entry })),
    complete: false,
    movedEntries: countMovedEntries(entries, bestAttempt || entries),
  };
}

function countMovedEntries<T extends GeneratedScheduleEntry>(
  original: T[],
  repaired: T[],
): number {
  const originalByKey = new Map(
    original.map((entry) => [componentKey(entry), entry]),
  );
  return repaired.filter((entry) => {
    const originalEntry = originalByKey.get(componentKey(entry));
    return (
      !originalEntry ||
      originalEntry.day !== entry.day ||
      originalEntry.startTime !== entry.startTime ||
      originalEntry.endTime !== entry.endTime ||
      originalEntry.roomId !== entry.roomId
    );
  }).length;
}

function isBetterRepair<T extends GeneratedScheduleEntry>(
  original: T[],
  candidate: T[],
  currentBest: T[],
): boolean {
  const candidateMoves = countMovedEntries(original, candidate);
  const bestMoves = countMovedEntries(original, currentBest);
  if (candidateMoves !== bestMoves) return candidateMoves < bestMoves;

  const candidateDistance = getTotalMovementDistance(original, candidate);
  const bestDistance = getTotalMovementDistance(original, currentBest);
  return candidateDistance < bestDistance;
}

function getTotalMovementDistance<T extends GeneratedScheduleEntry>(
  original: T[],
  repaired: T[],
): number {
  const originalByKey = new Map(
    original.map((entry) => [componentKey(entry), entry]),
  );
  return repaired.reduce((total, entry) => {
    const originalEntry = originalByKey.get(componentKey(entry));
    if (!originalEntry) return total;

    const originalDay = WEEK_DAYS.indexOf(originalEntry.day);
    const repairedDay = WEEK_DAYS.indexOf(entry.day);
    const originalStart = parseTime(originalEntry.startTime);
    const repairedStart = parseTime(entry.startTime);
    const dayDistance =
      originalDay >= 0 && repairedDay >= 0
        ? Math.abs(originalDay - repairedDay) * 24 * 60
        : 0;
    const timeDistance =
      originalStart !== null && repairedStart !== null
        ? Math.abs(originalStart - repairedStart)
        : 0;
    const roomDistance = originalEntry.roomId === entry.roomId ? 0 : 60;
    return total + dayDistance + timeDistance + roomDistance;
  }, 0);
}

const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
