"use client";

import React, { useState, useEffect, useCallback, useTransition, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
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
  Card,
  Toast,
  ToastToggle,
  Progress,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  FileInput,
} from "flowbite-react";
import {
  HiSearch,
  HiX,
  HiCheck,
  HiExclamation,
  HiArrowLeft,
} from "react-icons/hi";
import {
  FaSortUp,
  FaSortDown,
  FaFileExcel,
  FaFileImport,
  FaFileExport,
  FaDownload,
} from "react-icons/fa6";
import { useMsal } from "@azure/msal-react";
import ExcelJS from "exceljs";

import {
  fetchFcce,
  fetchFcceCount,
  createFcce,
  updateFcce,
  ArchivedMode,
  FcceRecord,
  FcceInput,
} from "@/app/actions/system";

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

export default function FcceTermDetailPage() {
  const router = useRouter();
  const params = useParams();

  const aySemParam = useMemo(
      () => decodeURIComponent((params?.fcce_term as string) || ""),
      [params?.fcce_term]
  );

  const { instance, accounts } = useMsal();
  const activeAccount = useMemo(() => instance.getActiveAccount() || accounts[0], [instance, accounts]);
  const actor = activeAccount?.username || "system";

  const [records, setRecords] = useState<FcceRecord[]>([]);
  const [recordsCount, setRecordsCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [archiveFilter, setArchiveFilter] = useState<ArchivedMode>("ACTIVE");

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [maxRow] = useState<number>(10);
  const [sortBy, setSortBy] = useState<string>("pscs_id");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("ASC");

  // Excel Operations Modal & States
  const [openExcelModal, setOpenExcelModal] = useState<boolean>(false);
  const [activeExcelTab, setActiveExcelTab] = useState<"import" | "export" | "template">("import");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [formatError, setFormatError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast State
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [toastType, setToastType] = useState<"success" | "warning" | "error">("success");
  const [progress, setProgress] = useState<number>(0);
  const [showToastTimer, setShowToastTimer] = useState<boolean>(false);

  const triggerToast = useCallback((msg: string, type: "success" | "warning" | "error" = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setShowToast(true);
    setShowToastTimer(true);
    setProgress(0);
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 150);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const loadData = useCallback(() => {
    if (!aySemParam) return;

    startTransition(async () => {
      setIsLoading(true);
      const [resData, resCount] = await Promise.all([
        fetchFcce(
            debouncedSearch || null,
            aySemParam,
            archiveFilter,
            sortBy,
            sortDir,
            maxRow,
            currentPage,
        ),
        fetchFcceCount(debouncedSearch || null, aySemParam, archiveFilter),
      ]);

      if (resData?.success && resData.data) {
        setRecords(resData.data);
      } else {
        setRecords([]);
      }

      if (resCount?.success) {
        setRecordsCount(resCount.count);
      }
      setIsLoading(false);
    });
  }, [debouncedSearch, aySemParam, archiveFilter, sortBy, sortDir, maxRow, currentPage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSorting = (column: string) => {
    startTransition(() => {
      if (sortBy === column) {
        setSortDir((prev) => (prev === "ASC" ? "DESC" : "ASC"));
      } else {
        setSortBy(column);
        setSortDir("ASC");
      }
      setCurrentPage(1);
    });
  };

  const handleToggleArchiveStatus = async (item: FcceRecord) => {
    const nextArchivedState = !item.archived;
    const res = await updateFcce(actor, item.fcce_id, { archived: nextArchivedState });
    if (res?.success) {
      triggerToast(`Record successfully ${nextArchivedState ? "archived" : "restored"}`, "success");
      loadData();
    } else {
      triggerToast(res?.error || "Failed to update archive status", "error");
    }
  };

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
      ay_sem: aySemParam,
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
    downloadWorkbook(buffer, `${aySemParam}_FCCE_Template.xlsx`);
    triggerToast("Blank Excel template downloaded successfully!", "success");
  }, [aySemParam, triggerToast]);

  const handleExportExcel = useCallback(async () => {
    try {
      const response = await fetchFcce(debouncedSearch || null, aySemParam, archiveFilter, sortBy, sortDir, 10000, 1);
      const exportList = response?.success && response.data ? response.data : records;

      if (exportList.length === 0) {
        triggerToast("No records available to export for this term.", "warning");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("FCCE Term Records") as unknown as WorksheetWithValidation;

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
          ay_sem: item.ay_sem || aySemParam,
          status: item.pass ? "Passed" : "Failed",
        });
      });

      worksheet.dataValidations.add("D2:D1000", {
        type: "list",
        allowBlank: false,
        formulae: ['"Passed,Failed"'],
      });

      const buffer = await workbook.xlsx.writeBuffer();
      downloadWorkbook(buffer, `${aySemParam}_FCCE_Export_${new Date().toISOString().split("T")[0]}.xlsx`);
      triggerToast("Term records exported to Excel successfully", "success");
    } catch (err) {
      console.error(err);
      triggerToast("Failed to export records to Excel", "error");
    }
  }, [debouncedSearch, aySemParam, archiveFilter, sortBy, sortDir, records, triggerToast]);

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

      setImportLogs((prev) => [...prev, `Headers verified. Enforcing term constraints for ${aySemParam}...`]);

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

        if (rawAySem.toLowerCase() !== aySemParam.toLowerCase()) {
          logs.push(`Row ${rowNumber} (${rawPscs}): Blocked. AY/Sem "${rawAySem}" does not match active term "${aySemParam}".`);
          failCount++;
          return;
        }

        if (!rawPscs || !rawCourse) {
          logs.push(`Row ${rowNumber}: Skipped. PSCS ID or Course Name is missing.`);
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

        const res = await createFcce(actor, payload);
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
        triggerToast(`Imported ${successCount} records successfully under ${aySemParam}.`, "success");
        loadData();
      }
    } catch (err) {
      console.error(err);
      setFormatError("Error: Unable to parse Excel workbook format using ExcelJS.");
    } finally {
      setIsImporting(false);
    }
  }, [importFile, aySemParam, actor, loadData, triggerToast]);

  return (
      <div className="m-8">
        {showToast && (
            <div className="fixed right-5 bottom-5 z-50 rounded-lg border border-gray-500/30">
              <Toast>
                <div
                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        toastType === "success"
                            ? "bg-green-100 text-green-500 dark:bg-green-800 dark:text-green-200"
                            : "bg-red-100 text-red-500 dark:bg-red-800 dark:text-red-200"
                    }`}
                >
                  {toastType === "success" ? <HiCheck className="h-5 w-5" /> : <HiExclamation className="h-5 w-5" />}
                </div>
                <div className="ml-3 text-sm font-normal">{toastMessage}</div>
                <ToastToggle onDismiss={() => setShowToast(false)} />
              </Toast>
              <Progress progress={progress} size="sm" className={showToastTimer ? "" : "hidden"} />
            </div>
        )}

        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button color="alternative" size="sm" onClick={() => router.push("/fcce")}>
              <HiArrowLeft className="mr-2 h-4 w-4" /> Back to Terms Directory
            </Button>
            <div>
              <h1 className="text-xl font-bold">
                Academic Term / Semester: <span className="font-mono text-blue-600">{aySemParam}</span>
              </h1>
              <p className="text-sm text-gray-500">
                Viewing all FCCE student passing records associated with this term.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full md:w-64">
            <TextInput
                id="search-fcce-term"
                type="text"
                placeholder="Search PSCS ID, course..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                icon={HiSearch}
            />
            {searchTerm && (
                <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                >
                  <HiX className="h-4 w-4" />
                </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="w-full sm:w-48">
              <Select
                  id="archive-filter"
                  value={archiveFilter}
                  onChange={(e) => {
                    setArchiveFilter(e.target.value as ArchivedMode);
                    setCurrentPage(1);
                  }}
              >
                <option value="ACTIVE">Active Only</option>
                <option value="ARCHIVED">Archived Only</option>
                <option value="BOTH">All Records</option>
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
          </div>
        </div>

        <Card className="overflow-x-auto">
          <Table hoverable>
            <TableHead>
              <TableRow>
                <TableHeadCell onClick={() => handleSorting("pscs_id")}>
                  <div className="flex cursor-pointer text-blue-500 hover:underline">
                    PSCS ID {sortBy === "pscs_id" && (sortDir === "ASC" ? <FaSortUp className="ml-1" /> : <FaSortDown className="ml-1" />)}
                  </div>
                </TableHeadCell>
                <TableHeadCell onClick={() => handleSorting("teacher_name")}>
                  <div className="flex cursor-pointer text-blue-500 hover:underline">
                    Teacher Name {sortBy === "teacher_name" && (sortDir === "ASC" ? <FaSortUp className="ml-1" /> : <FaSortDown className="ml-1" />)}
                  </div>
                </TableHeadCell>
                <TableHeadCell onClick={() => handleSorting("course_name")}>
                  <div className="flex cursor-pointer text-blue-500 hover:underline">
                    Course Name {sortBy === "course_name" && (sortDir === "ASC" ? <FaSortUp className="ml-1" /> : <FaSortDown className="ml-1" />)}
                  </div>
                </TableHeadCell>
                <TableHeadCell onClick={() => handleSorting("pass")}>
                  <div className="flex cursor-pointer text-blue-500 hover:underline">
                    Status {sortBy === "pass" && (sortDir === "ASC" ? <FaSortUp className="ml-1" /> : <FaSortDown className="ml-1" />)}
                  </div>
                </TableHeadCell>
                <TableHeadCell>Actions</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody className="divide-y">
              {records.length > 0 ? (
                  records.map((item) => (
                      <TableRow
                          key={item.fcce_id}
                          className={`bg-white dark:border-gray-700 dark:bg-gray-800 ${item.archived ? "opacity-60 line-through" : ""}`}
                      >
                        <TableCell className="font-medium text-gray-900 dark:text-white">{item.pscs_id}</TableCell>
                        <TableCell>{item.teacher_name || "—"}</TableCell>
                        <TableCell>{item.course_name}</TableCell>
                        <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${item.pass ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {item.pass ? "Passed" : "Failed"}
                    </span>
                        </TableCell>
                        <TableCell>
                          <button
                              type="button"
                              onClick={() => handleToggleArchiveStatus(item)}
                              className={`text-sm font-medium hover:underline ${item.archived ? "text-green-600" : "text-yellow-600"}`}
                          >
                            {item.archived ? "Restore" : "Archive"}
                          </button>
                        </TableCell>
                      </TableRow>
                  ))
              ) : isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center italic text-gray-500">
                      <div className="flex items-center justify-center">
                        <Spinner size="sm" />
                        <span className="ml-3">Loading term records...</span>
                      </div>
                    </TableCell>
                  </TableRow>
              ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center italic text-gray-500">
                      No records found for term {aySemParam}.
                    </TableCell>
                  </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <div className="mt-4 flex justify-center">
          <Pagination
              layout="pagination"
              currentPage={currentPage}
              totalPages={Math.ceil(recordsCount / maxRow) || 1}
              onPageChange={(p) => setCurrentPage(p)}
              showIcons
          />
        </div>

        {/* --- MODAL: EXCEL OPERATIONS --- */}
        <Modal show={openExcelModal} onClose={() => setOpenExcelModal(false)} size="lg">
          <ModalHeader>
            <div className="flex items-center gap-2">
              <FaFileExcel className="text-green-600 h-5 w-5" />
              <span>Excel Operations for <span className="font-mono text-blue-600">{aySemParam}</span></span>
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
                      <span className="font-semibold uppercase tracking-wide">Validation Constraint:</span> Rows must specify AY/Sem <b className="font-mono">{aySemParam}</b> and Status must be <b className="font-mono">Passed</b> or <b className="font-mono">Failed</b>. Headers: {REQUIRED_HEADERS.join(", ")}
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
                                    log.includes("Error") || log.includes("Failed") || log.includes("Blocked") || log.includes("Skipped")
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
                            Validating & Importing...
                          </>
                      ) : (
                          `Import Records to ${aySemParam}`
                      )}
                    </Button>
                  </div>
              )}

              {activeExcelTab === "export" && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-4 dark:border-gray-700 dark:bg-gray-800">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                        Export Records for {aySemParam}
                      </h4>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Generates a structured spreadsheet containing all current student records registered under this specific term with Status dropdown validation.
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
                        Download Term Template
                      </h4>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Pre-filled template pre-configured with term <b className="font-mono">{aySemParam}</b> and Status dropdown validation (<b className="font-mono">Passed, Failed</b>).
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
            <Button color="alternative" onClick={() => setOpenExcelModal(false)}>
              Close Window
            </Button>
          </ModalFooter>
        </Modal>
      </div>
  );
}