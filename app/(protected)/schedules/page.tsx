"use client";

import {
  Button,
  HelperText,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Progress,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TextInput,
  Toast,
  ToastToggle,
  Radio,
  Select,
  Badge,
  Checkbox,
  Accordion,
  AccordionPanel,
  AccordionTitle,
  AccordionContent,
  ToggleSwitch,
  Tooltip,
} from "flowbite-react";
import TablePaginationFooter from "@/components/TablePaginationFooter";
import {
  filterAlphanumericDashUnderscore,
  filterAlphanumericDashUnderscoreComma,
} from "@/utils/validation";
import { FaPlus, FaSortDown, FaSortUp } from "react-icons/fa6";
import { HiCheck, HiExclamation, HiX, HiSearch } from "react-icons/hi";
import { MdContentCopy } from "react-icons/md";
import {
  useEffect,
  useState,
  ChangeEvent,
  useCallback,
  startTransition,
  useMemo,
} from "react";
import { HiChevronRight } from "react-icons/hi2";
import { useRouter } from "next/navigation";
import {
  fetchSchedules,
  fetchCurricula,
  fetchPrograms,
  ProgramRecord,
  saveGeneratedSchedule,
  SubjectRequirementRecord,
  fetchTimetableEntriesByScheduleId,
  TimetableEntryRecord,
  fetchTeachersWithAqFcceAndPreferences,
  TimePreference,
} from "@/app/actions/system";
import {
  assignSubjectsToSections,
  SectionSubjectAssignment,
  AssignedSubjectDetail,
  generateProgramSections,
  generateRoomAndClassSchedules,
  generateRoomAndClassSchedulesWithTeachers,
  assignTeachersToSchedule,
  ScheduleEntry,
  fetchSubjectsForGeneration,
  TeacherRecord as GenerationTeacherRecord,
  type CurriculumGenerationSelection,
} from "@/app/actions/AutoScheduleGeneration";
import Image from "next/image";
import { getTeacherPreferenceMatchScore } from "@/utils/autoSchedulePreferences";
import { getCurriculumYearCoverageStatus } from "@/utils/curriculumYearCoverage";
import {
  buildScheduleCopyTree,
  getCopySelectionState,
  getScheduleCopySubjectKey,
  toggleScheduleCopySelection,
  type ScheduleCopyProgramNode,
} from "@/utils/scheduleCopySelection";

// For Debugging Only (Developer-controlled code flag)
const testMode = true;

// --- Types matching database statement schema --- //
export interface ScheduleRecord {
  schedule_id: string; // uuid PRIMARY KEY (hidden from UI, used as key)
  schedule_name: string | null; // text
  generation_config: { description?: string } | null; // jsonb holding description
  created_at: string; // timestamp with time zone
}

export interface CurriculumRecord {
  curriculum_id: string;
  curriculum_version: string;
  created_at: string;
}

interface SaveScheduleEntryPayload {
  subject_id: string | null;
  teacher_id: string | null;
  room_id: string | null;
  section: string;
  day: string;
  start_time: number;
  end_time: number;
  type: string; // Added type field
}

function toSaveScheduleEntryPayload(
  entry: TimetableEntryRecord,
): SaveScheduleEntryPayload {
  return {
    subject_id: entry.subject_id || null,
    teacher_id: entry.teacher_id || null,
    room_id: entry.room_id || null,
    section: entry.section,
    day: entry.day,
    start_time: entry.start_time,
    end_time: entry.end_time,
    type: entry.type,
  };
}

export default function ScheduleManagement() {
  const router = useRouter();
  const [isLoading, setLoading] = useState(true);

  // --- Table & View Filter State --- //
  const [records, setRecords] = useState<ScheduleRecord[]>([]);
  const [sortScheduleBy, setSortScheduleBy] = useState("created_at");
  const [sortScheduleDir, setSortScheduleDir] = useState("DESC");
  const [searchTerm, setSearchTerm] = useState("");

  // --- Modal States & Wizard Steps --- //
  const [openAddModal, setOpenAddModal] = useState(false);
  const [addStep, setAddStep] = useState<"selection" | "form">("selection");
  const [isCopyFlow, setIsCopyFlow] = useState(false);
  const [openCopySelectionModal, setOpenCopySelectionModal] = useState(false);
  const [copySourceSchedule, setCopySourceSchedule] =
    useState<ScheduleRecord | null>(null);
  const [copySourceEntries, setCopySourceEntries] = useState<
    TimetableEntryRecord[]
  >([]);
  const [copySelection, setCopySelection] = useState<Set<string>>(new Set());
  const [copyEntriesToCarry, setCopyEntriesToCarry] = useState<
    TimetableEntryRecord[]
  >([]);
  const [isLoadingCopyEntries, setIsLoadingCopyEntries] = useState(false);
  const [creationMode, setCreationMode] = useState<
    "auto" | "semi-auto" | "template"
  >("auto");
  const [autoAssignRoom, setAutoAssignRoom] = useState<boolean>(true);

  // --- Curriculum & Program Selection States (Integrated into Auto-Generation Wizard) --- //
  const [programs, setPrograms] = useState<ProgramRecord[]>([]);
  const [recommendedConstraints, setRecommendedConstraints] = useState(0);
  const [curricula, setCurricula] = useState<CurriculumRecord[]>([]);
  const [curriculaSearch, setCurriculaSearch] = useState("");
  const [curriculumAdd, setCurriculumAdd] = useState<CurriculumRecord[]>([]);
  const [curriculumYearSelections, setCurriculumYearSelections] = useState<
    Record<string, string[]>
  >({});
  const [isCurriculaSearching, setIsCurriculaSearching] =
    useState<boolean>(false);
  const [selectedCurriculumFilter, setSelectedCurriculumFilter] =
    useState<string>("ALL");
  const [isSubmittingAutoGeneration, setIsSubmittingAutoGeneration] =
    useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [generationStatusText, setGenerationStatusText] = useState<string>("");
  const [openLoadingModal, setOpenLoadingModal] = useState<boolean>(false); // Dedicated loading modal state

  // --- AQ Warning Modal State --- //
  const [openAqWarningModal, setOpenAqWarningModal] = useState<boolean>(false);
  const [subjectsWithoutAq, setSubjectsWithoutAq] = useState<
    SubjectRequirementRecord[]
  >([]);
  const [pendingAutoPayload, setPendingAutoPayload] = useState<{
    scheduleName: string;
    curriculumIds: string[];
    tertiaryTerm: string;
    shsTerm: string;
    curriculumSelections: CurriculumGenerationSelection[];
  } | null>(null);

  // --- Testing State: Preview generated data modals --- //
  const [assignedSectionsResult, setAssignedSectionsResult] = useState<
    SectionSubjectAssignment[] | null
  >(null);
  const [scheduleEntriesResult, setScheduleEntriesResult] = useState<
    ScheduleEntry[] | null
  >(null);

  // Independent dropdown selectors + display format control ("timetable" or "table")
  const [displayFormat, setDisplayFormat] = useState<"timetable" | "table">(
    "timetable",
  );
  const [selectedTimetableSection, setSelectedTimetableSection] =
    useState<string>("ALL");
  const [selectedTimetableRoom, setSelectedTimetableRoom] =
    useState<string>(""); // Default to first/specific room when section is ALL

  const [openResultsModal, setOpenResultsModal] = useState<boolean>(false);
  const [openTimetableModal, setOpenTimetableModal] = useState<boolean>(false);

  // --- Form & Validation States --- //
  const [scheduleNameError, setScheduleNameError] = useState("");

  // Add Form State (Common / Template mode)
  const [addScheduleName, setAddScheduleName] = useState("");
  const [addScheduleDescription, setAddScheduleDescription] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");

  // Auto Assign / Generation Specific State
  const [selectedTertiaryTerm, setSelectedTertiaryTerm] = useState("Semester 1");
  const [selectedShsTerm, setSelectedShsTerm] = useState("Term 1");

  // --- Teacher Preferences Step State --- //
  const [autoStep, setAutoStep] = useState<"setup" | "teachers">("setup");
  const [openTeacherDetailModal, setOpenTeacherDetailModal] = useState(false);
  const [selectedTeacherForDetail, setSelectedTeacherForDetail] = useState<TeacherRecord | null>(null);
  const [teacherTab, setTeacherTab] = useState<"All" | "Full-Time" | "Part-Time Full Load" | "Part-Time">("All");
  const [teacherSearchQuery, setTeacherSearchQuery] = useState("");
  const [teacherSearchDebounced, setTeacherSearchDebounced] = useState("");
  const [teacherPreferenceTab, setTeacherPreferenceTab] = useState<"overview" | "preferred_rooms" | "preferred_times" | "preferred_year" | "preferred_subjects">("overview");
  const [teacherList, setTeacherList] = useState<TeacherRecord[]>([]);
  const [isTeacherListLoading, setIsTeacherListLoading] = useState(false);
  const [teacherPreferenceOverrides, setTeacherPreferenceOverrides] = useState<
    Map<string, Map<string, boolean>>
  >(new Map()); // teacherId -> preferenceKey -> enabled

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
      preferred_times?: TimePreference[];
      preferred_year?: string[];
      preferred_subjects?: string[];
    };
  }

  // --- Pagination State --- //
  const maxRowSchedule = 10;
  const [currentSchedulePage, setCurrentSchedulePage] = useState(1);
  const [pageChanging, setPageChanging] = useState(false);

  // --- Toast State --- //
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [showToastTimer, setShowToastTimer] = useState(false);
  const [progress, setProgress] = useState(0);

  /** --- Validation Helpers --- **/
  const validateScheduleName = (val: string): string => {
    const trimmed = val.trim();
    if (!trimmed) return "Schedule name is required.";
    if (trimmed.length < 3)
      return "Schedule name must be at least 3 characters.";
    return "";
  };

  /** --- Input Handlers using utils/validation.ts --- **/
  const handleAddScheduleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const sanitized = filterAlphanumericDashUnderscoreComma(
      e.target.value,
    ).slice(0, 150);
    setAddScheduleName(sanitized);
    setScheduleNameError(validateScheduleName(sanitized));
  };

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    const sanitized = filterAlphanumericDashUnderscore(e.target.value);
    setSearchTerm(sanitized);
    setCurrentSchedulePage(1);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setCurrentSchedulePage(1);
  };

  /** --- Table Sorting & Pagination Handlers --- **/
  function handleScheduleSorting(sortBy: string) {
    const newDir =
      sortBy === sortScheduleBy && sortScheduleDir === "ASC" ? "DESC" : "ASC";
    setSortScheduleBy(sortBy);
    setSortScheduleDir(newDir);
    setRecords([]);
    setCurrentSchedulePage(1);
    void getScheduleRecords(searchTerm, sortBy, newDir, maxRowSchedule, 1);
  }

  function onPageChangeSchedule(page: number) {
    if (pageChanging) return;

    setPageChanging(true);
    setRecords([]);
    void getScheduleRecords(
      searchTerm,
      sortScheduleBy,
      sortScheduleDir,
      maxRowSchedule,
      page,
    );
    setPageChanging(false);
    setCurrentSchedulePage(page);
  }

  const handleCloseModals = () => {
    setScheduleNameError("");
    setOpenAddModal(false);
    setOpenCopySelectionModal(false);
    setOpenAqWarningModal(false);
    setIsCopyFlow(false);
    setCopyEntriesToCarry([]);
    setAddStep("selection");
    setCreationMode("auto");
    setAutoAssignRoom(false);
    setAddScheduleName("");
    setAddScheduleDescription("");
    setSelectedTertiaryTerm("Semester 1");
    setSelectedShsTerm("Term 1");
    setSelectedTemplate("");
    setCurriculumAdd([]);
    setCurriculumYearSelections({});
    setCurriculaSearch("");
    setIsCurriculaSearching(false);
    setSelectedCurriculumFilter("ALL");
    setGenerationProgress(0);
    setGenerationStatusText("");
    setPendingAutoPayload(null);
  };

  // --- Curriculum & Benchmark Loaders --- //
  const loadProgramsAndBenchmarks = useCallback(async () => {
    const resProgram = await fetchPrograms(
      null,
      "all",
      "program_code",
      "ASC",
      0,
    );
    let programsCount = 0;
    let strandCount = 0;

    if (resProgram.success && resProgram.data) {
      setPrograms(resProgram.data);
      resProgram.data.forEach((item) => {
        if (item.year_level === "tertiary") {
          programsCount += 1;
        } else {
          strandCount += 1;
        }
      });
    }
    setRecommendedConstraints(programsCount + strandCount);
  }, []);

  useEffect(() => {
    document.title = "AceHub | Schedules";
  }, []);

  useEffect(() => {
    void loadProgramsAndBenchmarks();
  }, [loadProgramsAndBenchmarks]);

  useEffect(() => {
    async function getCurricula() {
      setIsCurriculaSearching(true);
      const curriculaData = await fetchCurricula(curriculaSearch);
      if (curriculaData.success) {
        setCurricula(curriculaData.data);
      } else {
        setCurricula([]);
      }
      setIsCurriculaSearching(false);
    }

    if (curriculaSearch.length >= 2) {
      void getCurricula();
    } else {
      setCurricula([]);
      setIsCurriculaSearching(false);
    }
  }, [curriculaSearch]);

  const handleAddCurriculum = (input: CurriculumRecord) => {
    setCurriculaSearch("");
    setCurricula([]);
    setCurriculumAdd((prev) => [...prev, input]);
    setCurriculumYearSelections((prev) => ({
      ...prev,
      [input.curriculum_id]:
        prev[input.curriculum_id] ||
        (isShsCurriculum(input) ? ["11", "12"] : ["1", "2", "3", "4"]),
    }));
  };

  const handleRemoveCurriculum = (input: CurriculumRecord) => {
    setCurriculumAdd((prev) =>
      prev.filter(
        (curriculum) => curriculum.curriculum_id !== input.curriculum_id,
      ),
    );
    setCurriculumYearSelections((prev) => {
      const next = { ...prev };
      delete next[input.curriculum_id];
      return next;
    });
    if (selectedCurriculumFilter !== "ALL") {
      setCurriculaSearch(selectedCurriculumFilter);
    }
  };

  // --- Step 1: Trigger Auto Generation & Run Subject Check First --- //
  async function handleAutoGenerationSubmit() {
    const canCopyWithoutNewCurricula =
      isCopyFlow && copyEntriesToCarry.length > 0;
    if (
      !addScheduleName.trim() ||
      !!scheduleNameError ||
      (curriculumAdd.length === 0 && !canCopyWithoutNewCurricula) ||
      (curriculumAdd.length > 0 && !hasSelectedCurriculumYear)
    )
      return;

    const scheduleNameTrimmed = addScheduleName.trim();
    const curriculumIds = curriculumAdd.map((item) => item.curriculum_id);
    const curriculumSelections = getCurriculumGenerationSelections();

    if (curriculumIds.length === 0 && canCopyWithoutNewCurricula) {
      setOpenAddModal(false);
      await executeAutoGenerationPipeline(
        scheduleNameTrimmed,
        [],
        selectedTertiaryTerm,
        creationMode === "auto" ? [] : undefined,
        [],
        selectedShsTerm,
      );
      return;
    }

    // Close wizard modal and show quick status or proceed directly
    setOpenAddModal(false);
    setOpenLoadingModal(true);
    setIsSubmittingAutoGeneration(true);
    setGenerationProgress(10);
    setGenerationStatusText("Fetching and checking subject requirements...");

    // 1. Fetch subjects first as requested
    const subjectRes = await fetchSubjectsForGeneration(
      curriculumIds,
      selectedTertiaryTerm,
      selectedShsTerm,
      curriculumSelections,
    );
    if (testMode) {console.log("=== SUBJECTS FOR GENERATION RESPONSE ===", subjectRes);}
    if (!subjectRes.success || !subjectRes.data) {
      setIsSubmittingAutoGeneration(false);
      setOpenLoadingModal(false);
      setToastMessage(
        subjectRes.error || "Failed to fetch subject requirements.",
      );
      setToastType("error");
      setShowToast(true);
      return;
    }

    const allSubjects = subjectRes.data;
    if (allSubjects.length === 0) {
      if (canCopyWithoutNewCurricula) {
        await executeAutoGenerationPipeline(
          scheduleNameTrimmed,
          [],
          selectedTertiaryTerm,
          creationMode === "auto" ? [] : undefined,
          [],
          selectedShsTerm,
        );
        return;
      }
      setIsSubmittingAutoGeneration(false);
      setOpenLoadingModal(false);
      setToastMessage(
        "No subjects match the selected curricula, grade/year levels, and terms.",
      );
      setToastType("error");
      setShowToast(true);
      return;
    }

    // 2. Check for subjects without AQ entries (required_aqs is null, undefined, or empty array)
    const missingAqSubjects = allSubjects.filter((sub) => {
      const aqs = sub.required_aqs;
      return !aqs || (Array.isArray(aqs) && aqs.length === 0);
    });

    if (missingAqSubjects.length > 0) {
      // Store payload and show warning modal, pausing the loader modal
      setSubjectsWithoutAq(missingAqSubjects);
      setPendingAutoPayload({
        scheduleName: scheduleNameTrimmed,
        curriculumIds,
        tertiaryTerm: selectedTertiaryTerm,
        shsTerm: selectedShsTerm,
        curriculumSelections,
      });
      setOpenLoadingModal(false);
      setIsSubmittingAutoGeneration(false);
      setOpenAqWarningModal(true);
      return;
    }

    // If all subjects have AQs, proceed to teacher selection (Auto mode only)
    if (creationMode === "auto") {
      setOpenLoadingModal(false);
      setIsSubmittingAutoGeneration(false);
      setAutoStep("teachers");
      loadTeachers();
    } else {
      // Semi-Auto mode: proceed directly to generation
      await executeAutoGenerationPipeline(
        scheduleNameTrimmed,
        curriculumIds,
        selectedTertiaryTerm,
        undefined,
        curriculumSelections,
        selectedShsTerm,
      );
    }
  }

  async function executeAutoGenerationPipeline(
    scheduleName: string,
    curriculumIds: string[],
    tertiaryTerm: string,
    teachersForGeneration?: GenerationTeacherRecord[],
    curriculumSelections: CurriculumGenerationSelection[] =
      getCurriculumGenerationSelections(),
    shsTerm: string = selectedShsTerm,
  ) {
    setOpenAqWarningModal(false);
    setOpenLoadingModal(true);
    setIsSubmittingAutoGeneration(true);
    setGenerationProgress(20);
    setGenerationStatusText("Fetching subject requirements...");

    if (isCopyFlow && curriculumIds.length === 0 && copyEntriesToCarry.length > 0) {
      setGenerationStatusText("Saving copied schedule entries...");
      const saveRes = await saveGeneratedSchedule({
        scheduleName,
        generationConfig: {
          description:
            addScheduleDescription.trim() || "Copied selected schedule entries",
        },
        entries: copyEntriesToCarry.map(toSaveScheduleEntryPayload),
      });
      setGenerationProgress(100);
      setIsSubmittingAutoGeneration(false);
      setOpenLoadingModal(false);

      if (saveRes.success) {
        router.push(`/schedules/${encodeURIComponent(scheduleName)}`);
        setToastMessage("Copied schedule entries saved successfully.");
        setToastType("success");
        toastTimer();
        void getScheduleRecords();
      } else {
        setToastMessage(saveRes.error || "Failed to save copied schedule entries.");
        setToastType("error");
        setShowToast(true);
      }
      return;
    }

    // 1. Fetch subjects here so they are available to both branches
    const subjectRes = await fetchSubjectsForGeneration(
      curriculumIds,
      tertiaryTerm,
      shsTerm,
      curriculumSelections,
    );
    if (!subjectRes.success || !subjectRes.data) {
      setIsSubmittingAutoGeneration(false);
      setOpenLoadingModal(false);
      setToastMessage(
        subjectRes.error || "Failed to fetch subject requirements.",
      );
      setToastType("error");
      setShowToast(true);
      return;
    }
    const allSubjects = subjectRes.data;
    if (allSubjects.length === 0) {
      setIsSubmittingAutoGeneration(false);
      setOpenLoadingModal(false);
      setToastMessage(
        "No subjects match the selected curricula, grade/year levels, and terms.",
      );
      setToastType("error");
      setShowToast(true);
      return;
    }

    // Step A: Run section generation
    setGenerationProgress(40);
    setGenerationStatusText("Initializing program sections generation...");

    const sectionRes = await generateProgramSections(
      scheduleName,
      curriculumIds,
      tertiaryTerm,
      shsTerm,
      allSubjects.map((subject) => subject.program_code || ""),
    );
    console.log("=== GENERATED SECTIONS RESULT ===", sectionRes);

    if (
      !sectionRes.success ||
      !sectionRes.sections ||
      sectionRes.sections.length === 0
    ) {
      setIsSubmittingAutoGeneration(false);
      setOpenLoadingModal(false);
      setToastMessage(
        sectionRes.error || "Failed to generate program sections.",
      );
      setToastType("error");
      setShowToast(true);
      return;
    }

    setGenerationProgress(65);

    let isSuccess = false;
    let errorMessage = "";
    let entriesPayload: SaveScheduleEntryPayload[] = [];
    const copiedSectionSubjectKeys = new Set(
      copyEntriesToCarry.map(
        (entry) =>
          `${entry.section.trim().toUpperCase()}::${entry.subject_id.trim().toUpperCase()}`,
      ),
    );
    const copiedSectionCourseKeys = new Set(
      copyEntriesToCarry.map(
        (entry) =>
          `${entry.section.trim().toUpperCase()}::${entry.course_code.trim().toUpperCase()}`,
      ),
    );
    const isCopiedSubject = (
      sectionCode: string,
      subjectId: string,
      courseCode: string,
    ) => {
      const normalizedSection = sectionCode.trim().toUpperCase();
      return (
        copiedSectionSubjectKeys.has(
          `${normalizedSection}::${subjectId.trim().toUpperCase()}`,
        ) ||
        copiedSectionCourseKeys.has(
          `${normalizedSection}::${courseCode.trim().toUpperCase()}`,
        )
      );
    };

    if (autoAssignRoom && creationMode === "auto") {
      setGenerationStatusText(
        `Generated ${sectionRes.sections.length} sections. Running room allocation and timetable generation...`,
      );

      const roomScheduleRes = await generateRoomAndClassSchedulesWithTeachers(
        scheduleName,
        curriculumIds,
        tertiaryTerm,
        teachersForGeneration ?? [],
        sectionRes.sections,
        allSubjects,
        shsTerm,
        testMode,
      );
      console.log(
        "=== ROOM & CLASS SCHEDULE ENTRIES (WITH TEACHERS) ===",
        roomScheduleRes,
      );
      if (testMode) {
        const teachersById = new Map(
          (teachersForGeneration ?? []).map((teacher) => [
            teacher.teacher_id,
            teacher,
          ]),
        );
        const subjectsById = new Map(
          allSubjects.map((subject) => [subject.subject_id, subject]),
        );
        const normalizePreference = (value: string) =>
          value.trim().toLowerCase().replace(/\s+/g, " ");
        const timeToMinutes = (time: string) => {
          const [hours, minutes] = time.split(":").map(Number);
          return hours * 60 + minutes;
        };

        const preferenceAudit = roomScheduleRes.scheduleEntries.map((entry) => {
          const teacher = entry.teacherId
            ? teachersById.get(entry.teacherId)
            : undefined;
          const preferences = teacher?.preferences;
          const subject = subjectsById.get(entry.subjectId);
          const preferredTimes = preferences?.preferred_times ?? [];
          const preferredRooms = preferences?.preferred_rooms ?? [];
          const preferredSubjects = preferences?.preferred_subjects ?? [];
          const preferredYears = preferences?.preferred_year ?? [];
          const actualRoomValues = [entry.roomId, entry.roomName]
            .filter((value): value is string => Boolean(value))
            .map(normalizePreference);
          const timeMatches = preferredTimes.some((preference) => {
            if (typeof preference !== "string") {
              return (
                preference.day.toLowerCase() === entry.day.toLowerCase() &&
                timeToMinutes(preference.start_time) <=
                  timeToMinutes(entry.startTime) &&
                timeToMinutes(preference.end_time) >=
                  timeToMinutes(entry.endTime)
              );
            }
            const normalizedPreference = preference.toLowerCase();
            const slotRange =
              `${entry.startTime}-${entry.endTime}`.toLowerCase();
            return (
              normalizedPreference.includes(entry.startTime.toLowerCase()) ||
              normalizedPreference.includes(entry.endTime.toLowerCase()) ||
              normalizedPreference.includes(slotRange)
            );
          });
          const subjectMatches = preferredSubjects.some((preference) => {
            const normalizedPreference = normalizePreference(preference);
            return (
              normalizedPreference === normalizePreference(entry.courseName) ||
              normalizedPreference === normalizePreference(entry.courseCode)
            );
          });
          const yearMatchScore = getTeacherPreferenceMatchScore(
            { preferred_year: preferredYears },
            "",
            "",
            subject?.year_term,
          );

          return {
            teacher: entry.teacherName || "Unassigned",
            employmentType: teacher?.employment_type || "Unknown",
            section: entry.sectionCode,
            subject: `${entry.courseCode} - ${entry.courseName}`,
            day: entry.day,
            time: `${entry.startTime}-${entry.endTime}`,
            room: entry.roomName,
            roomPreference: preferredRooms.length
              ? actualRoomValues.some((room) =>
                  preferredRooms.some(
                    (preference) => normalizePreference(preference) === room,
                  ),
                )
                ? "MATCH"
                : "NO MATCH"
              : "NOT SET",
            timePreference: preferredTimes.length
              ? timeMatches
                ? "MATCH"
                : "NO MATCH"
              : "NOT SET",
            subjectPreference: preferredSubjects.length
              ? subjectMatches
                ? "MATCH"
                : "NO MATCH"
              : "NOT SET",
            yearPreference: preferredYears.length
              ? !subject?.year_term
                ? "NO SUBJECT TERM"
                : yearMatchScore > 0
                  ? "MATCH"
                  : "NO MATCH"
              : "NOT SET",
            configuredPreferences: JSON.stringify(preferences ?? {}),
          };
        });

        console.log("=== TEACHER PREFERENCE AUDIT (WITH TEACHERS) ===");
        console.table(preferenceAudit);
        console.log(
          "Preference matches compare selected values with each generated assignment; they do not imply every preference is a hard constraint. Full-time preferred rooms are strictly enforced, while room and subject/year preference behavior varies by teacher category.",
        );
      }

      isSuccess = roomScheduleRes.success;
      errorMessage = roomScheduleRes.error || "";

      const newScheduleEntries = roomScheduleRes.scheduleEntries.filter(
        (entry) =>
          !isCopiedSubject(entry.sectionCode, entry.subjectId, entry.courseCode),
      );
      if (isSuccess && newScheduleEntries.length > 0) {
        // Teachers are already assigned by generateRoomAndClassSchedulesWithTeachers
        setGenerationStatusText(
          `Scheduled ${newScheduleEntries.length} entries with teachers assigned.`,
        );
        setGenerationProgress(80);

        function timeToMinutes(timeStr: string): number {
          const [hours, minutes] = timeStr.split(":").map(Number);
          return hours * 60 + minutes;
        }

        entriesPayload = newScheduleEntries.map((entry) => ({
          subject_id: entry.subjectId || null,
          teacher_id: entry.teacherId || null,
          room_id: entry.roomId || null,
          section: entry.sectionCode,
          day: entry.day,
          start_time: timeToMinutes(entry.startTime),
          end_time: timeToMinutes(entry.endTime),
          type: entry.type || entry.componentType.toLowerCase(), // Maps type correctly
        }));

        startTransition(() => {
          setScheduleEntriesResult(newScheduleEntries);
          setSelectedTimetableSection("ALL");
          const rooms = Array.from(
            new Set(newScheduleEntries.map((e) => e.roomName)),
          );
          setSelectedTimetableRoom(rooms.length > 0 ? rooms[0] : "ALL");
        });
      }
    } else if (autoAssignRoom && creationMode === "semi-auto") {
      setGenerationStatusText(
        `Generated ${sectionRes.sections.length} sections. Running room allocation and timetable generation...`,
      );

      const roomScheduleRes = await generateRoomAndClassSchedules(
        scheduleName,
        curriculumIds,
        tertiaryTerm,
        sectionRes.sections,
        allSubjects,
        shsTerm,
      );
      console.log("=== ROOM & CLASS SCHEDULE ENTRIES (NO TEACHERS) ===", roomScheduleRes);

      isSuccess = roomScheduleRes.success;
      errorMessage = roomScheduleRes.error || "";

      const newScheduleEntries = roomScheduleRes.scheduleEntries.filter(
        (entry) =>
          !isCopiedSubject(entry.sectionCode, entry.subjectId, entry.courseCode),
      );
      if (isSuccess && newScheduleEntries.length > 0) {
        setGenerationStatusText(
          `Scheduled ${newScheduleEntries.length} entries (teachers not assigned).`,
        );
        setGenerationProgress(80);

        function timeToMinutes(timeStr: string): number {
          const [hours, minutes] = timeStr.split(":").map(Number);
          return hours * 60 + minutes;
        }

        entriesPayload = newScheduleEntries.map((entry) => ({
          subject_id: entry.subjectId || null,
          teacher_id: null,
          room_id: entry.roomId || null,
          section: entry.sectionCode,
          day: entry.day,
          start_time: timeToMinutes(entry.startTime),
          end_time: timeToMinutes(entry.endTime),
          type: entry.type || entry.componentType.toLowerCase(),
        }));

        startTransition(() => {
          setScheduleEntriesResult(newScheduleEntries);
          setSelectedTimetableSection("ALL");
          const rooms = Array.from(
            new Set(newScheduleEntries.map((e) => e.roomName)),
          );
          setSelectedTimetableRoom(rooms.length > 0 ? rooms[0] : "ALL");
        });
      }
    } else {
      setGenerationStatusText(
        `Generated ${sectionRes.sections.length} sections. Assigning subjects...`,
      );

      const assignRes = await assignSubjectsToSections(
        scheduleName,
        tertiaryTerm,
        sectionRes.sections,
        allSubjects,
        shsTerm,
      );
      console.log("=== SUBJECT ASSIGNMENT RESULT ===", assignRes);

      isSuccess = assignRes.success;
      errorMessage = assignRes.error || "";

      if (isSuccess && assignRes.assignments) {
        const newAssignments = assignRes.assignments.map((assignment) => ({
          ...assignment,
          subjects: assignment.subjects.filter(
            (subject) =>
              !isCopiedSubject(
                assignment.sectionCode,
                subject.subject_id,
                subject.course_code,
              ),
          ),
        }));
        entriesPayload = newAssignments.flatMap((assignment) =>
          assignment.subjects.flatMap((subj: AssignedSubjectDetail) => {
            const lectureUnits = subj.lecture_units || 0;
            const labUnits = subj.lab_units || 0;
            const entries: SaveScheduleEntryPayload[] = [];

            const lecHours = lectureUnits;

            if (lectureUnits > 0) {
              const splitLecture = lecHours >= 6 ? Math.random() < 0.5 : false;
              if (splitLecture) {
                entries.push(
                  {
                    subject_id: subj.subject_id || null,
                    teacher_id: null,
                    room_id: null,
                    section: assignment.sectionCode,
                    day: "TBA",
                    start_time: 0,
                    end_time: 0,
                    type: "lecture",
                  },
                  {
                    subject_id: subj.subject_id || null,
                    teacher_id: null,
                    room_id: null,
                    section: assignment.sectionCode,
                    day: "TBA",
                    start_time: 0,
                    end_time: 0,
                    type: "lecture",
                  },
                );
              } else {
                entries.push({
                  subject_id: subj.subject_id || null,
                  teacher_id: null,
                  room_id: null,
                  section: assignment.sectionCode,
                  day: "TBA",
                  start_time: 0,
                  end_time: 0,
                  type: "lecture",
                });
              }
            }

            if (labUnits > 0) {
              entries.push({
                subject_id: subj.subject_id || null,
                teacher_id: null,
                room_id: null,
                section: assignment.sectionCode,
                day: "TBA",
                start_time: 0,
                end_time: 0,
                type: "laboratory",
              });
            }

            return entries;
          }),
        );

        startTransition(() => {
          setAssignedSectionsResult(newAssignments);
        });
      }
    }

    if (isCopyFlow) {
      entriesPayload = [
        ...entriesPayload,
        ...copyEntriesToCarry.map(toSaveScheduleEntryPayload),
      ];
    }

    // --- PERSISTENCE STEP ---
    if (isSuccess && (!testMode || isCopyFlow) && entriesPayload.length > 0) {
      setGenerationProgress(85);
      setGenerationStatusText(
        "Posting and saving generated schedule to database...",
      );

      const savePayload = {
        scheduleName,
        generationConfig: {
          description: addScheduleDescription.trim() || `Generated for ${tertiaryTerm} (Auto Room: ${autoAssignRoom})`,
        },
        entries: entriesPayload,
      };

      const saveRes = await saveGeneratedSchedule(savePayload);
      if (!saveRes.success) {
        isSuccess = false;
        errorMessage =
          saveRes.error || "Failed to persist schedule to database.";
      }
    }

    setGenerationProgress(100);
    setGenerationStatusText(
      isSuccess ? "Generation complete!" : "Generation failed.",
    );
    setIsSubmittingAutoGeneration(false);
    setOpenLoadingModal(false);

    if (isSuccess) {
      if (!testMode || isCopyFlow) {
        router.push(`/schedules/${encodeURIComponent(scheduleName)}`);
      }

      if (testMode && !isCopyFlow) {
        if (autoAssignRoom) {
          setOpenTimetableModal(true);
        } else {
          setOpenResultsModal(true);
        }
      }

      setToastMessage(
        autoAssignRoom
          ? "Rooms and class schedules generated successfully!"
          : "Program sections and subject assignments generated successfully!",
      );
      setToastType("success");
      toastTimer();
      void getScheduleRecords();
    } else {
      setToastMessage(
        errorMessage || "Failed to complete schedule generation.",
      );
      setToastType("error");
      setShowToast(true);
    }
  }

  /** --- Server Integration Actions --- **/
  async function getScheduleRecords(
    search: string | null = searchTerm,
    sortby: string = sortScheduleBy,
    sortdir: string = sortScheduleDir,
    limit: number = maxRowSchedule,
    page: number = currentSchedulePage,
  ) {
    setLoading(true);

    const response = await fetchSchedules({
      search: search,
      sortBy: sortby,
      sortDir: sortdir as "ASC" | "DESC",
      page: page,
      limit: limit,
    });

    if (response?.success && response.data) {
      setRecords(response.data as ScheduleRecord[]);
    } else {
      setToastMessage(
        response?.error ?? "[fetchSchedules]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
      setRecords([]);
    }

    setLoading(false);
  }

  async function handleTemplateScheduleSubmit() {
    if (isTemplateFormInvalid) return;

    setToastMessage("Schedule created successfully");
    setToastType("success");
    toastTimer();
    handleCloseModals();
    void getScheduleRecords();
  }

  /** --- Toast Timers --- **/
  function toastTimer() {
    setShowToastTimer(true);
    setShowToast(true);
    setProgress(0);

    const duration = 5000;
    const intervalTime = 50;
    const step = 100 / (duration / intervalTime);

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev + step >= 100) {
          clearInterval(timer);
          closeToast();
          return 100;
        }
        return prev + step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }

  function closeToast() {
    setShowToast(false);
    setToastType("");
    setToastMessage("");
    setShowToastTimer(false);
  }

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      void getScheduleRecords(
        searchTerm,
        sortScheduleBy,
        sortScheduleDir,
        maxRowSchedule,
        currentSchedulePage,
      );
    }, 1500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const isTemplateFormInvalid =
    !addScheduleName.trim() || !!scheduleNameError || !selectedTemplate;
  const isAutoFormInvalid =
    !addScheduleName.trim() ||
    !!scheduleNameError ||
    (curriculumAdd.length === 0 &&
      !(isCopyFlow && copyEntriesToCarry.length > 0));

  // timetable helper constants & functions
  const daysOfWeek = [
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

  // Filtering entries enforcing strict mutual ALL rule: only one dropdown can be "ALL" at a time
  const filteredTimetableEntries = scheduleEntriesResult
    ? scheduleEntriesResult.filter((entry) => {
      const matchesSection =
        selectedTimetableSection === "ALL" ||
        entry.sectionCode === selectedTimetableSection;
      const matchesRoom =
        selectedTimetableRoom === "ALL" ||
        entry.roomName === selectedTimetableRoom;
      return matchesSection && matchesRoom;
    })
    : [];

  const availableTimetableSections = scheduleEntriesResult
    ? Array.from(new Set(scheduleEntriesResult.map((e) => e.sectionCode)))
    : [];

  const availableTimetableRooms = scheduleEntriesResult
    ? Array.from(new Set(scheduleEntriesResult.map((e) => e.roomName)))
    : [];

  // Helper to determine if a curriculum belongs to Senior High School / Strand
  const isShsCurriculum = (curriculum: CurriculumRecord): boolean => {
    if (!curriculum?.curriculum_version) return false;

    const versionUpper = curriculum.curriculum_version.trim().toUpperCase();

    return programs.some((p) => {
      const isNonTertiary = p.year_level?.toLowerCase() !== "tertiary";
      const progCode = p.program_code?.trim().toUpperCase();

      return isNonTertiary && progCode && versionUpper.includes(progCode);
    });
  };

  const getCurriculumYearOptions = (curriculum: CurriculumRecord) =>
    isShsCurriculum(curriculum)
      ? [
          { value: "11", label: "Grade 11" },
          { value: "12", label: "Grade 12" },
        ]
      : [
          { value: "1", label: "First Year" },
          { value: "2", label: "Second Year" },
          { value: "3", label: "Third Year" },
          { value: "4", label: "Fourth Year" },
        ];

  const getSelectedCurriculumYears = (curriculum: CurriculumRecord) => {
    const availableYears = getCurriculumYearOptions(curriculum).map(
      (option) => option.value,
    );
    const selectedYears = curriculumYearSelections[curriculum.curriculum_id];
    if (selectedYears === undefined) return availableYears;

    const validSelectedYears = selectedYears.filter((year) =>
      availableYears.includes(year),
    );
    return selectedYears.length > 0 && validSelectedYears.length === 0
      ? availableYears
      : validSelectedYears;
  };

  const hasSelectedCurriculumYear = curriculumAdd.some(
    (curriculum) => getSelectedCurriculumYears(curriculum).length > 0,
  );
  const isCurriculumSelectionInvalid =
    curriculumAdd.length > 0 && !hasSelectedCurriculumYear;

  const getCurriculumGenerationSelections = (): CurriculumGenerationSelection[] =>
    curriculumAdd.map((curriculum) => ({
      curriculumId: curriculum.curriculum_id,
      curriculumVersion: curriculum.curriculum_version,
      selectedYearLevels: getSelectedCurriculumYears(curriculum),
    }));

  // Helper to count how many curricula are assigned to a program (by checking if curriculum_version contains program_code)
  const programCurriculumCount = (programCode: string): number => {
    const codeUpper = programCode.trim().toUpperCase();
    return curriculumAdd.filter((curriculum) => {
      const versionUpper = curriculum.curriculum_version?.trim().toUpperCase();
      return versionUpper && versionUpper.includes(codeUpper);
    }).length;
  };

  // Helper to get curricula filtered by program code
  const getCurriculaForProgram = (programCode: string): CurriculumRecord[] => {
    if (programCode === "ALL") return curriculumAdd;
    const codeUpper = programCode.trim().toUpperCase();
    return curriculumAdd.filter((curriculum) => {
      const versionUpper = curriculum.curriculum_version?.trim().toUpperCase();
      return versionUpper && versionUpper.includes(codeUpper);
    });
  };

  const getProgramCurriculumStatus = (program: ProgramRecord) => {
    const assignedCurricula = getCurriculaForProgram(program.program_code);
    const expectedYearLevels =
      program.year_level?.toLowerCase() === "tertiary"
        ? ["1", "2", "3", "4"]
        : ["11", "12"];
    return getCurriculumYearCoverageStatus(
      expectedYearLevels,
      assignedCurricula.map(getSelectedCurriculumYears),
    );
  };

  // --- Teacher Preferences Helpers --- //

  function getEmploymentCategory(employmentType?: string): "Full-Time" | "Part-Time Full Load" | "Part-Time" {
    const normalized = (employmentType || "full_time").toLowerCase();
    if (normalized.includes("part-time full load") || normalized.includes("part_time_full_load")) {
      return "Part-Time Full Load";
    } else if (normalized.includes("part")) {
      return "Part-Time";
    } else {
      return "Full-Time";
    }
  }

  // Debounce teacher search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setTeacherSearchDebounced(teacherSearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [teacherSearchQuery]);

  const filteredTeachers = teacherList
    .filter((t) => {
      // Only active teachers
      if (t.status && t.status.toLowerCase() === "inactive") return false;
      // Filter by employment type tab
      if (teacherTab !== "All" && getEmploymentCategory(t.employment_type) !== teacherTab) return false;
      // Filter by search query (name or code)
      if (teacherSearchDebounced.trim()) {
        const query = teacherSearchDebounced.toLowerCase();
        const name = (t.full_name || "").toLowerCase();
        const code = (t.teacher_code || "").toLowerCase();
        if (!name.includes(query) && !code.includes(query)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Sort alphabetically by full name A-Z
      const nameA = (a.full_name || "").toLowerCase();
      const nameB = (b.full_name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

  // Get preference override for a specific teacher and preference key
  function getPreferenceOverride(teacherId: string, prefKey: string): boolean | undefined {
    return teacherPreferenceOverrides.get(teacherId)?.get(prefKey);
  }

  // Toggle preference override for a specific teacher and preference key
  function togglePreferenceOverride(teacherId: string, prefKey: string) {
    setTeacherPreferenceOverrides((prev) => {
      const next = new Map(prev);
      const teacherOverrides = next.get(teacherId) || new Map();
      const updated = new Map(teacherOverrides);
      const current = updated.get(prefKey);
      if (current === undefined || current === true) {
        updated.set(prefKey, false);
      } else {
        updated.set(prefKey, true);
      }
      next.set(teacherId, updated);
      return next;
    });
  }

  // Convert a preference item to a string for display and keys
  function getPreferenceItemString(prefKey: string, item: string | TimePreference): string {
    if (prefKey === "preferred_times" && typeof item === "object" && item !== null) {
      const tp = item as TimePreference;
      return `${tp.day} ${tp.start_time}-${tp.end_time}`;
    }
    return String(item);
  }

  function getEnabledPreferenceItems<T extends string | TimePreference>(
    teacher: TeacherRecord,
    prefKey:
      | "preferred_rooms"
      | "preferred_times"
      | "preferred_year"
      | "preferred_subjects",
    items: T[] | undefined,
  ): T[] {
    const overrides = teacherPreferenceOverrides.get(teacher.teacher_id);
    return (items || []).filter((item) => {
      const itemString = getPreferenceItemString(
        prefKey,
        item as string | TimePreference,
      );
      return overrides?.get(`${prefKey}:${itemString}`) !== false;
    });
  }

  function getTeachersForGeneration(): GenerationTeacherRecord[] {
    return teacherList
      .map((teacher) => ({
        ...teacher,
        preferences: {
          preferred_rooms: getEnabledPreferenceItems(
            teacher,
            "preferred_rooms",
            teacher.preferences?.preferred_rooms,
          ),
          preferred_times: getEnabledPreferenceItems(
            teacher,
            "preferred_times",
            teacher.preferences?.preferred_times,
          ),
          preferred_year: getEnabledPreferenceItems(
            teacher,
            "preferred_year",
            teacher.preferences?.preferred_year,
          ),
          preferred_subjects: getEnabledPreferenceItems(
            teacher,
            "preferred_subjects",
            teacher.preferences?.preferred_subjects,
          ),
        },
      }));
  }

  // Get 3-state checkbox status for a preference category: "unchecked" | "partial" | "checked"
  function getPreferenceCategoryState(teacher: TeacherRecord, prefKey: "preferred_rooms" | "preferred_times" | "preferred_year" | "preferred_subjects"): "unchecked" | "partial" | "checked" {
    const prefs = teacher.preferences;
    const items = prefs?.[prefKey];
    if (!items || items.length === 0) return "unchecked";

    const teacherOverrides = teacherPreferenceOverrides.get(teacher.teacher_id);
    let checkedCount = 0;
    let uncheckedCount = 0;

    items.forEach((item) => {
      const itemStr = getPreferenceItemString(prefKey, item as string | TimePreference);
      const override = teacherOverrides?.get(prefKey + ":" + itemStr);
      if (override === undefined || override === true) {
        checkedCount++;
      } else {
        uncheckedCount++;
      }
    });

    if (uncheckedCount === 0) return "checked";
    if (checkedCount === 0) return "unchecked";
    return "partial";
  }

  function getTeacherPreferenceState(
    teacher: TeacherRecord,
  ): "unchecked" | "partial" | "checked" {
    const categories = [
      ["preferred_rooms", teacher.preferences?.preferred_rooms || []],
      ["preferred_times", teacher.preferences?.preferred_times || []],
      ["preferred_year", teacher.preferences?.preferred_year || []],
      ["preferred_subjects", teacher.preferences?.preferred_subjects || []],
    ] as const;
    const states = categories
      .filter(([, items]) => items.length > 0)
      .map(([prefKey]) => getPreferenceCategoryState(teacher, prefKey));

    if (
      states.length === 0 ||
      states.every((state) => state === "unchecked")
    ) {
      return "unchecked";
    }
    if (states.every((state) => state === "checked")) return "checked";
    return "partial";
  }

  function hasTeacherPreferences(teacher: TeacherRecord): boolean {
    const preferences = teacher.preferences;
    return Boolean(
      preferences?.preferred_rooms?.length ||
        preferences?.preferred_times?.length ||
        preferences?.preferred_year?.length ||
        preferences?.preferred_subjects?.length,
    );
  }

  function setTeacherPreferencesEnabled(teacher: TeacherRecord, enabled: boolean) {
    const categories = [
      ["preferred_rooms", teacher.preferences?.preferred_rooms || []],
      ["preferred_times", teacher.preferences?.preferred_times || []],
      ["preferred_year", teacher.preferences?.preferred_year || []],
      ["preferred_subjects", teacher.preferences?.preferred_subjects || []],
    ] as const;

    setTeacherPreferenceOverrides((prev) => {
      const next = new Map(prev);
      const updated = new Map(next.get(teacher.teacher_id) || new Map());

      categories.forEach(([prefKey, items]) => {
        items.forEach((item) => {
          const itemString = getPreferenceItemString(
            prefKey,
            item as string | TimePreference,
          );
          updated.set(`${prefKey}:${itemString}`, enabled);
        });
      });

      next.set(teacher.teacher_id, updated);
      return next;
    });
  }

  function toggleTeacherPreferences(teacher: TeacherRecord) {
    if (!hasTeacherPreferences(teacher)) return;
    setTeacherPreferencesEnabled(
      teacher,
      getTeacherPreferenceState(teacher) !== "checked",
    );
  }

  // Toggle all items in a preference category
  function togglePreferenceCategory(teacher: TeacherRecord, prefKey: "preferred_rooms" | "preferred_times" | "preferred_year" | "preferred_subjects") {
    const prefs = teacher.preferences;
    const items = prefs?.[prefKey];
    if (!items || items.length === 0) return;

    const currentState = getPreferenceCategoryState(teacher, prefKey);
    const newValue = currentState !== "checked";

    setTeacherPreferenceOverrides((prev) => {
      const next = new Map(prev);
      const teacherOverrides = next.get(teacher.teacher_id) || new Map();
      const updated = new Map(teacherOverrides);

      items.forEach((item) => {
        const itemStr = getPreferenceItemString(prefKey, item as string | TimePreference);
        updated.set(prefKey + ":" + itemStr, newValue);
      });

      next.set(teacher.teacher_id, updated);
      return next;
    });
  }

  // Load teachers when teacher modal opens
  async function loadTeachers() {
    setIsTeacherListLoading(true);
    setTeacherList([]);
    setTeacherPreferenceOverrides(new Map());
    const res = await fetchTeachersWithAqFcceAndPreferences(null);
    if (res.success && res.data) {
      // Backend already parses and normalizes preferences; map to TeacherRecord type
      // Each row's preferences are already correctly associated with that teacher
      const teachers: TeacherRecord[] = res.data.map((row) => {
        const prefs = row.preferences || {};
        return {
          ...row,
          preferences: {
            preferred_rooms: Array.isArray(prefs.preferred_rooms) ? prefs.preferred_rooms : [],
            preferred_times: Array.isArray(prefs.preferred_times) ? prefs.preferred_times : [],
            preferred_year: Array.isArray(prefs.preferred_year) ? prefs.preferred_year : [],
            preferred_subjects: Array.isArray(prefs.preferred_subjects) ? prefs.preferred_subjects : [],
          },
        } as TeacherRecord;
      });
      setTeacherList(teachers);
    }
    setIsTeacherListLoading(false);
  }

  // Open teacher detail modal
  function openTeacherDetail(teacher: TeacherRecord) {
    setSelectedTeacherForDetail(teacher);
    setTeacherPreferenceTab("overview");
    setOpenTeacherDetailModal(true);
  }

  // Handle Next Step from setup -> teachers
  function handleNextToTeachers() {
    if (isAutoFormInvalid || isCurriculumSelectionInvalid) return;
    if (curriculumAdd.length === 0 && isCopyFlow) {
      void handleAutoGenerationSubmit();
      return;
    }
    setAutoStep("teachers");
    setTeacherTab("All");
    setTeacherSearchQuery("");
    setTeacherSearchDebounced("");
    loadTeachers();
  }

  // Handle Confirm Teachers -> proceed to generation
  function handleConfirmTeachers() {
    setAutoStep("setup");
    // Proceed with generation using selected teacher preferences
    handleAutoGenerationSubmitWithTeachers();
  }

  // Modified generation that includes teacher info
  async function handleAutoGenerationSubmitWithTeachers() {
    const scheduleNameTrimmed = addScheduleName.trim();
    const curriculumIds =
      pendingAutoPayload?.curriculumIds ??
      curriculumAdd.map((item) => item.curriculum_id);

    setOpenAddModal(false);
    await executeAutoGenerationPipeline(
      pendingAutoPayload?.scheduleName ?? scheduleNameTrimmed,
      curriculumIds,
      pendingAutoPayload?.tertiaryTerm ?? selectedTertiaryTerm,
      getTeachersForGeneration(),
      pendingAutoPayload?.curriculumSelections ??
        getCurriculumGenerationSelections(),
      pendingAutoPayload?.shsTerm ?? selectedShsTerm,
    );
  }

  const scheduleCopyTree = useMemo(
    () => buildScheduleCopyTree(copySourceEntries, programs),
    [copySourceEntries, programs],
  );

  const getCopyKeysForProgram = (program: ScheduleCopyProgramNode) =>
    program.sections.flatMap((section) =>
      section.subjects.map((subject) => subject.key),
    );

  const getCopyKeysForCategory = (category: "SHS" | "TERTIARY") =>
    scheduleCopyTree[category].flatMap(getCopyKeysForProgram);

  function renderCopySelectionCheckbox(label: string, keys: string[]) {
    const state = getCopySelectionState(keys, copySelection);

    return (
      <label
        className="inline-flex cursor-pointer items-center gap-2"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={state === "checked"}
          ref={(element) => {
            if (element) element.indeterminate = state === "partial";
          }}
          onChange={() =>
            setCopySelection((current) =>
              toggleScheduleCopySelection(keys, current),
            )
          }
          className="h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          aria-label={label}
        />
        <span>{label}</span>
      </label>
    );
  }

  async function handleOpenScheduleCopy(schedule: ScheduleRecord) {
    setCopySourceSchedule(schedule);
    setCopySourceEntries([]);
    setCopySelection(new Set());
    setIsLoadingCopyEntries(true);
    setOpenCopySelectionModal(true);

    try {
      const [entriesResult, programsResult] = await Promise.all([
        fetchTimetableEntriesByScheduleId(schedule.schedule_id),
        programs.length > 0
          ? Promise.resolve({ success: true, data: programs })
          : fetchPrograms(null, "all", "program_code", "ASC", 0),
      ]);

      if (!entriesResult.success || !entriesResult.data) {
        throw new Error(entriesResult.error || "Failed to load schedule entries.");
      }
      if (!programsResult.success || !programsResult.data) {
        const programsError =
          "error" in programsResult &&
          typeof programsResult.error === "string"
            ? programsResult.error
            : "Failed to load programs.";
        throw new Error(
          programsError,
        );
      }

      setPrograms(programsResult.data);
      setCopySourceEntries(entriesResult.data);
    } catch (error) {
      setOpenCopySelectionModal(false);
      setToastMessage(
        error instanceof Error ? error.message : "Failed to load schedule entries.",
      );
      setToastType("error");
      setShowToast(true);
    } finally {
      setIsLoadingCopyEntries(false);
    }
  }

  function handleContinueWithCopiedEntries() {
    const selectedEntries = copySourceEntries.filter((entry) =>
      copySelection.has(
        getScheduleCopySubjectKey(
          entry.section,
          entry.subject_id,
          entry.course_code,
        ),
      ),
    );
    if (selectedEntries.length === 0) return;

    setCopyEntriesToCarry(selectedEntries);
    setIsCopyFlow(true);
    setCopySourceSchedule(null);
    setCopySourceEntries([]);
    setCopySelection(new Set());
    setAddStep("selection");
    setCreationMode("auto");
    setAutoStep("setup");
    setAutoAssignRoom(true);
    setAddScheduleName("");
    setScheduleNameError("");
    setAddScheduleDescription("");
    setSelectedTertiaryTerm("Semester 1");
    setSelectedShsTerm("Term 1");
    setSelectedTemplate("");
    setCurriculumAdd([]);
    setCurriculumYearSelections({});
    setCurriculaSearch("");
    setSelectedCurriculumFilter("ALL");
    setOpenCopySelectionModal(false);
    setOpenAddModal(true);
  }

  return (
    <>
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

      {/* Main Container */}
      <div className="m-8">
        {/* Header Bar */}
        <div className={"mb-2 flex items-center justify-between"}>
          <div>
            <h2 className="mb-1 text-lg font-bold">Schedule Management</h2>
            <p className="text-gray-500">
              Manage timetable schedules and their descriptions.
            </p>
          </div>
        </div>

        <div className={"w-full gap-2 sm:flex sm:justify-end"}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative mb-2 w-full sm:w-auto">
              <TextInput
                id="search-schedule"
                type="text"
                placeholder="Search Schedule Name..."
                value={searchTerm}
                onChange={handleSearchChange}
                icon={HiSearch}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
                >
                  <HiX className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <Button
            className="mb-2 w-full whitespace-nowrap sm:w-auto"
            onClick={() => {
              setIsCopyFlow(false);
              setCopyEntriesToCarry([]);
              setAddStep("selection");
              setOpenAddModal(true);
            }}
          >
            <FaPlus className="mr-2" />
            Add Schedule
          </Button>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto">
          <Table hoverable>
            <TableHead>
              <TableRow>
                <TableHeadCell
                  onClick={() => handleScheduleSorting("schedule_name")}
                >
                  <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                    Schedule Name
                    {sortScheduleBy === "schedule_name" &&
                      (sortScheduleDir === "ASC" ? (
                        <FaSortUp className="ml-1" />
                      ) : (
                        <FaSortDown className="ml-1" />
                      ))}
                  </div>
                </TableHeadCell>

                <TableHeadCell>Description</TableHeadCell>

                <TableHeadCell
                  onClick={() => handleScheduleSorting("created_at")}
                >
                  <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                    Created At
                    {sortScheduleBy === "created_at" &&
                      (sortScheduleDir === "ASC" ? (
                        <FaSortUp className="ml-1" />
                      ) : (
                        <FaSortDown className="ml-1" />
                      ))}
                  </div>
                </TableHeadCell>

                <TableHeadCell>Actions</TableHeadCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center">
                    <Spinner size="lg" />
                    <span className="ml-2 text-gray-500">
                      Loading schedules...
                    </span>
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-gray-500"
                  >
                    No schedule records found.
                  </TableCell>
                </TableRow>
              ) : (
                records.map((item) => (
                  <TableRow
                    key={item.schedule_id}
                    onClick={() =>
                      router.push(
                        `/schedules/${encodeURIComponent(item.schedule_name || "")}`,
                      )
                    }
                    className="cursor-pointer dark:border-gray-700 dark:bg-gray-800"
                  >
                    <TableCell className="font-medium text-gray-900 dark:text-white">
                      {item.schedule_name || "N/A"}
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {item.generation_config?.description ||
                        "No description provided."}
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {item.created_at
                        ? new Date(item.created_at).toLocaleString()
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          aria-label={`Copy schedule entries from ${item.schedule_name || "schedule"}`}
                          title="Copy schedule entries"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleOpenScheduleCopy(item);
                          }}
                          className="cursor-pointer text-gray-500 hover:text-blue-600 focus:outline-none dark:text-gray-400 dark:hover:text-blue-300"
                        >
                          <MdContentCopy className="h-5 w-5" />
                        </button>
                        <HiChevronRight className="h-5 w-5 cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        <TablePaginationFooter
          className="pt-4"
          currentPage={currentSchedulePage}
          pageSize={maxRowSchedule}
          totalCount={records.length}
          onPageChange={onPageChangeSchedule}
        />
      </div>

      <Modal
        show={openCopySelectionModal}
        onClose={() => {
          setOpenCopySelectionModal(false);
          setCopySourceSchedule(null);
          setCopySourceEntries([]);
          setCopySelection(new Set());
        }}
        size="5xl"
      >
        <ModalHeader>
          Copy Schedule Entries
          {copySourceSchedule?.schedule_name
            ? ` — ${copySourceSchedule.schedule_name}`
            : ""}
        </ModalHeader>
        <ModalBody className="max-h-[70vh] overflow-y-auto">
          {isLoadingCopyEntries ? (
            <div className="flex justify-center py-10">
              <Spinner size="lg" />
            </div>
          ) : copySourceEntries.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              This schedule has no entries to copy.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Select the schedule entries to carry into the new schedule.
              </p>
              <Accordion alwaysOpen className="space-y-2 border-0 divide-y-0">
                {(["SHS", "TERTIARY"] as const).map((category) => {
                  const programsInCategory = scheduleCopyTree[category];
                  const categoryKeys = getCopyKeysForCategory(category);

                  return (
                    <AccordionPanel key={category}>
                      <AccordionTitle>
                        <div className="flex items-center gap-3">
                          {renderCopySelectionCheckbox(category, categoryKeys)}
                        </div>
                      </AccordionTitle>
                      <AccordionContent>
                        {programsInCategory.length === 0 ? (
                          <p className="py-2 text-sm text-gray-500">
                            No {category} entries.
                          </p>
                        ) : (
                          <Accordion
                            alwaysOpen
                            className="space-y-2 border-0 divide-y-0"
                          >
                            {programsInCategory.map((program) => {
                              const programKeys = getCopyKeysForProgram(program);
                              return (
                                <AccordionPanel key={program.programCode}>
                                  <AccordionTitle>
                                    <div className="flex items-center gap-3">
                                      {renderCopySelectionCheckbox(
                                        `${program.programName} (${program.programCode})`,
                                        programKeys,
                                      )}
                                    </div>
                                  </AccordionTitle>
                                  <AccordionContent>
                                    <Accordion
                                      alwaysOpen
                                      className="space-y-2 border-0 divide-y-0"
                                    >
                                      {program.sections.map((section) => {
                                        const sectionKeys =
                                          section.subjects.map(
                                            (subject) => subject.key,
                                          );
                                        return (
                                          <AccordionPanel
                                            key={section.sectionCode}
                                          >
                                            <AccordionTitle>
                                              <div className="flex items-center gap-3">
                                                {renderCopySelectionCheckbox(
                                                  section.sectionCode,
                                                  sectionKeys,
                                                )}
                                              </div>
                                            </AccordionTitle>
                                            <AccordionContent>
                                              <div className="space-y-2">
                                                {section.subjects.map(
                                                  (subject) => (
                                                    <div
                                                      key={subject.key}
                                                      className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700"
                                                    >
                                                      {renderCopySelectionCheckbox(
                                                        `${subject.courseCode} — ${subject.courseName}`,
                                                        [subject.key],
                                                      )}
                                                      <span className="shrink-0 text-xs text-gray-500">
                                                        {subject.entries.length}{" "}
                                                        {subject.entries.length ===
                                                        1
                                                          ? "entry"
                                                          : "entries"}
                                                      </span>
                                                    </div>
                                                  ),
                                                )}
                                              </div>
                                            </AccordionContent>
                                          </AccordionPanel>
                                        );
                                      })}
                                    </Accordion>
                                  </AccordionContent>
                                </AccordionPanel>
                              );
                            })}
                          </Accordion>
                        )}
                      </AccordionContent>
                    </AccordionPanel>
                  );
                })}
              </Accordion>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <div className="flex w-full items-center justify-between gap-3">
            <span className="text-sm text-gray-500">
              {copySelection.size} subject{copySelection.size === 1 ? "" : "s"} selected
            </span>
            <div className="flex gap-2">
              <Button
                color="alternative"
                onClick={() => {
                  setOpenCopySelectionModal(false);
                  setCopySourceSchedule(null);
                  setCopySourceEntries([]);
                  setCopySelection(new Set());
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleContinueWithCopiedEntries}
                disabled={copySelection.size === 0 || isLoadingCopyEntries}
              >
                Next
              </Button>
            </div>
          </div>
        </ModalFooter>
      </Modal>

      {/* --- ADD MODAL --- */}
      <Modal show={openAddModal} onClose={handleCloseModals} size="xl">
        <ModalHeader>
          {addStep === "selection"
            ? "Add New Schedule - Choose Mode"
            : creationMode === "auto" && autoStep === "teachers"
              ? "Teacher Preferences"
              : creationMode === "auto"
                ? "Auto Assign / Generation Setup"
                : creationMode === "semi-auto"
                  ? "Semi-Auto Setup"
                  : "Use Template Setup"}
        </ModalHeader>
        <ModalBody className={"scrollbar-thumb-gray-400 scrollbar-track-transparent dark:scrollbar-thumb-gray-600"}>
          {isCopyFlow && addStep === "form" && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
              Add only the subjects that still need to be generated to the
              selected curricula. The copied subjects will carry over into this
              schedule and will not be rescheduled.
            </div>
          )}
          {addStep === "selection" ? (
            <div className="space-y-4 select-none">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {isCopyFlow
                  ? "Choose how to generate the remaining subjects for this copied schedule:"
                  : "Please select how you would like to generate or create this schedule:"}
              </p>
              <div className="space-y-3">
                <div className="flex cursor-pointer items-center gap-3 rounded-lg p-3">
                  <Radio
                    id="mode-auto"
                    name="creationMode"
                    value="auto"
                    checked={creationMode === "auto"}
                    onChange={() => setCreationMode("auto")}
                    className="shrink-0"
                  />
                  <Label htmlFor="mode-auto" className="cursor-pointer">
                    <span className="block font-semibold">
                      {isCopyFlow ? "Full Auto" : "Auto Assign / Generation"}
                    </span>
                    <span className="text-xs text-gray-500">
                      {isCopyFlow
                        ? "Automatically assign teachers and generate time slots for the remaining subjects."
                        : "Automatically map teachers and generate time slots based on system rules and constraints."}
                    </span>
                  </Label>
                </div>

                <div className="flex cursor-pointer items-center gap-3 rounded-lg p-3">
                  <Radio
                    id="mode-semi-auto"
                    name="creationMode"
                    value="semi-auto"
                    checked={creationMode === "semi-auto"}
                    onChange={() => setCreationMode("semi-auto")}
                    className="shrink-0"
                  />
                  <Label htmlFor="mode-semi-auto" className="cursor-pointer">
                    <span className="block font-semibold">
                      {isCopyFlow
                        ? "Semi Auto"
                        : "Semi-Auto (Sections and Subject Assignment)"}
                    </span>
                    <span className="text-xs text-gray-500">
                      Generate sections and assign subjects with optional room
                      assignment toggle.
                    </span>
                  </Label>
                </div>

                {!isCopyFlow && (
                  <div className="flex cursor-pointer items-center gap-3 rounded-lg p-3">
                    <Radio
                      id="mode-template"
                      name="creationMode"
                      value="template"
                      checked={creationMode === "template"}
                      onChange={() => setCreationMode("template")}
                      className="shrink-0"
                    />
                    <Label htmlFor="mode-template" className="cursor-pointer">
                      <span className="block font-semibold">Use Template</span>
                      <span className="text-xs text-gray-500">
                        Create a schedule by selecting and applying a pre-existing
                        template.
                      </span>
                    </Label>
                  </div>
                )}
              </div>
            </div>
          ) : creationMode === "auto" && autoStep === "teachers" ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Review teacher preferences for schedule generation. Click a teacher to manage individual preferences, or use the checkbox to toggle all preferences.
              </p>

              {/* Tabs for filtering teachers */}
              <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                {(["All", "Full-Time", "Part-Time Full Load", "Part-Time"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setTeacherTab(tab)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      teacherTab === tab
                        ? "border-blue-500 text-blue-600 dark:text-blue-400"
                        : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div className="relative">
                <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Search by name or code..."
                  value={teacherSearchQuery}
                  onChange={(e) => setTeacherSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {teacherSearchQuery && (
                  <button
                    onClick={() => setTeacherSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <HiX className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Teacher list */}
              {isTeacherListLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm">
                  <Spinner size="sm" />
                  <span className="text-gray-600 dark:text-gray-300">Loading teachers...</span>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  {filteredTeachers.length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-600 dark:text-gray-300">
                      No teachers found in this category.
                    </div>
                  ) : (
                    filteredTeachers.map((teacher) => {
                      const preferenceState = getTeacherPreferenceState(teacher);
                      const hasPreferences = hasTeacherPreferences(teacher);
                      const category = getEmploymentCategory(teacher.employment_type);
                      return (
                        <button
                          key={teacher.teacher_id}
                          onClick={() => openTeacherDetail(teacher)}
                          className={`w-full flex items-center gap-3 p-3 text-left border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                            preferenceState === "checked"
                              ? "bg-emerald-50/50 dark:bg-emerald-900/10"
                              : preferenceState === "partial"
                                ? "bg-amber-50/50 dark:bg-amber-900/10"
                                : ""
                          }`}
                        >
                          {/* Toggle all teacher preferences */}
                          <div
                            role="checkbox"
                            aria-checked={
                              preferenceState === "partial"
                                ? "mixed"
                                : preferenceState === "checked"
                            }
                            aria-disabled={!hasPreferences}
                            aria-label={`Enable all preferences for ${teacher.full_name}`}
                            title={
                              hasPreferences
                                ? "Toggle all preferences for this teacher"
                                : "This teacher has no preferences"
                            }
                            className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                              hasPreferences ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                            } ${
                              preferenceState === "checked"
                                ? "border-emerald-500"
                                : preferenceState === "partial"
                                  ? "border-amber-500"
                                  : "border-gray-400 dark:border-gray-500"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTeacherPreferences(teacher);
                            }}
                          >
                            {preferenceState === "checked" && (
                              <HiCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            )}
                            {preferenceState === "partial" && (
                              <div className="w-3 h-0.5 bg-amber-500 rounded" />
                            )}
                          </div>

                          {/* Teacher info */}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate text-gray-900 dark:text-white">
                              {teacher.full_name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {teacher.teacher_code} • {teacher.department || "General"}
                            </div>
                          </div>

                          {/* Employment type badge */}
                          <span
                            className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                              category === "Full-Time"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
                                : category === "Part-Time Full Load"
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                            }`}
                          >
                            {category}
                          </span>

                          <HiChevronRight className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {/* Summary */}
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                <span>
                  {
                    teacherList.filter(
                      (teacher) => getTeacherPreferenceState(teacher) === "checked",
                    ).length
                  } of {teacherList.length} teachers have all preferences enabled
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Click a teacher to manage preferences
                </span>
              </div>
            </div>
          ) : creationMode === "auto" || creationMode === "semi-auto" ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="auto-schedule-name">Schedule Name *</Label>
                <TextInput
                  id="auto-schedule-name"
                  placeholder="e.g. First Semester Master Schedule"
                  value={addScheduleName}
                  onChange={handleAddScheduleNameChange}
                  color={scheduleNameError ? "failure" : undefined}
                />
                {scheduleNameError && (
                  <HelperText color="failure">{scheduleNameError}</HelperText>
                )}
              </div>

              <div>
                <Label htmlFor="schedule-description">Description</Label>
                <textarea
                  id="schedule-description"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                  rows={3}
                  placeholder="Enter a brief description for this schedule..."
                  value={addScheduleDescription}
                  onChange={(e) => setAddScheduleDescription(e.target.value)}
                />
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="tertiary-term-select">Tertiary Term / Semester *</Label>
                  <HelperText>Used to filter tertiary subjects from the selected curricula and generate section codes (111, 211, etc.)</HelperText>
                  <Select
                    id="tertiary-term-select"
                    value={selectedTertiaryTerm}
                    onChange={(e) => setSelectedTertiaryTerm(e.target.value)}
                  >
                    <option value="Semester 1">Semester 1</option>
                    <option value="Semester 2">Semester 2</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="shs-term-select">SHS Term *</Label>
                  <HelperText>Used to filter SHS subjects from the selected curricula</HelperText>
                  <Select
                    id="shs-term-select"
                    value={selectedShsTerm}
                    onChange={(e) => setSelectedShsTerm(e.target.value)}
                  >
                    <option value="Term 1">Term 1</option>
                    <option value="Term 2">Term 2</option>
                    <option value="Term 3">Term 3</option>
                    <option value="Term 4">Term 4</option>
                  </Select>
                </div>
              </div>

              {creationMode === "semi-auto" && (
                <div className="flex items-center justify-between rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                  <div>
                    <Label className="font-bold">Auto Assign Room</Label>
                    <p className="text-xs text-gray-500">
                      Automatically allocate rooms during section generation.
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={autoAssignRoom}
                    label=""
                    onChange={setAutoAssignRoom}
                  />
                </div>
              )}

              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <h3 className="mb-1 text-sm font-bold text-gray-900 dark:text-white">
                  Subject Constraints (Curricula) *
                </h3>
                <div className="mb-3 text-xs text-gray-600 dark:text-gray-300">
                  <span>Recommended benchmark: </span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {recommendedConstraints} total curricula
                  </span>
                  <span className="block text-[11px] text-gray-500">
                    Based on all active programs and strands.
                  </span>
                </div>

                <div className="flex items-stretch">
                  {/* Left side - Main content area */}
                  <div className="flex-1 rounded-l-lg border-t border-l border-b border-gray-500 dark:border-gray-300 p-4">
                    {/* Total count */}
                    <div className="flex items-center gap-2 pb-2">
                      <span className="text-xs font-bold dark:text-white">
                        Total Added Curriculum
                      </span>
                      <span className="text-xs font-extrabold dark:text-white">
                        ({curriculumAdd.length})
                      </span>
                    </div>

                    {/* Curriculum Search */}
                    <Label>Curriculum Search</Label>
                    <div className="relative">
                      <TextInput
                        value={curriculaSearch}
                        placeholder={"e.g. BSIT-22-01"}
                        onChange={(e) => setCurriculaSearch(e.target.value)}
                      />
                      {(curriculaSearch.length >= 2 || isCurriculaSearching) && (
                        <div className="absolute z-10 mt-1 w-full max-h-24 overflow-y-auto rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 scrollbar-thumb-gray-400 scrollbar-track-transparent">
                          {isCurriculaSearching ? (
                            <div className="flex items-center justify-center gap-2 p-3 text-xs text-gray-500">
                              <Spinner size="sm" />
                              <span>Searching curricula...</span>
                            </div>
                          ) : curricula.filter(
                            (item: CurriculumRecord) =>
                              !curriculumAdd.some(
                                (added: CurriculumRecord) =>
                                  added.curriculum_id === item.curriculum_id,
                              ),
                          ).length > 0 ? (
                            curricula
                              .filter(
                                (item: CurriculumRecord) =>
                                  !curriculumAdd.some(
                                    (added: CurriculumRecord) =>
                                      added.curriculum_id === item.curriculum_id,
                                  ),
                              )
                              .map((item: CurriculumRecord) => (
                                <div
                                  key={item.curriculum_id}
                                  onClick={() => handleAddCurriculum(item)}
                                  className="py-1 cursor-pointer bg-black/5 p-2 text-xs hover:bg-black/10 dark:bg-white/10 dark:text-white"
                                >
                                  {item.curriculum_version}
                                </div>
                              ))
                          ) : (
                            <div className="p-3 text-center text-xs text-gray-400 italic">
                              No match found
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Selected Curriculum display */}
                    <div className="pt-3">
                      <div className="rounded-lg p-3">
                        <div className="pb-2 text-xs font-semibold text-gray-300">
                          Selected Curriculum:
                          {selectedCurriculumFilter !== "ALL" && (
                            <span className="pl-1 text-gray-400">
                              (Filtering by {selectedCurriculumFilter})
                            </span>
                          )}
                        </div>
                        <div className="min-h-[100px] rounded p-2">
                          {(() => {
                            const filteredCurricula = getCurriculaForProgram(
                              selectedCurriculumFilter,
                            );
                            return filteredCurricula.length > 0 ? (
                              <Accordion
                                alwaysOpen
                                className="flex flex-col gap-3 border-0 divide-y-0"
                              >
                                {filteredCurricula.map((item: CurriculumRecord) => {
                                  const yearOptions =
                                    getCurriculumYearOptions(item);
                                  const selectedYears =
                                    getSelectedCurriculumYears(item);

                                  return (
                                    <AccordionPanel key={item.curriculum_id}>
                                      <AccordionTitle className={`${isShsCurriculum(item)? "bg-yellow-400 text-black":"bg-blue-600 text-white"} h-8  text-sm font-semibold`}>
                                        {item.curriculum_version}
                                      </AccordionTitle>
                                      <AccordionContent>
                                        <div className="space-y-3">
                                          <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                                              {isShsCurriculum(item)
                                                ? "Select grade levels"
                                                : "Select year levels"}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleRemoveCurriculum(item)
                                              }
                                              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 dark:text-gray-300 dark:hover:text-red-400"
                                              aria-label={`Remove ${item.curriculum_version}`}
                                            >
                                              <HiX className="h-4 w-4" />
                                              Remove
                                            </button>
                                          </div>
                                          <div className="flex flex-col gap-2">
                                            {yearOptions.map((option) => (
                                              <label
                                                key={option.value}
                                                htmlFor={`curriculum-${item.curriculum_id}-${option.value}`}
                                                className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 dark:border-gray-600 dark:text-gray-200"
                                              >
                                                <Checkbox
                                                  id={`curriculum-${item.curriculum_id}-${option.value}`}
                                                  checked={selectedYears.includes(
                                                    option.value,
                                                  )}
                                                  onChange={(event) => {
                                                    const checked =
                                                      event.target.checked;
                                                    setCurriculumYearSelections(
                                                      (previous) => {
                                                        const availableYears =
                                                          yearOptions.map(
                                                            (year) =>
                                                              year.value,
                                                          );
                                                        const storedYears =
                                                          previous[
                                                            item.curriculum_id
                                                          ];
                                                        const validStoredYears =
                                                          storedYears?.filter(
                                                            (year) =>
                                                              availableYears.includes(
                                                                year,
                                                              ),
                                                          ) ?? availableYears;
                                                        const current =
                                                          storedYears?.length &&
                                                          validStoredYears.length ===
                                                            0
                                                            ? availableYears
                                                            : validStoredYears;
                                                        return {
                                                          ...previous,
                                                          [item.curriculum_id]: checked
                                                            ? [
                                                                ...new Set([
                                                                  ...current,
                                                                  option.value,
                                                                ]),
                                                              ]
                                                            : current.filter(
                                                                (year) =>
                                                                  year !==
                                                                  option.value,
                                                              ),
                                                        };
                                                      },
                                                    );
                                                  }}
                                                />
                                                <span>{option.label}</span>
                                              </label>
                                            ))}
                                          </div>
                                        </div>
                                      </AccordionContent>
                                    </AccordionPanel>
                                  );
                                })}
                              </Accordion>
                            ) : (
                              <div className="flex h-[80px] items-center justify-center text-xs text-gray-500 italic">
                                {selectedCurriculumFilter === "ALL"
                                  ? "No curricula added yet. Please search and select at least one."
                                  : `No curricula assigned to ${selectedCurriculumFilter}.`}
                              </div>
                            );
                          })()}
                        </div>
                        {curriculumAdd.length > 0 && !hasSelectedCurriculumYear && (
                          <p className="px-2 text-xs text-red-500">
                            Select at least one grade or year level to continue.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right side - Program/Strand filter tabs */}
                  <div className="shrink-0 w-[15%] min-w-[120px] flex flex-col gap-1.5">
                    <div className="flex-1 max-h-96 overflow-y-auto scrollbar-thumb-gray-400 scrollbar-track-transparent">
                      {/* ALL tab */}
                      <button
                        onClick={() => setSelectedCurriculumFilter("ALL")}
                        className={`w-full px-3 py-2 text-left text-xs font-semibold transition-colors ${
                          selectedCurriculumFilter === "ALL"
                            ? "rounded-r-lg border-t border-r border-b border-gray-500 dark:border-gray-300 dark:text-white"
                            : "rounded-r-lg border-l border-gray-500 dark:border-gray-300 bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>ALL</span>
                          {(() => {
                            const allStatuses = programs.map(
                              getProgramCurriculumStatus,
                            );
                            const allComplete =
                              allStatuses.length > 0 &&
                              allStatuses.every((status) => status === "complete");
                            const allHaveNone =
                              allStatuses.length > 0 &&
                              allStatuses.every((status) => status === "missing");
                            if (allComplete)
                              return (
                                <Tooltip content="All courses have complete curricula and selected levels">
                                  <HiCheck className="h-4 w-4 text-green-400 shrink-0 cursor-help" />
                                </Tooltip>
                              );
                            if (allHaveNone)
                              return (
                                <Tooltip content="No courses have their curriculum">
                                  <HiX className="h-4 w-4 text-red-400 shrink-0 cursor-help" />
                                </Tooltip>
                              );
                            return (
                              <Tooltip content="Some courses are missing curricula or need each year level selected exactly once">
                                <HiExclamation className="h-4 w-4 text-yellow-400 shrink-0 cursor-help" />
                              </Tooltip>
                            );
                          })()}
                        </div>
                      </button>

                      {/* Program/Strand tabs */}
                      {programs.map((item: ProgramRecord) => {
                        const curriculumCount = programCurriculumCount(
                          item.program_code,
                        );
                        const curriculumStatus =
                          getProgramCurriculumStatus(item);
                        const isSelected =
                          selectedCurriculumFilter === item.program_code;
                        const isTertiary = item.year_level?.toLowerCase() === "tertiary";

                        return (
                          <button
                            key={item.program_code}
                            onClick={() => {
                              setSelectedCurriculumFilter(item.program_code);
                              // Auto-search if no curriculum exists for this program
                              if (curriculumCount === 0) {
                                setCurriculaSearch(item.program_code);
                              }
                            }}
                            className={`w-full px-3 py-2 text-left text-xs font-semibold transition-colors ${
                              isSelected
                                ? "rounded-r-lg border-t border-r border-b border-gray-500 dark:border-gray-300 dark:text-white"
                                : isTertiary
                                  ? "rounded-r-lg border-l border-gray-500 dark:border-gray-300 bg-cyan-900 text-cyan-300 hover:bg-cyan-800 dark:bg-cyan-950 dark:text-cyan-400 dark:hover:bg-cyan-900"
                                  : "rounded-r-lg border-l border-gray-500 dark:border-gray-300 bg-yellow-900 text-yellow-300 hover:bg-yellow-800 dark:bg-yellow-950 dark:text-yellow-400 dark:hover:bg-yellow-900"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="truncate">{item.program_code}</span>
                              {curriculumStatus === "missing" ? (
                                <HiX className="h-4 w-4 text-red-400 shrink-0" />
                              ) : curriculumStatus === "duplicate" ? (
                                <Tooltip content="Each year level should be selected only once">
                                  <HiExclamation className="h-4 w-4 text-yellow-400 shrink-0 cursor-help" />
                                </Tooltip>
                              ) : curriculumStatus === "incomplete" ? (
                                <Tooltip
                                  content={`Select all ${isTertiary ? 4 : 2} ${isTertiary ? "year levels" : "grade levels"}`}
                                >
                                  <HiExclamation className="h-4 w-4 text-yellow-400 shrink-0 cursor-help" />
                                </Tooltip>
                              ) : (
                                <HiCheck className="h-4 w-4 text-green-400 shrink-0" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="template-select">Select Template *</Label>
                <Select
                  id="template-select"
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                >
                  <option value="" disabled>
                    -- Choose a template --
                  </option>
                  <option value="standard-shs">
                    Standard Senior High School Template
                  </option>
                  <option value="stem-track">STEM Track Master Template</option>
                  <option value="abm-track">ABM Track Master Template</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="template-schedule-name">Schedule Name *</Label>
                <TextInput
                  id="template-schedule-name"
                  placeholder="e.g. SHS Term 1 Master Schedule"
                  value={addScheduleName}
                  onChange={handleAddScheduleNameChange}
                  color={scheduleNameError ? "failure" : undefined}
                />
                {scheduleNameError && (
                  <HelperText color="failure">{scheduleNameError}</HelperText>
                )}
              </div>

              <div>
                <Label htmlFor="template-schedule-description">Description</Label>
                <textarea
                  id="template-schedule-description"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                  rows={3}
                  placeholder="Enter a brief description for this schedule..."
                  value={addScheduleDescription}
                  onChange={(e) => setAddScheduleDescription(e.target.value)}
                />
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          {addStep === "selection" ? (
            <>
              <Button onClick={() => setAddStep("form")}>Next</Button>
              <Button color="alternative" onClick={handleCloseModals}>
                Cancel
              </Button>
            </>
          ) : creationMode === "auto" && autoStep === "setup" ? (
            <>
              <Button
                color="alternative"
                onClick={() => setAddStep("selection")}
                disabled={isSubmittingAutoGeneration}
              >
                Back
              </Button>
              <Button
                disabled={
                  isAutoFormInvalid ||
                  isCurriculumSelectionInvalid ||
                  isSubmittingAutoGeneration
                }
                onClick={handleNextToTeachers}
              >
                Next Step
              </Button>
              <Button
                color="alternative"
                onClick={handleCloseModals}
                disabled={isSubmittingAutoGeneration}
              >
                Cancel
              </Button>
            </>
          ) : creationMode === "auto" && autoStep === "teachers" ? (
            <>
              <Button
                color="alternative"
                onClick={() => setAutoStep("setup")}
              >
                Back
              </Button>
              <Button
                onClick={handleConfirmTeachers}
                disabled={isTeacherListLoading || isSubmittingAutoGeneration}
              >
                Generate Schedule
              </Button>
              <Button
                color="alternative"
                onClick={handleCloseModals}
              >
                Cancel
              </Button>
            </>
          ) : creationMode === "semi-auto" ? (
            <>
              <Button
                color="alternative"
                onClick={() => setAddStep("selection")}
                disabled={isSubmittingAutoGeneration}
              >
                Back
              </Button>
              <Button
                disabled={
                  isAutoFormInvalid ||
                  isCurriculumSelectionInvalid ||
                  isSubmittingAutoGeneration
                }
                onClick={handleAutoGenerationSubmit}
              >
                Generate Sections
              </Button>
              <Button
                color="alternative"
                onClick={handleCloseModals}
                disabled={isSubmittingAutoGeneration}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                color="alternative"
                onClick={() => setAddStep("selection")}
              >
                Back
              </Button>
              <Button
                disabled={isTemplateFormInvalid}
                onClick={handleTemplateScheduleSubmit}
              >
                Save Schedule
              </Button>
              <Button color="alternative" onClick={handleCloseModals}>
                Cancel
              </Button>
            </>
          )}
        </ModalFooter>
      </Modal>

      {/* --- AQ WARNING MODAL (Shows subjects missing AQ entries in a scrollable list) --- */}
      <Modal show={openAqWarningModal} onClose={handleCloseModals} size="lg">
        <ModalHeader className="border-b border-gray-200 font-bold text-amber-600 dark:border-gray-700">
          Warning: Subjects Missing AQ Entries
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              The following subjects do not have any Academic Qualification (AQ)
              entries configured. Generation will still proceed with all
              subjects, but unassigned faculty qualifications may occur:
            </p>

            {/* Scrollable Div Containing Bullet Points */}
            <div className="max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
              <ul className="list-disc space-y-2 pl-5">
                {subjectsWithoutAq.map((sub) => (
                  <li
                    key={sub.subject_id}
                    className="text-sm text-gray-800 dark:text-gray-200"
                  >
                    <span className="font-semibold">{sub.course_code}</span>:{" "}
                    {sub.course_name}{" "}
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({sub.program_code} - {sub.year_term})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </ModalBody>
        <ModalFooter className="flex justify-end gap-2">
          <Button color="alternative" onClick={handleCloseModals}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setOpenAqWarningModal(false);
              if (pendingAutoPayload) {
                if (creationMode === "auto") {
                  // Auto mode: proceed to teacher selection
                  setAutoStep("teachers");
                  loadTeachers();
                } else {
                  // Semi-Auto mode: proceed directly to generation
                  void executeAutoGenerationPipeline(
                    pendingAutoPayload.scheduleName,
                    pendingAutoPayload.curriculumIds,
                    pendingAutoPayload.tertiaryTerm,
                    undefined,
                    pendingAutoPayload.curriculumSelections,
                    pendingAutoPayload.shsTerm,
                  );
                }
              }
            }}
          >
            Proceed
          </Button>
        </ModalFooter>
      </Modal>


      {/* --- TEACHER DETAIL MODAL --- */}
      <Modal show={openTeacherDetailModal} onClose={() => setOpenTeacherDetailModal(false)} size="xl">
        {selectedTeacherForDetail && (
          <>
            <ModalHeader className="border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-lg font-bold">{selectedTeacherForDetail.full_name}</div>
                  <div className="text-xs">
                    {selectedTeacherForDetail.teacher_code} • {selectedTeacherForDetail.department || "General"} •{" "}
                    {getEmploymentCategory(selectedTeacherForDetail.employment_type)}
                  </div>
                </div>
              </div>
            </ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                {/* Preference tabs */}
                <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                  {[
                    { key: "overview" as const, label: "Overview" },
                    { key: "preferred_rooms" as const, label: "Rooms" },
                    { key: "preferred_times" as const, label: "Times" },
                    { key: "preferred_year" as const, label: "Years" },
                    { key: "preferred_subjects" as const, label: "Subjects" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setTeacherPreferenceTab(tab.key)}
                      className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                        teacherPreferenceTab === tab.key
                          ? "border-blue-500 text-blue-600 dark:text-blue-400"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Overview tab */}
                {teacherPreferenceTab === "overview" && (
                  <div className="space-y-4">
                    {/* Summary of preferences with category-level checkboxes */}
                    {[
                      { key: "preferred_rooms" as const, label: "Preferred Rooms", color: "blue" },
                      { key: "preferred_times" as const, label: "Preferred Times", color: "green" },
                      { key: "preferred_year" as const, label: "Preferred Years", color: "purple" },
                      { key: "preferred_subjects" as const, label: "Preferred Subjects", color: "amber" },
                    ].map((pref) => {
                      const state = getPreferenceCategoryState(selectedTeacherForDetail, pref.key);
                      const items = selectedTeacherForDetail.preferences?.[pref.key] || [];
                      return (
                        <div
                          key={pref.key}
                          className="rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {/* 3-state category checkbox */}
                              <div
                                className="w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer"
                                onClick={() => togglePreferenceCategory(selectedTeacherForDetail, pref.key)}
                              >
                                {state === "checked" && (
                                  <HiCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                )}
                                {state === "partial" && (
                                  <div className="w-3 h-0.5 bg-amber-500 rounded" />
                                )}
                              </div>
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">{pref.label}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">({items.length})</span>
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {state === "checked" ? "All enabled" : state === "partial" ? "Partial" : "None enabled"}
                            </span>
                          </div>
                          {items.length > 0 ? (
                            <div className="flex flex-wrap gap-2 ml-7">
                              {items.map((item, idx) => {
                                const itemStr = getPreferenceItemString(pref.key, item as string | TimePreference);
                                return (
                                  <span
                                    key={idx}
                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                      pref.color === "blue"
                                        ? "bg-blue-100 dark:bg-blue-900/50 dark:text-white"
                                        : pref.color === "green"
                                        ? "bg-green-100 dark:bg-green-900/50 dark:text-white"
                                        : pref.color === "purple"
                                        ? "bg-purple-100 dark:bg-purple-900/50 dark:text-white"
                                        : "bg-amber-100 dark:bg-amber-900/50 dark:text-white"
                                    }`}
                                  >
                                    {itemStr}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-xs ml-7 italic text-gray-500 dark:text-gray-400">No {pref.label.toLowerCase()} set</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Individual preference tabs */}
                {teacherPreferenceTab !== "overview" && (
                  <div className="space-y-3">
                    {(() => {
                      const prefKey = teacherPreferenceTab as "preferred_rooms" | "preferred_times" | "preferred_year" | "preferred_subjects";
                      const items = selectedTeacherForDetail.preferences?.[prefKey] || [];
                      const state = getPreferenceCategoryState(selectedTeacherForDetail, prefKey);

                      return (
                        <>
                          {/* Category-level checkbox */}
                          <div className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div
                              className="w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer"
                              onClick={() => togglePreferenceCategory(selectedTeacherForDetail, prefKey)}
                            >
                              {state === "checked" && (
                                <HiCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              )}
                              {state === "partial" && (
                                <div className="w-3 h-0.5 bg-amber-500 rounded" />
                              )}
                            </div>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              All {prefKey.replace("preferred_", "").replace("_s", "").replace("_", " ")}
                            </span>
                            <span className="text-xs ml-auto text-gray-500 dark:text-gray-400">
                              {state === "checked" ? "All enabled" : state === "partial" ? "Partially enabled" : "None enabled"}
                            </span>
                          </div>

                          {/* Individual items */}
                          {items.length > 0 ? (
                            items.map((item, idx) => {
                              const itemStr = getPreferenceItemString(prefKey, item as string | TimePreference);
                              return (
                                <div
                                  key={idx}
                                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                                >
                                  <div
                                    className="w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer"
                                    onClick={() =>
                                      togglePreferenceOverride(
                                        selectedTeacherForDetail.teacher_id,
                                        prefKey + ":" + itemStr
                                      )
                                    }
                                  >
                                    {(() => {
                                      const override = getPreferenceOverride(
                                        selectedTeacherForDetail.teacher_id,
                                        prefKey + ":" + itemStr
                                      );
                                      const isChecked = override === undefined || override === true;
                                      return isChecked && (
                                        <HiCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                      );
                                    })()}
                                  </div>
                                  <span className="text-sm">{itemStr}</span>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-center py-8 text-sm italic">
                              No preferences set for this category.
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button onClick={() => setOpenTeacherDetailModal(false)}>Close</Button>
            </ModalFooter>
          </>
        )}
      </Modal>

      {/* --- SEPARATE UNCLOSEABLE LOADING MODAL --- */}
      <Modal show={openLoadingModal} size="md" popup dismissible={false}>
        <ModalBody className="p-6 text-center">
          <div className="space-y-4 py-4">
            <div className={"flex w-full justify-center"}>
              <Image
                src="/acehub-logo.png"
                alt="Acehub Logo"
                width={64}
                height={64}
              />
            </div>

            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Processing Generation...
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {generationStatusText}
            </p>
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs font-medium text-blue-700 dark:text-blue-300">
                <span>Progress</span>
                <span>{generationProgress}%</span>
              </div>
              <Progress progress={generationProgress} size="md" color="blue" />
            </div>
          </div>
        </ModalBody>
      </Modal>

      {/* --- TESTING MODAL 1: Preview Standard Assigned Sections & Subjects Data --- */}
      {testMode && (
        <Modal
          show={openResultsModal}
          onClose={() => setOpenResultsModal(false)}
          size="2xl"
        >
          <ModalHeader className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 dark:text-white">
                Generated Section & Subject Assignments Preview
              </span>
              <Badge color="success" size="sm">
                Test Mode
              </Badge>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Below are the sections generated and their mapped subject
                assignments returned by{" "}
                <code className="font-mono text-cyan-600">
                  assignSubjectsToSections
                </code>
                .
              </p>
              <div className="max-h-96 scrollbar-thumb-gray-400 scrollbar-track-transparent overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                {assignedSectionsResult && assignedSectionsResult.length > 0 ? (
                  <Accordion collapseAll className="space-y-2 border-none">
                    {assignedSectionsResult.map(
                      (item: SectionSubjectAssignment, idx: number) => (
                        <AccordionPanel key={idx}>
                          <AccordionTitle className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                            <div className="flex w-full items-center justify-between pr-4">
                              <span className="font-mono text-blue-600 dark:text-blue-400">
                                {item.sectionCode}
                              </span>
                              <Badge color="gray" size="sm">
                                {item.subjects.length} Subjects Assigned
                              </Badge>
                            </div>
                          </AccordionTitle>
                          <AccordionContent className="rounded-b-lg border-t border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
                            {item.subjects.length > 0 ? (
                              <div className="space-y-1.5">
                                {item.subjects.map(
                                  (
                                    subj: AssignedSubjectDetail,
                                    sIdx: number,
                                  ) => (
                                    <div
                                      key={sIdx}
                                      className="flex items-center justify-between rounded border border-gray-200/60 bg-gray-50 p-2 text-xs dark:border-gray-700 dark:bg-gray-800/50"
                                    >
                                      <div>
                                        <span className="font-bold text-gray-900 dark:text-white">
                                          {subj.course_code}
                                        </span>
                                        <span className="ml-2 text-gray-500">
                                          ({subj.course_name})
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge color="gray" size="xs">
                                          Lab: {subj.lab_type || "None"}
                                        </Badge>
                                        <Badge color="info" size="xs">
                                          Lec: {subj.lecture_units} | Lab:{" "}
                                          {subj.lab_units} Units
                                        </Badge>
                                      </div>
                                    </div>
                                  ),
                                )}
                              </div>
                            ) : (
                              <p className="py-2 text-center text-xs text-gray-400 italic">
                                No subject requirements matched this section.
                              </p>
                            )}
                          </AccordionContent>
                        </AccordionPanel>
                      ),
                    )}
                  </Accordion>
                ) : (
                  <p className="py-6 text-center text-xs text-gray-500 italic">
                    No assignments found.
                  </p>
                )}
              </div>
            </div>
          </ModalBody>
          <ModalFooter className="flex justify-end">
            <Button
              color="alternative"
              onClick={() => setOpenResultsModal(false)}
            >
              Close Preview
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* --- TESTING MODAL 2: timetable / Row Table Preview with Independent Section & Room Dropdowns --- */}
      {testMode && (
        <Modal
          show={openTimetableModal}
          onClose={() => setOpenTimetableModal(false)}
          size="7xl"
        >
          <ModalHeader className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <span className="text-base font-bold text-gray-900 dark:text-white">
                  Schedule Generation Output Verification
                </span>
                <Badge color="purple" size="sm">
                  {displayFormat === "timetable"
                    ? "timetable Grid View"
                    : "Row Table View"}
                </Badge>
              </div>
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                Viewing: Section [ {selectedTimetableSection} ] | Room [{" "}
                {selectedTimetableRoom} ]
              </span>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    Format:
                  </span>
                  <Select
                    value={displayFormat}
                    onChange={(e) =>
                      setDisplayFormat(e.target.value as "timetable" | "table")
                    }
                  >
                    <option value="timetable">Timetable Grid</option>
                    <option value="table">Row Table</option>
                  </Select>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      Section:
                    </span>
                    <Select
                      className="w-44"
                      value={selectedTimetableSection}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedTimetableSection(val);
                        if (val !== "ALL") {
                          setSelectedTimetableRoom("ALL");
                        }
                      }}
                    >
                      <option value="ALL">ALL Sections</option>
                      {availableTimetableSections.map((secCode) => (
                        <option key={secCode} value={secCode}>
                          {secCode}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      Room:
                    </span>
                    <Select
                      className="w-44"
                      value={selectedTimetableRoom}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedTimetableRoom(val);
                        if (val !== "ALL") {
                          setSelectedTimetableSection("ALL");
                        }
                      }}
                    >
                      <option value="ALL">ALL Rooms</option>
                      {availableTimetableRooms.map((roomName) => (
                        <option key={roomName} value={roomName}>
                          {roomName}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>

              {displayFormat === "timetable" ? (
                <div className="max-h-[600px] overflow-x-auto overflow-y-auto rounded-xl border border-gray-300 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
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
                        <tr
                          key={tIdx}
                          className="border-b dark:border-gray-800"
                        >
                          <td className="sticky left-0 z-10 border-r bg-gray-50 p-2 text-center font-mono text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                            {timeSlot}
                          </td>
                          {daysOfWeek.map((day) => {
                            const matchedEntry =
                              filteredTimetableEntries.find((entry) => {
                                if (entry.day !== day) return false;
                                const [entryStart] =
                                  entry.startTime.split(" - ");
                                return entryStart === timeSlot;
                              });

                            if (matchedEntry) {
                              const [startH, startM] = matchedEntry.startTime
                                .split(":")
                                .map(Number);
                              const [endH, endM] = matchedEntry.endTime
                                .split(":")
                                .map(Number);
                              const durationMins =
                                endH * 60 + endM - (startH * 60 + startM);
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
                                        {matchedEntry.courseCode}
                                      </div>
                                      <div className="truncate text-[10px] opacity-90">
                                        {matchedEntry.courseName}
                                      </div>
                                    </div>
                                    <div className="mt-2 space-y-0.5 text-[10px] font-semibold opacity-90">
                                      <div>
                                        Sec: {matchedEntry.sectionCode}
                                      </div>
                                      <div>
                                        Room: {matchedEntry.roomName}
                                      </div>
                                      <div>
                                        Teacher: {matchedEntry.teacherName || "None"}
                                      </div>
                                      <div className="font-mono">
                                        {matchedEntry.startTime} -{" "}
                                        {matchedEntry.endTime}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              );
                            }

                            const isCoveredByPrevious =
                              filteredTimetableEntries.some((entry) => {
                                if (entry.day !== day) return false;
                                const [startH, startM] = entry.startTime
                                  .split(":")
                                  .map(Number);
                                const [endH, endM] = entry.endTime
                                  .split(":")
                                  .map(Number);
                                const entryStartMins = startH * 60 + startM;
                                const entryEndMins = endH * 60 + endM;
                                return (
                                  slotTotalMins > entryStartMins &&
                                  slotTotalMins < entryEndMins
                                );
                              });

                            if (isCoveredByPrevious) {
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
                <div className="max-h-150 overflow-x-auto overflow-y-auto rounded-xl border border-gray-300 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                  <Table hoverable>
                    <TableHead>
                      <TableRow>
                        <TableHeadCell>Section</TableHeadCell>
                        <TableHeadCell>Course Code</TableHeadCell>
                        <TableHeadCell>Course Name</TableHeadCell>
                        <TableHeadCell>Component</TableHeadCell>
                        <TableHeadCell>Room</TableHeadCell>
                        <TableHeadCell>Day</TableHeadCell>
                        <TableHeadCell>Time</TableHeadCell>
                        <TableHeadCell>Units</TableHeadCell>
                        <TableHeadCell>Teacher</TableHeadCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredTimetableEntries.length > 0 ? (
                        filteredTimetableEntries.map((entry, idx) => (
                          <TableRow
                            key={idx}
                            className="bg-white dark:border-gray-700 dark:bg-gray-900"
                          >
                            <TableCell className="font-mono font-bold text-blue-600 dark:text-blue-400">
                              {entry.sectionCode}
                            </TableCell>
                            <TableCell className="font-medium text-gray-900 dark:text-white">
                              {entry.courseCode}
                            </TableCell>
                            <TableCell className="text-gray-500">
                              {entry.courseName}
                            </TableCell>
                            <TableCell>
                              <Badge color="info" size="xs">
                                {entry.componentType}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold text-gray-700 dark:text-gray-300">
                              {entry.roomName}
                            </TableCell>
                            <TableCell>{entry.day}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {entry.startTime} - {entry.endTime}
                            </TableCell>
                            <TableCell>{entry.units}</TableCell>
                            <TableCell className="text-gray-700 dark:text-gray-300">
                              {entry.teacherName || "None"}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={9}
                            className="py-6 text-center text-gray-400 italic"
                          >
                            No entries found matching the selected filters.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter className="flex justify-end">
            <Button
              color="alternative"
              onClick={() => setOpenTimetableModal(false)}
            >
              Close Output Verification
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}