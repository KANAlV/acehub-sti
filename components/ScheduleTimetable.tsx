"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  ButtonGroup,
  Card,
  Modal,
  ModalBody,
  ModalHeader,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  Select,
  Accordion,
  AccordionPanel,
  AccordionTitle,
  AccordionContent,
  Badge,
} from "flowbite-react";
import {
  HiArrowLeft,
  HiOutlineExternalLink,
  HiOutlineExclamationCircle,
  HiPencil,
  HiX,
  HiRefresh,
  HiLocationMarker,
} from "react-icons/hi";
import { FaCalendarDay, FaList } from "react-icons/fa6";
import { FaCoffee } from "react-icons/fa";
import {
  fetchScheduleByName,
  fetchTimetableEntriesByScheduleId,
  fetchBreakPeriods,
  fetchBreakPeriodsCount,
  fetchSubjectsUnitsByIds,
  TimetableEntryRecord,
  SubjectUnitsRecord,
} from "@/app/actions/system";

interface ScheduleTimetableClientProps {
  scheduleName: string;
}

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

interface DragPayload {
  type: "new" | "existing";
  scheduleEntryId?: string;
  courseCode?: string;
  courseName?: string;
  section: string;
  roomName?: string | null;
  subjectId?: string | null;
  roomId?: string | null;
  teacherId?: string | null;
  entryType?: string;
  duration?: number;
  originalDay?: string;
  originalStartTime?: number;
  originalEndTime?: number;
}

export default function ScheduleTimetableClient({
  scheduleName,
}: ScheduleTimetableClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  // --- Staging States for Local Edits --- //
  const [originalEntries, setOriginalEntries] = useState<LocalTimetableEntry[]>(
    [],
  );
  const [changedSchedules, setChangedSchedules] = useState<
    LocalTimetableEntry[]
  >([]);

  const [error, setError] = useState<string | null>(null);
  const [scheduleID, setScheduleID] = useState<string | null>(null);
  const [scheduleExists, setScheduleExists] = useState<boolean>(true);

  // --- Edit Mode & Sidepanel State --- //
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [conflictModalData, setConflictModalData] = useState<{
    show: boolean;
    message: string;
  }>({ show: false, message: "" });

  // --- Dragging State & Highlight --- //
  const [draggedEntryId, setDraggedEntryId] = useState<string | null>(null);
  const [dragSourceInfo, setDragSourceInfo] = useState<{
    day: string;
    start_time: number;
    duration: number;
    course_code: string;
  } | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{
    day: string;
    timeSlot: string;
    duration: number;
  } | null>(null);

  // --- Break Periods State --- //
  const [breakPeriods, setBreakPeriods] = useState<BreakPeriodRecord[]>([]);
  const [breakPeriodCount, setBreakPeriodCount] = useState(0);

  // --- Display & Filter States --- //
  const [displayFormat, setDisplayFormat] = useState<"timetable" | "table">(
    "timetable",
  );
  const [selectedTimetableSection, setSelectedTimetableSection] =
    useState<string>("ALL");
  const [selectedTimetableRoom, setSelectedTimetableRoom] =
    useState<string>("ALL");

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

  // 12-hour format time slots grid (7:00 AM to 8:30 PM in 30-minute increments)
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
  ];

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
        limit,
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

  useEffect(() => {
    void getBreakPeriods();
  }, [getBreakPeriods]);

  // 1. Fetch schedule ID by name on mount
  useEffect(() => {
    document.title = "AceHub | Timetable";

    async function fetchScheduleData() {
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

  // 2. Fetch timetable entries and official subject units once scheduleID is resolved
  useEffect(() => {
    async function loadTimetableEntries() {
      if (!scheduleID) return;
      setIsLoading(true);
      try {
        const res = await fetchTimetableEntriesByScheduleId(scheduleID);
        if (res.success && res.data) {
          const loadedData = res.data as LocalTimetableEntry[];

          // Extract unique subject IDs (no duplicates)
          const uniqueSubjectIds = Array.from(
            new Set(
              loadedData
                .map((e) => e.subject_id)
                .filter((id): id is string => Boolean(id)),
            ),
          );

          // Fetch official unit mappings for all unique subjects
          const unitsMap = new Map<
            string,
            { lecture_units: number; lab_units: number }
          >();
          if (uniqueSubjectIds.length > 0) {
            const unitsRes = await fetchSubjectsUnitsByIds(uniqueSubjectIds);
            if (unitsRes.success && unitsRes.data) {
              unitsRes.data.forEach((subjRecord: SubjectUnitsRecord) => {
                unitsMap.set(subjRecord.subject_id, {
                  lecture_units: subjRecord.lecture_units || 0,
                  lab_units: subjRecord.lab_units || 0,
                });
              });
            }
          }

          // Map database records directly, using their type and respective unit duration
          const processedData = loadedData.map((entry) => {
            let computedDuration = 60; // default fallback
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

          setOriginalEntries(processedData);
          setChangedSchedules(processedData);
          setError(null);

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

  // Discard changes action
  const handleDiscardChanges = () => {
    setChangedSchedules(originalEntries);
    setDragSourceInfo(null);
    setDraggedEntryId(null);
  };

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

    return expanded;
  };

  const expandedBreaks = getExpandedBreaks();

  // Filter active/placed entries for grid display
  const filteredTimetableEntries = changedSchedules.filter((entry) => {
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

  const availableTimetableSections = Array.from(
    new Set(originalEntries.map((e) => e.section).filter(Boolean)),
  );
  const availableTimetableRooms = Array.from(
    new Set(
      originalEntries
        .map((e) => e.room_name)
        .filter((r): r is string => Boolean(r)),
    ),
  );

  // --- Unassign / Return to Sidebar Handler --- //
  const handleUnassignEntry = (scheduleEntryId: string) => {
    setChangedSchedules(
      (prev) =>
        prev.map((e) => {
          if (e.schedule_entry_id === scheduleEntryId) {
            return {
              ...e,
              day: "",
              start_time: 0,
              end_time: 0,
            };
          }
          return e;
        }) as LocalTimetableEntry[],
    );
  };

  // --- Drag and Drop Conflict Verification & Break Check --- //
  const handleDropToSlot = (
    targetDay: string,
    targetTimeSlot: string,
    droppedData: DragPayload,
  ) => {
    setDragOverCell(null);
    setDraggedEntryId(null);
    setDragSourceInfo(null);
    const targetStartMins = timeStrToMinutes(targetTimeSlot);

    const targetEntryId = droppedData.scheduleEntryId;
    let duration = droppedData.duration || 60;

    const activeRoom =
      selectedTimetableRoom !== "ALL"
        ? selectedTimetableRoom
        : droppedData.roomName;

    if (targetEntryId) {
      const match = changedSchedules.find(
        (e) => e.schedule_entry_id === targetEntryId,
      );
      if (match && match.originalDuration) {
        duration = match.originalDuration;
      }
    }

    const targetEndMins = targetStartMins + duration;

    // Check 0: Break Period Interruption Check
    const breakConflict = expandedBreaks.find((bp) => {
      if (bp.day.toLowerCase() !== targetDay.toLowerCase()) return false;
      return targetStartMins < bp.end_time && targetEndMins > bp.start_time;
    });

    if (breakConflict) {
      if (
        droppedData.type === "existing" &&
        targetEntryId &&
        droppedData.originalDay
      ) {
        setChangedSchedules(
          (prev) =>
            prev.map((e) => {
              if (e.schedule_entry_id === targetEntryId) {
                return {
                  ...e,
                  day: droppedData.originalDay!,
                  start_time: droppedData.originalStartTime!,
                  end_time: droppedData.originalEndTime!,
                };
              }
              return e;
            }) as LocalTimetableEntry[],
        );
      }

      setConflictModalData({
        show: true,
        message: `Scheduling Conflict: Cannot place classes during break period [${breakConflict.break_description}] (${formatTime(breakConflict.start_time)} - ${formatTime(breakConflict.end_time)}).`,
      });
      return;
    }

    // Check 0.5: Ghost / Overlapping Room Entry Check (Grayed-out blocks from other sections in the same room)
    const ghostOverlapConflict = changedSchedules.find((entry) => {
      if (!entry.day || entry.start_time <= 0) return false;
      if (entry.day.toLowerCase() !== targetDay.toLowerCase()) return false;
      if (
        droppedData.scheduleEntryId &&
        entry.schedule_entry_id === droppedData.scheduleEntryId
      )
        return false;

      const matchesActiveRoom =
        selectedTimetableRoom !== "ALL" &&
        entry.room_name?.toLowerCase() === selectedTimetableRoom.toLowerCase();
      const matchesDraggedRoom =
        droppedData.roomName &&
        entry.room_name?.toLowerCase() === droppedData.roomName.toLowerCase();

      // If it's in the same room and not part of the currently filtered active view section
      if (
        (matchesActiveRoom || matchesDraggedRoom) &&
        entry.section.toLowerCase() !== droppedData.section.toLowerCase()
      ) {
        return (
          targetStartMins < entry.end_time && targetEndMins > entry.start_time
        );
      }
      return false;
    });

    if (ghostOverlapConflict) {
      if (
        droppedData.type === "existing" &&
        targetEntryId &&
        droppedData.originalDay
      ) {
        setChangedSchedules(
          (prev) =>
            prev.map((e) => {
              if (e.schedule_entry_id === targetEntryId) {
                return {
                  ...e,
                  day: droppedData.originalDay!,
                  start_time: droppedData.originalStartTime!,
                  end_time: droppedData.originalEndTime!,
                };
              }
              return e;
            }) as LocalTimetableEntry[],
        );
      }

      setConflictModalData({
        show: true,
        message: `Scheduling Conflict: Room is already occupied by another section's class block [Section ${ghostOverlapConflict.section} - ${ghostOverlapConflict.course_code}] (${formatTime(ghostOverlapConflict.start_time)} - ${formatTime(ghostOverlapConflict.end_time)}).`,
      });
      return;
    }

    // Check 1: Direct Block Overlap Check (Acts like dropping on a break period)
    const blockOverlapConflict = changedSchedules.find((e) => {
      if (!e.day || e.start_time <= 0) return false;
      if (e.day.toLowerCase() !== targetDay.toLowerCase()) return false;
      // Exclude the item being moved itself
      if (
        droppedData.scheduleEntryId &&
        e.schedule_entry_id === droppedData.scheduleEntryId
      )
        return false;

      return targetStartMins < e.end_time && targetEndMins > e.start_time;
    });

    if (blockOverlapConflict) {
      if (
        droppedData.type === "existing" &&
        targetEntryId &&
        droppedData.originalDay
      ) {
        setChangedSchedules(
          (prev) =>
            prev.map((e) => {
              if (e.schedule_entry_id === targetEntryId) {
                return {
                  ...e,
                  day: droppedData.originalDay!,
                  start_time: droppedData.originalStartTime!,
                  end_time: droppedData.originalEndTime!,
                };
              }
              return e;
            }) as LocalTimetableEntry[],
        );
      }

      setConflictModalData({
        show: true,
        message: `Scheduling Conflict: Time slot is already occupied by another class block [${blockOverlapConflict.course_code}: ${blockOverlapConflict.course_name}] (${formatTime(blockOverlapConflict.start_time)} - ${formatTime(blockOverlapConflict.end_time)}).`,
      });
      return;
    }

    // Conflict Check 1: Same section occupied at target time
    const sectionConflict = changedSchedules.find((e) => {
      if (!e.day || e.start_time <= 0) return false;
      if (
        droppedData.scheduleEntryId &&
        e.schedule_entry_id === droppedData.scheduleEntryId
      )
        return false;
      if (e.section.toLowerCase() !== droppedData.section.toLowerCase())
        return false;
      if (e.day.toLowerCase() !== targetDay.toLowerCase()) return false;

      return targetStartMins < e.end_time && targetEndMins > e.start_time;
    });

    if (sectionConflict) {
      if (
        droppedData.type === "existing" &&
        targetEntryId &&
        droppedData.originalDay
      ) {
        setChangedSchedules(
          (prev) =>
            prev.map((e) => {
              if (e.schedule_entry_id === targetEntryId) {
                return {
                  ...e,
                  day: droppedData.originalDay!,
                  start_time: droppedData.originalStartTime!,
                  end_time: droppedData.originalEndTime!,
                };
              }
              return e;
            }) as LocalTimetableEntry[],
        );
      }

      setConflictModalData({
        show: true,
        message: `Conflict Detected: Section [${droppedData.section}] is already occupied by ${sectionConflict.course_code} (${sectionConflict.course_name}) on ${targetDay} from ${formatTime(sectionConflict.start_time)} to ${formatTime(sectionConflict.end_time)}.`,
      });
      return;
    }

    // Conflict Check 2: Same room occupied at target time
    if (activeRoom && activeRoom !== "ALL") {
      const roomConflict = changedSchedules.find((e) => {
        if (!e.day || e.start_time <= 0) return false;
        if (
          droppedData.scheduleEntryId &&
          e.schedule_entry_id === droppedData.scheduleEntryId
        )
          return false;
        if (
          !e.room_name ||
          e.room_name.toLowerCase() !== activeRoom.toLowerCase()
        )
          return false;
        if (e.day.toLowerCase() !== targetDay.toLowerCase()) return false;

        return targetStartMins < e.end_time && targetEndMins > e.start_time;
      });

      if (roomConflict) {
        if (
          droppedData.type === "existing" &&
          targetEntryId &&
          droppedData.originalDay
        ) {
          setChangedSchedules(
            (prev) =>
              prev.map((e) => {
                if (e.schedule_entry_id === targetEntryId) {
                  return {
                    ...e,
                    day: droppedData.originalDay!,
                    start_time: droppedData.originalStartTime!,
                    end_time: droppedData.originalEndTime!,
                  };
                }
                return e;
              }) as LocalTimetableEntry[],
          );
        }

        setConflictModalData({
          show: true,
          message: `Conflict Detected: Room [${activeRoom}] is already occupied by section ${roomConflict.section} (${roomConflict.course_code}) on ${targetDay} from ${formatTime(roomConflict.start_time)} to ${formatTime(roomConflict.end_time)}.`,
        });
        return;
      }
    }

    if (targetEntryId) {
      setChangedSchedules(
        (prev) =>
          prev.map((e) => {
            if (e.schedule_entry_id === targetEntryId) {
              return {
                ...e,
                day: targetDay,
                start_time: targetStartMins,
                end_time: targetStartMins + duration,
                originalDuration: duration,
                room_name:
                  selectedTimetableRoom !== "ALL"
                    ? selectedTimetableRoom
                    : e.room_name,
              };
            }
            return e;
          }) as LocalTimetableEntry[],
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3">
        <Spinner size="xl" />
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Loading timetable for {scheduleName}...
        </span>
      </div>
    );
  }

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

  return (
    <div className="relative flex gap-6">
      {/* Main Timetable Content Container */}
      <div className="flex-1 space-y-6">
        {/* Top Header & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Button
              color="alternative"
              size="xs"
              onClick={() => router.push(`/schedules/${scheduleName}`)}
              className="mb-2 cursor-pointer"
            >
              <HiArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Schedules
            </Button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Timetable: {scheduleName}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Comprehensive overview of class schedules, rooms, and sections.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              color={isEditMode ? "failure" : "purple"}
              size="sm"
              className="cursor-pointer"
              onClick={() => setIsEditMode(!isEditMode)}
            >
              <HiPencil className="mr-1.5 h-4 w-4" />
              {isEditMode ? "Close Editor" : "Edit Timetable"}
            </Button>
            <Button
              color="blue"
              size="sm"
              className="cursor-pointer bg-cyan-600 text-white hover:bg-cyan-700"
            >
              <HiOutlineExternalLink className="mr-1.5 h-4 w-4" />
              Export Timetable
            </Button>
          </div>
        </div>

        {/* Discard Changes Bar */}
        {JSON.stringify(changedSchedules) !==
          JSON.stringify(originalEntries) && (
          <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 shadow-sm dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <span className="font-medium">
              You have unsaved changes in this session.
            </span>
            <Button
              color="alternative"
              size="xs"
              onClick={handleDiscardChanges}
              className="flex items-center gap-1 border-amber-300 bg-white hover:bg-amber-100 dark:border-amber-700 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              <HiRefresh className="h-3.5 w-3.5" /> Discard Changes
            </Button>
          </div>
        )}

        {/* Legend & Controls Bar */}
        <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 lg:flex-row lg:items-center lg:justify-between dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                View:
              </span>
              <ButtonGroup>
                <Button
                  color="alternative"
                  size="sm"
                  className={`cursor-pointer ${displayFormat === "timetable" ? "bg-gray-200 font-bold dark:bg-gray-700" : ""}`}
                  onClick={() => setDisplayFormat("timetable")}
                  title="Timetable Grid View"
                >
                  <FaCalendarDay className="h-4 w-4" />
                </Button>
                <Button
                  color="alternative"
                  size="sm"
                  className={`cursor-pointer ${displayFormat === "table" ? "bg-gray-200 font-bold dark:bg-gray-700" : ""}`}
                  onClick={() => setDisplayFormat("table")}
                  title="Row Table View"
                >
                  <FaList className="h-4 w-4" />
                </Button>
              </ButtonGroup>
            </div>

            {/* Timetable Legend */}
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
                <span className="inline-block h-3 w-3 rounded border border-amber-300 bg-amber-100 dark:border-amber-700 dark:bg-amber-950"></span>
                <span>Break Periods</span>
              </div>
            </div>
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Section:
              </span>
              <Select
                className="w-full sm:w-44"
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
                className="w-full sm:w-44"
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
                {availableTimetableRooms.map((roomName) => (
                  <option key={roomName} value={roomName}>
                    {roomName}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {/* Main Display Container */}
        {displayFormat === "timetable" ? (
          <div className="max-h-150 scrollbar-thumb-gray-400 scrollbar-track-transparent overflow-x-auto overflow-y-auto rounded-xl border border-gray-300 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  <th className="sticky left-0 z-10 w-24 border-r border-b bg-gray-100 p-3 text-center font-bold dark:bg-gray-800">
                    Time
                  </th>
                  {daysOfWeek.map((day) => (
                    <th
                      key={day}
                      className="border-r border-b p-3 text-center font-bold"
                    >
                      {day.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlotsGrid.map((timeSlot, tIdx) => {
                  const slotTotalMins = timeStrToMinutes(timeSlot);

                  return (
                    <tr key={tIdx} className="border-b dark:border-gray-800">
                      <td className="sticky left-0 z-10 border-r bg-gray-50 p-2 text-center font-mono text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        {timeSlot}
                      </td>
                      {daysOfWeek.map((day) => {
                        const matchedEntry = filteredTimetableEntries.find(
                          (entry) => {
                            if (entry.day.toLowerCase() !== day.toLowerCase())
                              return false;
                            const entryStartStr = formatMinutesToTimeStr(
                              entry.start_time,
                            );
                            return entryStartStr === timeSlot;
                          },
                        );

                        const ghostEntry = !matchedEntry
                          ? changedSchedules.find((entry) => {
                              if (!entry.day || entry.start_time <= 0)
                                return false;
                              if (entry.day.toLowerCase() !== day.toLowerCase())
                                return false;
                              const entryStartStr = formatMinutesToTimeStr(
                                entry.start_time,
                              );
                              if (entryStartStr !== timeSlot) return false;

                              // Exclude the item currently being dragged
                              if (
                                draggedEntryId &&
                                entry.schedule_entry_id === draggedEntryId
                              ) {
                                return false;
                              }

                              // Check if it belongs to the same section as the item being dragged
                              const draggedEntry = changedSchedules.find(
                                (e) => e.schedule_entry_id === draggedEntryId,
                              );
                              const isSameSection =
                                draggedEntry &&
                                entry.section.toLowerCase() ===
                                  draggedEntry.section.toLowerCase();

                              const matchesActiveRoom =
                                selectedTimetableRoom !== "ALL" &&
                                entry.room_name?.toLowerCase() ===
                                  selectedTimetableRoom.toLowerCase();

                              return isSameSection || matchesActiveRoom;
                            })
                          : null;

                        const displayEntry = matchedEntry || ghostEntry;

                        // Check if this cell is the original source slot of the currently dragged block
                        const isDragSource =
                          dragSourceInfo &&
                          dragSourceInfo.day.toLowerCase() ===
                            day.toLowerCase() &&
                          formatMinutesToTimeStr(dragSourceInfo.start_time) ===
                            timeSlot;

                        if (isDragSource) {
                          const srcDuration = dragSourceInfo.duration || 60;
                          const srcRowSpan = Math.max(
                            1,
                            Math.round(srcDuration / 30),
                          );
                          const srcHeightPx = srcRowSpan * 42;

                          return (
                            <td
                              key={day}
                              rowSpan={srcRowSpan}
                              style={{
                                height: `${srcHeightPx}px`,
                                position: "relative",
                              }}
                              className="border-r border-dashed border-cyan-400 bg-cyan-50/50 p-2 text-center align-middle dark:bg-cyan-950/20"
                            >
                              <div
                                className="absolute inset-1.5 flex flex-col items-center justify-center gap-1 rounded border border-dashed border-cyan-300 bg-cyan-100/40 p-2 text-center text-[10px] font-semibold text-cyan-700 dark:border-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300"
                                style={{ height: `${srcHeightPx - 12}px` }}
                              >
                                <HiLocationMarker className="h-4 w-4 animate-bounce" />
                                <span>Original Position</span>
                              </div>
                            </td>
                          );
                        }

                        if (displayEntry) {
                          const durationMins =
                            displayEntry.end_time - displayEntry.start_time ||
                            displayEntry.originalDuration ||
                            60;

                          const rowSpan = Math.max(
                            1,
                            Math.round(durationMins / 30),
                          );
                          const blockHeightPx = rowSpan * 42;

                          const isGhost = !matchedEntry && !!ghostEntry;
                          const isLabType =
                            displayEntry.type?.toLowerCase() === "laboratory";

                          let blockStyle =
                            "bg-blue-50/80 text-blue-950 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800";
                          if (isGhost) {
                            blockStyle =
                              "bg-gray-100 text-gray-400 border-gray-200 opacity-50 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700";
                          } else if (isLabType) {
                            blockStyle =
                              "bg-emerald-50/80 text-emerald-950 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800";
                          }

                          const scheduleEntryId =
                            displayEntry.schedule_entry_id;

                          return (
                            <td
                              key={day}
                              rowSpan={rowSpan}
                              style={{
                                height: `${blockHeightPx}px`,
                                position: "relative",
                              }}
                              draggable={isEditMode && !isGhost}
                              onDragStart={(e) => {
                                setDraggedEntryId(scheduleEntryId);
                                setDragSourceInfo({
                                  day: displayEntry.day,
                                  start_time: displayEntry.start_time,
                                  duration: durationMins,
                                  course_code: displayEntry.course_code,
                                });
                                if (displayEntry.room_name) {
                                  setSelectedTimetableRoom(
                                    displayEntry.room_name,
                                  );
                                }
                                handleUnassignEntry(scheduleEntryId);

                                // Create a cleanly isolated drag preview element (completely independent of dashboard containers)
                                const dragPreview =
                                  document.createElement("div");
                                dragPreview.style.position = "absolute";
                                dragPreview.style.top = "-9999px";
                                dragPreview.style.left = "-9999px";
                                dragPreview.style.width = `${e.currentTarget.clientWidth}px`;
                                dragPreview.style.height = `${blockHeightPx - 12}px`;
                                dragPreview.className = `flex flex-col gap-1 rounded p-2 shadow-lg font-sans ${
                                  isLabType
                                    ? "bg-emerald-100 text-emerald-950 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-700"
                                    : "bg-blue-100 text-blue-950 border border-blue-300 dark:bg-blue-950 dark:text-blue-100 dark:border-blue-700"
                                }`;

                                dragPreview.innerHTML = `
                                  <div>
                                    <div class="flex items-center justify-between">
                                      <div class="text-xs font-bold truncate">${displayEntry.course_name}</div>
                                      <span class="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                        isLabType
                                          ? "bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200"
                                          : "bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-200"
                                      }">${displayEntry.type || "Lecture"}</span>
                                    </div>
                                    <div class="text-[10px] font-medium opacity-80 truncate">${displayEntry.course_code}</div>
                                  </div>
                                  <div class="space-y-0.5 text-[10px] font-semibold opacity-90">
                                    <div>Sec: ${displayEntry.section}</div>
                                    <div>Room: ${displayEntry.room_name || "TBA"}</div>
                                    <div class="font-mono">${formatTime(displayEntry.start_time)} - ${formatTime(displayEntry.end_time)}</div>
                                  </div>
                                `;

                                document.body.appendChild(dragPreview);
                                if (e.dataTransfer.setDragImage) {
                                  e.dataTransfer.setDragImage(
                                    dragPreview,
                                    20,
                                    20,
                                  );
                                }
                                setTimeout(() => {
                                  document.body.removeChild(dragPreview);
                                }, 0);

                                e.dataTransfer.setData(
                                  "text/plain",
                                  JSON.stringify({
                                    type: "existing",
                                    scheduleEntryId: scheduleEntryId,
                                    section: displayEntry.section,
                                    roomName: displayEntry.room_name,
                                    subjectId: displayEntry.subject_id,
                                    roomId: displayEntry.room_id,
                                    teacherId: displayEntry.teacher_id,
                                    entryType: displayEntry.type,
                                    duration: durationMins,
                                    originalDay: displayEntry.day,
                                    originalStartTime: displayEntry.start_time,
                                    originalEndTime: displayEntry.end_time,
                                  } as DragPayload),
                                );
                              }}
                              onDragEnd={() => {
                                setDraggedEntryId(null);
                                setDragSourceInfo(null);
                                setDragOverCell(null);
                              }}
                              onDragOver={(e) => {
                                if (isGhost) {
                                  e.preventDefault();
                                  const dragDuration = durationMins;
                                  if (
                                    !dragOverCell ||
                                    dragOverCell.day !== day ||
                                    dragOverCell.timeSlot !== timeSlot
                                  ) {
                                    setDragOverCell({
                                      day,
                                      timeSlot,
                                      duration: dragDuration,
                                    });
                                  }
                                }
                              }}
                              onDrop={(e) => {
                                if (isGhost) {
                                  e.preventDefault();
                                  const rawData =
                                    e.dataTransfer.getData("text/plain");
                                  if (!rawData) return;
                                  try {
                                    const parsed = JSON.parse(
                                      rawData,
                                    ) as DragPayload;
                                    handleDropToSlot(day, timeSlot, parsed);
                                  } catch (err) {
                                    console.error("Drop parse error", err);
                                  }
                                }
                              }}
                              className={`border-r p-0 align-top ${blockStyle} border font-sans ${isEditMode && !isGhost ? "cursor-grab active:cursor-grabbing" : ""}`}
                            >
                              <div
                                className="schedule-block-inner absolute inset-1.5 flex flex-col gap-1 overflow-hidden rounded bg-inherit p-2 shadow-xs"
                                style={{ height: `${blockHeightPx - 12}px` }}
                              >
                                {isEditMode && !isGhost && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUnassignEntry(scheduleEntryId);
                                    }}
                                    title="Unassign / Return to Sidebar"
                                    className="absolute top-1 right-1 z-20 rounded-full bg-red-100 p-0.5 text-red-600 hover:bg-red-200 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
                                  >
                                    <HiX className="h-3.5 w-3.5" />
                                  </button>
                                )}

                                {/* Header: Course name & Type badge */}
                                <div>
                                  <div className="flex items-center justify-between pr-4">
                                    <div className="truncate text-xs font-bold text-gray-900 dark:text-white">
                                      {displayEntry.course_name}
                                    </div>
                                    <span
                                      className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${isLabType ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"}`}
                                    >
                                      {displayEntry.type || "Lecture"}
                                    </span>
                                  </div>
                                  <div className="truncate text-[10px] font-medium text-gray-600 dark:text-gray-300">
                                    {displayEntry.course_code}{" "}
                                    {isGhost && "(Other Section/Room)"}
                                  </div>
                                </div>

                                {/* Details right below subject code */}
                                <div className="space-y-0.5 text-[10px] font-semibold text-gray-700 dark:text-gray-300">
                                  <div>Sec: {displayEntry.section}</div>
                                  <div>
                                    Room: {displayEntry.room_name || "TBA"}
                                  </div>
                                  <div className="font-mono">
                                    {formatTime(displayEntry.start_time)} -{" "}
                                    {formatTime(displayEntry.end_time)}
                                  </div>
                                </div>
                              </div>
                            </td>
                          );
                        }

                        // Check for Break Period Entry
                        const matchedBreak = expandedBreaks.find((bp) => {
                          if (bp.day.toLowerCase() !== day.toLowerCase())
                            return false;
                          const breakStartStr = formatMinutesToTimeStr(
                            bp.start_time,
                          );
                          return breakStartStr === timeSlot;
                        });

                        if (matchedBreak) {
                          const durationMins =
                            matchedBreak.end_time - matchedBreak.start_time;
                          const rowSpan = Math.max(
                            1,
                            Math.round(durationMins / 30),
                          );
                          const breakHeightPx = rowSpan * 42;
                          const breakStyle =
                            "bg-amber-50/80 text-amber-950 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800";

                          return (
                            <td
                              key={day}
                              rowSpan={rowSpan}
                              style={{
                                height: `${breakHeightPx}px`,
                                position: "relative",
                              }}
                              className={`border-r p-0 align-top ${breakStyle} border font-sans`}
                            >
                              <div
                                className="absolute inset-1.5 flex flex-col items-center justify-center overflow-hidden rounded bg-inherit p-2 text-center shadow-xs"
                                style={{ height: `${breakHeightPx - 12}px` }}
                              >
                                <FaCoffee className="mb-1 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                <div className="w-full truncate text-xs font-bold text-amber-900 dark:text-amber-100">
                                  {matchedBreak.break_description}
                                </div>
                                <div className="mt-1 font-mono text-[10px] text-amber-700 dark:text-amber-300">
                                  {formatTime(matchedBreak.start_time)} -{" "}
                                  {formatTime(matchedBreak.end_time)}
                                </div>
                              </div>
                            </td>
                          );
                        }

                        const isCoveredByClass = filteredTimetableEntries.some(
                          (entry) => {
                            if (entry.day.toLowerCase() !== day.toLowerCase())
                              return false;
                            return (
                              slotTotalMins > entry.start_time &&
                              slotTotalMins < entry.end_time
                            );
                          },
                        );

                        const isCoveredByGhost = changedSchedules.some(
                          (entry) => {
                            if (!entry.day || entry.start_time <= 0)
                              return false;
                            if (entry.day.toLowerCase() !== day.toLowerCase())
                              return false;
                            if (
                              draggedEntryId &&
                              entry.schedule_entry_id === draggedEntryId
                            ) {
                              return false;
                            }
                            const draggedEntry = changedSchedules.find(
                              (e) => e.schedule_entry_id === draggedEntryId,
                            );
                            const isSameSection =
                              draggedEntry &&
                              entry.section.toLowerCase() ===
                                draggedEntry.section.toLowerCase();

                            const matchesActiveRoom =
                              selectedTimetableRoom !== "ALL" &&
                              entry.room_name?.toLowerCase() ===
                                selectedTimetableRoom.toLowerCase();
                            return (
                              (isSameSection || matchesActiveRoom) &&
                              slotTotalMins > entry.start_time &&
                              slotTotalMins < entry.end_time
                            );
                          },
                        );

                        // Also check if covered by drag source span
                        const isCoveredByDragSource =
                          dragSourceInfo &&
                          dragSourceInfo.day.toLowerCase() ===
                            day.toLowerCase() &&
                          slotTotalMins > dragSourceInfo.start_time &&
                          slotTotalMins <
                            dragSourceInfo.start_time + dragSourceInfo.duration;

                        const isCoveredByBreak = expandedBreaks.some((bp) => {
                          if (bp.day.toLowerCase() !== day.toLowerCase())
                            return false;
                          return (
                            slotTotalMins > bp.start_time &&
                            slotTotalMins < bp.end_time
                          );
                        });

                        if (
                          isCoveredByClass ||
                          isCoveredByGhost ||
                          isCoveredByDragSource ||
                          isCoveredByBreak
                        ) {
                          return null;
                        }

                        let isHighlighted = false;
                        if (
                          dragOverCell &&
                          dragOverCell.day.toLowerCase() === day.toLowerCase()
                        ) {
                          const hoverStartMins = timeStrToMinutes(
                            dragOverCell.timeSlot,
                          );
                          const hoverDuration = dragOverCell.duration || 60;
                          const hoverEndMins = hoverStartMins + hoverDuration;

                          if (
                            slotTotalMins >= hoverStartMins &&
                            slotTotalMins < hoverEndMins
                          ) {
                            isHighlighted = true;
                          }
                        }

                        return (
                          <td
                            key={day}
                            onDragOver={(e) => {
                              e.preventDefault();
                              let dragDuration = 60;

                              try {
                                const raw =
                                  e.dataTransfer.getData("text/plain");
                                if (raw) {
                                  const parsed = JSON.parse(raw);
                                  if (parsed.duration)
                                    dragDuration = parsed.duration;
                                } else if (draggedEntryId) {
                                  const foundEntry = changedSchedules.find(
                                    (e) =>
                                      e.schedule_entry_id === draggedEntryId,
                                  );
                                  if (foundEntry?.originalDuration) {
                                    dragDuration = foundEntry.originalDuration;
                                  }
                                }
                              } catch (err) {
                                // ignore parse errors during drag over
                              }

                              if (
                                !dragOverCell ||
                                dragOverCell.day !== day ||
                                dragOverCell.timeSlot !== timeSlot ||
                                dragOverCell.duration !== dragDuration
                              ) {
                                setDragOverCell({
                                  day,
                                  timeSlot,
                                  duration: dragDuration,
                                });
                              }
                            }}
                            onDragLeave={() => {
                              if (
                                dragOverCell?.day === day &&
                                dragOverCell?.timeSlot === timeSlot
                              ) {
                                setDragOverCell(null);
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              const rawData =
                                e.dataTransfer.getData("text/plain");
                              if (!rawData) return;
                              try {
                                const parsed = JSON.parse(
                                  rawData,
                                ) as DragPayload;
                                handleDropToSlot(day, timeSlot, parsed);
                              } catch (err) {
                                console.error("Drop parse error", err);
                              }
                            }}
                            className={`border-r p-2 text-center transition-colors ${
                              isHighlighted
                                ? "border-dashed border-cyan-400 bg-cyan-100/70 dark:bg-cyan-950/60"
                                : "text-gray-300 hover:bg-cyan-50/50 dark:border-gray-800 dark:hover:bg-cyan-950/20"
                            }`}
                          ></td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Card className="overflow-x-auto">
            <Table hoverable>
              <TableHead>
                <TableRow>
                  <TableHeadCell>Day</TableHeadCell>
                  <TableHeadCell>Time</TableHeadCell>
                  <TableHeadCell>Subject</TableHeadCell>
                  <TableHeadCell>Type</TableHeadCell>
                  <TableHeadCell>Section</TableHeadCell>
                  <TableHeadCell>Room</TableHeadCell>
                  <TableHeadCell>Teacher</TableHeadCell>
                </TableRow>
              </TableHead>
              <TableBody className="divide-y">
                {filteredTimetableEntries.length > 0 ? (
                  filteredTimetableEntries.map((item, index) => (
                    <TableRow
                      key={index}
                      className="bg-white dark:border-gray-700 dark:bg-gray-800"
                    >
                      <TableCell className="font-semibold text-gray-900 dark:text-white">
                        {item.day}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTime(item.start_time)} -{" "}
                        {formatTime(item.end_time)}
                      </TableCell>
                      <TableCell className="font-medium text-gray-900 dark:text-white">
                        <div>{item.course_name || "Unnamed Subject"}</div>
                        <div className="font-mono text-xs text-cyan-600 dark:text-cyan-400">
                          {item.course_code}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase ${item.type?.toLowerCase() === "laboratory" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"}`}
                        >
                          {item.type || "Lecture"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                          {item.section}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-500 dark:text-gray-400">
                        {item.room_name || "TBA"}
                      </TableCell>
                      <TableCell className="text-gray-500 dark:text-gray-400">
                        {item.teacher_name || "Unassigned"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <TableCell
                      colSpan={7}
                      className="py-6 text-center text-sm text-gray-500 italic dark:text-gray-400"
                    >
                      No entries found matching the selected filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* --- EDIT SIDE-PANEL DRAWER --- */}
      {isEditMode && (
        <aside className="fixed inset-y-0 right-0 w-80 shrink-0 overflow-y-auto border-l border-gray-200 bg-white p-4 shadow-2xl lg:static lg:h-auto lg:shadow-none dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-4 flex items-center justify-between border-b border-gray-200 pb-3 dark:border-gray-700">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Sections & Subjects Palette
            </h3>
            <button
              onClick={() => setIsEditMode(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
            >
              <HiX className="h-5 w-5" />
            </button>
          </div>
          <p className="mb-3 text-[11px] text-gray-500 dark:text-gray-400">
            Drag items into timetable slots. To transfer to another room,
            unassign the block, select the target room from the top dropdown,
            and drag it in.
          </p>

          <Accordion collapseAll className="space-y-2 border-none">
            {availableTimetableSections.map((secCode, sIdx) => {
              const sectionEntries = changedSchedules.filter(
                (e) => e.section === secCode,
              );

              const unassignedCount = sectionEntries.filter(
                (e) =>
                  !e.day || e.start_time === undefined || e.start_time <= 0,
              ).length;

              return (
                <AccordionPanel key={sIdx}>
                  <AccordionTitle className="rounded-lg bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                    <div className="flex w-full items-center justify-between pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-cyan-700 dark:text-cyan-400">
                          {secCode}
                        </span>
                        {unassignedCount > 0 && (
                          <Badge color="failure" size="xs">
                            {unassignedCount} missing
                          </Badge>
                        )}
                      </div>
                      <Badge color="gray" size="xs">
                        {sectionEntries.length} Items
                      </Badge>
                    </div>
                  </AccordionTitle>
                  <AccordionContent className="bg-white p-2 dark:bg-gray-900">
                    <div className="space-y-1.5">
                      {sectionEntries.length > 0 ? (
                        sectionEntries.map((subj, subIdx) => {
                          const scheduleEntryId = subj.schedule_entry_id;
                          const isPlaced = changedSchedules.some((e) => {
                            return (
                              e.schedule_entry_id === scheduleEntryId &&
                              e.day !== null &&
                              e.day !== "" &&
                              e.start_time !== undefined &&
                              e.start_time > 0
                            );
                          });

                          const itemDuration = subj.originalDuration || 60;
                          const isLabType =
                            subj.type?.toLowerCase() === "laboratory";

                          return (
                            <div
                              key={subIdx}
                              draggable={!isPlaced}
                              onDragStart={(e) => {
                                e.dataTransfer.setData(
                                  "text/plain",
                                  JSON.stringify({
                                    type: "existing",
                                    scheduleEntryId: scheduleEntryId,
                                    courseCode: subj.course_code,
                                    courseName: subj.course_name,
                                    section: secCode,
                                    roomName: subj.room_name,
                                    subjectId: subj.subject_id,
                                    roomId: subj.room_id,
                                    teacherId: subj.teacher_id,
                                    entryType: subj.type,
                                    duration: itemDuration,
                                  } as DragPayload),
                                );
                              }}
                              className={`rounded border p-2 text-xs transition-all ${
                                isPlaced
                                  ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500"
                                  : `cursor-grab ${isLabType ? "border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 dark:border-emerald-800 dark:bg-emerald-950/20" : "border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 dark:border-blue-800 dark:bg-blue-950/20"} text-gray-800 dark:text-gray-200`
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="font-bold">
                                  {subj.course_code}
                                </div>
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${isLabType ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"}`}
                                >
                                  {subj.type || "Lecture"}
                                </span>
                              </div>
                              <div className="truncate text-[10px]">
                                {subj.course_name}
                              </div>
                              <div className="mt-1 flex items-center justify-between text-[9px]">
                                <span className="font-mono text-gray-500">
                                  {itemDuration / 60} hr
                                  {itemDuration > 60 ? "s" : ""}{" "}
                                  {subj.room_name ? `• ${subj.room_name}` : ""}
                                </span>
                                {isPlaced ? (
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                    ✓ Placed
                                  </span>
                                ) : (
                                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                                    ⚠️ Unassigned
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="py-2 text-center text-[10px] text-gray-400 italic">
                          No subjects listed under this section.
                        </p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionPanel>
              );
            })}
          </Accordion>
        </aside>
      )}

      {/* --- CONFLICT WARNING MODAL --- */}
      <Modal
        show={conflictModalData.show}
        onClose={() => setConflictModalData({ show: false, message: "" })}
        size="md"
        popup
      >
        <ModalHeader />
        <ModalBody>
          <div className="text-center">
            <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-amber-500 dark:text-amber-400" />
            <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">
              Scheduling Conflict
            </h3>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              {conflictModalData.message}
            </p>
            <Button
              color="alternative"
              size="sm"
              onClick={() => setConflictModalData({ show: false, message: "" })}
              className="mx-auto cursor-pointer"
            >
              Understand & Go Back
            </Button>
          </div>
        </ModalBody>
      </Modal>

      {/* Page Does Not Exist Modal */}
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