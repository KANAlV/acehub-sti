"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useTransition,
} from "react";
import {
  Table,
  TableHead,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  Button,
  TextInput,
  Select,
  Pagination,
  Spinner,
  Toast,
  ToastToggle,
  Progress,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Card,
  Tooltip,
  Badge,
  Label,
  Checkbox,
  Dropdown,
  DropdownItem,
  useThemeMode,
} from "flowbite-react";
import {
  HiSearch,
  HiX,
  HiCheck,
  HiExclamation,
  HiClock,
  HiPlus,
  HiDotsVertical,
} from "react-icons/hi";
import { FaSortUp, FaSortDown } from "react-icons/fa";
import { useMsal } from "@azure/msal-react";

// Import fetch actions and types from system actions
import {
  fetchTeachersWithPreassignment,
  fetchTeachersCountWithPreassignment,
  TeacherPreassignmentSummaryRecord,
  fetchFacultyLoadConfig,
  Configuration,
  fetchDepartments,
  updateTeacherPreassignmentConfig,
  TeacherPreassignmentRecord,
  fetchCurricula,
  PreassignmentTemplateRecord,
  fetchPreassignmentTemplates,
  fetchTeacherPreassignments,
  fetchCurriculumById,
  fetchPrograms,
  ProgramRecord,
  searchSubjectsWithCurriculumFilter,
  SubjectRecord,
  createTeacherPreassignment,
  updateTeacherPreassignment,
  deleteTeacherPreassignment,
} from "@/app/actions/system";
import { DepartmentRecord } from "@/components/teachers/TeachersManagement";
import {
  HiBookOpen,
  HiChevronLeft,
  HiCog6Tooth,
  HiQuestionMarkCircle,
} from "react-icons/hi2";

/* FETCH BY ID / CURRICULUM FORMAT */
export interface CurriculumRecord {
  curriculum_id: string;
  curriculum_version: string;
  created_at: string;
}

interface TeacherPreassignmentManagementProps {
  preassignmentName: string;
}

export default function TeacherPreassignmentManagement({
  preassignmentName = "",
}: TeacherPreassignmentManagementProps) {
  // --- Dark Mode ---
  const { computedMode } = useThemeMode();
  const isDarkMode = computedMode === "dark";

  // --- MSAL Auth State for Actor/Logging if needed ---
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];

  // --- Data State ---
  const [config, setConfig] = useState<Configuration | null>(null);
  const [programs, setPrograms] = useState<ProgramRecord[]>([]);
  const [teachers, setTeachers] = useState<TeacherPreassignmentSummaryRecord[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [constraintsLoading, setConstraintsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // --- Program/Strand Math Count Holder ---
  const [reccomendedConstraints, setReccomendedConstraints] = useState(0);

  // --- Department State --- //
  const [allDepartments, setAllDepartments] = useState<string[]>([]);

  // --- Curricula ---
  const [curricula, setCurricula] = useState<CurriculumRecord[]>([]);
  const [curriculaSearch, setCurriculaSearch] = useState("");

  // --- Search & Filter State ---
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>(
    "All Active & On Leave",
  );
  const [departmentFilter, setDepartmentFilter] =
    useState<string>("All Departments");

  // --- Pagination & Sorting State ---
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [maxRow] = useState<number>(10);
  const [sortBy, setSortBy] = useState<string>("surname");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("ASC");
  const [totalCount, setTotalCount] = useState<number>(0);

  // --- Modal States ---
  const [openConfigModal, setOpenConfigModal] = useState(false);
  const [openAddModal, setOpenAddModal] = useState(false);
  const [openWarningModal, setOpenWarningModal] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [subjectToDelete, setSubjectToDelete] =
    useState<TeacherPreassignmentRecord | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  // --- Form & Preassignment State ---
  const [selectedTeacherID, setSelectedTeacherID] = useState("");
  const [selectedTeacherName, setSelectedTeacherName] = useState("");
  const [teacherPreassignments, setTeacherPreassignments] = useState<
    TeacherPreassignmentRecord[]
  >([]);
  const [isPreassignmentLoading, setIsPreassignmentLoading] =
    useState<boolean>(false);

  // --- Add Modal Subject Search & Merge States ---
  const [subjectSearchQuery, setSubjectSearchQuery] = useState("");
  const [debouncedSubjectSearch, setDebouncedSubjectSearch] = useState("");
  const [subjectSearchResults, setSubjectSearchResults] = useState<
    SubjectRecord[]
  >([]);
  const [isSearchingSubjects, setIsSearchingSubjects] = useState(false);
  const [selectedSubjectToAssign, setSelectedSubjectToAssign] =
    useState<SubjectRecord | null>(null);
  const [mergeLecLab, setMergeLecLab] = useState<boolean>(false);

  // --- Config Consts ---
  const [curriculumAdd, setCurriculumAdd] = useState<CurriculumRecord[]>([]);
  const [initialCurriculumAdd, setInitialCurriculumAdd] = useState<
    CurriculumRecord[]
  >([]);
  const [isSubmittingConfig, setIsSubmittingConfig] = useState<boolean>(false);

  // --- Add Consts ---
  const [isSubmittingAddPreAssignment, setIsSubmittingAddPreAssignment] =
    useState(false);

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

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Debounce Subject Search Input inside Add Modal
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSubjectSearch(subjectSearchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [subjectSearchQuery]);

  // Execute Subject Search using curriculum filter when query changes
  useEffect(() => {
    async function performSubjectSearch() {
      if (!debouncedSubjectSearch || debouncedSubjectSearch.trim().length < 2) {
        setSubjectSearchResults([]);
        return;
      }

      setIsSearchingSubjects(true);
      const curriculumVers = curriculumAdd.map((c) => c.curriculum_version);

      try {
        const res = await searchSubjectsWithCurriculumFilter(
          debouncedSubjectSearch,
          curriculumVers,
        );
        if (res.success && res.data) {
          setSubjectSearchResults(res.data);
        } else {
          setSubjectSearchResults([]);
        }
      } catch (err) {
        console.error("Error searching subjects catch block:", err);
        setSubjectSearchResults([]);
      } finally {
        setIsSearchingSubjects(false);
      }
    }

    void performSubjectSearch();
  }, [debouncedSubjectSearch, curriculumAdd]);

  // Load Configuration Data
  const loadConfig = useCallback(async () => {
    const res = await fetchFacultyLoadConfig();
    if (res.success && res.data && res.data.length > 0) {
      setConfig(res.data[0]);
    }
  }, []);

  // --- Robust Template Config Effect for Initial Load & Updates ---
  useEffect(() => {
    setConstraintsLoading(true);
    async function loadTemplateConfigStandalone() {
      if (!preassignmentName || preassignmentName.trim() === "") {
        setCurriculumAdd([]);
        setInitialCurriculumAdd([]);
        return;
      }

      const fetchData = await fetchPreassignmentTemplates(preassignmentName);

      if (fetchData.success && fetchData.data && fetchData.data.length > 0) {
        const templateRecord = fetchData.data[0];
        let rawConfig = templateRecord.config;

        if (typeof rawConfig === "string") {
          try {
            rawConfig = JSON.parse(rawConfig);
          } catch (e) {
            console.error("Failed to parse template config string:", e);
          }
        }

        let itemIds: string[] = [];
        if (Array.isArray(rawConfig)) {
          itemIds = rawConfig;
        } else if (rawConfig && typeof rawConfig === "object") {
          const cfgObj = rawConfig as Record<string, unknown>;
          itemIds =
            (cfgObj.items as string[]) ||
            (cfgObj.curricula as string[]) ||
            (cfgObj.curriculum_ids as string[]) ||
            (cfgObj.curriculum as string[]) ||
            [];
        }

        if (itemIds.length === 0) {
          setCurriculumAdd([]);
          setInitialCurriculumAdd([]);
          return;
        }

        const promises = itemIds.map(async (id) => {
          try {
            const res = await fetchCurriculumById(id);
            if (res.success && res.data) {
              return res.data;
            }
            return null;
          } catch (error) {
            console.error(`Failed to load curriculum for ID ${id}:`, error);
            return null;
          }
        });

        const results = await Promise.all(promises);
        const validItems = results.filter(
          (item): item is CurriculumRecord => item !== null,
        );

        setCurriculumAdd(validItems);
        setInitialCurriculumAdd(validItems);
      } else {
        setCurriculumAdd([]);
        setInitialCurriculumAdd([]);
      }
      setConstraintsLoading(false);
    }

    void loadTemplateConfigStandalone();
  }, [preassignmentName]);

  // Load Table Data and Count on Page Load/Filter Change
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setTeachers([]);

    const [resData, countRes, resProgram] = await Promise.all([
      fetchTeachersWithPreassignment(
        preassignmentName,
        debouncedSearch,
        statusFilter,
        departmentFilter,
        sortBy,
        sortDir,
        maxRow,
        currentPage,
      ),
      fetchTeachersCountWithPreassignment(
        preassignmentName,
        debouncedSearch,
        statusFilter,
        departmentFilter,
      ),
      fetchPrograms(null, "all", "program_code", "ASC", 0),
      loadConfig(),
    ]);

    if (resData.success && resData.data) {
      setTeachers(resData.data);
    } else {
      triggerToast(
        resData.error || "Failed to load teachers with pre-assignment metrics.",
        "error",
      );
    }

    if (countRes.success) {
      setTotalCount(countRes.count);
    }

    let progs = 0;
    let strand = 0;

    if (resProgram.success && resProgram.data) {
      setPrograms(resProgram.data);

      resProgram.data.map((item) => {
        if (item.year_level === "tertiary") {
          progs += 1;
        } else {
          strand += 1;
        }
      });
    } else {
      triggerToast(
        resProgram.error || "Failed to fetch Strand/Programs.",
        "error",
      );
    }

    setReccomendedConstraints(progs * 4 + strand * 2);
    setIsLoading(false);
  }, [
    preassignmentName,
    debouncedSearch,
    statusFilter,
    departmentFilter,
    sortBy,
    sortDir,
    maxRow,
    currentPage,
    triggerToast,
    loadConfig,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // --- Curricula Search ---
  useEffect(() => {
    async function getCurricula() {
      const curriculaData = await fetchCurricula(curriculaSearch);

      if (curriculaData.success) {
        setCurricula(curriculaData.data);
      } else {
        triggerToast(
          curriculaData.error || "Failed to load curricula data.",
          "error",
        );
      }
    }

    function limitCurriculaSearch() {
      if (curriculaSearch.length >= 2) {
        getCurricula();
      } else {
        setCurricula([]);
      }
    }

    limitCurriculaSearch();
  }, [curriculaSearch]);

  useEffect(() => {
    async function loadAllDepartments() {
      const response = await fetchDepartments("", "dept_name", "ASC", 0, 1);
      if (response?.success && response.data) {
        const names = (response.data as DepartmentRecord[]).map(
          (d) => d.dept_name,
        );
        setAllDepartments(names);
      }
    }
    void loadAllDepartments();
  }, []);

  // Sorting Handler
  const handleSorting = (column: string) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === "ASC" ? "DESC" : "ASC"));
    } else {
      setSortBy(column);
      setSortDir("ASC");
    }
  };

  // Helper to map employment type to config limits keys (facultyLoadLimit + overload_max)
  const getLimitsForTeacher = (employmentType: string) => {
    const normalized = employmentType?.toLowerCase() || "";
    const overloadMaxConfig = Number(config?.overload_max ?? 0);

    if (
      normalized.includes("part-time full load") ||
      normalized.includes("part_time_full_load")
    ) {
      const facultyLoadLimit = Number(
        config?.faculty_load?.part_time_full_load ?? 0,
      );
      return {
        prepLimit: Number(config?.prep_limits?.part_time_full_load ?? 0),
        facultyLoadLimit,
        overloadMax: facultyLoadLimit + overloadMaxConfig,
      };
    } else if (normalized.includes("part")) {
      const facultyLoadLimit = Number(config?.faculty_load?.part_time ?? 0);
      return {
        prepLimit: Number(config?.prep_limits?.part_time ?? 0),
        facultyLoadLimit,
        overloadMax: facultyLoadLimit + overloadMaxConfig,
      };
    } else {
      const facultyLoadLimit = Number(config?.faculty_load?.full_time ?? 0);
      return {
        prepLimit: Number(config?.prep_limits?.full_time ?? 0),
        facultyLoadLimit,
        overloadMax: facultyLoadLimit + overloadMaxConfig,
      };
    }
  };

  // Close Config Modal
  function closeConfigModal() {
    setOpenConfigModal(false);
    setCurriculaSearch("");
    setIsSubmittingConfig(false);
  }

  // Close Add Modal
  function closeAddModal() {
    setOpenAddModal(false);
    setSubjectSearchQuery("");
    setSubjectSearchResults([]);
    setSelectedSubjectToAssign(null);
    setMergeLecLab(false);
    setIsSubmittingAddPreAssignment(false);
  }

  // Function that loads teacher preassignments using fetchTeacherPreassignments()
  async function loadTeacherData(teacher_id: string, teacherName: string) {
    setSelectedTeacherID(teacher_id);
    setSelectedTeacherName(teacherName);
    setIsPreassignmentLoading(true);
    setTeacherPreassignments([]);

    const res = await fetchTeacherPreassignments(teacher_id, preassignmentName);
    if (res.success && res.data) {
      setTeacherPreassignments(res.data);
    } else {
      triggerToast(
        res.error || "Failed to load teacher preassignments.",
        "error",
      );
    }
    setIsPreassignmentLoading(false);
  }

  const totalPages = Math.ceil(totalCount / maxRow) || 1;

  // Add Curriculum Helper
  const handleAddCurriculum = (input: CurriculumRecord) => {
    setCurriculaSearch("");
    setCurriculumAdd((prev) => [...prev, input]);
  };

  // Handle Opening Config Modal
  function handleOpenConfigModal() {
    setInitialCurriculumAdd([...curriculumAdd]);
    setIsSubmittingConfig(false);
    setOpenConfigModal(true);
  }

  // Check if curriculum list has changed
  const hasChanges = () => {
    if (curriculumAdd.length !== initialCurriculumAdd.length) return true;
    const currentIds = new Set(curriculumAdd.map((c) => c.curriculum_id));
    const initialIds = new Set(
      initialCurriculumAdd.map((c) => c.curriculum_id),
    );
    if (currentIds.size !== initialIds.size) return true;
    for (const id of currentIds) {
      if (!initialIds.has(id)) return true;
    }
    return false;
  };

  /* MODAL CRUD FUNCTIONS */
  async function updateConfig() {
    if (isSubmittingConfig || !hasChanges()) return;

    setIsSubmittingConfig(true);
    const curriculumIds = curriculumAdd.map((item) => item.curriculum_id);

    const res = await updateTeacherPreassignmentConfig(
      preassignmentName,
      curriculumIds,
    );

    if (res.success) {
      triggerToast("Pre-assignment config updated successfully!", "success");
      setInitialCurriculumAdd([...curriculumAdd]);
      setOpenConfigModal(false);
      void loadData();
    } else {
      triggerToast(
        res.error || "Failed to update pre-assignments config.",
        "error",
      );
      setIsSubmittingConfig(false);
    }
  }

  // Actual submission handler
  const executeAddPreAssignment = async () => {
    if (!selectedTeacherID || !selectedSubjectToAssign) return;

    setIsSubmittingAddPreAssignment(true);

    const res = await createTeacherPreassignment(
      preassignmentName,
      selectedTeacherID,
      selectedSubjectToAssign.subject_id,
      mergeLecLab,
    );

    if (res.success) {
      triggerToast("Subject pre-assigned successfully!", "success");
      setOpenWarningModal(false);
      closeAddModal();
      void loadData();
      void loadTeacherData(selectedTeacherID, selectedTeacherName);
    } else {
      triggerToast(
        res.error || "Failed to create teacher preassignment.",
        "error",
      );
    }

    setIsSubmittingAddPreAssignment(false);
  };

  // Handle checking limits and triggering warning modal or saving directly
  const handlePreAssignmentSaveClick = () => {
    if (!selectedSubjectToAssign) return;

    const selectedTeacher = teachers.find(
      (t) => t.teacher_id === selectedTeacherID,
    );
    if (!selectedTeacher) {
      void executeAddPreAssignment();
      return;
    }

    const { prepLimit, facultyLoadLimit, overloadMax } = getLimitsForTeacher(
      selectedTeacher.employment_type,
    );

    const newSubjectsCount = Number(selectedTeacher.subjects_count || 0) + 1;
    const subjectUnits = mergeLecLab
      ? Math.max(
          Number(selectedSubjectToAssign.lecture_units || 0),
          Number(selectedSubjectToAssign.lab_units || 0),
        )
      : Number(selectedSubjectToAssign.lecture_units || 0) +
        Number(selectedSubjectToAssign.lab_units || 0);
    const newTotalLoad = Number(selectedTeacher.total_load || 0) + subjectUnits;

    // Block only if absolute overloadMax hard limit is exceeded
    if (newTotalLoad > overloadMax) {
      return;
    }

    // Trigger warning modal if prep limit or standard faculty load limit is exceeded
    if (newSubjectsCount > prepLimit || newTotalLoad > facultyLoadLimit) {
      setOpenWarningModal(true);
    } else {
      void executeAddPreAssignment();
    }
  };

  // Toggle Merge Lec/Lab handler
  const handleToggleMerge = async (item: TeacherPreassignmentRecord) => {
    const newMergeState = !item.merge_lec_lab;
    const res = await updateTeacherPreassignment(
      item.preassignment_id,
      preassignmentName,
      selectedTeacherID,
      item.subject_id,
      newMergeState,
    );

    if (res.success) {
      triggerToast("Preassignment updated successfully!", "success");
      void loadData();
      void loadTeacherData(selectedTeacherID, selectedTeacherName);
    } else {
      triggerToast(res.error || "Failed to update preassignment.", "error");
    }
  };

  // Delete/Remove handler
  const executeDeletePreassignment = async () => {
    if (!subjectToDelete) return;
    setIsSubmittingDelete(true);

    const res = await deleteTeacherPreassignment(
      subjectToDelete.preassignment_id,
    );

    if (res.success) {
      triggerToast("Preassignment removed successfully!", "success");
      setOpenDeleteModal(false);
      setSubjectToDelete(null);
      void loadData();
      void loadTeacherData(selectedTeacherID, selectedTeacherName);
    } else {
      triggerToast(res.error || "Failed to remove preassignment.", "error");
    }
    setIsSubmittingDelete(false);
  };

  return (
    <div className={"flex w-full max-w-full overflow-x-hidden"}>
      {/* Main Div */}
      <div className="min-w-0 flex-1 space-y-4 p-4">
        {/* Page Header & Actions Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Teachers Pre-assignment Summary
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {preassignmentName ? (
                <>
                  Viewing pre-assignment metrics for template:{" "}
                  <b className="font-bold text-black dark:text-white">
                    {preassignmentName}
                  </b>
                </>
              ) : (
                "Overview of teacher teaching loads, subjects count, and pre-assignment status."
              )}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Search Input */}
            <div className="w-full sm:w-64">
              <TextInput
                id="search-teachers"
                type="text"
                placeholder="Search teachers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                icon={HiSearch}
              />
            </div>

            {/* Status Filter */}
            <div className="w-full sm:w-48">
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="All Active & On Leave">
                  All Active & On Leave
                </option>
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Inactive">Inactive</option>
              </Select>
            </div>

            {/* Department Filter */}
            <div className="w-full sm:w-48">
              <Select
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="All Departments">All Departments</option>
                {allDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm dark:border-gray-700">
          <Table hoverable>
            <TableHead>
              <TableRow>
                <TableHeadCell
                  className="cursor-pointer text-blue-500 select-none"
                  onClick={() => handleSorting("surname")}
                >
                  <div className="flex items-center gap-1">
                    <span>Teacher Name</span>
                    {sortBy === "surname" &&
                      (sortDir === "ASC" ? (
                        <FaSortUp className="h-4 w-4" />
                      ) : (
                        <FaSortDown className="h-4 w-4" />
                      ))}
                  </div>
                </TableHeadCell>
                <TableHeadCell
                  className="cursor-pointer text-blue-500 select-none"
                  onClick={() => handleSorting("teacher_code")}
                >
                  <div className="flex items-center gap-1">
                    <span>Teacher Code</span>
                    {sortBy === "teacher_code" &&
                      (sortDir === "ASC" ? (
                        <FaSortUp className="h-4 w-4" />
                      ) : (
                        <FaSortDown className="h-4 w-4" />
                      ))}
                  </div>
                </TableHeadCell>
                <TableHeadCell
                  className="cursor-pointer text-blue-500 select-none"
                  onClick={() => handleSorting("department")}
                >
                  <div className="flex items-center gap-1">
                    <span>Department</span>
                    {sortBy === "department" &&
                      (sortDir === "ASC" ? (
                        <FaSortUp className="h-4 w-4" />
                      ) : (
                        <FaSortDown className="h-4 w-4" />
                      ))}
                  </div>
                </TableHeadCell>
                <TableHeadCell>Employment</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
                <TableHeadCell
                  className="cursor-pointer text-blue-500 select-none"
                  onClick={() => handleSorting("subjects_count")}
                >
                  <div className="flex items-center gap-1">
                    <span>Subjects Assigned</span>
                    {sortBy === "subjects_count" &&
                      (sortDir === "ASC" ? (
                        <FaSortUp className="h-4 w-4" />
                      ) : (
                        <FaSortDown className="h-4 w-4" />
                      ))}
                  </div>
                </TableHeadCell>
                <TableHeadCell
                  className="cursor-pointer text-blue-500 select-none"
                  onClick={() => handleSorting("total_load")}
                >
                  <div className="flex items-center gap-1">
                    <span>Total Load</span>
                    {sortBy === "total_load" &&
                      (sortDir === "ASC" ? (
                        <FaSortUp className="h-4 w-4" />
                      ) : (
                        <FaSortDown className="h-4 w-4" />
                      ))}
                  </div>
                </TableHeadCell>
              </TableRow>
            </TableHead>

            <TableBody className="divide-y">
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Spinner size="sm" />
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Fetching Teachers Summary...
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : teachers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    {searchTerm ||
                    departmentFilter !== "All Departments" ||
                    statusFilter !== "All Active & On Leave"
                      ? `No matching teachers found for the current filters.`
                      : "No teacher records found."}
                  </TableCell>
                </TableRow>
              ) : (
                teachers.map((item, index) => {
                  const { prepLimit, facultyLoadLimit } = getLimitsForTeacher(
                    item.employment_type,
                  );
                  const teacherFullName =
                    item.full_name || `${item.surname}, ${item.f_name}`;

                  return (
                    <TableRow
                      key={`teacher-${item.teacher_id || index}`}
                      className="cursor-pointer bg-white dark:border-gray-700 dark:bg-gray-800"
                      onClick={() =>
                        loadTeacherData(item.teacher_id, teacherFullName)
                      }
                    >
                      <TableCell className="font-medium text-gray-900 dark:text-white">
                        <div className="flex flex-col">
                          <span>{teacherFullName}</span>
                          <span className="text-xs text-gray-500">
                            {item.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300">
                        {item.teacher_code}
                      </TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300">
                        {item.department}
                      </TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300">
                        {item.employment_type}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            item.status === "Active"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                          }`}
                        >
                          {item.status}
                        </span>
                      </TableCell>
                      <TableCell
                        className={`text-center font-semibold ${
                          parseFloat(
                            Number(item.subjects_count || 0).toFixed(2),
                          ) > parseFloat(Number(prepLimit || 0).toFixed(2))
                            ? "text-red-500"
                            : parseFloat(
                                  Number(item.subjects_count || 0).toFixed(2),
                                ) <
                                parseFloat(Number(prepLimit || 0).toFixed(2))
                              ? "text-green-500"
                              : "text-yellow-500 dark:text-yellow-300"
                        }`}
                      >
                        {parseFloat(
                          Number(item.subjects_count || 0).toFixed(2),
                        )}{" "}
                        / {parseFloat(Number(prepLimit || 0).toFixed(2))}
                      </TableCell>
                      <TableCell
                        className={`text-center font-semibold ${
                          parseFloat(Number(item.total_load || 0).toFixed(2)) >
                          parseFloat(Number(facultyLoadLimit || 0).toFixed(2))
                            ? "text-red-500"
                            : parseFloat(
                                  Number(item.total_load || 0).toFixed(2),
                                ) <
                                parseFloat(
                                  Number(facultyLoadLimit || 0).toFixed(2),
                                )
                              ? "text-green-500"
                              : "text-yellow-500 dark:text-yellow-300"
                        }`}
                      >
                        {parseFloat(Number(item.total_load || 0).toFixed(2))} /{" "}
                        {parseFloat(Number(facultyLoadLimit || 0).toFixed(2))}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Footer */}
        {!isLoading && totalPages > 0 && (
          <div className="flex w-full justify-center">
            <Pagination
              layout="pagination"
              currentPage={currentPage || 1}
              totalPages={totalPages}
              onPageChange={(p) => setCurrentPage(p)}
              showIcons
            />
          </div>
        )}

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
                {toastType === "warning" && (
                  <HiExclamation className="h-5 w-5" />
                )}
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
      </div>

      {/* Right Div */}
      <div
        className={`fixed inset-0 top-17 bottom-0 left-14 z-10 h-[calc(100vh-64px)] bg-white p-4 transition-all sm:static sm:z-0 sm:h-[calc(100vh-8rem)] sm:max-w-md sm:p-0 dark:bg-gray-900 ${
          !selectedTeacherID ? "hidden sm:block" : "block"
        }`}
      >
        <div className={"flex items-start justify-between"}>
          <div className={"flex gap-4"}>
            <div className={"block sm:hidden"}>
              <Tooltip placement={"bottom"} content={"Close"}>
                <Button
                  color={"alternative"}
                  onClick={() => setSelectedTeacherID("")}
                >
                  <HiChevronLeft color={"gray"} />
                </Button>
              </Tooltip>
            </div>
            <div className={"cursor-help"}>
              <Tooltip
                content={
                  "Filters to only show subjects from selected curricula"
                }
                placement={"bottom"}
              >
                <b className={"flex items-center gap-1 text-xl font-extrabold"}>
                  Curriculum Constraints
                  <HiQuestionMarkCircle color={"gray"} />
                </b>
              </Tooltip>
            </div>
          </div>

          <Tooltip
            style={isDarkMode ? "dark" : "light"}
            placement={"bottom"}
            content={"Set Constraints for Selecting Subjects"}
          >
            <HiCog6Tooth
              className="h-8 w-8 cursor-pointer text-gray-500"
              onClick={handleOpenConfigModal}
            />
          </Tooltip>
        </div>

        <div
          className={
            "mt-2 mb-4 flex max-h-12 scrollbar-thumb-gray-400 scrollbar-track-transparent gap-1.5 overflow-x-auto pb-2"
          }
        >
          {constraintsLoading
            ? "Constraints Loading..."
            : curriculumAdd.length > 0
              ? curriculumAdd.map((item, index) => {
                  return (
                    <Badge
                      key={item.curriculum_id}
                      className={"min-w-22 items-center justify-center"}
                      color={"gray"}
                    >
                      <span className={"inline-flex items-center"}>
                        {item.curriculum_version}
                      </span>
                    </Badge>
                  );
                })
              : "No Curriculumn Constraints set"}
        </div>

        {/* Right Sidebar */}
        <div
          className={
            "overflow-y-auto rounded-2xl border border-gray-500/20 p-4"
          }
        >
          <div>
            {!selectedTeacherID ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Click on a teacher from the table to view and manage their
                preassigned subjects.
              </p>
            ) : isPreassignmentLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="sm" />
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                  Loading pre-assignments...
                </span>
              </div>
            ) : (
              (() => {
                const selectedTeacher = teachers.find(
                  (t) => t.teacher_id === selectedTeacherID,
                );
                const { prepLimit, facultyLoadLimit } = selectedTeacher
                  ? getLimitsForTeacher(selectedTeacher.employment_type)
                  : { prepLimit: 0, facultyLoadLimit: 0 };

                const teacherSubjectsCount = Number(
                  selectedTeacher?.subjects_count || 0,
                );
                const teacherTotalLoad = Number(
                  selectedTeacher?.total_load || 0,
                );

                return (
                  <>
                    {/* Overview Card / Grid matching table metrics */}
                    <div>
                      <h5 className="m-0 text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                        {!selectedTeacherID
                          ? "Select A Teacher to assign Subjects"
                          : selectedTeacherName}
                      </h5>
                      <p className={"mb-3 text-gray-500 dark:text-gray-400"}>
                        {selectedTeacher?.email}
                      </p>
                    </div>

                    <div
                      className={
                        "my-4 flex w-full justify-center gap-4 sm:gap-8"
                      }
                    >
                      {/* Prep Meter */}
                      <div className={"flex w-40 justify-center"}>
                        <Tooltip
                          content={`${
                            selectedTeacher &&
                            (teacherSubjectsCount < prepLimit
                              ? "Underloaded"
                              : teacherSubjectsCount > prepLimit
                                ? "Overloaded"
                                : "At Capacity")
                          }`}
                          style={isDarkMode ? "dark" : "light"}
                        >
                          <div className={"cursor-help"}>
                            <div>Prep</div>
                            <div
                              className={`text-sm sm:text-xl ${
                                selectedTeacher &&
                                (teacherSubjectsCount < prepLimit
                                  ? "text-green-500"
                                  : teacherSubjectsCount > prepLimit
                                    ? "text-red-500"
                                    : "text-yellow-400")
                              }`}
                            >
                              {parseFloat(teacherSubjectsCount.toFixed(2))} /{" "}
                              {parseFloat(prepLimit.toFixed(2))}
                            </div>
                          </div>
                        </Tooltip>
                        <div
                          className={
                            "ml-2 border-l border-black pr-2 dark:border-white"
                          }
                        />
                        <HiBookOpen
                          className={"h-full w-auto"}
                          color={
                            teacherSubjectsCount < prepLimit
                              ? "green"
                              : teacherSubjectsCount > prepLimit
                                ? "red"
                                : "yellow"
                          }
                        />
                      </div>

                      {/* Load Meter */}
                      <div className={"flex w-40 justify-center"}>
                        <Tooltip
                          content={`${
                            selectedTeacher &&
                            (teacherTotalLoad < facultyLoadLimit
                              ? "Underloaded"
                              : teacherTotalLoad > facultyLoadLimit
                                ? "Overloaded"
                                : "At Capacity")
                          }`}
                          style={isDarkMode ? "dark" : "light"}
                        >
                          <div className={"cursor-help"}>
                            <div>Load</div>
                            <div
                              className={`text-sm sm:text-xl ${
                                selectedTeacher &&
                                (teacherTotalLoad < facultyLoadLimit
                                  ? "text-green-500"
                                  : teacherTotalLoad > facultyLoadLimit
                                    ? "text-red-500"
                                    : "text-yellow-400")
                              }`}
                            >
                              {parseFloat(teacherTotalLoad.toFixed(2))} /{" "}
                              {parseFloat(facultyLoadLimit.toFixed(2))}
                            </div>
                          </div>
                        </Tooltip>
                        <div
                          className={
                            "ml-2 border-l border-black pr-2 dark:border-white"
                          }
                        />
                        <HiClock
                          className={"h-full w-auto"}
                          color={
                            teacherTotalLoad < facultyLoadLimit
                              ? "green"
                              : teacherTotalLoad > facultyLoadLimit
                                ? "red"
                                : "yellow"
                          }
                        />
                      </div>
                    </div>

                    <Button
                      className={"w-full font-semibold"}
                      onClick={() => setOpenAddModal(true)}
                    >
                      <HiPlus className={"mr-2"} />
                      Subject
                    </Button>

                    {teacherPreassignments.length === 0 ? (
                      <p className="pt-2 text-sm text-gray-500 dark:text-gray-400">
                        No pre-assignments found for this teacher.
                      </p>
                    ) : (
                      <div className="h-96 space-y-3 overflow-y-auto pt-2">
                        {teacherPreassignments.map((item, idx) => (
                          <div
                            key={item.preassignment_id || idx}
                            className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700/50"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {item.subject_name || item.subject_id}
                              </span>
                              <div className="flex items-center gap-2">
                                {item.merge_lec_lab && (
                                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                    Merged Lec/Lab
                                  </span>
                                )}
                                <Dropdown
                                  label=""
                                  dismissOnClick={true}
                                  renderTrigger={() => (
                                    <button className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                                      <HiDotsVertical className="h-4 w-4" />
                                    </button>
                                  )}
                                >
                                  <DropdownItem
                                    onClick={() => handleToggleMerge(item)}
                                  >
                                    {item.merge_lec_lab
                                      ? "Unmerge Lec/Lab"
                                      : "Toggle Merge Lec/Lab"}
                                  </DropdownItem>
                                  <DropdownItem
                                    className="text-red-600 dark:text-red-400"
                                    onClick={() => {
                                      setSubjectToDelete(item);
                                      setOpenDeleteModal(true);
                                    }}
                                  >
                                    Remove Subject
                                  </DropdownItem>
                                </Dropdown>
                              </div>
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              Department: {item.department || "N/A"} | Lec:{" "}
                              {parseFloat(
                                Number(item.lecture_units || 0).toFixed(2),
                              )}{" "}
                              | Lab:{" "}
                              {parseFloat(
                                Number(item.lab_units || 0).toFixed(2),
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()
            )}
          </div>
        </div>
      </div>

      {/* CONFIG MODAL */}
      <Modal show={openConfigModal}>
        <ModalHeader>
          <div>Set Subject Constraints</div>
          <span className={"text-sm text-gray-500 dark:text-gray-300"}>
            Only Added Curricula are will be shown if there are any added into
            this list
          </span>
        </ModalHeader>
        <ModalBody>
          <div className={"flex"}>
            <div className={"w-[80%]"}>
              <div className="mb-2 text-sm text-gray-600 dark:text-gray-300">
                <span>Recommended benchmark: </span>
                <Tooltip
                  style={isDarkMode ? "dark" : "light"}
                  content={
                    <div className="space-y-1">
                      <div>
                        • 4 curricula per tertiary program (1st–4th year)
                      </div>
                      <div>• 2 curricula per SHS strand (Grades 11 & 12)</div>
                    </div>
                  }
                >
                  <span className="cursor-help font-bold text-blue-600 underline decoration-dotted underline-offset-4 dark:text-blue-400">
                    {reccomendedConstraints} total curricula
                  </span>
                </Tooltip>
                <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                  Based on all active programs and strands.
                </span>
              </div>

              <div>
                <Label>Curriculum Search</Label>
                <TextInput
                  value={curriculaSearch}
                  placeholder={"e.g. BSIT-22-01"}
                  onChange={(e) => setCurriculaSearch(e.target.value)}
                />
                <div>
                  {curricula
                    .filter(
                      (item) =>
                        !curriculumAdd.some(
                          (added) => added.curriculum_id === item.curriculum_id,
                        ),
                    )
                    .map((item) => {
                      return (
                        <div
                          key={item.curriculum_id}
                          onClick={() => handleAddCurriculum(item)}
                          className={
                            "my-1 cursor-pointer rounded bg-black/15 p-2 hover:bg-black/10 dark:text-white"
                          }
                        >
                          {item.curriculum_version}
                        </div>
                      );
                    })}
                </div>
              </div>
              <h3 className={"py-3 dark:text-white"}>Added Curriculum</h3>
              <div
                className={"min-h-24 rounded-xl border border-gray-500/50 p-2"}
              >
                <div className={"flex flex-wrap gap-2"}>
                  {curriculumAdd.length > 0 &&
                    curriculumAdd.map((item, index) => {
                      return (
                        <Badge
                          key={item.curriculum_id}
                          className={"items-center"}
                          color={"info"}
                        >
                          <span className={"inline-flex items-center gap-1.5"}>
                            {item.curriculum_version}
                            <HiX
                              className={
                                "h-4 w-4 cursor-pointer text-cyan-950 hover:text-red-500 dark:text-gray-300 dark:hover:text-red-400"
                              }
                              onClick={() => {
                                setCurriculumAdd((prev) =>
                                  prev.filter(
                                    (curriculum) =>
                                      curriculum.curriculum_id !==
                                      item.curriculum_id,
                                  ),
                                );
                              }}
                            />
                          </span>
                        </Badge>
                      );
                    })}
                </div>
              </div>
            </div>

            <div className={"ml-3 w-[20%] border-l border-gray-500 pl-2"}>
              <div
                className={
                  "mx-2 text-center font-semibold text-cyan-700 dark:text-cyan-300"
                }
              >
                Programs
              </div>
              <div
                className={
                  "mx-2 text-center font-semibold text-yellow-700 dark:text-yellow-300"
                }
              >
                & Strands
              </div>

              <div
                className={
                  "max-h-56 scrollbar-thumb-gray-400 scrollbar-track-transparent overflow-y-auto"
                }
              >
                {programs.map((item) => {
                  return (
                    <Badge
                      color={
                        item.year_level.toLowerCase() === "tertiary"
                          ? "info"
                          : "warning"
                      }
                      key={item.program_code}
                      className={"my-1 justify-center border border-gray-400"}
                    >
                      {item.program_code}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter className={"flex"}>
          <Button
            onClick={() => updateConfig()}
            disabled={!hasChanges() || isSubmittingConfig}
          >
            {isSubmittingConfig ? <Spinner size="sm" className="mr-2" /> : null}
            Save
          </Button>
          <Button color={"alternative"} onClick={() => closeConfigModal()}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* ADD MODAL */}
      <Modal show={openAddModal} onClose={closeAddModal}>
        <ModalHeader>Add Subject Pre-Assignment</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <Label>Teacher</Label>
              <div className={"font-semibold text-gray-900 dark:text-white"}>
                {selectedTeacherName}
              </div>
            </div>

            <div>
              <Label>Search Subject (Filtered by Curriculum Constraints)</Label>
              <TextInput
                value={subjectSearchQuery}
                placeholder={"Type course code or name..."}
                onChange={(e) => setSubjectSearchQuery(e.target.value)}
                icon={HiSearch}
              />
              {isSearchingSubjects && (
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                  <Spinner size="sm" />
                  <span>Searching subjects...</span>
                </div>
              )}
              <div className="mt-1 max-h-48 overflow-y-auto">
                {subjectSearchResults
                  .filter(
                    (subj) =>
                      !teacherPreassignments.some(
                        (p) => p.subject_id === subj.subject_id,
                      ),
                  )
                  .map((subj) => {
                    const isSelected =
                      selectedSubjectToAssign?.subject_id === subj.subject_id;
                    return (
                      <div
                        key={subj.subject_id}
                        onClick={() => setSelectedSubjectToAssign(subj)}
                        className={`my-1.5 cursor-pointer rounded-lg border p-3 text-sm transition-all ${
                          isSelected
                            ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="leading-snug font-semibold dark:text-white">
                            {subj.course_name}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                              isSelected
                                ? "bg-blue-700 text-blue-100"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {subj.curriculum}
                          </span>
                        </div>
                        <div
                          className={`mt-1.5 flex flex-wrap items-center gap-2 text-xs ${
                            isSelected
                              ? "text-blue-100"
                              : "text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          <span className="font-mono font-medium">
                            {subj.course_code}
                          </span>
                          <span>•</span>
                          <span>
                            {subj.lecture_units} Lec / {subj.lab_units} Lab
                            Units
                          </span>
                          {subj.year_term && (
                            <>
                              <span>•</span>
                              <span>{subj.year_term}</span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {selectedSubjectToAssign && (
              <>
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold tracking-wide text-blue-700 uppercase dark:text-blue-400">
                      Selected Subject for Assignment
                    </span>
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-300 dark:text-white">
                      {selectedSubjectToAssign.curriculum}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                    {selectedSubjectToAssign.course_name}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <span className="font-mono font-medium">
                      {selectedSubjectToAssign.course_code}
                    </span>
                    <span>•</span>
                    <span>
                      {selectedSubjectToAssign.lecture_units} Lec /{" "}
                      {selectedSubjectToAssign.lab_units} Lab Units
                    </span>
                    {selectedSubjectToAssign.year_term && (
                      <>
                        <span>•</span>
                        <span>{selectedSubjectToAssign.year_term}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Merge Lec/Lab Checkbox */}
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="merge-lec-lab"
                    checked={mergeLecLab}
                    onChange={(e) => setMergeLecLab(e.target.checked)}
                  />
                  <Label
                    htmlFor="merge-lec-lab"
                    className="cursor-pointer text-sm font-medium"
                  >
                    Merge Lecture and Laboratory Units
                  </Label>
                </div>

                {/* Projected Load & Subject Indicators inside Add Modal */}
                {(() => {
                  const selectedTeacher = teachers.find(
                    (t) => t.teacher_id === selectedTeacherID,
                  );
                  if (!selectedTeacher) return null;
                  const { prepLimit, facultyLoadLimit, overloadMax } =
                    getLimitsForTeacher(selectedTeacher.employment_type);

                  const newSubjectsCount =
                    Number(selectedTeacher.subjects_count || 0) + 1;
                  const subjectUnits = mergeLecLab
                    ? Math.max(
                        Number(selectedSubjectToAssign.lecture_units || 0),
                        Number(selectedSubjectToAssign.lab_units || 0),
                      )
                    : Number(selectedSubjectToAssign.lecture_units || 0) +
                      Number(selectedSubjectToAssign.lab_units || 0);
                  const newTotalLoad =
                    Number(selectedTeacher.total_load || 0) + subjectUnits;

                  const isPrepExceeded = newSubjectsCount > prepLimit;
                  const isLoadExceeded = newTotalLoad > facultyLoadLimit;
                  const isHardLimitExceeded = newTotalLoad > overloadMax;

                  return (
                    <div className="space-y-2">
                      <div className="my-2 flex w-full justify-center gap-6 rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                        <div className={"flex items-center justify-center"}>
                          <div>
                            <div className="text-xs text-gray-500">
                              Proj. Prep
                            </div>
                            <div
                              className={`text-lg font-bold ${
                                isPrepExceeded
                                  ? "text-red-500"
                                  : "text-green-500"
                              }`}
                            >
                              {parseFloat(Number(newSubjectsCount).toFixed(2))}{" "}
                              / {parseFloat(Number(prepLimit).toFixed(2))}
                            </div>
                          </div>
                          <div className="ml-2 border-l border-gray-300 pl-2 dark:border-gray-600">
                            <HiBookOpen
                              className={`h-7 w-7 ${
                                isPrepExceeded
                                  ? "text-red-500"
                                  : "text-green-500"
                              }`}
                            />
                          </div>
                        </div>

                        <div className={"flex items-center justify-center"}>
                          <div>
                            <div className="text-xs text-gray-500">
                              Proj. Load
                            </div>
                            <div
                              className={`text-lg font-bold ${
                                isHardLimitExceeded
                                  ? "font-extrabold text-red-600"
                                  : isLoadExceeded
                                    ? "text-red-500"
                                    : "text-green-500"
                              }`}
                            >
                              {parseFloat(Number(newTotalLoad).toFixed(2))} /{" "}
                              {parseFloat(Number(facultyLoadLimit).toFixed(2))}
                            </div>
                          </div>
                          <div className="ml-2 border-l border-gray-300 pl-2 dark:border-gray-600">
                            <HiClock
                              className={`h-7 w-7 ${
                                isHardLimitExceeded || isLoadExceeded
                                  ? "text-red-500"
                                  : "text-green-500"
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      {isHardLimitExceeded && (
                        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                          <div className="flex items-center gap-1.5 font-semibold">
                            <HiExclamation className="h-5 w-5 shrink-0" />
                            <span>Hard Limit Exceeded</span>
                          </div>
                          <p className="mt-1 text-xs">
                            Total load (
                            {parseFloat(Number(newTotalLoad).toFixed(2))})
                            exceeds the absolute maximum overload limit (
                            {parseFloat(Number(overloadMax).toFixed(2))}). You
                            cannot proceed with this assignment.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </ModalBody>
        <ModalFooter className={"flex"}>
          {(() => {
            const selectedTeacher = teachers.find(
              (t) => t.teacher_id === selectedTeacherID,
            );
            const overloadMax = selectedTeacher
              ? getLimitsForTeacher(selectedTeacher.employment_type).overloadMax
              : 0;
            const subjectUnits = selectedSubjectToAssign
              ? mergeLecLab
                ? Math.max(
                    Number(selectedSubjectToAssign.lecture_units || 0),
                    Number(selectedSubjectToAssign.lab_units || 0),
                  )
                : Number(selectedSubjectToAssign.lecture_units || 0) +
                  Number(selectedSubjectToAssign.lab_units || 0)
              : 0;
            const newTotalLoad =
              Number(selectedTeacher?.total_load || 0) + subjectUnits;
            const isHardLimitExceeded = newTotalLoad > overloadMax;

            return (
              <Button
                disabled={
                  !selectedSubjectToAssign ||
                  isSubmittingAddPreAssignment ||
                  isHardLimitExceeded
                }
                onClick={handlePreAssignmentSaveClick}
              >
                {isSubmittingAddPreAssignment ? (
                  <Spinner size="sm" className="mr-2" />
                ) : null}
                Save
              </Button>
            );
          })()}
          <Button color={"alternative"} onClick={() => closeAddModal()}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* OVER-LIMIT WARNING CONFIRMATION MODAL */}
      <Modal
        show={openWarningModal}
        onClose={() => setOpenWarningModal(false)}
        size="md"
      >
        <ModalHeader className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-yellow-500">
            <HiExclamation className="h-6 w-6" />
            <span className="font-bold text-gray-900 dark:text-white">
              Limit Exceeded Warning
            </span>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Assigning this subject will cause <b>{selectedTeacherName}</b> to
              exceed their allowed maximum prep count or total load limit. Do
              you still want to proceed?
            </p>

            {(() => {
              const selectedTeacher = teachers.find(
                (t) => t.teacher_id === selectedTeacherID,
              );
              if (!selectedTeacher) return null;
              const { prepLimit, facultyLoadLimit } = getLimitsForTeacher(
                selectedTeacher.employment_type,
              );

              const newSubjectsCount =
                Number(selectedTeacher.subjects_count || 0) + 1;
              const subjectUnits = mergeLecLab
                ? Math.max(
                    Number(selectedSubjectToAssign?.lecture_units || 0),
                    Number(selectedSubjectToAssign?.lab_units || 0),
                  )
                : Number(selectedSubjectToAssign?.lecture_units || 0) +
                  Number(selectedSubjectToAssign?.lab_units || 0);
              const newTotalLoad =
                Number(selectedTeacher.total_load || 0) + subjectUnits;

              return (
                <div className="my-4 flex w-full justify-center gap-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                  <div className={"flex items-center justify-center"}>
                    <div>
                      <div className="text-xs text-gray-500">Proj. Prep</div>
                      <div
                        className={`text-xl font-bold ${
                          parseFloat(Number(newSubjectsCount).toFixed(2)) >
                          parseFloat(Number(prepLimit).toFixed(2))
                            ? "text-red-500"
                            : "text-green-500"
                        }`}
                      >
                        {parseFloat(Number(newSubjectsCount).toFixed(2))} /{" "}
                        {parseFloat(Number(prepLimit).toFixed(2))}
                      </div>
                    </div>
                    <div className="ml-2 border-l border-gray-300 pl-2 dark:border-gray-600">
                      <HiBookOpen className={"h-8 w-8 text-red-500"} />
                    </div>
                  </div>

                  <div className={"flex items-center justify-center"}>
                    <div>
                      <div className="text-xs text-gray-500">Proj. Load</div>
                      <div
                        className={`text-xl font-bold ${
                          parseFloat(Number(newTotalLoad).toFixed(2)) >
                          parseFloat(Number(facultyLoadLimit).toFixed(2))
                            ? "text-red-500"
                            : "text-green-500"
                        }`}
                      >
                        {parseFloat(Number(newTotalLoad).toFixed(2))} /{" "}
                        {parseFloat(Number(facultyLoadLimit).toFixed(2))}
                      </div>
                    </div>
                    <div className="ml-2 border-l border-gray-300 pl-2 dark:border-gray-600">
                      <HiClock className={"h-8 w-8 text-red-500"} />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </ModalBody>
        <ModalFooter className="flex justify-end gap-2">
          <Button
            color="red"
            onClick={executeAddPreAssignment}
            disabled={isSubmittingAddPreAssignment}
          >
            {isSubmittingAddPreAssignment ? (
              <Spinner size="sm" className="mr-2" />
            ) : null}
            Proceed Anyway
          </Button>
          <Button
            color="gray"
            onClick={() => setOpenWarningModal(false)}
            disabled={isSubmittingAddPreAssignment}
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* REMOVE SUBJECT CONFIRMATION MODAL */}
      <Modal
        show={openDeleteModal}
        onClose={() => setOpenDeleteModal(false)}
        size="md"
      >
        <ModalHeader className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-red-500">
            <HiExclamation className="h-6 w-6" />
            <span className="font-bold text-gray-900 dark:text-white">
              Confirm Subject Removal
            </span>
          </div>
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Are you sure you want to remove{" "}
            <b>
              {subjectToDelete?.subject_name || subjectToDelete?.subject_id}
            </b>{" "}
            from <b>{selectedTeacherName}</b>?
          </p>
        </ModalBody>
        <ModalFooter className="flex justify-end gap-2">
          <Button
            color="red"
            onClick={executeDeletePreassignment}
            disabled={isSubmittingDelete}
          >
            {isSubmittingDelete ? <Spinner size="sm" className="mr-2" /> : null}
            Confirm Removal
          </Button>
          <Button
            color="gray"
            onClick={() => setOpenDeleteModal(false)}
            disabled={isSubmittingDelete}
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}