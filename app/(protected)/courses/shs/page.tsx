"use client";

import {
  Button,
  Card,
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
  FileInput,
} from "flowbite-react";
import {
  FaPlus,
  FaSortDown,
  FaSortUp,
  FaTrash,
  FaFileExcel,
  FaFileImport,
  FaFileExport,
  FaDownload,
} from "react-icons/fa6";
import { HiCheck, HiExclamation, HiX, HiSearch } from "react-icons/hi";
import { useEffect, useState, useCallback, useRef } from "react";
import { useMsal } from "@azure/msal-react";
import ExcelJS from "exceljs";
import {
  filterAlphanumericDashUnderscore,
  filterAlphanumericDashUnderscoreComma,
  filterNumeric,
} from "@/utils/validation";
import {
  fetchPrograms,
  fetchProgramsCount,
  createProgram,
  updateProgram,
  deleteProgram,
  ProgramRecord,
  ProgramInput,
} from "@/app/actions/system";

export interface CollegeYearLevelDistribution {
  "1"?: number;
  "2"?: number;
  "3"?: number;
  "4"?: number;
  [key: string]: unknown;
}

export interface CollegeProgram {
  program_code: string;
  program_name: string | null;
  students: CollegeYearLevelDistribution | null;
  created_at?: string;
  updated_at?: string;
}

const REQUIRED_HEADERS = [
  "Program Code",
  "Program Name",
  "1st Year Count",
  "2nd Year Count",
  "3rd Year Count",
  "4th Year Count",
];

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

export default function CollegeProgramsManagement() {
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];
  const activeUser = activeAccount?.username || "system";
  const [isLoading, setLoading] = useState(false);

  // --- Table & Filter States --- //
  const [programs, setPrograms] = useState<CollegeProgram[]>([]);
  const [programsCount, setProgramsCount] = useState(0);
  const [sortProgramsBy, setSortProgramsBy] = useState("program_code");
  const [sortProgramsDir, setSortProgramsDir] = useState<"ASC" | "DESC">("ASC");
  const [searchTerm, setSearchTerm] = useState("");

  // --- Modal Visibility States --- //
  const [openAddProgramModal, setOpenAddProgramModal] = useState(false);
  const [openEditProgramModal, setOpenEditProgramModal] = useState(false);
  const [openDeleteProgramModal, setOpenDeleteProgramModal] = useState(false);
  const [openExcelModal, setOpenExcelModal] = useState(false);

  // Excel Operations States
  const [activeExcelTab, setActiveExcelTab] = useState<"import" | "export" | "template">("import");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [formatError, setFormatError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Form & Selection States --- //
  const [selectedProgramCode, setSelectedProgramCode] = useState("");

  // Add State
  const [inputProgramCode, setInputProgramCode] = useState("");
  const [inputProgramName, setInputProgramName] = useState("");
  const [inputYear1Count, setInputYear1Count] = useState<number | "">(0);
  const [inputYear2Count, setInputYear2Count] = useState<number | "">(0);
  const [inputYear3Count, setInputYear3Count] = useState<number | "">(0);
  const [inputYear4Count, setInputYear4Count] = useState<number | "">(0);

  // Update State
  const [editProgramName, setEditProgramName] = useState("");
  const [editYear1Count, setEditYear1Count] = useState<number | "">(0);
  const [editYear2Count, setEditYear2Count] = useState<number | "">(0);
  const [editYear3Count, setEditYear3Count] = useState<number | "">(0);
  const [editYear4Count, setEditYear4Count] = useState<number | "">(0);

  // Baseline Comparison State for Edit Form
  const [baseProgramName, setBaseProgramName] = useState("");
  const [baseYear1Count, setBaseYear1Count] = useState<number | "">(0);
  const [baseYear2Count, setBaseYear2Count] = useState<number | "">(0);
  const [baseYear3Count, setBaseYear3Count] = useState<number | "">(0);
  const [baseYear4Count, setBaseYear4Count] = useState<number | "">(0);

  // Validation States
  const [programCodeError, setProgramCodeError] = useState("");

  // --- Pagination States --- //
  const maxRowPrograms = 10;
  const [currentProgramPage, setCurrentProgramPage] = useState(1);
  const [pageChangingPrograms, setPageChangingPrograms] = useState(false);

  // --- Toast States --- //
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState<"success" | "warning" | "error" | "">("");
  const [toastMessage, setToastMessage] = useState("");
  const [showToastTimer, setShowToastTimer] = useState(false);
  const [progress, setProgress] = useState(0);

  /***********************
   * INPUT VALIDATION *
   ***********************/

  const handleProgramCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.slice(0, 13);
    const val = filterAlphanumericDashUnderscore(rawVal);
    setInputProgramCode(val);
    if (val.trim()) {
      setProgramCodeError("");
    } else {
      setProgramCodeError("Program code is required.");
    }
  };

  const handleProgramNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.slice(0, 100);
    const val = filterAlphanumericDashUnderscoreComma(rawVal);
    setInputProgramName(val);
  };

  const handleEditProgramNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.slice(0, 100);
    const val = filterAlphanumericDashUnderscoreComma(rawVal);
    setEditProgramName(val);
  };

  const clampStudentCount = (val: string): number | "" => {
    if (val === "") return "";
    const parsed = parseInt(val, 10);
    if (isNaN(parsed)) return 0;
    return Math.min(1000, Math.max(0, parsed));
  };

  /***********************
   * HELPER UTILITIES *
   ***********************/

  const parseStudentsJSON = (students: unknown): CollegeYearLevelDistribution => {
    if (!students) return { "1": 0, "2": 0, "3": 0, "4": 0 };
    if (typeof students === "string") {
      try {
        return JSON.parse(students);
      } catch {
        return { "1": 0, "2": 0, "3": 0, "4": 0 };
      }
    }
    return students as CollegeYearLevelDistribution;
  };

  const getTotalStudents = (students: CollegeYearLevelDistribution | null): number => {
    if (!students) return 0;
    const parsed = parseStudentsJSON(students);
    const y1 = parsed["1"] ?? 0;
    const y2 = parsed["2"] ?? 0;
    const y3 = parsed["3"] ?? 0;
    const y4 = parsed["4"] ?? 0;
    return (Number(y1) || 0) + (Number(y2) || 0) + (Number(y3) || 0) + (Number(y4) || 0);
  };

  /***********************
   * EXCEL OPERATIONS *
   ***********************/

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
    const worksheet = workbook.addWorksheet("College Programs") as WorksheetWithValidation;

    worksheet.columns = [
      { header: "Program Code", key: "program_code", width: 15 },
      { header: "Program Name", key: "program_name", width: 45 },
      { header: "1st Year Count", key: "year_1", width: 18 },
      { header: "2nd Year Count", key: "year_2", width: 18 },
      { header: "3rd Year Count", key: "year_3", width: 18 },
      { header: "4th Year Count", key: "year_4", width: 18 },
    ];

    worksheet.addRow({
      program_code: "BSIT",
      program_name: "Bachelor of Science in Information Technology",
      year_1: 120,
      year_2: 110,
      year_3: 95,
      year_4: 85,
    });

    worksheet.dataValidations.add("C2:F1000", {
      type: "whole",
      operator: "between",
      allowBlank: false,
      formulae: [0, 1000],
      showErrorMessage: true,
      errorTitle: "Invalid Student Count",
      error: "Please enter a whole number between 0 and 1,000.",
    });

    const buffer = await workbook.xlsx.writeBuffer();
    downloadWorkbook(buffer, "College_Programs_Template.xlsx");
    triggerToast("success", "Blank Excel template downloaded successfully!");
  }, []);

  const handleExportExcel = useCallback(async () => {
    try {
      const response = await fetchPrograms(searchTerm || null, "tertiary", sortProgramsBy, sortProgramsDir, 10000, 1);
      const exportList = response.success && Array.isArray(response.data) ? response.data : [];

      if (exportList.length === 0) {
        triggerToast("warning", "No college program records available to export.");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("College Programs Export") as WorksheetWithValidation;

      worksheet.columns = [
        { header: "Program Code", key: "program_code", width: 15 },
        { header: "Program Name", key: "program_name", width: 45 },
        { header: "1st Year Count", key: "year_1", width: 18 },
        { header: "2nd Year Count", key: "year_2", width: 18 },
        { header: "3rd Year Count", key: "year_3", width: 18 },
        { header: "4th Year Count", key: "year_4", width: 18 },
      ];

      exportList.forEach((item: ProgramRecord) => {
        const students = parseStudentsJSON(item.students);
        worksheet.addRow({
          program_code: item.program_code || "",
          program_name: item.program_name || "",
          year_1: students["1"] ?? 0,
          year_2: students["2"] ?? 0,
          year_3: students["3"] ?? 0,
          year_4: students["4"] ?? 0,
        });
      });

      worksheet.dataValidations.add("C2:F1000", {
        type: "whole",
        operator: "between",
        allowBlank: false,
        formulae: [0, 1000],
      });

      const buffer = await workbook.xlsx.writeBuffer();
      downloadWorkbook(buffer, `College_Programs_Export_${new Date().toISOString().split("T")[0]}.xlsx`);
      triggerToast("success", "College programs exported to Excel successfully");
    } catch (err) {
      console.error(err);
      triggerToast("error", "Failed to export records to Excel");
    }
  }, [searchTerm, sortProgramsBy, sortProgramsDir]);

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

      setImportLogs((prev) => [...prev, `Headers verified. Processing rows with clamping validation...`]);

      let successCount = 0;
      let failCount = 0;
      const logs: string[] = [];

      const headerIndexMap: Record<string, number> = {};
      headerRow.eachCell((cell, colNumber) => {
        if (cell.value) {
          headerIndexMap[String(cell.value).trim().toLowerCase()] = colNumber;
        }
      });

      const codeCol = headerIndexMap["program code"] || 1;
      const nameCol = headerIndexMap["program name"] || 2;
      const y1Col = headerIndexMap["1st year count"] || 3;
      const y2Col = headerIndexMap["2nd year count"] || 4;
      const y3Col = headerIndexMap["3rd year count"] || 5;
      const y4Col = headerIndexMap["4th year count"] || 6;

      const rowsToProcess: {
        rowNum: number;
        code: string;
        name: string;
        y1: number;
        y2: number;
        y3: number;
        y4: number;
      }[] = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rawCode = String(row.getCell(codeCol).value || "").trim();
        const rawName = String(row.getCell(nameCol).value || "").trim();
        const rawY1 = Number(row.getCell(y1Col).value) || 0;
        const rawY2 = Number(row.getCell(y2Col).value) || 0;
        const rawY3 = Number(row.getCell(y3Col).value) || 0;
        const rawY4 = Number(row.getCell(y4Col).value) || 0;

        if (!rawCode) {
          logs.push(`Row ${rowNumber}: Skipped. Program Code is missing.`);
          failCount++;
          return;
        }

        // Apply system clampStudentCount logic (0 - 1000)
        const clampedY1 = Math.min(1000, Math.max(0, rawY1));
        const clampedY2 = Math.min(1000, Math.max(0, rawY2));
        const clampedY3 = Math.min(1000, Math.max(0, rawY3));
        const clampedY4 = Math.min(1000, Math.max(0, rawY4));

        rowsToProcess.push({
          rowNum: rowNumber,
          code: rawCode,
          name: rawName,
          y1: clampedY1,
          y2: clampedY2,
          y3: clampedY3,
          y4: clampedY4,
        });
      });

      for (const item of rowsToProcess) {
        const payload: ProgramInput = {
          program_code: item.code,
          program_name: item.name || undefined,
          year_level: "tertiary",
          students: {
            "1": item.y1,
            "2": item.y2,
            "3": item.y3,
            "4": item.y4,
          },
        };

        const res = await createProgram(activeUser, payload);
        if (res.success) {
          successCount++;
        } else {
          logs.push(`Row ${item.rowNum} (${item.code}): ${res.error || "Creation failed."}`);
          failCount++;
        }
      }

      setImportLogs((prev) => [
        ...prev,
        `Import Completed: ${successCount} successful, ${failCount} failed.`,
        ...logs,
      ]);

      if (successCount > 0) {
        triggerToast("success", `Imported ${successCount} college program records successfully.`);
        getCollegePrograms(searchTerm, sortProgramsBy, sortProgramsDir, maxRowPrograms, currentProgramPage);
      }
    } catch (err) {
      console.error(err);
      setFormatError("Error: Unable to parse Excel workbook format using ExcelJS.");
    } finally {
      setIsImporting(false);
    }
  }, [importFile, activeUser, searchTerm, sortProgramsBy, sortProgramsDir, maxRowPrograms, currentProgramPage]);

  /***********************
   * TABLE & FORM EVENTS *
   ***********************/

  const handleProgramSorting = (sortBy: string) => {
    const newDir = sortBy === sortProgramsBy && sortProgramsDir === "ASC" ? "DESC" : "ASC";
    setSortProgramsBy(sortBy);
    setSortProgramsDir(newDir);
    setPrograms([]);
    setCurrentProgramPage(1);
    getCollegePrograms(searchTerm, sortBy, newDir, maxRowPrograms, 1);
  };

  const onPageChangePrograms = (page: number) => {
    if (pageChangingPrograms) return;
    setPageChangingPrograms(true);
    setPrograms([]);
    getCollegePrograms(searchTerm, sortProgramsBy, sortProgramsDir, maxRowPrograms, page);
    setPageChangingPrograms(false);
    setCurrentProgramPage(page);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentProgramPage(1);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setCurrentProgramPage(1);
  };

  const loadEditData = (program_code: string) => {
    setSelectedProgramCode(program_code);
    const selected = programs.find((item) => item.program_code === program_code);

    if (selected) {
      const parsed = parseStudentsJSON(selected.students);
      const y1 = parsed["1"] ?? 0;
      const y2 = parsed["2"] ?? 0;
      const y3 = parsed["3"] ?? 0;
      const y4 = parsed["4"] ?? 0;

      setBaseProgramName(selected.program_name ?? "");
      setBaseYear1Count(y1);
      setBaseYear2Count(y2);
      setBaseYear3Count(y3);
      setBaseYear4Count(y4);

      setEditProgramName(selected.program_name ?? "");
      setEditYear1Count(y1);
      setEditYear2Count(y2);
      setEditYear3Count(y3);
      setEditYear4Count(y4);

      setOpenEditProgramModal(true);
    }
  };

  const handleCloseProgramModals = () => {
    setSelectedProgramCode("");
    setProgramCodeError("");
    setOpenAddProgramModal(false);
    setOpenEditProgramModal(false);
    setOpenDeleteProgramModal(false);
    setOpenExcelModal(false);

    setInputProgramCode("");
    setInputProgramName("");
    setInputYear1Count(0);
    setInputYear2Count(0);
    setInputYear3Count(0);
    setInputYear4Count(0);

    setEditProgramName("");
    setEditYear1Count(0);
    setEditYear2Count(0);
    setEditYear3Count(0);
    setEditYear4Count(0);

    setImportFile(null);
    setImportLogs([]);
    setFormatError("");
    setIsImporting(false);
  };

  /**********************
   * INTEGRATED CRUD LOGIC *
   **********************/

  async function getCollegePrograms(
    search: string | null = searchTerm,
    sortby: string = sortProgramsBy,
    sortdir: "ASC" | "DESC" = sortProgramsDir,
    limit: number = maxRowPrograms,
    page: number = currentProgramPage
  ) {
    setLoading(true);

    const [dataRes, countRes] = await Promise.all([
      fetchPrograms(search, "tertiary", sortby, sortdir, limit, page),
      fetchProgramsCount(search, "tertiary"),
    ]);

    if (dataRes.success && Array.isArray(dataRes.data)) {
      const mappedPrograms: CollegeProgram[] = dataRes.data.map((item: ProgramRecord) => ({
        program_code: item.program_code,
        program_name: item.program_name,
        students: parseStudentsJSON(item.students),
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));

      setPrograms(mappedPrograms);
    } else {
      triggerToast("error", dataRes.error || "Failed to fetch college programs.");
      setPrograms([]);
    }

    if (countRes.success) {
      setProgramsCount(countRes.count);
    } else {
      setProgramsCount(0);
    }

    setLoading(false);
  }

  async function handleProgramSubmit() {
    if (!inputProgramCode.trim()) {
      setProgramCodeError("Program code is required.");
      return;
    }

    const payload: ProgramInput = {
      program_code: inputProgramCode.trim(),
      program_name: inputProgramName.trim() || undefined,
      year_level: "tertiary",
      students: {
        "1": Number(inputYear1Count) || 0,
        "2": Number(inputYear2Count) || 0,
        "3": Number(inputYear3Count) || 0,
        "4": Number(inputYear4Count) || 0,
      },
    };

    const res = await createProgram(activeUser, payload);

    if (res.success) {
      triggerToast("success", `College Program "${inputProgramCode}" created successfully.`);
      handleCloseProgramModals();
      getCollegePrograms(searchTerm, sortProgramsBy, sortProgramsDir, maxRowPrograms, currentProgramPage);
    } else {
      triggerToast("error", res.error || "Failed to create college program.");
    }
  }

  async function handleProgramUpdate() {
    const payload = {
      program_name: editProgramName.trim() || undefined,
      year_level: "tertiary",
      students: {
        "1": Number(editYear1Count) || 0,
        "2": Number(editYear2Count) || 0,
        "3": Number(editYear3Count) || 0,
        "4": Number(editYear4Count) || 0,
      },
    };

    const res = await updateProgram(activeUser, selectedProgramCode, payload);

    if (res.success) {
      triggerToast("success", `College Program "${selectedProgramCode}" updated successfully.`);
      handleCloseProgramModals();
      getCollegePrograms(searchTerm, sortProgramsBy, sortProgramsDir, maxRowPrograms, currentProgramPage);
    } else {
      triggerToast("error", res.error || "Failed to update college program.");
    }
  }

  async function handleProgramDelete() {
    const res = await deleteProgram(activeUser, selectedProgramCode);

    if (res.success) {
      triggerToast("success", `College Program "${selectedProgramCode}" deleted successfully.`);
      handleCloseProgramModals();
      getCollegePrograms(searchTerm, sortProgramsBy, sortProgramsDir, maxRowPrograms, currentProgramPage);
    } else {
      triggerToast("error", res.error || "Failed to delete college program.");
    }
  }

  /*******************
   * TOAST UTILITIES *
   *******************/

  function triggerToast(type: "success" | "warning" | "error", message: string) {
    setToastType(type);
    setToastMessage(message);
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
    const delayDebounceFn = setTimeout(() => {
      void getCollegePrograms(searchTerm, sortProgramsBy, sortProgramsDir, maxRowPrograms, currentProgramPage);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  useEffect(() => {
    document.title = "AceHub | Programs";
  }, []);

  return (
    <>
      {/* --- Toast --- */}
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

      <div className={"m-8"}>
        {/* --- Header Section with Search & Add Button --- */}
        <div className="mb-4 flex-col justify-between gap-4 md:flex md:flex-row md:items-center">
          <div>
            <h2 className="mb-1 text-lg font-bold">College Programs Management</h2>
            <p className="text-gray-500">
              Manage college degree programs and student counts per year level (1st - 4th Year).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full md:w-64">
              <TextInput
                id="search-college-programs"
                type="text"
                placeholder="Search code, program name..."
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

            <Button
              color="gray"
              className="whitespace-nowrap"
              onClick={() => setOpenExcelModal(true)}
            >
              <FaFileExcel className="mr-2 h-4 w-4 text-green-600" />
              Excel Operations
            </Button>

            <Button
              className="whitespace-nowrap"
              onClick={() => setOpenAddProgramModal(true)}
            >
              <FaPlus className="mr-2" />
              Add Program
            </Button>
          </div>
        </div>

        {/* --- Main College Programs Table --- */}
        <Card className="overflow-x-auto">
          <Table hoverable>
            <TableHead>
              <TableRow>
                <TableHeadCell onClick={() => handleProgramSorting("program_code")}>
                  <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                    Program Code
                    {sortProgramsBy === "program_code" && (
                      sortProgramsDir === "ASC" ? <FaSortUp className="ml-1" /> : <FaSortDown className="ml-1" />
                    )}
                  </div>
                </TableHeadCell>

                <TableHeadCell onClick={() => handleProgramSorting("program_name")}>
                  <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                    Program Name
                    {sortProgramsBy === "program_name" && (
                      sortProgramsDir === "ASC" ? <FaSortUp className="ml-1" /> : <FaSortDown className="ml-1" />
                    )}
                  </div>
                </TableHeadCell>

                <TableHeadCell>Student Distribution (1st - 4th Year)</TableHeadCell>

                <TableHeadCell>Total Students</TableHeadCell>

                <TableHeadCell>
                  <span className="sr-only">Edit</span>
                </TableHeadCell>
              </TableRow>
            </TableHead>

            <TableBody className="divide-y">
              {programs.length > 0 ? (
                programs.map((item) => {
                  const total = getTotalStudents(item.students);
                  const st = parseStudentsJSON(item.students);
                  return (
                    <TableRow
                      key={item.program_code}
                      className="bg-white dark:border-gray-700 dark:bg-gray-800"
                    >
                      <TableCell className="font-medium whitespace-nowrap">
                        {item.program_code}
                      </TableCell>
                      <TableCell>{item.program_name || "—"}</TableCell>
                      <TableCell>
                        <span className="text-xs">
                          1st Yr: <strong>{st["1"] ?? 0}</strong> | 2nd Yr:{" "}
                          <strong>{st["2"] ?? 0}</strong> | 3rd Yr:{" "}
                          <strong>{st["3"] ?? 0}</strong> | 4th Yr:{" "}
                          <strong>{st["4"] ?? 0}</strong>
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold">{total}</TableCell>
                      <TableCell>
                        <a
                          onClick={() => loadEditData(item.program_code)}
                          className="text-primary-600 dark:text-primary-500 cursor-pointer font-medium hover:underline"
                        >
                          Edit
                        </a>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : isLoading ? (
                <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                  <TableCell
                    colSpan={5}
                    className="py-6 text-center text-sm text-gray-500 italic dark:text-gray-400"
                  >
                    <div className="flex items-center justify-center">
                      <Spinner />
                      <span className="ml-4">fetching data...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                  <TableCell
                    colSpan={5}
                    className="py-6 text-center text-sm text-gray-500 italic dark:text-gray-400"
                  >
                    {searchTerm
                      ? `No college programs matching "${searchTerm}" found.`
                      : "No college program entries found yet."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        {/* --- Pagination --- */}
        <div
          className={`mt-4 ${isLoading ? "pointer-events-none opacity-50 [&_a]:cursor-not-allowed [&_button]:cursor-not-allowed" : ""} flex w-full justify-center`}
        >
          <Pagination
            layout="table"
            currentPage={currentProgramPage || 1}
            itemsPerPage={maxRowPrograms}
            totalItems={programsCount || 1}
            onPageChange={onPageChangePrograms}
            showIcons
          />
        </div>
      </div>

      {/* --- MODAL: EXCEL OPERATIONS --- */}
      <Modal show={openExcelModal} onClose={handleCloseProgramModals} size="lg">
        <ModalHeader>
          <div className="flex items-center gap-2">
            <FaFileExcel className="h-5 w-5 text-green-600" />
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
                  <span className="font-semibold uppercase tracking-wide">Required Format Headers:</span> {REQUIRED_HEADERS.join(", ")} (Year level counts clamped between 0 and 1,000).
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
                            : log.includes("Completed") || log.includes("Verified")
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
                    Export Filtered College Programs
                  </h4>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Generates a standardized Excel spreadsheet containing all active query results with integer validation rules.
                  </p>
                </div>
                <Button onClick={handleExportExcel} className="w-full" color="green">
                  <FaFileExport className="mr-2 h-4 w-4" /> Export {programsCount} Records to Excel
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
                    Includes columns formatted as: <b className="font-mono">{REQUIRED_HEADERS.join(", ")}</b> with built-in whole number validation (0–1,000).
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
          <Button color="alternative" onClick={handleCloseProgramModals}>
            Close Window
          </Button>
        </ModalFooter>
      </Modal>

      {/* --- Add College Program Modal --- */}
      <Modal show={openAddProgramModal} onClose={handleCloseProgramModals}>
        <ModalHeader>Add College Program</ModalHeader>
        <ModalBody>
          <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label htmlFor="program_code">Program Code *</Label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {inputProgramCode.length} / 13
                </span>
              </div>
              <TextInput
                id="program_code"
                placeholder="e.g. BSIT"
                maxLength={13}
                value={inputProgramCode}
                onChange={handleProgramCodeChange}
                color={programCodeError ? "failure" : "gray"}
                required
              />
              {programCodeError && (
                <p className="mt-1 text-sm font-medium text-red-600">{programCodeError}</p>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label htmlFor="program_name">Program Name</Label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {inputProgramName.length} / 100
                </span>
              </div>
              <TextInput
                id="program_name"
                placeholder="e.g. Bachelor of Science in Information Technology"
                maxLength={100}
                value={inputProgramName}
                onChange={handleProgramNameChange}
              />
            </div>

            <div>
              <div className="mb-2 block">
                <Label>Student Distribution by Year Level (Max 1,000 per year)</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="input_year_1" className="text-xs">
                    1st Year Students
                  </Label>
                  <TextInput
                    id="input_year_1"
                    type="text"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={inputYear1Count}
                    onChange={(e) =>
                      setInputYear1Count(clampStudentCount(filterNumeric(e.target.value)))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="input_year_2" className="text-xs">
                    2nd Year Students
                  </Label>
                  <TextInput
                    id="input_year_2"
                    type="text"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={inputYear2Count}
                    onChange={(e) =>
                      setInputYear2Count(clampStudentCount(filterNumeric(e.target.value)))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="input_year_3" className="text-xs">
                    3rd Year Students
                  </Label>
                  <TextInput
                    id="input_year_3"
                    type="text"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={inputYear3Count}
                    onChange={(e) =>
                      setInputYear3Count(clampStudentCount(filterNumeric(e.target.value)))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="input_year_4" className="text-xs">
                    4th Year Students
                  </Label>
                  <TextInput
                    id="input_year_4"
                    type="text"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={inputYear4Count}
                    onChange={(e) =>
                      setInputYear4Count(clampStudentCount(filterNumeric(e.target.value)))
                    }
                  />
                </div>
              </div>
            </div>
          </form>
        </ModalBody>
        <ModalFooter>
          <Button onClick={handleProgramSubmit} disabled={!inputProgramCode.trim()}>
            Save
          </Button>
          <Button color="alternative" onClick={handleCloseProgramModals}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* --- Edit College Program Modal --- */}
      <Modal show={openEditProgramModal} onClose={handleCloseProgramModals}>
        <ModalHeader>Edit College Program ({selectedProgramCode})</ModalHeader>
        <ModalBody>
          <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label htmlFor="edit_program_name">Program Name</Label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {editProgramName.length} / 100
                </span>
              </div>
              <TextInput
                id="edit_program_name"
                maxLength={100}
                value={editProgramName}
                onChange={handleEditProgramNameChange}
              />
            </div>

            <div>
              <div className="mb-2 block">
                <Label>Student Distribution by Year Level (Max 1,000 per year)</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit_year_1" className="text-xs">
                    1st Year Students
                  </Label>
                  <TextInput
                    id="edit_year_1"
                    type="text"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={editYear1Count}
                    onChange={(e) =>
                      setEditYear1Count(clampStudentCount(filterNumeric(e.target.value)))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit_year_2" className="text-xs">
                    2nd Year Students
                  </Label>
                  <TextInput
                    id="edit_year_2"
                    type="text"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={editYear2Count}
                    onChange={(e) =>
                      setEditYear2Count(clampStudentCount(filterNumeric(e.target.value)))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit_year_3" className="text-xs">
                    3rd Year Students
                  </Label>
                  <TextInput
                    id="edit_year_3"
                    type="text"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={editYear3Count}
                    onChange={(e) =>
                      setEditYear3Count(clampStudentCount(filterNumeric(e.target.value)))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit_year_4" className="text-xs">
                    4th Year Students
                  </Label>
                  <TextInput
                    id="edit_year_4"
                    type="text"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={editYear4Count}
                    onChange={(e) =>
                      setEditYear4Count(clampStudentCount(filterNumeric(e.target.value)))
                    }
                  />
                </div>
              </div>
            </div>
          </form>
        </ModalBody>
        <ModalFooter className="flex w-full justify-between">
          <div className="flex gap-4">
            <Button
              onClick={handleProgramUpdate}
              disabled={
                baseProgramName === editProgramName.trim() &&
                baseYear1Count === editYear1Count &&
                baseYear2Count === editYear2Count &&
                baseYear3Count === editYear3Count &&
                baseYear4Count === editYear4Count
              }
            >
              Save
            </Button>
            <Button color="alternative" onClick={handleCloseProgramModals}>
              Cancel
            </Button>
          </div>
          <Button color="red" onClick={() => setOpenDeleteProgramModal(true)}>
            <FaTrash />
          </Button>
        </ModalFooter>
      </Modal>

      {/* --- Delete Confirmation Modal --- */}
      <Modal
        show={openDeleteProgramModal}
        size="md"
        onClose={() => setOpenDeleteProgramModal(false)}
        popup
      >
        <ModalHeader />
        <ModalBody>
          <div className="text-center">
            <FaTrash className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
            <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
              Are you sure you want to delete program &quot;{selectedProgramCode}&quot;?
            </h3>
            <div className="flex justify-center gap-4">
              <Button color="red" onClick={handleProgramDelete}>
                Yes, I&#39;m sure
              </Button>
              <Button
                color="alternative"
                onClick={() => setOpenDeleteProgramModal(false)}
              >
                No, cancel
              </Button>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
}