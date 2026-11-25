export const RESERVATION_START_MINUTES = 7 * 60;
export const RESERVATION_END_MINUTES = 22 * 60;
export const RESERVATION_TIME_STEP = 30;

export interface ScheduleEntryForConflict {
  schedule_entry_id: string;
  room_id: string;
  day: string;
  start_time: number;
  end_time: number;
  course_name?: string;
  course_code?: string;
  section?: string;
  teacher_name?: string;
  teacher_code?: string;
  room_name?: string;
  type?: string;
  requiredRoomType?: string | null;
}

interface RoomOption {
  room_id: string;
  room_name: string | null;
  room_type?: string | null;
  room_type_name?: string | null;
}

export type ReservationAlternativeKind = "room" | "time" | "room-and-time";

export interface ReservationAlternative {
  kind: ReservationAlternativeKind;
  roomId: string;
  startTime: number;
  endTime: number;
}

export type ReservationConstraint = "room" | "time" | "both";

export interface RescheduleAssignment {
  entry: ScheduleEntryForConflict;
  alternative: ReservationAlternative;
}

export function getScheduleConflicts(
  entries: ScheduleEntryForConflict[],
  weekday: string,
  roomId: string,
  startTime: number,
  endTime: number,
  excludedScheduleEntryIds: readonly string[] = [],
) {
  return entries.filter(
    (entry) =>
      !excludedScheduleEntryIds.includes(entry.schedule_entry_id) &&
      entry.room_id === roomId &&
      entry.day.trim().toLowerCase() === weekday.toLowerCase() &&
      startTime < entry.end_time &&
      endTime > entry.start_time,
  );
}

export function isRoomCompatible(
  room: RoomOption | undefined,
  scheduleEntry?: Pick<ScheduleEntryForConflict, "type" | "requiredRoomType">,
) {
  const entryType = scheduleEntry?.type?.trim().toLowerCase();
  if (!entryType) return true;

  if (entryType === "laboratory") {
    const requiredRoomType = scheduleEntry?.requiredRoomType
      ?.trim()
      .toLowerCase();
    return Boolean(
      room?.room_type &&
      requiredRoomType &&
      room.room_type.trim().toLowerCase() === requiredRoomType,
    );
  }

  if (entryType === "lecture") {
    return Boolean(room?.room_type_name?.toLowerCase().includes("lecture"));
  }

  return true;
}

function hasScheduleConflict(
  entries: ScheduleEntryForConflict[],
  weekday: string,
  roomId: string,
  startTime: number,
  endTime: number,
) {
  return (
    getScheduleConflicts(entries, weekday, roomId, startTime, endTime).length >
    0
  );
}

export function getReservationAlternatives(
  entries: ScheduleEntryForConflict[],
  rooms: RoomOption[],
  weekday: string,
  roomId: string,
  startTime: number,
  endTime: number,
  scheduleEntry?: Pick<ScheduleEntryForConflict, "type" | "requiredRoomType">,
): ReservationAlternative[] {
  const duration = endTime - startTime;
  if (
    duration <= 0 ||
    duration > RESERVATION_END_MINUTES - RESERVATION_START_MINUTES
  ) {
    return [];
  }

  const currentRoom = rooms.find((room) => room.room_id === roomId);
  const canKeepCurrentRoom = isRoomCompatible(currentRoom, scheduleEntry);
  const otherRooms = rooms.filter((room) => {
    if (!room.room_id || room.room_id === roomId || !room.room_name?.trim()) {
      return false;
    }

    return isRoomCompatible(room, scheduleEntry);
  });
  const alternativeStarts = Array.from(
    {
      length:
        Math.floor(
          (RESERVATION_END_MINUTES - duration - RESERVATION_START_MINUTES) /
            RESERVATION_TIME_STEP,
        ) + 1,
    },
    (_, index) => RESERVATION_START_MINUTES + index * RESERVATION_TIME_STEP,
  ).sort(
    (first, second) =>
      Math.abs(first - startTime) - Math.abs(second - startTime) ||
      first - second,
  );
  const alternatives: ReservationAlternative[] = [];
  let roomOnlyCount = 0;
  let timeOnlyCount = 0;
  let roomAndTimeCount = 0;

  for (const room of otherRooms) {
    if (
      !hasScheduleConflict(entries, weekday, room.room_id, startTime, endTime)
    ) {
      alternatives.push({
        kind: "room",
        roomId: room.room_id,
        startTime,
        endTime,
      });
      roomOnlyCount += 1;
    }
    if (roomOnlyCount >= 3) break;
  }

  for (const candidateStart of alternativeStarts) {
    const candidateEnd = candidateStart + duration;
    if (
      canKeepCurrentRoom &&
      candidateStart !== startTime &&
      !hasScheduleConflict(
        entries,
        weekday,
        roomId,
        candidateStart,
        candidateEnd,
      )
    ) {
      alternatives.push({
        kind: "time",
        roomId,
        startTime: candidateStart,
        endTime: candidateEnd,
      });
      timeOnlyCount += 1;
    }
    if (timeOnlyCount >= 3) break;
  }

  for (const room of otherRooms) {
    for (const candidateStart of alternativeStarts) {
      const candidateEnd = candidateStart + duration;
      if (
        candidateStart !== startTime &&
        !hasScheduleConflict(
          entries,
          weekday,
          room.room_id,
          candidateStart,
          candidateEnd,
        )
      ) {
        alternatives.push({
          kind: "room-and-time",
          roomId: room.room_id,
          startTime: candidateStart,
          endTime: candidateEnd,
        });
        roomAndTimeCount += 1;
      }
      if (roomAndTimeCount >= 3) return alternatives;
    }
  }

  return alternatives;
}

export function getAutomaticReschedulePlan(
  entries: ScheduleEntryForConflict[],
  rooms: RoomOption[],
  weekday: string,
  requestedRoomId: string,
  requestedStartTime: number,
  requestedEndTime: number,
  conflictingEntries: ScheduleEntryForConflict[],
  constraint: ReservationConstraint,
): RescheduleAssignment[] | null {
  const requiredKind: ReservationAlternativeKind =
    constraint === "room"
      ? "room"
      : constraint === "time"
        ? "time"
        : "room-and-time";
  const blockedEntries: ScheduleEntryForConflict[] = [
    ...entries,
    {
      schedule_entry_id: "requested-reservation",
      room_id: requestedRoomId,
      day: weekday,
      start_time: requestedStartTime,
      end_time: requestedEndTime,
    },
  ];
  const assignments: RescheduleAssignment[] = [];

  for (const entry of conflictingEntries) {
    const alternative = getReservationAlternatives(
      blockedEntries,
      rooms,
      weekday,
      entry.room_id,
      entry.start_time,
      entry.end_time,
      entry,
    ).find((candidate) => candidate.kind === requiredKind);

    if (!alternative) return null;

    assignments.push({ entry, alternative });
    blockedEntries.push({
      schedule_entry_id: `rescheduled-${entry.schedule_entry_id}`,
      room_id: alternative.roomId,
      day: weekday,
      start_time: alternative.startTime,
      end_time: alternative.endTime,
    });
  }

  return assignments;
}
