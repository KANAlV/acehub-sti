"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useTransition,
  useRef,
  useMemo,
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
  Label,
  HelperText,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Pagination,
  Spinner,
  Card,
  Toast,
  ToastToggle,
  Progress,
  ToggleSwitch,
  FileInput,
} from "flowbite-react";
import {
  HiSearch,
  HiX,
  HiCheck,
  HiExclamation,
  HiOutlineTrash,
} from "react-icons/hi";
import {
  FaPlus,
  FaSortUp,
  FaSortDown,
  FaFileExcel,
  FaFileImport,
  FaFileExport,
  FaDownload,
} from "react-icons/fa";
import { useMsal } from "@azure/msal-react";
import ExcelJS from "exceljs";

import {
  fetchSubjects,
  fetchSubjectsCount,
  createSubject,
  updateSubject,
  deleteSubject,
  fetchPrograms,
  fetchCurricula,
  fetchRoomTypeList,
  fetchSubjectsDistinct,
  fetchSubjectsAQClusters,
  CurriculumRecord,
  SubjectRecord,
  SubjectInput,
  SubjectAQClusterRecord,
} from "@/app/actions/system";

import { filterCurricula } from "@/utils/validation";

export interface ProgramRecord {
  program_code: string;
  program_name: string;
  year_level: string;
}

export interface RoomType {
  room_type_id: string;
  value: string;
}

interface DataValidationRule {
  type: string;
  operator?: string;
  allowBlank: boolean;
  formulae: (string | number)[];
  showErrorMessage?: boolean;
  errorTitle?: string;
  error?: string;
}

interface WorksheetWithValidation extends ExcelJS.Worksheet {
  dataValidations: {
    add: (range: string, validation: DataValidationRule) => void;
  };
}

const REQUIRED_HEADERS = [
  "Curriculum",
  "Year Level",
  "Program",
  "Course Code",
  "Course Name",
  "Lecture",
  "Laboratory",
  "Laboratory Type",
];

export default function SubjectsManagement() {
  const { instance, accounts } = useMsal();
  const activeAccount = useMemo(
      () => instance.getActiveAccount() || accounts[0],
      [instance, accounts]
  );
  const actor = activeAccount?.username || "system";

  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [subjectsCount, setSubjectsCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();

  const [curriculaList, setCurriculaList] = useState<CurriculumRecord[]>([]);
  const [isLoadingCurricula, setIsLoadingCurricula] = useState<boolean>(false);
  const [programsList, setProgramsList] = useState<ProgramRecord[]>([]);
  const [isLoadingPrograms, setIsLoadingPrograms] = useState<boolean>(false);
  const [roomTypeList, setRoomTypeList] = useState<RoomType[]>([]);
  const [isLoadingRoomTypes, setIsLoadingRoomTypes] = useState<boolean>(false);

  // Hoisted roomTypeMap to prevent TS2448 block-scoped variable usage error
  const roomTypeMap = useMemo(() => {
    const map = new Map<string, string>();
    roomTypeList.forEach((rt) => map.set(rt.room_type_id, rt.value));
    return map;
  }, [roomTypeList]);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  const [selectedProgramFilter, setSelectedProgramFilter] =
      useState<string>("ALL");
  const [allProgramsFilterList, setAllProgramsFilterList] = useState<
      ProgramRecord[]
  >([]);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [maxRow] = useState<number>(10);
  const [sortBy, setSortBy] = useState<string>("curriculum");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("ASC");

  // Modal States
  const [openAddModal, setOpenAddModal] = useState<boolean>(false);
  const [openEditModal, setOpenEditModal] = useState<boolean>(false);
  const [openDeleteModal, setOpenDeleteModal] = useState<boolean>(false);
  const [openAddConfirmation, setOpenAddConfirmation] = useState(false);
  const [openExcelModal, setOpenExcelModal] = useState<boolean>(false);

  // Excel Operations State
  const [activeExcelTab, setActiveExcelTab] = useState<"import" | "export" | "template">("import");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [formatError, setFormatError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAddingExisting, setIsAddingExisting] = useState<boolean>(false);
  const [existingSubjectSearch, setExistingSubjectSearch] = useState<string>("");
  const [existingSubjectSearchResults, setExistingSubjectSearchResults] = useState<SubjectRecord[]>([]);
  const [isSearchingExisting, setIsSearchingExisting] = useState<boolean>(false);
  const [selectedExistingSubject, setSelectedExistingSubject] = useState<SubjectRecord | null>(null);
  const [subjectAQClusters, setSubjectAQClusters] = useState<SubjectAQClusterRecord[]>([]);
  const [isAQLoading, setIsAQLoading] = useState<boolean>(false);

  const [selectedSubject, setSelectedSubject] = useState<SubjectRecord | null>(
      null,
  );

  const initialFormState: SubjectInput = useMemo(() => ({
    curriculum: "",
    program_code: "",
    course_code: "",
    course_name: "",
    lecture_units: 3,
    lab_units: 0,
    lab_type: null,
    year_term: null,
  }), []);

  const [formData, setFormData] = useState<SubjectInput>(initialFormState);
  const [selectedYear, setSelectedYear] = useState<string>("");

  const [isNewCurriculum, setIsNewCurriculum] = useState<boolean>(false);
  const [curriculumError, setCurriculumError] = useState<string>("");
  const [programError, setProgramError] = useState<string>("");
  const [courseCodeError, setCourseCodeError] = useState<string>("");
  const [courseNameError, setCourseNameError] = useState<string>("");
  const [lecUnitsError, setLecUnitsError] = useState<string>("");
  const [labUnitsError, setLabUnitsError] = useState<string>("");
  const [yearLevelError, setYearLevelError] = useState<string>("");

  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [toastType, setToastType] = useState<"success" | "warning" | "error">(
      "success",
  );
  const [progress, setProgress] = useState<number>(0);
  const [showToastTimer, setShowToastTimer] = useState<boolean>(false);

  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearToastTimer = useCallback(() => {
    if (toastTimerRef.current) {
      clearInterval(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const closeToast = useCallback(() => {
    clearToastTimer();
    setShowToast(false);
    setShowToastTimer(false);
  }, [clearToastTimer]);

  const triggerToast = useCallback((
      msg: string,
      type: "success" | "warning" | "error" = "success",
  ) => {
    clearToastTimer();

    setToastMessage(msg);
    setToastType(type);
    setShowToast(true);
    setShowToastTimer(true);
    setProgress(0);

    const duration = 5000;
    const intervalTime = 50;
    const step = 100 / (duration / intervalTime);

    toastTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev + step >= 100) {
          clearToastTimer();
          setShowToast(false);
          setShowToastTimer(false);
          return 100;
        }
        return prev + step;
      });
    }, intervalTime);
  }, [clearToastTimer]);

  useEffect(() => {
    return () => {
      clearToastTimer();
    };
  }, [clearToastTimer]);

  const downloadWorkbook = (buffer: ArrayBuffer, filename: string) => {
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoadingCurricula(true);
      setIsLoadingRoomTypes(true);

      try {
        const [curriculaRes, roomTypesRes, shsProgRes, tertiaryProgRes] =
            await Promise.all([
              fetchCurricula(null, "curriculum_version", "DESC", 100, 1),
              fetchRoomTypeList(null, "ASC", 100, 1),
              fetchPrograms(null, "shs", "program_code", "ASC", 0, 1),
              fetchPrograms(null, "tertiary", "program_code", "ASC", 0, 1),
            ]);

        if (curriculaRes?.success && Array.isArray(curriculaRes.data)) {
          setCurriculaList(curriculaRes.data);
        } else if (Array.isArray(curriculaRes)) {
          setCurriculaList(curriculaRes);
        } else {
          setCurriculaList([]);
        }

        if (roomTypesRes?.success && Array.isArray(roomTypesRes.data)) {
          setRoomTypeList(roomTypesRes.data as RoomType[]);
        } else if (Array.isArray(roomTypesRes)) {
          setRoomTypeList(roomTypesRes as RoomType[]);
        } else {
          setRoomTypeList([]);
        }

        const combinedPrograms: ProgramRecord[] = [
          ...(shsProgRes?.success && Array.isArray(shsProgRes.data)
              ? shsProgRes.data
              : []),
          ...(tertiaryProgRes?.success && Array.isArray(tertiaryProgRes.data)
              ? tertiaryProgRes.data
              : []),
        ];
        setAllProgramsFilterList(combinedPrograms);
      } catch (err) {
        console.error("Failed to load initial dropdown data:", err);
        setCurriculaList([]);
        setRoomTypeList([]);
      } finally {
        setIsLoadingCurricula(false);
        setIsLoadingRoomTypes(false);
      }
    };

    loadInitialData();
  }, []);

  const getEducationLevel = useCallback((year: string): "shs" | "tertiary" | "none" => {
    if (year === "11" || year === "12" || year === "Grade 11" || year === "Grade 12") return "shs";
    if (["1st Year", "2nd Year", "3rd Year", "4th Year"].includes(year))
      return "tertiary";
    return "none";
  }, []);

  const currentEduLevel = useMemo(() => getEducationLevel(selectedYear), [selectedYear, getEducationLevel]);

  useEffect(() => {
    if (currentEduLevel === "none") {
      setProgramsList([]);
      return;
    }

    const loadPrograms = async () => {
      setIsLoadingPrograms(true);
      const levelFilter = currentEduLevel === "shs" ? "shs" : "tertiary";
      const res = await fetchPrograms(
          null,
          levelFilter,
          "program_code",
          "ASC",
          0,
          1,
      );

      if (res.success && res.data) {
        setProgramsList(res.data);
      } else {
        setProgramsList([]);
      }
      setIsLoadingPrograms(false);
    };

    loadPrograms();
  }, [currentEduLevel]);

  useEffect(() => {
    if (!selectedYear) {
      setFormData((prev) => ({ ...prev, year_term: null }));
      return;
    }

    const isSHS = selectedYear === "11" || selectedYear === "12" || selectedYear === "Grade 11" || selectedYear === "Grade 12";
    let combined = "";

    if (isSHS) {
      const num = selectedYear === "Grade 11" ? "11" : selectedYear === "Grade 12" ? "12" : selectedYear;
      combined = `SHS ${num}`;
    } else {
      combined = selectedYear;
    }

    setFormData((prev) => ({ ...prev, year_term: combined }));
  }, [selectedYear]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (!isAddingExisting || !existingSubjectSearch || existingSubjectSearch.trim().length < 2) {
        setExistingSubjectSearchResults([]);
        return;
      }

      setIsSearchingExisting(true);
      try {
        const res = await fetchSubjectsDistinct(existingSubjectSearch, null, null);
        if (res.success && res.data) {
          setExistingSubjectSearchResults(res.data);
        } else {
          setExistingSubjectSearchResults([]);
        }
      } catch (err) {
        console.error("Failed to search existing subjects:", err);
        setExistingSubjectSearchResults([]);
      } finally {
        setIsSearchingExisting(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [existingSubjectSearch, isAddingExisting]);

  const handleSelectExistingSubject = useCallback(async (subj: SubjectRecord) => {
    setSelectedExistingSubject(subj);
    setExistingSubjectSearch("");
    setExistingSubjectSearchResults([]);

    const existingYearTerm = subj.year_term || "";
    let cleanYear = existingYearTerm.startsWith("SHS ") ? existingYearTerm.replace("SHS ", "") : existingYearTerm;
    if (cleanYear === "Grade 11") cleanYear = "11";
    if (cleanYear === "Grade 12") cleanYear = "12";
    setSelectedYear(cleanYear);

    const labUnits = subj.lab_units ?? 0;
    setFormData((prev) => ({
      ...prev,
      program_code: subj.program_code ?? "",
      course_code: subj.course_code || "",
      course_name: subj.course_name || "",
      lecture_units: subj.lecture_units ?? 3,
      lab_units: labUnits,
      lab_type: labUnits > 0 ? (subj.lab_type ?? null) : null,
      year_term: subj.year_term ?? null,
    }));

    setIsAQLoading(true);
    try {
      const res = await fetchSubjectsAQClusters(subj.course_name, subj.program_code);
      if (res.success && res.data) {
        setSubjectAQClusters(res.data);
      } else {
        setSubjectAQClusters([]);
      }
    } catch (err) {
      console.error("Failed to fetch subject AQ clusters:", err);
      setSubjectAQClusters([]);
    } finally {
      setIsAQLoading(false);
    }
  }, []);

  const loadData = useCallback(() => {
    setIsLoading(true);
    setSubjects([]);

    startTransition(async () => {
      const programCodeParam =
          selectedProgramFilter === "ALL" ? null : selectedProgramFilter;
      const curriculumFetchFilter = "ALL";

      const [resData, resCount] = await Promise.all([
        fetchSubjects(
            debouncedSearch,
            programCodeParam,
            curriculumFetchFilter,
            sortBy,
            sortDir,
            maxRow,
            currentPage,
        ),
        fetchSubjectsCount(debouncedSearch, programCodeParam),
      ]);

      if (resData.success && resData.data) {
        setSubjects(resData.data);
      }
      if (resCount.success) {
        setSubjectsCount(resCount.count);
      }
      setIsLoading(false);
    });
  }, [
    debouncedSearch,
    selectedProgramFilter,
    sortBy,
    sortDir,
    maxRow,
    currentPage,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSorting = useCallback((column: string) => {
    setSortBy((prevSort) => {
      if (prevSort === column) {
        setSortDir((prevDir) => (prevDir === "ASC" ? "DESC" : "ASC"));
      }
      return column;
    });
  }, []);

  const handleCustomCurriculumChange = useCallback((
      e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const rawVal = e.target.value;
    const filtered = filterCurricula(rawVal);
    const truncated = filtered.slice(0, 12);

    setFormData((prev) => ({
      ...prev,
      curriculum: truncated,
    }));

    if (!truncated.trim()) {
      setCurriculumError("Curriculum version is required.");
    } else {
      setCurriculumError("");
    }
  }, []);

  const handleInputChange = useCallback((
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { id, value, type } = e.target;

    if (id === "curriculum") {
      setCurriculumError(
          value.trim() === "" ? "Curriculum version is required." : "",
      );
      setFormData((prev) => ({ ...prev, curriculum: value }));
      return;
    }

    if (id === "program_code") {
      setProgramError(value.trim() === "" ? "Program is required." : "");
      setFormData((prev) => ({ ...prev, program_code: value }));
      return;
    }

    if (id === "course_code") {
      setCourseCodeError(value.trim() === "" ? "Course code is required." : "");
      setFormData((prev) => ({ ...prev, course_code: value }));
      return;
    }

    if (id === "course_name") {
      setCourseNameError(value.trim() === "" ? "Course name is required." : "");
      setFormData((prev) => ({ ...prev, course_name: value }));
      return;
    }

    if (id === "lab_type") {
      setFormData((prev) => ({ ...prev, lab_type: value || null }));
      return;
    }

    if (type === "number") {
      let numVal = parseFloat(value) || 0;

      if (numVal < 0) numVal = 0;
      if (numVal > 8) numVal = 8;

      if (id === "lecture_units") setLecUnitsError("");
      if (id === "lab_units") {
        setLabUnitsError("");
        if (numVal === 0) {
          setFormData((prev) => ({ ...prev, lab_type: null, lab_units: 0 }));
          return;
        }
      }

      setFormData((prev) => ({
        ...prev,
        [id]: numVal,
        ...(id === "lab_units" && numVal === 0 ? { lab_type: null } : {}),
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [id]: value || null,
    }));
  }, []);

  const handleCloseModals = useCallback(() => {
    setOpenAddModal(false);
    setOpenAddConfirmation(false);
    setOpenEditModal(false);
    setOpenDeleteModal(false);
    setOpenExcelModal(false);
    setSelectedSubject(null);
    setFormData(initialFormState);
    setSelectedYear("");
    setIsNewCurriculum(false);
    setIsAddingExisting(false);
    setExistingSubjectSearch("");
    setExistingSubjectSearchResults([]);
    setSelectedExistingSubject(null);
    setSubjectAQClusters([]);
    setCurriculumError("");
    setProgramError("");
    setCourseCodeError("");
    setCourseNameError("");
    setLecUnitsError("");
    setLabUnitsError("");
    setYearLevelError("");
    setImportFile(null);
    setImportLogs([]);
    setFormatError("");
    setIsImporting(false);
  }, [initialFormState]);

  const handleOpenEdit = useCallback((subject: SubjectRecord) => {
    setSelectedSubject(subject);

    const existingYearTerm = subject.year_term || "";
    let cleanYear = existingYearTerm.startsWith("SHS ") ? existingYearTerm.replace("SHS ", "") : existingYearTerm;
    if (cleanYear === "Grade 11") cleanYear = "11";
    if (cleanYear === "Grade 12") cleanYear = "12";
    setSelectedYear(cleanYear);

    const currVal = subject.curriculum ?? "";
    const existsInList = curriculaList.some(
        (c) => c.curriculum_id === currVal || c.curriculum_version === currVal,
    );
    setIsNewCurriculum(currVal ? !existsInList : false);

    const labUnits = Math.min(Math.max(subject.lab_units ?? 0, 0), 8);
    setFormData({
      curriculum: currVal,
      program_code: subject.program_code ?? "",
      course_code: subject.course_code || "",
      course_name: subject.course_name || "",
      lecture_units: Math.min(Math.max(subject.lecture_units ?? 0, 0), 8),
      lab_units: labUnits,
      lab_type: labUnits > 0 ? (subject.lab_type ?? null) : null,
      year_term: subject.year_term ?? null,
    });
    setOpenEditModal(true);
  }, [curriculaList]);

  const handleCreateSubject = useCallback(async () => {
    if (
        !formData.curriculum?.trim() ||
        !formData.program_code?.trim() ||
        !formData.course_code?.trim() ||
        !formData.course_name?.trim() ||
        !selectedYear.trim()
    ) {
      return;
    }

    const payload = {
      ...formData,
      lab_type: (formData.lab_units ?? 0) === 0 ? null : formData.lab_type,
    };

    const res = await createSubject(actor, payload);
    if (res.success) {
      triggerToast("Subject created successfully!", "success");
      handleCloseModals();
      loadData();
    } else {
      triggerToast(res.error || "Failed to create subject.", "error");
    }
  }, [formData, selectedYear, actor, triggerToast, handleCloseModals, loadData]);

  const handleUpdateSubject = useCallback(async () => {
    if (!selectedSubject) return;

    if (
        !formData.curriculum?.trim() ||
        !formData.program_code?.trim() ||
        !formData.course_code?.trim() ||
        !formData.course_name?.trim() ||
        !selectedYear.trim()
    ) {
      return;
    }

    const payload = {
      ...formData,
      lab_type: (formData.lab_units ?? 0) === 0 ? null : formData.lab_type,
    };

    const res = await updateSubject(
        actor,
        selectedSubject.subject_id,
        payload,
    );
    if (res.success) {
      triggerToast("Subject updated successfully!", "success");
      handleCloseModals();
      loadData();
    } else {
      triggerToast(res.error || "Failed to update subject.", "error");
    }
  }, [selectedSubject, formData, selectedYear, actor, triggerToast, handleCloseModals, loadData]);

  const handleDeleteSubject = useCallback(async () => {
    if (!selectedSubject) return;
    const res = await deleteSubject(actor, selectedSubject.subject_id);
    if (res.success) {
      triggerToast("Subject deleted successfully!", "success");
      handleCloseModals();
      loadData();
    } else {
      triggerToast(res.error || "Failed to delete subject.", "error");
    }
  }, [selectedSubject, actor, triggerToast, handleCloseModals, loadData]);

  // --- EXCEL OPERATIONS WITH DYNAMIC VALIDATION & LAB UNITS CONSTRAINT --- //
  const handleDownloadTemplate = useCallback(async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Template") as unknown as WorksheetWithValidation;

    worksheet.columns = [
      { header: "Curriculum", key: "curriculum", width: 18 },
      { header: "Year Level", key: "year_level", width: 15 },
      { header: "Program", key: "program", width: 15 },
      { header: "Course Code", key: "course_code", width: 15 },
      { header: "Course Name", key: "course_name", width: 30 },
      { header: "Lecture", key: "lecture", width: 12 },
      { header: "Laboratory", key: "laboratory", width: 12 },
      { header: "Laboratory Type", key: "laboratory_type", width: 25 },
    ];

    worksheet.addRow({
      curriculum: "BSIT-22-01",
      year_level: "1st Year",
      program: "BSIT",
      course_code: "CC101",
      course_name: "Introduction to Computing",
      lecture: 3,
      laboratory: 0,
      laboratory_type: "",
    });

    worksheet.addRow({
      curriculum: "BSIT-22-01",
      year_level: "1st Year",
      program: "BSIT",
      course_code: "CC102L",
      course_name: "Computer Programming Lab",
      lecture: 2,
      laboratory: 1,
      laboratory_type: roomTypeList[0]?.value || "Computer Laboratory",
    });

    // Dynamic Lab Type Dropdown from database room types
    const typeValues = roomTypeList.map((rt) => rt.value.replace(/"/g, '""')).join(",");
    if (typeValues) {
      worksheet.dataValidations.add("H2:H1000", {
        type: "list",
        allowBlank: true,
        formulae: [`"${typeValues}"`],
        showErrorMessage: true,
        errorTitle: "Invalid Laboratory Type",
        error: "Please select a valid laboratory type from the dropdown list.",
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    downloadWorkbook(buffer, "Subjects_Import_Template.xlsx");
    triggerToast("Blank Excel template downloaded successfully with dynamic room type validation!", "success");
  }, [roomTypeList, triggerToast]);

  const handleExportExcel = useCallback(async () => {
    try {
      const programCodeParam = selectedProgramFilter === "ALL" ? null : selectedProgramFilter;
      const response = await fetchSubjects(debouncedSearch, programCodeParam, "ALL", sortBy, sortDir, 10000, 1);
      const exportList = response?.success && response.data ? response.data : subjects;

      if (exportList.length === 0) {
        triggerToast("No subject records available to export.", "warning");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Subjects") as unknown as WorksheetWithValidation;

      worksheet.columns = [
        { header: "Curriculum", key: "curriculum", width: 18 },
        { header: "Year Level", key: "year_level", width: 15 },
        { header: "Program", key: "program", width: 15 },
        { header: "Course Code", key: "course_code", width: 15 },
        { header: "Course Name", key: "course_name", width: 30 },
        { header: "Lecture", key: "lecture", width: 12 },
        { header: "Laboratory", key: "laboratory", width: 12 },
        { header: "Laboratory Type", key: "laboratory_type", width: 25 },
      ];

      exportList.forEach((item) => {
        const labTypeName = (item.lab_type ? roomTypeList.find(r => r.room_type_id === item.lab_type)?.value : null) || item.lab_type_name || item.lab_type || "";
        worksheet.addRow({
          curriculum: item.curriculum || "",
          year_level: item.year_term ? item.year_term.split(" - ")[0] : "",
          program: item.program_code || "",
          course_code: item.course_code || "",
          course_name: item.course_name || "",
          lecture: item.lecture_units ?? 0,
          laboratory: item.lab_units ?? 0,
          laboratory_type: (item.lab_units ?? 0) > 0 ? labTypeName : "",
        });
      });

      const typeValues = roomTypeList.map((rt) => rt.value.replace(/"/g, '""')).join(",");
      if (typeValues) {
        worksheet.dataValidations.add("H2:H1000", {
          type: "list",
          allowBlank: true,
          formulae: [`"${typeValues}"`],
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      downloadWorkbook(buffer, `Subjects_Export_${new Date().toISOString().split("T")[0]}.xlsx`);
      triggerToast("Subjects exported to Excel successfully", "success");
    } catch (err) {
      console.error(err);
      triggerToast("Failed to export subjects to Excel", "error");
    }
  }, [debouncedSearch, selectedProgramFilter, sortBy, sortDir, subjects, roomTypeList, triggerToast]);

  const validateAndSelectFile = useCallback((file: File | null) => {
    setFormatError("");
    setImportLogs([]);
    if (!file) return;

    const validExtensions = [".xlsx", ".xls", ".csv"];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!isValid) {
      setFormatError("Invalid file type. Strictly accepts Excel files (.xlsx, .xls) or .csv.");
      setImportFile(null);
      return;
    }
    setImportFile(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  }, [validateAndSelectFile]);

  const handleImportSubmit = useCallback(async () => {
    if (!importFile) return;

    setIsImporting(true);
    setFormatError("");
    setImportLogs(["Reading Excel workbook with ExcelJS..."]);

    try {
      const buffer = await importFile.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet || worksheet.rowCount === 0) {
        setFormatError("The uploaded Excel file contains no worksheets or data.");
        setIsImporting(false);
        return;
      }

      const headerRow = worksheet.getRow(1);
      const uploadedHeaders: string[] = [];
      headerRow.eachCell((cell) => {
        if (cell.value) uploadedHeaders.push(String(cell.value).trim());
      });

      const isHeaderValid = REQUIRED_HEADERS.every((reqHeader) =>
          uploadedHeaders.some((uh) => uh.toLowerCase() === reqHeader.toLowerCase())
      );

      if (!isHeaderValid) {
        setFormatError(
            `Strict Format Violation: Missing required headers. Your file must include: [${REQUIRED_HEADERS.join(", ")}]`
        );
        setIsImporting(false);
        return;
      }

      setImportLogs((prev) => [...prev, `Headers verified. Enforcing laboratory and curriculum constraints...`]);

      let successCount = 0;
      let failCount = 0;
      const logs: string[] = [];

      const headerIndexMap: Record<string, number> = {};
      headerRow.eachCell((cell, colNumber) => {
        if (cell.value) {
          headerIndexMap[String(cell.value).trim().toLowerCase()] = colNumber;
        }
      });

      const currCol = headerIndexMap["curriculum"] || 1;
      const yrCol = headerIndexMap["year level"] || 2;
      const progCol = headerIndexMap["program"] || 3;
      const codeCol = headerIndexMap["course code"] || 4;
      const nameCol = headerIndexMap["course name"] || 5;
      const lecCol = headerIndexMap["lecture"] || 6;
      const labCol = headerIndexMap["laboratory"] || 7;
      const labTypeCol = headerIndexMap["laboratory type"] || 8;

      const roomTypeNameToIdMap = new Map<string, string>();
      roomTypeList.forEach((rt) => {
        roomTypeNameToIdMap.set(rt.value.toLowerCase().trim(), rt.room_type_id);
        roomTypeNameToIdMap.set(rt.room_type_id.toLowerCase().trim(), rt.room_type_id);
      });

      const rowsToProcess: {
        rowNum: number;
        curr: string;
        yearTerm: string;
        prog: string;
        code: string;
        name: string;
        lec: number;
        lab: number;
        labTypeId: string | null;
      }[] = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rawCurr = String(row.getCell(currCol).value || "").trim();
        const rawYear = String(row.getCell(yrCol).value || "").trim();
        const rawProg = String(row.getCell(progCol).value || "").trim();
        const rawCode = String(row.getCell(codeCol).value || "").trim();
        const rawName = String(row.getCell(nameCol).value || "").trim();
        const rawLec = Number(row.getCell(lecCol).value || 3);
        const rawLab = Number(row.getCell(labCol).value || 0);
        const rawLabType = String(row.getCell(labTypeCol).value || "").trim();

        if (!rawCurr || !rawCode || !rawName) {
          logs.push(`Row ${rowNumber}: Skipped. Essential information (Curriculum, Course Code, or Course Name) is missing.`);
          failCount++;
          return;
        }

        let combinedYearTerm = rawYear;
        if (["11", "12"].includes(rawYear)) {
          combinedYearTerm = `SHS ${rawYear}`;
        }

        // STRICT BUSINESS LOGIC: If Laboratory units == 0, lab type cannot be configured / is nullified
        let matchedLabTypeId: string | null = null;
        const labUnitsNum = isNaN(rawLab) ? 0 : rawLab;

        if (labUnitsNum > 0) {
          if (!rawLabType) {
            logs.push(`Row ${rowNumber} (${rawCode}): Failed. Laboratory units are > 0 but Laboratory Type is missing.`);
            failCount++;
            return;
          }
          matchedLabTypeId = roomTypeNameToIdMap.get(rawLabType.toLowerCase()) || null;
          if (!matchedLabTypeId) {
            logs.push(`Row ${rowNumber} (${rawCode}): Failed. Laboratory type "${rawLabType}" not recognized.`);
            failCount++;
            return;
          }
        } else {
          matchedLabTypeId = null;
        }

        rowsToProcess.push({
          rowNum: rowNumber,
          curr: rawCurr,
          yearTerm: combinedYearTerm,
          prog: rawProg,
          code: rawCode,
          name: rawName,
          lec: isNaN(rawLec) ? 3 : rawLec,
          lab: labUnitsNum,
          labTypeId: matchedLabTypeId,
        });
      });

      for (const item of rowsToProcess) {
        const payload: SubjectInput = {
          curriculum: item.curr,
          program_code: item.prog,
          course_code: item.code,
          course_name: item.name,
          lecture_units: item.lec,
          lab_units: item.lab,
          lab_type: item.labTypeId,
          year_term: item.yearTerm,
        };

        const res = await createSubject(actor, payload);
        if (res?.success) {
          successCount++;
        } else {
          logs.push(`Row ${item.rowNum} (${item.code}): ${res?.error || "Creation failed."}`);
          failCount++;
        }
      }

      setImportLogs((prev) => [
        ...prev,
        `Import Completed: ${successCount} successful, ${failCount} failed.`,
        ...logs,
      ]);

      if (successCount > 0) {
        triggerToast(`Imported ${successCount} subjects successfully.`, "success");
        loadData();
      }
    } catch (err) {
      console.error(err);
      setFormatError("Error: Unable to parse Excel workbook format using ExcelJS.");
    } finally {
      setIsImporting(false);
    }
  }, [importFile, actor, roomTypeList, loadData, triggerToast]);

  const isFormInvalid = useMemo(() =>
          !formData.curriculum?.trim() ||
          !formData.program_code?.trim() ||
          !formData.course_code?.trim() ||
          !formData.course_name?.trim() ||
          !selectedYear.trim() ||
          Boolean(curriculumError) ||
          Boolean(programError) ||
          Boolean(courseCodeError) ||
          Boolean(courseNameError) ||
          Boolean(lecUnitsError) ||
          Boolean(labUnitsError) ||
          Boolean(yearLevelError),
      [formData, selectedYear, curriculumError, programError, courseCodeError, courseNameError, lecUnitsError, labUnitsError, yearLevelError]);

  return (
      <div>
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
                <ToastToggle onDismiss={closeToast} />
              </Toast>
              <Progress
                  progress={Math.min(Math.round(progress), 100)}
                  size="sm"
                  className={`${showToastTimer ? "" : "hidden"} ease-linear`}
              />
            </div>
        )}

        <div>
          <div className={"mb-4"}>
            <h2 className="mb-1 text-lg font-bold">Subjects Management</h2>
            <p className="text-gray-500">
              Manage course codes, names, credit units, lab types, and lab
              specifications.
            </p>
          </div>

          <div className="mb-4 flex-col justify-between gap-4 md:flex md:flex-row md:items-center">
            <div className="relative mr-4 mb-2 w-full md:w-64">
              <TextInput
                  id="search-subjects"
                  type="text"
                  placeholder="Search subjects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  icon={HiSearch}
              />
              {searchTerm && (
                  <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
                  >
                    <HiX className="h-4 w-4" />
                  </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="w-full sm:w-48">
                <Select
                    id="program-filter-select"
                    value={selectedProgramFilter}
                    onChange={(e) => {
                      setSelectedProgramFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                >
                  <option value="ALL">All Programs</option>
                  {allProgramsFilterList.map((prog) => (
                      <option
                          key={`filter-${prog.program_code}`}
                          value={prog.program_code}
                      >
                        {prog.program_code} - {prog.program_name}
                      </option>
                  ))}
                </Select>
              </div>

              <Button
                  color="gray"
                  className="whitespace-nowrap"
                  onClick={() => setOpenExcelModal(true)}
              >
                <FaFileExcel className="mr-2 text-green-600 h-4 w-4" />
                Excel Operations
              </Button>

              <Button
                  className="w-full whitespace-nowrap sm:w-auto"
                  onClick={() => {
                    setFormData(initialFormState);
                    setSelectedYear("");
                    setIsNewCurriculum(false);
                    setIsAddingExisting(false);
                    setExistingSubjectSearch("");
                    setExistingSubjectSearchResults([]);
                    setSelectedExistingSubject(null);
                    setSubjectAQClusters([]);
                    setCurriculumError("");
                    setProgramError("");
                    setYearLevelError("");
                    setOpenAddModal(true);
                  }}
              >
                <FaPlus className="mr-2" />
                Add Subject
              </Button>
            </div>
          </div>

          <Card className="overflow-x-auto">
            <Table hoverable>
              <TableHead>
                <TableRow>
                  <TableHeadCell onClick={() => handleSorting("curriculum")}>
                    <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                      Curriculum
                      {sortBy === "curriculum" &&
                          (sortDir === "ASC" ? (
                              <FaSortUp className="ml-1" />
                          ) : (
                              <FaSortDown className="ml-1" />
                          ))}
                    </div>
                  </TableHeadCell>

                  <TableHeadCell onClick={() => handleSorting("course_code")}>
                    <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                      Course Code
                      {sortBy === "course_code" &&
                          (sortDir === "ASC" ? (
                              <FaSortUp className="ml-1" />
                          ) : (
                              <FaSortDown className="ml-1" />
                          ))}
                    </div>
                  </TableHeadCell>

                  <TableHeadCell onClick={() => handleSorting("course_name")}>
                    <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                      Course Name
                      {sortBy === "course_name" &&
                          (sortDir === "ASC" ? (
                              <FaSortUp className="ml-1" />
                          ) : (
                              <FaSortDown className="ml-1" />
                          ))}
                    </div>
                  </TableHeadCell>

                  <TableHeadCell>Program / Strand</TableHeadCell>
                  <TableHeadCell>Year Level</TableHeadCell>
                  <TableHeadCell>Lec Units</TableHeadCell>
                  <TableHeadCell>Lab Units</TableHeadCell>
                  <TableHeadCell>Lab Type</TableHeadCell>

                  <TableHeadCell>
                    <span className="sr-only">Actions</span>
                  </TableHeadCell>
                </TableRow>
              </TableHead>

              <TableBody className="divide-y">
                {subjects.length > 0 ? (
                    subjects.map((item) => (
                        <TableRow
                            key={item.subject_id}
                            className="bg-white dark:border-gray-700 dark:bg-gray-800"
                        >
                          <TableCell className="font-medium whitespace-nowrap text-gray-900 dark:text-white">
                            {item.curriculum || "—"}
                          </TableCell>
                          <TableCell className="font-medium whitespace-nowrap text-gray-900 dark:text-white">
                            {item.course_code}
                          </TableCell>
                          <TableCell>{item.course_name}</TableCell>
                          <TableCell>{item.program_code || "—"}</TableCell>
                          <TableCell>{item.year_term ? item.year_term.split(" - ")[0] : "—"}</TableCell>
                          <TableCell>{item.lecture_units}</TableCell>
                          <TableCell>{item.lab_units}</TableCell>
                          <TableCell>
                            {(item.lab_units ?? 0) === 0 ? (
                                <span className="text-gray-400 italic">No Laboratory</span>
                            ) : (
                                (item.lab_type ? roomTypeMap.get(item.lab_type) : null) ||
                                item.lab_type_name ||
                                item.lab_type ||
                                "Configured Lab"
                            )}
                          </TableCell>
                          <TableCell>
                            <a
                                onClick={() => handleOpenEdit(item)}
                                className="text-primary-600 dark:text-primary-500 cursor-pointer font-medium hover:underline"
                            >
                              Edit
                            </a>
                          </TableCell>
                        </TableRow>
                    ))
                ) : isLoading ? (
                    <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                      <TableCell
                          colSpan={9}
                          className="py-6 text-center text-sm text-gray-500 italic dark:text-gray-400"
                      >
                        <div className="flex items-center justify-center">
                          <Spinner />
                          <span className="ml-4">Fetching subjects...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                ) : (
                    <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                      <TableCell
                          colSpan={9}
                          className="py-6 text-center text-sm text-gray-500 italic dark:text-gray-400"
                      >
                        {searchTerm || selectedProgramFilter !== "ALL"
                            ? `No matching subjects found.`
                            : "No subject entries found."}
                      </TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          <div
              className={`mt-4 ${
                  isLoading
                      ? "pointer-events-none opacity-50 [&_a]:cursor-not-allowed [&_button]:cursor-not-allowed"
                      : ""
              } flex w-full justify-center`}
          >
            <Pagination
                layout="pagination"
                currentPage={currentPage || 1}
                totalPages={Math.ceil(subjectsCount / maxRow) || 1}
                onPageChange={(p) => setCurrentPage(p)}
                showIcons
            />
          </div>
        </div>

        {/* --- MODAL: EXCEL OPERATIONS --- */}
        <Modal show={openExcelModal} onClose={handleCloseModals} size="lg">
          <ModalHeader>
            <div className="flex items-center gap-2">
              <FaFileExcel className="text-green-600 h-5 w-5" />
              <span>Excel Operations & Subject Data Management</span>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-3 gap-3">
                <button
                    type="button"
                    onClick={() => setActiveExcelTab("import")}
                    className={`flex flex-col items-center justify-center rounded-xl border p-3.5 text-center transition-all ${
                        activeExcelTab === "import"
                            ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                    }`}
                >
                  <FaFileImport className="mb-1.5 h-6 w-6 text-blue-600" />
                  <span className="text-xs font-semibold">Import Excel</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveExcelTab("export")}
                    className={`flex flex-col items-center justify-center rounded-xl border p-3.5 text-center transition-all ${
                        activeExcelTab === "export"
                            ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                    }`}
                >
                  <FaFileExport className="mb-1.5 h-6 w-6 text-green-600" />
                  <span className="text-xs font-semibold">Export Subjects</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveExcelTab("template")}
                    className={`flex flex-col items-center justify-center rounded-xl border p-3.5 text-center transition-all ${
                        activeExcelTab === "template"
                            ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                    }`}
                >
                  <FaDownload className="mb-1.5 h-6 w-6 text-emerald-600" />
                  <span className="text-xs font-semibold">Blank Template</span>
                </button>
              </div>

              {activeExcelTab === "import" && (
                  <div className="space-y-4">
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all ${
                            isDragging
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                                : "border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                        }`}
                    >
                      <FileInput
                          id="excel-file-input"
                          ref={fileInputRef}
                          accept=".xlsx, .xls, .csv"
                          onChange={(e) =>
                              validateAndSelectFile(e.target.files ? e.target.files[0] : null)
                          }
                          className="hidden"
                      />
                      <FaFileImport className="mx-auto mb-2 h-8 w-8 text-blue-500" />
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {importFile ? importFile.name : "Drag & drop your Excel file here or browse"}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {importFile
                            ? `${(importFile.size / 1024).toFixed(1)} KB`
                            : "Strictly accepts .xlsx, .xls, or .csv files"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
                      <span className="font-semibold uppercase tracking-wide">Validation Rule:</span> If <b className="font-mono">Laboratory</b> units = 0, <b className="font-mono">Laboratory Type</b> cannot be configured. Required Headers: {REQUIRED_HEADERS.join(", ")}
                    </div>

                    {formatError && (
                        <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                          <HiExclamation className="h-4 w-4 shrink-0 text-red-500" />
                          <div>{formatError}</div>
                        </div>
                    )}

                    {importLogs.length > 0 && (
                        <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-gray-900 p-3 font-mono text-xs dark:border-gray-700">
                          {importLogs.map((log, index) => (
                              <div
                                  key={index}
                                  className={
                                    log.includes("Error") || log.includes("Failed") || log.includes("Skipped")
                                        ? "text-red-400"
                                        : log.includes("Completed") || log.includes("Found")
                                            ? "font-bold text-green-400"
                                            : "text-gray-300"
                                  }
                              >
                                {log}
                              </div>
                          ))}
                        </div>
                    )}

                    <Button
                        onClick={handleImportSubmit}
                        disabled={!importFile || isImporting}
                        className="w-full"
                    >
                      {isImporting ? (
                          <>
                            <Spinner size="sm" className="mr-2" />
                            Processing & Importing...
                          </>
                      ) : (
                          "Execute Excel Import"
                      )}
                    </Button>
                  </div>
              )}

              {activeExcelTab === "export" && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-4 dark:border-gray-700 dark:bg-gray-800">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                        Export Filtered Subject Records
                      </h4>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Generates a standardized Excel spreadsheet containing all active query results with dropdown validations.
                      </p>
                    </div>
                    <Button onClick={handleExportExcel} className="w-full" color="green">
                      <FaFileExport className="mr-2 h-4 w-4" /> Export {subjectsCount} Subjects to Excel
                    </Button>
                  </div>
              )}

              {activeExcelTab === "template" && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-4 dark:border-gray-700 dark:bg-gray-800">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                        Download Blank Excel Template
                      </h4>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Includes formatted columns with dynamic room type dropdown validations.
                      </p>
                    </div>
                    <Button onClick={handleDownloadTemplate} className="w-full" color="blue">
                      <FaDownload className="mr-2 h-4 w-4" /> Download Blank Excel Template
                    </Button>
                  </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter className="flex justify-end">
            <Button color="alternative" onClick={handleCloseModals}>
              Close Window
            </Button>
          </ModalFooter>
        </Modal>

        {/* --- MODAL: ADD SUBJECT --- */}
        <Modal show={openAddModal} onClose={handleCloseModals} size="md">
          <ModalHeader>Add New Subject</ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <Label htmlFor="toggle-existing-subject" className="font-semibold cursor-pointer">
                  Add Existing Subject
                </Label>
                <ToggleSwitch
                    id="toggle-existing-subject"
                    checked={isAddingExisting}
                    onChange={(val) => {
                      setIsAddingExisting(val);
                      if (!val) {
                        setSelectedExistingSubject(null);
                        setSubjectAQClusters([]);
                        setExistingSubjectSearch("");
                        setExistingSubjectSearchResults([]);
                        setFormData(initialFormState);
                        setSelectedYear("");
                      }
                    }}
                />
              </div>

              {isAddingExisting && (
                  <div>
                    <Label htmlFor="search-existing-subject">Search Subject</Label>
                    <TextInput
                        id="search-existing-subject"
                        placeholder="Type course code or name..."
                        value={existingSubjectSearch}
                        onChange={(e) => setExistingSubjectSearch(e.target.value)}
                        icon={HiSearch}
                    />
                    {isSearchingExisting && (
                        <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                          <Spinner size="sm" />
                          <span>Searching subjects...</span>
                        </div>
                    )}
                    <div className="mt-1 max-h-48 overflow-y-auto">
                      {existingSubjectSearchResults.map((subj) => {
                        const isSelected = selectedExistingSubject?.subject_id === subj.subject_id;
                        return (
                            <div
                                key={`existing-${subj.subject_id}`}
                                onClick={() => handleSelectExistingSubject(subj)}
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
                                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${isSelected ? "bg-blue-700 text-blue-100" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>
                            {subj.curriculum || "Global"}
                          </span>
                              </div>
                              <div className={`mt-1.5 flex flex-wrap items-center gap-2 text-xs ${isSelected ? "text-blue-100" : "text-gray-500 dark:text-gray-400"}`}>
                                <span className="font-mono font-medium">{subj.course_code}</span>
                              </div>
                            </div>
                        );
                      })}
                    </div>
                  </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="course_code">Course Code *</Label>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                  {(formData.course_code || "").length}/10
                </span>
                </div>
                <TextInput
                    id="course_code"
                    placeholder="e.g. CS101"
                    value={formData.course_code || ""}
                    onChange={handleInputChange}
                    color={courseCodeError ? "failure" : "gray"}
                    maxLength={10}
                    disabled={isAddingExisting}
                />
                {courseCodeError && (
                    <HelperText color="failure">{courseCodeError}</HelperText>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="course_name">Course Name *</Label>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                  {(formData.course_name || "").length}/200
                </span>
                </div>
                <TextInput
                    id="course_name"
                    placeholder="e.g. Intro to Computing"
                    value={formData.course_name || ""}
                    onChange={handleInputChange}
                    color={courseNameError ? "failure" : "gray"}
                    maxLength={200}
                    disabled={isAddingExisting}
                />
                {courseNameError && (
                    <HelperText color="failure">{courseNameError}</HelperText>
                )}
              </div>

              <div>
                <Label htmlFor="year_level_select">Year Level *</Label>
                <Select
                    id="year_level_select"
                    value={selectedYear}
                    color={yearLevelError ? "failure" : "gray"}
                    onChange={(e) => {
                      const yr = e.target.value;
                      setSelectedYear(yr);
                      setYearLevelError(
                          yr.trim() === "" ? "Year Level is required." : "",
                      );
                      setFormData((prev) => ({ ...prev, program_code: "" }));
                    }}
                >
                  <option value="">Select Year...</option>
                  <option value="11">Grade 11</option>
                  <option value="12">Grade 12</option>
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </Select>
                {yearLevelError && (
                    <HelperText color="failure">{yearLevelError}</HelperText>
                )}
              </div>

              <div>
                <Label htmlFor="program_code">Program *</Label>
                <Select
                    id="program_code"
                    value={formData.program_code || ""}
                    onChange={handleInputChange}
                    disabled={!selectedYear || isLoadingPrograms}
                    color={programError ? "failure" : "gray"}
                >
                  <option value="">
                    {isLoadingPrograms
                        ? "Loading programs..."
                        : !selectedYear
                            ? "Select Year Level first..."
                            : "Select Program..."}
                  </option>
                  {programsList.map((prog) => (
                      <option key={prog.program_code} value={prog.program_code}>
                        {prog.program_code} - {prog.program_name}
                      </option>
                  ))}
                </Select>
                {programError && (
                    <HelperText color="failure">{programError}</HelperText>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label htmlFor="curriculum">Curriculum *</Label>
                  <button
                      type="button"
                      onClick={() => {
                        const nextState = !isNewCurriculum;
                        setIsNewCurriculum(nextState);
                        setFormData((prev) => ({ ...prev, curriculum: "" }));
                        setCurriculumError("");
                      }}
                      className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {isNewCurriculum
                        ? "Select existing Curriculum"
                        : "+ Enter new Curriculum"}
                  </button>
                </div>

                {isNewCurriculum ? (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 dark:text-gray-400" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                      {(formData.curriculum || "").length}/12
                    </span>
                      </div>
                      <TextInput
                          id="curriculum-text-input"
                          type="text"
                          placeholder="e.g. BSIT-22-01"
                          value={formData.curriculum || ""}
                          onChange={handleCustomCurriculumChange}
                          color={curriculumError ? "failure" : "gray"}
                          maxLength={12}
                      />
                      {curriculumError ? (
                          <HelperText className="mt-1 text-red-600 dark:text-red-500">
                            {curriculumError}
                          </HelperText>
                      ) : (
                          <HelperText className="mt-1 text-gray-500 dark:text-gray-400">
                            Format: <b className="font-mono">BSIT-22-01</b> (Allowed:{" "}
                            <b className="font-mono">A-Z, 0-9, -</b>)
                          </HelperText>
                      )}
                    </div>
                ) : (
                    <div>
                      <Select
                          id="curriculum"
                          value={formData.curriculum || ""}
                          onChange={handleInputChange}
                          disabled={isLoadingCurricula}
                          color={curriculumError ? "failure" : "gray"}
                      >
                        <option value="" hidden={true}>
                          {isLoadingCurricula
                              ? "Loading curricula..."
                              : "Select Curriculum..."}
                        </option>
                        {curriculaList.map((curr) => (
                            <option
                                key={curr.curriculum_id}
                                value={curr.curriculum_version}
                            >
                              {curr.curriculum_version}
                            </option>
                        ))}
                      </Select>
                      {curriculumError && (
                          <HelperText color="failure">{curriculumError}</HelperText>
                      )}
                    </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="lecture_units">Lec Units (0 - 8)</Label>
                  <TextInput
                      id="lecture_units"
                      type="number"
                      min={0}
                      max={8}
                      step="0.5"
                      value={formData.lecture_units ?? 0}
                      onChange={handleInputChange}
                      color={lecUnitsError ? "failure" : "gray"}
                  />
                  {lecUnitsError && (
                      <HelperText color="failure">{lecUnitsError}</HelperText>
                  )}
                </div>
                <div>
                  <Label htmlFor="lab_units">Lab Units (0 - 8)</Label>
                  <TextInput
                      id="lab_units"
                      type="number"
                      min={0}
                      max={8}
                      step="0.5"
                      value={formData.lab_units ?? 0}
                      onChange={handleInputChange}
                      color={labUnitsError ? "failure" : "gray"}
                  />
                  {labUnitsError && (
                      <HelperText color="failure">{labUnitsError}</HelperText>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="lab_type">Laboratory Type</Label>
                <Select
                    id="lab_type"
                    value={formData.lab_type || ""}
                    onChange={handleInputChange}
                    disabled={isLoadingRoomTypes || (formData.lab_units ?? 0) === 0}
                >
                  <option value="" hidden={true}>
                    {(formData.lab_units ?? 0) === 0 ? "No lab units (Disabled)" : "Select Laboratory Type..."}
                  </option>
                  {roomTypeList.map((type) => (
                      <option key={type.room_type_id} value={type.room_type_id}>
                        {type.value}
                      </option>
                  ))}
                </Select>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
                onClick={() => setOpenAddConfirmation(true)}
                disabled={isFormInvalid || isPending}
            >
              Create Subject
            </Button>
            <Button color="alternative" onClick={handleCloseModals}>
              Cancel
            </Button>
          </ModalFooter>
        </Modal>

        {/* --- MODAL: ADD CONFIRMATION --- */}
        <Modal show={openAddConfirmation} onClose={() => setOpenAddConfirmation(false)}>
          <ModalHeader>Confirm Add Subject</ModalHeader>
          <ModalBody className={"dark:text-white"}>
            Are you sure these details are correct? Please verify them carefully,
            as this is your final opportunity to make changes.
            <div className={"flex gap-8"}>
              <div className={"my-3"}>
                <Label className={"text-gray-400"}>Course Code</Label>
                <div className={"font-bold dark:text-white"}>
                  {formData.course_code}
                </div>
              </div>
              <div className={"my-3"}>
                <Label className={"text-gray-400"}>Course Name</Label>
                <div className={"font-bold dark:text-white"}>
                  {formData.course_name}
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
                onClick={handleCreateSubject}
                disabled={isFormInvalid || isPending}
            >
              Create Subject
            </Button>
            <Button
                color="alternative"
                onClick={() => setOpenAddConfirmation(false)}
            >
              Cancel
            </Button>
          </ModalFooter>
        </Modal>

        {/* --- MODAL: EDIT SUBJECT --- */}
        <Modal show={openEditModal} onClose={handleCloseModals} size="md">
          <ModalHeader>Edit Subject</ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <div>
                <div className="items-center justify-between">
                  <Label htmlFor="course_code">Course Code</Label>
                </div>
                <div className={"font-semibold dark:text-white"}>
                  {formData.course_code || ""}
                </div>
              </div>

              <div>
                <div className="items-center justify-between">
                  <Label htmlFor="course_name">Course Name</Label>
                </div>
                <div className={"font-semibold dark:text-white"}>
                  {formData.course_name || ""}
                </div>
              </div>

              <div>
                <Label htmlFor="year_level_select_edit">Year Level *</Label>
                <Select
                    id="year_level_select_edit"
                    value={selectedYear}
                    color={yearLevelError ? "failure" : "gray"}
                    onChange={(e) => {
                      const yr = e.target.value;
                      setSelectedYear(yr);
                      setYearLevelError(
                          yr.trim() === "" ? "Year Level is required." : "",
                      );
                      setFormData((prev) => ({ ...prev, program_code: "" }));
                    }}
                >
                  <option value="">Select Year...</option>
                  <option value="11">Grade 11</option>
                  <option value="12">Grade 12</option>
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </Select>
                {yearLevelError && (
                    <HelperText color="failure">{yearLevelError}</HelperText>
                )}
              </div>

              <div>
                <Label htmlFor="program_code">Program *</Label>
                <Select
                    id="program_code"
                    value={formData.program_code || ""}
                    onChange={handleInputChange}
                    disabled={!selectedYear || isLoadingPrograms}
                    color={programError ? "failure" : "gray"}
                >
                  <option value="">
                    {isLoadingPrograms
                        ? "Loading programs..."
                        : !selectedYear
                            ? "Select Year Level first..."
                            : "Select Program..."}
                  </option>
                  {programsList.map((prog) => (
                      <option key={prog.program_code} value={prog.program_code}>
                        {prog.program_code} - {prog.program_name}
                      </option>
                  ))}
                </Select>
                {programError && (
                    <HelperText color="failure">{programError}</HelperText>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label htmlFor="curriculum">Curriculum *</Label>
                  <button
                      type="button"
                      onClick={() => {
                        const nextState = !isNewCurriculum;
                        setIsNewCurriculum(nextState);
                        setFormData((prev) => ({ ...prev, curriculum: "" }));
                        setCurriculumError("");
                      }}
                      className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {isNewCurriculum
                        ? "Select existing Curriculum"
                        : "+ Enter new Curriculum"}
                  </button>
                </div>

                {isNewCurriculum ? (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 dark:text-gray-400" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                      {(formData.curriculum || "").length}/12
                    </span>
                      </div>
                      <TextInput
                          id="curriculum-text-input-edit"
                          type="text"
                          placeholder="e.g. BSIT-22-01"
                          value={formData.curriculum || ""}
                          onChange={handleCustomCurriculumChange}
                          color={curriculumError ? "failure" : "gray"}
                          maxLength={12}
                      />
                      {curriculumError ? (
                          <HelperText className="mt-1 text-red-600 dark:text-red-500">
                            {curriculumError}
                          </HelperText>
                      ) : (
                          <HelperText className="mt-1 text-gray-500 dark:text-gray-400">
                            Format: <b className="font-mono">BSIT-22-01</b> (Allowed:{" "}
                            <b className="font-mono">A-Z, 0-9, -</b>)
                          </HelperText>
                      )}
                    </div>
                ) : (
                    <div>
                      <Select
                          id="curriculum"
                          value={formData.curriculum || ""}
                          onChange={handleInputChange}
                          disabled={isLoadingCurricula}
                          color={curriculumError ? "failure" : "gray"}
                      >
                        <option value="" hidden={true}>
                          {isLoadingCurricula
                              ? "Loading curricula..."
                              : "Select Curriculum..."}
                        </option>
                        {curriculaList.map((curr) => (
                            <option
                                key={curr.curriculum_id}
                                value={curr.curriculum_version}
                            >
                              {curr.curriculum_version}
                            </option>
                        ))}
                      </Select>
                      {curriculumError && (
                          <HelperText color="failure">{curriculumError}</HelperText>
                      )}
                    </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="lecture_units">Lec Units (0 - 8)</Label>
                  <TextInput
                      id="lecture_units"
                      type="number"
                      min={0}
                      max={8}
                      step="0.5"
                      value={formData.lecture_units ?? 0}
                      onChange={handleInputChange}
                      color={lecUnitsError ? "failure" : "gray"}
                  />
                  {lecUnitsError && (
                      <HelperText color="failure">{lecUnitsError}</HelperText>
                  )}
                </div>
                <div>
                  <Label htmlFor="lab_units">Lab Units (0 - 8)</Label>
                  <TextInput
                      id="lab_units"
                      type="number"
                      min={0}
                      max={8}
                      step="0.5"
                      value={formData.lab_units ?? 0}
                      onChange={handleInputChange}
                      color={labUnitsError ? "failure" : "gray"}
                  />
                  {labUnitsError && (
                      <HelperText color="failure">{labUnitsError}</HelperText>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="lab_type">Laboratory Type</Label>
                <Select
                    id="lab_type"
                    value={formData.lab_type || ""}
                    onChange={handleInputChange}
                    disabled={isLoadingRoomTypes || (formData.lab_units ?? 0) === 0}
                >
                  <option value="" hidden={true}>
                    {(formData.lab_units ?? 0) === 0 ? "No lab units (Disabled)" : "Select Laboratory Type..."}
                  </option>
                  {roomTypeList.map((type) => (
                      <option key={type.room_type_id} value={type.room_type_id}>
                        {type.value}
                      </option>
                  ))}
                </Select>
              </div>
            </div>
          </ModalBody>
          <ModalFooter className="flex flex-row items-center justify-between gap-3">
            <Button
                color="red"
                onClick={() => {
                  setOpenEditModal(false);
                  setOpenDeleteModal(true);
                }}
            >
              <HiOutlineTrash className="h-4 w-4 sm:mr-2" />
              <span className={"hidden sm:block"}>Delete</span>
            </Button>

            <div className="flex gap-2">
              <Button
                  onClick={handleUpdateSubject}
                  disabled={isFormInvalid || isPending}
              >
                Save Changes
              </Button>
              <Button color="alternative" onClick={handleCloseModals}>
                Cancel
              </Button>
            </div>
          </ModalFooter>
        </Modal>

        {/* --- MODAL: CONFIRM DELETE --- */}
        <Modal show={openDeleteModal} onClose={handleCloseModals} size="md">
          <ModalHeader>Confirm Delete</ModalHeader>
          <ModalBody>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to delete{" "}
              <strong className="text-gray-900 dark:text-white">
                {selectedSubject?.course_code} - {selectedSubject?.course_name}
              </strong>
              ? This action cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter className="flex justify-end gap-2">
            <Button color="red" onClick={handleDeleteSubject}>
              Confirm Delete
            </Button>
            <Button color="alternative" onClick={handleCloseModals}>
              Cancel
            </Button>
          </ModalFooter>
        </Modal>
      </div>
  );
}