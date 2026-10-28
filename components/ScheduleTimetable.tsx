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
} from "flowbite-react";
import {
  HiArrowLeft,
  HiOutlineExternalLink,
  HiOutlineExclamationCircle,
} from "react-icons/hi";
import { FaCalendarDay, FaList, } from "react-icons/fa6";
import {
  fetchScheduleByName,
  fetchTimetableEntriesByScheduleId,
  fetchBreakPeriods,
  fetchBreakPeriodsCount,
  TimetableEntryRecord,
} from "@/app/actions/system";
import { FaCoffee } from "react-icons/fa";

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

export default function ScheduleTimetableClient({
  scheduleName,
}: ScheduleTimetableClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [entries, setEntries] = useState<TimetableEntryRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [scheduleID, setScheduleID] = useState<string | null>(null);
  const [scheduleExists, setScheduleExists] = useState<boolean>(true);

  // --- Break Periods State --- //
  const [breakPeriods, setBreakPeriods] = useState<BreakPeriodRecord[]>([]);
  const [breakPeriodCount, setBreakPeriodCount] = useState(0);

  // --- Display & Filter States (Initialized as empty to prevent both being "ALL" initially) --- //
  const [displayFormat, setDisplayFormat] = useState<"timetable" | "table">(
    "timetable",
  );
  const [selectedTimetableSection, setSelectedTimetableSection] =
    useState<string>("");
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

  const timeSlotsGrid = [
    "07:00",
    "07:30",
    "08:00",
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "13:30",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
    "19:00",
    "19:30",
    "20:00",
    "20:30",
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

  // Load break periods on mount
  useEffect(() => {
    void getBreakPeriods();
  }, [getBreakPeriods]);

  // 1. Fetch schedule ID by name on mount / scheduleName change
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

  // 2. Fetch timetable entries once scheduleID is resolved & set initial non-ALL defaults
  useEffect(() => {
    async function loadTimetableEntries() {
      if (!scheduleID) return;
      setIsLoading(true);
      try {
        const res = await fetchTimetableEntriesByScheduleId(scheduleID);
        if (res.success && res.data) {
          setEntries(res.data);
          setError(null);

          // Ensure dropdowns are NEVER both "ALL" on load:
          const sections = Array.from(
            new Set(res.data.map((e) => e.section).filter(Boolean)),
          );
          if (sections.length > 0) {
            setSelectedTimetableSection(sections[0]); // Pick first section
            setSelectedTimetableRoom("ALL"); // Room is ALL, Section is specific (Mutually exclusive)
          } else {
            setSelectedTimetableSection("ALL");
            const rooms = Array.from(
              new Set(res.data.map((e) => e.room_name).filter(Boolean)),
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
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  };

  const timeStrToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(":");
    const hours = parseInt(parts[0] || "0", 10);
    const mins = parseInt(parts[1] || "0", 10);
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

  // Helper to expand break periods based on DAYS_CONFIG mapping
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

  // Filter logic ensuring strict mutual exclusivity (never both ALL)
  const filteredTimetableEntries = entries.filter((entry) => {
    const matchesSection =
      selectedTimetableSection === "ALL" ||
      entry.section === selectedTimetableSection;
    const matchesRoom =
      selectedTimetableRoom === "ALL" ||
      entry.room_name === selectedTimetableRoom;
    return matchesSection && matchesRoom;
  });

  const availableTimetableSections = Array.from(
    new Set(entries.map((e) => e.section).filter(Boolean)),
  );
  const availableTimetableRooms = Array.from(
    new Set(entries.map((e) => e.room_name).filter(Boolean)),
  );

  if (isLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-3">
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
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Button
            color="gray"
            size="xs"
            onClick={() => router.push("/schedules")}
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
        <Button
          color="blue"
          size="sm"
          className="cursor-pointer bg-cyan-600 text-white hover:bg-cyan-700"
        >
          <HiOutlineExternalLink className="mr-1.5 h-4 w-4" />
          Export Timetable
        </Button>
      </div>

      {/* Legend & Controls Bar */}
      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 lg:flex-row lg:items-center lg:justify-between dark:border-gray-700 dark:bg-gray-800">
        {/* View Mode ButtonGroup Toggle & Legend */}
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
              <span className="inline-block h-3 w-3 rounded border border-sky-300 bg-sky-100 dark:border-sky-700 dark:bg-sky-950"></span>
              <span>Classes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded border border-amber-300 bg-amber-100 dark:border-amber-700 dark:bg-amber-950"></span>
              <span>Break Periods</span>
            </div>
          </div>
        </div>

        {/* Filter Dropdowns with strict mutual exclusivity (never both ALL) */}
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
                if (val !== "ALL") {
                  setSelectedTimetableRoom("ALL"); // Force room to ALL if section is specific
                } else if (selectedTimetableRoom === "ALL") {
                  // Prevent both from being ALL: if section becomes ALL, force room to first room option
                  setSelectedTimetableRoom(availableTimetableRooms[0] || "ALL");
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
                if (val !== "ALL") {
                  setSelectedTimetableSection("ALL"); // Force section to ALL if room is specific
                } else if (selectedTimetableSection === "ALL") {
                  // Prevent both from being ALL: if room becomes ALL, force section to first section option
                  setSelectedTimetableSection(
                    availableTimetableSections[0] || "ALL",
                  );
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
                const slotTimeParts = timeSlot.split(":");
                const slotHour = parseInt(slotTimeParts[0], 10);
                const slotMin = parseInt(slotTimeParts[1], 10);
                const slotTotalMins = slotHour * 60 + slotMin;

                return (
                  <tr key={tIdx} className="border-b dark:border-gray-800">
                    <td className="sticky left-0 z-10 border-r bg-gray-50 p-2 text-center font-mono text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      {timeSlot}
                    </td>
                    {daysOfWeek.map((day) => {
                      // Check for Class Entry
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

                      if (matchedEntry) {
                        const durationMins =
                          matchedEntry.end_time - matchedEntry.start_time;
                        const rowSpan = Math.max(
                          1,
                          Math.round(durationMins / 30),
                        );

                        const blockStyle =
                          "bg-sky-50 text-sky-950 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-800";

                        return (
                          <td
                            key={day}
                            rowSpan={rowSpan}
                            className={`border-r p-1.5 align-top ${blockStyle} border font-sans`}
                          >
                            <div className="flex h-full flex-col justify-between rounded p-2 shadow-xs">
                              <div>
                                <div className="text-xs font-bold text-gray-900 dark:text-white">
                                  {matchedEntry.course_name}
                                </div>
                                <div className="truncate text-[10px] opacity-90">
                                  {matchedEntry.course_code}
                                </div>
                              </div>
                              <div className="mt-2 space-y-0.5 text-[10px] font-semibold opacity-90">
                                <div>Sec: {matchedEntry.section}</div>
                                <div>
                                  Room: {matchedEntry.room_name || "TBA"}
                                </div>
                                <div className="font-mono">
                                  {formatTime(matchedEntry.start_time)} -{" "}
                                  {formatTime(matchedEntry.end_time)}
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
                        const breakStyle =
                          "bg-amber-50 text-amber-950 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800";

                        return (
                          <td
                            key={day}
                            rowSpan={rowSpan}
                            className={`border-r p-1.5 align-top ${breakStyle} border font-sans`}
                          >
                            <div className="flex h-full flex-col items-center justify-center rounded p-2 text-center shadow-xs">
                              <FaCoffee className="mb-1 h-4 w-4 text-amber-600 dark:text-amber-400" />
                              <div className="text-xs font-bold text-amber-900 dark:text-amber-100">
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

                      // Check if slot is covered by an ongoing class
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

                      // Check if slot is covered by an ongoing break
                      const isCoveredByBreak = expandedBreaks.some((bp) => {
                        if (bp.day.toLowerCase() !== day.toLowerCase())
                          return false;
                        return (
                          slotTotalMins > bp.start_time &&
                          slotTotalMins < bp.end_time
                        );
                      });

                      if (isCoveredByClass || isCoveredByBreak) {
                        return null;
                      }

                      return (
                        <td
                          key={day}
                          className="border-r p-2 text-center text-gray-300 dark:border-gray-800"
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
                    colSpan={6}
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