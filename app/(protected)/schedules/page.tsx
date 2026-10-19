"use client";

import {
  Button,
  HelperText,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Pagination,
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
  Accordion,
  AccordionPanel,
  AccordionTitle,
  AccordionContent,
  ToggleSwitch,
} from "flowbite-react";
import {
  filterAlphanumericDashUnderscore,
  filterAlphanumericDashUnderscoreComma,
} from "@/utils/validation";
import { FaPlus, FaSortDown, FaSortUp } from "react-icons/fa6";
import { HiCheck, HiExclamation, HiX, HiSearch } from "react-icons/hi";
import {
  useEffect,
  useState,
  ChangeEvent,
  useCallback,
  startTransition,
} from "react";
import { HiChevronRight } from "react-icons/hi2";
import { useRouter } from "next/navigation";
import {
  fetchSchedules,
  fetchCurricula,
  fetchPrograms,
  ProgramRecord,
  saveGeneratedSchedule,
} from "@/app/actions/system";
import {
  assignSubjectsToSections,
  SectionSubjectAssignment,
  AssignedSubjectDetail,
  generateProgramSections,
  generateRoomAndClassSchedules,
  ScheduleEntry,
} from "@/app/actions/AutoScheduleGeneration";
import Image from "next/image";

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

export default function ScheduleManagement() {
  const router = useRouter();
  const [isLoading, setLoading] = useState(true);

  // For Debugging Only (Developer-controlled code flag)
  const testMode = false;

  // --- Table & View Filter State --- //
  const [records, setRecords] = useState<ScheduleRecord[]>([]);
  const [sortScheduleBy, setSortScheduleBy] = useState("created_at");
  const [sortScheduleDir, setSortScheduleDir] = useState("DESC");
  const [searchTerm, setSearchTerm] = useState("");

  // --- Modal States & Wizard Steps --- //
  const [openAddModal, setOpenAddModal] = useState(false);
  const [addStep, setAddStep] = useState<"selection" | "form">("selection");
  const [creationMode, setCreationMode] = useState<
    "auto" | "semi-auto" | "template"
  >("auto");
  const [autoAssignRoom, setAutoAssignRoom] = useState<boolean>(false);

  // --- Curriculum & Program Selection States (Integrated into Auto-Generation Wizard) --- //
  const [programs, setPrograms] = useState<ProgramRecord[]>([]);
  const [recommendedConstraints, setRecommendedConstraints] = useState(0);
  const [curricula, setCurricula] = useState<CurriculumRecord[]>([]);
  const [curriculaSearch, setCurriculaSearch] = useState("");
  const [curriculumAdd, setCurriculumAdd] = useState<CurriculumRecord[]>([]);
  const [isCurriculaSearching, setIsCurriculaSearching] =
    useState<boolean>(false);
  const [isSubmittingAutoGeneration, setIsSubmittingAutoGeneration] =
    useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [generationStatusText, setGenerationStatusText] = useState<string>("");
  const [openLoadingModal, setOpenLoadingModal] = useState<boolean>(false); // Dedicated loading modal state

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
  const [scheduleId, setScheduleId] = useState("");
  const [scheduleNameError, setScheduleNameError] = useState("");

  // Add Form State (Common / Template mode)
  const [addScheduleName, setAddScheduleName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");

  // Auto Assign / Generation Specific State
  const [autoGenerationConfig, setAutoGenerationConfig] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("Term 1");

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
    setScheduleId("");
    setScheduleNameError("");
    setOpenAddModal(false);
    setAddStep("selection");
    setCreationMode("auto");
    setAutoAssignRoom(false);
    setAddScheduleName("");
    setSelectedTerm("Term 1");
    setSelectedTemplate("");
    setAutoGenerationConfig("");
    setCurriculumAdd([]);
    setCurriculaSearch("");
    setIsCurriculaSearching(false);
    setGenerationProgress(0);
    setGenerationStatusText("");
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
  };

  // --- Submit Handler using separated step execution for precise UI progress --- //
  async function handleAutoGenerationSubmit() {
    if (
      !addScheduleName.trim() ||
      !!scheduleNameError ||
      curriculumAdd.length === 0
    )
      return;

    // Close the wizard modal and open the standalone uncloseable loading modal
    setOpenAddModal(false);
    setOpenLoadingModal(true);
    setIsSubmittingAutoGeneration(true);
    setGenerationProgress(15);
    setGenerationStatusText("Initializing program sections generation...");

    const curriculumIds = curriculumAdd.map((item) => item.curriculum_id);

    // Step 1: Run section generation separately to accurately update UI state/progress
    const sectionRes = await generateProgramSections(
      addScheduleName.trim(),
      curriculumIds,
      selectedTerm,
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

    setGenerationProgress(50);

    let isSuccess = false;
    let errorMessage = "";
    let savedScheduleId: string | undefined = undefined;

    if (autoAssignRoom) {
      setGenerationStatusText(
        `Generated ${sectionRes.sections.length} sections. Running room allocation and timetable generation...`,
      );

      const roomScheduleRes = await generateRoomAndClassSchedules(
        addScheduleName.trim(),
        curriculumIds,
        selectedTerm,
      );
      console.log("=== ROOM & CLASS SCHEDULE ENTRIES ===", roomScheduleRes);

      isSuccess = roomScheduleRes.success;
      errorMessage = roomScheduleRes.error || "";

      if (
        isSuccess &&
        !testMode &&
        roomScheduleRes.scheduleEntries.length > 0
      ) {
        setGenerationProgress(80);
        setGenerationStatusText(
          "Posting and saving generated schedule to database...",
        );

        // Helper to convert "HH:MM" to minutes from midnight (Integer)
        function timeToMinutes(timeStr: string): number {
          const [hours, minutes] = timeStr.split(":").map(Number);
          return hours * 60 + minutes;
        }

        const savePayload = {
          scheduleName: addScheduleName.trim(),
          generationConfig: {
            description: `Generated for term ${selectedTerm}`,
          },
          entries: roomScheduleRes.scheduleEntries.map((entry) => ({
            subject_id: entry.subjectId || null, // Passes valid UUID or null
            teacher_id: null, // Passes null instead of "" for UUID
            room_id: entry.roomId || null, // Passes valid UUID or null
            section: entry.sectionCode,
            day: entry.day,
            start_time: timeToMinutes(entry.startTime), // Converts "07:00" -> 420
            end_time: timeToMinutes(entry.endTime),
          })),
        };

        console.log(
          "=== SAVE GENERATED SCHEDULE PAYLOAD ===",
          JSON.stringify(savePayload, null, 2),
        );

        const saveRes = await saveGeneratedSchedule(savePayload);
        console.log("=== SAVE GENERATED SCHEDULE RESPONSE ===", saveRes);

        if (saveRes.success) {
          savedScheduleId = saveRes.scheduleId;
        } else {
          isSuccess = false;
          errorMessage =
            saveRes.error || "Failed to persist schedule to database.";
        }
      }

      setGenerationProgress(100);
      setGenerationStatusText("Timetable generation complete!");
      setIsSubmittingAutoGeneration(false);
      setOpenLoadingModal(false);

      if (isSuccess) {
        if (!testMode && savedScheduleId) {
          router.push(`/schedule/${savedScheduleId}`);
        }

        startTransition(() => {
          setScheduleEntriesResult(roomScheduleRes.scheduleEntries);
          setSelectedTimetableSection("ALL");
          const rooms = Array.from(
            new Set(roomScheduleRes.scheduleEntries.map((e) => e.roomName)),
          );
          setSelectedTimetableRoom(rooms.length > 0 ? rooms[0] : "ALL");
          if (testMode) {
            setOpenTimetableModal(true); // Open timetable format results modal
          }
        });
        setToastMessage("Rooms and class schedules generated successfully!");
        setToastType("success");
        toastTimer();
        void getScheduleRecords();
      } else {
        setToastMessage(errorMessage || "Failed to generate room schedules.");
        setToastType("error");
        setShowToast(true);
      }
    } else {
      setGenerationStatusText(
        `Generated ${sectionRes.sections.length} sections. Fetching requirements and assigning subjects...`,
      );

      const assignRes = await assignSubjectsToSections(
        addScheduleName.trim(),
        curriculumIds,
        selectedTerm,
        sectionRes.sections,
      );
      console.log("=== SUBJECT ASSIGNMENT RESULT ===", assignRes);

      isSuccess = assignRes.success;
      errorMessage = assignRes.error || "";

      setGenerationProgress(100);
      setGenerationStatusText("Assignment complete!");
      setIsSubmittingAutoGeneration(false);
      setOpenLoadingModal(false);

      if (isSuccess) {
        startTransition(() => {
          setAssignedSectionsResult(assignRes.assignments);
          if (testMode) {
            setOpenResultsModal(true); // Open standard assignments test modal
          }
        });
        setToastMessage(
          "Program sections and subject assignments generated successfully!",
        );
        setToastType("success");
        toastTimer();
        void getScheduleRecords();
      } else {
        setToastMessage(
          errorMessage || "Failed to assign subjects to sections.",
        );
        setToastType("error");
        setShowToast(true);
      }
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
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const isTemplateFormInvalid =
    !addScheduleName.trim() || !!scheduleNameError || !selectedTemplate;
  const isAutoFormInvalid =
    !addScheduleName.trim() ||
    !!scheduleNameError ||
    curriculumAdd.length === 0;

  // Timetable helper constants & functions
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
                      router.push("/schedules/" + item.schedule_name)
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
                      <HiChevronRight className="h-5 w-5 cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-center pt-4">
          <Pagination
            currentPage={currentSchedulePage}
            totalPages={Math.ceil(records.length / maxRowSchedule) || 1}
            onPageChange={onPageChangeSchedule}
            showIcons
          />
        </div>
      </div>

      {/* --- ADD MODAL (Multi-step wizard with integrated Curriculum selector & Term selector) --- */}
      <Modal show={openAddModal} onClose={handleCloseModals} size="xl">
        <ModalHeader>
          {addStep === "selection"
            ? "Add New Schedule - Choose Mode"
            : creationMode === "auto"
              ? "Auto Assign / Generation Setup"
              : creationMode === "semi-auto"
                ? "Semi-Auto Setup"
                : "Use Template Setup"}
        </ModalHeader>
        <ModalBody>
          {addStep === "selection" ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Please select how you would like to generate or create this
                schedule:
              </p>
              <div className="space-y-3">
                <div className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 dark:border-gray-700">
                  <Radio
                    id="mode-auto"
                    name="creationMode"
                    value="auto"
                    checked={creationMode === "auto"}
                    onChange={() => setCreationMode("auto")}
                  />
                  <Label htmlFor="mode-auto" className="cursor-pointer">
                    <span className="block font-semibold">
                      Auto Assign / Generation
                    </span>
                    <span className="text-xs text-gray-500">
                      Automatically map and generate time slots based on system
                      rules and constraints.
                    </span>
                  </Label>
                </div>

                <div className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 dark:border-gray-700">
                  <Radio
                    id="mode-semi-auto"
                    name="creationMode"
                    value="semi-auto"
                    checked={creationMode === "semi-auto"}
                    onChange={() => setCreationMode("semi-auto")}
                  />
                  <Label htmlFor="mode-semi-auto" className="cursor-pointer">
                    <span className="block font-semibold">
                      Semi-Auto (Sections and Subject Assignment)
                    </span>
                    <span className="text-xs text-gray-500">
                      Generate sections and assign subjects with optional room
                      assignment toggle.
                    </span>
                  </Label>
                </div>

                <div className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 dark:border-gray-700">
                  <Radio
                    id="mode-template"
                    name="creationMode"
                    value="template"
                    checked={creationMode === "template"}
                    onChange={() => setCreationMode("template")}
                  />
                  <Label htmlFor="mode-template" className="cursor-pointer">
                    <span className="block font-semibold">Use Template</span>
                    <span className="text-xs text-gray-500">
                      Create a schedule by selecting and applying a pre-existing
                      template.
                    </span>
                  </Label>
                </div>
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

              {/* Enhanced Term Selector */}
              <div>
                <Label htmlFor="term-select">Select Term / Semester *</Label>
                <Select
                  id="term-select"
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value)}
                >
                  <option value="Term 1">Term 1</option>
                  <option value="Term 2">Term 2</option>
                </Select>
              </div>

              {/* Semi-Auto Toggle */}
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

              {/* Curriculum Selection UI integrated from Config Modal */}
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

                <div className="flex gap-4">
                  <div className="w-[75%]">
                    <Label>Curriculum Search</Label>
                    <TextInput
                      value={curriculaSearch}
                      placeholder={"e.g. BSIT-22-01"}
                      onChange={(e) => setCurriculaSearch(e.target.value)}
                    />
                    <div className="max-h-32 scrollbar-thumb-gray-400 scrollbar-track-transparent overflow-y-auto">
                      {isCurriculaSearching ? (
                        <div className="flex items-center justify-center gap-2 p-3 text-xs text-gray-500">
                          <Spinner size="sm" />
                          <span>Searching curricula...</span>
                        </div>
                      ) : curriculaSearch.length >= 2 ? (
                        curricula.filter(
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
                                className="my-1 cursor-pointer rounded bg-black/5 p-2 text-xs hover:bg-black/10 dark:bg-white/10 dark:text-white"
                              >
                                {item.curriculum_version}
                              </div>
                            ))
                        ) : (
                          <div className="p-3 text-center text-xs text-gray-400 italic">
                            No match found
                          </div>
                        )
                      ) : (
                        <div className="p-3 text-center text-xs text-gray-400 italic">
                          Type at least 2 characters to search...
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs font-bold dark:text-white">
                        Added Curriculum
                      </span>
                      <span className="text-xs font-extrabold dark:text-white">
                        ({curriculumAdd.length})
                      </span>
                    </div>

                    <div className="mt-1 min-h-17.5 rounded-xl border border-gray-300/50 p-2 dark:border-gray-600">
                      <div className="flex flex-wrap gap-2">
                        {curriculumAdd.length > 0 ? (
                          curriculumAdd.map((item: CurriculumRecord) => (
                            <Badge
                              key={item.curriculum_id}
                              className="items-center"
                              color="info"
                            >
                              <span className="inline-flex items-center gap-1.5">
                                {item.curriculum_version}
                                <HiX
                                  className="h-4 w-4 cursor-pointer text-cyan-950 hover:text-red-500 dark:text-gray-300 dark:hover:text-red-400"
                                  onClick={() => {
                                    setCurriculumAdd((prev) =>
                                      prev.filter(
                                        (curriculum: CurriculumRecord) =>
                                          curriculum.curriculum_id !==
                                          item.curriculum_id,
                                      ),
                                    );
                                  }}
                                />
                              </span>
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400 italic">
                            No curricula added yet. Please search and select at
                            least one.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Programs and Strands Side Panel */}
                  <div className="w-[25%] border-l border-gray-200 pl-3 dark:border-gray-700">
                    <div className="text-center text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                      Programs
                    </div>
                    <div className="text-center text-xs font-semibold text-yellow-700 dark:text-yellow-300">
                      & Strands
                    </div>

                    <div className="max-h-44 scrollbar-thumb-gray-400 scrollbar-track-transparent overflow-y-auto pt-1">
                      {programs.map((item: ProgramRecord) => (
                        <Badge
                          color={
                            item.year_level.toLowerCase() === "tertiary"
                              ? "info"
                              : "warning"
                          }
                          key={item.program_code}
                          className="my-1 cursor-pointer justify-center border border-gray-400 text-[10px] transition-opacity hover:opacity-80"
                          onClick={() => setCurriculaSearch(item.program_code)}
                        >
                          {item.program_code}
                        </Badge>
                      ))}
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
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          {addStep === "selection" ? (
            <>
              <Button onClick={() => setAddStep("form")}>Next</Button>
              <Button color="gray" onClick={handleCloseModals}>
                Cancel
              </Button>
            </>
          ) : creationMode === "auto" || creationMode === "semi-auto" ? (
            <>
              <Button
                color="gray"
                onClick={() => setAddStep("selection")}
                disabled={isSubmittingAutoGeneration}
              >
                Back
              </Button>
              <Button
                disabled={isAutoFormInvalid || isSubmittingAutoGeneration}
                onClick={handleAutoGenerationSubmit}
              >
                Generate Sections
              </Button>
              <Button
                color="gray"
                onClick={handleCloseModals}
                disabled={isSubmittingAutoGeneration}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button color="gray" onClick={() => setAddStep("selection")}>
                Back
              </Button>
              <Button
                disabled={isTemplateFormInvalid}
                onClick={handleTemplateScheduleSubmit}
              >
                Save Schedule
              </Button>
              <Button color="gray" onClick={handleCloseModals}>
                Cancel
              </Button>
            </>
          )}
        </ModalFooter>
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
            <Button color="gray" onClick={() => setOpenResultsModal(false)}>
              Close Preview
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* --- TESTING MODAL 2: Timetable / Row Table Preview with Independent Section & Room Dropdowns --- */}
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
                    ? "Timetable Grid View"
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
              {/* Controls bar: Display Format + Section Dropdown + Room Dropdown with Mutual ALL enforcement */}
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
                          setSelectedTimetableRoom("ALL"); // Only one dropdown can be ALL at a time
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
                          setSelectedTimetableSection("ALL"); // Only one dropdown can be ALL at a time
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

              {/* Conditional Rendering based on displayFormat */}
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
                                          👥 Sec: {matchedEntry.sectionCode}
                                        </div>
                                        <div>
                                          📍 Room: {matchedEntry.roomName}
                                        </div>
                                        <div className="font-mono">
                                          🕒 {matchedEntry.startTime} -{" "}
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
                <div className="max-h-[600px] overflow-x-auto overflow-y-auto rounded-xl border border-gray-300 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
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
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={8}
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
            <Button color="gray" onClick={() => setOpenTimetableModal(false)}>
              Close Output Verification
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}