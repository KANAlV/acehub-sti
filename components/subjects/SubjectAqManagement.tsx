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
  Label,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  FileInput,
  HelperText,
  Pagination,
  Spinner,
  Toast,
  ToastToggle,
  Progress,
  Badge,
  Tooltip,
  useThemeMode,
  ToggleSwitch, // Imported ToggleSwitch from flowbite-react
} from "flowbite-react";
import {
  HiSearch,
  HiX,
  HiCheck,
  HiExclamation,
  HiPencil,
} from "react-icons/hi";
import {
  FaSortUp,
  FaSortDown,
  FaSync,
  FaFileExcel,
  FaFileImport,
  FaFileExport,
  FaDownload,
} from "react-icons/fa";
import { MdFolderCopy } from "react-icons/md";
import { IoMdDocument } from "react-icons/io";
import { useMsal } from "@azure/msal-react";
import ExcelJS from "exceljs";

// Import fetch functions, types, and SyncSubjectAQInput from system
import {
  fetchMaq,
  fetchMaqClustersWithEntries,
  fetchSubjectsAQClusters,
  fetchSubjectsAQClustersCount,
  fetchPrograms,
  syncSubjectAQ,
  SubjectAQClusterRecord,
  MaqRecord,
  MaqClusterWithEntriesRecord,
  MaqClusterEntryItem,
  SyncSubjectAQInput, fetchSubjectsCountNoAQ,
} from "@/app/actions/system";
import {HiQuestionMarkCircle} from "react-icons/hi2";

interface ProgramRecord {
  program_code: string;
  program_name: string;
}

interface SuggestionItem {
  name: string;
  type: "maq" | "cluster";
  entries: MaqClusterEntryItem[];
}

interface SelectedItem {
  name: string;
  type: "maq" | "cluster";
}

interface DataValidationRule {
  type: string;
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

interface SubjectAqImportResult {
  rowNumber: number | null;
  subject: string;
  status: "success" | "failed";
  description: string;
}

const normalizeExcelValue = (value: string) => value.trim().toLocaleLowerCase();

const readExcelCell = (row: ExcelJS.Row, column: number) =>
  String(row.getCell(column).text || row.getCell(column).value || "").trim();

export default function SubjectAqManagement() {
  const { computedMode } = useThemeMode();
  const isDarkMode = computedMode === "dark";

  // --- MSAL Auth State for Actor ---
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];

  // --- Data State ---
  const [subjectAqs, setSubjectAqs] = useState<SubjectAQClusterRecord[]>([]);
  const [noAqCount, setNoAqCount] = useState(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();

  // --- AQ Master Suggestions Options ---
  const [aqOptions, setAqOptions] = useState<SuggestionItem[]>([]);

  // --- Program Filter State ---
  const [selectedProgramFilter, setSelectedProgramFilter] =
    useState<string>("ALL");
  const [allProgramsFilterList, setAllProgramsFilterList] = useState<
    ProgramRecord[]
  >([]);

  // --- AQ Status Filter State ---
  const [aqFilterState, setAqFilterState] = useState<string>("ALL");

  // --- Search & Pagination State ---
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [maxRow] = useState<number>(10);
  const [sortBy, setSortBy] = useState<string>("course_name");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("ASC");
  const [totalCount, setTotalCount] = useState<number>(0);

  // --- Modal States ---
  const [openSyncModal, setOpenSyncModal] = useState<boolean>(false);
  const [openExcelModal, setOpenExcelModal] = useState<boolean>(false);
  const [activeExcelTab, setActiveExcelTab] = useState<
    "import" | "export" | "template"
  >("import");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [formatError, setFormatError] = useState("");
  const [importResults, setImportResults] = useState<SubjectAqImportResult[]>([]);
  const [importStatus, setImportStatus] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Target Record / Form State for Sync & Badge Input ---
  const [selectedCourseName, setSelectedCourseName] = useState<string>("");
  const [selectedProgramCode, setSelectedProgramCode] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [aqSearchInput, setAqSearchInput] = useState<string>("");
  const [showAqDropdown, setShowAqDropdown] = useState<boolean>(false);

  // --- No AQ Required Toggle State ---
  const [noAqRequired, setNoAqRequired] = useState<boolean>(false);

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
    }, 1500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Load Table Data and Recommendations
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setSubjectAqs([]);
    setNoAqCount(0);

    const getNoAqCount = await fetchSubjectsCountNoAQ();
    setNoAqCount(getNoAqCount.count);

    const programParam =
      selectedProgramFilter === "ALL" ? null : selectedProgramFilter;

    const [resData, countRes, progRes] = await Promise.all([
      fetchSubjectsAQClusters(
        debouncedSearch,
        programParam,
        aqFilterState,
        sortBy,
        sortDir,
        maxRow,
        currentPage,
      ),
      fetchSubjectsAQClustersCount(
        debouncedSearch,
        programParam,
        aqFilterState,
      ),
      fetchPrograms
        ? fetchPrograms()
        : Promise.resolve({ success: false, data: [] }),
    ]);

    if (resData.success && resData.data) {
      setSubjectAqs(resData.data);
    } else {
      triggerToast(
        resData.error || "Failed to load subjects with AQ and clusters.",
        "error",
      );
    }

    if (countRes.success) {
      setTotalCount(countRes.count);
    }

    if (progRes.success && progRes.data) {
      setAllProgramsFilterList(progRes.data);
    }

    setIsLoading(false);
  }, [
    debouncedSearch,
    selectedProgramFilter,
    aqFilterState,
    sortBy,
    sortDir,
    maxRow,
    currentPage,
    triggerToast,
  ]);

  // Load suggestions separately for modal dropdown
  const loadAqSuggestions = useCallback(async (queryFilter: string | null) => {
    const [aqRes, clusterRes] = await Promise.all([
      fetchMaq(queryFilter, "aq", "ASC", 0, 10),
      fetchMaqClustersWithEntries(queryFilter, "cluster_name", "ASC", 10, 1),
    ]);

    const combinedSuggestions: SuggestionItem[] = [];
    const addedNames = new Set<string>();

    if (clusterRes.success && clusterRes.data) {
      clusterRes.data.forEach((cluster: MaqClusterWithEntriesRecord) => {
        if (cluster.cluster_name && !addedNames.has(cluster.cluster_name)) {
          addedNames.add(cluster.cluster_name);
          combinedSuggestions.push({
            name: cluster.cluster_name,
            type: "cluster",
            entries: cluster.entries || [],
          });
        }
      });
    }

    if (aqRes.success && aqRes.data) {
      aqRes.data.forEach((item: MaqRecord) => {
        if (item.aq && !addedNames.has(item.aq)) {
          addedNames.add(item.aq);
          combinedSuggestions.push({
            name: item.aq,
            type: "maq",
            entries: [],
          });
        }
      });
    }

    setAqOptions(combinedSuggestions);
    return combinedSuggestions;
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Handle suggestion lookups when typing inside the modal input
  useEffect(() => {
    if (openSyncModal) {
      const handler = setTimeout(() => {
        void loadAqSuggestions(aqSearchInput.trim() || null);
      }, 1500);
      return () => clearTimeout(handler);
    }
  }, [aqSearchInput, openSyncModal, loadAqSuggestions]);

  // Clear All Selected Items
  const handleClearAll = () => {
    setSelectedItems([]);
  };

  // Sorting
  const handleSorting = (column: string) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === "ASC" ? "DESC" : "ASC"));
    } else {
      setSortBy(column);
      setSortDir("ASC");
    }
  };

  const handleCloseModal = () => {
    setOpenSyncModal(false);
    setSelectedCourseName("");
    setSelectedProgramCode("");
    setSelectedItems([]);
    setAqSearchInput("");
    setShowAqDropdown(false);
    setNoAqRequired(false);
  };

  const handleOpenSync = async (record: SubjectAQClusterRecord) => {
    setSelectedCourseName(record.course_name);
    setSelectedProgramCode(record.program_code);

    const rawAqList = record.aq_list || [];

    // Check if the record explicitly contains a null entry (No AQ Required)
    const hasExplicitNull = rawAqList.includes("NULL");

    if (hasExplicitNull) {
      setNoAqRequired(true);
      setSelectedItems([]);
    } else {
      setNoAqRequired(false);
      const items: SelectedItem[] = [];
      const processedAqs = new Set<string>();

      const suggestions = await loadAqSuggestions(null);
      const clusterNamesInRecord = record.cluster_names || [];

      suggestions.forEach((opt) => {
        if (opt.type === "cluster") {
          const clusterEntryNames = (opt.entries || [])
            .map((e) => (typeof e === "string" ? e : e.aq))
            .filter(Boolean);

          const hasAllEntries =
            clusterEntryNames.length > 0 &&
            clusterEntryNames.every((entryAq) => rawAqList.includes(entryAq));

          const isExactSize = rawAqList.length === clusterEntryNames.length;

          const matchesCluster =
            (hasAllEntries && isExactSize) ||
            clusterNamesInRecord.includes(opt.name);

          if (matchesCluster) {
            items.push({ name: opt.name, type: "cluster" });
            clusterEntryNames.forEach((aq) => processedAqs.add(aq));
          }
        }
      });

      rawAqList.forEach((aq) => {
        if (aq !== null && !processedAqs.has(aq)) {
          items.push({ name: aq, type: "maq" });
        }
      });

      setSelectedItems(items);
    }

    setAqSearchInput("");
    setShowAqDropdown(false);
    setOpenSyncModal(true);
  };

  // Filter AQ options for dropdown based on input and existing selections
  const trimmedAqInput = aqSearchInput.trim();
  const filteredAqOptions = aqOptions.filter((opt) =>
    opt.name.toLowerCase().includes(trimmedAqInput.toLowerCase()),
  );

  // Enforce single cluster limit in UI option filtering
  const hasClusterSelected = selectedItems.some(
    (item) => item.type === "cluster",
  );
  const clusterOptions = filteredAqOptions.filter(
    (opt) => opt.type === "cluster" && !hasClusterSelected,
  );

  const selectedNamesSet = new Set(selectedItems.map((item) => item.name));
  const maqOptionsList = filteredAqOptions.filter(
    (opt) => opt.type === "maq" && !selectedNamesSet.has(opt.name),
  );

  const handleAqInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAqSearchInput(val);
    setShowAqDropdown(val.trim().length > 0);
  };

  const handleSelectMaq = (name: string) => {
    if (!selectedItems.some((item) => item.name === name)) {
      setSelectedItems((prev) => [...prev, { name, type: "maq" }]);
    }
    setAqSearchInput("");
    setShowAqDropdown(false);
  };

  const handleSelectCluster = (clusterItem: SuggestionItem) => {
    // Prevent adding more than one cluster
    if (selectedItems.some((item) => item.type === "cluster")) {
      triggerToast("Only one cluster can be selected at a time.", "warning");
      return;
    }

    if (!selectedItems.some((item) => item.name === clusterItem.name)) {
      setSelectedItems((prev) => [
        ...prev,
        { name: clusterItem.name, type: "cluster" },
      ]);
    }

    setAqSearchInput("");
    setShowAqDropdown(false);
  };

  const handleRemoveItem = (nameToRemove: string) => {
    setSelectedItems((prev) =>
      prev.filter((item) => item.name !== nameToRemove),
    );
  };

  const handleSyncSubmit = async () => {
    if (!selectedCourseName.trim() || !selectedProgramCode.trim()) return;

    startTransition(async () => {
      const actorEmail =
        activeAccount?.username || activeAccount?.name || "system_user";

      // Explicitly type as (string | null>[] | null) or cast safely if your backend type requires it
      let expandedAqs: (string | null)[] | null;

      if (noAqRequired) {
        expandedAqs = [null]; // Submits [null] when toggle is active to indicate "AQ not required"
      } else {
        const collectedAqs: string[] = [];
        selectedItems.forEach((item) => {
          if (item.type === "cluster") {
            const foundCluster = aqOptions.find(
              (opt) => opt.name === item.name && opt.type === "cluster",
            );
            if (foundCluster && foundCluster.entries) {
              foundCluster.entries.forEach((entry) => {
                const entryAq = typeof entry === "string" ? entry : entry.aq;
                if (entryAq && !collectedAqs.includes(entryAq)) {
                  collectedAqs.push(entryAq);
                }
              });
            }
          } else {
            if (!collectedAqs.includes(item.name)) {
              collectedAqs.push(item.name);
            }
          }
        });
        expandedAqs = collectedAqs;
      }

      const payload: SyncSubjectAQInput = {
        courseName: selectedCourseName,
        programCode: selectedProgramCode,
        aqs: expandedAqs as never, // Type assertion used here specifically to satisfy SyncSubjectAQInput if its type definition expects string[] instead of (string | null)[]
      };

      const res = await syncSubjectAQ(actorEmail, payload);

      if (res.success) {
        triggerToast(
          "Subject Academic Qualifications successfully synced!",
          "success",
        );
        handleCloseModal();
        void loadData();
      } else {
        triggerToast(
          res.error || "Failed to sync subject Academic Qualifications.",
          "error",
        );
      }
    });
  };

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

  const handleDownloadTemplate = async () => {
    try {
      const [subjectsRes, clustersRes, aqRes] = await Promise.all([
        fetchSubjectsAQClusters(null, null, "ALL", "course_name", "ASC", 10000, 1),
        fetchMaqClustersWithEntries(null, "cluster_name", "ASC", 10000, 1),
        fetchMaq(null, "aq", "ASC", 10000, 1),
      ]);

      if (!subjectsRes.success || !clustersRes.success || !aqRes.success) {
        throw new Error("Unable to load current subject, cluster, and AQ lists.");
      }

      const subjects = subjectsRes.data || [];
      const clusters = clustersRes.data || [];
      const aqs = aqRes.data || [];
      const workbook = new ExcelJS.Workbook();

      const instructions = workbook.addWorksheet("Instructions");
      instructions.addRows([
        ["Subject AQ Import Template Instructions"],
        ["Complete the Subject AQ sheet, then upload this workbook from Excel Operations."],
        ["Course Name and Program Code are prefilled from existing subjects; do not change them or add duplicate pairs."],
        ["Cluster is optional; select at most one existing cluster from the Clusters sheet."],
        ["Individual AQ is optional; enter existing AQ codes separated by commas (for example: AQ1, AQ2)."],
        ["No AQ Required must be Yes or No and defaults to No when blank. If Yes, leave Cluster and Individual AQ blank."],
        ["Leave No AQ Required as No and both AQ fields blank to clear all AQ assignments."],
        ["Do not rename the Subject AQ sheet or change its header row. Clusters and Individual AQ sheets are for lookup only."],
      ]);
      instructions.getColumn(1).width = 110;
      instructions.getRow(1).font = {
        bold: true,
        size: 16,
        color: { argb: "FF1D4ED8" },
      };
      instructions.getColumn(1).alignment = { wrapText: true, vertical: "top" };
      instructions.eachRow((row) => {
        row.height = 24;
      });

      const worksheet = workbook.addWorksheet("Subject AQ") as unknown as WorksheetWithValidation;
      worksheet.columns = [
        { header: "Course Name", key: "course_name", width: 40 },
        { header: "Program Code", key: "program_code", width: 20 },
        { header: "Cluster", key: "cluster", width: 35 },
        { header: "Individual AQ", key: "individual_aq", width: 45 },
        { header: "No AQ Required", key: "no_aq_required", width: 20 },
      ];
      worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2563EB" },
      };
      worksheet.views = [{ state: "frozen", ySplit: 1 }];

      const clusterEntriesByName = new Map(
        clusters.map((cluster) => [
          normalizeExcelValue(cluster.cluster_name),
          (cluster.entries || []).map((entry) =>
            typeof entry === "string" ? entry : entry.aq,
          ),
        ]),
      );
      const uniqueSubjects = new Map<string, SubjectAQClusterRecord>();
      subjects.forEach((subject) => {
        uniqueSubjects.set(
          `${normalizeExcelValue(subject.course_name)}\u0000${normalizeExcelValue(subject.program_code)}`,
          subject,
        );
      });

      uniqueSubjects.forEach((subject) => {
        const aqList = subject.aq_list || [];
        const noAqRequired = aqList.includes("NULL");
        const clusterName = subject.cluster_names?.[0] || "";
        const clusterEntries = clusterEntriesByName.get(normalizeExcelValue(clusterName)) || [];
        const individualAqs = noAqRequired
          ? []
          : aqList.filter((aq) => aq !== "NULL" && !clusterEntries.includes(aq));

        worksheet.addRow({
          course_name: subject.course_name,
          program_code: subject.program_code,
          cluster: noAqRequired ? "" : clusterName,
          individual_aq: individualAqs.join(", "),
          no_aq_required: noAqRequired ? "Yes" : "No",
        });
      });

      const clusterSheet = workbook.addWorksheet("Clusters");
      clusterSheet.columns = [
        { header: "Cluster Name", key: "cluster_name", width: 35 },
        { header: "Included AQ", key: "entries", width: 80 },
        { width: 4 },
      ];
      clusters.forEach((cluster) => {
        clusterSheet.addRow({
          cluster_name: cluster.cluster_name,
          entries: (cluster.entries || [])
            .map((entry) => (typeof entry === "string" ? entry : entry.aq))
            .join(", "),
        });
      });
      clusterSheet.getRow(1).font = { bold: true };
      workbook.definedNames.add("Clusters!$C$1", "NoClusterOptions");
      if (clusters.length > 0) {
        workbook.definedNames.add(
          `Clusters!$A$2:$A$${clusters.length + 1}`,
          "ClusterOptions",
        );
      }

      const individualAqSheet = workbook.addWorksheet("Individual AQ");
      individualAqSheet.columns = [{ header: "AQ", key: "aq", width: 45 }];
      aqs.forEach((item) => individualAqSheet.addRow({ aq: item.aq }));
      individualAqSheet.getRow(1).font = { bold: true };

      worksheet.dataValidations.add("C2:C1000", {
        type: "list",
        allowBlank: true,
        formulae: [
          clusters.length > 0
            ? 'IF(UPPER($E2)="YES",NoClusterOptions,ClusterOptions)'
            : "NoClusterOptions",
        ],
        showErrorMessage: true,
        errorTitle: "Invalid Cluster",
        error: "Select a cluster from the Clusters sheet only when No AQ Required is No.",
      });
      worksheet.dataValidations.add("E2:E1000", {
        type: "list",
        allowBlank: true,
        formulae: ['"Yes,No"'],
        showErrorMessage: true,
        errorTitle: "Invalid Value",
        error: "Choose Yes or No.",
      });
      worksheet.dataValidations.add("D2:D1000", {
        type: "custom",
        allowBlank: true,
        formulae: ['OR(UPPER($E2)<>"YES",D2="")'],
        showErrorMessage: true,
        errorTitle: "Individual AQ Not Allowed",
        error: 'Leave Individual AQ blank when "No AQ Required" is Yes.',
      });

      const buffer = await workbook.xlsx.writeBuffer();
      downloadWorkbook(buffer as ArrayBuffer, "Subject_AQ_Import_Template.xlsx");
      triggerToast("Subject AQ Excel template downloaded successfully.", "success");
    } catch (error) {
      triggerToast(
        error instanceof Error ? error.message : "Failed to create the Subject AQ template.",
        "error",
      );
    }
  };

  const handleExportExcel = async () => {
    try {
      const programParam = selectedProgramFilter === "ALL" ? null : selectedProgramFilter;
      const response = await fetchSubjectsAQClusters(
        debouncedSearch || null,
        programParam,
        aqFilterState,
        sortBy,
        sortDir,
        10000,
        1,
      );
      const exportList = response.success && response.data ? response.data : subjectAqs;

      if (exportList.length === 0) {
        triggerToast("No Subject AQ records match the current filters.", "warning");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Subject AQ");
      worksheet.columns = [
        { header: "Course Name", key: "course_name", width: 40 },
        { header: "Program Code", key: "program_code", width: 20 },
        { header: "Cluster", key: "cluster", width: 35 },
        { header: "Individual AQ", key: "individual_aq", width: 45 },
        { header: "No AQ Required", key: "no_aq_required", width: 20 },
      ];
      exportList.forEach((subject) => {
        const aqList = subject.aq_list || [];
        const noAqRequired = aqList.includes("NULL");
        worksheet.addRow({
          course_name: subject.course_name,
          program_code: subject.program_code,
          cluster: noAqRequired ? "" : subject.cluster_names?.[0] || "",
          individual_aq: noAqRequired
            ? ""
            : aqList.filter((aq) => aq !== "NULL").join(", "),
          no_aq_required: noAqRequired ? "Yes" : "No",
        });
      });
      worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2563EB" },
      };
      const buffer = await workbook.xlsx.writeBuffer();
      downloadWorkbook(
        buffer as ArrayBuffer,
        `Subject_AQ_Export_${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      triggerToast("Subject AQ records exported successfully.", "success");
    } catch (error) {
      triggerToast(
        error instanceof Error ? error.message : "Failed to export Subject AQ records.",
        "error",
      );
    }
  };

  const validateAndSelectFile = (file: File | null) => {
    setFormatError("");
    setImportResults([]);
    setImportStatus("");
    setImportFile(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setFormatError("Only .xlsx workbooks are supported for the multi-sheet Subject AQ template.");
      return;
    }
    setImportFile(file);
  };

  const handleImportSubmit = async () => {
    if (!importFile || isImporting) return;
    setIsImporting(true);
    setFormatError("");
    setImportResults([]);
    setImportStatus("Reading Subject AQ workbook...");
    const results: SubjectAqImportResult[] = [];

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await importFile.arrayBuffer());
      const worksheet = workbook.getWorksheet("Subject AQ");
      if (!worksheet) {
        throw new Error('The workbook must include a sheet named "Subject AQ".');
      }

      const headerRow = worksheet.getRow(1);
      const headerIndexes = new Map<string, number>();
      headerRow.eachCell((cell, columnNumber) => {
        const value = normalizeExcelValue(String(cell.text || cell.value || ""));
        if (value) headerIndexes.set(value, columnNumber);
      });
      const requiredHeaders = [
        "course name",
        "program code",
        "cluster",
        "individual aq",
        "no aq required",
      ];
      const missingHeaders = requiredHeaders.filter((header) => !headerIndexes.has(header));
      if (missingHeaders.length > 0) {
        throw new Error(`Missing required Subject AQ columns: ${missingHeaders.join(", ")}.`);
      }

      const [subjectsRes, clustersRes, aqRes] = await Promise.all([
        fetchSubjectsAQClusters(null, null, "ALL", "course_name", "ASC", 10000, 1),
        fetchMaqClustersWithEntries(null, "cluster_name", "ASC", 10000, 1),
        fetchMaq(null, "aq", "ASC", 10000, 1),
      ]);
      if (!subjectsRes.success || !clustersRes.success || !aqRes.success) {
        throw new Error("Unable to load current subjects, clusters, or AQ codes for validation.");
      }

      const validSubjectPairs = new Map(
        (subjectsRes.data || []).map((subject) => [
          `${normalizeExcelValue(subject.course_name)}\u0000${normalizeExcelValue(subject.program_code)}`,
          {
            courseName: subject.course_name,
            programCode: subject.program_code,
          },
        ]),
      );
      const clusterMap = new Map(
        (clustersRes.data || []).map((cluster) => [
          normalizeExcelValue(cluster.cluster_name),
          cluster,
        ]),
      );
      const aqMap = new Map(
        (aqRes.data || []).map((item) => [normalizeExcelValue(item.aq), item.aq]),
      );
      const seenPairs = new Set<string>();
      const rowsToProcess: {
        rowNumber: number;
        courseName: string;
        programCode: string;
        aqs: string[];
      }[] = [];
      let failedCount = 0;

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const courseName = readExcelCell(row, headerIndexes.get("course name")!);
        const programCode = readExcelCell(row, headerIndexes.get("program code")!);
        const clusterName = readExcelCell(row, headerIndexes.get("cluster")!);
        const individualAqValue = readExcelCell(row, headerIndexes.get("individual aq")!);
        const rawNoAqRequired = readExcelCell(row, headerIndexes.get("no aq required")!);

        if (!courseName && !programCode && !clusterName && !individualAqValue && !rawNoAqRequired) {
          return;
        }
        const failRow = (message: string) => {
          results.push({
            rowNumber,
            subject: [courseName, programCode].filter(Boolean).join(" / ") || "Subject AQ entry",
            status: "failed",
            description: message,
          });
          failedCount++;
        };

        if (!courseName || !programCode) {
          failRow("Course Name and Program Code are required.");
          return;
        }
        const pairKey = `${normalizeExcelValue(courseName)}\u0000${normalizeExcelValue(programCode)}`;
        const existingPair = validSubjectPairs.get(pairKey);
        if (!existingPair) {
          failRow("Course Name and Program Code must match an existing subject pair.");
          return;
        }
        if (seenPairs.has(pairKey)) {
          failRow("Duplicate Course Name and Program Code pair in this workbook.");
          return;
        }

        const noAqValue = normalizeExcelValue(rawNoAqRequired) || "no";
        if (noAqValue !== "yes" && noAqValue !== "no") {
          failRow('No AQ Required must be either "Yes" or "No".');
          return;
        }

        const individualNames = individualAqValue
          .split(",")
          .map((aq) => aq.trim())
          .filter(Boolean);
        if (noAqValue === "yes" && (clusterName || individualNames.length > 0)) {
          failRow('Cluster and Individual AQ must be blank when No AQ Required is "Yes".');
          return;
        }

        const cluster = clusterName
          ? clusterMap.get(normalizeExcelValue(clusterName))
          : undefined;
        if (clusterName && !cluster) {
          failRow(`Unknown cluster "${clusterName}". Select a cluster from the Clusters sheet.`);
          return;
        }

        const canonicalIndividualAqs: string[] = [];
        const rowAqNames = new Set<string>();
        for (const aqName of individualNames) {
          const normalizedAqName = normalizeExcelValue(aqName);
          if (rowAqNames.has(normalizedAqName)) {
            failRow(`Individual AQ "${aqName}" is listed more than once.`);
            return;
          }
          rowAqNames.add(normalizedAqName);
          const canonicalAq = aqMap.get(normalizedAqName);
          if (!canonicalAq) {
            failRow(`Unknown Individual AQ "${aqName}". Use a value from the Individual AQ sheet.`);
            return;
          }
          canonicalIndividualAqs.push(canonicalAq);
        }

        const expandedAqs = new Set<string>();
        if (cluster && noAqValue !== "yes") {
          (cluster.entries || []).forEach((entry) => {
            const aqName = typeof entry === "string" ? entry : entry.aq;
            if (aqName) expandedAqs.add(aqName);
          });
        }
        canonicalIndividualAqs.forEach((aqName) => expandedAqs.add(aqName));
        rowsToProcess.push({
          rowNumber,
          courseName: existingPair.courseName,
          programCode: existingPair.programCode,
          aqs: noAqValue === "yes" ? ([null] as never) : Array.from(expandedAqs),
        });
        seenPairs.add(pairKey);
      });

      if (rowsToProcess.length === 0 && failedCount === 0) {
        throw new Error("The Subject AQ sheet does not contain any data rows to import.");
      }

      setImportResults([...results]);
      setImportStatus(`${rowsToProcess.length} row(s) ready to import.`);
      let successCount = 0;
      const actorEmail = activeAccount?.username || activeAccount?.name || "system_user";
      for (const item of rowsToProcess) {
        const result = await syncSubjectAQ(actorEmail, {
          courseName: item.courseName,
          programCode: item.programCode,
          aqs: item.aqs,
        });
        if (result.success) {
          successCount++;
          results.push({
            rowNumber: item.rowNumber,
            subject: `${item.courseName} / ${item.programCode}`,
            status: "success",
            description: "Imported successfully.",
          });
        } else {
          failedCount++;
          results.push({
            rowNumber: item.rowNumber,
            subject: `${item.courseName} / ${item.programCode}`,
            status: "failed",
            description: result.error || "Import failed.",
          });
        }
        setImportResults([...results]);
      }

      setImportStatus("Import finished.");
      if (successCount > 0) void loadData();
      triggerToast(
        `Import complete: ${successCount} row(s) imported, ${failedCount} row(s) failed.`,
        failedCount > 0 ? "warning" : "success",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to import Subject AQ workbook.";
      setFormatError(message);
      results.push({
        rowNumber: null,
        subject: importFile.name,
        status: "failed",
        description: message,
      });
      setImportResults([...results]);
      setImportStatus("Import stopped.");
      triggerToast(message, "error");
    } finally {
      setIsImporting(false);
    }
  };

  const totalPages = Math.ceil(totalCount / maxRow) || 1;
  const successfulImportResults = importResults.filter(
    (result) => result.status === "success",
  );
  const failedImportResults = importResults.filter(
    (result) => result.status === "failed",
  );

  return (
    <div className="w-full min-w-0 space-y-4 p-4">
      {/* Page Header & Filters Bar */}
      <div className="flex min-w-0 flex-col gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Subject Academic Qualification Management
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage and sync course academic qualifications (AQ) configuration
            entries.
          </p>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {/* No Aq Warning */}
          {noAqCount !== 0 && (
            <Button
              color={"light"}
              className={"flex flex-wrap gap-2 border-transparent hover:border-black dark:hover:border-white"}
              onClick={() => setAqFilterState("NO_AQ")}
            >
              <HiExclamation className={"h-8 w-8 text-yellow-400"} />
              {noAqCount} Subject(s) have no set AQ
            </Button>
          )}

          {/* Program Filter Dropdown */}
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

          {/* AQ Status Filter Dropdown */}
          <div className="w-full sm:w-44">
            <Select
              id="aq-filter-select"
              value={aqFilterState}
              onChange={(e) => {
                setAqFilterState(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">All AQ Status</option>
              <option value="WITH_AQ">With AQ Assigned</option>
              <option value="NO_AQ_REQUIRED">No AQ Required</option>
              <option value="NO_AQ">No AQ Assigned</option>
            </Select>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2">
            <div className="w-full sm:w-64">
              <TextInput
                id="search-subject-aq"
                type="text"
                placeholder="Search course names..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                icon={HiSearch}
              />
            </div>
            <Button
              color="gray"
              className="ml-auto whitespace-nowrap"
              onClick={() => {
                setActiveExcelTab("import");
                setOpenExcelModal(true);
              }}
            >
              <FaFileExcel className="mr-2 h-4 w-4 text-green-600" />
              Excel Operations
            </Button>
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
                onClick={() => handleSorting("course_name")}
              >
                <div className="flex items-center gap-1">
                  <span>Course Name</span>
                  {sortBy === "course_name" &&
                    (sortDir === "ASC" ? (
                      <FaSortUp className="h-4 w-4" />
                    ) : (
                      <FaSortDown className="h-4 w-4" />
                    ))}
                </div>
              </TableHeadCell>
              <TableHeadCell
                className="cursor-pointer text-blue-500 select-none"
                onClick={() => handleSorting("program_code")}
              >
                <div className="flex items-center gap-1">
                  <span>Program</span>
                  {sortBy === "program_code" &&
                    (sortDir === "ASC" ? (
                      <FaSortUp className="h-4 w-4" />
                    ) : (
                      <FaSortDown className="h-4 w-4" />
                    ))}
                </div>
              </TableHeadCell>
              <TableHeadCell>Academic Qualification Entries</TableHeadCell>
              <TableHeadCell className="text-center">Actions</TableHeadCell>
            </TableRow>
          </TableHead>

          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Fetching Subject Academic Qualifications...
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : subjectAqs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  {searchTerm ||
                  selectedProgramFilter !== "ALL" ||
                  aqFilterState !== "ALL"
                    ? `No matching subject Academic Qualification records found.`
                    : "No subject Academic Qualification entries found."}
                </TableCell>
              </TableRow>
            ) : (
              subjectAqs.map((item, index) => {
                const entriesList = item.aq_list || [];

                return (
                  <TableRow
                    key={`subject-aq-${index}`}
                    className={`${entriesList.length == 0 ? "bg-yellow-300/20 dark:bg-yellow-700/20" : "bg-white dark:bg-gray-800"} dark:border-gray-700`}
                  >
                    <TableCell className="font-medium text-gray-900 dark:text-white">
                      {item.course_name}
                    </TableCell>
                    <TableCell className="text-gray-700 dark:text-gray-300">
                      <Badge
                        color="gray"
                        size="sm"
                        className="inline-block w-fit"
                      >
                        {item.program_code}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate">
                      {entriesList.length > 0 ? (
                        <div className="max-w-[320px] truncate">
                          {entriesList.length === 1 &&
                          entriesList[0] === "NULL" ? (
                            <span className="font-medium text-gray-600 dark:text-gray-300">
                              No AQ Required
                            </span>
                          ) : item.cluster_names &&
                            item.cluster_names.length > 0 ? (
                            <Tooltip
                              className={
                                "border-2 border-gray-900 bg-white text-gray-500 dark:border-white dark:bg-gray-800 dark:text-gray-300"
                              }
                              content={item.aq_list.map((entry, idx) => {
                                const aqLabel =
                                  entry === "NULL"
                                    ? "No AQ Required"
                                    : String(entry);
                                return <div key={idx}>{aqLabel}</div>;
                              })}
                              style={isDarkMode ? "light" : "dark"}
                            >
                              {item.cluster_names.join(", ")} [
                              {item.aq_list.length.toString()}]
                            </Tooltip>
                          ) : (
                            item.aq_list.map((entry, i) => {
                              const aqLabel =
                                entry === "NULL"
                                  ? "No AQ Required"
                                  : String(entry);
                              return (
                                <React.Fragment key={i}>
                                  {aqLabel}
                                  {i < entriesList.length - 1 ? ", " : ""}
                                </React.Fragment>
                              );
                            })
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          No entries
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="xs"
                        color="alternative"
                        onClick={() => void handleOpenSync(item)}
                        className="inline-flex items-center"
                      >
                        <HiPencil className="mr-1.5 h-3 w-3" />
                        Edit
                      </Button>
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

      {/* --- MODAL: EXCEL OPERATIONS --- */}
      <Modal
        show={openExcelModal}
        onClose={() => setOpenExcelModal(false)}
        size="lg"
        theme={{
          content: {
            inner: "relative flex max-h-[90dvh] flex-col overflow-hidden rounded-lg bg-slate-700 shadow-xl",
          },
        }}
      >
        <ModalHeader className="border-slate-600 bg-slate-700 px-6 py-5">
          <div className="flex items-center gap-2">
            <FaFileExcel className="h-5 w-5 shrink-0 text-emerald-500" />
            <span className="text-xl font-semibold text-white">
              Excel Operations & Subject AQ Management
            </span>
          </div>
        </ModalHeader>
        <ModalBody className="space-y-5 overflow-y-auto bg-slate-700 p-6 text-white">
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {([
                ["import", FaFileImport, "Import Excel", "text-blue-500"],
                ["export", FaFileExport, "Export Subjects", "text-emerald-500"],
                ["template", FaDownload, "Blank Template", "text-emerald-500"],
              ] as const).map(([tab, Icon, label, iconColor]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveExcelTab(tab)}
                  className={`flex min-h-[5.25rem] min-w-0 flex-col items-center justify-center rounded-xl border px-3 py-3 text-center transition-colors ${
                    activeExcelTab === tab
                      ? "border-blue-600 bg-slate-800 text-blue-300 shadow-sm"
                      : "border-slate-800 bg-slate-800 text-slate-300 hover:border-slate-600 hover:bg-slate-600"
                  }`}
                >
                  <Icon className={`mb-1.5 h-7 w-7 ${iconColor}`} />
                  <span className="text-xs font-semibold">{label}</span>
                </button>
              ))}
            </div>

            {activeExcelTab === "import" && (
              <div className="space-y-4">
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Choose or drop a Subject AQ Excel workbook"
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setIsDragging(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDragging(false);
                    validateAndSelectFile(event.dataTransfer.files?.[0] || null);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all ${
                    isDragging
                      ? "border-blue-500 bg-blue-950/30"
                      : "border-slate-800 bg-slate-800 hover:border-slate-600"
                  }`}
                >
                  <FileInput
                    id="subject-aq-excel-file"
                    ref={fileInputRef}
                    accept=".xlsx"
                    className="hidden"
                    onChange={(event) =>
                      validateAndSelectFile(event.target.files?.[0] || null)
                    }
                  />
                  <FaFileImport className="mb-2 h-9 w-9 text-blue-500" />
                  <p className="text-sm font-semibold text-white">
                    {importFile
                      ? importFile.name
                      : <>Drag & drop your Subject AQ workbook here or <span className="text-blue-300 underline underline-offset-2">browse</span></>}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {importFile
                      ? `${(importFile.size / 1024).toFixed(1)} KB`
                      : "Only .xlsx workbooks are supported"}
                  </p>
                </div>
                {formatError && <HelperText color="failure">{formatError}</HelperText>}

                <div className="rounded-xl border border-blue-900/60 bg-slate-800 p-3 text-xs leading-relaxed text-blue-200">
                  <span className="font-semibold">VALIDATION RULE:</span> Course and program pairs, clusters, AQ codes, duplicate rows, and No AQ Required rules are validated before saving. Blank No AQ Required values default to No.
                </div>

                {(importStatus || importResults.length > 0) && (
                  <section
                    aria-label="Subject AQ import summary and results"
                    aria-live="polite"
                    className="space-y-3 rounded-xl border border-slate-600 bg-slate-900 p-3"
                  >
                    {importResults.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-3">
                          <p className="text-xs text-emerald-300">Successful</p>
                          <p className="text-xl font-bold text-emerald-200">
                            {successfulImportResults.length}
                          </p>
                        </div>
                        <div className="rounded-lg border border-red-900 bg-red-950/40 p-3">
                          <p className="text-xs text-red-300">Failed</p>
                          <p className="text-xl font-bold text-red-200">
                            {failedImportResults.length}
                          </p>
                        </div>
                      </div>
                    )}

                    {importStatus && (
                      <p role="status" className="text-xs text-slate-300">
                        {importStatus}
                      </p>
                    )}

                    <div className="max-h-64 space-y-4 overflow-y-auto pr-1 text-xs">
                      <div>
                        <h4 className="mb-2 font-semibold text-emerald-300">
                          Successful rows ({successfulImportResults.length})
                        </h4>
                        {successfulImportResults.length > 0 ? (
                          <ul className="space-y-2">
                            {successfulImportResults.map((result, index) => (
                              <li
                                key={`success-${result.rowNumber}-${index}`}
                                className="break-words text-emerald-200"
                              >
                                <span className="font-semibold">
                                  {result.rowNumber === null
                                    ? "Workbook"
                                    : `Row ${result.rowNumber}`}:
                                </span>{" "}
                                {result.subject} — {result.description}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-slate-400">No successful rows to show.</p>
                        )}
                      </div>

                      <div>
                        <h4 className="mb-2 font-semibold text-red-300">
                          Failed rows ({failedImportResults.length})
                        </h4>
                        {failedImportResults.length > 0 ? (
                          <ul className="space-y-2">
                            {failedImportResults.map((result, index) => (
                              <li
                                key={`failed-${result.rowNumber}-${index}`}
                                className="break-words text-red-200"
                              >
                                <span className="font-semibold">
                                  {result.rowNumber === null
                                    ? "Workbook"
                                    : `Row ${result.rowNumber}`}:
                                </span>{" "}
                                {result.subject} — {result.description}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-slate-400">No failed rows.</p>
                        )}
                      </div>
                    </div>
                  </section>
                )}

                <Button
                  onClick={handleImportSubmit}
                  disabled={!importFile || isImporting}
                  className="w-full"
                >
                  {isImporting ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Validating and importing...
                    </>
                  ) : (
                    <>
                      <FaFileImport className="mr-2 h-4 w-4" />
                      Import Subject AQ
                    </>
                  )}
                </Button>
              </div>
            )}

            {activeExcelTab === "export" && (
              <div className="space-y-4 rounded-xl border border-slate-600 bg-slate-800 p-5">
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Export filtered Subject AQ records
                  </h4>
                  <p className="mt-1 text-xs text-slate-400">
                    Exports all records matching the current search, program, and AQ status filters.
                  </p>
                </div>
                <Button onClick={handleExportExcel} className="w-full" color="green">
                  <FaFileExport className="mr-2 h-4 w-4" />
                  Export {totalCount} Subject AQ Records
                </Button>
              </div>
            )}

            {activeExcelTab === "template" && (
              <div className="space-y-4 rounded-xl border border-slate-600 bg-slate-800 p-5">
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Download Subject AQ Excel Template
                  </h4>
                  <p className="mt-1 text-xs text-slate-400">
                    Includes Instructions, prefilled subjects on the Subject AQ sheet, and reference sheets for clusters and individual AQs.
                  </p>
                </div>
                <Button onClick={handleDownloadTemplate} className="w-full" color="blue">
                  <FaDownload className="mr-2 h-4 w-4" />
                  Download Excel Template
                </Button>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter className="justify-end border-t border-slate-600 bg-slate-700 px-6 py-5">
          <Button
            color="alternative"
            className="border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-600 focus:ring-slate-500"
            onClick={() => setOpenExcelModal(false)}
          >
            Close Window
          </Button>
        </ModalFooter>
      </Modal>

      {/* --- MODAL: SYNC SUBJECT AQ (Structured Section Dropdown Layout) --- */}
      {openSyncModal && (
        <Modal show={openSyncModal} onClose={handleCloseModal} size="md">
          <ModalHeader>Sync Academic Qualification Entries</ModalHeader>
          <ModalBody className="space-y-4 overflow-visible">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="mb-1 block text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">
                  Course Name
                </span>
                <p className="text-base font-medium text-gray-900 dark:text-white">
                  {selectedCourseName}
                </p>
              </div>
              <div>
                <span className="mb-1 block text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">
                  Program Code
                </span>
                <p className="text-base font-medium text-gray-900 dark:text-white">
                  {selectedProgramCode}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  No AQ Required
                </span>
                <ToggleSwitch
                  checked={noAqRequired}
                  label=""
                  onChange={(checked) => {
                    setNoAqRequired(checked);
                    if (checked) {
                      setSelectedItems([]); // Clear selected items when toggled on
                    }
                  }}
                />
              </div>

              {!noAqRequired && (
                <>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <Label>Academic Qualifications (AQ)</Label>
                      <Tooltip
                        style={isDarkMode ? "dark" : "light"}
                        content={
                          "Select and add AQ by searching and clicking on the reccomendations that appear. (Only one Cluster can be added.)"
                        }
                      >
                        <HiQuestionMarkCircle
                          className={"h-5 w-5 text-gray-400"}
                        />
                      </Tooltip>
                    </div>

                    {/* AQ Suggestion Input */}
                    <div className="relative mb-2">
                      <TextInput
                        placeholder="Type to search qualification or cluster..."
                        value={aqSearchInput}
                        onChange={handleAqInputChange}
                        onFocus={() => {
                          if (aqSearchInput.trim().length > 0) {
                            setShowAqDropdown(true);
                          }
                        }}
                        color="gray"
                      />

                      {/* Structured Dropdown Menu */}
                      {showAqDropdown && trimmedAqInput.length > 0 && (
                        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                          {filteredAqOptions.length === 0 ? (
                            <div className="p-4 text-center text-xs text-gray-400 dark:text-gray-500">
                              No qualifications or clusters found.
                            </div>
                          ) : (
                            <>
                              {/* Clusters Section */}
                              {clusterOptions.length > 0 && (
                                <div>
                                  <div className="border-b border-gray-100 bg-gray-50 px-3 py-1.5 text-[10px] font-bold tracking-wider text-gray-500 uppercase dark:border-gray-700 dark:bg-gray-700 dark:text-gray-400">
                                    Clusters
                                  </div>
                                  {clusterOptions.map((opt) => {
                                    const subEntries = opt.entries || [];
                                    const subEntriesLabels = subEntries
                                      .map((entry: MaqClusterEntryItem) =>
                                        typeof entry === "string"
                                          ? entry
                                          : entry.aq,
                                      )
                                      .filter(Boolean);

                                    return (
                                      <div
                                        key={opt.name}
                                        className="dark:hover:bg-gray-750 cursor-pointer border-b border-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:text-black"
                                        onClick={() => handleSelectCluster(opt)}
                                      >
                                        <div className="flex items-center gap-2 font-medium">
                                          <MdFolderCopy className="h-4 w-4 shrink-0 text-blue-500" />
                                          <span>{opt.name}</span>
                                        </div>
                                        {subEntriesLabels.length > 0 && (
                                          <div className="mt-1 ml-6 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 dark:hover:text-black">
                                            <span>└</span>
                                            <span className="truncate">
                                              {subEntriesLabels.join(", ")}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Individual Qualifications Section */}
                              {maqOptionsList.length > 0 && (
                                <div>
                                  <div className="border-b border-gray-100 bg-gray-50 px-3 py-1.5 text-[10px] font-bold tracking-wider text-gray-500 uppercase dark:border-gray-700 dark:bg-gray-700 dark:text-gray-400">
                                    Individual Qualifications
                                  </div>
                                  {maqOptionsList.map((opt) => (
                                    <div
                                      key={opt.name}
                                      className="dark:hover:bg-gray-750 flex cursor-pointer items-center gap-2 border-b border-gray-100 px-3 py-2 text-sm text-gray-700 last:border-none hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:text-black"
                                      onClick={() => handleSelectMaq(opt.name)}
                                    >
                                      <IoMdDocument className="h-4 w-4 shrink-0 text-gray-400" />
                                      <span className="truncate">
                                        {opt.name}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Selected AQ / Cluster Badges List */}
                    <div className="flex min-h-[42px] flex-col gap-2 rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-1.5 dark:border-gray-700">
                        <span className="text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">
                          Selected Qualifications & Clusters
                        </span>
                        {selectedItems.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearAll}
                            className="text-xs font-semibold text-red-500 transition-colors hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Clear All
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {selectedItems.length === 0 ? (
                          <span className="self-center py-1 text-xs text-gray-400 dark:text-gray-500">
                            Type above to search and add academic qualifications
                            or clusters...
                          </span>
                        ) : (
                          selectedItems.map((item) => {
                            const isCluster = item.type === "cluster";
                            return (
                              <Badge
                                key={item.name}
                                color={isCluster ? "blue" : "gray"}
                                size="sm"
                                className={
                                  isCluster
                                    ? "bg-blue-500 text-white dark:bg-blue-600 [&>span]:text-white"
                                    : ""
                                }
                              >
                                <span className="inline-flex items-center gap-1.5 py-0.5 text-white">
                                  {isCluster ? (
                                    <MdFolderCopy className="h-3.5 w-3.5 shrink-0 text-white" />
                                  ) : (
                                    <IoMdDocument className="h-3.5 w-3.5 shrink-0" />
                                  )}
                                  <span>{item.name}</span>
                                  <HiX
                                    className="h-3.5 w-3.5 shrink-0 cursor-pointer hover:text-red-300"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveItem(item.name);
                                    }}
                                  />
                                </span>
                              </Badge>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              onClick={handleSyncSubmit}
              disabled={
                !selectedCourseName.trim() ||
                !selectedProgramCode.trim() ||
                isPending
              }
            >
              {isPending ? (
                <Spinner size="sm" className="mr-2" />
              ) : (
                <FaSync className="mr-2 h-3 w-3" />
              )}
              Save & Sync Qualifications
            </Button>
            <Button color="alternative" onClick={handleCloseModal}>
              Cancel
            </Button>
          </ModalFooter>
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
