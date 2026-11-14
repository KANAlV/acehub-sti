"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  Modal,
  ModalBody,
  ModalHeader,
  Select,
  Tooltip,
  useThemeMode,
} from "flowbite-react";
import {
  HiArrowLeft,
  HiExclamationCircle,
  HiOutlineExclamationCircle,
} from "react-icons/hi";
import { HiExclamationTriangle } from "react-icons/hi2";
import {
  fetchScheduleByName,
  fetchTimetableEntriesByScheduleId,
  fetchBreakPeriods,
  fetchBreakPeriodsCount,
  fetchSubjectsUnitsByIds,
  getRoomsForGeneration,
  fetchRoomTypeList,
  fetchFacultyLoadConfig,
  Configuration,
  TimetableEntryRecord,
  SubjectUnitsRecord,
  RoomForGeneration,
  RoomType,
  fetchActiveScheduleName,
} from "@/app/actions/system";
import { GiCoffeeCup } from "react-icons/gi";
import { generateSubjectAbv } from "@/utils/NameAbbreviator";

interface BreakPeriodRecord {
  break_id: string;
  break_description: string;
  day_of_week: string | number;
  start_time: string;
  end_time: string;
}

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
  type?: string; // "Lecture" | "Laboratory"
  originalDuration?: number;
}

export default function Timetable() {
  const [scheduleName, setScheduleName] = useState<string | null>(null);

  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scheduleID, setScheduleID] = useState<string | null>(null);
  const [scheduleExists, setScheduleExists] = useState<boolean>(true);

  // --- Entries State (using LocalTimetableEntry from ScheduleTimetable) --- //
  const [entries, setEntries] = useState<LocalTimetableEntry[]>([]);

  // --- Dark Mode ---
  const { computedMode } = useThemeMode();
  const isDarkMode = computedMode === "dark";

  // --- Break Periods State --- //
  const [breakPeriods, setBreakPeriods] = useState<BreakPeriodRecord[]>([]);
  const [breakPeriodCount, setBreakPeriodCount] = useState(0);

  // --- Display & Filter States --- //
  const [selectedTimetableSection, setSelectedTimetableSection] =
    useState<string>("ALL");
  const [selectedTimetableRoom, setSelectedTimetableRoom] =
    useState<string>("ALL");

  // --- Rooms, Room Types & Subject Metadata Maps (from ScheduleTimetable) --- //
  const [allRooms, setAllRooms] = useState<RoomForGeneration[]>([]);
  const [roomTypesList, setRoomTypesList] = useState<RoomType[]>([]);
  const [config, setConfig] = useState<Configuration | null>(null);
  const [subjectUnitsMap, setSubjectUnitsMap] = useState<
    Map<string, { lecture_units: number; lab_units: number; lab_type: string }>
  >(new Map());

  const DAYS_CONFIG = [
    { id: 0, name: "Whole Week" },
    { id: 7, name: "Weekdays" },
    { id: 1, name: "Monday" },
    { id: 2, name: "Tuesday" },
    { id: 3, name: "Wednesday" },
    { id: 4, name: "Thursday" },
    { id: 5, name: "Friday" },
    { id: 6, name: "Saturday" },
  ];

  const daysOfWeek = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const wholeWeek = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  // 12-hour format time slots grid (7:00 AM to 9:30 PM in 30-minute increments)
  const timeSlotsGrid = [
    "07:00 AM",
    "07:30 AM",
    "08:00 AM",
    "08:30 AM",
    "09:00 AM",
    "09:30 AM",
    "10:00 AM",
    "10:30 AM",
    "11:00 AM",
    "11:30 AM",
    "12:00 PM",
    "12:30 PM",
    "01:00 PM",
    "01:30 PM",
    "02:00 PM",
    "02:30 PM",
    "03:00 PM",
    "03:30 PM",
    "04:00 PM",
    "04:30 PM",
    "05:00 PM",
    "05:30 PM",
    "06:00 PM",
    "06:30 PM",
    "07:00 PM",
    "07:30 PM",
    "08:00 PM",
    "08:30 PM",
    "09:00 PM",
    "09:30 PM",
  ];

  const GRID_START_MINS = 7 * 60; // 7:00 AM in minutes
  const ROW_HEIGHT_PX = 44; // matches h-11 (44px)

  // --- Strict Type-Safe Room Type Fetcher (from ScheduleTimetable) --- //
  const roomTypeFetcher = (typeId: string | null | undefined): string => {
    if (!typeId) return "Standard Room";
    const cleanedId: string = typeId.trim().toLowerCase();

    if (roomTypesList && roomTypesList.length > 0) {
      const found = roomTypesList.find(
        (rt: RoomType) => rt.room_type_id?.trim().toLowerCase() === cleanedId,
      );
      if (found) return found.value;
    }

    return cleanedId;
  };

  // --- Break Period Count Fetcher --- //
  const getBreakPeriodCount = useCallback(async (search?: string | null) => {
    try {
      const response = await fetchBreakPeriodsCount(search);
      if (response?.success) {
        setBreakPeriodCount(response.count);
      } else {
        setBreakPeriodCount(0);
      }
    } catch (err) {
      console.error("Failed to fetch break period count:", err);
      setBreakPeriodCount(0);
    }
  }, []);

  // --- Break Periods Implementation Function --- //
  const getBreakPeriods = useCallback(
    async (
      search?: string | null,
      sortby?: string,
      sortdir?: string,
      limit?: number,
      page?: number,
    ) => {
      const response = await fetchBreakPeriods(
        search,
        sortby,
        sortdir,
        -1,
        page,
      );

      if (response.success && response.data) {
        setBreakPeriods(response.data as BreakPeriodRecord[]);
      } else {
        setBreakPeriods([]);
      }

      await getBreakPeriodCount(search);
    },
    [getBreakPeriodCount],
  );

  // --- Load Master Data (from ScheduleTimetable) --- //
  useEffect(() => {
    void getBreakPeriods();

    async function loadMasterData() {
      try {
        const [roomRes, roomTypesRes, configRes] = await Promise.all([
          getRoomsForGeneration(),
          fetchRoomTypeList(null, "ASC", -1),
          fetchFacultyLoadConfig(),
        ]);

        if (roomRes.success && roomRes.data) {
          setAllRooms(roomRes.data);
        }
        if (roomTypesRes.success && roomTypesRes.data) {
          setRoomTypesList(roomTypesRes.data);
        }
        if (configRes.success && configRes.data && configRes.data.length > 0) {
          setConfig(configRes.data[0]);
        }
      } catch (err) {
        console.error("Error loading master data:", err);
      }
    }
    void loadMasterData();
  }, [getBreakPeriods]);

  // Load Active Schedule
  useEffect(() => {
    async function LoadPage() {
      setIsLoading(true);
      const res = await fetchActiveScheduleName();

      if (res.success && res.data) {
        setScheduleName(res.data);
      } else {
        setIsLoading(false);
      }
    }

    void LoadPage();
  }, []);

  // 1. Fetch schedule ID by name on mount / scheduleName change
  useEffect(() => {
    document.title = "AceHub | Timetable";

    async function fetchScheduleData() {
      if (scheduleName === null) {
        return;
      }

      setIsLoading(true);
      const res = await fetchScheduleByName(scheduleName);

      if (res.success && res.data) {
        setScheduleExists(true);
        const scheduleData = Array.isArray(res.data) ? res.data[0] : res.data;
        if (scheduleData) {
          setScheduleID(scheduleData.schedule_id);
        } else {
          setScheduleExists(false);
          setIsLoading(false);
        }
      } else {
        setScheduleExists(false);
        setIsLoading(false);
      }
    }

    if (scheduleName) {
      void fetchScheduleData();
    }
  }, [scheduleName]);

  // 2. Fetch timetable entries once scheduleID is resolved (using ScheduleTimetable's processing logic)
  useEffect(() => {
    async function loadTimetableEntries() {
      if (!scheduleID) return;
      setIsLoading(true);
      try {
        const res = await fetchTimetableEntriesByScheduleId(scheduleID);
        if (res.success && res.data) {
          const loadedData = res.data as LocalTimetableEntry[];

          // Fetch subject units map (from ScheduleTimetable)
          const uniqueSubjectIds = Array.from(
            new Set(
              loadedData
                .map((e) => e.subject_id)
                .filter((id): id is string => Boolean(id)),
            ),
          );

          const unitsMap = new Map<
            string,
            { lecture_units: number; lab_units: number; lab_type: string }
          >();
          if (uniqueSubjectIds.length > 0) {
            const unitsRes = await fetchSubjectsUnitsByIds(uniqueSubjectIds);
            if (unitsRes.success && unitsRes.data) {
              unitsRes.data.forEach((subjRecord: SubjectUnitsRecord) => {
                unitsMap.set(subjRecord.subject_id, {
                  lecture_units: subjRecord.lecture_units || 0,
                  lab_units: subjRecord.lab_units || 0,
                  lab_type: subjRecord.lab_type || "",
                });
              });
            }
          }
          setSubjectUnitsMap(unitsMap);

          // Process entries with duration computation (from ScheduleTimetable)
          const processedData = loadedData.map((entry) => {
            let computedDuration = 60;
            const isLab = entry.type?.toLowerCase() === "laboratory";

            if (entry.subject_id && unitsMap.has(entry.subject_id)) {
              const u = unitsMap.get(entry.subject_id)!;
              const targetUnits = isLab
                ? u.lab_units || 0
                : u.lecture_units || 0;

              if (targetUnits > 0) {
                computedDuration = targetUnits * 60;
              } else {
                const totalUnits = (u.lecture_units || 0) + (u.lab_units || 0);
                if (totalUnits > 0) computedDuration = totalUnits * 60;
              }
            } else if (
              entry.end_time &&
              entry.start_time &&
              entry.end_time > entry.start_time
            ) {
              computedDuration = entry.end_time - entry.start_time;
            }

            return {
              ...entry,
              type: isLab ? "Laboratory" : "Lecture",
              originalDuration: computedDuration,
            };
          });

          setEntries(processedData);
          setError(null);

          // Set initial filter defaults
          const sections = Array.from(
            new Set(processedData.map((e) => e.section).filter(Boolean)),
          );
          if (sections.length > 0) {
            setSelectedTimetableSection(sections[0]);
            setSelectedTimetableRoom("ALL");
          } else {
            setSelectedTimetableSection("ALL");
            const rooms = Array.from(
              new Set(processedData.map((e) => e.room_name).filter(Boolean)),
            );
            setSelectedTimetableRoom(rooms[0] || "ALL");
          }
        } else {
          setError(res.error || "Failed to load schedule timetable entries.");
        }
      } catch (err) {
        setError(
          "An unexpected error occurred while fetching schedule entries.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    if (scheduleID) {
      void loadTimetableEntries();
    }
  }, [scheduleID]);

  const formatMinutesToTimeStr = (totalMinutes: number): string => {
    const hours24 = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const period = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    return `${String(hours12).padStart(2, "0")}:${String(mins).padStart(2, "0")} ${period}`;
  };

  const timeStrToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(":");
    let hours = parseInt(parts[0] || "0", 10);
    const minPart = parts[1] || "00 AM";
    const mins = parseInt(minPart.substring(0, 2), 10);
    const isPM = minPart.toUpperCase().includes("PM");
    const isAM = minPart.toUpperCase().includes("AM");

    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;

    return hours * 60 + mins;
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const period = hours >= 12 ? "PM" : "AM";
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
    const formattedMins = mins < 10 ? `0${mins}` : mins;
    return `${formattedHours}:${formattedMins} ${period}`;
  };

  // Helper to expand break periods based on DAYS_CONFIG mapping (from ScheduleTimetable, with sorting)
  const getExpandedBreaks = () => {
    const expanded: Array<{
      day: string;
      start_time: number;
      end_time: number;
      break_description: string;
    }> = [];

    breakPeriods.forEach((bp) => {
      let targetDays: string[] = [];
      const dayVal = bp.day_of_week;

      if (dayVal === 0 || dayVal === "0" || dayVal === "Whole Week") {
        targetDays = wholeWeek;
      } else if (dayVal === 7 || dayVal === "7" || dayVal === "Weekdays") {
        targetDays = weekdays;
      } else {
        const found = DAYS_CONFIG.find(
          (d) =>
            d.id.toString() === String(dayVal) ||
            d.name.toLowerCase() === String(dayVal).toLowerCase(),
        );
        if (found) {
          targetDays = [found.name];
        } else if (typeof dayVal === "string") {
          targetDays = [dayVal];
        }
      }

      const startMins = timeStrToMinutes(bp.start_time);
      const endMins = timeStrToMinutes(bp.end_time);

      targetDays.forEach((d) => {
        expanded.push({
          day: d,
          start_time: startMins,
          end_time: endMins,
          break_description: bp.break_description || "Break Period",
        });
      });
    });

    return expanded.sort((a, b) => {
      if (a.day !== b.day) return a.day.localeCompare(b.day);
      if (a.start_time !== b.start_time) return a.start_time - b.start_time;
      return b.end_time - a.end_time;
    });
  };

  const expandedBreaks = getExpandedBreaks();

  // Filter logic - entries matching current section/room filter (from ScheduleTimetable)
  const filteredTimetableEntries = entries.filter((entry) => {
    if (!entry.day || entry.start_time === undefined || entry.start_time <= 0) {
      return false;
    }
    const matchesSection =
      selectedTimetableSection === "ALL" ||
      entry.section === selectedTimetableSection;
    const matchesRoom =
      selectedTimetableRoom === "ALL" ||
      entry.room_name === selectedTimetableRoom;
    return matchesSection && matchesRoom;
  });

  // --- Sort helper: numbers 1-9 first, then letters A-Z --- //
  const sortAlphanumeric = (a: string, b: string) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    if (!isNaN(numA)) return -1;
    if (!isNaN(numB)) return 1;
    return a.localeCompare(b);
  };

  const availableTimetableSections = Array.from(
    new Set(entries.map((e) => e.section).filter(Boolean)),
  ).sort(sortAlphanumeric);

  // --- Unassigned Counts (from ScheduleTimetable) --- //
  const unassignedBlocksCount = entries.filter(
    (e) => !e.day || e.start_time === undefined || e.start_time <= 0,
  ).length;

  const unassignedTeacherBlocksCount = entries.filter(
    (e) => !e.teacher_id,
  ).length;

  // --- Conflict Detection (from ScheduleTimetable) --- //
  const hasEntryConflict = (entryA: LocalTimetableEntry) => {
    if (!entryA.day || !entryA.start_time || entryA.start_time <= 0)
      return false;

    for (const entryB of entries) {
      if (entryB.schedule_entry_id === entryA.schedule_entry_id) continue;
      if (!entryB.day || !entryB.start_time || entryB.start_time <= 0)
        continue;
      if (entryB.day.toLowerCase() !== entryA.day.toLowerCase()) continue;

      const isOverlapping =
        entryA.start_time < entryB.end_time &&
        entryA.end_time > entryB.start_time;

      if (!isOverlapping) continue;

      if (entryA.section.toLowerCase() === entryB.section.toLowerCase()) {
        return true;
      }
      if (
        entryA.room_name &&
        entryB.room_name &&
        entryA.room_name.toLowerCase() === entryB.room_name.toLowerCase()
      ) {
        return true;
      }
      if (
        entryA.teacher_id &&
        entryB.teacher_id &&
        entryA.teacher_id === entryB.teacher_id
      ) {
        return true;
      }
    }
    return false;
  };

  // --- Fatigue Risk Detection (from ScheduleTimetable) --- //
  const checkFatigueRisk = (entry: LocalTimetableEntry) => {
    if (!entry.teacher_id || !entry.day || !entry.start_time || entry.start_time <= 0)
      return false;
    const teacherAllEntries = entries.filter(
      (e) => e.teacher_id === entry.teacher_id && e.day && e.start_time > 0,
    );
    const dayBlocks = teacherAllEntries
      .filter((e) => e.day?.toLowerCase() === entry.day?.toLowerCase())
      .sort((a, b) => a.start_time - b.start_time);

    if (dayBlocks.length <= 1) return false;

    let consecutiveMinutes = dayBlocks[0].end_time - dayBlocks[0].start_time;
    for (let i = 1; i < dayBlocks.length; i++) {
      const prev = dayBlocks[i - 1];
      const curr = dayBlocks[i];
      const gap = curr.start_time - prev.end_time;

      if (gap < 30) {
        consecutiveMinutes += curr.end_time - curr.start_time;
      } else {
        consecutiveMinutes = curr.end_time - curr.start_time;
      }

      if (consecutiveMinutes > 240) return true;
    }
    return false;
  };

  if (error) {
    return (
      <div className="mx-auto mt-12 max-w-lg">
        <Card>
          <div className="py-6 text-center">
            <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-red-400 dark:text-red-500" />
            <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">
              Unable to Load Timetable
            </h3>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              {error}
            </p>
            <Button
              color="gray"
              size="sm"
              onClick={() => router.push("/schedules")}
              className="mx-auto cursor-pointer"
            >
              <HiArrowLeft className="mr-2 h-4 w-4" /> Back to Schedules
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // --- Schedule Not Set / Does Not Exist Error State ---
  if (!isLoading && !scheduleName) {
    return (
      <div className="mx-auto mt-12 max-w-lg">
        <Card>
          <div className="py-6 text-center">
            <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-yellow-400 dark:text-yellow-500" />
            <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">
              Active Schedule Not Set
            </h3>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
                There is currently no active schedule configured for the system.
            </p>
            <Button
              color="gray"
              size="sm"
              onClick={() => router.push("/dashboard")}
              className="mx-auto cursor-pointer"
            >
              <HiArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="scrollbar-track-transparent relative flex scrollbar-thumb-gray-400 overflow-y-auto">
      {/* --- Main Div --- */}
      <div className="scrollbar-track-transparent flex-1 scrollbar-thumb-gray-400 space-y-4 overflow-y-auto p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Button
              color="alternative"
              size="xs"
              onClick={() => router.push("/schedules")}
              className="mb-2 cursor-pointer"
            >
              <HiArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Schedules
            </Button>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Timetable: {scheduleName}
              </h1>
              {unassignedBlocksCount > 0 && (
                <Badge color="warning" size="sm" icon={HiExclamationCircle}>
                  {unassignedBlocksCount} Unassigned Rooms
                </Badge>
              )}
              {unassignedTeacherBlocksCount > 0 && (
                <Badge color="failure" size="sm" icon={HiExclamationTriangle}>
                  {unassignedTeacherBlocksCount} Entr
                  {unassignedTeacherBlocksCount > 1 ? "ies" : "y"} Missing Teachers
                </Badge>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Comprehensive overview of class schedules, rooms, and sections.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 lg:flex-row lg:items-center lg:justify-between dark:border-gray-700 dark:bg-gray-800">
          {/* --- Legend --- */}
          <div className="flex items-center gap-4 text-xs font-medium text-gray-600 dark:text-gray-300">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded border border-blue-300 bg-blue-100 dark:border-blue-700 dark:bg-blue-950"></span>
              <span>Lecture</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded border border-emerald-300 bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950"></span>
              <span>Laboratory</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded border border-violet-300 bg-violet-100 dark:border-violet-700 dark:bg-violet-950"></span>
              <span>Break Periods</span>
            </div>
            <Tooltip
              placement={"bottom"}
              style={`${isDarkMode ? "dark" : "light"}`}
              content={
                "Indicates teachers exceeding 4 hours of consecutive teaching without a 30-minute break."
              }
            >
              <div className="flex cursor-pointer items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded border border-amber-300 bg-amber-100 dark:border-amber-700 dark:bg-amber-950"></span>
                <span>Fatigue Risk</span>
              </div>
            </Tooltip>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded border border-red-300 bg-red-100 dark:border-red-700 dark:bg-red-950"></span>
              <span>Schedule Conflict</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded border border-gray-300 bg-gray-100 opacity-75 dark:border-gray-600 dark:bg-gray-800"></span>
              <span>Other Section / Room</span>
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Section:
              </span>
              <Select
                className="max-h-40 w-full overflow-y-auto sm:w-44"
                value={selectedTimetableSection}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "ALL" && selectedTimetableRoom === "ALL") {
                    return;
                  }
                  setSelectedTimetableSection(val);
                }}
              >
                <option value="ALL">-- All Sections --</option>
                {availableTimetableSections.map((secCode) => (
                  <option key={secCode} value={secCode}>
                    {secCode}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Room:
              </span>
              <Select
                className="max-h-40 w-full overflow-y-auto sm:w-44 [&_select]:max-h-40 [&_select]:overflow-y-auto"
                value={selectedTimetableRoom}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "ALL" && selectedTimetableSection === "ALL") {
                    return;
                  }
                  setSelectedTimetableRoom(val);
                }}
              >
                <option value="ALL">-- All Rooms --</option>
                {allRooms.sort((a, b) => sortAlphanumeric(a.room_name ?? "", b.room_name ?? "")).map((room) => (
                  <option key={room.room_id} value={room.room_name ?? ""}>
                    {room.room_name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {/* --- Timetable Grid Container with Absolute Overlay Layer --- */}
        <div className="relative max-h-150 scrollbar-thumb-gray-400 scrollbar-track-transparent overflow-x-auto overflow-y-auto rounded-xl border border-gray-300 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">

          {/* --- Background Skeleton Table --- */}
          <div className="relative min-w-212.5">
          
          {/* --- ABSOLUTE OVERLAY ENGINE FOR NORMAL BLOCKS, GHOSTS, & CONFLICTS --- */}
          <div className="absolute inset-0 pointer-events-none">
          {(() => {
          const DAY_COLUMNS = [
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
          ];

          const entriesToRender = entries.filter((entry) => {
            if (!entry.day || entry.start_time === undefined || entry.start_time <= 0) {
              return false;
            }
            const matchesSection =
              selectedTimetableSection === "ALL" ||
              entry.section === selectedTimetableSection;
            const matchesRoom =
              selectedTimetableRoom === "ALL" ||
              entry.room_name === selectedTimetableRoom;

            if (matchesSection && matchesRoom) return true;

            // Show ghost entries from same section or room
            const hasSameSection = filteredTimetableEntries.some(
              (e) => e.section.toLowerCase() === entry.section.toLowerCase()
            );
            const hasSameRoom = filteredTimetableEntries.some(
              (e) => e.room_name?.toLowerCase() === entry.room_name?.toLowerCase()
            );

            return hasSameSection || hasSameRoom;
          });

          if (entriesToRender.length === 0) return null;

          return entriesToRender.map((entry) => {
            const dayLower = entry.day.toLowerCase();
            const dayIndex = DAY_COLUMNS.indexOf(dayLower);
            if (dayIndex === -1) return null;

            const durationMins =
              entry.end_time - entry.start_time || entry.originalDuration || 60;
            const topOffsetPx =
              ((entry.start_time - GRID_START_MINS) / 30) * ROW_HEIGHT_PX;
            const heightPx = Math.max(
              ROW_HEIGHT_PX,
              (durationMins / 30) * ROW_HEIGHT_PX,
            );

            const isConflict = hasEntryConflict(entry);
            const isFatigue = checkFatigueRisk(entry);
            const isLabType = entry.type?.toLowerCase() === "laboratory";

            const matchesDirectFilter =
              (selectedTimetableSection === "ALL" || entry.section === selectedTimetableSection) &&
              (selectedTimetableRoom === "ALL" || entry.room_name === selectedTimetableRoom);
            const isGhost = !matchesDirectFilter;

            let blockStyle = "bg-blue-50/90 text-blue-950 border-blue-300 dark:bg-blue-950/80 dark:text-blue-200 dark:border-blue-700";
            let zIndexClass = "z-10";

            if (isConflict) {
              blockStyle = "bg-red-100 text-red-950 border-red-500 dark:bg-red-950/90 dark:text-red-100 dark:border-red-600 shadow-lg";
              zIndexClass = "z-20";
            } else if (isFatigue) {
              blockStyle = "bg-amber-100 text-amber-950 border-amber-400 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700";
            } else if (isLabType) {
              blockStyle = "bg-emerald-50/90 text-emerald-950 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700";
            }

            if (isGhost) {
              blockStyle = "bg-gray-100 text-gray-500 border-gray-300 opacity-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700";
              zIndexClass = "z-5";
            }

            return (
              <div
                key={entry.schedule_entry_id}
                className={`absolute flex flex-col overflow-hidden rounded border p-2 backdrop-blur-xs ${zIndexClass} ${blockStyle}`}
                style={{
                  top: `${topOffsetPx + 45}px`,
                  left: `calc(96px + (${dayIndex} * ((100% - 96px) / 6)))`,
                  width: `calc((100% - 96px) / 6 - 6px)`,
                  height: `${heightPx - 4}px`,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="truncate text-xs font-bold">
                    {generateSubjectAbv(entry.course_name)}
                  </div>
                </div>
                <div className="truncate text-[10px] font-medium opacity-90">
                  {entry.course_name} {isGhost ? "(Other Section/Room)" : ""}
                </div>
                <div className="mt-auto space-y-0.5 text-[10px] font-semibold opacity-90">
                  <div className={"text-xs"}>
                    Teacher: {entry.teacher_code || "Unassigned"}
                  </div>
                  <div className={"text-xs"}>Sec: {entry.section}</div>
                  <div className={"text-xs"}>
                    Room: {entry.room_name || "TBA"}
                  </div>
                  <div className="font-mono">
                    {formatTime(entry.start_time)} -{" "}
                    {formatTime(entry.end_time)}
                  </div>
                </div>
              </div>
            );
          });
        })()}
          </div>

          <table className="w-full border-collapse text-left text-xs pointer-events-auto" style={{ tableLayout: "fixed" }}>
          <thead>
          <tr className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <th className="sticky left-0 z-5 w-24 border-r border-b bg-gray-100 p-3 text-center font-bold dark:bg-gray-800">
              Time
            </th>
            {daysOfWeek.map((day) => (
              <th
                key={day}
                className="min-w-30 border-r border-b p-3 text-center font-bold"
              >
                <span className="sm:hidden">
                  {day.substring(0, 3).toUpperCase()}
                </span>
                <span className="hidden sm:inline">
                  {day.toUpperCase()}
                </span>
              </th>
            ))}
          </tr>
          </thead>
            <tbody>
            {timeSlotsGrid.map((timeSlot, tIdx) => {
              const slotTotalMins = timeStrToMinutes(timeSlot);

              return (
                <tr key={tIdx} className="h-11 border-b dark:border-gray-800">
                  <td className="sticky left-0 z-5 w-24 border-r bg-gray-50 p-2 text-center font-mono text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    {timeSlot}
                  </td>
                  {daysOfWeek.map((day) => {
                    const matchedBreak = expandedBreaks.find((bp) => {
                      if (bp.day.toLowerCase() !== day.toLowerCase())
                        return false;
                      return (
                        slotTotalMins >= bp.start_time &&
                        slotTotalMins < bp.end_time
                      );
                    });

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
                          slotTotalMins === matchedBreak.start_time && (
                            <div
                              className="absolute inset-1.5 z-5 flex flex-col items-center justify-center overflow-hidden rounded bg-violet-100/90 p-1 text-center shadow-xs dark:bg-violet-900/80"
                              style={{
                                height: `${((matchedBreak.end_time - matchedBreak.start_time) / 30) * ROW_HEIGHT_PX - 12}px`,
                              }}
                            >
                              <div className="flex w-full justify-center space-x-2 truncate text-[10px] font-bold text-violet-900 dark:text-violet-100">
                                <GiCoffeeCup />
                                <div>{matchedBreak.break_description}</div>
                              </div>
                              <div className="font-mono text-[9px] text-violet-700 dark:text-violet-300">
                                {formatTime(matchedBreak.start_time)} -{" "}
                                {formatTime(matchedBreak.end_time)}
                              </div>
                            </div>
                          )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Schedule Not Found Modal */}
      <Modal
        show={!scheduleExists && !isLoading}
        size="md"
        onClose={() => {}}
        popup
      >
        <ModalHeader />
        <ModalBody>
          <div className="text-center">
            <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-red-400 dark:text-red-500" />
            <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">
              Schedule Not Found
            </h3>
            <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
              The schedule <span className="font-semibold">{scheduleName}</span>{" "}
              does not exist or may have been deleted.
            </p>
            <div className="flex justify-center">
              <button
                className="flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                onClick={() => router.push("/schedules")}
              >
                <HiArrowLeft className="mr-1.5 h-4 w-4" /> Back to Schedules
              </button>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </div>
  );
}