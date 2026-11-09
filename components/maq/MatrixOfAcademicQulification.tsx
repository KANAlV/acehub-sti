"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TextInput,
  Pagination,
  Spinner,
  Toast,
  ToastToggle,
  Progress,
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Label,
  FileInput,
} from "flowbite-react";
import {
  HiSearch,
  HiChevronUp,
  HiChevronDown,
  HiCheck,
  HiExclamation,
  HiX,
  HiPlus,
  HiTrash,
} from "react-icons/hi";
import {
  FaFileExcel,
  FaFileImport,
  FaFileExport,
  FaDownload,
} from "react-icons/fa6";
import {
  fetchMaq,
  fetchMaqCount,
  createMaq,
  deleteMaq,
  MaqRecord,
} from "@/app/actions/system";
import {
  filterAlphanumericDashUnderscoreComma,
  filterAlphaUnderscore,
} from "@/utils/validation";
import { useMsal } from "@azure/msal-react";
import ExcelJS from "exceljs";

const REQUIRED_HEADERS = ["Academic Qualification"];

export default function MatrixOfAcademicQualificationPage() {
  // --- MSAL Auth State for Actor ---
  const { instance, accounts } = useMsal();
  const activeAccount = useMemo(() => instance.getActiveAccount() || accounts[0], [instance, accounts]);
  const actor = activeAccount?.username || "system";

  const [maqs, setMaqs] = useState<MaqRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Search, Sorting, and Pagination State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("aq");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("ASC");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const pageSize = 10;

  // Modal States
  const [openAddModal, setOpenAddModal] = useState<boolean>(false);
  const [openDeleteModal, setOpenDeleteModal] = useState<boolean>(false);
  const [openExcelModal, setOpenExcelModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Excel Modal States
  const [activeExcelTab, setActiveExcelTab] = useState<"import" | "export" | "template">("import");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [formatError, setFormatError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form States
  const [selectedAq, setSelectedAq] = useState<string>("");
  const [aqInput, setAqInput] = useState<string>("");

  // Form Validation Error
  const [aqError, setAqError] = useState<string>("");

  // Toast & Timer State
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
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Handle Sort Toggle
  const handleSort = useCallback((column: string) => {
    setSortBy((prev) => {
      if (prev === column) {
        setSortDir((dir) => (dir === "ASC" ? "DESC" : "ASC"));
      } else {
        setSortDir("ASC");
      }
      return column;
    });
  }, []);

  // Load MAQ Data
  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const [dataRes, countRes] = await Promise.all([
      fetchMaq(debouncedSearch, sortBy, sortDir, pageSize, currentPage),
      fetchMaqCount(debouncedSearch),
    ]);

    if (dataRes.success && dataRes.data) {
      setMaqs(dataRes.data);
    } else {
      const err = dataRes.error || "Failed to load academic qualifications.";
      setErrorMessage(err);
      triggerToast(err, "error");
    }

    if (countRes.success) {
      setTotalCount(countRes.count);
    }

    setLoading(false);
  }, [debouncedSearch, sortBy, sortDir, currentPage, triggerToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Open Add Modal
  const handleOpenAdd = useCallback(() => {
    setAqInput("");
    setAqError("");
    setOpenAddModal(true);
  }, []);

  // Open Delete Modal
  const handleOpenDelete = useCallback((aq: string) => {
    setSelectedAq(aq);
    setOpenDeleteModal(true);
  }, []);

  // Submit Add MAQ
  const handleCreate = useCallback(async () => {
    if (!aqInput.trim()) {
      setAqError("Academic Qualification name is required.");
      return;
    }

    setIsSubmitting(true);

    const res = await createMaq(actor, aqInput.trim());

    setOpenAddModal(false);

    if (res.success) {
      triggerToast("Academic Qualification created successfully!", "success");
      void loadData();
    } else {
      triggerToast(res.error || "Failed to create record.", "error");
    }
    setIsSubmitting(false);
  }, [actor, aqInput, loadData, triggerToast]);

  // Submit Delete MAQ
  const handleDelete = useCallback(async () => {
    setIsSubmitting(true);

    const res = await deleteMaq(actor, selectedAq);
    setIsSubmitting(false);

    setOpenDeleteModal(false);

    if (res.success) {
      triggerToast("Academic Qualification deleted successfully!", "success");
      void loadData();
    } else {
      triggerToast(res.error || "Failed to delete record.", "error");
    }
  }, [actor, selectedAq, loadData, triggerToast]);

  // --- Excel Operations Helpers ---
  const downloadWorkbook = useCallback((buffer: ArrayBuffer, filename: string) => {
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }, []);

  const handleDownloadTemplate = useCallback(async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Template");

    worksheet.columns = [
      { header: "Academic Qualification", key: "academic_qualification", width: 35 },
    ];

    worksheet.addRow({ academic_qualification: "BSCS" });
    worksheet.addRow({ academic_qualification: "BSIT" });

    const buffer = await workbook.xlsx.writeBuffer();
    downloadWorkbook(buffer, "Academic_Qualifications_Template.xlsx");
    triggerToast("Blank Excel template downloaded successfully!", "success");
  }, [downloadWorkbook, triggerToast]);

  const handleExportExcel = useCallback(async () => {
    try {
      const response = await fetchMaq(debouncedSearch, sortBy, sortDir, 10000, 1);
      const exportList = response?.success && response.data ? response.data : maqs;

      if (exportList.length === 0) {
        triggerToast("No qualification records available to export.", "warning");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Qualifications");

      worksheet.columns = [
        { header: "No.", key: "no", width: 8 },
        { header: "Academic Qualification", key: "academic_qualification", width: 35 },
      ];

      exportList.forEach((item, index) => {
        worksheet.addRow({
          no: index + 1,
          academic_qualification: item.aq || "",
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      downloadWorkbook(buffer, `Academic_Qualifications_Export_${new Date().toISOString().split("T")[0]}.xlsx`);
      triggerToast("Academic Qualifications exported to Excel successfully", "success");
    } catch (err) {
      console.error(err);
      triggerToast("Failed to export qualifications to Excel", "error");
    }
  }, [debouncedSearch, sortBy, sortDir, maqs, downloadWorkbook, triggerToast]);

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

      const aqCol = headerIndexMap["academic qualification"] || headerIndexMap["aq"] || 1;
      const rowsToProcess: { rowNum: number; aqVal: string }[] = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rawVal = String(row.getCell(aqCol).value || "").trim();
        const filteredVal = filterAlphaUnderscore(rawVal).trim();

        if (!filteredVal || filteredVal !== rawVal || /\s/.test(rawVal)) {
          logs.push(`Row ${rowNumber} (${rawVal}): Failed. Invalid format, symbols, or blank spaces detected.`);
          failCount++;
          return;
        }

        rowsToProcess.push({ rowNum: rowNumber, aqVal: filteredVal });
      });

      for (const item of rowsToProcess) {
        const res = await createMaq(actor, item.aqVal);
        if (res?.success) {
          successCount++;
        } else {
          logs.push(`Row ${item.rowNum} (${item.aqVal}): ${res?.error || "Creation failed."}`);
          failCount++;
        }
      }

      setImportLogs((prev) => [
        ...prev,
        `Import Completed: ${successCount} successful, ${failCount} failed.`,
        ...logs,
      ]);

      if (successCount > 0) {
        triggerToast(`Imported ${successCount} qualifications successfully.`, "success");
        void loadData();
      }
    } catch (err) {
      console.error(err);
      setFormatError("Error: Unable to parse Excel workbook format using ExcelJS.");
    } finally {
      setIsImporting(false);
    }
  }, [importFile, actor, triggerToast, loadData]);

  const totalPages = useMemo(() => Math.ceil(totalCount / pageSize) || 1, [totalCount, pageSize]);

  return (
      <div className="space-y-4 p-4">
        {/* Page Header & Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Matrix of Academic Qualifications
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              View and manage Minimum Academic Qualification (MAQ) master records.
            </p>
          </div>

          {/* Search Bar & Actions */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="w-full sm:w-64">
              <TextInput
                  id="search_maq"
                  type="text"
                  icon={HiSearch}
                  placeholder="Search qualification..."
                  value={searchQuery}
                  onChange={(e) =>
                      setSearchQuery(
                          filterAlphanumericDashUnderscoreComma(e.target.value),
                      )
                  }
              />
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
                color="blue"
                onClick={handleOpenAdd}
                className="whitespace-nowrap"
            >
              <HiPlus className="mr-2 h-4 w-4" /> Add Qualification
            </Button>
          </div>
        </div>

        {/* Error Message */}
        {errorMessage && (
            <p className="text-sm font-medium text-red-600 dark:text-red-500">
              {errorMessage}
            </p>
        )}

        {/* Table Section */}
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm dark:border-gray-700">
          <Table hoverable>
            <TableHead>
              <TableRow>
                <TableHeadCell
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("aq")}
                >
                  <div className="flex items-center gap-1">
                    <span>Academic Qualification (AQ)</span>
                    {sortBy === "aq" &&
                        (sortDir === "ASC" ? (
                            <HiChevronUp className="h-4 w-4" />
                        ) : (
                            <HiChevronDown className="h-4 w-4" />
                        ))}
                  </div>
                </TableHeadCell>
                <TableHeadCell className="w-32 text-center">
                  Actions
                </TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody className="divide-y">
              {loading ? (
                  <TableRow>
                    <TableCell colSpan={2} className="py-8 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Spinner size="sm" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                      Loading qualifications...
                    </span>
                      </div>
                    </TableCell>
                  </TableRow>
              ) : maqs.length === 0 ? (
                  <TableRow>
                    <TableCell
                        colSpan={2}
                        className="py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      No Academic Qualifications found.
                    </TableCell>
                  </TableRow>
              ) : (
                  maqs.map((item) => (
                      <TableRow
                          key={item.aq}
                          className="bg-white dark:border-gray-700 dark:bg-gray-800"
                      >
                        <TableCell className="font-medium text-gray-900 dark:text-white">
                          {item.aq}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-2">
                            <Button
                                size="xs"
                                color="alternative"
                                onClick={() => handleOpenDelete(item.aq)}
                            >
                              <HiTrash className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Footer */}
        {!loading && totalCount > 0 && (
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Showing{" "}
            <span className="font-semibold text-gray-900 dark:text-white">
              {(currentPage - 1) * pageSize + 1}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-gray-900 dark:text-white">
              {Math.min(currentPage * pageSize, totalCount)}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-gray-900 dark:text-white">
              {totalCount}
            </span>{" "}
            entries
          </span>

              {totalPages > 1 && (
                  <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={(page) => setCurrentPage(page)}
                      showIcons
                  />
              )}
            </div>
        )}

        {/* MODAL: EXCEL OPERATIONS */}
        <Modal show={openExcelModal} onClose={() => setOpenExcelModal(false)} size="lg">
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
                  <span className="text-xs font-semibold">Export Qualifications</span>
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
                      <span className="font-semibold uppercase tracking-wide">Format Standard:</span> Header must strictly contain{" "}
                      <b>Academic Qualification</b> (no spaces, symbols, or invalid characters).
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
                            Processing & Validating...
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
                        Export Academic Qualification Records
                      </h4>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Generates a standardized Excel spreadsheet containing all active query results.
                      </p>
                    </div>
                    <Button onClick={handleExportExcel} className="w-full" color="green">
                      <FaFileExport className="mr-2 h-4 w-4" /> Export {totalCount} Qualifications to Excel
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
                        Includes formatted columns (<b className="font-mono">Academic Qualification</b>) and sample rows.
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

        {/* ADD MODAL */}
        {openAddModal && (
            <Modal show={openAddModal} onClose={() => setOpenAddModal(false)}>
              <ModalHeader>Add New Academic Qualification</ModalHeader>
              <ModalBody className="space-y-4">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <Label htmlFor="aq_name">Academic Qualification</Label>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                  {aqInput.length}/50
                </span>
                  </div>
                  <TextInput
                      id="aq_name"
                      placeholder="e.g. BSCS"
                      value={aqInput}
                      maxLength={50}
                      onChange={(e) => {
                        const filtered = filterAlphaUnderscore(e.target.value).slice(
                            0,
                            50,
                        );
                        setAqInput(filtered);
                        setAqError("");
                      }}
                      color={aqError ? "failure" : "gray"}
                  />
                  {aqError && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-500">
                        {aqError}
                      </p>
                  )}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="blue" disabled={isSubmitting} onClick={handleCreate}>
                  {isSubmitting ? (
                      <Spinner size="sm" className="mr-2" />
                  ) : (
                      "Save Qualification"
                  )}
                </Button>
                <Button color="alternative" onClick={() => setOpenAddModal(false)}>
                  Cancel
                </Button>
              </ModalFooter>
            </Modal>
        )}

        {/* DELETE CONFIRMATION MODAL */}
        {openDeleteModal && (
            <Modal
                show={openDeleteModal}
                size="md"
                onClose={() => setOpenDeleteModal(false)}
                popup
            >
              <ModalHeader />
              <ModalBody>
                <div className="text-center">
                  <HiExclamation className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
                  <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
                    Are you sure you want to delete qualification{" "}
                    <strong className="text-gray-900 dark:text-white">
                      &#34;{selectedAq}&#34;
                    </strong>
                    ?
                  </h3>
                  <div className="flex justify-center gap-4">
                    <Button
                        color="red"
                        disabled={isSubmitting}
                        onClick={handleDelete}
                    >
                      {isSubmitting ? <Spinner size="sm" /> : "Yes, I'm sure"}
                    </Button>
                    <Button
                        color="alternative"
                        onClick={() => setOpenDeleteModal(false)}
                    >
                      No, cancel
                    </Button>
                  </div>
                </div>
              </ModalBody>
            </Modal>
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
                  {toastType === "warning" && <HiExclamation className="h-5 w-5" />}
                  {toastType === "error" && <HiX className="h-5 w-5" />}
                </div>
                <div className="ml-3 text-sm font-normal">{toastMessage}</div>
                <ToastToggle onDismiss={() => closeToast()} />
              </Toast>
              {showToastTimer && (
                  <Progress
                      progress={Math.min(Math.round(progress), 100)}
                      size="sm"
                      className="ease-linear"
                  />
              )}
            </div>
        )}
      </div>
  );
}