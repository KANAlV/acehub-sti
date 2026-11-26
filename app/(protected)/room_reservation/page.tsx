"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import {
  HiCalendarDays,
  HiChevronLeft,
  HiChevronRight,
  HiChevronUp,
  HiCheck,
  HiTrash,
  HiXMark,
} from "react-icons/hi2";
import {
  createReservations,
  deleteReservation,
  fetchActiveScheduleName,
  fetchBreakPeriods,
  fetchReservations,
  fetchRoomTypeList,
  fetchScheduleByName,
  fetchSubjectsUnitsByIds,
  fetchTimetableEntriesByScheduleId,
  getRoomsForGeneration,
  returnRescheduleToSidebar,
  updateReservation,
  ReservationRecord,
  RoomForGeneration,
  TimetableEntryRecord,
} from "@/app/actions/system";
import { GiCoffeeCup } from "react-icons/gi";
import {
  getAutomaticReschedulePlan,
  getScheduleConflicts,
  isRoomCompatible,
  RESERVATION_END_MINUTES,
  RESERVATION_START_MINUTES,
  RESERVATION_TIME_STEP,
  type ReservationConstraint,
} from "@/utils/reservationConflicts";
import {
  formatReservationDate,
  getRescheduledScheduleEntry,
  isScheduleEntryRescheduledOnDate,
  reservationDateMatches,
} from "@/utils/reservationDates";
import { filterCourseNameWithoutTrim } from "@/utils/validation";

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
const TIMETABLE_WEEKDAY_NAMES = WEEKDAY_NAMES.slice(1);
const TIMETABLE_START_MINUTES = 7 * 60;
const TIMETABLE_SLOT_COUNT = 30;
const TIMETABLE_ROW_HEIGHT = 44;
const TIMETABLE_TIME_COLUMN_WIDTH = 96;
const TIMETABLE_DAY_COUNT = 6;
const RESERVATION_PAGE_SIZE = 5;
const BREAK_WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const BREAK_WHOLE_WEEK = [...BREAK_WEEKDAYS, "Saturday"];
const BREAK_DAY_OPTIONS = [
  { id: 1, name: "Monday" },
  { id: 2, name: "Tuesday" },
  { id: 3, name: "Wednesday" },
  { id: 4, name: "Thursday" },
  { id: 5, name: "Friday" },
  { id: 6, name: "Saturday" },
];

interface BreakPeriodRecord {
  break_id: string;
  break_description: string;
  day_of_week: string | number;
  start_time: string;
  end_time: string;
}

interface ReservationRoom extends RoomForGeneration {
  room_type_name: string | null;
}

interface ExpandedBreakPeriod {
  break_id: string;
  day: string;
  start_time: number;
  end_time: number;
  break_description: string;
}

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

function getReservationDisplayName(
  reservation: ReservationRecord,
  entries: TimetableEntryRecord[],
) {
  const scheduleEntry = getRescheduledScheduleEntry(reservation, entries);
  if (scheduleEntry) {
    const courseName = scheduleEntry.course_code || scheduleEntry.course_name;
    return [courseName || "Scheduled class", scheduleEntry.section]
      .filter(Boolean)
      .join(" · ");
  }

  if (
    reservation.type.trim().toLowerCase() === "reschedule" &&
    /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(
      reservation.description.trim(),
    )
  ) {
    return "Scheduled class (details unavailable)";
  }

  return reservation.description;
}

function isSameDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function reservationMatchesDate(reservation: ReservationRecord, date: Date) {
  return reservationDateMatches(reservation.day, date);
}

function getWeekStart(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() - date.getDay(),
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

function formatTime(minutes: number) {
  return new Date(
    2000,
    0,
    1,
    Math.floor(minutes / 60),
    minutes % 60,
  ).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function timeStringToMinutes(time: string) {
  const [hoursPart, minutesPart = "0"] = time.trim().split(":");
  let hours = Number.parseInt(hoursPart, 10);
  const minutes = Number.parseInt(minutesPart, 10);
  const upperTime = time.toUpperCase();

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  if (upperTime.includes("PM") && hours < 12) hours += 12;
  if (upperTime.includes("AM") && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

function expandBreakPeriods(breakPeriods: BreakPeriodRecord[]) {
  return breakPeriods.flatMap((breakPeriod): ExpandedBreakPeriod[] => {
    const dayValue = String(breakPeriod.day_of_week);
    const normalizedDay = dayValue.toLowerCase();
    let days: string[];

    if (dayValue === "0" || normalizedDay === "whole week") {
      days = BREAK_WHOLE_WEEK;
    } else if (dayValue === "7" || normalizedDay === "weekdays") {
      days = BREAK_WEEKDAYS;
    } else {
      const configuredDay = BREAK_DAY_OPTIONS.find(
        ({ id, name }) =>
          String(id) === dayValue || name.toLowerCase() === normalizedDay,
      );
      days = configuredDay ? [configuredDay.name] : [dayValue];
    }

    const start_time = timeStringToMinutes(breakPeriod.start_time);
    const end_time = timeStringToMinutes(breakPeriod.end_time);
    if (end_time <= start_time) return [];

    return days.map((day) => ({
      break_id: breakPeriod.break_id,
      day,
      start_time,
      end_time,
      break_description: breakPeriod.break_description || "Break Period",
    }));
  });
}

function RoomFilterDropdown({
  rooms,
  selectedRoom,
  onRoomChange,
  isLoading,
  ariaLabel = "Filter timetable by room",
  placeholder = "No rooms available",
}: {
  rooms: RoomForGeneration[];
  selectedRoom: string | null;
  onRoomChange: (room: string) => void;
  isLoading: boolean;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const sortAlphanumeric = (first: string, second: string) => {
    const firstNumber = Number.parseInt(first, 10);
    const secondNumber = Number.parseInt(second, 10);
    if (!Number.isNaN(firstNumber) && !Number.isNaN(secondNumber)) {
      return firstNumber - secondNumber;
    }
    if (!Number.isNaN(firstNumber)) return -1;
    if (!Number.isNaN(secondNumber)) return 1;
    return first.localeCompare(second);
  };

  const floorRooms = rooms
    .filter(
      (room) =>
        room.room_name?.trim() &&
        room.floor_level !== null &&
        room.floor_level > 0,
    )
    .sort((first, second) => {
      const floorDifference =
        (first.floor_level || 0) - (second.floor_level || 0);
      if (floorDifference !== 0) return floorDifference;
      return sortAlphanumeric(first.room_name ?? "", second.room_name ?? "");
    })
    .reduce<Record<number, RoomForGeneration[]>>((groupedRooms, room) => {
      const floor = room.floor_level!;
      if (!groupedRooms[floor]) groupedRooms[floor] = [];
      groupedRooms[floor].push(room);
      return groupedRooms;
    }, {});

  const unassignedRooms = rooms
    .filter(
      (room) =>
        room.room_name?.trim() &&
        (room.floor_level === null || room.floor_level <= 0),
    )
    .sort((first, second) =>
      sortAlphanumeric(first.room_name ?? "", second.room_name ?? ""),
    );

  function toggleFloor(floor: string) {
    setExpandedFloors((currentFloors) =>
      currentFloors.has(floor) ? new Set() : new Set([floor]),
    );
  }

  function selectRoom(room: string) {
    onRoomChange(room);
    setIsOpen(false);
  }

  function renderRoomOption(room: RoomForGeneration) {
    const roomName = room.room_name ?? "";
    const isSelected = selectedRoom === roomName;

    return (
      <button
        key={room.room_id}
        type="button"
        onClick={() => selectRoom(roomName)}
        className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors ${
          isSelected
            ? "bg-blue-100 font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300"
            : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        }`}
      >
        {roomName}
        {isSelected && (
          <HiCheck className="ml-auto h-4 w-4 text-blue-600 dark:text-blue-400" />
        )}
      </button>
    );
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        disabled={isLoading || rooms.length === 0}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-xs text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        <span className="truncate">
          {isLoading ? "Loading rooms…" : (selectedRoom ?? placeholder)}
        </span>
        <svg
          className={`ml-2 h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-300 bg-white p-2 shadow-lg dark:border-gray-600 dark:bg-gray-800">
          {Object.entries(floorRooms)
            .sort(([first], [second]) => Number(first) - Number(second))
            .map(([floor, floorRoomList]) => (
              <div key={floor} className="mt-1">
                <button
                  type="button"
                  onClick={() => toggleFloor(floor)}
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                  <span>Floor {floor}</span>
                  <span className="flex items-center gap-1">
                    <span className="text-gray-500 dark:text-gray-500">
                      {floorRoomList.length}
                    </span>
                    <svg
                      className={`h-3 w-3 transition-transform ${expandedFloors.has(floor) ? "rotate-90" : ""}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                </button>
                {expandedFloors.has(floor) && (
                  <div className="mt-1 ml-2 space-y-0.5 border-l-2 border-gray-200 pl-2 dark:border-gray-600">
                    {floorRoomList.map(renderRoomOption)}
                  </div>
                )}
              </div>
            ))}

          {unassignedRooms.length > 0 && (
            <div className="mt-1">
              <button
                type="button"
                onClick={() => toggleFloor("unassigned")}
                className="flex w-full items-center justify-between rounded px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                <span>Unassigned Floor</span>
                <span className="flex items-center gap-1">
                  <span className="text-gray-500 dark:text-gray-500">
                    {unassignedRooms.length}
                  </span>
                  <svg
                    className={`h-3 w-3 transition-transform ${expandedFloors.has("unassigned") ? "rotate-90" : ""}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              </button>
              {expandedFloors.has("unassigned") && (
                <div className="mt-1 ml-2 space-y-0.5 border-l-2 border-gray-200 pl-2 dark:border-gray-600">
                  {unassignedRooms.map(renderRoomOption)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WeekTimetable({
  week,
  onClose,
  entries,
  reservations,
  selectedRoom,
  selectedRoomId,
  onDropReservation,
  onReturnReschedule,
  isSavingReservation,
  roomError,
  breakPeriods,
  isLoading,
  error,
  breakError,
}: {
  week: Date[];
  onClose: () => void;
  entries: TimetableEntryRecord[];
  reservations: ReservationRecord[];
  selectedRoom: string | null;
  selectedRoomId: string | null;
  onDropReservation: (
    reservationId: string,
    date: Date,
    startTime: number,
  ) => void;
  onReturnReschedule: (reservationId: string) => void;
  isSavingReservation: boolean;
  roomError: string | null;
  breakPeriods: BreakPeriodRecord[];
  isLoading: boolean;
  error: string | null;
  breakError: string | null;
}) {
  const timetableDays = week.filter((date) => date.getDay() !== 0);
  const timetableRef = useRef<HTMLDivElement>(null);
  const visibleEntries = selectedRoom
    ? entries.filter(
        (entry) =>
          entry.room_name.trim().toLowerCase() ===
          selectedRoom.trim().toLowerCase(),
      )
    : [];
  const visibleReservations = reservations.filter(
    (reservation) =>
      selectedRoomId !== null && reservation.room_id === selectedRoomId,
  );
  const weekLabel = `${timetableDays[0].toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  })} – ${timetableDays[timetableDays.length - 1].toLocaleDateString(
    undefined,
    {
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  )}`;

  function handleTimetableDragOver(event: DragEvent<HTMLDivElement>) {
    if (!Array.from(event.dataTransfer.types).includes("text/reservation-id")) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleTimetableDrop(event: DragEvent<HTMLDivElement>) {
    const reservationId = event.dataTransfer.getData("text/reservation-id");
    const bounds = timetableRef.current?.getBoundingClientRect();
    if (!reservationId || !bounds) return;

    event.preventDefault();
    const dayWidth =
      (bounds.width - TIMETABLE_TIME_COLUMN_WIDTH) / TIMETABLE_DAY_COUNT;
    const dayIndex = Math.floor(
      (event.clientX - bounds.left - TIMETABLE_TIME_COLUMN_WIDTH) / dayWidth,
    );
    if (dayIndex < 0 || dayIndex >= timetableDays.length) return;

    const rowIndex = Math.floor(
      (event.clientY - bounds.top - 45) / TIMETABLE_ROW_HEIGHT,
    );
    const boundedRowIndex = Math.max(
      0,
      Math.min(TIMETABLE_SLOT_COUNT - 1, rowIndex),
    );
    const startTime = TIMETABLE_START_MINUTES + boundedRowIndex * 30;
    onDropReservation(reservationId, timetableDays[dayIndex], startTime);
  }

  return (
    <section
      id="expanded-week-timetable"
      className="col-span-7 border-b border-gray-200 bg-gray-50 p-4 sm:p-5 dark:border-gray-700 dark:bg-gray-900/50"
      aria-label={`Weekly timetable, ${weekLabel}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Weekly timetable
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {weekLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close weekly timetable"
          className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <HiChevronUp className="h-5 w-5" />
        </button>
      </div>

      <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
        {error ||
          "Scheduled classes, break periods, and dated reservations are shown for the selected room."}
      </p>
      <ul
        aria-label="Timetable color legend"
        className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-gray-600 dark:text-gray-300"
      >
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-blue-300 bg-blue-100 dark:border-blue-700 dark:bg-blue-950" />
          Lecture
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-emerald-300 bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950" />
          Laboratory
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-violet-300 bg-violet-100 dark:border-violet-700 dark:bg-violet-950" />
          Break Periods
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-amber-300 bg-amber-100 dark:border-amber-700 dark:bg-amber-950" />
          Fatigue Risk / Unassigned
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-red-300 bg-red-100 dark:border-red-700 dark:bg-red-950" />
          Schedule Conflict
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-gray-300 bg-gray-100 opacity-75 dark:border-gray-600 dark:bg-gray-800" />
          Other Section / Room
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-fuchsia-300 bg-fuchsia-50 dark:border-fuchsia-700 dark:bg-fuchsia-950" />
          Reservation
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-fuchsia-400 bg-fuchsia-200 dark:border-fuchsia-600 dark:bg-fuchsia-900" />
          Reschedule
        </li>
      </ul>
      {visibleReservations.some(
        (reservation) => reservation.type.toLowerCase() === "reschedule",
      ) && (
        <p className="mb-3 text-sm text-amber-800 dark:text-amber-300">
          Rescheduled blocks are draggable. Drag one to another time slot to
          move it, or use its X button to return it to the sidebar.
        </p>
      )}
      {breakError && (
        <p className="mb-3 text-sm text-violet-700 dark:text-violet-300">
          Break periods could not be loaded: {breakError}
        </p>
      )}
      {roomError && (
        <p className="mb-3 text-sm text-rose-700 dark:text-rose-300">
          Rooms could not be loaded: {roomError}
        </p>
      )}

      <div className="scrollbar-thumb-gray-400 scrollbar-track-transparent overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div
          ref={timetableRef}
          onDragOver={handleTimetableDragOver}
          onDrop={handleTimetableDrop}
          className="relative min-w-[64rem]"
        >
          <div className="pointer-events-none absolute inset-0 z-10">
            {visibleEntries.map((entry) => {
              const dayIndex = TIMETABLE_WEEKDAY_NAMES.findIndex(
                (day) => day.toLowerCase() === entry.day.trim().toLowerCase(),
              );
              if (
                dayIndex < 0 ||
                entry.start_time <= 0 ||
                entry.end_time <= entry.start_time
              ) {
                return null;
              }
              if (
                isScheduleEntryRescheduledOnDate(
                  entry.schedule_entry_id,
                  reservations,
                  timetableDays[dayIndex],
                )
              ) {
                return null;
              }

              const duration = entry.end_time - entry.start_time;
              const topOffset =
                ((entry.start_time - TIMETABLE_START_MINUTES) / 30) *
                TIMETABLE_ROW_HEIGHT;
              const height = Math.max(
                TIMETABLE_ROW_HEIGHT,
                (duration / 30) * TIMETABLE_ROW_HEIGHT,
              );
              const isLab = entry.type?.toLowerCase() === "laboratory";

              return (
                <article
                  key={entry.schedule_entry_id}
                  aria-label={`${entry.course_name}, ${entry.section}, ${entry.room_name || "Room TBA"}, ${formatTime(entry.start_time)} to ${formatTime(entry.end_time)}`}
                  className={`pointer-events-auto absolute flex flex-col overflow-hidden rounded border p-2 text-left shadow-xs ${
                    isLab
                      ? "border-emerald-300 bg-emerald-50/95 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/90 dark:text-emerald-200"
                      : "border-blue-300 bg-blue-50/95 text-blue-950 dark:border-blue-700 dark:bg-blue-950/90 dark:text-blue-200"
                  }`}
                  style={{
                    top: `${topOffset + 45}px`,
                    left: `calc(${TIMETABLE_TIME_COLUMN_WIDTH}px + (${dayIndex} * ((100% - ${TIMETABLE_TIME_COLUMN_WIDTH}px) / ${TIMETABLE_DAY_COUNT})) + 2px)`,
                    width: `calc((100% - ${TIMETABLE_TIME_COLUMN_WIDTH}px) / ${TIMETABLE_DAY_COUNT} - 4px)`,
                    height: `${height - 4}px`,
                  }}
                >
                  <div className="truncate text-xs font-bold">
                    {entry.course_code || entry.course_name}
                  </div>
                  <div className="truncate text-[10px] font-medium">
                    {entry.course_name}
                  </div>
                  <div className="mt-auto space-y-0.5 truncate text-[10px] font-semibold">
                    <div>Teacher: {entry.teacher_code || "Unassigned"}</div>
                    <div>Section: {entry.section}</div>
                    <div>Room: {entry.room_name || "TBA"}</div>
                    <div className="font-mono">
                      {formatTime(entry.start_time)} –{" "}
                      {formatTime(entry.end_time)}
                    </div>
                  </div>
                </article>
              );
            })}
            {expandBreakPeriods(breakPeriods).map((breakPeriod) => {
              const dayIndex = TIMETABLE_WEEKDAY_NAMES.findIndex(
                (day) => day.toLowerCase() === breakPeriod.day.toLowerCase(),
              );
              const visibleStart = Math.max(
                breakPeriod.start_time,
                TIMETABLE_START_MINUTES,
              );
              const visibleEnd = Math.min(
                breakPeriod.end_time,
                TIMETABLE_START_MINUTES + TIMETABLE_SLOT_COUNT * 30,
              );
              if (dayIndex < 0 || visibleEnd <= visibleStart) return null;

              const topOffset =
                ((visibleStart - TIMETABLE_START_MINUTES) / 30) *
                TIMETABLE_ROW_HEIGHT;
              const height = Math.max(
                20,
                ((visibleEnd - visibleStart) / 30) * TIMETABLE_ROW_HEIGHT - 4,
              );

              return (
                <article
                  key={`${breakPeriod.break_id}-${breakPeriod.day}`}
                  aria-label={`${breakPeriod.break_description}, ${breakPeriod.day}, ${formatTime(breakPeriod.start_time)} to ${formatTime(breakPeriod.end_time)}`}
                  className="pointer-events-none absolute flex flex-col items-center justify-center overflow-hidden rounded border border-violet-300 bg-violet-100/95 p-1 text-center text-violet-950 shadow-xs dark:border-violet-700 dark:bg-violet-900/95 dark:text-violet-100"
                  style={{
                    top: `${topOffset + 45}px`,
                    left: `calc(${TIMETABLE_TIME_COLUMN_WIDTH}px + (${dayIndex} * ((100% - ${TIMETABLE_TIME_COLUMN_WIDTH}px) / ${TIMETABLE_DAY_COUNT})) + 2px)`,
                    width: `calc((100% - ${TIMETABLE_TIME_COLUMN_WIDTH}px) / ${TIMETABLE_DAY_COUNT} - 4px)`,
                    height: `${height}px`,
                  }}
                >
                  <div className="flex w-full items-center justify-center gap-1 truncate text-[10px] font-bold">
                    <GiCoffeeCup className="shrink-0" />
                    <span className="truncate">
                      {breakPeriod.break_description}
                    </span>
                  </div>
                  <div className="font-mono text-[9px]">
                    {formatTime(breakPeriod.start_time)} –{" "}
                    {formatTime(breakPeriod.end_time)}
                  </div>
                </article>
              );
            })}
            {visibleReservations.map((reservation) => {
              const dayIndex = timetableDays.findIndex((date) =>
                reservationMatchesDate(reservation, date),
              );
              const scheduleEntry = getRescheduledScheduleEntry(
                reservation,
                entries,
              );
              const startTime =
                reservation.start_time ?? scheduleEntry?.start_time ?? null;
              const endTime =
                reservation.end_time ?? scheduleEntry?.end_time ?? null;
              if (
                dayIndex < 0 ||
                startTime === null ||
                endTime === null ||
                startTime < TIMETABLE_START_MINUTES ||
                endTime <= startTime
              ) {
                return null;
              }

              const topOffset =
                ((startTime - TIMETABLE_START_MINUTES) / 30) *
                TIMETABLE_ROW_HEIGHT;
              const height = Math.max(
                TIMETABLE_ROW_HEIGHT,
                ((endTime - startTime) / 30) * TIMETABLE_ROW_HEIGHT,
              );
              const isUnassigned = reservation.room_id === null;
              const isReschedule =
                reservation.type.toLowerCase() === "reschedule";
              const reservationDisplayName = getReservationDisplayName(
                reservation,
                entries,
              );

              return (
                <article
                  key={reservation.reservation_id}
                  draggable={isReschedule || isUnassigned}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      "text/reservation-id",
                      reservation.reservation_id,
                    );
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  aria-label={`${reservationDisplayName}, ${reservation.type}, ${formatTime(startTime)} to ${formatTime(endTime)}${isUnassigned ? ", unassigned" : ""}`}
                  className={`${isReschedule || isUnassigned ? "pointer-events-auto cursor-grab active:cursor-grabbing" : "pointer-events-none"} absolute flex flex-col overflow-hidden rounded border p-2 text-left shadow-xs ${
                    isUnassigned
                      ? "border-amber-300 bg-amber-50/95 text-amber-950 dark:border-amber-700 dark:bg-amber-950/90 dark:text-amber-200"
                      : isReschedule
                        ? "border-fuchsia-400 bg-fuchsia-200 text-fuchsia-950 dark:border-fuchsia-600 dark:bg-fuchsia-900 dark:text-fuchsia-100"
                        : "border-fuchsia-300 bg-fuchsia-50/95 text-fuchsia-950 dark:border-fuchsia-700 dark:bg-fuchsia-950/90 dark:text-fuchsia-200"
                  }`}
                  style={{
                    top: `${topOffset + 45}px`,
                    left: `calc(${TIMETABLE_TIME_COLUMN_WIDTH}px + (${dayIndex} * ((100% - ${TIMETABLE_TIME_COLUMN_WIDTH}px) / ${TIMETABLE_DAY_COUNT})) + 2px)`,
                    width: `calc((100% - ${TIMETABLE_TIME_COLUMN_WIDTH}px) / ${TIMETABLE_DAY_COUNT} - 4px)`,
                    height: `${height - 4}px`,
                  }}
                >
                  {isReschedule && !isUnassigned && (
                    <button
                      type="button"
                      draggable={false}
                      onDragStart={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        onReturnReschedule(reservation.reservation_id);
                      }}
                      disabled={isSavingReservation}
                      aria-label={`Return ${reservationDisplayName} to the sidebar`}
                      title="Return to sidebar"
                      className="absolute top-1 right-1 z-10 rounded p-0.5 text-fuchsia-900 transition-colors hover:bg-fuchsia-300 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-fuchsia-100 dark:hover:bg-fuchsia-700"
                    >
                      <HiXMark className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                  {scheduleEntry ? (
                    <>
                      <div className="truncate pr-5 text-xs font-bold">
                        {scheduleEntry.course_code || scheduleEntry.course_name}
                      </div>
                      <div className="truncate text-[10px] font-medium">
                        {scheduleEntry.course_name}
                      </div>
                      <div className="mt-auto space-y-0.5 truncate text-[10px] font-semibold">
                        <div>
                          Teacher: {scheduleEntry.teacher_code || "Unassigned"}
                        </div>
                        <div>Section: {scheduleEntry.section}</div>
                        <div>
                          Room: {isUnassigned ? "TBA" : selectedRoom || "TBA"}
                        </div>
                        <div className="font-mono">
                          {formatTime(startTime)} – {formatTime(endTime)}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="truncate pr-5 text-xs font-bold">
                        {reservationDisplayName}
                      </div>
                      <div className="truncate text-[10px] font-medium">
                        {isUnassigned
                          ? "Unassigned · drag to assign"
                          : reservation.type}
                      </div>
                      <div className="mt-auto font-mono text-[10px]">
                        {formatTime(startTime)} – {formatTime(endTime)}
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>

          <table
            className="w-full border-collapse text-left text-xs"
            style={{ tableLayout: "fixed" }}
          >
            <caption className="sr-only">
              Weekly timetable from 7:00 AM to 9:30 PM in 30-minute intervals
            </caption>
            <thead>
              <tr className="h-[45px] bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <th
                  scope="col"
                  className="sticky left-0 z-20 w-24 border-r border-b border-gray-200 bg-gray-100 p-3 text-center font-bold dark:border-gray-700 dark:bg-gray-800"
                >
                  Time
                </th>
                {timetableDays.map((date) => (
                  <th
                    key={date.toISOString()}
                    scope="col"
                    className="border-r border-b border-gray-200 p-2 text-center font-bold last:border-r-0 dark:border-gray-700"
                  >
                    <span className="block text-[10px] uppercase">
                      {date.toLocaleDateString(undefined, { weekday: "short" })}
                    </span>
                    <span>
                      {date.toLocaleDateString(undefined, {
                        month: "numeric",
                        day: "numeric",
                      })}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: TIMETABLE_SLOT_COUNT }, (_, index) => {
                const time = TIMETABLE_START_MINUTES + index * 30;

                return (
                  <tr key={time} className="h-11 border-b dark:border-gray-700">
                    <th
                      scope="row"
                      className="sticky left-0 z-20 w-24 border-r border-gray-200 bg-gray-50 p-2 text-center font-mono text-[11px] font-medium whitespace-nowrap text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    >
                      {formatTime(time)}
                    </th>
                    {timetableDays.map((date) => (
                      <td
                        key={`${date.toISOString()}-${time}`}
                        aria-label={`Drop a reservation at ${formatTime(time)} on ${date.toLocaleDateString()}`}
                        className="relative border-r border-gray-200 last:border-r-0 hover:bg-blue-50/60 dark:border-gray-700 dark:hover:bg-blue-950/30"
                      />
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {isLoading && (
            <div className="absolute inset-x-0 top-14 z-20 bg-white/90 p-4 text-center text-sm text-gray-600 dark:bg-gray-800/90 dark:text-gray-300">
              Loading timetable blocks…
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function BookingPage() {
  const [selectedDate, setSelectedDate] = useState(() =>
    getSelectableDate(new Date()),
  );
  const [expandedWeekStart, setExpandedWeekStart] = useState<Date | null>(null);
  const [timetableEntries, setTimetableEntries] = useState<
    TimetableEntryRecord[]
  >([]);
  const [subjectLabTypes, setSubjectLabTypes] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [rooms, setRooms] = useState<ReservationRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [breakPeriods, setBreakPeriods] = useState<BreakPeriodRecord[]>([]);
  const [breakPeriodError, setBreakPeriodError] = useState<string | null>(null);
  const [isLoadingTimetable, setIsLoadingTimetable] = useState(true);
  const [timetableError, setTimetableError] = useState<string | null>(null);
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [isLoadingReservations, setIsLoadingReservations] = useState(true);
  const [reservationError, setReservationError] = useState<string | null>(null);
  const [isAddingReservation, setIsAddingReservation] = useState(false);
  const [isSavingReservation, setIsSavingReservation] = useState(false);
  const [deletingReservationId, setDeletingReservationId] = useState<
    string | null
  >(null);
  const [reservationPendingDeletion, setReservationPendingDeletion] =
    useState<Pick<ReservationRecord, "reservation_id" | "description"> | null>(
      null,
    );
  const [reservationDescription, setReservationDescription] = useState("");
  const [reservationType, setReservationType] = useState<
    "Normal Schedule" | "No Classes"
  >("Normal Schedule");
  const [autoAssignBasedOnConstraint, setAutoAssignBasedOnConstraint] =
    useState(true);
  const [reservationConstraint, setReservationConstraint] =
    useState<ReservationConstraint>("room");
  const [reservationRoomId, setReservationRoomId] = useState("");
  const [reservationStartTime, setReservationStartTime] = useState("09:00");
  const [reservationEndTime, setReservationEndTime] = useState("10:00");
  const [reservationPage, setReservationPage] = useState(1);
  const [reservationReloadKey, setReservationReloadKey] = useState(0);
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
  const today = new Date();
  const isSelectedDateInPast =
    new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
    ) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const selectedWeekday = WEEKDAY_NAMES[selectedDate.getDay()];
  const selectedRoomRecord = rooms.find(
    (room) => room.room_name?.trim() === selectedRoom,
  );
  const selectedRoomId = selectedRoomRecord?.room_id ?? null;
  const selectedWeekStart = getWeekStart(selectedDate);
  const selectedWeekDays = Array.from(
    { length: 6 },
    (_, index) =>
      new Date(
        selectedWeekStart.getFullYear(),
        selectedWeekStart.getMonth(),
        selectedWeekStart.getDate() + index + 1,
      ),
  );
  const visibleReservations = reservations.filter(
    (reservation) =>
      reservationMatchesDate(reservation, selectedDate) ||
      (reservation.room_id === null &&
        selectedWeekDays.some((date) =>
          reservationMatchesDate(reservation, date),
        )),
  );
  const reservationPageCount = Math.max(
    1,
    Math.ceil(visibleReservations.length / RESERVATION_PAGE_SIZE),
  );
  const currentReservationPage = Math.min(
    reservationPage,
    reservationPageCount,
  );
  const firstReservationIndex =
    (currentReservationPage - 1) * RESERVATION_PAGE_SIZE;
  const paginatedReservations = visibleReservations.slice(
    firstReservationIndex,
    firstReservationIndex + RESERVATION_PAGE_SIZE,
  );
  const reservationStartMinutes = timeStringToMinutes(reservationStartTime);
  const reservationEndMinutes = timeStringToMinutes(reservationEndTime);
  const isReservationTimeValid =
    reservationStartMinutes >= RESERVATION_START_MINUTES &&
    reservationStartMinutes < reservationEndMinutes &&
    reservationEndMinutes <= RESERVATION_END_MINUTES;
  const scheduleEntriesForConflict = useMemo(
    () =>
      timetableEntries
        .filter(
          (entry) =>
            !isScheduleEntryRescheduledOnDate(
              entry.schedule_entry_id,
              reservations,
              selectedDate,
            ),
        )
        .map((entry) => ({
          ...entry,
          requiredRoomType: subjectLabTypes.get(entry.subject_id) ?? null,
        })),
    [reservations, selectedDate, subjectLabTypes, timetableEntries],
  );
  const conflictingScheduleEntries = useMemo(() => {
    if (
      reservationType !== "Normal Schedule" ||
      !isReservationTimeValid ||
      !reservationRoomId
    ) {
      return [];
    }

    return getScheduleConflicts(
      scheduleEntriesForConflict,
      selectedWeekday,
      reservationRoomId,
      reservationStartMinutes,
      reservationEndMinutes,
    );
  }, [
    isReservationTimeValid,
    reservationEndMinutes,
    reservationRoomId,
    reservationStartMinutes,
    reservationType,
    selectedWeekday,
    scheduleEntriesForConflict,
  ]);
  const conflictingReservations = useMemo(() => {
    if (!isReservationTimeValid || !reservationRoomId) return [];

    return reservations.filter(
      (reservation) =>
        reservation.room_id === reservationRoomId &&
        reservationMatchesDate(reservation, selectedDate) &&
        reservation.start_time !== null &&
        reservation.end_time !== null &&
        reservationStartMinutes < reservation.end_time &&
        reservationEndMinutes > reservation.start_time,
    );
  }, [
    isReservationTimeValid,
    reservationEndMinutes,
    reservationRoomId,
    reservationStartMinutes,
    reservations,
    selectedDate,
  ]);
  const hasScheduleConflicts = conflictingScheduleEntries.length > 0;
  const placementEntries = useMemo(
    () => [
      ...scheduleEntriesForConflict,
      ...reservations
        .filter(
          (
            reservation,
          ): reservation is ReservationRecord & {
            room_id: string;
            start_time: number;
            end_time: number;
          } =>
            reservation.room_id !== null &&
            reservation.start_time !== null &&
            reservation.end_time !== null &&
            reservationMatchesDate(reservation, selectedDate),
        )
        .map((reservation) => ({
          schedule_entry_id: reservation.reservation_id,
          room_id: reservation.room_id as string,
          day: selectedWeekday,
          start_time: reservation.start_time,
          end_time: reservation.end_time,
        })),
    ],
    [reservations, scheduleEntriesForConflict, selectedDate, selectedWeekday],
  );
  const automaticReschedulePlan = useMemo(() => {
    if (
      !autoAssignBasedOnConstraint ||
      reservationType !== "Normal Schedule" ||
      !conflictingScheduleEntries.length ||
      !isReservationTimeValid ||
      !reservationRoomId
    ) {
      return [];
    }

    return getAutomaticReschedulePlan(
      placementEntries,
      rooms,
      selectedWeekday,
      reservationRoomId,
      reservationStartMinutes,
      reservationEndMinutes,
      conflictingScheduleEntries,
      reservationConstraint,
    );
  }, [
    autoAssignBasedOnConstraint,
    conflictingScheduleEntries,
    isReservationTimeValid,
    placementEntries,
    reservationEndMinutes,
    reservationRoomId,
    reservationStartMinutes,
    reservationConstraint,
    rooms,
    reservationType,
    selectedWeekday,
  ]);

  useEffect(() => {
    document.title = "AceHub | Room Reservation";
  }, []);

  useEffect(() => {
    let isCurrent = true;

    async function loadTimetableEntries() {
      try {
        const [activeSchedule, breakPeriodResult, roomResult, roomTypeResult] =
          await Promise.all([
            fetchActiveScheduleName(),
            fetchBreakPeriods(null, undefined, undefined, -1),
            getRoomsForGeneration(),
            fetchRoomTypeList(null, "ASC", -1),
          ]);

        if (isCurrent) {
          if (breakPeriodResult.success) {
            setBreakPeriods(breakPeriodResult.data || []);
            setBreakPeriodError(null);
          } else {
            setBreakPeriods([]);
            setBreakPeriodError(
              breakPeriodResult.error || "Please try again later.",
            );
          }

          if (roomResult.success) {
            const availableRooms = roomResult.data || [];
            const roomTypeNames = new Map(
              (roomTypeResult.data || []).map((roomType) => [
                roomType.room_type_id.trim().toLowerCase(),
                roomType.value,
              ]),
            );
            setRooms(
              availableRooms.map((room) => ({
                ...room,
                room_type_name: room.room_type
                  ? (roomTypeNames.get(room.room_type.trim().toLowerCase()) ??
                    null)
                  : null,
              })),
            );
            setSelectedRoom(
              (currentRoom) =>
                currentRoom ??
                availableRooms
                  .find((room) => room.room_name?.trim())
                  ?.room_name?.trim() ??
                null,
            );
            setRoomError(
              roomTypeResult.success
                ? null
                : roomTypeResult.error ||
                    "Room types could not be loaded; automatic room changes may be unavailable.",
            );
          } else {
            setRooms([]);
            setRoomError(roomResult.error || "Please try again later.");
          }
        }

        if (!activeSchedule.success || !activeSchedule.data) {
          throw new Error("No active timetable schedule was found.");
        }

        const schedule = await fetchScheduleByName(activeSchedule.data);
        if (!schedule.success || !schedule.data) {
          throw new Error(
            schedule.error || "The active schedule could not be loaded.",
          );
        }

        const result = await fetchTimetableEntriesByScheduleId(
          schedule.data.schedule_id,
        );
        if (!result.success) {
          throw new Error(
            result.error || "Timetable blocks could not be loaded.",
          );
        }

        const scheduleEntries = result.data || [];
        const subjectIds = Array.from(
          new Set(
            scheduleEntries.map((entry) => entry.subject_id).filter(Boolean),
          ),
        );
        const subjectUnitsResult = subjectIds.length
          ? await fetchSubjectsUnitsByIds(subjectIds)
          : null;
        const labTypes = new Map<string, string>();
        if (subjectUnitsResult?.success && subjectUnitsResult.data) {
          for (const subject of subjectUnitsResult.data) {
            if (subject.lab_type && subject.lab_type !== "null") {
              labTypes.set(subject.subject_id, subject.lab_type);
            }
          }
        }

        if (isCurrent) {
          setTimetableEntries(scheduleEntries);
          setSubjectLabTypes(labTypes);
          setTimetableError(null);
        }
      } catch (error) {
        if (isCurrent) {
          setTimetableError(
            error instanceof Error
              ? error.message
              : "Timetable blocks could not be loaded.",
          );
        }
      } finally {
        if (isCurrent) {
          setIsLoadingTimetable(false);
          setIsLoadingRooms(false);
        }
      }
    }

    void loadTimetableEntries();
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;

    async function loadReservations() {
      setIsLoadingReservations(true);
      setReservationError(null);

      const reservationResult = await fetchReservations(
        null,
        "start_time",
        "ASC",
        -1,
        0,
      );

      if (!isCurrent) return;

      if (!reservationResult.success) {
        setReservations([]);
        setReservationError(
          reservationResult.error || "Reservations could not be loaded.",
        );
      } else {
        setReservations(reservationResult.data || []);
        setReservationError(null);
      }

      setIsLoadingReservations(false);
    }

    void loadReservations();
    return () => {
      isCurrent = false;
    };
  }, [reservationReloadKey]);

  useEffect(() => {
    setReservationPage(1);
  }, [selectedDate, reservationReloadKey]);

  useEffect(() => {
    if (!isAddingReservation) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSavingReservation) {
        setIsAddingReservation(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isAddingReservation, isSavingReservation]);

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

  function openReservationModal() {
    if (isSelectedDateInPast) return;

    setReservationDescription("");
    setReservationType("Normal Schedule");
    setAutoAssignBasedOnConstraint(true);
    setReservationConstraint("room");
    setReservationRoomId(selectedRoomId ?? "");
    setReservationStartTime("09:00");
    setReservationEndTime("10:00");
    setReservationError(null);
    setIsAddingReservation(true);
  }

  async function handleAddReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSelectedDateInPast) {
      setReservationError("Reservations cannot be added for past dates.");
      return;
    }

    const description = filterCourseNameWithoutTrim(
      reservationDescription,
    ).trim();
    if (!description) {
      setReservationError("Description is required.");
      return;
    }

    const currentRoom = rooms.find(
      (room) => room.room_id === reservationRoomId,
    );
    if (!currentRoom?.room_id) {
      setReservationError("Select a room before adding a reservation.");
      return;
    }
    if (!isReservationTimeValid) {
      setReservationError("Choose a valid time between 7:00 AM and 10:00 PM.");
      return;
    }
    if (conflictingReservations.length > 0) {
      setReservationError(
        "The selected room and time overlap an existing reservation.",
      );
      return;
    }
    if (
      reservationType === "Normal Schedule" &&
      (isLoadingTimetable || timetableError)
    ) {
      setReservationError(
        "The active timetable must be available to check for conflicts.",
      );
      return;
    }
    if (
      autoAssignBasedOnConstraint &&
      reservationType === "Normal Schedule" &&
      conflictingScheduleEntries.length > 0 &&
      automaticReschedulePlan === null
    ) {
      setReservationError(
        `No available placement satisfies the ${reservationConstraint} constraint for every conflicting class.`,
      );
      return;
    }

    const entriesToCreate: Parameters<typeof createReservations>[0] = [
      {
        room_id: currentRoom.room_id,
        description,
        type: reservationType,
        day: formatReservationDate(selectedDate),
        start_time: reservationStartMinutes,
        end_time: reservationEndMinutes,
      },
    ];

    if (
      reservationType === "Normal Schedule" &&
      conflictingScheduleEntries.length > 0
    ) {
      if (autoAssignBasedOnConstraint && automaticReschedulePlan) {
        entriesToCreate.push(
          ...automaticReschedulePlan.map(({ entry, alternative }) => ({
            room_id: alternative.roomId,
            description: entry.schedule_entry_id,
            type: "reschedule",
            day: formatReservationDate(selectedDate),
            start_time: alternative.startTime,
            end_time: alternative.endTime,
          })),
        );
      } else if (!autoAssignBasedOnConstraint) {
        entriesToCreate.push(
          ...conflictingScheduleEntries.map((entry) => ({
            room_id: null,
            description: entry.schedule_entry_id,
            type: "reschedule",
            day: formatReservationDate(selectedDate),
            start_time: null,
            end_time: null,
          })),
        );
      }
    }

    setIsSavingReservation(true);
    setReservationError(null);
    const result = await createReservations(entriesToCreate);
    setIsSavingReservation(false);

    if (!result.success) {
      setReservationError(
        result.error || "Reservation entries could not be created.",
      );
      return;
    }

    setReservationDescription("");
    setReservationType("Normal Schedule");
    setReservationStartTime("09:00");
    setReservationEndTime("10:00");
    if (currentRoom.room_name?.trim()) {
      setSelectedRoom(currentRoom.room_name.trim());
    }
    setIsAddingReservation(false);
    setReservationReloadKey((key) => key + 1);
  }

  async function handleReservationDrop(
    reservationId: string,
    date: Date,
    startTime: number,
  ) {
    const reservation = reservations.find(
      (entry) => entry.reservation_id === reservationId,
    );
    if (!reservation || !selectedRoomId) return;

    const sourceScheduleEntry = getRescheduledScheduleEntry(
      reservation,
      timetableEntries,
    );
    const duration =
      reservation.start_time !== null && reservation.end_time !== null
        ? reservation.end_time - reservation.start_time
        : sourceScheduleEntry
          ? sourceScheduleEntry.end_time - sourceScheduleEntry.start_time
          : 0;
    if (duration <= 0) {
      setReservationError(
        "The reservation has no valid time range to place in the timetable.",
      );
      return;
    }

    const targetDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    if (targetDate < todayDate) {
      setReservationError("Reservations cannot be assigned to past dates.");
      return;
    }

    const weekday = WEEKDAY_NAMES[date.getDay()];
    const endTime = startTime + duration;
    if (
      startTime < RESERVATION_START_MINUTES ||
      endTime > RESERVATION_END_MINUTES
    ) {
      setReservationError(
        "That time slot cannot fit this reservation before 10:00 PM.",
      );
      return;
    }
    if (isLoadingReservations) {
      setReservationError(
        "Wait for reservations to finish loading before assigning.",
      );
      return;
    }
    if (
      (reservation.type.toLowerCase() === "normal schedule" ||
        reservation.type.toLowerCase() === "reschedule") &&
      (isLoadingTimetable || timetableError)
    ) {
      setReservationError(
        "The active timetable must be available before assigning this reservation.",
      );
      return;
    }
    const isReschedule = reservation.type.toLowerCase() === "reschedule";
    const scheduleEntriesForDate = timetableEntries
      .filter(
        (entry) =>
          !isScheduleEntryRescheduledOnDate(
            entry.schedule_entry_id,
            reservations,
            date,
          ),
      )
      .map((entry) => ({
        ...entry,
        requiredRoomType: subjectLabTypes.get(entry.subject_id) ?? null,
      }));
    const sourceEntryId = sourceScheduleEntry?.schedule_entry_id ?? null;

    if (
      (reservation.type.toLowerCase() === "normal schedule" || isReschedule) &&
      getScheduleConflicts(
        scheduleEntriesForDate,
        weekday,
        selectedRoomId,
        startTime,
        endTime,
        isReschedule && sourceEntryId ? [sourceEntryId] : [],
      ).length > 0
    ) {
      setReservationError(
        "That room and time conflict with the active schedule.",
      );
      return;
    }
    if (
      isReschedule &&
      sourceScheduleEntry &&
      !isRoomCompatible(
        rooms.find((room) => room.room_id === selectedRoomId),
        {
          type: sourceScheduleEntry.type,
          requiredRoomType:
            subjectLabTypes.get(sourceScheduleEntry.subject_id) ?? null,
        },
      )
    ) {
      setReservationError(
        sourceScheduleEntry.type.toLowerCase() === "laboratory"
          ? "This class must be placed in the same type of laboratory."
          : "Lecture classes can only be placed in lecture rooms.",
      );
      return;
    }
    if (
      reservations.some(
        (entry) =>
          entry.reservation_id !== reservationId &&
          entry.room_id === selectedRoomId &&
          reservationMatchesDate(entry, date) &&
          entry.start_time !== null &&
          entry.end_time !== null &&
          startTime < entry.end_time &&
          endTime > entry.start_time,
      )
    ) {
      setReservationError("That room and time overlap another reservation.");
      return;
    }

    setIsSavingReservation(true);
    setReservationError(null);
    const result = await updateReservation(reservationId, {
      room_id: selectedRoomId,
      day: formatReservationDate(date),
      start_time: startTime,
      end_time: endTime,
    });
    setIsSavingReservation(false);

    if (!result.success) {
      setReservationError(result.error || "Reservation could not be assigned.");
      return;
    }

    setReservationReloadKey((key) => key + 1);
  }

  async function handleReturnReschedule(reservationId: string) {
    const reservation = reservations.find(
      (entry) => entry.reservation_id === reservationId,
    );
    if (
      !reservation ||
      reservation.room_id === null ||
      reservation.type.toLowerCase() !== "reschedule" ||
      isSavingReservation
    ) {
      return;
    }

    setIsSavingReservation(true);
    setReservationError(null);
    try {
      const result = await returnRescheduleToSidebar(reservationId);
      if (!result.success) {
        setReservationError(
          result.error || "Reschedule could not be returned to the sidebar.",
        );
        return;
      }

      setReservationReloadKey((key) => key + 1);
    } catch (error) {
      setReservationError(
        error instanceof Error
          ? error.message
          : "Reschedule could not be returned to the sidebar.",
      );
    } finally {
      setIsSavingReservation(false);
    }
  }

  async function handleDeleteReservation(reservationId: string) {
    setDeletingReservationId(reservationId);
    setReservationError(null);
    try {
      const result = await deleteReservation(reservationId);
      if (!result.success) {
        setReservationError(
          result.error || "Reservation could not be deleted.",
        );
        return;
      }

      setReservationReloadKey((key) => key + 1);
      setReservationPendingDeletion(null);
    } catch (error) {
      setReservationError(
        error instanceof Error
          ? error.message
          : "Reservation could not be deleted.",
      );
    } finally {
      setDeletingReservationId(null);
    }
  }

  return (
    <main className="min-h-full bg-gray-50 p-4 sm:p-6 dark:bg-gray-900">
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Room reservation calendar
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Browse dates and review room reservations.
          </p>
        </header>

        <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-5 dark:border-gray-700">
              <h2
                className="min-w-40 text-lg font-semibold text-gray-900 dark:text-white"
                aria-live="polite"
              >
                {monthLabel}
              </h2>
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

            <div className="max-h-[calc(100vh-12rem)] scrollbar-thumb-gray-400 scrollbar-track-transparent overflow-y-auto border-t border-l border-gray-200 dark:border-gray-700">
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
                    reservationMatchesDate(reservation, date),
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
                          (isSunday
                            ? ", unavailable"
                            : hasReservation
                              ? ", has reservation"
                              : "")
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
                              ? hasReservation
                                ? "bg-fuchsia-100 dark:bg-fuchsia-900/40"
                                : "bg-blue-50 dark:bg-blue-900/30"
                              : hasReservation
                                ? "bg-fuchsia-50 hover:bg-fuchsia-100 dark:bg-fuchsia-950/40 dark:hover:bg-fuchsia-900/50"
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
                        <WeekTimetable
                          week={calendarDays.slice(index - 6, index + 1)}
                          onClose={() => setExpandedWeekStart(null)}
                          entries={timetableEntries}
                          reservations={reservations}
                          selectedRoom={selectedRoom}
                          selectedRoomId={selectedRoomId}
                          onDropReservation={(reservationId, date, time) =>
                            void handleReservationDrop(
                              reservationId,
                              date,
                              time,
                            )
                          }
                          onReturnReschedule={(reservationId) =>
                            void handleReturnReschedule(reservationId)
                          }
                          isSavingReservation={isSavingReservation}
                          roomError={roomError}
                          breakPeriods={breakPeriods}
                          isLoading={isLoadingTimetable}
                          error={timetableError}
                          breakError={breakPeriodError}
                        />
                      )}
                    </Fragment>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-blue-100 p-2 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                <HiCalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Selected date
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {selectedDateLabel}
                </p>
              </div>
            </div>
            <div className="mt-5 border-t border-gray-200 pt-5 dark:border-gray-700">
              <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                Filter by room
              </h2>
              <RoomFilterDropdown
                rooms={rooms}
                selectedRoom={selectedRoom}
                onRoomChange={setSelectedRoom}
                isLoading={isLoadingRooms}
              />
              {roomError && (
                <p className="mt-2 text-xs text-rose-700 dark:text-rose-300">
                  Rooms could not be loaded: {roomError}
                </p>
              )}
            </div>
            <div className="mt-5 border-t border-gray-200 pt-5 dark:border-gray-700">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Reservations
                  {!isLoadingReservations && ` (${visibleReservations.length})`}
                </h2>
                <button
                  type="button"
                  onClick={openReservationModal}
                  disabled={isLoadingRooms || isSelectedDateInPast}
                  title={
                    isSelectedDateInPast
                      ? "Reservations cannot be added for past dates."
                      : undefined
                  }
                  className="shrink-0 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  + Add reservation
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Reservations for {selectedDateLabel}, including unassigned
                reservations for the week.
              </p>
              {reservationError && !isAddingReservation && (
                <p
                  role="alert"
                  className="mt-3 text-xs text-rose-700 dark:text-rose-300"
                >
                  {reservationError}
                </p>
              )}

              {isLoadingReservations ? (
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  Loading reservations…
                </p>
              ) : visibleReservations.length > 0 ? (
                <>
                  <ul className="mt-4 space-y-3">
                    {paginatedReservations.map((reservation) => {
                      const scheduleEntry = getRescheduledScheduleEntry(
                        reservation,
                        timetableEntries,
                      );
                      const displayStartTime =
                        reservation.start_time ?? scheduleEntry?.start_time;
                      const displayEndTime =
                        reservation.end_time ?? scheduleEntry?.end_time;
                      const isReschedule =
                        reservation.type.toLowerCase() === "reschedule";
                      const canDrag =
                        (isReschedule || reservation.room_id === null) &&
                        displayStartTime !== undefined &&
                        displayEndTime !== undefined &&
                        displayEndTime > displayStartTime;
                      const reservationRoomName = rooms
                        .find((room) => room.room_id === reservation.room_id)
                        ?.room_name?.trim();
                      const reservationWeekDate = selectedWeekDays.find(
                        (date) => reservationMatchesDate(reservation, date),
                      );
                      const reservationDisplayName = getReservationDisplayName(
                        reservation,
                        timetableEntries,
                      );

                      return (
                        <li
                          key={reservation.reservation_id}
                          draggable={canDrag}
                          onDragStart={(event) => {
                            if (!canDrag) return;
                            event.dataTransfer.setData(
                              "text/reservation-id",
                              reservation.reservation_id,
                            );
                            event.dataTransfer.effectAllowed = "move";
                          }}
                          className={`rounded-lg border p-3 ${
                            canDrag && reservation.room_id === null
                              ? "cursor-grab border-amber-300 bg-amber-50/60 active:cursor-grabbing dark:border-amber-700 dark:bg-amber-950/20"
                              : canDrag
                                ? "cursor-grab border-fuchsia-300 bg-fuchsia-50/40 active:cursor-grabbing dark:border-fuchsia-700 dark:bg-fuchsia-950/20"
                                : "border-gray-200 dark:border-gray-700"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                if (reservationRoomName) {
                                  setSelectedRoom(reservationRoomName);
                                }
                              }}
                              disabled={!reservationRoomName}
                              aria-label={`Show ${reservationDisplayName} in ${reservationRoomName || "its assigned room"}`}
                              title={
                                reservationRoomName
                                  ? "Show this reservation's room"
                                  : undefined
                              }
                              className="min-w-0 flex-1 rounded text-left transition-opacity outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-default disabled:hover:opacity-100"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {reservationDisplayName}
                                </p>
                                <span className="shrink-0 rounded-full bg-fuchsia-50 px-2 py-1 text-[10px] font-medium text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300">
                                  {reservation.type}
                                </span>
                              </div>
                              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                                {reservation.room_id === null
                                  ? "Unassigned room"
                                  : `Room: ${reservationRoomName || "Unknown room"}`}
                              </p>
                              {reservation.room_id === null &&
                                reservationWeekDate && (
                                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                                    Date:{" "}
                                    {reservationWeekDate.toLocaleDateString(
                                      undefined,
                                      {
                                        weekday: "long",
                                        month: "short",
                                        day: "numeric",
                                      },
                                    )}
                                  </p>
                                )}
                              {!(
                                isReschedule && reservation.room_id === null
                              ) && (
                                <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                                  {displayStartTime !== undefined &&
                                  displayEndTime !== undefined
                                    ? `${formatTime(displayStartTime)} – ${formatTime(displayEndTime)}`
                                    : "Time not assigned"}
                                </p>
                              )}
                              {canDrag && (
                                <p className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                                  {reservation.room_id === null
                                    ? "Unassigned · drag into the timetable to place"
                                    : "Drag into the timetable to move this reschedule"}
                                </p>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReservationError(null);
                                setReservationPendingDeletion({
                                  reservation_id: reservation.reservation_id,
                                  description: reservationDisplayName,
                                });
                              }}
                              disabled={deletingReservationId !== null}
                              aria-label={`Delete reservation: ${reservationDisplayName}`}
                              title="Delete reservation"
                              className="shrink-0 rounded-md p-1.5 text-gray-500 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                            >
                              <HiTrash className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {reservationPageCount > 1 && (
                    <nav
                      aria-label="Reservation entries pagination"
                      className="mt-4 flex items-center justify-between gap-3 border-t border-gray-200 pt-3 dark:border-gray-700"
                    >
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Showing {firstReservationIndex + 1}–
                        {Math.min(
                          firstReservationIndex + RESERVATION_PAGE_SIZE,
                          visibleReservations.length,
                        )}{" "}
                        of {visibleReservations.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setReservationPage(currentReservationPage - 1)
                          }
                          disabled={currentReservationPage === 1}
                          aria-label="Previous reservation page"
                          className="rounded-md border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                          <HiChevronLeft
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        </button>
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                          {currentReservationPage} / {reservationPageCount}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setReservationPage(currentReservationPage + 1)
                          }
                          disabled={
                            currentReservationPage === reservationPageCount
                          }
                          aria-label="Next reservation page"
                          className="rounded-md border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                          <HiChevronRight
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    </nav>
                  )}
                </>
              ) : (
                <p className="mt-4 text-sm leading-6 text-gray-600 dark:text-gray-400">
                  No reservations for {selectedWeekday}.
                </p>
              )}
            </div>
          </aside>
        </section>
      </div>
      {isAddingReservation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSavingReservation) {
              setIsAddingReservation(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="reservation-modal-title"
            aria-describedby="reservation-modal-description"
            className="max-h-[90vh] w-full max-w-xl scrollbar-thumb-gray-400 scrollbar-track-transparent overflow-y-auto rounded-xl bg-white p-5 shadow-xl sm:p-6 dark:bg-gray-800"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2
                  id="reservation-modal-title"
                  className="text-lg font-semibold text-gray-900 dark:text-white"
                >
                  Add reservation
                </h2>
                <p
                  id="reservation-modal-description"
                  className="mt-1 text-sm text-gray-600 dark:text-gray-400"
                >
                  {selectedDateLabel} · reservations must fit between 7:00 AM
                  and 10:00 PM.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingReservation(false)}
                disabled={isSavingReservation}
                aria-label="Close reservation dialog"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <form onSubmit={handleAddReservation} className="space-y-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description <span className="text-rose-600">*</span>
                <input
                  autoFocus
                  required
                  value={reservationDescription}
                  onChange={(event) => {
                    setReservationDescription(
                      filterCourseNameWithoutTrim(event.target.value),
                    );
                    setReservationError(null);
                  }}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Type
                <select
                  value={reservationType}
                  onChange={(event) => {
                    setReservationType(
                      event.target.value as "Normal Schedule" | "No Classes",
                    );
                    setReservationError(null);
                  }}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  <option value="Normal Schedule">Normal Schedule</option>
                  <option value="No Classes">No Classes</option>
                </select>
              </label>
              <div className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                <p>Room</p>
                <RoomFilterDropdown
                  rooms={rooms}
                  selectedRoom={
                    rooms
                      .find((room) => room.room_id === reservationRoomId)
                      ?.room_name?.trim() ?? null
                  }
                  onRoomChange={(roomName) => {
                    const room = rooms.find(
                      (entry) => entry.room_name?.trim() === roomName,
                    );
                    if (room?.room_id) setReservationRoomId(room.room_id);
                    setReservationError(null);
                  }}
                  isLoading={isLoadingRooms}
                  ariaLabel="Select reservation room"
                  placeholder="Select a room"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Starts
                  <input
                    required
                    type="time"
                    min="07:00"
                    max="22:00"
                    step={RESERVATION_TIME_STEP * 60}
                    value={reservationStartTime}
                    onChange={(event) => {
                      setReservationStartTime(event.target.value);
                      setReservationError(null);
                    }}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Ends
                  <input
                    required
                    type="time"
                    min="07:00"
                    max="22:00"
                    step={RESERVATION_TIME_STEP * 60}
                    value={reservationEndTime}
                    onChange={(event) => {
                      setReservationEndTime(event.target.value);
                      setReservationError(null);
                    }}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </label>
              </div>

              {reservationType === "Normal Schedule" &&
                hasScheduleConflicts && (
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={autoAssignBasedOnConstraint}
                      onChange={(event) => {
                        setAutoAssignBasedOnConstraint(event.target.checked);
                        setReservationError(null);
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-700 focus:ring-blue-500"
                    />
                    <span>
                      <span className="block font-semibold text-gray-900 dark:text-white">
                        {autoAssignBasedOnConstraint
                          ? "Auto Assign based on constraint"
                          : "Manually assign"}
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                        {autoAssignBasedOnConstraint
                          ? "Resolve conflicts automatically using the chosen constraint."
                          : "Create an unassigned reschedule entry for each conflict, then drag each class into an open timetable slot."}
                      </span>
                    </span>
                  </label>
                )}

              {conflictingReservations.length > 0 ? (
                <p
                  role="alert"
                  className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  The selected room and time overlap an existing reservation.
                </p>
              ) : reservationType === "No Classes" ? (
                <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                  No Classes is selected, so active timetable constraints will
                  not be checked.
                </p>
              ) : !isReservationTimeValid ? (
                <p
                  role="alert"
                  className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  Choose a start time from 7:00 AM onward and an end time after
                  the start, no later than 10:00 PM.
                </p>
              ) : !reservationRoomId ? (
                <p className="rounded-lg bg-gray-100 p-3 text-sm text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  Select a room to preview conflicts and set this reservation’s
                  destination.
                </p>
              ) : isLoadingTimetable ? (
                <p className="rounded-lg bg-gray-100 p-3 text-sm text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  Checking the active timetable…
                </p>
              ) : timetableError ? (
                <p
                  role="alert"
                  className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  The active timetable could not be checked: {timetableError}
                </p>
              ) : conflictingScheduleEntries.length > 0 ? (
                <div className="space-y-3 rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/30">
                  <div>
                    <p className="mb-2 text-sm font-semibold text-rose-800 dark:text-rose-200">
                      Resolve any conflicts:
                    </p>
                    <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">
                      {conflictingScheduleEntries.length} active-schedule
                      {conflictingScheduleEntries.length === 1
                        ? " entry overlaps"
                        : " entries overlap"}{" "}
                      this reservation
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-rose-800 dark:text-rose-200">
                      {conflictingScheduleEntries.map((entry) => (
                        <li key={entry.schedule_entry_id}>
                          {entry.course_name || entry.course_code} ·{" "}
                          {entry.section} · {formatTime(entry.start_time)}–
                          {formatTime(entry.end_time)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {autoAssignBasedOnConstraint && (
                    <label className="block text-sm font-medium text-rose-900 dark:text-rose-100">
                      Conflict constraint
                      <select
                        value={reservationConstraint}
                        onChange={(event) =>
                          setReservationConstraint(
                            event.target.value as ReservationConstraint,
                          )
                        }
                        className="mt-1 w-full rounded-md border border-rose-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-rose-800 dark:bg-gray-900 dark:text-white"
                      >
                        <option value="room">Change room only</option>
                        <option value="time">Change time only</option>
                        <option value="both">Change room and time</option>
                      </select>
                    </label>
                  )}
                  {autoAssignBasedOnConstraint ? (
                    automaticReschedulePlan === null ? (
                      <p className="text-sm text-rose-800 dark:text-rose-200">
                        No conflict-free placement satisfies the selected{" "}
                        {reservationConstraint} constraint for every class.
                      </p>
                    ) : (
                      <div>
                        <p className="mb-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                          These entries will be rescheduled automatically:
                        </p>
                        <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
                          {automaticReschedulePlan.map(
                            ({ entry, alternative }) => {
                              const roomName =
                                rooms.find(
                                  (room) => room.room_id === alternative.roomId,
                                )?.room_name || "Room";
                              return (
                                <li key={entry.schedule_entry_id}>
                                  {entry.course_name || entry.course_code} →{" "}
                                  {roomName},{" "}
                                  {formatTime(alternative.startTime)}–
                                  {formatTime(alternative.endTime)}
                                </li>
                              );
                            },
                          )}
                        </ul>
                      </div>
                    )
                  ) : (
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      An unassigned reschedule entry will be created for each
                      conflict. Drag each entry from the sidebar or timetable to
                      an open slot; the original timetable is not changed.
                    </p>
                  )}
                </div>
              ) : (
                <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                  No active-schedule class conflict. Break periods are not
                  treated as room conflicts.
                </p>
              )}

              {reservationError && (
                <p
                  role="alert"
                  className="text-sm text-rose-700 dark:text-rose-300"
                >
                  {reservationError}
                </p>
              )}

              <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsAddingReservation(false)}
                  disabled={isSavingReservation}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isSavingReservation ||
                    !reservationDescription.trim() ||
                    isSelectedDateInPast ||
                    !isReservationTimeValid ||
                    !reservationRoomId ||
                    conflictingReservations.length > 0 ||
                    (reservationType === "Normal Schedule" &&
                      (isLoadingTimetable || Boolean(timetableError))) ||
                    (autoAssignBasedOnConstraint &&
                      reservationType === "Normal Schedule" &&
                      conflictingScheduleEntries.length > 0 &&
                      automaticReschedulePlan === null)
                  }
                  className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  {isSavingReservation ? "Saving…" : "Save reservation"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {reservationPendingDeletion && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-950/60 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              deletingReservationId === null
            ) {
              setReservationPendingDeletion(null);
              setReservationError(null);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && deletingReservationId === null) {
              setReservationPendingDeletion(null);
              setReservationError(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-reservation-title"
            aria-describedby="delete-reservation-description"
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl sm:p-6 dark:bg-gray-800"
          >
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                <HiTrash className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2
                  id="delete-reservation-title"
                  className="text-lg font-semibold text-gray-900 dark:text-white"
                >
                  Delete reservation?
                </h2>
                <p
                  id="delete-reservation-description"
                  className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300"
                >
                  Are you sure you want to delete “
                  {reservationPendingDeletion.description}”? This action cannot
                  be undone.
                </p>
              </div>
            </div>
            {reservationError && (
              <p
                role="alert"
                className="mt-4 text-sm text-rose-700 dark:text-rose-300"
              >
                {reservationError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => {
                  setReservationPendingDeletion(null);
                  setReservationError(null);
                }}
                disabled={deletingReservationId !== null}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  void handleDeleteReservation(
                    reservationPendingDeletion.reservation_id,
                  )
                }
                disabled={deletingReservationId !== null}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-rose-600 dark:hover:bg-rose-500"
              >
                <HiTrash className="h-4 w-4" aria-hidden="true" />
                {deletingReservationId !== null
                  ? "Deleting…"
                  : "Delete reservation"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
