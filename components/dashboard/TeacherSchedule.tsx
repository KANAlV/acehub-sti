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
} from "flowbite-react";
import {
  HiArrowLeft,
  HiOutlineExternalLink,
  HiOutlineExclamationCircle,
  HiX,
} from "react-icons/hi";
import {
  fetchActiveScheduleName,
  fetchTeacherDetailedMetrics,
  fetchRooms,
  RoomRecord,
} from "@/app/actions/system";
import { fetchPscsIdByEmail } from "@/app/actions/user";

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
  });
  const [openPreferencesModal, setOpenPreferencesModal] = useState(false);
  
  // --- Preferences Modal Form States ---
  const [roomSearchQuery, setRoomSearchQuery] = useState("");
  const [roomSearchResults, setRoomSearchResults] = useState<RoomRecord[]>([]);
  const [roomSearchLoading, setRoomSearchLoading] = useState(false);
  const [showRoomDropdown, setShowRoomDropdown] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedRoomName, setSelectedRoomName] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("");
  const [timeCollision, setTimeCollision] = useState(false);
  const roomSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Generate time slots from 07:00 to 21:00 in 30-min intervals ---
  const TIME_SLOTS = (() => {
    const slots: string[] = [];
    for (let hour = 7; hour < 21; hour++) {
      for (let min = 0; min < 60; min += 30) {
        const start = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
        const nextMin = min + 30;
        const nextHour = nextMin >= 60 ? hour + 1 : hour;
        const nextMinDisplay = nextMin >= 60 ? 0 : nextMin;
        const end = `${String(nextHour).padStart(2, "0")}:${String(nextMinDisplay).padStart(2, "0")}`;
        slots.push(`${start} - ${end}`);
      }
    }
    return slots;
  })();

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
        // Filter out rooms already in preferences
        const filtered = res.data.filter(
          (r) => !teacherPreferences.preferred_rooms.includes(r.room_name)
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

  // --- Cleanup timeout on unmount ---
  useEffect(() => {
    return () => {
      if (roomSearchTimeoutRef.current) {
        clearTimeout(roomSearchTimeoutRef.current);
      }
    };
  }, []);

  // --- Check if selected time slot collides with existing schedule entries ---
  const checkTimeCollision = (day: string, timeSlot: string) => {
    if (!day || !timeSlot) {
      setTimeCollision(false);
      return;
    }
    
    const [slotStart, slotEnd] = timeSlot.split(" - ");
    const slotStartMinutes = timeToMinutes(slotStart);
    const slotEndMinutes = timeToMinutes(slotEnd);
    
    // Check against existing schedule entries for the same day
    const hasCollision = scheduleEntries.some(entry => {
      if (entry.day !== day) return false;
      const entryStart = parseInt(entry.start_time, 10);
      const entryEnd = parseInt(entry.end_time, 10);
      // Collision if ranges overlap
      return slotStartMinutes < entryEnd && slotEndMinutes > entryStart;
    });
    
    // Also check against already added preferred times for the same day
    const preferredTimeCollision = teacherPreferences.preferred_times.some(pref => {
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
  
  // --- Add preferred room ---
  const addPreferredRoom = () => {
    if (!selectedRoomId || !selectedRoomName) return;
    if (teacherPreferences.preferred_rooms.includes(selectedRoomName)) {
      setSelectedRoomId("");
      setSelectedRoomName("");
      setRoomSearchQuery("");
      setShowRoomDropdown(false);
      return;
    }
    setTeacherPreferences(prev => ({
      ...prev,
      preferred_rooms: [...prev.preferred_rooms, selectedRoomName],
    }));
    setSelectedRoomId("");
    setSelectedRoomName("");
    setRoomSearchQuery("");
    setShowRoomDropdown(false);
  };
  
  // --- Remove preferred room ---
  const removePreferredRoom = (roomName: string) => {
    setTeacherPreferences(prev => ({
      ...prev,
      preferred_rooms: prev.preferred_rooms.filter(r => r !== roomName),
    }));
  };
  
  // --- Add preferred time ---
  const addPreferredTime = () => {
    if (!selectedDay || !selectedTimeSlot || timeCollision) return;
    const prefKey = `${selectedDay} ${selectedTimeSlot}`;
    if (teacherPreferences.preferred_times.includes(prefKey)) {
      setSelectedDay("");
      setSelectedTimeSlot("");
      return;
    }
    setTeacherPreferences(prev => ({
      ...prev,
      preferred_times: [...prev.preferred_times, prefKey],
    }));
    setSelectedDay("");
    setSelectedTimeSlot("");
    setTimeCollision(false);
  };
  
  // --- Remove preferred time ---
  const removePreferredTime = (prefKey: string) => {
    setTeacherPreferences(prev => ({
      ...prev,
      preferred_times: prev.preferred_times.filter(t => t !== prefKey),
    }));
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

  // --- Data Fetching Effect once Schedule Name and PSCS ID are present ---
  useEffect(() => {
    async function fetchTeacherDetails() {
      if (!scheduleName || !pscsId) return;

      setIsLoading(true);

      const res = await fetchTeacherDetailedMetrics(scheduleName, pscsId);
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

  // --- Schedule Not Set / Does Not Exist Error State ---
  if (scheduleError || !scheduleName) {
    return (
      <div className="mx-auto mt-12 max-w-lg">
        <Card>
          <div className="py-6 text-center">
            <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-yellow-400 dark:text-yellow-500" />
            <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">
              Active Schedule Not Set
            </h3>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              {scheduleError ||
                "There is currently no active schedule configured for the system."}
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
            Teacher Analysis • {scheduleName}
          </p>
        </div>
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
      </div>

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
                onClick={() => setOpenPreferencesModal(true)}
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
            <div>
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
          </div>
        </Card>
      </div>

      {/* Preferences Modal */}
      <Modal show={openPreferencesModal} onClose={() => setOpenPreferencesModal(false)}>
        <ModalHeader>Teacher Preferences</ModalHeader>
        <ModalBody>
          <div className="space-y-6">
            {/* Preferred Rooms Section */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                Preferred Rooms
              </h4>
              
              {/* Add Room Search */}
              <div className="mb-3 flex gap-2">
                <div className="flex-1 relative">
                  <Label>Room</Label>
                  <TextInput
                    placeholder="Type 2+ characters to search..."
                    value={selectedRoomName || roomSearchQuery}
                    onChange={(e) => {
                      const value = e.target.value;
                      setRoomSearchQuery(value);
                      setSelectedRoomId("");
                      setSelectedRoomName("");
                      searchRooms(value);
                    }}
                    onFocus={() => {
                      if (roomSearchResults.length > 0) {
                        setShowRoomDropdown(true);
                      }
                    }}
                    onBlur={() => {
                      // Delay to allow click on dropdown items
                      setTimeout(() => setShowRoomDropdown(false), 200);
                    }}
                  />
                  {roomSearchLoading && (
                    <div className="absolute right-3 top-8">
                      <Spinner size="sm" />
                    </div>
                  )}
                  {/* Dropdown Suggestions */}
                  {showRoomDropdown && roomSearchResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                      {roomSearchResults.map((room) => (
                        <button
                          key={room.room_id}
                          type="button"
                          className="block w-full px-4 py-2 text-left text-sm text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
                          onClick={() => {
                            setSelectedRoomId(room.room_id);
                            setSelectedRoomName(room.room_name);
                            setRoomSearchQuery(room.room_name);
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
                <Button
                  size="sm"
                  color="blue"
                  className="self-end mb-0.5 cursor-pointer"
                  onClick={addPreferredRoom}
                  disabled={!selectedRoomId || !selectedRoomName}
                >
                  Add
                </Button>
              </div>
              
              {/* Room Badges */}
              {teacherPreferences.preferred_rooms.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {teacherPreferences.preferred_rooms.map((room, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1">
                      <Badge color="blue">{room}</Badge>
                      <button
                        onClick={() => removePreferredRoom(room)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <HiX className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm italic text-gray-400">No preferred rooms configured yet.</p>
              )}
            </div>

            {/* Preferred Times Section */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                Preferred Times
              </h4>
              
              {/* Add Time Day + Slot */}
              <div className="mb-3 flex gap-2">
                <div className="flex-1">
                  <Label>Day</Label>
                  <Select
                    value={selectedDay}
                    onChange={(e) => {
                      setSelectedDay(e.target.value);
                      checkTimeCollision(e.target.value, selectedTimeSlot);
                    }}
                  >
                    <option value="">-- Select a day --</option>
                    {DAYS_OF_WEEK.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </Select>
                </div>
                <div className="flex-1">
                  <Label>Time Slot</Label>
                  <Select
                    value={selectedTimeSlot}
                    onChange={(e) => {
                      setSelectedTimeSlot(e.target.value);
                      checkTimeCollision(selectedDay, e.target.value);
                    }}
                    className={timeCollision ? "border-red-500" : ""}
                  >
                    <option value="">-- Select a time --</option>
                    {TIME_SLOTS.map(slot => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </Select>
                  {timeCollision && (
                    <p className="mt-1 text-xs text-red-500">Time slot conflicts with existing schedule</p>
                  )}
                </div>
                <Button
                  size="sm"
                  color="blue"
                  className="self-end mb-0.5 cursor-pointer"
                  onClick={addPreferredTime}
                  disabled={!selectedDay || !selectedTimeSlot || timeCollision}
                >
                  Add
                </Button>
              </div>
              
              {/* Time Badges */}
              {teacherPreferences.preferred_times.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {teacherPreferences.preferred_times.map((pref, idx) => {
                    const parts = pref.split(" ");
                    const day = parts[0];
                    const timeSlot = parts.slice(1).join(" ");
                    return (
                      <span key={idx} className="inline-flex items-center gap-1">
                        <Badge color="success">{day} {timeSlot}</Badge>
                        <button
                          onClick={() => removePreferredTime(pref)}
                          className="text-gray-400 hover:text-red-500"
                        >
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
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="gray" onClick={() => setOpenPreferencesModal(false)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>

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
                            <Button
                              size="xs"
                              color="alternative"
                              className="cursor-pointer"
                            >
                              Transfer
                            </Button>
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

      {/* Subject Breakdown Table Section */}
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
    </div>
  );
}