"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
  fetchSubjectsAQClusters,
  SubjectAQClusterRecord,
  AQRecord,
  fetchTeacherAQRecords,
  getTeachersWithoutPreassignmentCount,
  deletePreassignmentTemplate,
  FcceRecord,
  fetchFcce,
} from "@/app/actions/system";
import { DepartmentRecord } from "@/components/teachers/TeachersManagement";
import {
  HiBookOpen,
  HiChevronLeft,
  HiCog6Tooth,
  HiQuestionMarkCircle,
} from "react-icons/hi2";
import { useRouter } from "next/navigation";

/* FETCH BY ID / CURRICULUM FORMAT */
export interface CurriculumRecord {
  curriculum_id: string;
  curriculum_version: string;
  created_at: string;
}

interface TeacherPreassignmentManagementProps {
  preassignmentName: string;
}

interface DisplayWarningProps {
  count: number;
  dm: boolean;
}

export default function TeacherPreassignmentManagement({
  preassignmentName = "",
}: TeacherPreassignmentManagementProps) {
  const router = useRouter();

  // --- Dark Mode ---
  const { computedMode } = useThemeMode();
  const isDarkMode = computedMode === "dark";

  // --- Data State ---
  const [config, setConfig] = useState<Configuration | null>(null);
  const [programs, setPrograms] = useState<ProgramRecord[]>([]);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [teachers, setTeachers] = useState<TeacherPreassignmentSummaryRecord[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [constraintsLoading, setConstraintsLoading] = useState(true);

  // --- Program/Strand Math Count Holder ---
  const [recommendedConstraints, setRecommendedConstraints] = useState(0);

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
  const [
    openUnmetRequirementsWarningModal,
    setOpenUnmetRequirementsWarningModal,
  ] = useState(false);
  const [openNoAQAssignedWarningModal, setOpenNoAQAssignedWarningModal] =
    useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [openTemplateDeleteModal, setOpenTemplateDeleteModal] = useState(false);
  const [subjectToDelete, setSubjectToDelete] =
    useState<TeacherPreassignmentRecord | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false);

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
  const [addSubjectSearch, setAddSubjectSearch] = useState("");
  const [subjectSearchResults, setSubjectSearchResults] = useState<
    SubjectRecord[]
  >([]);
  const [isSearchingSubjects, setIsSearchingSubjects] = useState(false);
  const [selectedSubjectToAssign, setSelectedSubjectToAssign] =
    useState<SubjectRecord | null>(null);
  const [mergeLecLab, setMergeLecLab] = useState<boolean>(false);

  // --- Add Modal FCCE States ---
  const [teacherFcce, setTeacherFcce] = useState<FcceRecord[]>([]);
  const [selectedAySem, setSelectedAySem] = useState<string>("");

  // --- Subject AQ Clusters State ---
  const [subjectAQClusters, setSubjectAQClusters] = useState<
    SubjectAQClusterRecord[]
  >([]);
  const [TeacherAQ, setTeacherAQ] = useState<AQRecord[]>([]);
  const [isTeacherAQLoading, setIsTeacherAQLoading] = useState<boolean>(false);
  const [isAQLoading, setIsAQLoading] = useState<boolean>(false);

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

  // Table search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Subject Search Input inside Add Modal
  useEffect(() => {
    const handler = setTimeout(() => {
      setAddSubjectSearch(subjectSearchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [subjectSearchQuery]);

  // Execute Subject Search using curriculum filter when query changes
  useEffect(() => {
    async function performSubjectSearch() {
      if (!addSubjectSearch || addSubjectSearch.trim().length < 2) {
        setSubjectSearchResults([]);
        return;
      }

      setIsSearchingSubjects(true);
      const curriculumVersion = curriculumAdd.map((c) => c.curriculum_version);

      try {
        const res = await searchSubjectsWithCurriculumFilter(
          addSubjectSearch,
          curriculumVersion,
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
  }, [addSubjectSearch, curriculumAdd]);

  // Fetch Subject AQ Clusters when selectedSubjectToAssign changes
  useEffect(() => {
    async function getSubjectAQ() {
      if (!selectedSubjectToAssign) {
        setSubjectAQClusters([]);
        return;
      }

      setIsAQLoading(true);
      try {
        const queryTerm1 = selectedSubjectToAssign.course_name;
        const queryTerm2 = selectedSubjectToAssign.program_code;
        const res = await fetchSubjectsAQClusters(queryTerm1, queryTerm2);
        if (res.success && res.data) {
          setSubjectAQClusters(res.data);
        } else {
          setSubjectAQClusters([]);
        }
      } catch (err) {
        console.error("Error fetching subject AQ clusters:", err);
        setSubjectAQClusters([]);
      } finally {
        setIsAQLoading(false);
      }
    }

    void getSubjectAQ();
  }, [selectedSubjectToAssign]);

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
    }

    setConstraintsLoading(false);
    void loadTemplateConfigStandalone();
  }, [preassignmentName]);

  // Load Table Data and Count on Page Load/Filter Change
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setTeachers([]);
    setUnassignedCount(0);

    const [resData, countRes, resProgram, countUnassignedRes] =
      await Promise.all([
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
        getTeachersWithoutPreassignmentCount(preassignmentName),
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

    let programsCount = 0;
    let strandCount = 0;

    if (resProgram.success && resProgram.data) {
      setPrograms(resProgram.data);

      resProgram.data.map((item) => {
        if (item.year_level === "tertiary") {
          programsCount += 1;
        } else {
          strandCount += 1;
        }
      });
    } else {
      triggerToast(
        resProgram.error || "Failed to fetch Strand/Programs.",
        "error",
      );
    }

    if (countUnassignedRes.success) {
      setUnassignedCount(countUnassignedRes.count);
    } else {
      triggerToast(
        countUnassignedRes.error ||
          "Failed to fetch unassigned teachers count with pre-assignment metrics.",
        "error",
      );
    }

    setRecommendedConstraints(programsCount + strandCount);
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
        void getCurricula();
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

  // Helper to calculate subject load matching the database function (incorporating student scaling)
  const calculateSubjectLoad = (
    subject: SubjectRecord | TeacherPreassignmentRecord,
  ) => {
    const isMerged =
      "merge_lec_lab" in subject ? Boolean(subject.merge_lec_lab) : false;
    const lectureUnits = Number(subject.lecture_units || 0);
    const labUnits = Number(subject.lab_units || 0);

    const baseUnits = isMerged
      ? Math.max(lectureUnits, labUnits)
      : lectureUnits + labUnits;

    const yearTerm = "year_term" in subject ? subject.year_term : undefined;
    const yearMatch = yearTerm?.match(/(11|12|[1-4])/);
    const yrKey = yearMatch ? yearMatch[1] : "1";

    const progCodeRaw =
      "program_code" in subject ? subject.program_code : undefined;
    const deptRaw = "department" in subject ? subject.department : undefined;

    const progCode =
      typeof progCodeRaw === "string"
        ? progCodeRaw.trim().toUpperCase()
        : typeof deptRaw === "string"
          ? deptRaw.trim().toUpperCase()
          : "";

    const prog = programs.find(
      (p) => p.program_code?.trim().toUpperCase() === progCode,
    );

    let studentCount = 0;
    if (prog && prog.students) {
      try {
        const studentsObj =
          typeof prog.students === "string"
            ? (JSON.parse(prog.students) as Record<string, unknown>)
            : (prog.students as Record<string, unknown>);
        studentCount = Number(studentsObj[yrKey] || 0);
      } catch (e) {
        studentCount = 0;
      }
    }

    const maxStudents = Number(config?.max_students ?? 40);
    const multiplier = Math.max(
      1,
      Math.ceil(studentCount / (maxStudents || 1)),
    );

    return baseUnits * multiplier;
  };

  // Helper to calculate projected prep count (treating same course_name as a single prep)
  const calculateProjectedPrepCount = (newSubject: SubjectRecord | null) => {
    const existingNames = teacherPreassignments.map((p) =>
      (p.subject_name || "").trim().toLowerCase(),
    );
    const uniquePreps = new Set(existingNames);
    if (newSubject && newSubject.course_name) {
      uniquePreps.add(newSubject.course_name.trim().toLowerCase());
    }
    return uniquePreps.size;
  };

  const getAQMatchStatus = useCallback(() => {
    const teacherAQList = TeacherAQ.filter(
      (t) => t.approved === "Approved",
    ).map((t) => (t.aq || "").trim().toLowerCase());

    const parseList = (val: unknown): string[] => {
      if (Array.isArray(val)) return val;
      if (typeof val === "string") {
        const cleaned = val.replace(/^\{|}$/g, "").trim();
        if (!cleaned || cleaned === "NULL") return [];
        return (
          cleaned
            .match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)
            ?.map((s) => s.replace(/^"|"$/g, "")) ||
          cleaned.split(",").map((s) => s.trim())
        );
      }
      return [];
    };

    let hasAnyAQ = false;
    let allMatched = true;

    if (subjectAQClusters.length > 0) {
      subjectAQClusters.forEach((row) => {
        const aqs = parseList(row.aq_list);
        if (aqs.length > 0) {
          hasAnyAQ = true;
          aqs.forEach((aq) => {
            if (!teacherAQList.includes(aq.trim().toLowerCase())) {
              allMatched = false;
            }
          });
        }
      });
    }

    return {
      teacherAQList,
      parseList,
      isFullyMatched: hasAnyAQ && allMatched,
    };
  }, [TeacherAQ, subjectAQClusters]);

  // Helper to check if teacher has fully matched AQs for selected subject
  const checkIsFullyMatched = () => {
    if (!selectedSubjectToAssign) return true;

    const aqCompute = getAQMatchStatus();

    const hasNoAQsAssigned =
      subjectAQClusters.length === 0 ||
      subjectAQClusters.every((row) => {
        const clusterNames = aqCompute.parseList(row.cluster_names);
        const aqs = aqCompute.parseList(row.aq_list);
        return clusterNames.length === 0 && aqs.length === 0;
      });

    if (hasNoAQsAssigned) return false;

    const isNoAQRequired = subjectAQClusters.every((row) => {
      const aqs = aqCompute.parseList(row.aq_list);
      return aqs.length === 1 && aqs[0].toUpperCase() === "NULL";
    });

    return isNoAQRequired || aqCompute.isFullyMatched;
  };

  // --- FCCE Match Status Helper ---
  const getFCCEMatchStatus = useCallback(() => {
    if (!selectedSubjectToAssign) {
      return { hasRecord: false, passed: false };
    }

    const selectedCourseName = (selectedSubjectToAssign.course_name || "")
      .trim()
      .toLowerCase();

    const matchingFcce = teacherFcce.find((f) => {
      const courseMatch =
        (f.course_name || "").trim().toLowerCase() === selectedCourseName;
      if (!courseMatch) return false;
      if (selectedAySem && f.ay_sem !== selectedAySem) return false;
      return true;
    });

    if (!matchingFcce) {
      return { hasRecord: false, passed: false };
    }

    return {
      hasRecord: true,
      passed: Boolean(matchingFcce.pass),
    };
  }, [selectedSubjectToAssign, teacherFcce, selectedAySem]);

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
    setSubjectAQClusters([]);
    setSelectedAySem("");
    setMergeLecLab(false);
    setIsSubmittingAddPreAssignment(false);
  }

  // Function that loads teacher pre-assignments using fetchTeacherPreassignments()
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
        res.error || "Failed to load teacher pre-assignments.",
        "error",
      );
    }
    setIsPreassignmentLoading(false);
  }

  async function fetchSelectedTeacherAQ(pscs_id: string) {
    setIsTeacherAQLoading(true);
    setTeacherAQ([]);
    const AQRes = await fetchTeacherAQRecords(
      null,
      pscs_id,
      "Approved",
      "created_at",
      "DESC",
    );
    if (AQRes.success && AQRes.data) {
      setTeacherAQ(AQRes.data);
    } else {
      triggerToast(AQRes.error || "Failed to load teacher AQ(s).", "error");
    }
    setIsTeacherAQLoading(false);
  }

  async function fetchTeacherFcce(pscs_id: string) {
    setTeacherFcce([]);
    setSelectedAySem("");
    const FCCERes = await fetchFcce(pscs_id);
    if (FCCERes.success && FCCERes.data) {
      setTeacherFcce(FCCERes.data);
      const availableAySems = Array.from(
        new Set(FCCERes.data.map((f: FcceRecord) => f.ay_sem).filter(Boolean)),
      );
      if (availableAySems.length > 0) {
        setSelectedAySem(availableAySems[0] as string);
      }
    } else {
      triggerToast(FCCERes.error || "Failed to load teacher FCCE(s).", "error");
    }
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
      setOpenUnmetRequirementsWarningModal(false);
      setOpenNoAQAssignedWarningModal(false);
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

    const aqCompute = getAQMatchStatus();
    const hasNoAQsAssigned =
      subjectAQClusters.length === 0 ||
      subjectAQClusters.every((row) => {
        const aqs = aqCompute.parseList(row.aq_list);
        const clusterNames = aqCompute.parseList(row.cluster_names);
        return clusterNames.length === 0 && aqs.length === 0;
      });

    // If subject has no AQs assigned, trigger the No AQ Assigned warning modal
    if (hasNoAQsAssigned) {
      setOpenNoAQAssignedWarningModal(true);
      return;
    }

    // Check if regular AQ requirements are fully met or FCCE is unmet/failed
    const isFullyMatched = checkIsFullyMatched();
    const fcceStatus = getFCCEMatchStatus();
    const isFcceMet = fcceStatus.hasRecord && fcceStatus.passed;

    if (!isFullyMatched || !isFcceMet) {
      setOpenUnmetRequirementsWarningModal(true);
      return;
    }

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

    const newSubjectsCount = calculateProjectedPrepCount(
      selectedSubjectToAssign,
    );
    const subjectUnits = calculateSubjectLoad(selectedSubjectToAssign);
    const newTotalLoad = Number(selectedTeacher.total_load || 0) + subjectUnits;

    if (newTotalLoad > overloadMax) {
      return;
    }

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
      triggerToast("Pre-assignment removed successfully!", "success");
      setOpenDeleteModal(false);
      setSubjectToDelete(null);
      void loadData();
      void loadTeacherData(selectedTeacherID, selectedTeacherName);
    } else {
      triggerToast(res.error || "Failed to remove pre-assignment.", "error");
    }
    setIsSubmittingDelete(false);
  };

  // --- Delete Template Handler ---
  const executeDeleteTemplate = async () => {
    setIsDeletingTemplate(true);

    try {
      const res = await deletePreassignmentTemplate(preassignmentName);
      if (res.success) {
        triggerToast("Template deleted successfully!", "success");
        router.push("/teachers");
      }
      setOpenTemplateDeleteModal(false);
    } catch (err) {
      console.error("Error deleting template:", err);
      triggerToast("Failed to delete template.", "error");
    } finally {
      setIsDeletingTemplate(false);
    }
  };

  return (
    <div
      className={
        "flex w-full max-w-full scrollbar-thumb-gray-400 scrollbar-track-transparent overflow-x-hidden"
      }
    >
      {/* Main Div */}
      <div className="min-w-0 flex-1 space-y-4 p-4">
        {/* Page Header & Actions Bar */}
        <div className="flex items-start gap-4">
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
          <div className={"mt-2"}>
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
                className="text-red-600 dark:text-red-400"
                onClick={() => {
                  setOpenTemplateDeleteModal(true);
                }}
              >
                Remove Subject
              </DropdownItem>
            </Dropdown>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className={"sm:hidden"}>
            <DisplayWarning count={unassignedCount} dm={isDarkMode} />
          </div>

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

          <div className={"hidden sm:block"}>
            <DisplayWarning count={unassignedCount} dm={isDarkMode} />
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
                      onClick={() => {
                        void loadTeacherData(item.teacher_id, teacherFullName);
                        void fetchSelectedTeacherAQ(item.pscs_id);
                        void fetchTeacherFcce(item.pscs_id);
                      }}
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
                        className={`font-semibold ${
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
                        className={`font-semibold ${
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
        <div className={"flex items-center justify-between gap-2"}>
          <div className={"block pt-0.5 sm:hidden"}>
            <Tooltip placement={"bottom"} content={"Close"}>
              <Button
                color={"alternative"}
                onClick={() => setSelectedTeacherID("")}
                size="sm"
              >
                <HiChevronLeft className="h-4 w-4" color={"gray"} />
              </Button>
            </Tooltip>
          </div>
          <div className={"flex items-start gap-3"}>
            <div className={"cursor-help"}>
              <Tooltip
                content={
                  "Filters to only show subjects from selected curricula"
                }
                placement={"bottom"}
              >
                <div
                  className={
                    "text-base leading-tight font-extrabold text-gray-900 sm:text-xl dark:text-white"
                  }
                >
                  Curriculum{" "}
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    Constraints
                    <HiQuestionMarkCircle className="h-5 w-5 shrink-0 text-gray-500" />
                  </span>
                </div>
              </Tooltip>
            </div>
          </div>

          <Tooltip
            style={isDarkMode ? "dark" : "light"}
            placement={"bottom"}
            content={"Set Constraints for Selecting Subjects"}
          >
            <HiCog6Tooth
              className="h-7 w-7 shrink-0 cursor-pointer text-gray-500 hover:text-gray-700 sm:h-8 sm:w-8 dark:hover:text-gray-300"
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
              ? curriculumAdd.map((item) => {
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
              : "No Curriculum Constraints set"}
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

                    <div
                      className={
                        "mt-4 w-full border-t border-black p-2 text-gray-400 dark:border-white"
                      }
                    >
                      Displayed loads are calculated dynamically based on
                      current student enrollment records.
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
                        {teacherPreassignments.map((item, idx) => {
                          const assignedUnits = calculateSubjectLoad(item);
                          return (
                            <div
                              key={item.preassignment_id || idx}
                              className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700/50"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <span className="inline-flex shrink-0 items-center rounded-md bg-blue-100 px-2 py-1 text-xs font-bold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                    {parseFloat(assignedUnits.toFixed(2))} units
                                  </span>
                                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {item.subject_name || item.subject_id}
                                  </span>
                                </div>
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
                                {item.department || "N/A"} {item.year_term} |
                                Lec:{" "}
                                {parseFloat(
                                  Number(item.lecture_units || 0).toFixed(2),
                                )}{" "}
                                | Lab:{" "}
                                {parseFloat(
                                  Number(item.lab_units || 0).toFixed(2),
                                )}
                              </span>
                            </div>
                          );
                        })}
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
                {recommendedConstraints} total curricula
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

              <div className={"flex items-center gap-2"}>
                <h3 className={"py-3 dark:text-white"}>Added Curriculum</h3>
                <span className={"font-extrabold dark:text-white"}>
                  ({curriculumAdd.length})
                </span>
              </div>

              <div
                className={"min-h-24 rounded-xl border border-gray-500/50 p-2"}
              >
                <div className={"flex flex-wrap gap-2"}>
                  {curriculumAdd.length > 0 &&
                    curriculumAdd.map((item) => {
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

      {/* DELETE TEMPLATE MODAL */}
      <Modal
        show={openTemplateDeleteModal}
        onClose={() => setOpenTemplateDeleteModal(false)}
        size="md"
      >
        <ModalHeader className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-red-500">
            <HiExclamation className="h-6 w-6" />
            <span className="font-bold text-gray-900 dark:text-white">
              Confirm Template Deletion
            </span>
          </div>
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Are you sure you want to delete template{" "}
            <b>{preassignmentName || "this template"}</b>? This action cannot be
            undone and will redirect you to the teachers page.
          </p>
        </ModalBody>
        <ModalFooter className="flex justify-end gap-2">
          <Button
            color="red"
            onClick={executeDeleteTemplate}
            disabled={isDeletingTemplate}
          >
            {isDeletingTemplate ? <Spinner size="sm" className="mr-2" /> : null}
            Confirm Deletion
          </Button>
          <Button
            color="gray"
            onClick={() => setOpenTemplateDeleteModal(false)}
            disabled={isDeletingTemplate}
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* ADD MODAL */}
      <Modal show={openAddModal} onClose={closeAddModal}>
        <ModalHeader>Add Subject Pre-Assignment</ModalHeader>
        <ModalBody className={"scrollbar-thumb-gray-400 scrollbar-track-transparent"}>
          <div className="space-y-4">
            <div>
              <Label>Teacher</Label>
              <div className={"font-semibold text-gray-900 dark:text-white"}>
                {selectedTeacherName}
              </div>
            </div>

            {/* TEACHER PREFERENCES */}
            <div>
              <Label>Teaching Preferences (Subjects):</Label>
              <div className="flex w-full gap-2 overflow-x-auto pt-1">
                {(() => {
                  const teacherObj = teachers.find(
                    (t) => t.teacher_id === selectedTeacherID,
                  );
                  const prefsRaw = teacherObj?.preferences;

                  let prefSubjects: string[] = [];

                  if (prefsRaw) {
                    try {
                      let parsed =
                        typeof prefsRaw === "string"
                          ? JSON.parse(prefsRaw)
                          : prefsRaw;

                      if (typeof parsed === "string") {
                        parsed = JSON.parse(parsed);
                      }

                      if (parsed && typeof parsed === "object") {
                        const subjectsArr =
                          parsed.preferred_subjects ||
                          parsed.PreferredSubjects ||
                          parsed.preferredSubjects;

                        if (Array.isArray(subjectsArr)) {
                          prefSubjects = subjectsArr;
                        }
                      }
                    } catch (e) {
                      console.error("Error parsing teacher preferences:", e);
                      prefSubjects = [];
                    }
                  }

                  if (prefSubjects.length === 0) {
                    return (
                      <span className="text-xs text-gray-400 italic">
                        No preferred subjects set.
                      </span>
                    );
                  }

                  return prefSubjects.map((subj, sIdx) => (
                    <Badge key={sIdx} color="purple" size="sm">
                      {subj}
                    </Badge>
                  ));
                })()}
              </div>
            </div>

            <div>
              <Label>Academic Qualifications:</Label>
              <div className={`flex w-full gap-2 overflow-x-auto`}>
                {isTeacherAQLoading ? (
                  <span className={`dark:text-white`}>
                    Teacher AQ Loading...
                  </span>
                ) : (
                  TeacherAQ.map(
                    (taq) =>
                      taq.approved === "Approved" && (
                        <Badge key={taq.aq}>{taq.aq}</Badge>
                      ),
                  )
                )}
              </div>
            </div>

            {/* AY_SEM Filter Dropdown for FCCE evaluation */}
            <div>
              <Label htmlFor="ay-sem-select">Academic Year / Semester</Label>
              <Select
                id="ay-sem-select"
                value={selectedAySem}
                onChange={(e) => setSelectedAySem(e.target.value)}
              >
                <option value="">All Academic Years / Semesters</option>
                {Array.from(
                  new Set(teacherFcce.map((f) => f.ay_sem).filter(Boolean)),
                ).map((ay) => (
                  <option key={ay} value={ay as string}>
                    {ay}
                  </option>
                ))}
              </Select>
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
                        onClick={() => {
                          setSelectedSubjectToAssign(subj);
                          setSubjectSearchQuery("");
                        }}
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
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-300">
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
                  <Tooltip content={"Merges discussion and lab schedules to be held in the laboratory."}>
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
                  </Tooltip>
                </div>

                {/* Projected Load & Subject Indicators inside Add Modal */}
                {(() => {
                  const selectedTeacher = teachers.find(
                    (t) => t.teacher_id === selectedTeacherID,
                  );
                  if (!selectedTeacher) return null;
                  const { prepLimit, facultyLoadLimit, overloadMax } =
                    getLimitsForTeacher(selectedTeacher.employment_type);

                  const newSubjectsCount = calculateProjectedPrepCount(
                    selectedSubjectToAssign,
                  );
                  const subjectUnits = calculateSubjectLoad(
                    selectedSubjectToAssign,
                  );
                  const newTotalLoad =
                    Number(selectedTeacher.total_load || 0) + subjectUnits;

                  const isPrepExceeded = newSubjectsCount > prepLimit;
                  const isLoadExceeded = newTotalLoad > facultyLoadLimit;
                  const isHardLimitExceeded = newTotalLoad > overloadMax;

                  // Compute whether all AQs match the teacher's approved AQs
                  const aqCompute = getAQMatchStatus();
                  const fcceStatus = getFCCEMatchStatus();

                  const fcceCardColorClass = !fcceStatus.hasRecord
                    ? "border-red-300 bg-red-50/70 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
                    : fcceStatus.passed
                      ? "border-green-300 bg-green-50/70 text-green-900 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-200"
                      : "border-red-300 bg-red-50/70 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200";

                  return (
                    <div className="space-y-2">
                      <div className="my-2 flex w-full justify-center gap-6 rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                        {/* PROJECTED PREPARATION */}
                        <Tooltip
                          content={
                            <div>
                              Projected Prep: Estimated workload derived from maximum possible subject assignments post-generation.
                            </div>
                          }
                        >
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
                                {parseFloat(
                                  Number(newSubjectsCount).toFixed(2),
                                )}{" "}
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
                        </Tooltip>

                        {/* PROJECTED LOAD */}
                        <Tooltip
                          content={
                            <div>
                              Projected Load: Estimated teaching hours derived from maximum possible subject assignments post-generation.
                            </div>
                          }
                        >
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
                                {parseFloat(
                                  Number(facultyLoadLimit).toFixed(2),
                                )}
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
                        </Tooltip>
                      </div>

                      {/* FCCE Status Display Section */}
                      <div
                        className={`rounded-lg border p-3 shadow-sm transition-all ${fcceCardColorClass}`}
                      >
                        <div className="mb-1 text-xs font-semibold tracking-wide uppercase">
                          {!fcceStatus.hasRecord
                            ? "No FCCE Record Found"
                            : fcceStatus.passed
                              ? "FCCE Passed"
                              : "FCCE Not Passed"}
                        </div>
                        <span className="text-xs opacity-75">
                          {!fcceStatus.hasRecord
                            ? "The teacher has no FCCE entry matching this course name and academic year/semester."
                            : fcceStatus.passed
                              ? "The teacher has successfully passed the FCCE requirement for this course."
                              : "The teacher has an FCCE entry for this course, but did not pass."}
                        </span>
                      </div>

                      {/* AQ Match Display Section */}
                      {(() => {
                        const hasNoAQsAssigned =
                          subjectAQClusters.length === 0 ||
                          subjectAQClusters.every((row) => {
                            const clusterNames = aqCompute.parseList(
                              row.cluster_names,
                            );
                            const aqs = aqCompute.parseList(row.aq_list);
                            return (
                              clusterNames.length === 0 && aqs.length === 0
                            );
                          });

                        let isNoAQRequired = false;
                        if (!hasNoAQsAssigned) {
                          isNoAQRequired = subjectAQClusters.every((row) => {
                            const aqs = aqCompute.parseList(row.aq_list);
                            return (
                              aqs.length === 1 &&
                              aqs[0].toUpperCase() === "NULL"
                            );
                          });
                        }

                        const cardColorClass = hasNoAQsAssigned
                          ? "border-yellow-300 bg-yellow-50/70 text-yellow-900 dark:border-yellow-900/50 dark:bg-yellow-950/30 dark:text-yellow-200"
                          : isNoAQRequired || aqCompute.isFullyMatched
                            ? "border-green-300 bg-green-50/70 text-green-900 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-200"
                            : "border-red-300 bg-red-50/70 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200";

                        return (
                          <div
                            className={`rounded-lg border p-3 shadow-sm transition-all ${cardColorClass}`}
                          >
                            <div className="mb-2 text-xs font-semibold tracking-wide uppercase">
                              {hasNoAQsAssigned
                                ? "No AQs Assigned to Subject"
                                : isNoAQRequired
                                  ? "No AQ Required for Subject"
                                  : aqCompute.isFullyMatched
                                    ? "Qualified to Teach"
                                    : "Missing Required AQ(s)"}
                            </div>
                            {isAQLoading ? (
                              <div className="flex items-center gap-2 text-xs opacity-75">
                                <Spinner size="sm" />
                                <span>Loading AQ clusters...</span>
                              </div>
                            ) : hasNoAQsAssigned ? (
                              <span className="text-xs italic opacity-75">
                                This subject has no AQs assigned to it.
                              </span>
                            ) : subjectAQClusters.length > 0 ? (
                              <div className="flex flex-col gap-2">
                                {subjectAQClusters.map((row, idx) => {
                                  const aqs = aqCompute.parseList(row.aq_list);
                                  const isNullRow =
                                    aqs.length === 1 &&
                                    aqs[0].toUpperCase() === "NULL";

                                  return (
                                    <div
                                      key={idx}
                                      className="flex flex-col gap-1 text-xs"
                                    >
                                      <div className="font-semibold">
                                        {row.course_name} ({row.program_code})
                                      </div>
                                      {isNullRow ? (
                                        <span className="font-medium text-green-700 dark:text-green-300">
                                          No AQ Required
                                        </span>
                                      ) : aqs.length > 0 ? (
                                        <div className="flex flex-wrap items-center gap-1">
                                          <span className="opacity-75">
                                            AQ List:
                                          </span>
                                          {aqs.map(
                                            (aq: string, aqIdx: number) => {
                                              const isMatched =
                                                aqCompute.teacherAQList.includes(
                                                  aq.trim().toLowerCase(),
                                                );
                                              return (
                                                <Badge
                                                  key={aqIdx}
                                                  color={
                                                    isMatched ? "green" : "red"
                                                  }
                                                  size="sm"
                                                >
                                                  {aq}
                                                </Badge>
                                              );
                                            },
                                          )}
                                        </div>
                                      ) : (
                                        <span className="opacity-75">
                                          AQ List: No AQ.
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-xs italic opacity-75">
                                No AQ clusters found for this subject.
                              </span>
                            )}
                          </div>
                        );
                      })()}

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
              ? calculateSubjectLoad(selectedSubjectToAssign)
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

              const newSubjectsCount = calculateProjectedPrepCount(
                selectedSubjectToAssign,
              );
              const subjectUnits = selectedSubjectToAssign
                ? calculateSubjectLoad(selectedSubjectToAssign)
                : 0;
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

      {/* UNMET REQUIREMENTS (AQ & FCCE) WARNING CONFIRMATION MODAL */}
      <Modal
        show={openUnmetRequirementsWarningModal}
        onClose={() => setOpenUnmetRequirementsWarningModal(false)}
        size="md"
      >
        <ModalHeader className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-yellow-500">
            <HiExclamation className="h-6 w-6" />
            <span className="font-bold text-gray-900 dark:text-white">
              Unmet Requirements Warning
            </span>
          </div>
        </ModalHeader>
        <ModalBody>
          {(() => {
            const isFullyMatched = checkIsFullyMatched();
            const fcceStatus = getFCCEMatchStatus();
            const isFcceMet = fcceStatus.hasRecord && fcceStatus.passed;

            let missingMessage = "";
            if (!isFullyMatched && !isFcceMet) {
              missingMessage =
                "both the required Academic Qualifications (AQ) and the Faculty Course Competency Evaluation (FCCE) requirements";
            } else if (!isFullyMatched) {
              missingMessage = "the required Academic Qualifications (AQ)";
            } else if (!isFcceMet) {
              missingMessage =
                "the required Faculty Course Competency Evaluation (FCCE) requirement";
            }

            return (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                <b>{selectedTeacherName}</b> does not meet {missingMessage} for
                this subject. Do you still want to proceed with this assignment?
              </p>
            );
          })()}
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
            color="alternative"
            onClick={() => setOpenUnmetRequirementsWarningModal(false)}
            disabled={isSubmittingAddPreAssignment}
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* NO AQ ASSIGNED WARNING CONFIRMATION MODAL */}
      <Modal
        show={openNoAQAssignedWarningModal}
        onClose={() => setOpenNoAQAssignedWarningModal(false)}
        size="md"
      >
        <ModalHeader className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-yellow-500">
            <HiExclamation className="h-6 w-6" />
            <span className="font-bold text-gray-900 dark:text-white">
              No AQs Assigned Warning
            </span>
          </div>
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            This subject has <b>no Academic Qualifications (AQs) assigned</b> to
            it in the system. Are you sure you want to assign{" "}
            <b>{selectedSubjectToAssign?.course_name}</b> to{" "}
            <b>{selectedTeacherName}</b>?
          </p>
        </ModalBody>
        <ModalFooter className="flex justify-end gap-2">
          <Button
            color="red"
            onClick={() => {
              setOpenNoAQAssignedWarningModal(false);
              void executeAddPreAssignment();
            }}
            disabled={isSubmittingAddPreAssignment}
          >
            {isSubmittingAddPreAssignment ? (
              <Spinner size="sm" className="mr-2" />
            ) : null}
            Proceed Anyway
          </Button>
          <Button
            color="alternative"
            onClick={() => setOpenNoAQAssignedWarningModal(false)}
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

function DisplayWarning({ count, dm }: DisplayWarningProps) {
  return (
    <>
      {count > 0 && (
        <Tooltip
          placement={"bottom"}
          className={"hidden sm:block"}
          style={dm ? "dark" : "light"}
          content={`${count} teacher(s) without assigned subjects`}
        >
          <Button outline color={"alternative"} className={"gap-2 border-0"}>
            <HiExclamation className={"h-8 w-8 text-yellow-400"} />
            <span className={"sm:hidden"}>
              {count} teacher(s) without assigned subjects
            </span>
          </Button>
        </Tooltip>
      )}
    </>
  );
}