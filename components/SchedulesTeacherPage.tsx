"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  Tooltip,
} from "flowbite-react";
import { HiArrowLeft, HiOutlineExternalLink, HiOutlineExclamationCircle, HiUserAdd, HiOutlineClock } from "react-icons/hi";
import {
  fetchTeacherDetailedMetrics,
  fetchTeachers,
  getTeachersWithAqAndFcce,
  fetchSubjectRequirementById,
  fetchFacultyLoadConfig,
  fetchScheduleByName,
  fetchTimetableEntriesByScheduleId,
  saveScheduleEntries,
  Configuration, TeacherScheduleEntryRow, TimetableEntryRecord,
} from "@/app/actions/system";
import { LocalTimetableEntry } from "@/components/schedules/ScheduleTimetable";
import { fetchUserRole } from "@/app/actions/user";

interface ScheduleTeacherProps {
  schedule_name: string;
  pscs_id: string;
}

interface TeacherInfo {
  name: string | null;
  pscs_id: string | null;
  teacher_code: string | null;
  employment_type: string | null;
}

interface UnitsAnalysis {
  current_units: number | null;
  max_units: number | null;
  absolute_max: number | null;
  remaining_units: number | null;
  unique_subjects: number | null;
  prep_limit: number | null;
  prep_utilization: number | null;
  utilization_rate: number | null;
  load_status: string | null;
}

interface TeacherPreferences {
  preferred_rooms: string[];
  preferred_times: string[];
  preferred_years: string[];
  preferred_subjects: string[];
}

interface TeacherRecord {
  teacher_id: string;
  pscs_id?: string;
  email?: string;
  full_name: string;
  teacher_code: string;
  department?: string;
  employment_type?: string;
  status?: string;
  aqs?: unknown;
  fcces?: unknown;
  preferences?: {
    preferred_rooms?: string[];
    preferred_times?: string[];
    preferred_years?: string[];
    preferred_subjects?: string[];
  };
}

interface SubjectRequirementRecord {
  subject_id: string;
  curriculum?: string;
  program_code?: string;
  course_code?: string;
  course_name?: string;
  lecture_units?: number;
  lab_units?: number;
  lab_type?: string;
  year_term?: string;
  required_aqs?: string[];
}

export default function SchedulesTeacherPage({
  schedule_name,
  pscs_id,
}: ScheduleTeacherProps) {
  const router = useRouter();
  const [canEdit, setCanEdit] = useState(false);

  // --- Page Loading States ---
  const [isLoading, setIsLoading] = useState(true);

  // --- Teacher Info States ---
  const [teacherInfo, setTeacherInfo] = useState<TeacherInfo>({
    name: null,
    pscs_id: null,
    teacher_code: null,
    employment_type: null,
  });

  // --- Units Analysis States ---
  const [unitsAnalysis, setUnitsAnalysis] = useState<UnitsAnalysis>({
    current_units: null,
    max_units: null,
    absolute_max: null,
    remaining_units: null,
    unique_subjects: null,
    prep_limit: null,
    prep_utilization: null,
    utilization_rate: null,
    load_status: null,
  });

  // --- Schedule & Breakdown States ---
  const [scheduleEntries, setScheduleEntries] = useState<TeacherScheduleEntryRow[]>([]);

  // --- Preferences States ---
  const [teacherPreferences, setTeacherPreferences] = useState<TeacherPreferences>({
    preferred_rooms: [],
    preferred_times: [],
    preferred_years: [],
    preferred_subjects: [],
  });

  // --- Transfer Modal States ---
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferEntry, setTransferEntry] = useState<TeacherScheduleEntryRow | null>(null);
  const [transferSubjectRequirement, setTransferSubjectRequirement] = useState<SubjectRequirementRecord | null>(null);
  const [transferTeacherSearchQuery, setTransferTeacherSearchQuery] = useState("");
  const [transferTeacherList, setTransferTeacherList] = useState<TeacherRecord[]>([]);
  const [transferSelectedTeacher, setTransferSelectedTeacher] = useState<TeacherRecord | null>(null);
  const [transferIsLoading, setTransferIsLoading] = useState(false);
  const [transferShowOverride, setTransferShowOverride] = useState(false);
  const [transferOverrideMessage, setTransferOverrideMessage] = useState("");
  const [transferConfig, setTransferConfig] = useState<Configuration | null>(null);
  const [transferAllSections, setTransferAllSections] = useState(false);
  
  // --- Replacement Teacher Schedule States ---
  const [transferReplacementEntries, setTransferReplacementEntries] = useState<TeacherScheduleEntryRow[]
  >([]);
  const [transferReplacementUniqueSubjects, setTransferReplacementUniqueSubjects] = useState<number | null>(null);
  const [transferConflicts, setTransferConflicts] = useState<Array<{
    day: string;
    transferEntry: TeacherScheduleEntryRow;
    existingEntry: TeacherScheduleEntryRow;
  }>>([]);

  // --- Timetable Entries for Transfer ---
  const [scheduleID, setScheduleID] = useState<string | null>(null);
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntryRecord[]>([]);
  const [isTransferring, setIsTransferring] = useState(false);

  // --- Data Fetching Effect ---
  useEffect(() => {
    async function fetchTeacherDetails() {
      setIsLoading(true);

      const res = await fetchTeacherDetailedMetrics(schedule_name, pscs_id);
      if (res.success && res.teacher && res.entries) {
        setTeacherInfo({
          name: res.teacher.name,
          pscs_id: res.teacher.pscs_id,
          teacher_code: res.teacher.teacher_code,
          employment_type: res.teacher.employment_type
        });

        setUnitsAnalysis({
          current_units: res.teacher.current_units,
          max_units: res.teacher.max_units,
          absolute_max: res.teacher.absolute_max,
          remaining_units: res.teacher.remaining_units,
          unique_subjects: res.teacher.unique_subjects,
          prep_limit: res.teacher.prep_limit,
          prep_utilization: res.teacher.prep_utilization,
          utilization_rate: res.teacher.utilization_rate,
          load_status: res.teacher.load_status,
        });

        setScheduleEntries(res.entries);
      }

      setIsLoading(false);
    }

    async function fetchTeacherPreferences() {
      const res = await fetchTeachers(pscs_id, "All Active & On Leave", "All Departments", "surname", "ASC", -1, 1);
      if (res.success && res.data && res.data.length > 0) {
        const teacher = res.data.find(t => t.pscs_id === pscs_id) || res.data[0];
        const prefsRaw = teacher.preferences;
        let prefs: Record<string, unknown> = {};
        if (prefsRaw) {
          if (typeof prefsRaw === 'string') {
            try {
              prefs = JSON.parse(prefsRaw);
            } catch {
              prefs = {};
            }
          } else if (typeof prefsRaw === 'object') {
            prefs = prefsRaw as Record<string, unknown>;
          }
        }
        if (Object.keys(prefs).length > 0) {
          setTeacherPreferences({
            preferred_rooms: Array.isArray(prefs.preferred_rooms) ? (prefs.preferred_rooms as string[]) : [],
            preferred_times: Array.isArray(prefs.preferred_times) ? (prefs.preferred_times as string[]) : [],
            preferred_years: Array.isArray(prefs.preferred_year) ? (prefs.preferred_year as string[]) : [],
            preferred_subjects: Array.isArray(prefs.preferred_subjects) ? (prefs.preferred_subjects as string[]) : [],
          });
        }
      }
    }

    if (pscs_id && schedule_name) {
      void fetchTeacherDetails();
      void fetchTeacherPreferences();
      void fetchScheduleAndTimetable();
    }
  }, [schedule_name, pscs_id]);

  // Fetch schedule ID and all timetable entries for transfer operations
  async function fetchScheduleAndTimetable() {
    const scheduleRes = await fetchScheduleByName(schedule_name);
    if (scheduleRes.success && scheduleRes.data) {
      const sid = scheduleRes.data.schedule_id;
      setScheduleID(sid);
      const entriesRes = await fetchTimetableEntriesByScheduleId(sid);
      if (entriesRes.success && entriesRes.data) {
        setTimetableEntries(entriesRes.data);
      }
    }
  }

  useEffect(() => {
    async function fetchUserPerm() {
      const res = await fetchUserRole("");

      if (res.success && res.data) {
        setCanEdit(res.data.schedules)
        console.log("Can Edit: " + Boolean(res.data.schedules));
      }
    }

    void fetchUserPerm()
  }, []);

  const DAYS_OF_WEEK = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const formatTime = (minutes: number | string) => {
    const minsVal = typeof minutes === "string" ? parseInt(minutes, 10) : minutes;
    const hours = Math.floor(minsVal / 60);
    const mins = minsVal % 60;
    const period = hours >= 12 ? "PM" : "AM";
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
    const formattedMins = mins < 10 ? `0${mins}` : mins;
    return `${formattedHours}:${formattedMins} ${period}`;
  };

  // --- Transfer Modal Logic ---

  // Load configuration data on mount
  useEffect(() => {
    async function loadConfigData() {
      const res = await fetchFacultyLoadConfig();
      if (res.success && res.data && res.data.length > 0) {
        setTransferConfig(res.data[0]);
      }
    }
    void loadConfigData();
  }, []);

  // Helper to map employment type to config limits
  const getLimitsForTeacher = (employmentType?: string) => {
    const normalized = (employmentType || "full_time").toLowerCase();
    const facultyLoad = transferConfig?.faculty_load ?? {
      full_time: 21,
      part_time: 12,
      part_time_full_load: 18,
    };
    const prepLimits = transferConfig?.prep_limits ?? {
      full_time: 7,
      part_time: 4,
      part_time_full_load: 6,
    };
    if (
      normalized.includes("part-time full load") ||
      normalized.includes("part_time_full_load")
    ) {
      return {
        prepLimit: Number(prepLimits.part_time_full_load ?? 6),
        facultyLoadLimit: Number(facultyLoad.part_time_full_load ?? 18),
      };
    } else if (normalized.includes("part")) {
      return {
        prepLimit: Number(prepLimits.part_time ?? 4),
        facultyLoadLimit: Number(facultyLoad.part_time ?? 12),
      };
    } else {
      return {
        prepLimit: Number(prepLimits.full_time ?? 7),
        facultyLoadLimit: Number(facultyLoad.full_time ?? 21),
      };
    }
  };

  const { prepLimit: transferPrepLimit, facultyLoadLimit: transferFacultyLoadLimit } = getLimitsForTeacher(
    transferSelectedTeacher?.employment_type,
  );
  const overloadMax = Number(transferConfig?.overload_max ?? 3);
  const absoluteMaxLoad = transferFacultyLoadLimit + overloadMax;

  useEffect(() => {
    async function loadSubjectReq() {
      if (!transferModalOpen || !transferEntry) {
        setTransferSubjectRequirement(null);
        setTransferSelectedTeacher(null);
        setTransferTeacherSearchQuery("");
        return;
      }
      const res = await fetchSubjectRequirementById(transferEntry.subject_id);
      if (res.success && res.data) {
        setTransferSubjectRequirement(res.data as SubjectRequirementRecord);
      } else {
        setTransferSubjectRequirement(null);
      }
    }
    void loadSubjectReq();
  }, [transferModalOpen, transferEntry]);

  // Fetch teachers list when search query changes
  useEffect(() => {
    async function fetchTeachersList() {
      if (!transferModalOpen) return;
      if (!transferTeacherSearchQuery || transferTeacherSearchQuery.trim().length < 2) {
        setTransferTeacherList([]);
        setTransferIsLoading(false);
        return;
      }
      setTransferIsLoading(true);
      try {
        const res = await getTeachersWithAqAndFcce({
          search: transferTeacherSearchQuery.trim(),
        });
        if (res.success && res.data) {
          setTransferTeacherList(
            (res.data as TeacherRecord[]).filter((t) => t.pscs_id !== pscs_id),
          );
        } else {
          setTransferTeacherList([]);
        }
      } catch (err) {
        console.error("Error fetching teachers:", err);
        setTransferTeacherList([]);
      } finally {
        setTransferIsLoading(false);
      }
    }
    const timer = setTimeout(() => {
      void fetchTeachersList();
    }, 1500);
    return () => clearTimeout(timer);
  }, [transferTeacherSearchQuery, transferModalOpen]);

  // Fetch replacement teacher's schedule when a teacher is selected
  useEffect(() => {
    async function fetchReplacementSchedule() {
      if (!transferSelectedTeacher?.pscs_id) {
        setTransferReplacementEntries([]);
        setTransferReplacementUniqueSubjects(null);
        return;
      }
      const res = await fetchTeacherDetailedMetrics(schedule_name, transferSelectedTeacher.pscs_id);
      if (res.success && res.teacher && res.entries) {
        setTransferReplacementEntries(res.entries);
        setTransferReplacementUniqueSubjects(res.teacher.unique_subjects);
      } else {
        setTransferReplacementEntries([]);
        setTransferReplacementUniqueSubjects(null);
      }
    }
    void fetchReplacementSchedule();
  }, [transferSelectedTeacher, schedule_name]);

  // Get all entries for the same subject code across all sections
  const transferAllSubjectEntries = useMemo(
    () => (transferEntry ? scheduleEntries.filter((e) => e.code === transferEntry.code) : []),
    [transferEntry, scheduleEntries]
  );

  // Get unique sections for this subject code (each section may have lab + lecture entries)
  const transferUniqueSections = useMemo(
    () => (transferEntry ? Array.from(new Set(transferAllSubjectEntries.map((e) => e.section))) : []),
    [transferEntry, transferAllSubjectEntries]
  );

  // Get all entries (lab + lecture) for the specific section of the selected entry
  const transferSectionEntries = useMemo(
    () =>
      transferEntry
        ? scheduleEntries.filter(
            (e) => e.code === transferEntry.code && e.section === transferEntry.section
          )
        : [],
    [transferEntry, scheduleEntries]
  );

  // Calculate projected prep for the current teacher when offloading transferEntry
  // Prep is based on unique subject codes. If transferring all sections, prep always decreases by 1.
  // If transferring only one section, prep only decreases if it's the last section of that subject.
  const transferProjectedPrep = (() => {
    if (!transferEntry || unitsAnalysis.unique_subjects === null) return unitsAnalysis.unique_subjects;
    if (transferAllSections) {
      // Removing all sections of this subject, prep decreases by 1
      return Math.max(0, unitsAnalysis.unique_subjects - 1);
    } else {
      // Check if there are other sections (not just entries) for this subject code
      if (transferUniqueSections.length > 1) {
        // Teacher still has this subject in another section, prep count unchanged
        return unitsAnalysis.unique_subjects;
      } else {
        // This is the only section for this subject, prep decreases by 1
        return Math.max(0, unitsAnalysis.unique_subjects - 1);
      }
    }
  })();

  // Calculate the current teacher's total load from all schedule entries (lab + lecture)
  // This matches the daily units display and avoids the backend's section-deduplicated current_units
  const transferCurrentLoad = scheduleEntries.reduce((sum, e) => sum + e.units, 0);

  // Calculate total units being transferred
  const transferTotalUnits = (() => {
    if (!transferEntry) return 0;
    if (transferAllSections) {
      return transferAllSubjectEntries.reduce((sum, e) => sum + e.units, 0);
    } else {
      // Transfer all entries (lab + lecture) for this section, not just the single clicked entry
      return transferSectionEntries.reduce((sum, e) => sum + e.units, 0);
    }
  })();

  // Determine which entries to show in the "Schedules included" list based on current scope
  const transferIncludedEntries = transferAllSections ? transferAllSubjectEntries : transferSectionEntries;

  // Calculate the replacement teacher's total load from all their schedule entries (lab + lecture)
  // This avoids the backend's section-deduplicated current_units
  const transferReplacementLoad = transferReplacementEntries.reduce((sum, e) => sum + Number(e.units), 0);

  // Calculate projected load for the selected replacement teacher
  const transferProjectedLoad = transferReplacementLoad + transferTotalUnits;

  // Detect schedule conflicts between transfer entries and replacement teacher's existing schedule
  useEffect(() => {
    if (!transferEntry || transferReplacementEntries.length === 0) {
      setTransferConflicts([]);
      return;
    }

    const entriesToTransfer = transferAllSections ? transferAllSubjectEntries : transferSectionEntries;
    const conflicts: Array<{
      day: string;
      transferEntry: TeacherScheduleEntryRow;
      existingEntry: TeacherScheduleEntryRow;
    }> = [];

    for (const entry of entriesToTransfer) {
      const entryStart = parseInt(entry.start_time, 10);
      const entryEnd = parseInt(entry.end_time, 10);

      for (const existing of transferReplacementEntries) {
        if (existing.day !== entry.day) continue;

        const existingStart = parseInt(existing.start_time, 10);
        const existingEnd = parseInt(existing.end_time, 10);

        // Check for time overlap: two intervals overlap if one starts before the other ends
        if (entryStart < existingEnd && existingStart < entryEnd) {
          conflicts.push({
            day: entry.day,
            transferEntry: entry,
            existingEntry: existing,
          });
        }
      }
    }

    setTransferConflicts(conflicts);
  }, [transferEntry, transferReplacementEntries, transferAllSections, transferAllSubjectEntries, transferSectionEntries]);

  const transferProjectedPreps = (() => {
    if (transferReplacementUniqueSubjects === null || !transferEntry) return null;
    // Check if the replacement teacher already has this subject code
    const alreadyHasSubject = transferReplacementEntries.some(
      (e) => e.code === transferEntry.code
    );
    if (alreadyHasSubject) {
      // Teacher already has this subject, prep count unchanged
      return transferReplacementUniqueSubjects;
    } else {
      // Teacher doesn't have this subject, prep increases by 1
      return transferReplacementUniqueSubjects + 1;
    }
  })();

  // AQ and FCCE checks for transfer
  const transferRequiredAqs = transferSubjectRequirement?.required_aqs || [];
  const transferTeacherAqs: string[] = Array.isArray(transferSelectedTeacher?.aqs)
    ? (transferSelectedTeacher?.aqs as Array<Record<string, unknown>>)
        .map((item) =>
          item && typeof item === "object" && "aq" in item
            ? String(item.aq ?? "")
            : "",
        )
        .filter(Boolean)
    : [];
  const transferHasAllAqsMatch =
    transferRequiredAqs.length > 0 &&
    transferRequiredAqs.every((req) =>
      transferTeacherAqs.some((tAq) => tAq.toLowerCase() === req.toLowerCase()),
    );

  const transferTeacherFcces = Array.isArray(transferSelectedTeacher?.fcces)
    ? (transferSelectedTeacher?.fcces as Array<Record<string, unknown>>)
    : [];
  const transferCourseNameToCheck = (
    transferSubjectRequirement?.course_name ||
    transferEntry?.subject_name ||
    ""
  ).trim().toLowerCase();
  const transferHasFcceRecord = transferTeacherFcces.some((f) => {
    const fCourse = String(f.course_name ?? "").trim().toLowerCase();
    return fCourse === transferCourseNameToCheck && f.pass === true;
  });
  const transferIsFullyMatched = transferHasAllAqsMatch && transferHasFcceRecord;

  // Open transfer modal for a specific entry
  const handleOpenTransferModal = (entry: TeacherScheduleEntryRow) => {
    setTransferEntry(entry);
    setTransferSelectedTeacher(null);
    setTransferTeacherSearchQuery("");
    setTransferShowOverride(false);
    setTransferAllSections(false);
    setTransferModalOpen(true);
  };

  const handleCloseTransferModal = () => {
    setTransferModalOpen(false);
    setTransferEntry(null);
    setTransferSelectedTeacher(null);
    setTransferTeacherSearchQuery("");
    setTransferShowOverride(false);
    setTransferAllSections(false);
    setTransferConflicts([]);
  };

  const handleTransferConfirm = () => {
    if (!transferSelectedTeacher) return;
    if (transferProjectedLoad > absoluteMaxLoad) {
      setTransferOverrideMessage(
        `Hard Limit Violation: Projected load (${transferProjectedLoad.toFixed(1)} units) exceeds the absolute maximum allowed limit (${absoluteMaxLoad} units).`,
      );
      setTransferShowOverride(true);
      return;
    }
    const warningReasons: string[] = [];
    if (!transferIsFullyMatched) {
      warningReasons.push(
        "missing required Academic Qualifications (AQ) or a valid passed FCCE record",
      );
    }
    if (transferProjectedLoad > transferFacultyLoadLimit) {
      warningReasons.push(
        `exceeds standard faculty load limit (${transferFacultyLoadLimit} units)`,
      );
    }
    if (transferProjectedPreps !== null && transferProjectedPreps > transferPrepLimit) {
      warningReasons.push(
        `exceeds standard preparation limit (${transferPrepLimit} preps)`,
      );
    }
    if (transferConflicts.length > 0) {
      warningReasons.push(
        `has ${transferConflicts.length} schedule conflict${transferConflicts.length > 1 ? "s" : ""} with overlapping time slots`,
      );
    }
    if (warningReasons.length > 0) {
      setTransferOverrideMessage(
        `The selected instructor ${transferSelectedTeacher.full_name} is ${warningReasons.join(" and ")}. Do you still wish to override and proceed?`,
      );
      setTransferShowOverride(true);
    } else {
      executeTransfer();
    }
  };

  const executeTransfer = async () => {
    if (!transferSelectedTeacher || !transferEntry || !scheduleID) return;

    setIsTransferring(true);
    setTransferShowOverride(false);

    try {
      // Find the timetable entries matching the transfer scope
      const entriesToTransfer = transferAllSections
        ? timetableEntries.filter(
            (e) => e.subject_id === transferEntry.subject_id
          )
        : timetableEntries.filter(
            (e) =>
              e.subject_id === transferEntry.subject_id &&
              e.section === transferEntry.section
          );

      if (entriesToTransfer.length === 0) {
        console.warn("No timetable entries found to transfer.");
        setIsTransferring(false);
        return;
      }

      // Update the teacher_id for matching entries
      const updatedEntries = timetableEntries.map((e) => {
        if (entriesToTransfer.find((te) => te.schedule_entry_id === e.schedule_entry_id)) {
          return {
            ...e,
            teacher_id: transferSelectedTeacher.teacher_id,
            teacher_code: transferSelectedTeacher.teacher_code || transferSelectedTeacher.full_name,
          };
        }
        return e;
      });

      // Save the updated entries
      const saveRes = await saveScheduleEntries(scheduleID, updatedEntries as LocalTimetableEntry[]);
      if (saveRes.success) {
        // Refresh the page data
        setTimetableEntries(updatedEntries);
        await refreshTeacherData();
        handleCloseTransferModal();
      } else {
        console.error("Failed to save schedule entries:", saveRes.error);
      }
    } catch (err) {
      console.error("Transfer error:", err);
    } finally {
      setIsTransferring(false);
    }
  };

  const refreshTeacherData = async () => {
    const res = await fetchTeacherDetailedMetrics(schedule_name, pscs_id);
    if (res.success && res.teacher && res.entries) {
      setTeacherInfo({
        name: res.teacher.name,
        pscs_id: res.teacher.pscs_id,
        teacher_code: res.teacher.teacher_code,
        employment_type: res.teacher.employment_type,
      });
      setUnitsAnalysis({
        current_units: res.teacher.current_units,
        max_units: res.teacher.max_units,
        absolute_max: res.teacher.absolute_max,
        remaining_units: res.teacher.remaining_units,
        unique_subjects: res.teacher.unique_subjects,
        prep_limit: res.teacher.prep_limit,
        prep_utilization: res.teacher.prep_utilization,
        utilization_rate: res.teacher.utilization_rate,
        load_status: res.teacher.load_status,
      });
      setScheduleEntries(res.entries);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between">
        <button
          className="flex items-center text-xs text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          onClick={() => router.push(`/schedules/${schedule_name}/teachers`)}
        >
          <HiArrowLeft className="mr-1.5 h-4 w-4" /> Back to Teachers Analysis
        </button>

        {/* TODO: ADD EXPORT FOR TEACHER SCEHDULE */}
        <Button
          color="blue"
          size="sm"
          className="bg-cyan-600 text-white hover:bg-cyan-700"
          hidden={!canEdit}
        >
          <HiOutlineExternalLink className="mr-1.5 h-4 w-4" />
          Export Teacher Schedule
        </Button>
      </div>

      {/* Header & Status Badge */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {teacherInfo.name !== null ? (
              teacherInfo.name
            ) : (
              <Spinner size="sm" />
            )}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Teacher Analysis • {schedule_name}
          </p>
        </div>
        <div className="inline-flex items-center rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          {unitsAnalysis.load_status !== null ? (
            unitsAnalysis.load_status
          ) : (
            <Spinner size="sm" />
          )}
        </div>
      </div>

      {/* Main Grid: Teacher Overview & Preferences */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Teacher Overview Card (Info + Units Analysis) */}
        <Card className="lg:col-span-2">
          <div className="grid grid-cols-1 gap-4 items-start md:grid-cols-2">
            {/* Teacher Information */}
            <div>
              <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
                👥 Teacher Information
              </h3>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Full Name
                  </p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {teacherInfo.name !== null ? (
                      teacherInfo.name
                    ) : (
                      <Spinner size="sm" />
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    PSCS ID
                  </p>
                  <p className="font-mono text-gray-900 dark:text-white">
                    {teacherInfo.pscs_id !== null ? (
                      teacherInfo.pscs_id
                    ) : (
                      <Spinner size="sm" />
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Teacher Code
                  </p>
                  <p className="font-mono text-gray-900 dark:text-white">
                    {teacherInfo.teacher_code !== null ? (
                      teacherInfo.teacher_code
                    ) : (
                      <Spinner size="sm" />
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Employment Type
                  </p>
                  <p className="text-gray-900 dark:text-white">
                    {teacherInfo.employment_type !== null ? (
                      teacherInfo.employment_type
                    ) : (
                      <Spinner size="sm" />
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Units Analysis */}
            <div>
          <h3 className="mb-6 text-sm font-semibold text-gray-900 dark:text-white">
            🕒 Units Analysis
          </h3>
          <div className="grid grid-cols-2 gap-4 text-center md:grid-cols-4">
            <div>
              <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                {unitsAnalysis.current_units !== null ? (
                  unitsAnalysis.current_units.toFixed(1)
                ) : (
                  <Spinner size="sm" />
                )}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Current Units
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                {unitsAnalysis.max_units !== null ? (
                  unitsAnalysis.max_units
                ) : (
                  <Spinner size="sm" />
                )}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Max Units
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {unitsAnalysis.absolute_max !== null ? (
                  unitsAnalysis.absolute_max
                ) : (
                  <Spinner size="sm" />
                )}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Absolute Max
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-2 dark:bg-emerald-950/40">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {unitsAnalysis.remaining_units !== null ? (
                  `+${unitsAnalysis.remaining_units.toFixed(1)}`
                ) : (
                  <Spinner size="sm" />
                )}
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Remaining Units
              </p>
            </div>
          </div>

          {/* Prep Utilization Box */}
          <div className="mt-6 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <div className="flex justify-between text-xs font-medium text-gray-700 dark:text-gray-300">
              <span>
                {unitsAnalysis.unique_subjects !== null ? (
                  `${unitsAnalysis.unique_subjects} Unique Subjects`
                ) : (
                  <Spinner size="sm" />
                )}
              </span>
              <span>
                {unitsAnalysis.prep_limit !== null ? (
                  `${unitsAnalysis.prep_limit} Prep Limit`
                ) : (
                  <Spinner size="sm" />
                )}
              </span>
              <span>
                {unitsAnalysis.prep_utilization !== null ? (
                  `${unitsAnalysis.prep_utilization.toFixed(1)}%`
                ) : (
                  <Spinner size="sm" />
                )}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Prep Utilization
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-2 rounded-full bg-cyan-600 transition-all duration-300"
                style={{ width: `${Math.min(unitsAnalysis.prep_utilization ?? 0, 100)}%` }}
              ></div>
            </div>
          </div>

              {/* Overall Utilization Rate */}
              <div className="mt-6">
                <div className="flex justify-between text-xs font-medium text-gray-700 dark:text-gray-300">
                  <span>Utilization Rate</span>
                  <span>
                    {unitsAnalysis.utilization_rate !== null ? (
                      `${unitsAnalysis.utilization_rate.toFixed(1)}%`
                    ) : (
                      <Spinner size="sm" />
                    )}
                  </span>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-2.5 rounded-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${Math.min(unitsAnalysis.utilization_rate ?? 0, 100)}%` }}
                  ></div>
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Preferences Card */}
        <Card className="lg:col-span-1">
          <div className="h-full">
            <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
              ⚙️ Preferences
            </h3>

            {/* Preferred Rooms */}
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                Preferred Rooms
              </p>
              {teacherPreferences.preferred_rooms.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {teacherPreferences.preferred_rooms.map((room, idx) => (
                    <Badge key={idx} color="blue">
                      {room}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs italic text-gray-400">No preferred rooms set</p>
              )}
            </div>

            {/* Preferred Times */}
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                Preferred Times
              </p>
              {teacherPreferences.preferred_times.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {teacherPreferences.preferred_times.map((time, idx) => (
                    <Badge key={idx} color="success">
                      {time}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs italic text-gray-400">No preferred times set</p>
              )}
            </div>

            {/* Preferred Years */}
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                Preferred Years
              </p>
              {teacherPreferences.preferred_years.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {teacherPreferences.preferred_years.map((year, idx) => (
                    <Badge key={idx} color="warning">
                      {year}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs italic text-gray-400">No preferred years set</p>
              )}
            </div>

            {/* Preferred Subjects */}
            <div>
              <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                Preferred Subjects
              </p>
              {teacherPreferences.preferred_subjects.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {teacherPreferences.preferred_subjects.map((subject, idx) => (
                    <Badge key={idx} color="purple">
                      {subject}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs italic text-gray-400">No preferred subjects set</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Schedule by Day Section */}
      <div>
        <h3 className="mb-4 text-base font-bold text-gray-900 dark:text-white">
          📅 Schedule by Day
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {DAYS_OF_WEEK.map((day) => {
            const dayEntries = scheduleEntries.filter((e) => e.day === day);
            const totalDayUnits = dayEntries.reduce(
              (sum, e) => sum + e.units,
              0,
            );

            return (
              <Card key={day} className="flex flex-col">
                <div className="justify-start">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {day}
                    </h4>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {totalDayUnits.toFixed(1)} units
                    </span>
                  </div>

                  {isLoading ? (
                    <div className="py-6 text-center">
                      <Spinner size="sm" />
                    </div>
                  ) : dayEntries.length > 0 ? (
                    <div className="space-y-4 divide-y divide-gray-100 dark:divide-gray-800">
                      {dayEntries.map((entry, idx) => (
                        <div key={idx} className={idx > 0 ? "pt-3" : ""}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {entry.subject_name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {formatTime(entry.start_time)} - {formatTime(entry.end_time)}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Room: {entry.room_name} • Section:{" "}
                                {entry.section}
                              </p>
                            </div>
                            {canEdit && (
                              <Button
                                size="xs"
                                color="purple"
                                onClick={() => handleOpenTransferModal(entry)}
                                className="ml-2 flex-shrink-0 text-[10px]"
                              >
                                <HiUserAdd className="mr-1 h-3 w-3" />
                                Transfer
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="py-6 text-center text-xs text-gray-400 italic">
                      No classes scheduled
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Subject Breakdown Table Section
      TODO: ADD SUBJECT REASSIGN MODAL AND FUNCTION. IT MUST CHECK FOR FCCE AND MAQ
      */}
      <div>
        <h3 className="mb-4 text-base font-bold text-gray-900 dark:text-white">
          📖 Subject Breakdown
        </h3>
        <Card className="overflow-x-auto">
          <Table hoverable>
            <TableHead>
              <TableRow>
                <TableHeadCell>Subject</TableHeadCell>
                <TableHeadCell>Code</TableHeadCell>
                <TableHeadCell>Units</TableHeadCell>
                <TableHeadCell>Schedule</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody className="divide-y">
              {isLoading ? (
                <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                  <TableCell
                    colSpan={4}
                    className="py-6 text-center text-sm text-gray-500 italic"
                  >
                    <div className="flex items-center justify-center">
                      <Spinner size="sm" />
                      <span className="ml-3">Loading subject breakdown...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : scheduleEntries.length > 0 ? (
                scheduleEntries.map((item, index) => (
                  <TableRow
                    key={index}
                    className="bg-white dark:border-gray-700 dark:bg-gray-800"
                  >
                    <TableCell className="font-medium text-gray-900 dark:text-white">
                      {item.subject_name}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.code}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {item.units.toFixed(1)} units
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-500 dark:text-gray-400">
                      {item.day} {formatTime(item.start_time)} - {formatTime(item.end_time)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                  <TableCell
                    colSpan={4}
                    className="py-6 text-center text-sm text-gray-500 italic dark:text-gray-400"
                  >
                    No subject breakdown entries found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* ==================== TRANSFER MODAL ==================== */}
      <Modal show={transferModalOpen} onClose={handleCloseTransferModal} size="xl" popup>
        <ModalHeader>
          {/* Header */}
          <div className="text-center">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Transfer Subject to Another Teacher
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Offload this subject from {teacherInfo.name} and assign it to another instructor.
            </p>
          </div>
        </ModalHeader>
        <ModalBody className={"scrollbar-track-transparent scrollbar-thumb-gray-400"}>
          <div className="space-y-4">
            {/* Selected Subject Card */}
            {transferEntry && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-blue-950 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/80 dark:text-white">
                <div className="flex items-center justify-between text-[10px] font-bold tracking-wider text-blue-700 uppercase dark:text-blue-300">
                  <span>Subject to Transfer</span>
                  <span className="rounded bg-blue-200 px-2 py-0.5 text-blue-900 dark:bg-blue-900/80 dark:text-blue-200">
                    {transferEntry.code}
                  </span>
                </div>
                <div className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                  {transferEntry.subject_name}
                </div>
                <div className="mt-0.5 text-xs text-gray-600 dark:text-blue-200">
                  {transferEntry.day} • {formatTime(transferEntry.start_time)} - {formatTime(transferEntry.end_time)} • {transferEntry.units} units
                </div>
                <div className="mt-0.5 text-xs text-gray-600 dark:text-blue-200">
                  Room: {transferEntry.room_name} • Section: {transferEntry.section}
                </div>

                {/* Transfer Scope Toggle */}
                {transferUniqueSections.length > 1 && (
                  <div className="mt-3 rounded-lg border border-blue-200 bg-blue-100/50 p-2.5 dark:border-blue-800/50 dark:bg-blue-900/30">
                    <div className="mb-2 text-[10px] font-bold tracking-wider text-blue-700 uppercase dark:text-blue-300">
                      Transfer Scope
                    </div>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="transferScope"
                          checked={!transferAllSections}
                          onChange={() => setTransferAllSections(false)}
                          className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <span className="text-xs text-gray-700 dark:text-gray-300">
                          This section only <span className="text-gray-500 dark:text-gray-400">({transferEntry?.section})</span>
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="transferScope"
                          checked={transferAllSections}
                          onChange={() => setTransferAllSections(true)}
                          className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <span className="text-xs text-gray-700 dark:text-gray-300">
                          All sections of this subject <span className="text-gray-500 dark:text-gray-400">({transferUniqueSections.length} sections, {transferTotalUnits.toFixed(1)} units)</span>
                        </span>
                      </label>
                    </div>

                    {/* Show schedules included list for both options */}
                    <div className="mt-2.5 border-t border-blue-200 pt-2 dark:border-blue-800/50">
                      <div className="text-[10px] font-semibold tracking-wider text-blue-600 dark:text-blue-400 mb-1.5">
                        Schedules included:
                      </div>
                      <div className="space-y-1">
                        {transferIncludedEntries.map((entry, idx) => (
                          <div
                            key={idx}
                            className={`rounded px-2 py-1 text-xs ${
                              entry.section === transferEntry?.section && entry.day === transferEntry?.day && entry.start_time === transferEntry?.start_time
                                ? "bg-blue-200/60 font-semibold text-blue-900 dark:bg-blue-800/60 dark:text-blue-100"
                                : "bg-blue-100/40 text-gray-700 dark:bg-blue-900/30 dark:text-gray-300"
                            }`}
                          >
                            {entry.code} • {entry.section} • {entry.day} • {formatTime(entry.start_time)} - {formatTime(entry.end_time)} • {entry.units} units • Room: {entry.room_name}
                            {entry.section === transferEntry?.section && entry.day === transferEntry?.day && entry.start_time === transferEntry?.start_time && (
                              <span className="ml-1.5 text-[10px] text-blue-600 dark:text-blue-300">(selected)</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Impact Projection on Current Teacher */}
            {transferEntry && (
              <div className="rounded-xl border border-gray-200 bg-white p-3 text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">
                <div className="mb-2 text-center text-[10px] font-bold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  Impact on {teacherInfo.name ?? "Current Teacher"} (Offload)
                </div>
                <div className="flex items-center justify-around">
                  <div className="text-center">
                    <div className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                      Proj. Prep
                    </div>
                    <div className="mt-0.5 text-base font-bold text-emerald-600 dark:text-emerald-400">
                      {unitsAnalysis.unique_subjects} → {transferProjectedPrep ?? 0} / {unitsAnalysis.prep_limit}
                    </div>
                  </div>
                  <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />
                  <div className="text-center">
                    <div className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                      Proj. Load
                    </div>
                    <div className="mt-0.5 text-base font-bold text-cyan-600 dark:text-cyan-400">
                      {transferCurrentLoad.toFixed(1)} → {(transferCurrentLoad - transferTotalUnits).toFixed(1)} / {unitsAnalysis.max_units}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Search Teacher Input */}
            {!transferSelectedTeacher && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Search Replacement Teacher
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={transferTeacherSearchQuery}
                    onChange={(e) => setTransferTeacherSearchQuery(e.target.value)}
                    placeholder="Type at least 2 characters (e.g., Jo)..."
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-xs text-gray-900 focus:border-cyan-500 focus:ring-cyan-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                {transferTeacherSearchQuery.trim().length >= 2 && !transferSelectedTeacher && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800">
                    {transferIsLoading ? (
                      <div className="p-3 text-center text-xs text-gray-500">
                        Searching...
                      </div>
                    ) : transferTeacherList.length > 0 ? (
                      transferTeacherList.map((tch) => (
                        <div
                          key={tch.teacher_id}
                          onClick={() => {
                            setTransferSelectedTeacher(tch);
                            setTransferTeacherSearchQuery(tch.full_name);
                          }}
                          className="cursor-pointer px-3 py-2 text-xs hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
                        >
                          <div className="font-bold">{tch.full_name}</div>
                          <div className="text-[10px] text-gray-400">
                            {tch.department || "No Department"}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-center text-xs text-gray-400">
                        No teachers found
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Selected Teacher Card */}
            {transferSelectedTeacher && (
              <div
                className={`rounded-xl border p-3.5 shadow-sm transition-all ${
                  transferIsFullyMatched
                    ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-700/50 dark:bg-emerald-950/90 dark:text-white"
                    : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/90 dark:text-white"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-bold tracking-wider uppercase">
                  <span
                    className={
                      transferIsFullyMatched
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-amber-700 dark:text-amber-300"
                    }
                  >
                    Selected Replacement Teacher
                  </span>
                  <button
                    onClick={() => {
                      setTransferSelectedTeacher(null);
                      setTransferTeacherSearchQuery("");
                    }}
                    className="text-xs underline hover:opacity-80"
                  >
                    Change
                  </button>
                </div>
                <div className="mt-1 text-sm font-bold">
                  {transferSelectedTeacher.full_name} ({transferSelectedTeacher.teacher_code})
                </div>
                <div
                  className={`mt-0.5 text-xs opacity-90 ${
                    transferIsFullyMatched
                      ? "text-emerald-800 dark:text-emerald-200"
                      : "text-amber-800 dark:text-amber-200"
                  }`}
                >
                  {transferSelectedTeacher.department || "General"} •{" "}
                  {transferSelectedTeacher.employment_type || "Full-time"}
                </div>

                {/* Teacher Preferences */}
                {transferSelectedTeacher.preferences && (
                  <div className="mt-3 space-y-2 border-t pt-3 text-xs">
                    <div className="text-[10px] font-bold tracking-wider uppercase opacity-70">
                      Preferences
                    </div>

                    {transferSelectedTeacher.preferences.preferred_rooms && transferSelectedTeacher.preferences.preferred_rooms.length > 0 && (
                      <div>
                        <span className="font-semibold">Rooms:</span>
                        <div className="mt-1 flex overflow-x-auto gap-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                          {transferSelectedTeacher.preferences.preferred_rooms.map((room, idx) => (
                            <span key={idx} className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                              {room}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {transferSelectedTeacher.preferences.preferred_times && transferSelectedTeacher.preferences.preferred_times.length > 0 && (
                      <div>
                        <span className="font-semibold">Times:</span>
                        <div className="mt-1 flex overflow-x-auto gap-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                          {transferSelectedTeacher.preferences.preferred_times.map((time, idx) => (
                            <span key={idx} className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/50 dark:text-green-300">
                              {time}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {transferSelectedTeacher.preferences.preferred_years && transferSelectedTeacher.preferences.preferred_years.length > 0 && (
                      <div>
                        <span className="font-semibold">Years:</span>
                        <div className="mt-1 flex overflow-x-auto gap-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                          {transferSelectedTeacher.preferences.preferred_years.map((year, idx) => (
                            <span key={idx} className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                              {year}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {transferSelectedTeacher.preferences.preferred_subjects && transferSelectedTeacher.preferences.preferred_subjects.length > 0 && (
                      <div>
                        <span className="font-semibold">Subjects:</span>
                        <div className="mt-1 flex overflow-x-auto gap-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                          {transferSelectedTeacher.preferences.preferred_subjects.map((subject, idx) => (
                            <span key={idx} className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                              {subject}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {(!transferSelectedTeacher.preferences.preferred_rooms || transferSelectedTeacher.preferences.preferred_rooms.length === 0) &&
                      (!transferSelectedTeacher.preferences.preferred_times || transferSelectedTeacher.preferences.preferred_times.length === 0) &&
                      (!transferSelectedTeacher.preferences.preferred_years || transferSelectedTeacher.preferences.preferred_years.length === 0) &&
                      (!transferSelectedTeacher.preferences.preferred_subjects || transferSelectedTeacher.preferences.preferred_subjects.length === 0) && (
                        <div className="text-xs italic opacity-60">No preferences set</div>
                      )}
                  </div>
                )}

                {/* Impact Projection (Onload) */}
                {transferSelectedTeacher && transferProjectedPreps !== null && (
                  <div className="mt-3 border-t pt-3">
                    <div className="mb-2 text-center text-[10px] font-bold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                      Impact on {transferSelectedTeacher.full_name} (Onload)
                    </div>
                    <div className="flex items-center justify-around">
                      <div className="text-center">
                        <div className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                          Proj. Prep
                        </div>
                        {transferProjectedPreps > transferPrepLimit ? (
                          <Tooltip content="Exceeds Max Prep">
                            <div className="mt-0.5 text-base font-bold text-red-600 dark:text-red-400">
                              {transferReplacementUniqueSubjects} → {transferProjectedPreps} / {transferPrepLimit}
                            </div>
                          </Tooltip>
                        ) : (
                          <div className="mt-0.5 text-base font-bold text-emerald-600 dark:text-emerald-400">
                            {transferReplacementUniqueSubjects} → {transferProjectedPreps} / {transferPrepLimit}
                          </div>
                        )}
                      </div>
                      <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />
                      <div className="text-center">
                        <div className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                          Proj. Load
                        </div>
                        {transferProjectedLoad > absoluteMaxLoad ? (
                          <Tooltip content="Exceeds Max Load">
                            <div className="mt-0.5 text-base font-bold text-red-600 dark:text-red-400">
                              {transferReplacementLoad.toFixed(1)} → {transferProjectedLoad.toFixed(1)} / {transferFacultyLoadLimit}
                            </div>
                          </Tooltip>
                        ) : transferProjectedLoad > transferFacultyLoadLimit ? (
                          <div className="mt-0.5 text-base font-bold text-amber-600 dark:text-amber-400">
                            {transferReplacementLoad.toFixed(1)} → {transferProjectedLoad.toFixed(1)} / {transferFacultyLoadLimit}
                          </div>
                        ) : (
                          <div className="mt-0.5 text-base font-bold text-cyan-600 dark:text-cyan-400">
                            {transferReplacementLoad.toFixed(1)} → {transferProjectedLoad.toFixed(1)} / {transferFacultyLoadLimit}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AQ Status Alert */}
            {transferSelectedTeacher && transferSubjectRequirement && (
              <div
                className={`rounded-lg border p-3 shadow-xs ${
                  transferHasAllAqsMatch
                    ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/60 dark:text-emerald-200"
                    : "border-red-200 bg-red-50 text-red-950 dark:border-red-900/50 dark:bg-red-950/60 dark:text-red-200"
                }`}
              >
                <div
                  className={`text-xs font-bold tracking-wide uppercase ${
                    transferHasAllAqsMatch
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-red-700 dark:text-red-300"
                  }`}
                >
                  {transferHasAllAqsMatch
                    ? "Academic Qualifications (AQ) Met"
                    : "Academic Qualifications (AQ) Mismatch"}
                </div>
                <div
                  className={`mt-0.5 text-[11px] opacity-90 ${
                    transferHasAllAqsMatch
                      ? "text-emerald-800 dark:text-emerald-300/80"
                      : "text-red-800 dark:text-red-300/80"
                  }`}
                >
                  {transferHasAllAqsMatch
                    ? `The teacher holds all required AQs: [${transferRequiredAqs.join(", ")}].`
                    : `Required AQs: [${transferRequiredAqs.length > 0 ? transferRequiredAqs.join(", ") : "None specified"}]. Teacher AQs: [${transferTeacherAqs.length > 0 ? transferTeacherAqs.join(", ") : "None"}].`}
                </div>
              </div>
            )}

            {/* FCCE Status Alert */}
            {transferSelectedTeacher && transferSubjectRequirement && (
              <div
                className={`rounded-lg border p-3 shadow-xs ${
                  transferHasFcceRecord
                    ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/60 dark:text-emerald-200"
                    : "border-red-200 bg-red-50 text-red-950 dark:border-red-900/50 dark:bg-red-950/60 dark:text-red-200"
                }`}
              >
                <div
                  className={`text-xs font-bold tracking-wide uppercase ${
                    transferHasFcceRecord
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-red-700 dark:text-red-300"
                  }`}
                >
                  {transferHasFcceRecord
                    ? `Passed FCCE Found for "${transferSubjectRequirement?.course_name || "Course"}"`
                    : `No Passed FCCE Found for "${transferSubjectRequirement?.course_name || "Course"}"`}
                </div>
                <div
                  className={`mt-0.5 text-[11px] opacity-90 ${
                    transferHasFcceRecord
                      ? "text-emerald-800 dark:text-emerald-300/80"
                      : "text-red-800 dark:text-red-300/80"
                  }`}
                >
                  {transferHasFcceRecord
                    ? "The selected teacher has a matching passed FCCE record for this specific course."
                    : "The teacher does not have a passed FCCE record matching this course name."}
                </div>
              </div>
            )}

            {/* Schedule Conflicts Warning */}
            {transferSelectedTeacher && transferConflicts.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-950 shadow-sm dark:border-red-700/50 dark:bg-red-950/90 dark:text-white">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-wider text-red-700 uppercase dark:text-red-300">
                  <HiOutlineClock className="h-4 w-4" />
                  Schedule Conflicts Detected
                </div>
                <div className="space-y-2">
                  {transferConflicts.map((conflict, idx) => (
                    <div key={idx} className="rounded-lg border border-red-200 bg-red-100/50 p-2.5 text-xs dark:border-red-800/50 dark:bg-red-900/30">
                      <div className="font-semibold text-red-800 dark:text-red-200">
                        {conflict.day}
                      </div>
                      <div className="mt-1.5 grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[10px] font-semibold tracking-wider text-red-600 uppercase dark:text-red-400">
                            Transferring
                          </div>
                          <div className="mt-0.5 font-medium text-red-900 dark:text-red-100">
                            {conflict.transferEntry.code} • {conflict.transferEntry.section}
                          </div>
                          <div className="text-[11px] text-red-700 dark:text-red-300">
                            {formatTime(conflict.transferEntry.start_time)} - {formatTime(conflict.transferEntry.end_time)}
                          </div>
                          <div className="text-[11px] text-red-700 dark:text-red-300">
                            Room: {conflict.transferEntry.room_name}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-semibold tracking-wider text-red-600 uppercase dark:text-red-400">
                            Existing
                          </div>
                          <div className="mt-0.5 font-medium text-red-900 dark:text-red-100">
                            {conflict.existingEntry.code} • {conflict.existingEntry.section}
                          </div>
                          <div className="text-[11px] text-red-700 dark:text-red-300">
                            {formatTime(conflict.existingEntry.start_time)} - {formatTime(conflict.existingEntry.end_time)}
                          </div>
                          <div className="text-[11px] text-red-700 dark:text-red-300">
                            Room: {conflict.existingEntry.room_name}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </ModalBody>
        <ModalFooter className="flex justify-end gap-3 pt-3">
          <Button
            color="alternative"
            size="sm"
            onClick={handleCloseTransferModal}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            color="purple"
            size="sm"
            onClick={handleTransferConfirm}
            disabled={!transferSelectedTeacher || isTransferring || (transferProjectedLoad > absoluteMaxLoad)}
            className={`cursor-pointer bg-purple-600 text-white hover:bg-purple-700 ${
              !transferSelectedTeacher || isTransferring || (transferProjectedLoad > absoluteMaxLoad) ? "cursor-not-allowed opacity-50" : ""
            }`}
          >
            {isTransferring ? <Spinner size="sm" /> : "Confirm Transfer"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Transfer Override Warning Modal */}
      <Modal
        show={transferShowOverride}
        onClose={() => setTransferShowOverride(false)}
        size="md"
        popup
      >
        <ModalHeader />
        <ModalBody>
          <div className="text-center">
            <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-amber-500 dark:text-amber-400" />
            <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">
              Qualification Mismatch
            </h3>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              {transferOverrideMessage}
            </p>
            <div className="flex justify-center gap-4">
              <Button
                color="purple"
                size="sm"
                onClick={() => {
                  setTransferShowOverride(false);
                  executeTransfer();
                }}
                className="cursor-pointer"
              >
                Yes, Override & Transfer
              </Button>
              <Button
                color="alternative"
                size="sm"
                onClick={() => setTransferShowOverride(false)}
                className="cursor-pointer"
              >
                Go Back
              </Button>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </div>
  );
}