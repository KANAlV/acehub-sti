"use client";

import {
  Button,
  Card,
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
  FileInput,
} from "flowbite-react";
import TablePaginationFooter from "@/components/TablePaginationFooter";
import ImportResultsPanel from "@/components/ImportResultsPanel";
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

export interface SHSYearLevelDistribution {
  "11"?: number;
  "12"?: number;
  [key: string]: unknown;
}

export interface SHSProgram {
  program_code: string;
  program_name: string | null;
  students: SHSYearLevelDistribution | null;
  created_at?: string;
  updated_at?: string;
}

const REQUIRED_HEADERS = [
  "Program Code",
  "Program Name",
  "Grade 11 Count",
  "Grade 12 Count",
];

// Strict year level constant — prevents cross-contamination with Tertiary imports
const YEAR_LEVEL = "shs";

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

export default function SHSProgramsManagement() {
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];
  const activeUser = activeAccount?.username || "system";
  const [isLoading, setLoading] = useState(true);

  // --- Table & Filter States --- //
  const [programs, setPrograms] = useState<SHSProgram[]>([]);
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
  const [inputGrade11Count, setInputGrade11Count] = useState<number | "">(0);
  const [inputGrade12Count, setInputGrade12Count] = useState<number | "">(0);

  // Update State
  const [editProgramName, setEditProgramName] = useState("");
  const [editGrade11Count, setEditGrade11Count] = useState<number | "">(0);
  const [editGrade12Count, setEditGrade12Count] = useState<number | "">(0);

  // Baseline Comparison State for Edit Form
  const [baseProgramName, setBaseProgramName] = useState("");
  const [baseGrade11Count, setBaseGrade11Count] = useState<number | "">(0);
  const [baseGrade12Count, setBaseGrade12Count] = useState<number | "">(0);

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
    return Math.min(500, Math.max(0, parsed));
  };

  /***********************
   * HELPER UTILITIES *
   ***********************/

  const parseStudentsJSON = (students: unknown): SHSYearLevelDistribution => {
    if (!students) return { "11": 0, "12": 0 };
    if (typeof students === "string") {
      try {
        return JSON.parse(students);
      } catch {
        return { "11": 0, "12": 0 };
      }
    }
    return students as SHSYearLevelDistribution;
  };

  const getTotalStudents = (students: SHSYearLevelDistribution | null): number => {
    if (!students) return 0;
    const parsed = parseStudentsJSON(students);
    const g11 = parsed["11"] ?? 0;
    const g12 = parsed["12"] ?? 0;
    return (Number(g11) || 0) + (Number(g12) || 0);
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
    const worksheet = workbook.addWorksheet("SHS Programs") as WorksheetWithValidation;

    worksheet.columns = [
      { header: "Program Code", key: "program_code", width: 15 },
      { header: "Program Name", key: "program_name", width: 45 },
      { header: "Grade 11 Count", key: "grade_11", width: 18 },
      { header: "Grade 12 Count", key: "grade_12", width: 18 },
    ];

    worksheet.addRow({
      program_code: "STEM",
      program_name: "Science, Technology, Engineering, and Mathematics",
      grade_11: 120,
      grade_12: 110,
    });

    worksheet.dataValidations.add("C2:D500", {
      type: "whole",
      operator: "between",
      allowBlank: false,
      formulae: [0, 500],
      showErrorMessage: true,
      errorTitle: "Invalid Student Count",
      error: "Please enter a whole number between 0 and 1,000.",
    });

    const buffer = await workbook.xlsx.writeBuffer();
    downloadWorkbook(buffer, "SHS_Programs_Template.xlsx");
    triggerToast("success", "Blank Excel template downloaded successfully!");
  }, []);

  const handleExportExcel = useCallback(async () => {
    try {
      const response = await fetchPrograms(searchTerm || null, YEAR_LEVEL, sortProgramsBy, sortProgramsDir, 10000, 1);
      const exportList = response.success && Array.isArray(response.data) ? response.data : [];

      if (exportList.length === 0) {
        triggerToast("warning", "No SHS program records available to export.");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("SHS Programs Export") as WorksheetWithValidation;

      worksheet.columns = [
        { header: "Program Code", key: "program_code", width: 15 },
        { header: "Program Name", key: "program_name", width: 45 },
        { header: "Grade 11 Count", key: "grade_11", width: 18 },
        { header: "Grade 12 Count", key: "grade_12", width: 18 },
      ];

      exportList.forEach((item: ProgramRecord) => {
        const students = parseStudentsJSON(item.students);
        worksheet.addRow({
          program_code: item.program_code || "",
          program_name: item.program_name || "",
          grade_11: students["11"] ?? 0,
          grade_12: students["12"] ?? 0,
        });
      });

      worksheet.dataValidations.add("C2:D500", {
        type: "whole",
        operator: "between",
        allowBlank: false,
        formulae: [0, 500],
      });

      const buffer = await workbook.xlsx.writeBuffer();
      downloadWorkbook(buffer, `SHS_Programs_Export_${new Date().toISOString().split("T")[0]}.xlsx`);
      triggerToast("success", "SHS programs exported to Excel successfully");
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
      const g11Col = headerIndexMap["grade 11 count"] || 3;
      const g12Col = headerIndexMap["grade 12 count"] || 4;

      const rowsToProcess: {
        rowNum: number;
        code: string;
        name: string;
        g11: number;
        g12: number;
      }[] = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rawCode = String(row.getCell(codeCol).value || "").trim();
        const rawName = String(row.getCell(nameCol).value || "").trim();
        const rawG11 = Number(row.getCell(g11Col).value) || 0;
        const rawG12 = Number(row.getCell(g12Col).value) || 0;

        if (!rawCode) {
          logs.push(`Row ${rowNumber}: Skipped. Program Code is missing.`);
          failCount++;
          return;
        }

        // Apply system clampStudentCount logic (0 - 500)
        const clampedG11 = Math.min(500, Math.max(0, rawG11));
        const clampedG12 = Math.min(500, Math.max(0, rawG12));

        rowsToProcess.push({
          rowNum: rowNumber,
          code: rawCode,
          name: rawName,
          g11: clampedG11,
          g12: clampedG12,
        });
      });

      for (const item of rowsToProcess) {
        const payload: ProgramInput = {
          program_code: item.code,
          program_name: item.name || undefined,
          year_level: YEAR_LEVEL,
          students: {
            "11": item.g11,
            "12": item.g12,
          },
        };

        // Validate that the imported record matches the expected year level
        if (payload.year_level !== YEAR_LEVEL) {
          logs.push(`Row ${item.rowNum} (${item.code}): Skipped. Year level mismatch — expected "${YEAR_LEVEL}".`);
          failCount++;
          continue;
        }

        const createRes = await createProgram(activeUser, payload);
        if (createRes.success) {
          successCount++;
          logs.push(`Row ${item.rowNum} (${item.code}): Imported successfully.`);
        } else {
          // If creation fails, try updating the existing program instead
          const updatePayload = {
            program_name: item.name || undefined,
            year_level: YEAR_LEVEL,
            students: {
              "11": item.g11,
              "12": item.g12,
            },
          };
          const updateRes = await updateProgram(activeUser, item.code, updatePayload);
          if (updateRes.success) {
            successCount++;
            logs.push(`Row ${item.rowNum} (${item.code}): Updated existing program.`);
          } else {
            logs.push(`Row ${item.rowNum} (${item.code}): ${createRes.error || "Creation failed."}`);
            failCount++;
          }
        }
      }

      logs.unshift(`${rowsToProcess.length} row(s) ready to import.`);
      setImportLogs((prev) => [
        ...prev,
        `Import Completed: ${successCount} successful, ${failCount} failed.`,
        ...logs,
      ]);

      if (successCount > 0) {
        triggerToast("success", `Imported ${successCount} SHS program records successfully.`);
        getSHSPrograms(searchTerm, sortProgramsBy, sortProgramsDir, maxRowPrograms, currentProgramPage);
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
    getSHSPrograms(searchTerm, sortBy, newDir, maxRowPrograms, 1);
  };

  const onPageChangePrograms = (page: number) => {
    if (pageChangingPrograms) return;
    setPageChangingPrograms(true);
    setPrograms([]);
    getSHSPrograms(searchTerm, sortProgramsBy, sortProgramsDir, maxRowPrograms, page);
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
      const g11 = parsed["11"] ?? 0;
      const g12 = parsed["12"] ?? 0;

      setBaseProgramName(selected.program_name ?? "");
      setBaseGrade11Count(g11);
      setBaseGrade12Count(g12);

      setEditProgramName(selected.program_name ?? "");
      setEditGrade11Count(g11);
      setEditGrade12Count(g12);

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
    setInputGrade11Count(0);
    setInputGrade12Count(0);

    setEditProgramName("");
    setEditGrade11Count(0);
    setEditGrade12Count(0);

    setImportFile(null);
    setImportLogs([]);
    setFormatError("");
    setIsImporting(false);
  };

  /**********************
   * INTEGRATED CRUD LOGIC *
   **********************/

  async function getSHSPrograms(
    search: string | null = searchTerm,
    sortby: string = sortProgramsBy,
    sortdir: "ASC" | "DESC" = sortProgramsDir,
    limit: number = maxRowPrograms,
    page: number = currentProgramPage
  ) {
    setLoading(true);

    const [dataRes, countRes] = await Promise.all([
      fetchPrograms(search, YEAR_LEVEL, sortby, sortdir, limit, page),
      fetchProgramsCount(search, YEAR_LEVEL),
    ]);

    if (dataRes.success && Array.isArray(dataRes.data)) {
      const mappedPrograms: SHSProgram[] = dataRes.data.map((item: ProgramRecord) => ({
        program_code: item.program_code,
        program_name: item.program_name,
        students: parseStudentsJSON(item.students),
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));

      setPrograms(mappedPrograms);
    } else {
      triggerToast("error", dataRes.error || "Failed to fetch SHS programs.");
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
      year_level: YEAR_LEVEL,
      students: {
        "11": Number(inputGrade11Count) || 0,
        "12": Number(inputGrade12Count) || 0,
      },
    };

    const res = await createProgram(activeUser, payload);

    if (res.success) {
      triggerToast("success", `SHS Program "${inputProgramCode}" created successfully.`);
      handleCloseProgramModals();
      getSHSPrograms(searchTerm, sortProgramsBy, sortProgramsDir, maxRowPrograms, currentProgramPage);
    } else {
      triggerToast("error", res.error || "Failed to create SHS program.");
    }
  }

  async function handleProgramUpdate() {
    const payload = {
      program_name: editProgramName.trim() || undefined,
      year_level: YEAR_LEVEL,
      students: {
        "11": Number(editGrade11Count) || 0,
        "12": Number(editGrade12Count) || 0,
      },
    };

    const res = await updateProgram(activeUser, selectedProgramCode, payload);

    if (res.success) {
      triggerToast("success", `SHS Program "${selectedProgramCode}" updated successfully.`);
      handleCloseProgramModals();
      getSHSPrograms(searchTerm, sortProgramsBy, sortProgramsDir, maxRowPrograms, currentProgramPage);
    } else {
      triggerToast("error", res.error || "Failed to update SHS program.");
    }
  }

  async function handleProgramDelete() {
    const res = await deleteProgram(activeUser, selectedProgramCode);

    if (res.success) {
      triggerToast("success", `SHS Program "${selectedProgramCode}" deleted successfully.`);
      handleCloseProgramModals();
      getSHSPrograms(searchTerm, sortProgramsBy, sortProgramsDir, maxRowPrograms, currentProgramPage);
    } else {
      triggerToast("error", res.error || "Failed to delete SHS program.");
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
      void getSHSPrograms(searchTerm, sortProgramsBy, sortProgramsDir, maxRowPrograms, currentProgramPage);
    }, 1500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  useEffect(() => {
    document.title = "AceHub | SHS Programs";
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
        <div className="mb-4 space-y-4">
          <div>
            <h2 className="mb-1 text-lg font-bold">SHS Programs Management</h2>
            <p className="text-gray-500">
              Manage Senior High School programs and student counts per grade level (Grade 11 - Grade 12).
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-64">
              <TextInput
                id="search-shs-programs"
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

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                color="gray"
                className="w-full whitespace-nowrap sm:w-auto"
                onClick={() => setOpenExcelModal(true)}
              >
                <FaFileExcel className="mr-2 h-4 w-4 text-green-600" />
                Excel Operations
              </Button>

              <Button
                className="w-full whitespace-nowrap sm:w-auto"
                onClick={() => setOpenAddProgramModal(true)}
              >
                <FaPlus className="mr-2" />
                Add Program
              </Button>
            </div>
          </div>
        </div>

        {/* --- Main SHS Programs Table --- */}
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

                <TableHeadCell>Student Distribution (Grade 11 - Grade 12)</TableHeadCell>

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
                          Grade 11: <strong>{st["11"] ?? 0}</strong> | Grade 12:{" "}
                          <strong>{st["12"] ?? 0}</strong>
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
                      ? `No SHS programs matching "${searchTerm}" found.`
                      : "No SHS program entries found yet."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        {/* --- Pagination --- */}
        <TablePaginationFooter
          className="mt-4"
          currentPage={currentProgramPage || 1}
          pageSize={maxRowPrograms}
          totalCount={programsCount}
          onPageChange={onPageChangePrograms}
          isLoading={isLoading}
        />
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

                <ImportResultsPanel logs={importLogs} ariaLabel="SHS program import summary and results" />

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
                    Export Filtered SHS Programs
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

      {/* --- Add SHS Program Modal --- */}
      <Modal show={openAddProgramModal} onClose={handleCloseProgramModals}>
        <ModalHeader>Add SHS Program</ModalHeader>
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
                placeholder="e.g. STEM"
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
                placeholder="e.g. Science, Technology, Engineering, and Mathematics"
                maxLength={100}
                value={inputProgramName}
                onChange={handleProgramNameChange}
              />
            </div>

            <div>
              <div className="mb-2 block">
                <Label>Student Distribution by Grade Level (Max 500 per grade)</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="input_grade_11" className="text-xs">
                    Grade 11 Students
                  </Label>
                  <TextInput
                    id="input_grade_11"
                    type="text"
                    min={0}
                    max={500}
                    placeholder="0"
                    value={inputGrade11Count}
                    onChange={(e) =>
                      setInputGrade11Count(clampStudentCount(filterNumeric(e.target.value)))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="input_grade_12" className="text-xs">
                    Grade 12 Students
                  </Label>
                  <TextInput
                    id="input_grade_12"
                    type="text"
                    min={0}
                    max={500}
                    placeholder="0"
                    value={inputGrade12Count}
                    onChange={(e) =>
                      setInputGrade12Count(clampStudentCount(filterNumeric(e.target.value)))
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

      {/* --- Edit SHS Program Modal --- */}
      <Modal show={openEditProgramModal} onClose={handleCloseProgramModals}>
        <ModalHeader>Edit SHS Program ({selectedProgramCode})</ModalHeader>
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
                <Label>Student Distribution by Grade Level (Max 500 per grade)</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit_grade_11" className="text-xs">
                    Grade 11 Students
                  </Label>
                  <TextInput
                    id="edit_grade_11"
                    type="text"
                    min={0}
                    max={500}
                    placeholder="0"
                    value={editGrade11Count}
                    onChange={(e) =>
                      setEditGrade11Count(clampStudentCount(filterNumeric(e.target.value)))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit_grade_12" className="text-xs">
                    Grade 12 Students
                  </Label>
                  <TextInput
                    id="edit_grade_12"
                    type="text"
                    min={0}
                    max={500}
                    placeholder="0"
                    value={editGrade12Count}
                    onChange={(e) =>
                      setEditGrade12Count(clampStudentCount(filterNumeric(e.target.value)))
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
                baseGrade11Count === editGrade11Count &&
                baseGrade12Count === editGrade12Count
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