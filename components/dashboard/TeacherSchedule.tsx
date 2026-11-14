"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TextInput,
  ToggleSwitch,
} from "flowbite-react";
import {
  HiArrowLeft,
  HiBookOpen,
  HiClock,
  HiOutlineExternalLink,
  HiOutlineExclamationCircle,
  HiX,
} from "react-icons/hi";
import {
  HiMiniAcademicCap,
  HiMiniBuildingOffice,
} from "react-icons/hi2";
import {
  fetchActiveScheduleName,
  fetchTeacherDetailedMetrics,
  fetchTeachers,
  fetchRooms,
  fetchSubjectsDistinct,
  updateTeacher,
  RoomRecord,
  SubjectRecord,
} from "@/app/actions/system";
import { fetchPscsIdByEmail } from "@/app/actions/user";

interface TeacherInfo {
  name: string | null;
  pscs_id: string | null;
  teacher_id: string | null;
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

interface ScheduleEntry {
  day: string;
  subject_name: string;
  start_time: string;
  end_time: string;
  room_name: string;
  section: string;
  units: number;
  code: string;
}

interface TeacherPreferences {
  preferred_rooms: string[];
  preferred_times: string[];
  preferred_years: string[];
  preferred_subjects: string[];
}

/** Convert minutes-from-midnight (e.g. 600 = 10:00 AM, 930 = 3:30 PM) to 12-hour format */
function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "";
  const totalMinutes = parseInt(timeStr.toString().trim(), 10);
  if (isNaN(totalMinutes)) return "";

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  const mm = minutes.toString().padStart(2, "0");
  return `${displayHours}:${mm} ${period}`;
}

export default function TeacherSchedule() {
  const router = useRouter();

  const [scheduleName, setScheduleName] = useState<string | null>(null);
  const [pscsId, setPscsID] = useState<string | null>(null);

  // --- Page Loading States ---
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);

  // --- Error / Empty States ---
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);

  // --- Teacher Info States ---
  const [teacherInfo, setTeacherInfo] = useState<TeacherInfo>({
    name: null,
    pscs_id: null,
    teacher_id: null,
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
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);

  // --- Preferences States ---
  const [teacherPreferences, setTeacherPreferences] = useState<TeacherPreferences>({
    preferred_rooms: [],
    preferred_times: [],
    preferred_years: [],
    preferred_subjects: [],
  });
  const [openPreferencesModal, setOpenPreferencesModal] = useState(false);
  const [activePrefTab, setActivePrefTab] = useState<string>("rooms");
  const [editPreferences, setEditPreferences] = useState<TeacherPreferences>({
    preferred_rooms: [],
    preferred_times: [],
    preferred_years: [],
    preferred_subjects: [],
  });
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  // --- Preferences Modal Form States ---
  const [roomSearchQuery, setRoomSearchQuery] = useState("");
  const [roomSearchResults, setRoomSearchResults] = useState<RoomRecord[]>([]);
  const [roomSearchLoading, setRoomSearchLoading] = useState(false);
  const [showRoomDropdown, setShowRoomDropdown] = useState(false);
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedStartTime, setSelectedStartTime] = useState("");
  const [selectedEndTime, setSelectedEndTime] = useState("");
  const [timeCollision, setTimeCollision] = useState(false);
  const [startTimeInvalid, setStartTimeInvalid] = useState(false);
  const [endTimeInvalid, setEndTimeInvalid] = useState(false);
  
  // --- Subjects search states ---
  const [subjectSearchQuery, setSubjectSearchQuery] = useState("");
  const [subjectSearchResults, setSubjectSearchResults] = useState<SubjectRecord[]>([]);
  const [subjectSearchLoading, setSubjectSearchLoading] = useState(false);
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  
  
  const roomSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subjectSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Generate individual time options from 07:00 to 22:00 in 30-min intervals (10:30 PM excluded) ---
  const TIME_OPTIONS = (() => {
    const options: string[] = [];
    for (let hour = 7; hour <= 22; hour++) {
      for (let min = 0; min < 60; min += 30) {
        if (hour === 22 && min === 30) continue;
        options.push(`${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
      }
    }
    return options;
  })();

  // Helper: format time for display (e.g., "07:00" -> "7:00 AM")
  const formatTimeDisplay = (time: string): string => {
    const [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  // --- Debounced room search ---
  const searchRooms = (query: string) => {
    // Clear previous timeout
    if (roomSearchTimeoutRef.current) {
      clearTimeout(roomSearchTimeoutRef.current);
    }

    // Only search if query has 2+ characters
    if (query.length < 2) {
      setRoomSearchResults([]);
      setShowRoomDropdown(false);
      return;
    }

    // Debounce for 300ms
    roomSearchTimeoutRef.current = setTimeout(async () => {
      setRoomSearchLoading(true);
      const res = await fetchRooms(query, "room_name", "ASC", -1, 1);
      if (res.success && res.data) {
        // Filter out rooms already in edit preferences
        const filtered = res.data.filter(
          (r) => !editPreferences.preferred_rooms.includes(r.room_name)
        );
        setRoomSearchResults(filtered);
        setShowRoomDropdown(true);
      } else {
        setRoomSearchResults([]);
        setShowRoomDropdown(false);
      }
      setRoomSearchLoading(false);
    }, 300);
  };

  // --- Cleanup timeouts on unmount ---
  useEffect(() => {
    return () => {
      if (roomSearchTimeoutRef.current) {
        clearTimeout(roomSearchTimeoutRef.current);
      }
      if (subjectSearchTimeoutRef.current) {
        clearTimeout(subjectSearchTimeoutRef.current);
      }
    };
  }, []);


  // --- Validate start/end time relationship ---
  const validateTimeRange = (start: string, end: string) => {
    if (!start || !end) {
      setStartTimeInvalid(false);
      setEndTimeInvalid(false);
      return;
    }
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);
    setStartTimeInvalid(endMinutes <= startMinutes);
    setEndTimeInvalid(startMinutes >= endMinutes);
  };

  // --- Check if selected time range collides with existing schedule entries ---
  const checkTimeCollision = (day: string, startTime: string, endTime: string) => {
    if (!day || !startTime || !endTime) {
      setTimeCollision(false);
      return;
    }

    const slotStartMinutes = timeToMinutes(startTime);
    const slotEndMinutes = timeToMinutes(endTime);

    // Check against existing schedule entries for the same day
    const hasCollision = scheduleEntries.some(entry => {
      if (entry.day !== day) return false;
      const entryStart = parseInt(entry.start_time, 10);
      const entryEnd = parseInt(entry.end_time, 10);
      return slotStartMinutes < entryEnd && slotEndMinutes > entryStart;
    });

    // Also check against already added preferred times for the same day
    const preferredTimeCollision = editPreferences.preferred_times.some(pref => {
      const parts = pref.split(" ");
      const prefDay = parts[0];
      if (prefDay !== day) return false;
      const timePart = parts.slice(1).join(" ");
      const [prefStart, prefEnd] = timePart.split(" - ");
      const prefStartMinutes = timeToMinutes(prefStart);
      const prefEndMinutes = timeToMinutes(prefEnd);
      return slotStartMinutes < prefEndMinutes && slotEndMinutes > prefStartMinutes;
    });

    setTimeCollision(hasCollision || preferredTimeCollision);
  };
  
  // Helper: convert "HH:MM" to minutes from midnight
  const timeToMinutes = (timeStr: string): number => {
    const [h, m] = timeStr.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  
  // --- Remove preferred room ---
  const removePreferredRoom = (roomName: string) => {
    setEditPreferences(prev => ({
      ...prev,
      preferred_rooms: prev.preferred_rooms.filter(r => r !== roomName),
    }));
  };
  
  // --- Add preferred time ---
  const addPreferredTime = () => {
    if (!selectedDay || !selectedStartTime || !selectedEndTime || timeCollision || startTimeInvalid || endTimeInvalid) return;
    const prefKey = `${selectedDay} ${selectedStartTime} - ${selectedEndTime}`;
    if (editPreferences.preferred_times.includes(prefKey)) {
      setSelectedDay("");
      setSelectedStartTime("");
      setSelectedEndTime("");
      return;
    }
    setEditPreferences(prev => ({
      ...prev,
      preferred_times: [...prev.preferred_times, prefKey],
    }));
    setSelectedDay("");
    setSelectedStartTime("");
    setSelectedEndTime("");
  };
  
  // --- Remove preferred time ---
  const removePreferredTime = (prefKey: string) => {
    setEditPreferences(prev => ({
      ...prev,
      preferred_times: prev.preferred_times.filter(t => t !== prefKey),
    }));
  };

  // --- Debounced subject search ---
  const searchSubjects = (query: string) => {
    if (subjectSearchTimeoutRef.current) {
      clearTimeout(subjectSearchTimeoutRef.current);
    }
    if (query.length < 2) {
      setSubjectSearchResults([]);
      setShowSubjectDropdown(false);
      return;
    }
    subjectSearchTimeoutRef.current = setTimeout(async () => {
      setSubjectSearchLoading(true);
      const res = await fetchSubjectsDistinct(query, null, null, "course_code", "ASC", -1, 1);
      if (res.success && res.data) {
        const filtered = res.data.filter(
          (s) => !editPreferences.preferred_subjects.includes(s.course_name)
        );
        setSubjectSearchResults(filtered);
        setShowSubjectDropdown(true);
      } else {
        setSubjectSearchResults([]);
        setShowSubjectDropdown(false);
      }
      setSubjectSearchLoading(false);
    }, 300);
  };

  // --- Add preferred subject ---
  const addPreferredSubject = (subjectId: string, subjectName: string) => {
    if (editPreferences.preferred_subjects.includes(subjectName)) {
      return;
    }
    setEditPreferences(prev => ({
      ...prev,
      preferred_subjects: [...prev.preferred_subjects, subjectName],
    }));
  };

  // --- Remove preferred subject ---
  const removePreferredSubject = (subjectName: string) => {
    setEditPreferences(prev => ({
      ...prev,
      preferred_subjects: prev.preferred_subjects.filter(s => s !== subjectName),
    }));
  };

  // --- Toggle preferred year ---
  const togglePreferredYear = (yearValue: string) => {
    setEditPreferences(prev => {
      const exists = prev.preferred_years.includes(yearValue);
      return {
        ...prev,
        preferred_years: exists
          ? prev.preferred_years.filter(y => y !== yearValue)
          : [...prev.preferred_years, yearValue],
      };
    });
  };

  // --- Save preferences to database ---
  const savePreferences = async () => {
    if (!teacherInfo.teacher_id) {
      setSaveMessage({ type: 'error', text: 'Teacher ID not found. Cannot save preferences.' });
      return;
    }
    setSavingPreferences(true);
    setSaveMessage(null);
    
    const preferences = {
      preferred_year: editPreferences.preferred_years,
      preferred_rooms: editPreferences.preferred_rooms,
      preferred_times: editPreferences.preferred_times,
      preferred_subjects: editPreferences.preferred_subjects,
    };

    const res = await updateTeacher(teacherInfo.pscs_id || '', teacherInfo.teacher_id, { preferences });
    setSavingPreferences(false);
    
    if (res.success) {
      // Re-fetch teacher data to update display preferences
      if (pscsId) {
        const fetchRes = await fetchTeachers(pscsId, "All Active & On Leave", "All Departments", "surname", "ASC", -1, 1);
        if (fetchRes.success && fetchRes.data && fetchRes.data.length > 0) {
          const teacher = fetchRes.data[0];
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
      setSaveMessage({ type: 'success', text: 'Preferences saved successfully.' });
      setTimeout(() => {
        setSaveMessage(null);
        setOpenPreferencesModal(false);
      }, 1500);
    } else {
      setSaveMessage({ type: 'error', text: res.error || 'Failed to save preferences.' });
    }
  };

  // --- Initial Setup Effect (Fetch Schedule Name & User PSCS ID) ---
  useEffect(() => {
    async function initializeContext() {
      setIsInitializing(true);

      try {
        const [schedRes, userRes] = await Promise.all([
          fetchActiveScheduleName(),
          fetchPscsIdByEmail(),
        ]);

        if (schedRes.success && schedRes.data) {
          setScheduleName(schedRes.data);
          setScheduleError(null);
        } else {
          setScheduleError(
            "No active schedule has been set or configured yet.",
          );
        }

        if (userRes.success && userRes.pscs_id) {
          setPscsID(userRes.pscs_id);
          setUserError(null);
        } else {
          setUserError(
            "User account does not exist or has no linked PSCS ID record.",
          );
        }
      } catch (err) {
        setScheduleError("Failed to initialize schedule data.");
        setUserError("Failed to verify user account details.");
      } finally {
        setIsInitializing(false);
      }
    }

    void initializeContext();
  }, []);

  // --- Fetch basic teacher info as soon as PSCS ID is available (no schedule required) ---
  useEffect(() => {
    async function fetchBasicTeacherInfo() {
      if (!pscsId) return;

      const res = await fetchTeachers(pscsId, "All Active & On Leave", "All Departments", "surname", "ASC", -1, 1);
      if (res.success && res.data && res.data.length > 0) {
        const teacher = res.data[0];
        setTeacherInfo({
          name: teacher.full_name,
          pscs_id: teacher.pscs_id,
          teacher_id: teacher.teacher_id,
          teacher_code: teacher.teacher_code,
          employment_type: teacher.employment_type,
        });
        
        // Load existing preferences from teacher record
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

    void fetchBasicTeacherInfo();
  }, [pscsId]);

  // --- Fetch schedule-dependent data only when both schedule name and PSCS ID are present ---
  useEffect(() => {
    async function fetchTeacherDetails() {
      if (!scheduleName || !pscsId) return;

      setIsLoading(true);

      const res = await fetchTeacherDetailedMetrics(scheduleName, pscsId);
      if (res.success && res.teacher && res.entries) {
        // Update teacher info with schedule-specific data if available
        const teacherData = res.teacher!;
        setTeacherInfo(prev => ({
          name: teacherData.name || prev.name,
          pscs_id: teacherData.pscs_id || prev.pscs_id,
          teacher_id: prev.teacher_id, // Keep teacher_id from basic fetch
          teacher_code: teacherData.teacher_code || prev.teacher_code,
          employment_type: teacherData.employment_type || prev.employment_type,
        }));

        setUnitsAnalysis({
          current_units: teacherData.current_units,
          max_units: teacherData.max_units,
          absolute_max: teacherData.absolute_max,
          remaining_units: teacherData.remaining_units,
          unique_subjects: teacherData.unique_subjects,
          prep_limit: teacherData.prep_limit,
          prep_utilization: teacherData.prep_utilization,
          utilization_rate: teacherData.utilization_rate,
          load_status: teacherData.load_status,
        });

        setScheduleEntries(res.entries);
      }

      setIsLoading(false);
    }

    if (pscsId && scheduleName) {
      void fetchTeacherDetails();
    }
  }, [scheduleName, pscsId]);

  const DAYS_OF_WEEK = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  // --- Initializing Spinner ---
  if (isInitializing) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3">
        <Spinner size="xl" />
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Loading teacher schedule context...
        </span>
      </div>
    );
  }

  // --- User Does Not Exist / Missing ID Error State ---
  if (userError || !pscsId) {
    return (
      <div className="mx-auto mt-12 max-w-lg">
        <Card>
          <div className="py-6 text-center">
            <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-red-400 dark:text-red-500" />
            <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">
              User Profile Not Found
            </h3>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              {userError ||
                "Your account does not have a linked faculty profile in the system."}
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

  // --- No active schedule: show a friendly message but keep the page accessible ---
  // (removed early return so preferences remain available)

  return (
    <div className="m-6 space-y-6 scrollbar-thumb-gray-400 scrollbar-track-transparent">
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
            Teacher Analysis • {scheduleName || "No active schedule"}
          </p>
        </div>
        {scheduleName && (
          <div className={"flex gap-3 justify-end"}>
            <div className="inline-flex items-center rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              {unitsAnalysis.load_status !== null ? (
                unitsAnalysis.load_status
              ) : (
                <Spinner size="sm" />
              )}
            </div>
            <Button
              color="blue"
              size="sm"
              className="cursor-pointer bg-cyan-600 text-white hover:bg-cyan-700"
            >
              <HiOutlineExternalLink className="mr-1.5 h-4 w-4" />
              Export Teacher Schedule
            </Button>
          </div>
        )}
      </div>

      {/* No Schedule Warning Banner */}
      {!scheduleName && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30">
          <div className="flex items-start gap-3">
            <HiOutlineExclamationCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-500 dark:text-yellow-400" />
            <div>
              <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
                No Schedule Set Yet
              </h4>
              <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-400">
                {scheduleError || "There is currently no active schedule configured for the system. You can still manage your preferences below."}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Main Grid: Teacher Profile & Preferences */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Teacher Profile Card (Info + Units Analysis) */}
        <Card className="lg:col-span-2">
          {/* Teacher Information Section */}
          <div className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-gray-200 pb-4 text-sm dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              👥 Teacher Information
            </h3>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">PSCS ID: </span>
                <span className="font-mono text-gray-900 dark:text-white">
                  {teacherInfo.pscs_id !== null ? teacherInfo.pscs_id : <Spinner size="sm" />}
                </span>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Code: </span>
                <span className="font-mono text-gray-900 dark:text-white">
                  {teacherInfo.teacher_code !== null ? teacherInfo.teacher_code : <Spinner size="sm" />}
                </span>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Employment: </span>
                <span className="text-gray-900 dark:text-white">
                  {teacherInfo.employment_type !== null ? teacherInfo.employment_type : <Spinner size="sm" />}
                </span>
              </div>
            </div>
          </div>

          {/* Units Analysis Section */}
          <h3 className="mb-6 text-sm font-semibold text-gray-900 dark:text-white">
            🕒 Units Analysis
          </h3>
          {!scheduleName ? (
            <p className="text-sm italic text-gray-400">
              Schedule data is not available until an active schedule is configured.
            </p>
          ) : (
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
          )}

          {/* Prep Utilization Box */}
          {scheduleName && (
            <>
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
                <div className="mt-2 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-2 rounded-full bg-cyan-600 transition-all duration-300"
                    style={{ width: `${unitsAnalysis.prep_utilization ?? 0}%` }}
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
                <div className="mt-2 h-2.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-2.5 rounded-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${unitsAnalysis.utilization_rate ?? 0}%` }}
                  ></div>
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>
            </>
          )}
        </Card>

        {/* Preferences Card */}
        <Card className="lg:col-span-1">
          <div className="h-full">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                ⚙️ Preferences
              </h3>
              <Button
                size="xs"
                color="blue"
                className="cursor-pointer"
                onClick={() => {
                  setEditPreferences(JSON.parse(JSON.stringify(teacherPreferences)));
                  setOpenPreferencesModal(true);
                }}
              >
                Edit
              </Button>
            </div>

            {/* Preferred Rooms */}
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                Preferred Rooms
              </p>
              {teacherPreferences.preferred_rooms.length > 0 ? (
                <div className="flex overflow-x-auto gap-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
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
                <div className="flex overflow-x-auto gap-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
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
                <div className="flex overflow-x-auto gap-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
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
                <div className="flex overflow-x-auto gap-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
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

      {/* Preferences Modal */}
      <Modal show={openPreferencesModal} onClose={() => {
        setOpenPreferencesModal(false);
        setActivePrefTab("rooms");
        setSaveMessage(null);
      }}>
        <ModalHeader>Teacher Preferences</ModalHeader>
        <ModalBody>
          {/* Tab Navigation */}
          <div className="mb-4 flex border-b border-gray-200 dark:border-gray-700">
            {[
              { id: "rooms", label: "Rooms", icon: <HiMiniBuildingOffice className="h-4 w-4" /> },
              { id: "times", label: "Times", icon: <HiClock className="h-4 w-4" /> },
              { id: "years", label: "Years", icon: <HiMiniAcademicCap className="h-4 w-4" /> },
              { id: "subjects", label: "Subjects", icon: <HiBookOpen className="h-4 w-4" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActivePrefTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                  activePrefTab === tab.id
                    ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Save Message */}
          {saveMessage && (
            <div className={`mb-4 rounded-lg p-3 text-sm ${
              saveMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
            }`}>
              {saveMessage.text}
            </div>
          )}

          {/* Rooms Tab */}
          {activePrefTab === "rooms" && (
            <div>
              <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                Preferred Rooms
              </h4>
              <div className="mb-3">
                <div className="relative">
                  <Label>Room</Label>
                  <TextInput
                    placeholder="Type 2+ characters to search..."
                    value={roomSearchQuery}
                    onChange={(e) => {
                      const value = e.target.value;
                      setRoomSearchQuery(value);
                      searchRooms(value);
                    }}
                    onFocus={() => {
                      if (roomSearchResults.length > 0) {
                        setShowRoomDropdown(true);
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowRoomDropdown(false), 200);
                    }}
                  />
                  {roomSearchLoading && (
                    <div className="absolute right-3 top-8">
                      <Spinner size="sm" />
                    </div>
                  )}
                  {showRoomDropdown && roomSearchResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                      {roomSearchResults.map((room) => (
                        <button
                          key={room.room_id}
                          type="button"
                          className="block w-full px-4 py-2 text-left text-sm text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
                          onClick={() => {
                            if (!editPreferences.preferred_rooms.includes(room.room_name)) {
                              setEditPreferences(prev => ({
                                ...prev,
                                preferred_rooms: [...prev.preferred_rooms, room.room_name],
                              }));
                            }
                            setRoomSearchQuery("");
                            setShowRoomDropdown(false);
                          }}
                        >
                          {room.room_name}
                          {room.floor_level != null && (
                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                              (Floor {room.floor_level})
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {showRoomDropdown && roomSearchResults.length === 0 && roomSearchQuery.length >= 2 && !roomSearchLoading && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-500 shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                      No rooms found
                    </div>
                  )}
                </div>
              </div>
              {editPreferences.preferred_rooms.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {editPreferences.preferred_rooms.map((room, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1">
                      <Badge color="blue">{room}</Badge>
                      <button onClick={() => removePreferredRoom(room)} className="text-gray-400 hover:text-red-500">
                        <HiX className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm italic text-gray-400">No preferred rooms configured yet.</p>
              )}
            </div>
          )}

          {/* Times Tab */}
          {activePrefTab === "times" && (
            <div>
              <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                Preferred Times
              </h4>
              <div className="mb-3 space-y-3">
                <div>
                  <Label>Day</Label>
                  <Select
                    value={selectedDay}
                    onChange={(e) => {
                      setSelectedDay(e.target.value);
                      checkTimeCollision(e.target.value, selectedStartTime, selectedEndTime);
                    }}
                  >
                    <option value="">-- Select a day --</option>
                    {DAYS_OF_WEEK.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </Select>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label>Start Time</Label>
                    <select
                      value={selectedStartTime}
                      onChange={(e) => {
                        setSelectedStartTime(e.target.value);
                        validateTimeRange(e.target.value, selectedEndTime);
                        checkTimeCollision(selectedDay, e.target.value, selectedEndTime);
                      }}
                      className={`mt-1 block w-full rounded-lg border ${startTimeInvalid ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-blue-500 max-h-48`}
                    >
                      <option value="">-- Start --</option>
                      {TIME_OPTIONS.map(time => (
                        <option key={time} value={time}>{formatTimeDisplay(time)}</option>
                      ))}
                    </select>
                    {startTimeInvalid && (
                      <p className="mt-1 text-xs text-red-500">Start time must be before end time</p>
                    )}
                  </div>
                  <div className="flex-1">
                    <Label>End Time</Label>
                    <select
                      value={selectedEndTime}
                      onChange={(e) => {
                        setSelectedEndTime(e.target.value);
                        validateTimeRange(selectedStartTime, e.target.value);
                        checkTimeCollision(selectedDay, selectedStartTime, e.target.value);
                      }}
                      className={`mt-1 block w-full rounded-lg border ${endTimeInvalid ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-blue-500 max-h-48`}
                    >
                      <option value="">-- End --</option>
                      {TIME_OPTIONS.map(time => (
                        <option key={time} value={time}>{formatTimeDisplay(time)}</option>
                      ))}
                    </select>
                    {endTimeInvalid && (
                      <p className="mt-1 text-xs text-red-500">End time must be after start time</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    {timeCollision && (
                      <p className="text-xs text-red-500">Time range conflicts with existing schedule</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    color="blue"
                    className="cursor-pointer"
                    onClick={addPreferredTime}
                    disabled={!selectedDay || !selectedStartTime || !selectedEndTime || timeCollision || startTimeInvalid || endTimeInvalid}
                  >
                    Add
                  </Button>
                </div>
              </div>
              {editPreferences.preferred_times.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {editPreferences.preferred_times.map((pref, idx) => {
                    const parts = pref.split(" ");
                    const day = parts[0];
                    const timeRange = parts.slice(1).join(" ");
                    return (
                      <span key={idx} className="inline-flex items-center gap-1">
                        <Badge color="success">{day} {timeRange}</Badge>
                        <button onClick={() => removePreferredTime(pref)} className="text-gray-400 hover:text-red-500">
                          <HiX className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm italic text-gray-400">No preferred times configured yet.</p>
              )}
            </div>
          )}

          {/* Years Tab */}
          {activePrefTab === "years" && (
            <div>
              <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                Preferred Year Levels
              </h4>
              <div className="flex flex-wrap items-center gap-6">
                {[
                  { value: "SHS 11", label: "SHS 11" },
                  { value: "SHS 12", label: "SHS 12" },
                  { value: "Year 1", label: "Year 1" },
                  { value: "Year 2", label: "Year 2" },
                  { value: "Year 3", label: "Year 3" },
                  { value: "Year 4", label: "Year 4" },
                ].map((year) => (
                  <div key={year.value} className="flex items-center gap-3">
                    <Label>{year.label}</Label>
                    <ToggleSwitch
                      checked={editPreferences.preferred_years.includes(year.value)}
                      onChange={() => togglePreferredYear(year.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subjects Tab */}
          {activePrefTab === "subjects" && (
            <div>
              <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                Preferred Subjects
              </h4>
              <div className="mb-3">
                <div className="relative">
                  <Label>Subject</Label>
                  <TextInput
                    placeholder="Type 2+ characters to search..."
                    value={subjectSearchQuery}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSubjectSearchQuery(value);
                      searchSubjects(value);
                    }}
                    onFocus={() => {
                      if (subjectSearchResults.length > 0) {
                        setShowSubjectDropdown(true);
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowSubjectDropdown(false), 200);
                    }}
                  />
                  {subjectSearchLoading && (
                    <div className="absolute right-3 top-8">
                      <Spinner size="sm" />
                    </div>
                  )}
                  {showSubjectDropdown && subjectSearchResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                      {subjectSearchResults.map((subject) => (
                        <button
                          key={subject.subject_id}
                          type="button"
                          className="block w-full px-4 py-2 text-left text-sm text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
                          onClick={() => {
                            addPreferredSubject(subject.subject_id, subject.course_name);
                            setSubjectSearchQuery("");
                            setShowSubjectDropdown(false);
                          }}
                        >
                          {subject.course_name}
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                            ({subject.course_code})
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {showSubjectDropdown && subjectSearchResults.length === 0 && subjectSearchQuery.length >= 2 && !subjectSearchLoading && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-500 shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                      No subjects found
                    </div>
                  )}
                </div>
              </div>
              {editPreferences.preferred_subjects.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {editPreferences.preferred_subjects.map((subject, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1">
                      <Badge color="purple">{subject}</Badge>
                      <button onClick={() => removePreferredSubject(subject)} className="text-gray-400 hover:text-red-500">
                        <HiX className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm italic text-gray-400">No preferred subjects configured yet.</p>
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="gray" onClick={() => {
            setOpenPreferencesModal(false);
            setActivePrefTab("rooms");
            setSaveMessage(null);
          }}>
            Close
          </Button>
          <Button
            color="blue"
            onClick={savePreferences}
            disabled={savingPreferences}
            className="cursor-pointer"
          >
            {savingPreferences ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Saving...
              </>
            ) : (
              'Save Preferences'
            )}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Schedule by Day Section */}
      {scheduleName && (
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
              <Card key={day} className="flex flex-col justify-between">
                <div>
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
                            <div>
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
      )}

      {/* Subject Breakdown Table Section */}
      {scheduleName && (
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
      )}
    </div>
  );
}