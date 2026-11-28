import type { GeneratedScheduleEntry } from "./autoScheduleValidation";

export interface RepairRoom {
  roomId: string | null;
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
  hasAdditionalEntryConflict?: (candidate: T, occupied: T[]) => boolean;
  getAdditionalConflictEntries?: (entries: T[]) => T[];
  forceMoveSubjectIds?: Set<string>;
  getPreferencePenalty?: (entry: T) => number;
  localSearchIterations?: number;
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

export function getFatigueRiskEntries<T extends GeneratedScheduleEntry>(
  entries: T[],
): T[] {
  const entriesByTeacherAndDay = new Map<string, T[]>();
  for (const entry of entries) {
    if (!entry.teacherId) continue;
    const key = `${entry.teacherId}|${entry.day.trim().toLowerCase()}`;
    const teacherDayEntries = entriesByTeacherAndDay.get(key) || [];
    teacherDayEntries.push(entry);
    entriesByTeacherAndDay.set(key, teacherDayEntries);
  }

  const fatigueRiskEntries = new Set<T>();
  for (const teacherDayEntries of entriesByTeacherAndDay.values()) {
    const orderedEntries = teacherDayEntries
      .map((entry) => ({
        entry,
        start: parseTime(entry.startTime),
        end: parseTime(entry.endTime),
      }))
      .filter(
        (timedEntry) =>
          timedEntry.start !== null &&
          timedEntry.end !== null &&
          timedEntry.end > timedEntry.start,
      )
      .sort((first, second) => first.start! - second.start!);

    let consecutiveEntries: T[] = [];
    let consecutiveMinutes = 0;
    let previousEnd: number | null = null;
    for (const timedEntry of orderedEntries) {
      const start = timedEntry.start!;
      const end = timedEntry.end!;
      if (previousEnd === null || start - previousEnd >= 30) {
        consecutiveEntries = [];
        consecutiveMinutes = 0;
      }

      consecutiveEntries.push(timedEntry.entry);
      consecutiveMinutes += end - start;
      if (consecutiveMinutes > 240) {
        consecutiveEntries.forEach((entry) => fatigueRiskEntries.add(entry));
      }
      previousEnd = end;
    }
  }

  return [...fatigueRiskEntries];
}

export function hasFatigueRiskForEntry<T extends GeneratedScheduleEntry>(
  entry: T,
  otherEntries: T[],
): boolean {
  if (!entry.teacherId) return false;
  const day = entry.day.trim().toLowerCase();
  const sameTeacherAndDay = otherEntries.filter(
    (otherEntry) =>
      otherEntry !== entry &&
      otherEntry.teacherId === entry.teacherId &&
      otherEntry.day.trim().toLowerCase() === day,
  );
  return getFatigueRiskEntries([...sameTeacherAndDay, entry]).includes(entry);
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
  getAdditionalConflictEntries?: (entries: T[]) => T[],
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

  return (getAdditionalConflictEntries?.(entries).length ?? 0) > 0;
}

export function trySwapSectionScheduleDays<T extends GeneratedScheduleEntry>(
  entries: T[],
  days: string[],
  isTimeAllowed: (
    entry: T,
    day: string,
    startTime: string,
    endTime: string,
  ) => boolean,
  isValidSchedule: (entries: T[]) => boolean,
  hasAdditionalConflict?: (first: T, second: T) => boolean,
): T[] | null {
  const daysToSwapBySection = new Map<string, Set<string>>();
  const markDayForSwap = (sectionCode: string, day: string) => {
    const sectionDays =
      daysToSwapBySection.get(sectionCode) || new Set<string>();
    sectionDays.add(day);
    daysToSwapBySection.set(sectionCode, sectionDays);
  };

  const timedEntries = entries.flatMap((entry) => {
    const start = parseTime(entry.startTime);
    const end = parseTime(entry.endTime);
    return start === null || end === null || end <= start
      ? []
      : [{ entry, start, end }];
  });
  for (let firstIndex = 0; firstIndex < timedEntries.length; firstIndex++) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < timedEntries.length;
      secondIndex++
    ) {
      const first = timedEntries[firstIndex];
      const second = timedEntries[secondIndex];
      if (entriesConflict(first, second, hasAdditionalConflict)) {
        markDayForSwap(first.entry.sectionCode, first.entry.day);
        markDayForSwap(second.entry.sectionCode, second.entry.day);
      }
    }
  }

  entries.forEach((entry) => {
    if (!isTimeAllowed(entry, entry.day, entry.startTime, entry.endTime)) {
      markDayForSwap(entry.sectionCode, entry.day);
    }
  });

  for (const [sectionCode, daysToSwap] of daysToSwapBySection) {
    const sectionDays = days.filter((day) =>
      entries.some(
        (entry) => entry.sectionCode === sectionCode && entry.day === day,
      ),
    );

    for (
      let firstDayIndex = 0;
      firstDayIndex < sectionDays.length;
      firstDayIndex++
    ) {
      for (
        let secondDayIndex = firstDayIndex + 1;
        secondDayIndex < sectionDays.length;
        secondDayIndex++
      ) {
        const firstDay = sectionDays[firstDayIndex];
        const secondDay = sectionDays[secondDayIndex];
        if (!daysToSwap.has(firstDay) && !daysToSwap.has(secondDay)) continue;
        const sectionEntries = entries.filter(
          (entry) =>
            entry.sectionCode === sectionCode &&
            (entry.day === firstDay || entry.day === secondDay),
        );
        const candidate = entries.map((entry) => {
          if (
            entry.sectionCode !== sectionCode ||
            (entry.day !== firstDay && entry.day !== secondDay)
          ) {
            return entry;
          }

          return {
            ...entry,
            day: entry.day === firstDay ? secondDay : firstDay,
          } as T;
        });
        const timeRulesSatisfied = sectionEntries.every((entry) => {
          const swappedDay = entry.day === firstDay ? secondDay : firstDay;
          return isTimeAllowed(
            entry,
            swappedDay,
            entry.startTime,
            entry.endTime,
          );
        });

        if (
          !timeRulesSatisfied ||
          hasScheduleConflicts(candidate, hasAdditionalConflict) ||
          !isValidSchedule(candidate)
        ) {
          continue;
        }

        return candidate;
      }
    }
  }

  return null;
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
  options.getAdditionalConflictEntries?.(entries).forEach((entry) => {
    const index = entries.indexOf(entry);
    if (index >= 0) targets.add(index);
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

  function getPlacements(entry: T, occupied: T[]): T[] {
    const duration = durationFor(entry);
    const originalStart = parseTime(entry.startTime) ?? options.dayStartMinutes;
    const originalDay = options.days.includes(entry.day)
      ? entry.day
      : options.days[0];
    const roomOptions = options.getRooms(entry);
    if (roomOptions.length === 0) return [];

    const candidates: Array<{ entry: T; score: number }> = [];

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
          if (
            conflicts ||
            options.hasAdditionalEntryConflict?.(candidate, occupied)
          ) {
            continue;
          }

          const sameDayPenalty = day === originalDay ? 0 : 1440 + dayIndex * 5;
          const roomPenalty = room.roomId === entry.roomId ? 0 : 5;
          const preferencePenalty = options.getPreferencePenalty?.(candidate);
          candidates.push({
            entry: candidate,
            score:
              (Number.isFinite(preferencePenalty)
                ? Math.max(0, preferencePenalty || 0) * 2000
                : 0) +
              sameDayPenalty +
              Math.abs(start - originalStart) +
              roomPenalty,
          });
        }
      }
    });

    candidates.sort((first, second) => first.score - second.score);
    return candidates.map(({ entry: candidate }) => candidate);
  }

  function placeEntry(entry: T, occupied: T[]): T | null {
    return getPlacements(entry, occupied)[0] || null;
  }

  function isPlacementAllowed(entry: T, occupied: T[]): boolean {
    const start = parseTime(entry.startTime);
    const end = parseTime(entry.endTime);
    const roomStillExists = options
      .getRooms(entry)
      .some((room) => room.roomId === entry.roomId);
    if (
      start === null ||
      end === null ||
      !options.days.includes(entry.day) ||
      start < options.dayStartMinutes ||
      end <= start ||
      end > options.dayEndMinutes ||
      !roomStillExists ||
      options.isBreakTime(entry.day, entry.startTime, entry.endTime) ||
      !options.isTimeAllowed(entry, entry.day, entry.startTime, entry.endTime) ||
      options.hasAdditionalEntryConflict?.(entry, occupied)
    ) {
      return false;
    }

    return !occupied.some((other) => {
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
    });
  }

  function isValidState(candidate: T[]): boolean {
    const placed: T[] = [];
    for (const entry of candidate) {
      if (!isPlacementAllowed(entry, placed)) return false;
      placed.push(entry);
    }
    return !hasScheduleConflicts(
      candidate,
      options.hasAdditionalConflict,
      options.getAdditionalConflictEntries,
    );
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
          !options.hasAdditionalEntryConflict?.(entry, placed) &&
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

  function runPartialAttempt(
    orderedEntries: T[],
    preserveOriginals: boolean,
  ): T[] {
    const placed: T[] = [];
    const placedKeys = new Set<string>();
    for (const entry of orderedEntries) {
      const key = componentKey(entry);
      if (placedKeys.has(key)) continue;

      const originalIndex = entries.indexOf(entry);
      if (
        preserveOriginals &&
        originalIndex >= 0 &&
        !targets.has(originalIndex) &&
        isPlacementAllowed(entry, placed)
      ) {
        placed.push({ ...entry });
        placedKeys.add(key);
        continue;
      }

      const placement = placeEntry(entry, placed);
      if (!placement) continue;
      placed.push(placement);
      placedKeys.add(key);
    }
    return placed;
  }

  const getMissingEntries = (candidate: T[]) => {
    const scheduledKeys = new Set(candidate.map(componentKey));
    return requiredEntries.filter(
      (entry) => !scheduledKeys.has(componentKey(entry)),
    );
  };
  const getStateScore = (candidate: T[]) => {
    const preferencePenalty = candidate.reduce((total, entry) => {
      const penalty = options.getPreferencePenalty?.(entry) ?? 0;
      return total + (Number.isFinite(penalty) ? Math.max(0, penalty) : 0);
    }, 0);
    return (
      getMissingEntries(candidate).length * 100_000 +
      preferencePenalty * 100 +
      countMovedEntries(entries, candidate) * 0.1
    );
  };

  const stableEntries = entries.filter((_, index) => !targets.has(index));
  const movedEntries = entries.filter((_, index) => targets.has(index));
  const fallbackEntries = [...entries, ...missingEntries];
  const orderings = [
    fallbackEntries,
    [...fallbackEntries].sort(
      (first, second) => durationFor(second) - durationFor(first),
    ),
    [...fallbackEntries].reverse(),
  ];
  let bestState: T[] = [];
  let bestScore = Number.POSITIVE_INFINITY;
  const considerState = (candidate: T[]) => {
    if (!isValidState(candidate)) return;
    const score = getStateScore(candidate);
    if (score < bestScore) {
      bestState = candidate.map((entry) => ({ ...entry }));
      bestScore = score;
    }
  };

  const targetedOrdering = [...stableEntries, ...movedEntries, ...missingEntries];
  const targetedAttempt = runAttempt(targetedOrdering, true);
  if (targetedAttempt) considerState(targetedAttempt);
  considerState(runPartialAttempt(targetedOrdering, true));

  for (const ordering of orderings) {
    const attempt = runAttempt(ordering, false);
    if (attempt) considerState(attempt);
    considerState(runPartialAttempt(ordering, false));
  }

  let randomSeed = [...entries, ...requiredEntries].reduce(
    (seed, entry) => seed ^ entry.subjectId.split("").reduce(
      (value, character) => Math.imul(value ^ character.charCodeAt(0), 16777619),
      2166136261,
    ),
    2166136261,
  );
  const random = () => {
    randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0;
    return randomSeed / 0x1_0000_0000;
  };
  const shuffle = <V>(values: V[]): V[] => {
    const shuffled = [...values];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [
        shuffled[swapIndex],
        shuffled[index],
      ];
    }
    return shuffled;
  };
  const samePlacement = (first: T, second: T) =>
    first.day === second.day &&
    first.startTime === second.startTime &&
    first.roomId === second.roomId;
  const getDifferentPlacement = (entry: T, occupied: T[]): T | null => {
    const candidates = getPlacements(entry, occupied).filter(
      (candidate) => !samePlacement(candidate, entry),
    );
    if (candidates.length === 0) return null;
    return candidates[Math.floor(random() * candidates.length)];
  };

  function proposeRelocation(candidate: T[]): T[] | null {
    const missing = getMissingEntries(candidate);
    const shouldInsert = missing.length > 0 && random() < 0.65;
    const selected = shouldInsert
      ? missing[Math.floor(random() * missing.length)]
      : candidate[Math.floor(random() * candidate.length)];
    if (!selected) return null;

    const occupied = candidate.filter(
      (entry) => componentKey(entry) !== componentKey(selected),
    );
    const placement = getDifferentPlacement(selected, occupied);
    return placement ? [...occupied, placement] : null;
  }

  function proposeSwap(candidate: T[]): T[] | null {
    if (candidate.length < 2) return null;
    const firstIndex = Math.floor(random() * candidate.length);
    let secondIndex = Math.floor(random() * (candidate.length - 1));
    if (secondIndex >= firstIndex) secondIndex++;
    const first = candidate[firstIndex];
    const second = candidate[secondIndex];
    const firstStart = parseTime(first.startTime);
    const secondStart = parseTime(second.startTime);
    if (firstStart === null || secondStart === null) return null;

    const rest = candidate.filter(
      (_, index) => index !== firstIndex && index !== secondIndex,
    );
    const firstDuration = durationFor(first);
    const secondDuration = durationFor(second);
    const firstRooms = options.getRooms(first);
    const secondRooms = options.getRooms(second);
    const firstRoomOptions = shuffle(firstRooms);
    const secondRoomOptions = shuffle(secondRooms);

    for (const firstRoom of firstRoomOptions) {
      const movedFirst = {
        ...first,
        day: second.day,
        startTime: formatTime(secondStart),
        endTime: formatTime(secondStart + firstDuration),
        roomId: firstRoom.roomId,
        roomName: firstRoom.roomName,
      } as T;
      if (!isPlacementAllowed(movedFirst, rest)) continue;

      for (const secondRoom of secondRoomOptions) {
        const movedSecond = {
          ...second,
          day: first.day,
          startTime: formatTime(firstStart),
          endTime: formatTime(firstStart + secondDuration),
          roomId: secondRoom.roomId,
          roomName: secondRoom.roomName,
        } as T;
        if (
          isPlacementAllowed(movedSecond, [...rest, movedFirst]) &&
          !samePlacement(movedFirst, first) &&
          !samePlacement(movedSecond, second)
        ) {
          return [...rest, movedFirst, movedSecond];
        }
      }
    }
    return null;
  }

  function proposeEjection(candidate: T[]): T[] | null {
    const missing = getMissingEntries(candidate);
    if (missing.length === 0) return null;

    for (const unplaced of shuffle(missing)) {
      for (const blocker of shuffle(candidate)) {
        const rest = candidate.filter(
          (entry) => componentKey(entry) !== componentKey(blocker),
        );
        const placements = getPlacements(unplaced, rest);
        for (const placement of placements.slice(0, 20)) {
          const blockerPlacement = placeEntry(blocker, [...rest, placement]);
          if (blockerPlacement) {
            return [...rest, placement, blockerPlacement];
          }
        }
      }
    }
    return null;
  }

  let current = bestState;
  let currentScore = bestScore;
  const iterations =
    options.localSearchIterations ??
    Math.min(1000, Math.max(100, requiredEntries.length * 3));
  for (let iteration = 0; iteration < iterations; iteration++) {
    const moveType = random();
    const proposal =
      moveType < 0.65
        ? proposeRelocation(current)
        : moveType < 0.9
          ? proposeSwap(current)
          : proposeEjection(current);
    if (!proposal) continue;
    if (!isValidState(proposal)) continue;

    const proposalMissing = getMissingEntries(proposal).length;
    const currentMissing = getMissingEntries(current).length;
    const proposalScore = getStateScore(proposal);
    const temperature = 40 * Math.pow(0.01, iteration / iterations);
    if (
      proposalMissing < currentMissing ||
      proposalScore < currentScore ||
      random() < Math.exp(-(proposalScore - currentScore) / temperature)
    ) {
      current = proposal;
      currentScore = proposalScore;
      considerState(current);
    }
  }

  const completed = getMissingEntries(bestState).length === 0;
  return {
    entries: bestState,
    complete: completed && isValidState(bestState),
    movedEntries: countMovedEntries(entries, bestState),
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
