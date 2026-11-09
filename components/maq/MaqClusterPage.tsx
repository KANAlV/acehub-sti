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
  Badge,
  Toast,
  ToastToggle,
  Progress,
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Label,
  ToggleSwitch,
  Tooltip,
  FileInput,
  useThemeMode,
} from "flowbite-react";
import {
  HiSearch,
  HiChevronUp,
  HiChevronDown,
  HiCheck,
  HiExclamation,
  HiX,
  HiPlus,
  HiPencil,
  HiTrash,
} from "react-icons/hi";
import {
  FaFileExcel,
  FaFileImport,
  FaFileExport,
  FaDownload,
} from "react-icons/fa6";
import {
  fetchMaqClustersWithEntries,
  fetchMaqClustersCount,
  createMaqCluster,
  syncMaqClusterEntries,
  deleteMaqCluster,
  fetchMaq,
  MaqClusterWithEntriesRecord,
  MaqRecord,
  MaqClusterEntryItem,
} from "@/app/actions/system";
import {
  filterAlphanumericDashUnderscoreComma,
  filterAlphaUnderscore,
  filterMAQCluster,
} from "@/utils/validation";
import { useMsal } from "@azure/msal-react";
import ExcelJS from "exceljs";

const REQUIRED_HEADERS = ["Cluster Name", "Academic Qualifications"];

export default function MaqClusterPage() {
  const { computedMode } = useThemeMode();
  const isDarkMode = computedMode === "dark";

  // --- MSAL Auth State for Actor ---
  const { instance, accounts } = useMsal();
  const activeAccount = useMemo(() => instance.getActiveAccount() || accounts[0], [instance, accounts]);
  const actor = activeAccount?.username || "system";

  const [clusters, setClusters] = useState<MaqClusterWithEntriesRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Search, Sorting, and Pagination State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("cluster_name");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("ASC");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const pageSize = 10;

  // State for toggling custom AQ creation
  const [enableAddAq, setEnableAddAq] = useState<boolean>(false);

  // AQ Master Suggestions Options
  const [aqOptions, setAqOptions] = useState<string[]>([]);

  // Modal States
  const [openAddModal, setOpenAddModal] = useState<boolean>(false);
  const [openEditModal, setOpenEditModal] = useState<boolean>(false);
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
  const [selectedClusterName, setSelectedClusterName] = useState<string>("");
  const [clusterNameInput, setClusterNameInput] = useState<string>("");
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [aqSearchInput, setAqSearchInput] = useState<string>("");
  const [showAqDropdown, setShowAqDropdown] = useState<boolean>(false);

  // Form Validation Errors
  const [nameError, setNameError] = useState<string>("");

  // Toast & Timer State
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [toastType, setToastType] = useState<"success" | "warning" | "error">("success");
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
      (msg: string, type: "success" | "warning" | "error" = "success", durationMs: number = 4000) => {
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
      [closeToast]
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

  // Load Clusters Data & AQ Master Suggestions
  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const [dataRes, countRes, aqRes] = await Promise.all([
      fetchMaqClustersWithEntries(
          debouncedSearch,
          sortBy,
          sortDir,
          pageSize,
          currentPage,
      ),
      fetchMaqClustersCount(debouncedSearch),
      fetchMaq(null, "aq", "ASC", 0, 1),
    ]);

    if (dataRes.success && dataRes.data) {
      setClusters(dataRes.data);
    } else {
      const err = dataRes.error || "Failed to load clusters.";
      setErrorMessage(err);
      triggerToast(err, "error");
    }

    if (countRes.success) {
      setTotalCount(countRes.count);
    }

    if (aqRes.success && aqRes.data) {
      setAqOptions(aqRes.data.map((item: MaqRecord) => item.aq));
    }

    setLoading(false);
  }, [debouncedSearch, sortBy, sortDir, currentPage, triggerToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Filter AQ options for dropdown based on trimmed input and existing selections
  const trimmedAqInput = useMemo(() => aqSearchInput.trim(), [aqSearchInput]);

  const filteredAqOptions = useMemo(() => {
    return aqOptions.filter(
        (opt) =>
            opt.toLowerCase().includes(trimmedAqInput.toLowerCase()) &&
            !selectedEntries.includes(opt),
    );
  }, [aqOptions, trimmedAqInput, selectedEntries]);

  // Validate AQ Search Input state whenever typing occurs
  const handleAqInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const filtered = filterAlphaUnderscore(e.target.value).slice(0, 50);
    setAqSearchInput(filtered);

    const trimmed = filtered.trim();
    if (trimmed.length > 0) {
      setShowAqDropdown(true);
    } else {
      setShowAqDropdown(false);
    }
  }, []);

  // Add AQ item on option click
  const handleSelectAq = useCallback((aq: string) => {
    setSelectedEntries((prev) => (prev.includes(aq) ? prev : [...prev, aq]));
    setAqSearchInput("");
    setShowAqDropdown(false);
  }, []);

  // Add Custom AQ item when no matches exist
  const handleAddCustomAq = useCallback(() => {
    const trimmed = aqSearchInput.trim();
    if (trimmed && !selectedEntries.includes(trimmed)) {
      setSelectedEntries((prev) => [...prev, trimmed]);
    }
    setAqSearchInput("");
    setShowAqDropdown(false);
  }, [aqSearchInput, selectedEntries]);

  // Remove AQ item
  const handleRemoveAq = useCallback((aqToRemove: string) => {
    setSelectedEntries((prev) => prev.filter((item) => item !== aqToRemove));
  }, []);

  // Open Add Modal
  const handleOpenAdd = useCallback(() => {
    setClusterNameInput("");
    setSelectedEntries([]);
    setAqSearchInput("");
    setNameError("");
    setOpenAddModal(true);
  }, []);

  // Open Edit Modal
  const handleOpenEdit = useCallback((cluster: MaqClusterWithEntriesRecord) => {
    let rawEntries: (string | MaqClusterEntryItem)[] = [];
    if (Array.isArray(cluster.entries)) {
      rawEntries = cluster.entries;
    } else if (typeof cluster.entries === "string") {
      try {
        rawEntries = JSON.parse(cluster.entries);
      } catch {
        rawEntries = [];
      }
    }

    const entriesList = rawEntries.map((e) =>
        typeof e === "string" ? e : e.aq,
    );

    setSelectedClusterName(cluster.cluster_name);
    setClusterNameInput(cluster.cluster_name);
    setSelectedEntries(entriesList);
    setAqSearchInput("");
    setNameError("");
    setOpenEditModal(true);
  }, []);

  // Open Delete Modal
  const handleOpenDelete = useCallback((clusterName: string) => {
    setSelectedClusterName(clusterName);
    setOpenDeleteModal(true);
  }, []);

  // Submit Add Cluster
  const handleCreate = useCallback(async () => {
    if (!clusterNameInput.trim()) {
      setNameError("Cluster name is required.");
      return;
    }

    if (selectedEntries.length === 0) {
      return;
    }

    setIsSubmitting(true);

    const res = await createMaqCluster(actor, clusterNameInput.trim());

    if (res.success) {
      await syncMaqClusterEntries(
          actor,
          clusterNameInput.trim(),
          selectedEntries,
      );
      setOpenAddModal(false);
      triggerToast("MAQ Cluster created successfully!", "success");
      void loadData();
    } else {
      triggerToast(res.error || "Failed to create cluster.", "error");
    }
    setIsSubmitting(false);
  }, [actor, clusterNameInput, selectedEntries, loadData, triggerToast]);

  // Submit Edit Cluster using syncMaqClusterEntries
  const handleUpdate = useCallback(async () => {
    if (!clusterNameInput.trim()) {
      setNameError("Cluster name is required.");
      return;
    }

    if (selectedEntries.length === 0) {
      return;
    }

    setIsSubmitting(true);

    const res = await syncMaqClusterEntries(
        actor,
        clusterNameInput.trim(),
        selectedEntries,
    );
    setIsSubmitting(false);

    if (res.success) {
      setOpenEditModal(false);
      triggerToast("MAQ Cluster entries updated successfully!", "success");
      void loadData();
    } else {
      triggerToast(res.error || "Failed to update cluster entries.", "error");
    }
  }, [actor, clusterNameInput, selectedEntries, loadData, triggerToast]);

  // Submit Delete Cluster
  const handleDelete = useCallback(async () => {
    setIsSubmitting(true);

    const res = await deleteMaqCluster(actor, selectedClusterName);
    setIsSubmitting(false);

    if (res.success) {
      setOpenDeleteModal(false);
      triggerToast("MAQ Cluster deleted successfully!", "success");
      void loadData();
    } else {
      triggerToast(res.error || "Failed to delete cluster.", "error");
    }
  }, [actor, selectedClusterName, loadData, triggerToast]);

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
      { header: "Cluster Name", key: "cluster_name", width: 25 },
      { header: "Academic Qualifications", key: "academic_qualifications", width: 40 },
    ];

    worksheet.addRow({
      cluster_name: "Computer Science",
      academic_qualifications: "BSCS, BSIT",
    });
    worksheet.addRow({
      cluster_name: "Information Technology",
      academic_qualifications: "BSIT, BSIS",
    });

    const buffer = await workbook.xlsx.writeBuffer();
    downloadWorkbook(buffer, "MAQ_Cluster_Import_Template.xlsx");
    triggerToast("Blank Excel template downloaded successfully!", "success");
  }, [downloadWorkbook, triggerToast]);

  const handleExportExcel = useCallback(async () => {
    try {
      const response = await fetchMaqClustersWithEntries(debouncedSearch, sortBy, sortDir, 10000, 1);
      const exportList = response?.success && response.data ? response.data : clusters;

      if (exportList.length === 0) {
        triggerToast("No cluster records available to export.", "warning");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("MAQ Clusters");

      worksheet.columns = [
        { header: "No.", key: "no", width: 8 },
        { header: "Cluster Name", key: "cluster_name", width: 25 },
        { header: "Academic Qualifications", key: "academic_qualifications", width: 40 },
      ];

      exportList.forEach((item, index) => {
        let rawEntries: (string | MaqClusterEntryItem)[] = [];
        if (Array.isArray(item.entries)) {
          rawEntries = item.entries;
        } else if (typeof item.entries === "string") {
          try {
            rawEntries = JSON.parse(item.entries);
          } catch {
            rawEntries = [];
          }
        }
        const entriesStr = rawEntries.map((e) => (typeof e === "string" ? e : e.aq)).join(", ");

        worksheet.addRow({
          no: index + 1,
          cluster_name: item.cluster_name || "",
          academic_qualifications: entriesStr || "",
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      downloadWorkbook(buffer, `MAQ_Clusters_Export_${new Date().toISOString().split("T")[0]}.xlsx`);
      triggerToast("MAQ Clusters exported to Excel successfully", "success");
    } catch (err) {
      console.error(err);
      triggerToast("Failed to export MAQ clusters to Excel", "error");
    }
  }, [debouncedSearch, sortBy, sortDir, clusters, downloadWorkbook, triggerToast]);

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

      const nameCol = headerIndexMap["cluster name"] || 1;
      const aqCol = headerIndexMap["academic qualifications"] || headerIndexMap["aq"] || 2;

      const rowsToProcess: { rowNum: number; clusterName: string; aqs: string[] }[] = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rawClusterName = filterMAQCluster(String(row.getCell(nameCol).value || "")).trim();
        const rawAqString = String(row.getCell(aqCol).value || "").trim();

        if (!rawClusterName) {
          logs.push(`Row ${rowNumber}: Skipped. Cluster Name is empty.`);
          failCount++;
          return;
        }

        const rawAqList = rawAqString.split(",").map((s) => s.trim()).filter(Boolean);
        const validAqs: string[] = [];
        let hasInvalidAq = false;

        for (const aq of rawAqList) {
          const cleanedAq = filterAlphaUnderscore(aq).trim();
          if (!cleanedAq || cleanedAq !== aq || /\s/.test(aq)) {
            hasInvalidAq = true;
            break;
          }
          validAqs.push(cleanedAq);
        }

        if (hasInvalidAq || validAqs.length === 0) {
          logs.push(`Row ${rowNumber} (${rawClusterName}): Failed. Invalid or empty Academic Qualifications formatting.`);
          failCount++;
          return;
        }

        rowsToProcess.push({
          rowNum: rowNumber,
          clusterName: rawClusterName,
          aqs: validAqs,
        });
      });

      for (const item of rowsToProcess) {
        const createRes = await createMaqCluster(actor, item.clusterName);
        const syncRes = await syncMaqClusterEntries(actor, item.clusterName, item.aqs);

        if (createRes?.success || syncRes?.success) {
          successCount++;
        } else {
          logs.push(`Row ${item.rowNum} (${item.clusterName}): ${syncRes?.error || createRes?.error || "Import failed."}`);
          failCount++;
        }
      }

      setImportLogs((prev) => [
        ...prev,
        `Import Completed: ${successCount} successful, ${failCount} failed.`,
        ...logs,
      ]);

      if (successCount > 0) {
        triggerToast(`Imported ${successCount} clusters successfully.`, "success");
        void loadData();
      }
    } catch (err) {
      console.error(err);
      setFormatError("Error: Unable to parse Excel workbook format using ExcelJS.");
    } finally {
      setIsImporting(false);
    }
  }, [importFile, actor, triggerToast, loadData]);

  // Form Validation Check: Disables button if name is empty or entries list is empty
  const isFormInvalid = useMemo(() => {
    return !clusterNameInput.trim() || selectedEntries.length === 0;
  }, [clusterNameInput, selectedEntries]);

  const totalPages = useMemo(() => Math.ceil(totalCount / pageSize) || 1, [totalCount, pageSize]);

  return (
      <div className="space-y-4 p-4">
        {/* Page Header & Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              MAQ Clusters
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              View and manage Minimum Academic Qualification (MAQ) clusters.
            </p>
          </div>

          {/* Search Bar & Actions */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="w-full sm:w-64">
              <TextInput
                  id="search_clusters"
                  type="text"
                  icon={HiSearch}
                  placeholder="Search cluster name..."
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
              <HiPlus className="mr-2 h-4 w-4" /> Add Cluster
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
                    onClick={() => handleSort("cluster_name")}
                >
                  <div className="flex items-center gap-1">
                    <span>Cluster Name</span>
                    {sortBy === "cluster_name" &&
                        (sortDir === "ASC" ? (
                            <HiChevronUp className="h-4 w-4" />
                        ) : (
                            <HiChevronDown className="h-4 w-4" />
                        ))}
                  </div>
                </TableHeadCell>
                <TableHeadCell>Academic Qualifications</TableHeadCell>
                <TableHeadCell className="text-center">Actions</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody className="divide-y">
              {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Spinner size="sm" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                      Loading clusters...
                    </span>
                      </div>
                    </TableCell>
                  </TableRow>
              ) : clusters.length === 0 ? (
                  <TableRow>
                    <TableCell
                        colSpan={3}
                        className="py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      No MAQ clusters found.
                    </TableCell>
                  </TableRow>
              ) : (
                  clusters.map((cluster) => {
                    let entriesList: (string | MaqClusterEntryItem)[] = [];
                    if (Array.isArray(cluster.entries)) {
                      entriesList = cluster.entries;
                    } else if (typeof cluster.entries === "string") {
                      try {
                        entriesList = JSON.parse(cluster.entries);
                      } catch {
                        entriesList = [];
                      }
                    }

                    return (
                        <TableRow
                            key={cluster.cluster_name}
                            className="bg-white dark:border-gray-700 dark:bg-gray-800"
                        >
                          <TableCell className="font-medium text-gray-900 dark:text-white">
                            {cluster.cluster_name}
                          </TableCell>
                          <TableCell>
                            {entriesList.length > 0 ? (
                                <Tooltip
                                    className={
                                      "border-2 border-gray-900 bg-white text-gray-500 dark:border-white dark:bg-gray-800 dark:text-gray-300"
                                    }
                                    content={entriesList.map((entry) => {
                                      const aqLabel =
                                          typeof entry === "string" ? entry : entry.aq;
                                      return (
                                          <div key={cluster.cluster_name + " " + aqLabel}>
                                            {aqLabel}
                                          </div>
                                      );
                                    })}
                                    style={isDarkMode ? "light" : "dark"}
                                >
                                  <div className="max-w-[320px] items-center gap-1.5 truncate">
                                    {entriesList.map((entry) => {
                                      const aqLabel =
                                          typeof entry === "string" ? entry : entry.aq;
                                      return <span key={aqLabel}> {aqLabel} </span>;
                                    })}
                                  </div>
                                </Tooltip>
                            ) : (
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                          No entries
                        </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-center gap-2">
                              <Button
                                  size="xs"
                                  color="alternative"
                                  onClick={() => handleOpenEdit(cluster)}
                              >
                                <HiPencil className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                  size="xs"
                                  color="alternative"
                                  onClick={() => handleOpenDelete(cluster.cluster_name)}
                              >
                                <HiTrash className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                    );
                  })
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
                  <span className="text-xs font-semibold">Export Clusters</span>
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
                      <span className="font-semibold uppercase tracking-wide">Format Standard:</span> Headers must strictly contain{" "}
                      <b>Cluster Name</b> and <b>Academic Qualifications</b> (comma-separated valid codes without spaces/illegal symbols).
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
                        Export Filtered MAQ Cluster Records
                      </h4>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Generates a standardized Excel spreadsheet containing all active query results.
                      </p>
                    </div>
                    <Button onClick={handleExportExcel} className="w-full" color="green">
                      <FaFileExport className="mr-2 h-4 w-4" /> Export {totalCount} Clusters to Excel
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
                        Includes formatted columns (<b className="font-mono">Cluster Name, Academic Qualifications</b>) and sample rows.
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

        {/* ADD / EDIT MODAL */}
        {(openAddModal || openEditModal) && (
            <Modal
                show={openAddModal || openEditModal}
                onClose={() => {
                  setOpenAddModal(false);
                  setOpenEditModal(false);
                }}
            >
              <ModalHeader>
                {openAddModal ? "Add New MAQ Cluster" : "Edit MAQ Cluster"}
              </ModalHeader>
              <ModalBody className="scrollbar-thumb-gray-400 scrollbar-track-transparent space-y-4">
                {/* Cluster Name Field */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <Label htmlFor="cluster_name">Cluster Name</Label>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                  {clusterNameInput.length}/50
                </span>
                  </div>
                  <TextInput
                      id="cluster_name"
                      placeholder="e.g. Computer Science"
                      value={clusterNameInput}
                      disabled={openEditModal}
                      maxLength={50}
                      onChange={(e) => {
                        const filtered = filterMAQCluster(e.target.value).slice(
                            0,
                            50,
                        );
                        setClusterNameInput(filtered);
                        setNameError("");
                      }}
                      color={nameError ? "failure" : "gray"}
                  />
                  {nameError && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-500">
                        {nameError}
                      </p>
                  )}
                </div>

                {/* Academic Qualifications Selection */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label>Academic Qualifications</Label>
                    <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {aqSearchInput.length}/50
                  </span>
                    </div>
                  </div>

                  {/* AQ Suggestion Input */}
                  <div className="relative mb-2">
                    <div
                        className={"flex flex-col gap-3 sm:flex-row sm:items-center"}
                    >
                      <div className={"flex-1"}>
                        <TextInput
                            placeholder="Type to search qualifications..."
                            value={aqSearchInput}
                            maxLength={50}
                            onChange={handleAqInputChange}
                            onFocus={() => {
                              if (aqSearchInput.trim().length > 0) {
                                setShowAqDropdown(true);
                              }
                            }}
                            color="gray"
                        />
                      </div>

                      <Tooltip
                          className={
                            "border-2 border-gray-900 bg-white text-gray-500 dark:border-white dark:bg-gray-800 dark:text-gray-300"
                          }
                          placement={"bottom"}
                          content={
                            "Allows you to create qualifications not in the list"
                          }
                          style={isDarkMode ? "light" : "dark"}
                      >
                        <div className={"shrink-0 sm:self-center"}>
                          <ToggleSwitch
                              checked={enableAddAq}
                              label="Add AQ"
                              onChange={setEnableAddAq}
                          />
                        </div>
                      </Tooltip>
                    </div>

                    {/* Dropdown Options */}
                    {showAqDropdown && trimmedAqInput.length > 0 && (
                        <div className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                          {filteredAqOptions.length > 0 &&
                              filteredAqOptions.map((opt) => (
                                  <div
                                      key={opt}
                                      className="cursor-pointer px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                                      onClick={() => handleSelectAq(opt)}
                                  >
                                    {opt}
                                  </div>
                              ))}

                          {enableAddAq &&
                              !selectedEntries.includes(trimmedAqInput) && (
                                  <div className="border-t border-gray-100 p-2 dark:border-gray-700">
                                    <Button
                                        size="xs"
                                        color="blue"
                                        className="w-full justify-center"
                                        onClick={handleAddCustomAq}
                                    >
                                      <HiPlus className="mr-1.5 h-4 w-4" /> Add
                                      <span className="mx-1 font-bold">
                              &#34;{trimmedAqInput}&#34;{" "}
                            </span>
                                      to AQ Matrix
                                    </Button>
                                  </div>
                              )}

                          {filteredAqOptions.length === 0 &&
                              (!enableAddAq ||
                                  selectedEntries.includes(trimmedAqInput)) && (
                                  <div className="p-2.5 text-center text-xs text-gray-500 dark:text-gray-400">
                                    No matching qualification found.
                                  </div>
                              )}
                        </div>
                    )}
                  </div>

                  {/* Selected AQ Badges List */}
                  <div className="flex min-h-[42px] flex-wrap gap-1.5 rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                    {selectedEntries.length === 0 ? (
                        <span className="self-center text-xs text-red-500 dark:text-red-400">
                    At least one Academic Qualification is required.
                  </span>
                    ) : (
                        selectedEntries.map((aq) => (
                            <Badge key={aq} color="blue" size="sm">
                      <span className="inline-flex items-center gap-1.5">
                        <span>{aq}</span>
                        <HiX
                            className="h-3.5 w-3.5 shrink-0 cursor-pointer hover:text-red-500"
                            onClick={() => handleRemoveAq(aq)}
                        />
                      </span>
                            </Badge>
                        ))
                    )}
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button
                    color="blue"
                    disabled={isFormInvalid || isSubmitting}
                    onClick={openAddModal ? handleCreate : handleUpdate}
                >
                  {isSubmitting ? (
                      <Spinner size="sm" className="mr-2" />
                  ) : openAddModal ? (
                      "Save Cluster"
                  ) : (
                      "Update Cluster"
                  )}
                </Button>
                <Button
                    color="alternative"
                    onClick={() => {
                      setOpenAddModal(false);
                      setOpenEditModal(false);
                    }}
                >
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
                    Are you sure you want to delete cluster{" "}
                    <strong className="text-gray-900 dark:text-white">
                      &#34;{selectedClusterName}&#34;
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
              <Progress
                  progress={Math.min(Math.round(progress), 100)}
                  size="sm"
                  className={`${showToastTimer ? "" : "hidden"} ease-linear`}
              />
            </div>
        )}
      </div>
  );
}