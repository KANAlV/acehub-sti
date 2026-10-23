"use client";

import {
  Badge,
  Button,
  Modal,
  ModalBody,
  ModalHeader,
  Progress,
  Spinner,
  Toast,
  ToastToggle,
  Tooltip,
  useThemeMode,
} from "flowbite-react";
import {
  HiCalendar,
  HiUserGroup,
  HiBookOpen,
  HiClock,
  HiArrowLeft,
  HiOutlineChartBar,
  HiOutlineExternalLink,
  HiOutlineTrash,
  HiExclamationCircle,
  HiCheck,
  HiExclamation,
  HiX,
} from "react-icons/hi";
import { useRouter } from "next/navigation";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  deleteScheduleUsingID,
  fetchScheduleByName,
  fetchScheduleDetailedSummary,
  fetchScheduleEntriesSummary,
  fetchScheduleTeacherMetricsSummary,
  fetchScheduleUsageSummary,
  TeacherMetricRecord,
  updateActiveSchedule,
} from "@/app/actions/system";
import { HiOutlineExclamationCircle } from "react-icons/hi2";

interface TeacherCardData {
  name: string;
  idNumber: string;
  code: string;
  status: string;
  currentUnits: number;
  maxUnits: number;
  absoluteMax: number;
  available: number;
  utilization: number;
}

interface ScheduleSummaryProps {
  scheduleName: string;
}

export default function SummaryDisplay({ scheduleName }: ScheduleSummaryProps) {
  const router = useRouter();
  const { computedMode } = useThemeMode();
  const isDarkMode = computedMode === "dark";
  const [openModal, setOpenModal] = useState(false);

  // Loading/data state hooks
  const [isDisplayed, SetIsDisplayed] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [scheduleExists, setScheduleExists] = useState<boolean>(true);
  const [scheduleID, setScheduleID] = useState<string | null>(null);
  const [scheduleCreated, setScheduleCreated] = useState<string | null>(null);
  const [totalEntries, setTotalEntries] = useState<number | null>(null);
  const [activeTeachers, setActiveTeachers] = useState<number | null>(null);
  const [overloadedCount, setOverloadedCount] = useState<number | null>(null);
  const [subjectsCount, setSubjectsCount] = useState<number | null>(null);
  const [totalUnits, setTotalUnits] = useState<number | null>(null);
  const [dailyAverage, setDailyAverage] = useState<number | null>(null);
  const [avgClassDuration, setAvgClassDuration] = useState<number | null>(null);
  const [teachersUtil, setTeachersUtil] = useState<{
    current: number;
    max: number;
  } | null>(null);
  const [roomsUtil, setRoomsUtil] = useState<{
    current: number;
    max: number;
  } | null>(null);
  const [sectionsCount, setSectionsCount] = useState<number | null>(null);
  const [unassignedTeachersCount, setUnassignedTeachersCount] = useState<
    number | null
  >(null);
  const [unassignedRoomsCount, setUnassignedRoomsCount] = useState<
    number | null
  >(null);
  const [teachersList, setTeachersList] = useState<TeacherCardData[] | null>(
    null,
  );

  // --- Toast State & Timer Ref ---
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [toastType, setToastType] = useState<"success" | "warning" | "error">(
    "success",
  );
  const [progress, setProgress] = useState<number>(100);
  const [showToastTimer, setShowToastTimer] = useState<boolean>(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const closeToast = useCallback(() => {
    setShowToast(false);
    setProgress(100);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const triggerToast = useCallback(
    (
      msg: string,
      type: "success" | "warning" | "error" = "success",
      durationMs: number = 4000,
    ) => {
      closeToast();
      setToastMessage(msg);
      setToastType(type);
      setShowToast(true);

      if (type === "error") {
        setShowToastTimer(false);
        return;
      }

      setShowToastTimer(true);
      setProgress(100);

      const intervalMs = 50;
      const step = (intervalMs / durationMs) * 100;

      timerRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev <= step) {
            closeToast();
            return 0;
          }
          return prev - step;
        });
      }, intervalMs);
    },
    [closeToast],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Buttons
  async function setAsDisplayed() {
    if (!scheduleID) {
      return;
    }
    setIsLoading(true);
    if (isDisplayed) {
      const res = await updateActiveSchedule(null);

      if (res.success) {
        void (await fetchScheduleData());
      } else {
        triggerToast(
          res.error || "Failed to load set Schedule as Active.",
          "error",
        );
      }
      setIsLoading(false);
    } else {
      const res = await updateActiveSchedule(scheduleID);

      if (res.success) {
        void (await fetchScheduleData());
      } else {
        triggerToast(
          res.error || "Failed to load set Schedule as Active.",
          "error",
        );
      }
      setIsLoading(false);
    }
  }

  // --- Data Fetching ---
  async function fetchScheduleData() {
    setIsLoading(true);
    const res = await fetchScheduleByName(scheduleName);

    if (res.success && res.data) {
      setScheduleExists(true);
      const formattedDate = res.data.created_at
        ? new Date(res.data.created_at).toLocaleString()
        : "";

      setScheduleID(res.data.schedule_id);
      setScheduleCreated(formattedDate);
      SetIsDisplayed(res.data.is_active);
    } else {
      setScheduleExists(false);
      setIsLoading(false);
    }
  }

  async function getScheduleEntriesSummary() {
    if (scheduleID !== null) {
      const res = await fetchScheduleEntriesSummary(scheduleID);

      if (res.success && res.data) {
        setTotalEntries(res.data.total_entries);
        setActiveTeachers(res.data.active_teachers);
        setSubjectsCount(res.data.subjects);
        setTotalUnits(res.data.total_units);
      } else {
        triggerToast(
          res.error || "Failed to load Schedule Entries Summary.",
          "error",
        );
      }
    }
  }

  async function getScheduleUsageSummary() {
    if (scheduleID !== null) {
      const res = await fetchScheduleUsageSummary(scheduleID);

      if (res.success && res.data) {
        setTeachersUtil({
          current: res.data.active_teachers,
          max: res.data.max_teachers,
        });
        setRoomsUtil({
          current: res.data.used_rooms,
          max: res.data.max_rooms,
        });
        setSectionsCount(res.data.sections);
      } else {
        triggerToast(
          res.error || "Failed to load Schedule usage summary.",
          "error",
        );
      }
    }
  }

  async function getScheduleDetailedSummary() {
    if (scheduleID !== null) {
      const res = await fetchScheduleDetailedSummary(scheduleID);

      if (res.success && res.data) {
        setDailyAverage(res.data.daily_avg);
        setAvgClassDuration(res.data.avg_class_dur);
        setUnassignedTeachersCount(res.data.no_teacher);
        setUnassignedRoomsCount(res.data.no_room);
      } else {
        triggerToast(res.error || "Failed to load Detailed Summary.", "error");
      }
    }
  }

  async function getScheduleTeacherMetricsSummary() {
    if (scheduleID !== null) {
      const res = await fetchScheduleTeacherMetricsSummary(scheduleID);

      if (res.success && res.data) {
        const formattedTeachers: TeacherCardData[] = (
          res.data.teachers ?? []
        ).map((teacher: TeacherMetricRecord) => ({
          name: teacher.name,
          idNumber: teacher.id_number,
          code: teacher.code,
          status: teacher.status,
          currentUnits: teacher.current_units,
          maxUnits: teacher.max_units,
          absoluteMax: teacher.absolute_max,
          available: teacher.available,
          utilization: teacher.utilization,
        }));

        setOverloadedCount(res.data.overloaded);

        setTeachersList(formattedTeachers);
        setIsLoading(false); // Finished loading everything
      } else {
        triggerToast(res.error || "Failed to load teachers metrics.", "error");
        setIsLoading(false);
      }
    }
  }

  async function deleteSchedule() {
    const rmv = await updateActiveSchedule(null);

    if (rmv.success) {
      const res = await deleteScheduleUsingID(scheduleID!);

      if (res.success) {
        triggerToast(res.error || "Schedule Deleted.", "success");
        router.push("/schedules");
      } else {
        triggerToast(res.error || "Failed to Delete schedule.", "error");
      }
    } else {
      triggerToast(rmv.error || "Failed to Deactivate schedule.", "error");
    }
  }

  // Initial mount effect
  useEffect(() => {
    void fetchScheduleData();
  }, [scheduleName]);

  useEffect(() => {
    if (scheduleID !== null) {
      void getScheduleEntriesSummary();
      void getScheduleDetailedSummary();
      void getScheduleUsageSummary();
      void getScheduleTeacherMetricsSummary();
    }
  }, [scheduleID]);

  // Color Indicators
  function getCapacityBarColor(
    current: number | null,
    max: number | null,
  ): "green" | "yellow" | "red" | "gray" {
    if (current == null || max == null) {
      return "gray";
    }

    if (current >= max) {
      return "red";
    }

    const ratio = current / max;
    if (ratio >= 0.8) {
      return "yellow";
    }

    return "green";
  }

  function getCapacityTextColor(current: number | null, max: number | null) {
    if (current == null || max == null) {
      return "text-gray-500 dark:text-gray-400";
    }

    if (current >= max) {
      return "text-red-500 dark:text-red-400";
    }

    const ratio = current / max;
    if (ratio >= 0.8) {
      return "text-yellow-500 dark:text-yellow-400";
    }

    return "text-emerald-500 dark:text-emerald-400";
  }

  // --- Loading Screen while waiting for fetchScheduleData ---
  if (isLoading && scheduleExists) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center font-sans text-gray-500 dark:text-gray-400">
        <Spinner size="xl" className="mb-4" />
        <p className="text-sm font-medium">Loading schedule details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans text-gray-900 dark:text-gray-100">
      {/* Top Action Bar */}
      <div className="mb-6 flex items-center justify-between">
        <button
          className="flex items-center text-xs text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          onClick={() => router.push("/schedules")}
        >
          <HiArrowLeft className="mr-1.5 h-4 w-4" /> Back to Schedules
        </button>
        <div className="flex items-center gap-3">
          <Tooltip
            content={`${isDisplayed ? "Deactivate Schedule" : "Sets the schedule to be displayed in dashboard and timetable"}`}
            placement={"bottom"}
            style={isDarkMode ? "dark" : "light"}
          >
            <Button
              disabled={isLoading}
              onClick={() => (!isLoading ? setAsDisplayed() : null)}
              color="alternative"
              size="sm"
              className={`${isDisplayed ? "hover:text-red-500 dark:hover:text-red-400" : "hover:bg-gray-100"} gap-2 border-gray-300 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700`}
            >
              {isLoading && <Spinner size={"sm"} />}
              {isDisplayed ? "Already Active" : "Set as Active"}
            </Button>
          </Tooltip>

          <Button
            color="blue"
            size="sm"
            className="bg-cyan-600 text-white hover:bg-cyan-700"
          >
            <HiOutlineExternalLink className="mr-1.5 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {/* Header Banner */}
      <div className="mb-6 flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:flex-row md:items-center dark:border-gray-800 dark:bg-gray-800">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {scheduleName}
          </h1>
          <p className="font-mono text-xs text-gray-500 dark:text-gray-400">
            Created:{" "}
            {scheduleCreated !== null ? (
              scheduleCreated
            ) : (
              <span className="inline-block animate-pulse text-gray-400">
                Loading...
              </span>
            )}
          </p>
        </div>
        <div className="mt-4 flex items-center gap-3 md:mt-0">
          <Button
            size="sm"
            onClick={() => router.push(`schedules/${scheduleName}/timetable`)}
            className="bg-cyan-600 font-medium text-white hover:bg-cyan-700"
          >
            <HiCalendar className="mr-2 h-4 w-4" /> Open Timetable
          </Button>
          <Button
            color="failure"
            size="sm"
            onClick={() => setOpenModal(true)}
            className="border border-red-500/50 bg-transparent text-red-500 hover:bg-red-500/10 dark:text-red-400"
          >
            <HiOutlineTrash className="mr-1.5 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {/* Top Metric Cards Row */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1 */}
        <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-800">
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
              Total Entries
            </p>
            <h3
              className={`text-3xl font-extrabold ${!totalEntries ? "text-gray-900 dark:text-white" : totalEntries == 0 && "text-red-500 dark:text-red-400"}`}
            >
              {totalEntries !== null ? totalEntries : <Spinner size="sm" />}
            </h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-800/40 dark:bg-blue-950/60 dark:text-blue-400">
            <HiCalendar className="h-5 w-5" />
          </div>
        </div>

        {/* Card 2 */}
        <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-800">
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
              Active Teachers
            </p>
            <h3
              className={`text-3xl font-extrabold ${!activeTeachers ? "text-gray-900 dark:text-white" : activeTeachers == 0 && "text-red-500 dark:text-red-400"}`}
            >
              {activeTeachers !== null ? activeTeachers : <Spinner size="sm" />}
            </h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800/40 dark:bg-emerald-950/60 dark:text-emerald-400">
            <HiUserGroup className="h-5 w-5" />
          </div>
        </div>

        {/* Card 3 */}
        <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-800">
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
              Subjects
            </p>
            <h3
              className={`text-3xl font-extrabold ${!subjectsCount ? "text-gray-900 dark:text-white" : subjectsCount == 0 && "text-red-500 dark:text-red-400"}`}
            >
              {subjectsCount !== null ? subjectsCount : <Spinner size="sm" />}
            </h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-200 bg-purple-50 text-purple-600 dark:border-purple-800/40 dark:bg-purple-950/60 dark:text-purple-400">
            <HiBookOpen className="h-5 w-5" />
          </div>
        </div>

        {/* Card 4 */}
        <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-800">
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
              Total Units
            </p>
            <h3
              className={`text-3xl font-extrabold ${!totalUnits ? "text-gray-900 dark:text-white" : totalUnits == 0 && "text-red-500 dark:text-red-400"}`}
            >
              {totalUnits !== null ? totalUnits : <Spinner size="sm" />}
            </h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-800/40 dark:bg-amber-950/60 dark:text-amber-500">
            <HiClock className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Schedule Overview Details Section */}
      <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800">
        <div className="mb-6 flex items-center gap-2">
          <HiOutlineChartBar className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
          <h2 className="text-base font-bold tracking-wide text-gray-900 dark:text-white">
            Schedule Overview & Assignment Quality
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Resource Utilization Bars */}
          <div>
            <h4 className="mb-4 text-xs font-bold tracking-wider text-gray-500 uppercase dark:text-gray-400">
              Resource Utilization
            </h4>
            <div className="space-y-3">
              {/* Teachers Util */}
              <div>
                <div
                  className={`mb-1 flex justify-between text-xs ${!teachersUtil ? "text-gray-500 dark:text-gray-400" : teachersUtil.current == 0 && "font-extrabold text-red-500 dark:text-red-400"}`}
                >
                  <span>Teachers</span>
                  <span className="font-mono">
                    {teachersUtil
                      ? `${teachersUtil.current}/${teachersUtil.max}`
                      : "0/0"}
                  </span>
                </div>
                <Progress
                  progress={
                    teachersUtil
                      ? (teachersUtil.current / teachersUtil.max) * 100
                      : 0
                  }
                  size="sm"
                  color={`${getCapacityBarColor(teachersUtil?.current ?? null, teachersUtil?.max ?? null)}`}
                  className="bg-gray-100 dark:bg-gray-700"
                />
              </div>

              {/* Rooms Util */}
              <div>
                <div
                  className={`mb-1 flex justify-between text-xs ${!roomsUtil ? "text-gray-500 dark:text-gray-400" : roomsUtil.current == 0 && "font-extrabold text-red-500 dark:text-red-400"}`}
                >
                  <span>Rooms</span>
                  <span className="font-mono">
                    {roomsUtil
                      ? `${roomsUtil.current}/${roomsUtil.max}`
                      : "0/0"}
                  </span>
                </div>
                <Progress
                  progress={
                    roomsUtil ? (roomsUtil.current / roomsUtil.max) * 100 : 0
                  }
                  size="sm"
                  color={`${getCapacityBarColor(roomsUtil?.current ?? null, roomsUtil?.max ?? null)}`}
                  className="bg-gray-100 dark:bg-gray-700"
                />
              </div>
              <div className="flex justify-between pt-1 text-xs text-gray-500 dark:text-gray-400">
                <span>Sections Active</span>
                <span className="font-mono font-bold text-gray-900 dark:text-gray-200">
                  {sectionsCount !== null ? sectionsCount : "-"}
                </span>
              </div>
            </div>
          </div>

          {/* Schedule Details & Unassigned Checks */}
          <div>
            <h4 className="mb-4 text-xs font-bold tracking-wider text-gray-500 uppercase dark:text-gray-400">
              Performance & Unassigned Metrics
            </h4>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between border-b border-gray-100 pb-2 dark:border-gray-700/60">
                <span className="text-gray-500 dark:text-gray-400">
                  Daily Average:
                </span>
                <span className="font-mono text-gray-900 dark:text-gray-200">
                  {dailyAverage !== null ? dailyAverage : "-"}
                </span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2 dark:border-gray-700/60">
                <span className="text-gray-500 dark:text-gray-400">
                  Avg Class Duration:
                </span>
                <span className="font-mono text-gray-900 dark:text-gray-200">
                  {avgClassDuration !== null ? avgClassDuration : "-"}
                </span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2 dark:border-gray-700/60">
                <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                  <HiExclamationCircle
                    className={`h-4 w-4 ${(unassignedTeachersCount ?? 0) > 0 ? "text-amber-500" : "hidden"}`}
                  />
                  Entries Lacking Teacher:
                </span>
                <span
                  className={`font-mono font-bold ${(unassignedTeachersCount ?? 0) > 0 ? "text-amber-500 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}
                >
                  {unassignedTeachersCount !== null ? (
                    `${unassignedTeachersCount} ${unassignedTeachersCount === 1 ? "entry" : "entries"}`
                  ) : (
                    <Spinner size="sm" />
                  )}
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                  <HiExclamationCircle
                    className={`h-4 w-4 ${(unassignedRoomsCount ?? 0) > 0 ? "text-amber-500" : "hidden"}`}
                  />
                  Entries Lacking Room:
                </span>
                <span
                  className={`font-mono font-bold ${(unassignedRoomsCount ?? 0) > 0 ? "text-amber-500 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}
                >
                  {unassignedRoomsCount !== null ? (
                    `${unassignedRoomsCount} ${unassignedRoomsCount === 1 ? "entry" : "entries"}`
                  ) : (
                    <Spinner size="sm" />
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Teacher Analysis Section */}
      <div className="mb-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HiUserGroup className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            <h2 className="text-base font-bold tracking-wide text-gray-900 dark:text-white">
              Teacher Analysis
            </h2>
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Click on a teacher to view detailed analysis
          </span>
        </div>

        {/* Teacher Workload Summary Banner */}
        <div className="mb-6 grid grid-cols-2 gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:grid-cols-4 dark:border-gray-800 dark:bg-gray-800">
          <div>
            <p className="mb-1 text-[11px] font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
              Total Teachers
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {teachersUtil?.max ?? "0"}
            </p>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
              Active in Schedule
            </p>
            <p
              className={`text-2xl font-bold ${getCapacityTextColor(teachersUtil?.current ?? null, teachersUtil?.max ?? null)} `}
            >
              {activeTeachers !== null ? activeTeachers : <Spinner size="sm" />}
            </p>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
              Overloaded
            </p>
            <p className={`text-2xl font-bold ${overloadedCount === null || overloadedCount === 0 ? "text-gray-600 dark:text-gray-500" : "text-red-600 dark:text-red-500"}`}>
              {overloadedCount !== null ? overloadedCount : <Spinner size="sm" />}
            </p>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
              Total Units Assigned
            </p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {totalUnits !== null ? totalUnits : <Spinner size="sm" />}
            </p>
          </div>
        </div>

        {/* Teacher Cards Grid */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {teachersList !== null && teachersList.length > 0 ? (
            <>
              {teachersList.map((teacher, idx) => (
                <div
                  key={idx}
                  onClick={() =>
                    router.push(
                      `/schedules/${scheduleName}/teachers/${encodeURIComponent(teacher.idNumber)}`,
                    )
                  }
                  className="relative flex cursor-pointer flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-gray-300 dark:border-gray-800 dark:bg-gray-800 dark:hover:border-gray-700"
                >
                  <div>
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                          {teacher.name}
                        </h3>
                        <p className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
                          {teacher.idNumber}
                        </p>
                        <p className="font-mono text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                          {teacher.code}
                        </p>
                      </div>
                      <Badge
                        color="success"
                        size="sm"
                        className="border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-normal text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950 dark:text-emerald-400"
                      >
                        {teacher.status}
                      </Badge>
                    </div>

                    <div className="my-4 space-y-1.5 border-t border-gray-100 pt-2 text-xs dark:border-gray-700/80">
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">
                          Current Units:
                        </span>
                        <span className="font-mono text-gray-800 dark:text-gray-200">
                          {teacher.currentUnits.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">
                          Max Units:
                        </span>
                        <span className="font-mono text-gray-800 dark:text-gray-200">
                          {teacher.maxUnits}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">
                          Absolute Max:
                        </span>
                        <span className="font-mono font-semibold text-red-600 dark:text-red-400">
                          {teacher.absoluteMax}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">
                          Available:
                        </span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400">
                          +{teacher.available.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">
                          Utilization:
                        </span>
                        <span className="font-mono text-gray-800 dark:text-gray-200">
                          {teacher.utilization.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Progress
                      progress={teacher.utilization}
                      size="sm"
                      color="blue"
                      className="bg-gray-100 dark:bg-gray-700"
                    />
                  </div>
                </div>
              ))}

              {/* View All Teachers Card rendered properly as a sibling */}
              <div
                onClick={() =>
                  router.push(`/schedules/${scheduleName}/teachers`)
                }
                className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50/50 p-6 text-center transition-colors hover:border-gray-400 dark:border-gray-800 dark:bg-gray-800/40 dark:hover:border-gray-700"
              >
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  View All Teachers
                </span>
              </div>
            </>
          ) : (
            <div className="col-span-full flex items-center justify-center p-8 text-sm text-gray-500 dark:text-gray-400">
              <Spinner size="sm" className="mr-2" /> Loading teacher analysis
              data...
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed right-5 bottom-5 z-50 rounded-lg border border-gray-500/30">
          <Toast>
            <div
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                toastType === "success"
                  ? "bg-green-100 text-green-500 dark:bg-green-800 dark:text-green-200"
                  : toastType === "warning"
                    ? "bg-yellow-100 text-yellow-500 dark:bg-yellow-800 dark:text-yellow-200"
                    : "bg-red-100 text-red-500 dark:bg-red-800 dark:text-red-200"
              }`}
            >
              {toastType === "success" && <HiCheck className="h-5 w-5" />}
              {toastType === "warning" && <HiExclamation className="h-5 w-5" />}
              {toastType === "error" && <HiX className="h-5 w-5" />}
            </div>
            <div className="ml-3 text-sm font-normal">{toastMessage}</div>
            <ToastToggle onDismiss={() => closeToast()} />
          </Toast>
          <Progress
            progress={Math.min(Math.round(progress), 100)}
            size="sm"
            className={`${showToastTimer ? "" : "hidden"} ease-linear`}
          />
        </div>
      )}

      {/* Delete Schedule Modal */}
      <Modal
        show={openModal}
        size="md"
        onClose={() => setOpenModal(false)}
        popup
      >
        <ModalHeader />
        <ModalBody>
          <div className="text-center">
            <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
            <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
              Are you sure you want to delete this schedule?
            </h3>
            <div className="flex justify-center gap-4">
              <Button
                disabled={isLoading}
                color="red"
                onClick={() => deleteSchedule()}
              >
                Yes, I&#39;m sure
              </Button>
              <Button
                disabled={isLoading}
                color="alternative"
                onClick={() => setOpenModal(false)}
              >
                No, cancel
              </Button>
            </div>
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
