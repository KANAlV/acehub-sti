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
  useThemeMode,
} from "flowbite-react";
import {
  HiSearch,
  HiX,
  HiCheck,
  HiExclamation,
  HiClock,
  HiPlus,
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
  const [openRemoveModal, setOpenRemoveModal] = useState(false);

  // --- Form & Preassignment State ---
  const [selectedTeacherID, setSelectedTeacherID] = useState("");
  const [selectedTeacherName, setSelectedTeacherName] = useState("");
  const [teacherPreassignments, setTeacherPreassignments] = useState<
    TeacherPreassignmentRecord[]
  >([]);
  const [isPreassignmentLoading, setIsPreassignmentLoading] =
    useState<boolean>(false);

  // --- Add Modal Subject Search States ---
  const [subjectSearchQuery, setSubjectSearchQuery] = useState("");
  const [debouncedSubjectSearch, setDebouncedSubjectSearch] = useState("");
  const [subjectSearchResults, setSubjectSearchResults] = useState<
    SubjectRecord[]
  >([]);
  const [isSearchingSubjects, setIsSearchingSubjects] = useState(false);
  const [selectedSubjectToAssign, setSelectedSubjectToAssign] =
    useState<SubjectRecord | null>(null);

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
      console.log("Search triggered. Query:", debouncedSubjectSearch);
      console.log("Current curriculum IDs:", curriculumAdd.map((c) => c.curriculum_id));

      if (!debouncedSubjectSearch || debouncedSubjectSearch.trim().length < 2) {
        console.log("Query too short, skipping search.");
        setSubjectSearchResults([]);
        return;
      }

      setIsSearchingSubjects(true);
      const curriculumIds = curriculumAdd.map((c) => c.curriculum_id);

      try {
        const res = await searchSubjectsWithCurriculumFilter(
          debouncedSubjectSearch,
          curriculumIds,
        );
        console.log("Search response received:", res);
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

  // Helper to map employment type to config limits keys
  const getLimitsForTeacher = (employmentType: string) => {
    const normalized = employmentType?.toLowerCase() || "";
    if (
      normalized.includes("part-time full load") ||
      normalized.includes("part_time_full_load")
    ) {
      return {
        prepLimit: config?.prep_limits?.part_time_full_load ?? 0,
        facultyLoadLimit: config?.faculty_load?.part_time_full_load ?? 0,
      };
    } else if (normalized.includes("part")) {
      return {
        prepLimit: config?.prep_limits?.part_time ?? 0,
        facultyLoadLimit: config?.faculty_load?.part_time ?? 0,
      };
    } else {
      return {
        prepLimit: config?.prep_limits?.full_time ?? 0,
        facultyLoadLimit: config?.faculty_load?.full_time ?? 0,
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
                      <TableCell className="text-center font-semibold text-gray-900 dark:text-white">
                        {item.subjects_count} / {prepLimit}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-gray-900 dark:text-white">
                        {item.total_load} / {facultyLoadLimit}
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
            <div>
              <Tooltip placement={"bottom"} content={"Close"}>
                <Button
                  color={"alternative"}
                  onClick={() => setSelectedTeacherID("")}
                >
                  <HiChevronLeft color={"gray"} />
                </Button>
              </Tooltip>
            </div>
            <div>
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

                    <div className={"my-4 flex w-full justify-center gap-8"}>
                      {/* Prep Meter */}
                      <div className={"flex w-40 justify-center"}>
                        <div>
                          <div>Prep</div>
                          <div
                            className={`text-2xl ${
                              selectedTeacher &&
                              (selectedTeacher.subjects_count < prepLimit
                                ? "text-green-500"
                                : selectedTeacher.subjects_count > prepLimit
                                  ? "text-red-500"
                                  : "text-yellow-400")
                            }`}
                          >
                            {selectedTeacher
                              ? selectedTeacher.subjects_count
                              : 0}{" "}
                            / {prepLimit}
                          </div>
                        </div>
                        <div
                          className={
                            "ml-2 border-l border-black pr-2 dark:border-white"
                          }
                        />
                        <HiBookOpen
                          className={"h-full w-auto"}
                          color={
                            selectedTeacher &&
                            (selectedTeacher.subjects_count < prepLimit
                              ? "green"
                              : selectedTeacher.subjects_count > prepLimit
                                ? "red"
                                : "yellow")
                          }
                        />
                      </div>

                      {/* Load Meter */}
                      <div className={"flex w-40 justify-center"}>
                        <div>
                          <div>Load</div>
                          <div
                            className={`text-2xl ${
                              selectedTeacher &&
                              (selectedTeacher.total_load < facultyLoadLimit
                                ? "text-green-500"
                                : selectedTeacher.total_load > facultyLoadLimit
                                  ? "text-red-500"
                                  : "text-yellow-400")
                            }`}
                          >
                            {selectedTeacher ? selectedTeacher.total_load : 0} /{" "}
                            {facultyLoadLimit}
                          </div>
                        </div>
                        <div
                          className={
                            "ml-2 border-l border-black pr-2 dark:border-white"
                          }
                        />
                        <HiClock
                          className={"h-full w-auto"}
                          color={
                            selectedTeacher &&
                            (selectedTeacher.subjects_count < prepLimit
                              ? "green"
                              : selectedTeacher.subjects_count > prepLimit
                                ? "red"
                                : "yellow")
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
                      <div className="space-y-3 pt-2">
                        {teacherPreassignments.map((item, idx) => (
                          <div
                            key={item.preassignment_id || idx}
                            className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700/50"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {item.subject_name || item.subject_id}
                              </span>
                              {item.merge_lec_lab && (
                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                  Merged Lec/Lab
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              Department: {item.department || "N/A"}
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
              <div className="mb-1 text-gray-500 dark:text-gray-300">
                <span>It is recommended to add </span>
                <span className="inline-block align-baseline">
                  <Tooltip
                    style={isDarkMode ? "dark" : "light"}
                    content={
                      <>
                        <div>
                          4 Curriula per program (tertiary: 1st to 4th year),
                        </div>
                        <div>2 per strand (shs: grd 11 & 12)</div>
                      </>
                    }
                  >
                    <b className={"font-bold text-blue-500"}>
                      [{reccomendedConstraints}]
                    </b>
                  </Tooltip>
                </span>
                <span>
                  {" "}
                  Curricula, for each corresponding programs/strands.
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
                  "mx-2 text-center text-cyan-300 drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,1)]"
                }
              >
                Programs
              </div>
              <div
                className={
                  "mx-2 text-center text-yellow-300 drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,1)]"
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
                {subjectSearchResults.map((subj) => {
                  const isSelected =
                    selectedSubjectToAssign?.subject_id === subj.subject_id;
                  return (
                    <div
                      key={subj.subject_id}
                      onClick={() => setSelectedSubjectToAssign(subj)}
                      className={`my-1 cursor-pointer rounded p-2 text-sm transition-colors ${
                        isSelected
                          ? "bg-blue-600 text-white"
                          : "bg-black/10 hover:bg-black/20 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                      }`}
                    >
                      <div className="font-semibold">{subj.course_name}</div>
                      <div className="text-xs opacity-80">
                        Code: {subj.course_code} | Units: {subj.lecture_units}{" "}
                        Lec / {subj.lab_units} Lab{" "}
                        {subj.year_term ? `| Term: ${subj.year_term}` : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedSubjectToAssign && (
              <div className="rounded-lg border border-blue-500 bg-blue-50 p-3 dark:bg-blue-950/40">
                <div className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                  Selected Subject for Assignment:
                </div>
                <div className="text-sm font-bold text-gray-900 dark:text-white">
                  {selectedSubjectToAssign.course_name} (
                  {selectedSubjectToAssign.course_code})
                </div>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter className={"flex"}>
          <Button
            disabled={!selectedSubjectToAssign || isSubmittingAddPreAssignment}
            onClick={() => {
              // Implement your save subject preassignment call here
            }}
          >
            {isSubmittingAddPreAssignment ? (
              <Spinner size="sm" className="mr-2" />
            ) : null}
            Save
          </Button>
          <Button color={"alternative"} onClick={() => closeAddModal()}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}