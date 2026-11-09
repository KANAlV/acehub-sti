"use client";

import {
  Badge,
  Button,
  ButtonGroup,
  Card,
  HelperText,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Pagination,
  Progress,
  Select,
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
  ToggleSwitch,
  Tooltip,
  FileInput,
} from "flowbite-react";
import {
  archiveAllActiveFcce,
  createFcce,
  deleteFcce,
  fetchAcademicYears,
  fetchDistinctCourseNames,
  fetchFcce,
  fetchFcceCount,
  fetchFcceUnmatched,
  fetchFcceUnmatchedCount,
  fetchTeachers,
  updateFcce,
  FcceRecord,
  FcceInput,
  TeacherRecord,
  AcademicYearRecord,
  ArchivedMode,
} from "@/app/actions/system";
import {
  filterAlphanumeric,
  filterAlphanumericDashUnderscoreComma,
} from "@/utils/validation";
import { FaPlus, FaSortDown, FaSortUp, FaFileExcel, FaFileImport, FaFileExport, FaDownload } from "react-icons/fa6";
import {
  HiCheck,
  HiExclamation,
  HiX,
  HiSearch,
  HiOutlineArchive,
} from "react-icons/hi";
import { IoMdExit } from "react-icons/io";
import { useEffect, useState, useCallback, useRef } from "react";
import { useMsal } from "@azure/msal-react";
import ExcelJS from "exceljs";

const REQUIRED_HEADERS = ["PSCS ID", "Course Name", "Academic Year / Semester", "Status"];

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

export default function FcceManagement() {
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];
  const username = activeAccount?.username;
  const [isLoading, setLoading] = useState(true);

  // --- View Mode Toggle State --- //
  const [viewMode, setViewMode] = useState<"ALL" | "UNMATCHED">("ALL");
  const [unmatchedCount, setUnmatchedCount] = useState(0);

  // --- Academic Year State --- //
  const [academicYearList, setAcademicYearList] = useState<AcademicYearRecord[]>([]);

  // --- Course Name Suggestions State --- //
  const [courseNameList, setCourseNameList] = useState<string[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<string[]>([]);

  // --- Teachers Search / Suggestions State --- //
  const [teacherList, setTeacherList] = useState<TeacherRecord[]>([]);

  // --- Table & View Filter State --- //
  const [records, setRecords] = useState<FcceRecord[]>([]);
  const [recordsCount, setRecordsCount] = useState(0);
  const [sortFcceBy, setSortFcceBy] = useState("created_at");
  const [sortFcceDir, setSortFcceDir] = useState("DESC");
  const [searchTerm, setSearchTerm] = useState("");

  const [archiveFilter, setArchiveFilter] = useState<ArchivedMode>("ACTIVE");

  // --- Modal States --- //
  const [openAddModal, setOpenAddModal] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [openArchiveSingleModal, setOpenArchiveSingleModal] = useState(false);
  const [openUnarchiveModal, setOpenUnarchiveModal] = useState(false);
  const [openArchiveAllModal, setOpenArchiveAllModal] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [openExcelModal, setOpenExcelModal] = useState(false);

  // Excel Modal States
  const [activeExcelTab, setActiveExcelTab] = useState<"import" | "export" | "template">("import");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [formatError, setFormatError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Form & Validation States --- //
  const [fcceId, setFcceId] = useState("");
  const [unarchiveRecordInfo, setUnarchiveRecordInfo] = useState<{
    id: string;
    pscs_id: string;
    course_name: string;
  } | null>(null);

  const [pscsIdError, setPscsIdError] = useState("");
  const [courseNameError, setCourseNameError] = useState("");
  const [aySemError, setAySemError] = useState("");
  const [editCourseNameError, setEditCourseNameError] = useState("");
  const [editAySemError, setEditAySemError] = useState("");

  // Add Form State
  const [addPscsId, setAddPscsId] = useState("");
  const [addCourseName, setAddCourseName] = useState("");
  const [addPass, setAddPass] = useState(true);

  // Add Modal - AY/Sem States
  const [isNewAySem, setIsNewAySem] = useState(false);
  const [addAySem, setAddAySem] = useState("");
  const [addAyStartYear, setAddAyStartYear] = useState<string>("");
  const [addAyTerm, setAddAyTerm] = useState<string>("T1");

  // Edit Form State
  const [editPscsId, setEditPscsId] = useState("");
  const [editCourseName, setEditCourseName] = useState("");
  const [editAySem, setEditAySem] = useState("");
  const [editPass, setEditPass] = useState(false);

  // --- Pagination State --- //
  const maxRowFcce = 10;
  const [currentFccePage, setCurrentFccePage] = useState(1);
  const [pageChanging, setPageChanging] = useState(false);

  // --- Toast State --- //
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [showToastTimer, setShowToastTimer] = useState(false);
  const [progress, setProgress] = useState(0);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);

  const containsAlpha = (val: string) => /[a-zA-Z]/.test(val);

  const formatAySemCode = (startYrStr: string, endYrStr: string, termStr: string): string => {
    if (!startYrStr || !endYrStr || !termStr) return "";
    const formatYr = (y: string) => (y.length >= 4 ? y.slice(2) : y);
    return `${formatYr(startYrStr)}${formatYr(endYrStr)}${termStr}`;
  };

  const handleAddCustomAyChange = useCallback((start: string = addAyStartYear, term: string = addAyTerm) => {
    setAddAyStartYear(start);
    setAddAyTerm(term);
    if (!start) {
      setAySemError("Start year is required.");
      setAddAySem("");
      return;
    }
    const startNum = parseInt(start, 10);
    const endStr = (startNum + 1).toString();
    setAySemError("");
    setAddAySem(formatAySemCode(start, endStr, term));
  }, [addAyStartYear, addAyTerm]);

  async function loadAcademicYears() {
    const res = await fetchAcademicYears(null, "ay_sem", "DESC", 0, 1);
    if (res?.success && res.data) {
      setAcademicYearList(res.data);
    }
  }

  async function loadCourseNames() {
    const res = await fetchDistinctCourseNames(null, "ASC", 100, 1);
    if (res?.success && res.data) {
      setCourseNameList(res.data);
    }
  }

  useEffect(() => {
    void loadAcademicYears();
    void loadCourseNames();
  }, []);

  const filterCourses = useCallback((term: string) => {
    if (!term.trim()) {
      setFilteredCourses([]);
      return;
    }
    const lower = term.toLowerCase();
    const matches = courseNameList.filter((name) => name.toLowerCase().includes(lower));
    setFilteredCourses(matches.slice(0, 10));
  }, [courseNameList]);

  const searchTeachers = useCallback(async (term: string) => {
    if (!term.trim()) {
      setTeacherList([]);
      return;
    }
    const res = await fetchTeachers(term, "All Active & On Leave", "All Departments", "surname", "ASC", 10, 1);
    if (res?.success && res.data) {
      setTeacherList(res.data);
    }
  }, []);

  const checkUnmatchedCount = useCallback(async () => {
    const res = await fetchFcceUnmatchedCount(searchTerm, "ALL", archiveFilter);
    if (res?.success) {
      setUnmatchedCount(res.count);
    }
  }, [searchTerm, archiveFilter]);

  useEffect(() => {
    void checkUnmatchedCount();
  }, [checkUnmatchedCount]);

  const isCourseValid = useCallback((courseName: string) => {
    if (!courseName) return false;
    return courseNameList.some((name) => name.toLowerCase().trim() === courseName.toLowerCase().trim());
  }, [courseNameList]);

  const hasInvalidSubjects = records.some((item) => !isCourseValid(item.course_name));
  const hasArchivedRecords = records.some((item) => item.archived);

  const getFcceCount = useCallback(async (search?: string | null, aySem: string = "ALL", archivedMode: ArchivedMode = archiveFilter, mode: "ALL" | "UNMATCHED" = viewMode) => {
    const response = mode === "UNMATCHED"
        ? await fetchFcceUnmatchedCount(search, aySem, archivedMode)
        : await fetchFcceCount(search, aySem, archivedMode);

    if (response?.success) {
      setRecordsCount(response.count);
    } else {
      setRecordsCount(0);
    }
  }, [archiveFilter, viewMode]);

  const getFcceRecords = useCallback(async (search: string | null = searchTerm, aySem: string = "ALL", archivedMode: ArchivedMode = archiveFilter, sortby: string = sortFcceBy, sortdir: string = sortFcceDir, limit: number = maxRowFcce, page: number = currentFccePage, mode: "ALL" | "UNMATCHED" = viewMode) => {
    setLoading(true);
    const response = mode === "UNMATCHED"
        ? await fetchFcceUnmatched(search, aySem, archivedMode, sortby, sortdir, limit, page)
        : await fetchFcce(search, aySem, archivedMode, sortby, sortdir, limit, page);

    if (response?.success && response.data) {
      setRecords(response.data);
    } else {
      setRecords([]);
    }
    setLoading(false);
    await getFcceCount(search, aySem, archivedMode, mode);
  }, [searchTerm, archiveFilter, sortFcceBy, sortFcceDir, currentFccePage, viewMode, getFcceCount]);

  function handleFcceSorting(sortBy: string) {
    const newDir = sortBy === sortFcceBy && sortFcceDir === "ASC" ? "DESC" : "ASC";
    setSortFcceBy(sortBy);
    setSortFcceDir(newDir);
    setRecords([]);
    setCurrentFccePage(1);
    void getFcceRecords(searchTerm, "ALL", archiveFilter, sortBy, newDir, maxRowFcce, 1, viewMode);
  }

  function onPageChangeFcce(page: number) {
    if (pageChanging) return;
    setPageChanging(true);
    setRecords([]);
    void getFcceRecords(searchTerm, "ALL", archiveFilter, sortFcceBy, sortFcceDir, maxRowFcce, page, viewMode);
    setPageChanging(false);
    setCurrentFccePage(page);
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentFccePage(1);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setCurrentFccePage(1);
  };

  const handleArchiveFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFilter = e.target.value as ArchivedMode;
    setArchiveFilter(newFilter);
    setCurrentFccePage(1);
    setRecords([]);
    setLoading(true);
    void getFcceRecords(searchTerm, "ALL", newFilter, sortFcceBy, sortFcceDir, maxRowFcce, 1, viewMode);
  };

  const handleViewModeToggle = () => {
    const nextMode = viewMode === "UNMATCHED" ? "ALL" : "UNMATCHED";
    setViewMode(nextMode);
    setCurrentFccePage(1);
    setRecords([]);
    setLoading(true);
    void getFcceRecords(searchTerm, "ALL", archiveFilter, sortFcceBy, sortFcceDir, maxRowFcce, 1, nextMode);
  };

  const validatePscsId = (val: string) => {
    if (!val.trim()) return "PSCS ID is required.";
    if (containsAlpha(val)) return "PSCS ID cannot contain alphabetic characters.";
    return "";
  };

  const handleAddPscsIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, 15);
    setAddPscsId(val);
    setPscsIdError(validatePscsId(val));
    void searchTeachers(val);
  };

  const handleAddCourseNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterAlphanumericDashUnderscoreComma(e.target.value).slice(0, 150);
    setAddCourseName(val);
    setCourseNameError(!val.trim() ? "Course name is required." : "");
    filterCourses(val);
  };

  const handleSelectAddAySemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setAddAySem(val);
    setAySemError(!val.trim() ? "Academic Year / Semester is required." : "");
  };

  const handleSelectEditAySemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setEditAySem(val);
    setEditAySemError(!val.trim() ? "Academic Year / Semester is required." : "");
  };

  const handleSelectAddPscsId = (teacher: TeacherRecord) => {
    const selectedPscs = teacher.pscs_id ? filterAlphanumeric(teacher.pscs_id).slice(0, 15) : "";
    setAddPscsId(selectedPscs);
    setPscsIdError(validatePscsId(selectedPscs));
    setTeacherList([]);
  };

  const handleSelectAddCourse = (courseName: string) => {
    const course = filterAlphanumericDashUnderscoreComma(courseName).slice(0, 150);
    setAddCourseName(course);
    setCourseNameError("");
    setFilteredCourses([]);
  };

  function loadEditData(id: string) {
    setFcceId(id);
    const selectedRecord = records.find((item) => item.fcce_id === id);
    if (selectedRecord) {
      const pscs = filterAlphanumeric(selectedRecord.pscs_id || "").slice(0, 15);
      const course = filterAlphanumericDashUnderscoreComma(selectedRecord.course_name || "").slice(0, 150);
      const aySemVal = selectedRecord.ay_sem || "";
      const pass = selectedRecord.pass;

      setEditPscsId(pscs);
      setEditCourseName(course);
      setEditAySem(aySemVal);
      setEditPass(pass);
      setOpenEditModal(true);
    }
  }

  function promptUnarchive(item: FcceRecord) {
    setUnarchiveRecordInfo({
      id: item.fcce_id,
      pscs_id: item.pscs_id,
      course_name: item.course_name,
    });
    setOpenUnarchiveModal(true);
  }

  const handleCloseModals = () => {
    setFcceId("");
    setUnarchiveRecordInfo(null);
    setPscsIdError("");
    setCourseNameError("");
    setAySemError("");
    setEditCourseNameError("");
    setEditAySemError("");
    setOpenAddModal(false);
    setOpenEditModal(false);
    setOpenArchiveSingleModal(false);
    setOpenUnarchiveModal(false);
    setOpenArchiveAllModal(false);
    setOpenDeleteModal(false);
    setOpenExcelModal(false);
    setAddPscsId("");
    setAddCourseName("");
    setAddPass(true);
    setIsNewAySem(false);
    setAddAySem("");
    setAddAyStartYear("");
    setAddAyTerm("T1");
    setEditPscsId("");
    setEditCourseName("");
    setEditAySem("");
    setEditPass(false);
    setTeacherList([]);
    setFilteredCourses([]);
    setImportFile(null);
    setImportLogs([]);
    setFormatError("");
    setIsImporting(false);
  };

  async function handleFcceSubmit() {
    const pscsError = validatePscsId(addPscsId);
    if (pscsError) {
      setPscsIdError(pscsError);
      return;
    }
    if (!addCourseName.trim()) {
      setCourseNameError("Course name is required.");
      return;
    }
    if (!addAySem.trim()) {
      setAySemError("Academic Year / Semester is required.");
      return;
    }

    const payload: FcceInput = {
      pscs_id: addPscsId.trim(),
      course_name: addCourseName.trim(),
      ay_sem: addAySem.trim(),
      pass: addPass,
      archived: false,
    };

    const response = await createFcce(username ?? "system", payload);
    if (response?.success) {
      setToastMessage("FCCE record created successfully");
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(response?.error ?? "An unexpected error occurred");
      setToastType("error");
      setShowToast(true);
    }
    handleCloseModals();
    void getFcceRecords();
  }

  async function handleFcceUpdate() {
    if (!editCourseName.trim()) {
      setEditCourseNameError("Course name is required.");
      return;
    }
    if (!editAySem.trim()) {
      setEditAySemError("Academic Year / Semester is required.");
      return;
    }

    const payload: Partial<FcceInput> = {
      pscs_id: editPscsId.trim(),
      course_name: editCourseName.trim(),
      ay_sem: editAySem.trim(),
      pass: editPass,
    };

    const response = await updateFcce(username ?? "system", fcceId, payload);
    if (response?.success) {
      setToastMessage("FCCE record updated successfully");
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(response?.error ?? "An unexpected error occurred");
      setToastType("error");
      setShowToast(true);
    }
    handleCloseModals();
    void getFcceRecords();
  }

  async function handleArchiveSingleFcce() {
    const response = await updateFcce(username ?? "system", fcceId, { archived: true });
    if (response?.success) {
      setToastMessage("FCCE record archived successfully");
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(response?.error ?? "An unexpected error occurred");
      setToastType("error");
      setShowToast(true);
    }
    handleCloseModals();
    void getFcceRecords();
  }

  async function handleDeleteFcce() {
    const response = await deleteFcce(username ?? "system", fcceId);
    if (response?.success) {
      setToastMessage("FCCE record deleted successfully");
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(response?.error ?? "An unexpected error occurred");
      setToastType("error");
      setShowToast(true);
    }
    handleCloseModals();
    void getFcceRecords();
  }

  async function handleUnarchiveFcce() {
    if (!unarchiveRecordInfo) return;
    const response = await updateFcce(username ?? "system", unarchiveRecordInfo.id, { archived: false });
    if (response?.success) {
      setToastMessage("FCCE record restored successfully");
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(response?.error ?? "An unexpected error occurred");
      setToastType("error");
      setShowToast(true);
    }
    handleCloseModals();
    void getFcceRecords();
  }

  async function handleArchiveAllActive() {
    const response = await archiveAllActiveFcce(username ?? "system");
    if (response?.success) {
      setToastMessage(`Successfully archived ${response.archivedCount} active record(s)`);
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(response?.error ?? "An unexpected error occurred");
      setToastType("error");
      setShowToast(true);
    }
    handleCloseModals();
    void getFcceRecords();
  }

  // Excel Helpers
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

  const handleDownloadTemplate = useCallback(async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Template") as unknown as WorksheetWithValidation;

    worksheet.columns = [
      { header: "PSCS ID", key: "pscs_id", width: 15 },
      { header: "Course Name", key: "course_name", width: 35 },
      { header: "Academic Year / Semester", key: "ay_sem", width: 25 },
      { header: "Status", key: "status", width: 15 },
    ];

    worksheet.addRow({
      pscs_id: "12345678",
      course_name: "Introduction to Computing",
      ay_sem: "2425T1",
      status: "Passed",
    });

    worksheet.dataValidations.add("D2:D1000", {
      type: "list",
      allowBlank: false,
      formulae: ['"Passed,Failed"'],
      showErrorMessage: true,
      errorTitle: "Invalid Status",
      error: "Please select either Passed or Failed from the dropdown list.",
    });

    const buffer = await workbook.xlsx.writeBuffer();
    downloadWorkbook(buffer, "FCCE_Import_Template.xlsx");
    setToastMessage("Blank Excel template downloaded successfully!");
    setToastType("success");
    setShowToast(true);
  }, []);

  const handleExportExcel = useCallback(async () => {
    try {
      const response = await fetchFcce(searchTerm || null, "ALL", archiveFilter, sortFcceBy, sortFcceDir, 10000, 1);
      const exportList = response?.success && response.data ? response.data : records;

      if (exportList.length === 0) {
        setToastMessage("No records available to export.");
        setToastType("warning");
        setShowToast(true);
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("FCCE Records") as unknown as WorksheetWithValidation;

      worksheet.columns = [
        { header: "PSCS ID", key: "pscs_id", width: 15 },
        { header: "Course Name", key: "course_name", width: 35 },
        { header: "Academic Year / Semester", key: "ay_sem", width: 25 },
        { header: "Status", key: "status", width: 15 },
      ];

      exportList.forEach((item) => {
        worksheet.addRow({
          pscs_id: item.pscs_id || "",
          course_name: item.course_name || "",
          ay_sem: item.ay_sem || "",
          status: item.pass ? "Passed" : "Failed",
        });
      });

      worksheet.dataValidations.add("D2:D1000", {
        type: "list",
        allowBlank: false,
        formulae: ['"Passed,Failed"'],
      });

      const buffer = await workbook.xlsx.writeBuffer();
      downloadWorkbook(buffer, `FCCE_Export_${new Date().toISOString().split("T")[0]}.xlsx`);
      setToastMessage("FCCE records exported to Excel successfully");
      setToastType("success");
      setShowToast(true);
    } catch (err) {
      console.error(err);
      setToastMessage("Failed to export records to Excel");
      setToastType("error");
      setShowToast(true);
    }
  }, [searchTerm, archiveFilter, sortFcceBy, sortFcceDir, records]);

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

      setImportLogs((prev) => [...prev, `Headers verified. Processing rows...`]);

      let successCount = 0;
      let failCount = 0;
      const logs: string[] = [];

      const headerIndexMap: Record<string, number> = {};
      headerRow.eachCell((cell, colNumber) => {
        if (cell.value) {
          headerIndexMap[String(cell.value).trim().toLowerCase()] = colNumber;
        }
      });

      const pscsCol = headerIndexMap["pscs id"] || 1;
      const courseCol = headerIndexMap["course name"] || 2;
      const aySemCol = headerIndexMap["academic year / semester"] || headerIndexMap["ay / sem"] || 3;
      const statusCol = headerIndexMap["status"] || 4;

      const rowsToProcess: {
        rowNum: number;
        pscsId: string;
        courseName: string;
        aySem: string;
        pass: boolean;
      }[] = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rawPscs = String(row.getCell(pscsCol).value || "").trim();
        const rawCourse = String(row.getCell(courseCol).value || "").trim();
        const rawAySem = String(row.getCell(aySemCol).value || "").trim();
        const rawStatus = String(row.getCell(statusCol).value || "").trim().toLowerCase();

        if (!rawPscs || !rawCourse || !rawAySem) {
          logs.push(`Row ${rowNumber}: Skipped. Essential information (PSCS ID, Course Name, or AY/Sem) is missing.`);
          failCount++;
          return;
        }

        if (rawStatus !== "passed" && rawStatus !== "failed" && rawStatus !== "pass" && rawStatus !== "fail") {
          logs.push(`Row ${rowNumber} (${rawPscs}): Failed. Status must be either Passed or Failed.`);
          failCount++;
          return;
        }

        const isPassed = rawStatus === "passed" || rawStatus === "pass";

        rowsToProcess.push({
          rowNum: rowNumber,
          pscsId: rawPscs,
          courseName: rawCourse,
          aySem: rawAySem,
          pass: isPassed,
        });
      });

      for (const item of rowsToProcess) {
        const payload: FcceInput = {
          pscs_id: item.pscsId,
          course_name: item.courseName,
          ay_sem: item.aySem,
          pass: item.pass,
          archived: false,
        };

        const res = await createFcce(username ?? "system", payload);
        if (res?.success) {
          successCount++;
        } else {
          logs.push(`Row ${item.rowNum} (${item.pscsId}): ${res?.error || "Creation failed."}`);
          failCount++;
        }
      }

      setImportLogs((prev) => [
        ...prev,
        `Import Completed: ${successCount} successful, ${failCount} failed.`,
        ...logs,
      ]);

      if (successCount > 0) {
        setToastMessage(`Imported ${successCount} records successfully.`);
        setToastType("success");
        setShowToast(true);
        void getFcceRecords();
      }
    } catch (err) {
      console.error(err);
      setFormatError("Error: Unable to parse Excel workbook format using ExcelJS.");
    } finally {
      setIsImporting(false);
    }
  }, [importFile, username, getFcceRecords]);

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
      void getFcceRecords(searchTerm, "ALL", archiveFilter, sortFcceBy, sortFcceDir, maxRowFcce, currentFccePage, viewMode);
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, archiveFilter, viewMode, sortFcceBy, sortFcceDir, currentFccePage, getFcceRecords]);

  const isAddFormInvalid = !addPscsId.trim() || !addCourseName.trim() || !addAySem.trim() || containsAlpha(addPscsId) || !!pscsIdError || !!courseNameError || !!aySemError;
  const isEditFormInvalid = !editCourseName.trim() || !editAySem.trim() || !!editCourseNameError || !!editAySemError;

  return (
      <>
        {showToast && (
            <div className="fixed right-5 bottom-5 z-50 rounded-lg border border-gray-500/30">
              <Toast>
                <div className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toastType === "success" ? "bg-green-100 text-green-500" : "bg-red-100 text-red-500"}`}>
                  {toastType === "success" ? <HiCheck className="h-5 w-5" /> : <HiExclamation className="h-5 w-5" />}
                </div>
                <div className="ml-3 text-sm font-normal">{toastMessage}</div>
                <ToastToggle onDismiss={closeToast} />
              </Toast>
              <Progress progress={Math.min(Math.round(progress), 100)} size="sm" className={showToastTimer ? "" : "hidden"} />
            </div>
        )}

        <div>
          <div className="mb-4">
            <h2 className="mb-1 text-lg font-bold">FCCE Management</h2>
            <p className="text-gray-500">Manage and track FCCE student course passing statuses and archive records.</p>
          </div>

          <div className="my-4 flex-col justify-between gap-4 md:flex md:flex-row md:items-center">
            <div className="relative mb-2 w-full md:w-64">
              <TextInput
                  id="search-fcce"
                  type="text"
                  placeholder="Search PSCS ID, Course, Teacher..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  icon={HiSearch}
              />
              {searchTerm && (
                  <button type="button" onClick={handleClearSearch} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500">
                    <HiX className="h-4 w-4" />
                  </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {viewMode === "UNMATCHED" ? (
                  <Tooltip placement={"right"} content={"Click to Go back to all records"}>
                    <IoMdExit className={"h-8 w-8 rotate-180 cursor-pointer"} onClick={handleViewModeToggle} />
                  </Tooltip>
              ) : (
                  unmatchedCount > 0 && (
                      <Tooltip placement="right" content={`${unmatchedCount} Unmatched Record(s). Click to filter.`}>
                        <HiExclamation className={"h-8 w-8 cursor-pointer text-yellow-400"} onClick={handleViewModeToggle} />
                      </Tooltip>
                  )
              )}

              <div className="w-full md:w-40">
                <Select id="archive-filter" value={archiveFilter} onChange={handleArchiveFilterChange}>
                  <option value="ACTIVE">Active Only</option>
                  <option value="ARCHIVED">Archived Only</option>
                  <option value="BOTH">All Records (Both)</option>
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

              <Button color="yellow" className="w-full md:w-48 whitespace-nowrap" onClick={() => setOpenArchiveAllModal(true)}>
                <HiOutlineArchive className="mr-2 h-4 w-4" /> Archive All Active
              </Button>

              <Button className="w-full whitespace-nowrap md:w-48" onClick={() => setOpenAddModal(true)}>
                <FaPlus className="mr-2" /> Add Record
              </Button>
            </div>
          </div>

          {(hasInvalidSubjects || hasArchivedRecords) && (
              <div className="m-2 flex flex-wrap gap-2">
                {hasInvalidSubjects && <Badge color="warning">Invalid / Missing Subject</Badge>}
                {hasArchivedRecords && <Badge color="gray">Archived Record</Badge>}
              </div>
          )}

          <Card className="overflow-x-auto">
            <Table hoverable>
              <TableHead>
                <TableRow>
                  <TableHeadCell onClick={() => handleFcceSorting("pscs_id")}>
                    <div className="flex cursor-pointer text-blue-500 hover:underline">
                      PSCS ID {sortFcceBy === "pscs_id" && (sortFcceDir === "ASC" ? <FaSortUp className="ml-1" /> : <FaSortDown className="ml-1" />)}
                    </div>
                  </TableHeadCell>
                  <TableHeadCell onClick={() => handleFcceSorting("teacher_name")}>
                    <div className="flex cursor-pointer text-blue-500 hover:underline">
                      Teacher Name {sortFcceBy === "teacher_name" && (sortFcceDir === "ASC" ? <FaSortUp className="ml-1" /> : <FaSortDown className="ml-1" />)}
                    </div>
                  </TableHeadCell>
                  <TableHeadCell onClick={() => handleFcceSorting("course_name")}>
                    <div className="flex cursor-pointer text-blue-500 hover:underline">
                      Course Name {sortFcceBy === "course_name" && (sortFcceDir === "ASC" ? <FaSortUp className="ml-1" /> : <FaSortDown className="ml-1" />)}
                    </div>
                  </TableHeadCell>
                  <TableHeadCell onClick={() => handleFcceSorting("ay_sem")}>
                    <div className="flex cursor-pointer text-blue-500 hover:underline">
                      AY / Sem {sortFcceBy === "ay_sem" && (sortFcceDir === "ASC" ? <FaSortUp className="ml-1" /> : <FaSortDown className="ml-1" />)}
                    </div>
                  </TableHeadCell>
                  <TableHeadCell onClick={() => handleFcceSorting("pass")}>
                    <div className="flex cursor-pointer text-blue-500 hover:underline">
                      Status {sortFcceBy === "pass" && (sortFcceDir === "ASC" ? <FaSortUp className="ml-1" /> : <FaSortDown className="ml-1" />)}
                    </div>
                  </TableHeadCell>
                  <TableHeadCell onClick={() => handleFcceSorting("created_at")}>
                    <div className="flex cursor-pointer text-blue-500 hover:underline">
                      Created At {sortFcceBy === "created_at" && (sortFcceDir === "ASC" ? <FaSortUp className="ml-1" /> : <FaSortDown className="ml-1" />)}
                    </div>
                  </TableHeadCell>
                  <TableHeadCell><span className="sr-only">Actions</span></TableHeadCell>
                </TableRow>
              </TableHead>

              <TableBody className="divide-y">
                {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-6 text-center italic text-gray-500">
                        <div className="flex items-center justify-center">
                          <Spinner />
                          <span className="ml-4">Fetching records...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                ) : records.length > 0 ? (
                    records.map((item) => {
                      const exists = isCourseValid(item.course_name);
                      const rowBgClass = item.archived ? "bg-gray-100" : !exists ? "bg-yellow-100" : "bg-white";
                      return (
                          <TableRow key={item.fcce_id} className={`${rowBgClass} ${item.archived ? "line-through text-gray-400" : ""}`}>
                            <TableCell className="font-medium text-gray-900">{item.pscs_id}</TableCell>
                            <TableCell>{item.teacher_name || "—"}</TableCell>
                            <TableCell>{item.course_name}</TableCell>
                            <TableCell>{item.ay_sem || "—"}</TableCell>
                            <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${item.pass ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                          {item.pass ? "Passed" : "Failed"}
                        </span>
                            </TableCell>
                            <TableCell>{new Date(item.created_at).toLocaleDateString()}</TableCell>
                            <TableCell>
                              {item.archived ? (
                                  <a onClick={() => promptUnarchive(item)} className="cursor-pointer font-medium text-green-600 hover:underline">Unarchive</a>
                              ) : (
                                  <a onClick={() => loadEditData(item.fcce_id)} className="cursor-pointer font-medium text-blue-600 hover:underline">Edit</a>
                              )}
                            </TableCell>
                          </TableRow>
                      );
                    })
                ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="py-6 text-center italic text-gray-500">
                        No records found.
                      </TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          <div className="mt-4 flex justify-center">
            <Pagination layout="pagination" currentPage={currentFccePage} totalPages={Math.ceil(recordsCount / maxRowFcce) || 1} onPageChange={onPageChangeFcce} showIcons />
          </div>
        </div>

        {/* --- MODAL: EXCEL OPERATIONS --- */}
        <Modal show={openExcelModal} onClose={handleCloseModals} size="lg">
          <ModalHeader>
            <div className="flex items-center gap-2">
              <FaFileExcel className="text-green-600 h-5 w-5" />
              <span>Excel Operations & Data Management</span>
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
                  <span className="text-xs font-semibold">Export Records</span>
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
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDragging(false);
                          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            validateAndSelectFile(e.dataTransfer.files[0]);
                          }
                        }}
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
                          onChange={(e) => validateAndSelectFile(e.target.files ? e.target.files[0] : null)}
                          className="hidden"
                      />
                      <FaFileImport className="mx-auto mb-2 h-8 w-8 text-blue-500" />
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {importFile ? importFile.name : "Drag & drop your Excel file here or browse"}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {importFile ? `${(importFile.size / 1024).toFixed(1)} KB` : "Strictly accepts .xlsx, .xls, or .csv files"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
                      <span className="font-semibold uppercase tracking-wide">Required Format Headers:</span> {REQUIRED_HEADERS.join(", ")} (Status must be Passed or Failed).
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
                        Export Filtered FCCE Records
                      </h4>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Generates a standardized Excel spreadsheet containing all active query results with Status dropdown validation.
                      </p>
                    </div>
                    <Button onClick={handleExportExcel} className="w-full" color="green">
                      <FaFileExport className="mr-2 h-4 w-4" /> Export {recordsCount} Records to Excel
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
                        Includes columns formatted as: <b className="font-mono">{REQUIRED_HEADERS.join(", ")}</b> with Status dropdown validation.
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

        {/* Add Modal */}
        <Modal show={openAddModal} onClose={handleCloseModals}>
          <ModalHeader>Add FCCE Record</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="relative">
                <Label htmlFor="add-pscs-id">PSCS ID</Label>
                <TextInput id="add-pscs-id" value={addPscsId} onChange={handleAddPscsIdChange} placeholder="Enter PSCS ID" />
                {pscsIdError && <HelperText className="text-red-600">{pscsIdError}</HelperText>}
                {teacherList.length > 0 && (
                    <ul className="absolute z-10 max-h-40 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
                      {teacherList.map((teacher) => (
                          <li key={teacher.teacher_id} onClick={() => handleSelectAddPscsId(teacher)} className="cursor-pointer px-4 py-2 hover:bg-gray-100">
                            {teacher.full_name} ({teacher.pscs_id})
                          </li>
                      ))}
                    </ul>
                )}
              </div>

              <div className="relative">
                <Label htmlFor="add-course-name">Course Name</Label>
                <TextInput id="add-course-name" value={addCourseName} onChange={handleAddCourseNameChange} placeholder="Enter or select course name" />
                {courseNameError && <HelperText className="text-red-600">{courseNameError}</HelperText>}
                {filteredCourses.length > 0 && (
                    <ul className="absolute z-10 max-h-40 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
                      {filteredCourses.map((c, idx) => (
                          <li key={idx} onClick={() => handleSelectAddCourse(c)} className="cursor-pointer px-4 py-2 hover:bg-gray-100">{c}</li>
                      ))}
                    </ul>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label>Academic Year / Semester</Label>
                  <button type="button" onClick={() => setIsNewAySem(!isNewAySem)} className="text-xs text-blue-600 hover:underline">
                    {isNewAySem ? "Select existing AY/Sem" : "+ Enter new AY/Sem"}
                  </button>
                </div>
                {isNewAySem ? (
                    <div className="flex items-center gap-2">
                      <Select value={addAyStartYear} onChange={(e) => handleAddCustomAyChange(e.target.value, addAyTerm)}>
                        <option value="">Start Year</option>
                        {yearOptions.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
                      </Select>
                      <span>-</span>
                      <div>{addAyStartYear ? parseInt(addAyStartYear, 10) + 1 : "End Year"}</div>
                      <Select value={addAyTerm} onChange={(e) => handleAddCustomAyChange(addAyStartYear, e.target.value)}>
                        <option value="T1">Term 1</option>
                        <option value="T2">Term 2</option>
                        <option value="T3">Term 3</option>
                        <option value="T4">Term 4</option>
                      </Select>
                    </div>
                ) : (
                    <Select value={addAySem} onChange={handleSelectAddAySemChange}>
                      <option value="">Select Academic Year / Sem</option>
                      {academicYearList.map((item) => <option key={item.ay_sem} value={item.ay_sem}>{item.ay_sem}</option>)}
                    </Select>
                )}
              </div>

              <div className="flex items-center justify-between">
                <Label>Status</Label>
                <ToggleSwitch checked={addPass} label={addPass ? "Passed" : "Failed"} onChange={setAddPass} />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button disabled={isAddFormInvalid} onClick={() => void handleFcceSubmit()}>Submit</Button>
            <Button color="alternative" onClick={handleCloseModals}>Cancel</Button>
          </ModalFooter>
        </Modal>

        {/* Edit Modal */}
        <Modal show={openEditModal} onClose={handleCloseModals}>
          <ModalHeader>Edit FCCE Record</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <Label>PSCS ID</Label>
                <div className="text-sm font-medium">{editPscsId}</div>
              </div>
              <div>
                <Label>Course Name</Label>
                <div className="text-sm font-medium">{editCourseName}</div>
              </div>
              <div>
                <Label>Academic Year / Semester</Label>
                <Select value={editAySem} onChange={handleSelectEditAySemChange}>
                  {academicYearList.map((item) => <option key={item.ay_sem} value={item.ay_sem}>{item.ay_sem}</option>)}
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Passing Status</Label>
                <ToggleSwitch checked={editPass} label={editPass ? "Passed" : "Failed"} onChange={setEditPass} />
              </div>
            </div>
          </ModalBody>
          <ModalFooter className="flex justify-between">
            <ButtonGroup>
              <Button color="yellow" onClick={() => { setOpenEditModal(false); setOpenArchiveSingleModal(true); }}>Archive</Button>
              <Button color="red" onClick={() => { setOpenEditModal(false); setOpenDeleteModal(true); }}>Delete</Button>
            </ButtonGroup>
            <div className="flex gap-2">
              <Button disabled={isEditFormInvalid} onClick={() => void handleFcceUpdate()}>Save Changes</Button>
              <Button color="alternative" onClick={handleCloseModals}>Cancel</Button>
            </div>
          </ModalFooter>
        </Modal>

        {/* Confirmation Modals */}
        <Modal show={openArchiveSingleModal} onClose={handleCloseModals} size="md">
          <ModalHeader>Confirm Archive</ModalHeader>
          <ModalBody className="text-center">Are you sure you want to archive this record?</ModalBody>
          <ModalFooter className="justify-center">
            <Button color="yellow" onClick={() => void handleArchiveSingleFcce()}>Yes, Archive</Button>
            <Button color="alternative" onClick={handleCloseModals}>Cancel</Button>
          </ModalFooter>
        </Modal>

        <Modal show={openDeleteModal} onClose={handleCloseModals} size="md">
          <ModalHeader>Confirm Delete</ModalHeader>
          <ModalBody className="text-center">Are you sure you want to delete this record permanently?</ModalBody>
          <ModalFooter className="justify-center">
            <Button color="red" onClick={() => void handleDeleteFcce()}>Yes, Delete</Button>
            <Button color="alternative" onClick={handleCloseModals}>Close</Button>
          </ModalFooter>
        </Modal>

        <Modal show={openUnarchiveModal} onClose={handleCloseModals} size="md">
          <ModalHeader>Confirm Unarchive</ModalHeader>
          <ModalBody className="text-center">Are you sure you want to restore this record?</ModalBody>
          <ModalFooter className="justify-center">
            <Button color="green" onClick={() => void handleUnarchiveFcce()}>Yes, Restore</Button>
            <Button color="alternative" onClick={handleCloseModals}>Cancel</Button>
          </ModalFooter>
        </Modal>

        <Modal show={openArchiveAllModal} onClose={handleCloseModals} size="md">
          <ModalHeader>Confirm Archive All Active</ModalHeader>
          <ModalBody className="text-center">Are you sure you want to archive all active FCCE records?</ModalBody>
          <ModalFooter className="justify-center">
            <Button color="yellow" onClick={() => void handleArchiveAllActive()}>Yes, Archive All</Button>
            <Button color="alternative" onClick={handleCloseModals}>Cancel</Button>
          </ModalFooter>
        </Modal>
      </>
  );
}