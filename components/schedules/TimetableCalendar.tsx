"use client";

import { Fragment, useMemo, useState } from "react";
import { HiChevronLeft, HiChevronRight, HiChevronUp } from "react-icons/hi2";
import { GiCoffeeCup } from "react-icons/gi";
import type {
  ReservationRecord,
  TimetableEntryRecord,
} from "@/app/actions/system";
import { generateSubjectAbv } from "@/utils/NameAbbreviator";
import {
  getRescheduledScheduleEntry,
  isScheduleEntryRescheduledOnDate,
  reservationDateMatches,
} from "@/utils/reservationDates";

export interface LocalTimetableEntry extends Omit<
  TimetableEntryRecord,
  | "subject_id"
  | "teacher_id"
  | "room_id"
  | "lecture_units"
  | "lab_units"
  | "teacher_code"
  | "type"
> {
  subject_id: string | null;
  teacher_id: string | null;
  room_id: string | null;
  lecture_units: number;
  lab_units: number;
  teacher_code: string;
  type?: string;
  originalDuration?: number;
}

interface TimetableCalendarBreak {
  day: string;
  start_time: number;
  end_time: number;
  break_description: string;
}

interface TimetableCalendarProps {
  entries: LocalTimetableEntry[];
  breaks: TimetableCalendarBreak[];
  reservations: ReservationRecord[];
  rooms: { room_id: string; room_name: string | null }[];
  selectedSection: string;
  selectedRoom: string;
  isLoading: boolean;
  error: string | null;
  reservationError: string | null;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const TIMETABLE_DAYS = WEEKDAY_NAMES.slice(1);
const TIMETABLE_START_MINUTES = 7 * 60;
const TIMETABLE_SLOT_COUNT = 30;
const TIMETABLE_ROW_HEIGHT = 44;
const TIMETABLE_TIME_COLUMN_WIDTH = 96;
const TIMETABLE_TIME_SLOTS = Array.from(
  { length: TIMETABLE_SLOT_COUNT },
  (_, index) => TIMETABLE_START_MINUTES + index * 30,
);

function getCalendarDays(month: Date) {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const firstVisibleDay = new Date(
    firstOfMonth.getFullYear(),
    firstOfMonth.getMonth(),
    firstOfMonth.getDate() - firstOfMonth.getDay(),
  );

  return Array.from(
    { length: 42 },
    (_, index) =>
      new Date(
        firstVisibleDay.getFullYear(),
        firstVisibleDay.getMonth(),
        firstVisibleDay.getDate() + index,
      ),
  );
}

function isSameDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function getSelectableDate(date: Date) {
  if (date.getDay() !== 0) return date;

  const nextDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1,
  );
  return nextDay.getMonth() === date.getMonth()
    ? nextDay
    : new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
}

function getWeekStart(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() - date.getDay(),
  );
}

function formatTime(minutes: number) {
  return new Date(
    2000,
    0,
    1,
    Math.floor(minutes / 60),
    minutes % 60,
  ).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatTimeSlot(minutes: number) {
  return new Date(
    2000,
    0,
    1,
    Math.floor(minutes / 60),
    minutes % 60,
  ).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function getEntriesToRender(
  entries: LocalTimetableEntry[],
  selectedSection: string,
  selectedRoom: string,
) {
  return entries.filter((entry) => {
    if (!entry.day || entry.start_time <= 0) return false;

    const matchesSection =
      selectedSection === "ALL" || entry.section === selectedSection;
    const matchesRoom =
      selectedRoom === "ALL" || entry.room_name === selectedRoom;
    if (matchesSection && matchesRoom) return true;

    const isSameSection =
      selectedSection !== "ALL" &&
      entry.section.toLowerCase() === selectedSection.toLowerCase();
    const matchesActiveRoom =
      selectedRoom !== "ALL" &&
      entry.room_name?.toLowerCase() === selectedRoom.toLowerCase();

    return isSameSection || matchesActiveRoom;
  });
}

export default function TimetableCalendar({
  entries,
  breaks,
  reservations,
  rooms,
  selectedSection,
  selectedRoom,
  isLoading,
  error,
  reservationError,
}: TimetableCalendarProps) {
  const [selectedDate, setSelectedDate] = useState(() =>
    getSelectableDate(new Date()),
  );
  const [expandedWeekStart, setExpandedWeekStart] = useState<Date | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const calendarDays = useMemo(
    () => getCalendarDays(visibleMonth),
    [visibleMonth],
  );
  const monthLabel = visibleMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const selectedDateLabel = selectedDate.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const entriesToRender = useMemo(() => {
    const filteredEntries = getEntriesToRender(
      entries,
      selectedSection,
      selectedRoom,
    );
    if (!expandedWeekStart) return filteredEntries;

    return filteredEntries.filter((entry) => {
      const dayIndex = TIMETABLE_DAYS.findIndex(
        (day) => day.toLowerCase() === entry.day.toLowerCase(),
      );
      if (dayIndex < 0) return true;

      const entryDate = new Date(
        expandedWeekStart.getFullYear(),
        expandedWeekStart.getMonth(),
        expandedWeekStart.getDate() + dayIndex + 1,
      );
      return !isScheduleEntryRescheduledOnDate(
        entry.schedule_entry_id,
        reservations,
        entryDate,
      );
    });
  }, [entries, expandedWeekStart, reservations, selectedRoom, selectedSection]);
  const reservationsToRender = useMemo(() => {
    if (!expandedWeekStart) return [];

    return reservations.flatMap((reservation) => {
      const dayIndex = TIMETABLE_DAYS.findIndex((_, index) =>
        reservationDateMatches(
          reservation.day,
          new Date(
            expandedWeekStart.getFullYear(),
            expandedWeekStart.getMonth(),
            expandedWeekStart.getDate() + index + 1,
          ),
        ),
      );
      if (dayIndex < 0) return [];

      const isReschedule =
        reservation.type.trim().toLowerCase() === "reschedule";
      const scheduleEntry = getRescheduledScheduleEntry(reservation, entries);
      if (
        isReschedule &&
        scheduleEntry &&
        selectedSection !== "ALL" &&
        scheduleEntry.section.toLowerCase() !== selectedSection.toLowerCase()
      ) {
        return [];
      }

      const roomName =
        rooms
          .find((room) => room.room_id === reservation.room_id)
          ?.room_name?.trim() || null;
      const isUnassigned = reservation.room_id === null;
      if (
        !isUnassigned &&
        selectedRoom !== "ALL" &&
        roomName?.toLowerCase() !== selectedRoom.toLowerCase()
      ) {
        return [];
      }

      const startTime =
        reservation.start_time ??
        (isReschedule ? (scheduleEntry?.start_time ?? null) : null);
      const endTime =
        reservation.end_time ??
        (isReschedule ? (scheduleEntry?.end_time ?? null) : null);
      if (startTime === null || endTime === null) return [];

      const visibleStartTime = Math.max(startTime, TIMETABLE_START_MINUTES);
      const visibleEndTime = Math.min(
        endTime,
        TIMETABLE_START_MINUTES + TIMETABLE_SLOT_COUNT * 30,
      );
      if (visibleEndTime <= visibleStartTime) return [];

      return [
        {
          reservation,
          dayIndex,
          startTime: visibleStartTime,
          endTime: visibleEndTime,
          isReschedule,
          isUnassigned,
          roomName,
          scheduleEntry,
        },
      ];
    });
  }, [
    entries,
    expandedWeekStart,
    reservations,
    rooms,
    selectedRoom,
    selectedSection,
  ]);

  function changeMonth(offset: number) {
    const nextMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + offset,
      1,
    );
    const daysInNextMonth = new Date(
      nextMonth.getFullYear(),
      nextMonth.getMonth() + 1,
      0,
    ).getDate();

    setVisibleMonth(nextMonth);
    setExpandedWeekStart(null);
    setSelectedDate((currentDate) =>
      getSelectableDate(
        new Date(
          nextMonth.getFullYear(),
          nextMonth.getMonth(),
          Math.min(currentDate.getDate(), daysInNextMonth),
        ),
      ),
    );
  }

  function goToToday() {
    const today = new Date();
    setSelectedDate(getSelectableDate(today));
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setExpandedWeekStart(null);
  }

  function selectDate(date: Date) {
    if (date.getDay() === 0) {
      setExpandedWeekStart(null);
      return;
    }

    setSelectedDate(date);
    setExpandedWeekStart(getWeekStart(date));
    if (
      date.getMonth() !== visibleMonth.getMonth() ||
      date.getFullYear() !== visibleMonth.getFullYear()
    ) {
      setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  }

  function hasEntryConflict(entryA: LocalTimetableEntry) {
    if (!entryA.day || entryA.start_time <= 0) return false;

    return entries.some((entryB) => {
      if (entryB.schedule_entry_id === entryA.schedule_entry_id) return false;
      if (!entryB.day || entryB.start_time <= 0) return false;
      if (entryB.day.toLowerCase() !== entryA.day.toLowerCase()) return false;
      if (
        entryA.start_time >= entryB.end_time ||
        entryA.end_time <= entryB.start_time
      ) {
        return false;
      }

      return (
        entryA.section.toLowerCase() === entryB.section.toLowerCase() ||
        Boolean(
          entryA.room_name &&
          entryB.room_name &&
          entryA.room_name.toLowerCase() === entryB.room_name.toLowerCase(),
        ) ||
        Boolean(entryA.teacher_id && entryA.teacher_id === entryB.teacher_id)
      );
    });
  }

  function checkFatigueRisk(entry: LocalTimetableEntry) {
    if (!entry.teacher_id || !entry.day || entry.start_time <= 0) return false;

    const dayBlocks = entries
      .filter(
        (candidate) =>
          candidate.teacher_id === entry.teacher_id &&
          candidate.day?.toLowerCase() === entry.day.toLowerCase() &&
          candidate.start_time > 0,
      )
      .sort((first, second) => first.start_time - second.start_time);

    if (dayBlocks.length <= 1) return false;

    let consecutiveMinutes = dayBlocks[0].end_time - dayBlocks[0].start_time;
    for (let index = 1; index < dayBlocks.length; index += 1) {
      const previous = dayBlocks[index - 1];
      const current = dayBlocks[index];
      const gap = current.start_time - previous.end_time;

      if (gap < 30) {
        consecutiveMinutes += current.end_time - current.start_time;
      } else {
        consecutiveMinutes = current.end_time - current.start_time;
      }

      if (consecutiveMinutes > 240) return true;
    }

    return false;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-5 dark:border-gray-700">
        <div>
          <h2
            className="min-w-40 text-lg font-semibold text-gray-900 dark:text-white"
            aria-live="polite"
          >
            {monthLabel}
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Select a date to view its week.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            aria-label="Previous month"
            className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <HiChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={goToToday}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            aria-label="Next month"
            className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <HiChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="max-h-[calc(100vh-12rem)] scrollbar-thumb-gray-400 scrollbar-track-transparent overflow-y-auto border-l border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-7">
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday}
              className="border-r border-b border-gray-200 bg-gray-50 py-3 text-center text-xs font-semibold tracking-wide text-gray-500 uppercase dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400"
            >
              {weekday}
            </div>
          ))}
          {calendarDays.map((date, index) => {
            const isSunday = date.getDay() === 0;
            const isSelected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, new Date());
            const isCurrentMonth =
              date.getMonth() === visibleMonth.getMonth() &&
              date.getFullYear() === visibleMonth.getFullYear();
            const hasReservation = reservations.some((reservation) =>
              reservationDateMatches(reservation.day, date),
            );
            const weekStart = calendarDays[Math.floor(index / 7) * 7];
            const isExpanded =
              expandedWeekStart !== null &&
              isSameDay(weekStart, expandedWeekStart);

            return (
              <Fragment key={date.toISOString()}>
                <button
                  type="button"
                  onClick={() => selectDate(date)}
                  disabled={isSunday}
                  aria-label={
                    date.toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    }) +
                    (isSunday ? ", unavailable" : "") +
                    (hasReservation ? ", has reservation" : "")
                  }
                  aria-disabled={isSunday}
                  aria-pressed={isSelected}
                  aria-expanded={isExpanded}
                  aria-controls={
                    isExpanded ? "expanded-week-timetable" : undefined
                  }
                  aria-current={isToday ? "date" : undefined}
                  className={`flex min-h-20 flex-col items-center border-r border-b border-gray-200 p-2 text-sm transition-colors focus:z-10 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:ring-inset sm:min-h-24 dark:border-gray-700 ${
                    isSunday
                      ? "cursor-not-allowed bg-rose-50/70 dark:bg-rose-950/30"
                      : isSelected
                        ? "bg-blue-50 dark:bg-blue-900/30"
                        : hasReservation
                          ? "bg-fuchsia-50 hover:bg-fuchsia-100 dark:bg-fuchsia-950/30 dark:hover:bg-fuchsia-900/40"
                          : "bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700/70"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full font-medium ${
                      isSunday
                        ? "text-rose-400 dark:text-rose-300"
                        : isSelected
                          ? "bg-blue-700 text-white dark:bg-blue-500"
                          : isToday
                            ? "border border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300"
                            : isCurrentMonth
                              ? "text-gray-800 dark:text-gray-200"
                              : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  {hasReservation && !isSunday && (
                    <span
                      aria-hidden="true"
                      className="mt-1 h-1.5 w-1.5 rounded-full bg-fuchsia-600 dark:bg-fuchsia-400"
                    />
                  )}
                </button>
                {index % 7 === 6 && isExpanded && (
                  <section
                    id="expanded-week-timetable"
                    className="col-span-7 border-b border-gray-200 bg-gray-50 p-4 sm:p-5 dark:border-gray-700 dark:bg-gray-900/50"
                    aria-label={`Weekly timetable, ${selectedDateLabel}`}
                  >
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                          Weekly timetable
                        </h3>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          {selectedDateLabel}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedWeekStart(null)}
                        aria-label="Close weekly timetable"
                        className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <HiChevronUp className="h-5 w-5" />
                      </button>
                    </div>

                    <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                      {error ||
                        "Scheduled classes, reservations, and break periods for the selected week."}
                    </p>
                    {reservationError && (
                      <p className="mb-3 text-sm text-red-700 dark:text-red-300">
                        Reservations could not be loaded: {reservationError}
                      </p>
                    )}
                    <div className="relative max-h-150 scrollbar-thumb-gray-400 scrollbar-track-transparent overflow-x-auto overflow-y-auto rounded-xl border border-gray-300 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                      <div className="relative min-w-212.5">
                        <div className="pointer-events-none absolute inset-0">
                          {entriesToRender.map((entry) => {
                            const dayIndex = TIMETABLE_DAYS.findIndex(
                              (day) =>
                                day.toLowerCase() === entry.day.toLowerCase(),
                            );
                            if (dayIndex === -1) return null;

                            const durationMinutes =
                              entry.end_time - entry.start_time ||
                              entry.originalDuration ||
                              60;
                            const topOffsetPixels =
                              ((entry.start_time - TIMETABLE_START_MINUTES) /
                                30) *
                              TIMETABLE_ROW_HEIGHT;
                            const heightPixels = Math.max(
                              TIMETABLE_ROW_HEIGHT,
                              (durationMinutes / 30) * TIMETABLE_ROW_HEIGHT,
                            );
                            const isConflict = hasEntryConflict(entry);
                            const isFatigue = checkFatigueRisk(entry);
                            const isLaboratory =
                              entry.type?.toLowerCase() === "laboratory";
                            const matchesDirectFilter =
                              (selectedSection === "ALL" ||
                                entry.section === selectedSection) &&
                              (selectedRoom === "ALL" ||
                                entry.room_name === selectedRoom);
                            const isGhost = !matchesDirectFilter;

                            let blockStyle =
                              "bg-blue-50/90 text-blue-950 border-blue-300 dark:bg-blue-950/80 dark:text-blue-200 dark:border-blue-700";
                            let zIndexClass = "z-10";

                            if (isConflict) {
                              blockStyle =
                                "bg-red-100 text-red-950 border-red-500 dark:bg-red-950/90 dark:text-red-100 dark:border-red-600 shadow-lg";
                              zIndexClass = "z-20";
                            } else if (isFatigue) {
                              blockStyle =
                                "bg-amber-100 text-amber-950 border-amber-400 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700";
                            } else if (isLaboratory) {
                              blockStyle =
                                "bg-emerald-50/90 text-emerald-950 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700";
                            }

                            if (isGhost) {
                              blockStyle =
                                "bg-gray-100 text-gray-500 border-gray-300 opacity-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700";
                              zIndexClass = "z-5";
                            }

                            return (
                              <div
                                key={entry.schedule_entry_id}
                                className={`absolute flex flex-col overflow-hidden rounded border p-2 backdrop-blur-xs ${zIndexClass} ${blockStyle}`}
                                style={{
                                  top: `${topOffsetPixels + 45}px`,
                                  left: `calc(${TIMETABLE_TIME_COLUMN_WIDTH}px + (${dayIndex} * ((100% - ${TIMETABLE_TIME_COLUMN_WIDTH}px) / 6)))`,
                                  width: `calc((100% - ${TIMETABLE_TIME_COLUMN_WIDTH}px) / 6 - 6px)`,
                                  height: `${heightPixels - 4}px`,
                                }}
                              >
                                <div className="truncate text-xs font-bold">
                                  {generateSubjectAbv(entry.course_name)}
                                </div>
                                <div className="truncate text-[10px] font-medium opacity-90">
                                  {entry.course_name}{" "}
                                  {isGhost ? "(Other Section/Room)" : ""}
                                </div>
                                <div className="mt-auto space-y-0.5 text-[10px] font-semibold opacity-90">
                                  <div className="text-xs">
                                    Teacher:{" "}
                                    {entry.teacher_code || "Unassigned"}
                                  </div>
                                  <div className="text-xs">
                                    Sec: {entry.section}
                                  </div>
                                  <div className="text-xs">
                                    Room: {entry.room_name || "TBA"}
                                  </div>
                                  <div className="font-mono">
                                    {formatTime(entry.start_time)} -{" "}
                                    {formatTime(entry.end_time)}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {reservationsToRender.map(
                          ({
                            reservation,
                            dayIndex,
                            startTime,
                            endTime,
                            isReschedule,
                            isUnassigned,
                            roomName,
                            scheduleEntry,
                          }) => {
                            const topOffsetPixels =
                              ((startTime - TIMETABLE_START_MINUTES) / 30) *
                              TIMETABLE_ROW_HEIGHT;
                            const heightPixels = Math.max(
                              TIMETABLE_ROW_HEIGHT,
                              ((endTime - startTime) / 30) *
                                TIMETABLE_ROW_HEIGHT,
                            );

                            return (
                              <div
                                key={reservation.reservation_id}
                                className={`absolute z-30 flex flex-col overflow-hidden rounded border p-2 shadow-xs ${
                                  isReschedule
                                    ? "border-fuchsia-400 bg-fuchsia-200 text-fuchsia-950 dark:border-fuchsia-600 dark:bg-fuchsia-900 dark:text-fuchsia-100"
                                    : "border-fuchsia-300 bg-fuchsia-50/95 text-fuchsia-950 dark:border-fuchsia-700 dark:bg-fuchsia-950/90 dark:text-fuchsia-200"
                                }`}
                                style={{
                                  top: `${topOffsetPixels + 45}px`,
                                  left: `calc(${TIMETABLE_TIME_COLUMN_WIDTH}px + (${dayIndex} * ((100% - ${TIMETABLE_TIME_COLUMN_WIDTH}px) / 6)))`,
                                  width: `calc((100% - ${TIMETABLE_TIME_COLUMN_WIDTH}px) / 6 - 6px)`,
                                  height: `${heightPixels - 4}px`,
                                }}
                              >
                                <div className="truncate text-xs font-bold">
                                  {scheduleEntry
                                    ? generateSubjectAbv(
                                        scheduleEntry.course_name,
                                      )
                                    : isReschedule
                                      ? "Rescheduled class"
                                      : reservation.description}
                                </div>
                                {scheduleEntry && (
                                  <div className="truncate text-[10px] font-medium">
                                    {scheduleEntry.course_name}
                                  </div>
                                )}
                                <div className="truncate text-[10px] font-medium">
                                  {isUnassigned
                                    ? "Reschedule · Unassigned"
                                    : isReschedule
                                      ? "Reschedule"
                                      : reservation.type}
                                </div>
                                <div className="mt-auto space-y-0.5 truncate text-[10px] font-semibold">
                                  {scheduleEntry && (
                                    <>
                                      <div>
                                        Teacher:{" "}
                                        {scheduleEntry.teacher_code ||
                                          "Unassigned"}
                                      </div>
                                      <div>
                                        Section: {scheduleEntry.section}
                                      </div>
                                    </>
                                  )}
                                  <div>Room: {roomName || "Unassigned"}</div>
                                  <div className="font-mono">
                                    {formatTime(startTime)} –{" "}
                                    {formatTime(endTime)}
                                  </div>
                                </div>
                              </div>
                            );
                          },
                        )}

                        <table
                          className="pointer-events-auto w-full border-collapse text-left text-xs"
                          style={{ tableLayout: "fixed" }}
                        >
                          <thead>
                            <tr className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                              <th className="sticky left-0 z-5 w-24 border-r border-b bg-gray-100 p-3 text-center font-bold dark:bg-gray-800">
                                Time
                              </th>
                              {calendarDays
                                .slice(index - 5, index + 1)
                                .map((day) => (
                                  <th
                                    key={day.toISOString()}
                                    className="min-w-30 border-r border-b p-2 text-center font-bold"
                                  >
                                    <span className="block text-[10px] font-medium text-gray-500 dark:text-gray-400">
                                      {WEEKDAY_NAMES[day.getDay()].slice(0, 3)}
                                    </span>
                                    <span>{day.getDate()}</span>
                                  </th>
                                ))}
                            </tr>
                          </thead>
                          <tbody>
                            {TIMETABLE_TIME_SLOTS.map((slotMinutes) => (
                              <tr
                                key={slotMinutes}
                                className="h-11 border-b dark:border-gray-800"
                              >
                                <td className="sticky left-0 z-5 w-24 border-r bg-gray-50 p-2 text-center font-mono text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                  {formatTimeSlot(slotMinutes)}
                                </td>
                                {TIMETABLE_DAYS.map((day) => {
                                  const matchedBreak = breaks.find(
                                    (breakPeriod) =>
                                      breakPeriod.day.toLowerCase() ===
                                        day.toLowerCase() &&
                                      slotMinutes >= breakPeriod.start_time &&
                                      slotMinutes < breakPeriod.end_time,
                                  );

                                  return (
                                    <td
                                      key={day}
                                      className={`relative border-r p-1 text-center transition-colors ${
                                        matchedBreak
                                          ? "border-violet-200 bg-violet-50/80 text-violet-950 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
                                          : "text-gray-300 dark:border-gray-800"
                                      }`}
                                    >
                                      {matchedBreak &&
                                        slotMinutes ===
                                          matchedBreak.start_time && (
                                          <div
                                            className="absolute inset-1.5 z-5 flex flex-col items-center justify-center overflow-hidden rounded bg-violet-100/90 p-1 text-center shadow-xs dark:bg-violet-900/80"
                                            style={{
                                              height: `${((matchedBreak.end_time - matchedBreak.start_time) / 30) * TIMETABLE_ROW_HEIGHT - 12}px`,
                                            }}
                                          >
                                            <div className="flex w-full justify-center space-x-2 truncate text-[10px] font-bold text-violet-900 dark:text-violet-100">
                                              <GiCoffeeCup />
                                              <div>
                                                {matchedBreak.break_description}
                                              </div>
                                            </div>
                                            <div className="font-mono text-[9px] text-violet-700 dark:text-violet-300">
                                              {formatTime(
                                                matchedBreak.start_time,
                                              )}{" "}
                                              -{" "}
                                              {formatTime(
                                                matchedBreak.end_time,
                                              )}
                                            </div>
                                          </div>
                                        )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    {isLoading && (
                      <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                        Loading timetable blocks…
                      </p>
                    )}
                  </section>
                )}
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
