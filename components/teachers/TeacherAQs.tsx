"use client";

import {
  Badge,
  Button,
  Card,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
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
  Tooltip,
  FileInput,
  Progress,
} from "flowbite-react";
import TablePaginationFooter from "@/components/TablePaginationFooter";
import ImportResultsPanel from "@/components/ImportResultsPanel";
import { useEffect, useRef, useState } from "react";
import {
  FaGraduationCap,
  FaPlus,
  FaSortDown,
  FaSortUp,
  FaFileExcel,
  FaFileImport,
  FaFileExport,
  FaDownload,
} from "react-icons/fa6";
import {
  HiCheck,
  HiExclamation,
  HiLockClosed,
  HiSearch,
  HiTrash,
  HiX,
} from "react-icons/hi";
import { IoMdDocument } from "react-icons/io";
import { IoRefresh } from "react-icons/io5";
import { MdFolderCopy } from "react-icons/md";
import {
  AQRecord,
  createTeacherAQ,
  deleteTeacherAQ,
  fetchTeacherAQRecords,
  fetchTeachers,
  fetchMaq,
  fetchMaqClustersWithEntries,
  MaqClusterEntryItem,
  MaqClusterWithEntriesRecord,
  MaqRecord,
  TeacherRecord,
  updateTeacherAQ,
  JSONValue,
} from "@/app/actions/system";
import ExcelJS from "exceljs";

interface SuggestionItem {
  name: string;
  type: "maq" | "cluster";
  entries: MaqClusterEntryItem[];
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

const REQUIRED_AQ_HEADERS = [
  "Teacher Code",
  "Academic Qualification",
  "Status",
  "Add Cluster",
  "Add Individual AQ",
];

export default function TeacherAQs() {
  const [isLoading, setLoading] = useState(true);

  // --- Main Data States --- //
  const [teachersList, setTeachersList] = useState<TeacherRecord[]>([]);
  const [teachersCount, setTeachersCount] = useState(0);
  const [aqRecords, setAqRecords] = useState<AQRecord[]>([]);

  // --- Filtering & Search --- //
  const [searchTerm, setSearchTerm] = useState("");
  const [employmentFilter, setEmploymentFilter] = useState(
    "All Employment Types",
  );
  const [departmentFilter, setDepartmentFilter] = useState("All Departments");
  const [sortBy, setSortBy] = useState("surname");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("ASC");

  // --- Inspector Panel State --- //
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherRecord | null>(
    null,
  );

  // --- Add AQ Searchable Modal States --- //
  const [isAddAQOpen, setIsAddAQOpen] = useState(false);
  const [aqSearchQuery, setAqSearchQuery] = useState("");
  const [aqSearchResults, setAqSearchResults] = useState<SuggestionItem[]>([]);
  const [selectedAQOption, setSelectedAQOption] = useState("");
  const [selectedAQItem, setSelectedAQItem] = useState<SuggestionItem | null>(null);
  const [isAQLocked, setIsAQLocked] = useState(false);
  const [isSearchingAqs, setIsSearchingAqs] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [aqSubmitError, setAqSubmitError] = useState("");
  const [isSubmittingAQ, setIsSubmittingAQ] = useState(false);

  // --- Delete Confirmation Modal States --- //
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [aqToDelete, setAqToDelete] = useState<AQRecord | null>(null);
  const [isDeletingAQ, setIsDeletingAQ] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // --- Pagination --- //
  const limit = 10;
  const [currentPage, setCurrentPage] = useState(1);

  // --- Toast Constants --- //
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [toastMessage, setToastMessage] = useState("");
  const [progress, setProgress] = useState(0);

  // --- Excel Operations States --- //
  const [openExcelModal, setOpenExcelModal] = useState(false);
  const [activeExcelTab, setActiveExcelTab] = useState<"import" | "export" | "template">("import");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [formatError, setFormatError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- All MAQ & Clusters for Excel Dropdowns --- //
  const [allMaqNames, setAllMaqNames] = useState<string[]>([]);
  const [allClusterNames, setAllClusterNames] = useState<string[]>([]);
  const [allClustersData, setAllClustersData] = useState<MaqClusterWithEntriesRecord[]>([]);
  const [isLoadingAqDropdowns, setIsLoadingAqDropdowns] = useState(false);

  const triggerToast = (type: "success" | "error", message: string) => {
    setToastType(type);
    setToastMessage(message);
    setShowToast(true);
    setProgress(0);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showToast) {
      timer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(timer);
            setShowToast(false);
            return 100;
          }
          return prev + 3.33;
        });
      }, 100);
    }
    return () => clearInterval(timer);
  }, [showToast]);

  // Load all MAQ names and cluster names for Excel dropdowns
  useEffect(() => {
    const loadAqDropdownData = async () => {
      setIsLoadingAqDropdowns(true);
      try {
        const [maqRes, clusterRes] = await Promise.all([
          fetchMaq(null, "aq", "ASC", 0),
          fetchMaqClustersWithEntries(null, "cluster_name", "ASC", 1000, 1),
        ]);
        if (maqRes?.success && maqRes.data) {
          setAllMaqNames(maqRes.data.map((m: MaqRecord) => m.aq).filter(Boolean));
        }
        if (clusterRes?.success && clusterRes.data) {
          setAllClusterNames(
            clusterRes.data.map((c: MaqClusterWithEntriesRecord) => c.cluster_name).filter(Boolean),
          );
          setAllClustersData(clusterRes.data);
        }
      } catch (err) {
        console.error("Failed to load AQ dropdown data:", err);
      } finally {
        setIsLoadingAqDropdowns(false);
      }
    };
    void loadAqDropdownData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSorting = (column: string) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === "ASC" ? "DESC" : "ASC"));
    } else {
      setSortBy(column);
      setSortDir("ASC");
    }
  };

  const loadData = async (
    page = currentPage,
    activeFilter = employmentFilter,
  ) => {
    setLoading(true);

    try {
      const filterParam =
        activeFilter === "All Employment Types" ? undefined : activeFilter;
      const deptParam =
        departmentFilter === "All Departments" ? undefined : departmentFilter;

      const [teacherRes, aqRes] = await Promise.all([
        fetchTeachers(
          searchTerm,
          filterParam as never,
          deptParam,
          sortBy,
          sortDir,
          limit,
          page,
        ),
        fetchTeacherAQRecords(
          undefined,
          undefined,
          undefined,
          "created_at",
          "DESC",
          1000,
          1,
        ),
      ]);

      if (teacherRes?.success && teacherRes.data) {
        setTeachersList(teacherRes.data);
        setTeachersCount(
          (teacherRes as { count?: number }).count || teacherRes.data.length,
        );
      }

      if (aqRes?.success && aqRes.data) {
        setAqRecords(aqRes.data);
      }
    } catch (err) {
      triggerToast("error", "Failed to fetch data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setCurrentPage(1);
      void loadData(1, employmentFilter);
    }, 1500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  useEffect(() => {
    void loadData(currentPage, employmentFilter);
  }, [currentPage, departmentFilter, sortBy, sortDir]);

  const handleAQSearch = async (query: string) => {
    setIsSearchingAqs(true);
    setAqSubmitError("");

    try {
      const [aqRes, clusterRes] = await Promise.all([
        fetchMaq(query || undefined, "aq", "ASC", 0),
        fetchMaqClustersWithEntries(query || undefined, "cluster_name", "ASC", 10, 1),
      ]);

      // Get list of AQs already assigned to this teacher to filter them out
      const existingTeacherAqNames = getTeacherAQs(
        selectedTeacher?.pscs_id,
      ).map((rec) => rec.aq.toLowerCase().trim());

      const combinedSuggestions: SuggestionItem[] = [];
      const addedNames = new Set<string>();

      // Add clusters first
      if (clusterRes?.success && clusterRes.data) {
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

      // Add individual AQs
      if (aqRes?.success && aqRes.data) {
        aqRes.data.forEach((item: MaqRecord) => {
          const aqName = item.aq;
          if (
            aqName &&
            !addedNames.has(aqName) &&
            !existingTeacherAqNames.includes(aqName.toLowerCase().trim())
          ) {
            addedNames.add(aqName);
            combinedSuggestions.push({
              name: aqName,
              type: "maq",
              entries: [],
            });
          }
        });
      }

      setAqSearchResults(combinedSuggestions);
    } catch (error) {
      setAqSearchResults([]);
    } finally {
      setIsSearchingAqs(false);
    }
  };

  useEffect(() => {
    if (isAddAQOpen && selectedTeacher) {
      const initialQuery = selectedTeacher.department || "";
      setAqSearchQuery(initialQuery);
      setSelectedAQOption("");
      setSelectedAQItem(null);
      setIsAQLocked(false);
      setShowSuggestions(true);
      void handleAQSearch(initialQuery);
    }
  }, [isAddAQOpen, selectedTeacher]);

  const handleAQQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAqSearchQuery(val);
    setSelectedAQOption("");
    setIsAQLocked(false);
    setShowSuggestions(true);

    const delayDebounce = setTimeout(() => {
      void handleAQSearch(val);
    }, 1500);

    return () => clearTimeout(delayDebounce);
  };

  const handleSelectAQ = (item: SuggestionItem) => {
    setSelectedAQOption(item.name);
    setSelectedAQItem(item);
    setAqSearchQuery(item.name);
    setIsAQLocked(true);
    setShowSuggestions(false);
    setAqSubmitError("");
  };

  const handleUnlockAQ = () => {
    setIsAQLocked(false);
    setSelectedAQOption("");
    setSelectedAQItem(null);
    setShowSuggestions(true);
  };

  const clusterOptions = aqSearchResults.filter((item) => item.type === "cluster");
  const maqOptions = aqSearchResults.filter((item) => item.type === "maq");

  const getTeacherAQs = (pscsId?: string | null) => {
    if (!pscsId) return [];
    return aqRecords.filter((rec) => rec.pscs_id === pscsId);
  };

  const getAQStatusCounts = (pscsId?: string | null) => {
    const list = getTeacherAQs(pscsId);
    let approved = 0;
    let pending = 0;
    let failed = 0;
    let denied = 0;

    list.forEach((rec) => {
      const status = (rec.approved || "").toLowerCase();
      if (status === "approved") {
        approved++;
      } else if (status === "pending") {
        pending++;
      } else if (status === "denied") {
        denied++;
      } else if (status === "failed") {
        failed++;
      } else {
        failed++;
      }
    });

    return { approved, pending, failed, denied };
  };

  const renderStatusBadge = (status?: string) => {
    switch ((status || "").toLowerCase()) {
      case "approved":
        return <Badge color="success">Approved</Badge>;
      case "pending":
        return <Badge color="warning">Pending</Badge>;
      case "denied":
        return <Badge color="red">Denied</Badge>;
      case "failed":
      default:
        return <Badge color="gray">Failed</Badge>;
    }
  };

  const handleStatusChange = async (aqRecord: AQRecord, newStatus: string) => {
    const res = await updateTeacherAQ(
      aqRecord.aq_id,
      aqRecord.pscs_id ?? undefined,
      aqRecord.aq,
      aqRecord.contents || {},
      newStatus,
    );

    if (res?.success) {
      triggerToast("success", `AQ Status updated to ${newStatus}!`);
      setAqRecords((prev) =>
        prev.map((rec) =>
          rec.aq_id === aqRecord.aq_id ? { ...rec, approved: newStatus } : rec,
        ),
      );
    } else {
      triggerToast("error", res?.error || "Failed to update status.");
    }
  };

  const confirmDeleteAQ = (record: AQRecord) => {
    setAqToDelete(record);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteAQConfirmed = async () => {
    if (!aqToDelete) return;

    setIsDeletingAQ(true);
    const res = await deleteTeacherAQ(aqToDelete.aq_id);
    setIsDeletingAQ(false);

    if (res?.success) {
      triggerToast("success", "Academic Qualification removed successfully!");
      setAqRecords((prev) =>
        prev.filter((rec) => rec.aq_id !== aqToDelete.aq_id),
      );
      setIsDeleteModalOpen(false);
      setAqToDelete(null);
    } else {
      triggerToast(
        "error",
        res?.error || "Failed to remove Academic Qualification.",
      );
    }
  };

  const handleAddAQSubmit = async () => {
    if (!selectedAQOption || selectedAQOption.trim() === "") {
      setAqSubmitError(
        "Please search and select a valid Academic Qualification from the list.",
      );
      return;
    }

    if (!selectedAQItem) {
      setAqSubmitError(
        "Selected Academic Qualification does not exist in system records or is already assigned.",
      );
      return;
    }

    if (!selectedTeacher?.pscs_id) {
      setAqSubmitError("Selected teacher is missing a valid PSCS ID.");
      return;
    }

    setIsSubmittingAQ(true);
    setAqSubmitError("");

    const aqNames: string[] = [];

    if (selectedAQItem.type === "cluster") {
      // For clusters, collect all individual AQ names from entries
      const entries = selectedAQItem.entries || [];
      entries.forEach((entry: MaqClusterEntryItem) => {
        const aqName = typeof entry === "string" ? entry : entry.aq;
        if (aqName) {
          aqNames.push(aqName);
        }
      });
    } else {
      // For individual AQs, use the selected name
      aqNames.push(selectedAQOption);
    }

    if (aqNames.length === 0) {
      setAqSubmitError("No valid Academic Qualifications found in selection.");
      setIsSubmittingAQ(false);
      return;
    }

    try {
      let successCount = 0;
      let firstError: string | null = null;

      for (const aqName of aqNames) {
        const customAqCode = `AQ-${Date.now()}-${successCount}`;
        const aqContents: Record<string, JSONValue> = {
          custom_aq_id: customAqCode,
        };

        const res = await createTeacherAQ(
          selectedTeacher.pscs_id,
          aqName,
          aqContents,
          "Approved",
        );

        if (res?.success) {
          successCount++;
        } else {
          if (!firstError) {
            firstError = res?.error || "Failed to add one or more Academic Qualifications.";
          }
        }
      }

      if (successCount > 0) {
        if (firstError && successCount < aqNames.length) {
          triggerToast(
            "success",
            `${successCount} of ${aqNames.length} Academic Qualifications added successfully.`,
          );
        } else {
          triggerToast("success", "Academic Qualification(s) added successfully!");
        }
        await loadData(currentPage, employmentFilter);
        closeAqAddModal();
      } else {
        setAqSubmitError(firstError || "Failed to add Academic Qualification.");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setAqSubmitError(message);
    } finally {
      setIsSubmittingAQ(false);
    }
  };

  const filteredTeachers = teachersList.filter((teacher) => {
    const matchesEmployment =
      employmentFilter === "All Employment Types" ||
      teacher.employment_type === employmentFilter;

    const query = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !query ||
      (teacher.full_name || "").toLowerCase().includes(query) ||
      (teacher.teacher_code || "").toLowerCase().includes(query) ||
      (teacher.email || "").toLowerCase().includes(query);

    return matchesEmployment && matchesSearch;
  });

  function closeAqAddModal() {
    setIsAddAQOpen(false);
    setSelectedAQOption("");
    setSelectedAQItem(null);
    setAqSearchQuery("");
    setIsAQLocked(false);
  }

  // --- Excel Helper Functions --- //

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

  // Helper to count AQ statuses from a list of AQRecord objects (standalone, not using component state)
  const getAQStatusCountsFromRecords = (records: AQRecord[]) => {
    let approved = 0,
      pending = 0,
      failed = 0,
      denied = 0;
    records.forEach((rec) => {
      const status = (rec.approved || "").toLowerCase();
      if (status === "approved") approved++;
      else if (status === "pending") pending++;
      else if (status === "denied") denied++;
      else if (status === "failed") failed++;
      else failed++;
    });
    return { approved, pending, failed, denied };
  };

  const handleDownloadTemplate = async () => {
    try {
      // Fetch all teachers for the template
      const teacherRes = await fetchTeachers(
        null,
        "All Active & On Leave",
        "All Departments",
        "surname",
        "ASC",
        10000,
        1,
      );
      const templateTeachers =
        teacherRes?.success && Array.isArray(teacherRes.data) ? teacherRes.data : [];

      // Fetch all AQ records for pre-filling existing AQ data
      const aqRes = await fetchTeacherAQRecords(
        undefined,
        undefined,
        undefined,
        "created_at",
        "DESC",
        10000,
        1,
      );
      const templateAqs = aqRes?.success && Array.isArray(aqRes.data) ? aqRes.data : [];

      const workbook = new ExcelJS.Workbook();

      // --- Sheet 1: Instructions ---
      const instructionsSheet = workbook.addWorksheet("Instructions");
      instructionsSheet.columns = [
        { header: "", key: "step", width: 8 },
        { header: "Instruction", key: "instruction", width: 80 },
      ];

      const instructions = [
        "Welcome to the Teacher AQ Batch Upload Template.",
        "This workbook contains 4 sheets: Instructions, TeacherAQ, AQ Cluster, and Individual AQ.",
        "",
        "STEP 1: Open the 'TeacherAQ' sheet. You will see all teachers pre-filled with their information.",
        "Columns A-E (Teacher Code, Name, Department, Employment, Total AQ) are READ-ONLY and cannot be edited.",
        "",
        "STEP 2: To add Academic Qualifications (AQs) to a teacher, use columns F and G:",
        "  - Column F (Add Cluster): Enter cluster names separated by commas (e.g., 'Bachelor of Science in Nursing, Master of Arts in Education').",
        "  - Column G (Add Individual AQ): Enter individual AQ names separated by commas (e.g., 'TESDA NC II in Cooking, TESDA NC II in Bread and Pastry Production').",
        "",
        "STEP 3: To find valid AQ names, refer to the 'AQ Cluster' and 'Individual AQ' sheets.",
        "  - 'AQ Cluster' sheet lists all available clusters and their entry AQs.",
        "  - 'Individual AQ' sheet lists all available individual Academic Qualifications.",
        "  - Copy the exact name from these reference sheets and paste it into the TeacherAQ sheet.",
        "",
        "STEP 4: You can add multiple AQs in a single cell by separating them with commas.",
        "  Example for Column F: 'Cluster Name 1, Cluster Name 2'",
        "  Example for Column G: 'Individual AQ 1, Individual AQ 2'",
        "",
        "STEP 5: When a cluster is added, it automatically expands to include all its entry AQs.",
        "",
        "STEP 6: Save the file and return to the system. Go to Excel Operations > Import Excel and upload your edited file.",
        "",
        "IMPORTANT NOTES:",
        "- Only the TeacherAQ sheet is read during import. Do not rename or delete it.",
        "- Do not edit columns A-E in the TeacherAQ sheet. Only edit columns F and G.",
        "- AQ names must match exactly as listed in the reference sheets. Typos will cause validation errors.",
        "- Status defaults to 'Approved' for all imported AQs.",
        "- Leave a cell blank if you do not want to add any AQ of that type for that teacher.",
      ];

      instructions.forEach((text, index) => {
        const row = instructionsSheet.addRow({
          step: index + 1,
          instruction: text,
        });
        if (text === "") {
          row.getCell(2).value = "";
        } else if (
          text.startsWith("STEP") ||
          text.startsWith("IMPORTANT") ||
          text.startsWith("Welcome")
        ) {
          row.getCell(2).font = { bold: true, size: 12 };
        } else if (text.startsWith("  -") || text.startsWith("  Example")) {
          row.getCell(2).font = { italic: true };
        }
      });

      // --- Sheet 2: AQ Cluster (Reference) ---
      const clusterSheet = workbook.addWorksheet("AQ Cluster") as WorksheetWithValidation;
      clusterSheet.columns = [
        { header: "Cluster Name", key: "cluster_name", width: 40 },
        { header: "Entry AQs", key: "entry_aqs", width: 80 },
      ];

      // Style cluster header
      const clusterHeaderRow = clusterSheet.getRow(1);
      clusterHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      clusterHeaderRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4A90D9" },
      };

      allClustersData.forEach((cluster: MaqClusterWithEntriesRecord) => {
        const entryNames = (cluster.entries || [])
          .map((entry: MaqClusterEntryItem) => (typeof entry === "string" ? entry : entry.aq))
          .filter(Boolean);
        const row = clusterSheet.addRow({
          cluster_name: cluster.cluster_name || "",
          entry_aqs: entryNames.join(", "),
        });
        row.getCell(1).font = { bold: true };
        // Style all cells as read-only with gray background
        for (let col = 1; col <= 2; col++) {
          const cell = row.getCell(col);
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF3F4F6" },
          };
          cell.font = { color: { argb: "FF6B7280" } };
        }
      });

      // Lock AQ Cluster sheet — all data cells read-only
      const clusterTotalRows = allClustersData.length;
      if (clusterTotalRows > 0) {
        for (let col = 1; col <= 2; col++) {
          const colLetter = String.fromCharCode(64 + col); // A, B
          clusterSheet.dataValidations.add(`${colLetter}2:${colLetter}${clusterTotalRows + 1}`, {
            type: "custom",
            allowBlank: true,
            formulae: ["FALSE"],
            showErrorMessage: true,
            errorTitle: "Read-Only Reference Sheet",
            error: "This is a reference sheet. You can copy values but cannot edit or delete them.",
          });
        }
      }

      // --- Sheet 3: Individual AQ (Reference) ---
      const individualAqSheet = workbook.addWorksheet("Individual AQ") as WorksheetWithValidation;
      individualAqSheet.columns = [
        { header: "Academic Qualification", key: "aq_name", width: 70 },
      ];

      // Style individual AQ header
      const individualAqHeaderRow = individualAqSheet.getRow(1);
      individualAqHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      individualAqHeaderRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4A90D9" },
      };

      allMaqNames.forEach((maqName) => {
        const row = individualAqSheet.addRow({ aq_name: maqName });
        // Style all cells as read-only with gray background
        for (let col = 1; col <= 1; col++) {
          const cell = row.getCell(col);
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF3F4F6" },
          };
          cell.font = { color: { argb: "FF6B7280" } };
        }
      });

      // Lock Individual AQ sheet — all data cells read-only
      const individualAqTotalRows = allMaqNames.length;
      if (individualAqTotalRows > 0) {
        for (let col = 1; col <= 1; col++) {
          const colLetter = String.fromCharCode(64 + col); // A, B
          individualAqSheet.dataValidations.add(
            `${colLetter}2:${colLetter}${individualAqTotalRows + 1}`,
            {
              type: "custom",
              allowBlank: true,
              formulae: ["FALSE"],
              showErrorMessage: true,
              errorTitle: "Read-Only Reference Sheet",
              error: "This is a reference sheet. You can copy values but cannot edit or delete them.",
            },
          );
        }
      }

      // --- Sheet 4: TeacherAQ (Main editable sheet) ---
      const teacherAqSheet = workbook.addWorksheet("TeacherAQ") as WorksheetWithValidation;

      // Define columns: read-only teacher info + Total AQ + editable Add Cluster + Add Individual AQ
      teacherAqSheet.columns = [
        { header: "Teacher Code", key: "teacher_code", width: 20 },
        { header: "Teacher Name", key: "teacher_name", width: 35 },
        { header: "Department", key: "department", width: 28 },
        { header: "Employment", key: "employment", width: 22 },
        { header: "Total AQ", key: "total_aq", width: 14 },
        { header: "Add Cluster", key: "add_cluster", width: 45 },
        { header: "Add Individual AQ", key: "add_individual_aq", width: 45 },
      ];

      // Build a map of pscs_id to AQ records
      const aqMap = new Map<string, AQRecord[]>();
      templateAqs.forEach((aq: AQRecord) => {
        if (!aqMap.has(aq.pscs_id)) aqMap.set(aq.pscs_id, []);
        aqMap.get(aq.pscs_id)!.push(aq);
      });

      // Header styling
      const headerRow = teacherAqSheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };

      // Read-only columns (A-E) header styling
      for (let col = 1; col <= 5; col++) {
        const cell = headerRow.getCell(col);
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFD1D5DB" },
        };
        cell.font = { bold: true, color: { argb: "FF374151" } };
      }
      // Editable columns (F-G) header styling
      for (let col = 6; col <= 7; col++) {
        const editableHeader = headerRow.getCell(col);
        editableHeader.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF4A90D9" },
        };
        editableHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
      }

      // Pre-fill all teachers
      templateTeachers.forEach((teacher: TeacherRecord) => {
        const teacherAqs = aqMap.get(teacher.pscs_id || "") || [];
        const counts = getAQStatusCountsFromRecords(teacherAqs);
        const totalAq = counts.approved + counts.pending + counts.failed + counts.denied;

        const row = teacherAqSheet.addRow({
          teacher_code: teacher.teacher_code || "",
          teacher_name: teacher.full_name || "",
          department: teacher.department || "",
          employment: teacher.employment_type || "",
          total_aq: totalAq,
          add_cluster: "",
          add_individual_aq: "",
        });

        // Lock read-only columns (A-E) with gray background
        for (let col = 1; col <= 5; col++) {
          const cell = row.getCell(col);
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF3F4F6" },
          };
          cell.font = { color: { argb: "FF6B7280" } };
        }
        // Editable columns (F-G) with light blue background hint
        for (let col = 6; col <= 7; col++) {
          const cell = row.getCell(col);
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFEFF6FF" },
          };
        }
      });

      // Lock read-only columns (A-E) — data validation to prevent editing
      const totalRows = templateTeachers.length;
      for (let col = 1; col <= 5; col++) {
        const colLetter = String.fromCharCode(64 + col); // A, B, C, D, E
        teacherAqSheet.dataValidations.add(`${colLetter}2:${colLetter}${totalRows + 1}`, {
          type: "custom",
          allowBlank: true,
          formulae: ["FALSE"],
          showErrorMessage: true,
          errorTitle: "Read-Only Column",
          error: "This column is read-only and cannot be edited.",
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      downloadWorkbook(buffer, "Teacher_AQ_Template.xlsx");
      triggerToast("success", "Excel template downloaded with all teachers pre-filled!");
    } catch (err) {
      console.error("Failed to generate template:", err);
      triggerToast("error", "Failed to generate Excel template.");
    }
  };

  const handleExportExcel = async () => {
    try {
      // Fetch all teachers and AQ records for export
      const [teacherRes, aqRes] = await Promise.all([
        fetchTeachers(null, "All Active & On Leave", "All Departments", "surname", "ASC", 10000, 1),
        fetchTeacherAQRecords(undefined, undefined, undefined, "created_at", "DESC", 10000, 1),
      ]);

      const exportTeachers =
        teacherRes?.success && Array.isArray(teacherRes.data) ? teacherRes.data : [];
      const exportAqs = aqRes?.success && Array.isArray(aqRes.data) ? aqRes.data : [];

      if (exportTeachers.length === 0) {
        triggerToast("error", "No teachers available to export.");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("AQ Export") as WorksheetWithValidation;

      // Same columns as template: read-only teacher info + Total AQ + existing AQs
      worksheet.columns = [
        { header: "Teacher Code", key: "teacher_code", width: 20 },
        { header: "Teacher Name", key: "teacher_name", width: 35 },
        { header: "Department", key: "department", width: 28 },
        { header: "Employment", key: "employment", width: 22 },
        { header: "Total AQ", key: "total_aq", width: 14 },
        { header: "Existing AQs", key: "existing_aqs", width: 50 },
      ];

      // Build a map of pscs_id to AQ records
      const aqMap = new Map<string, AQRecord[]>();
      exportAqs.forEach((aq: AQRecord) => {
        if (!aqMap.has(aq.pscs_id)) aqMap.set(aq.pscs_id, []);
        aqMap.get(aq.pscs_id)!.push(aq);
      });

      // Header styling
      const headerRow = worksheet.getRow(1);
      for (let col = 1; col <= 6; col++) {
        const cell = headerRow.getCell(col);
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF4A90D9" },
        };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      }

      // Pre-fill all teachers with their AQ data
      exportTeachers.forEach((teacher: TeacherRecord) => {
        const teacherAqs = aqMap.get(teacher.pscs_id || "") || [];
        const counts = getAQStatusCountsFromRecords(teacherAqs);
        const totalAq = counts.approved + counts.pending + counts.failed + counts.denied;

        const existingAqs = teacherAqs
          .map((aq) => `${aq.aq} (${aq.approved || "Pending"})`)
          .join(" | ");

        const row = worksheet.addRow({
          teacher_code: teacher.teacher_code || "",
          teacher_name: teacher.full_name || "",
          department: teacher.department || "",
          employment: teacher.employment_type || "",
          total_aq: totalAq,
          existing_aqs: existingAqs || "None",
        });

        // Gray background for all cells (read-only export)
        for (let col = 1; col <= 6; col++) {
          const cell = row.getCell(col);
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF3F4F6" },
          };
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      downloadWorkbook(
        buffer,
        `Teacher_AQ_Export_${new Date().toISOString().split("T")[0]}.xlsx`,
      );
      triggerToast("success", "AQ records exported to Excel successfully");
    } catch (err) {
      console.error(err);
      triggerToast("error", "Failed to export AQ records to Excel");
    }
  };

  const validateAndSelectFile = (file: File | null) => {
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
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleImportSubmit = async () => {
    if (!importFile) return;

    setIsImporting(true);
    setFormatError("");
    setImportLogs(["Reading Excel workbook with ExcelJS..."]);

    try {
      const buffer = await importFile.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      // Try to find the TeacherAQ sheet first (for multi-sheet templates), fallback to first sheet
      let worksheet = workbook.getWorksheet("TeacherAQ");
      if (!worksheet) {
        worksheet = workbook.worksheets[0];
      }
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

      // Detect template format: new format has "Add AQ", old format has "Academic Qualification"
      const hasAddCluster = uploadedHeaders.some(
        (h) => h.toLowerCase() === "add cluster",
      );
      const hasAddIndividualAq = uploadedHeaders.some(
        (h) => h.toLowerCase() === "add individual aq",
      );
      const hasAcademicQualification = uploadedHeaders.some(
        (h) => h.toLowerCase() === "academic qualification",
      );

      if (hasAddCluster && hasAddIndividualAq) {
        // New template format: requires "Teacher Code", "Add Cluster", "Add Individual AQ"
        const hasTeacherCode = uploadedHeaders.some(
          (h) => h.toLowerCase() === "teacher code",
        );
        if (!hasTeacherCode) {
          setFormatError(
            `Strict Format Violation: Template format requires headers: [Teacher Code, Add Cluster, Add Individual AQ]`,
          );
          setIsImporting(false);
          return;
        }
      } else if (hasAcademicQualification) {
        // Old format: requires "Teacher Code", "Academic Qualification", "Status"
        const isHeaderValid = REQUIRED_AQ_HEADERS.slice(0, 3).every((reqHeader) =>
          uploadedHeaders.some((uh) => uh.toLowerCase() === reqHeader.toLowerCase()),
        );
        if (!isHeaderValid) {
          setFormatError(
            `Strict Format Violation: Missing required headers. Your file must include: [${REQUIRED_AQ_HEADERS.slice(0, 3).join(", ")}]`,
          );
          setIsImporting(false);
          return;
        }
      } else {
        setFormatError(
          `Strict Format Violation: Unrecognized format. Your file must include either [Teacher Code, Add Cluster, Add Individual AQ] or [Teacher Code, Academic Qualification, Status].`,
        );
        setIsImporting(false);
        return;
      }

      setImportLogs((prev) => [
        ...prev,
        `Headers verified. Format: ${hasAddCluster && hasAddIndividualAq ? "Template (Add Cluster + Add Individual AQ)" : "Standard"}. Validating rows...`,
      ]);

      let successCount = 0;
      let failCount = 0;
      const logs: string[] = [];

      const headerIndexMap: Record<string, number> = {};
      headerRow.eachCell((cell, colNumber) => {
        if (cell.value) {
          headerIndexMap[String(cell.value).trim().toLowerCase()] = colNumber;
        }
      });

      const codeCol = headerIndexMap["teacher code"] || 1;
      const nameCol = headerIndexMap["teacher name"] || 2;
      const addClusterCol = headerIndexMap["add cluster"];
      const addIndividualAqCol = headerIndexMap["add individual aq"];
      const aqCol = headerIndexMap["academic qualification"] || 2;
      const statusCol = headerIndexMap["status"] || 3;

      // Build teacher lookup map using composite key (teacher_code + full_name) to handle duplicate teacher codes
      const teacherLookupMap = new Map<string, string>();
      teachersList.forEach((t) => {
        if (t.teacher_code && t.pscs_id && t.full_name) {
          const key = `${t.teacher_code.toUpperCase()}|||${t.full_name.toUpperCase()}`;
          teacherLookupMap.set(key, t.pscs_id);
        }
      });

      // Also fetch all teachers to ensure we have the complete list
      const allTeachersRes = await fetchTeachers(
        null,
        "All Active & On Leave",
        "All Departments",
        "surname",
        "ASC",
        10000,
        1,
      );
      if (allTeachersRes?.success && allTeachersRes.data) {
        allTeachersRes.data.forEach((t: TeacherRecord) => {
          if (t.teacher_code && t.pscs_id && t.full_name) {
            const key = `${t.teacher_code.toUpperCase()}|||${t.full_name.toUpperCase()}`;
            teacherLookupMap.set(key, t.pscs_id);
          }
        });
      }

      // Build sets of valid names
      const validClusterSet = new Set<string>();
      allClusterNames.forEach((c) => validClusterSet.add(c));
      const validMaqSet = new Set<string>();
      allMaqNames.forEach((m) => validMaqSet.add(m));

      // Build cluster name to entries map for expansion
      const clusterEntriesMap = new Map<string, string[]>();
      allClustersData.forEach((cluster) => {
        const entryNames = (cluster.entries || [])
          .map((entry: MaqClusterEntryItem) => (typeof entry === "string" ? entry : entry.aq))
          .filter(Boolean);
        if (cluster.cluster_name && entryNames.length > 0) {
          clusterEntriesMap.set(cluster.cluster_name, entryNames);
        }
      });

      // Fetch all existing AQ records to detect duplicates during import
      const existingAqRes = await fetchTeacherAQRecords(
        undefined,
        undefined,
        undefined,
        "created_at",
        "DESC",
        10000,
        1,
      );
      const existingAqs = existingAqRes?.success && Array.isArray(existingAqRes.data)
        ? existingAqRes.data
        : [];

      // Build a set of existing AQ keys (pscs_id + aq_name) for case-insensitive duplicate detection
      const existingAqSet = new Set<string>();
      existingAqs.forEach((aq: AQRecord) => {
        if (aq.pscs_id && aq.aq) {
          const key = `${aq.pscs_id}|||${aq.aq.toUpperCase()}`;
          existingAqSet.add(key);
        }
      });

      // Collect rows to process first
      const rowsToProcess: Array<{
        rowNumber: number;
        teacherCode: string;
        pscsId: string;
        aqName: string;
        status: string;
      }> = [];
      let duplicateSkipped = 0;

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const teacherCode = String(row.getCell(codeCol).value || "").trim().toUpperCase();
        const teacherName = String(row.getCell(nameCol).value || "").trim().toUpperCase();

        if ((hasAddCluster && hasAddIndividualAq) && addClusterCol && addIndividualAqCol) {
          // New template format: read comma-separated values from "Add Cluster" and "Add Individual AQ" columns
          const clusterText = String(row.getCell(addClusterCol).value || "").trim();
          const individualAqText = String(row.getCell(addIndividualAqCol).value || "").trim();
          const status = "Approved"; // Default status for template imports

          if (!teacherCode) {
            logs.push(`Row ${rowNumber}: Skipped. Teacher Code is required.`);
            failCount++;
            return;
          }

          // Validate teacher using composite key (code + name) to handle duplicate teacher codes
          const lookupKey = `${teacherCode}|||${teacherName}`;
          const pscsId = teacherLookupMap.get(lookupKey);
          if (!pscsId) {
            logs.push(
              `Row ${rowNumber} (${teacherCode}): Skipped. Teacher not found in system (code: ${teacherCode}, name: ${teacherName}).`,
            );
            failCount++;
            return;
          }

          // Parse comma-separated cluster names
          const clusterNames = clusterText
            ? clusterText.split(",").map((c) => c.trim()).filter(Boolean)
            : [];

          // Parse comma-separated individual AQ names
          const individualAqNames = individualAqText
            ? individualAqText.split(",").map((a) => a.trim()).filter(Boolean)
            : [];

          // Skip rows where both columns are empty (no new AQ to add)
          if (clusterNames.length === 0 && individualAqNames.length === 0) {
            return;
          }

          // Process each cluster
          let rowHasError = false;
          for (const clusterName of clusterNames) {
            if (!validClusterSet.has(clusterName)) {
              logs.push(
                `Row ${rowNumber} (${teacherCode}): Skipped. "${clusterName}" is not a valid cluster.`,
              );
              failCount++;
              rowHasError = true;
              continue;
            }
            // Expand cluster into its entry AQs
            const entryAqs = clusterEntriesMap.get(clusterName) || [];
            if (entryAqs.length === 0) {
              logs.push(
                `Row ${rowNumber} (${teacherCode}): Skipped. Cluster "${clusterName}" has no entries.`,
              );
              failCount++;
              rowHasError = true;
              continue;
            }
            for (const entryAq of entryAqs) {
              const key = `${pscsId}|||${entryAq.toUpperCase()}`;
              if (existingAqSet.has(key)) {
                logs.push(
                  `Row ${rowNumber} (${teacherCode}, ${entryAq}): Skipped duplicate. Teacher already has this AQ.`,
                );
                duplicateSkipped++;
                continue;
              }
              existingAqSet.add(key);
              rowsToProcess.push({ rowNumber, teacherCode, pscsId, aqName: entryAq, status });
            }
          }

          // Process each individual AQ
          for (const individualAqName of individualAqNames) {
            if (!validMaqSet.has(individualAqName)) {
              logs.push(
                `Row ${rowNumber} (${teacherCode}): Skipped. "${individualAqName}" is not a valid individual Academic Qualification.`,
              );
              failCount++;
              rowHasError = true;
              continue;
            }
            const key = `${pscsId}|||${individualAqName.toUpperCase()}`;
            if (existingAqSet.has(key)) {
              logs.push(
                `Row ${rowNumber} (${teacherCode}, ${individualAqName}): Skipped duplicate. Teacher already has this AQ.`,
              );
              duplicateSkipped++;
              continue;
            }
            existingAqSet.add(key);
            rowsToProcess.push({ rowNumber, teacherCode, pscsId, aqName: individualAqName, status });
          }

          // If the row had errors, skip further processing for this row
          if (rowHasError && clusterNames.length === 0 && individualAqNames.length === 0) {
            return;
          }
        } else {
          // Old format: read from "Academic Qualification" and "Status" columns
          const aqName = String(row.getCell(aqCol).value || "").trim();
          let status = String(row.getCell(statusCol).value || "Approved").trim();

          if (!teacherCode || !aqName) {
            logs.push(
              `Row ${rowNumber}: Skipped. Teacher Code and Academic Qualification are required.`,
            );
            failCount++;
            return;
          }

          // Validate teacher using composite key (code + name) to handle duplicate teacher codes
          const lookupKey = `${teacherCode}|||${teacherName}`;
          const pscsId = teacherLookupMap.get(lookupKey);
          if (!pscsId) {
            logs.push(
              `Row ${rowNumber} (${teacherCode}): Skipped. Teacher not found in system (code: ${teacherCode}, name: ${teacherName}).`,
            );
            failCount++;
            return;
          }

          // Normalize status
          const validStatuses = ["Approved", "Pending", "Denied", "Failed"];
          if (!validStatuses.includes(status)) {
            status = "Approved";
          }

          // Check for duplicates before adding
          const key = `${pscsId}|||${aqName.toUpperCase()}`;
          if (existingAqSet.has(key)) {
            logs.push(
              `Row ${rowNumber} (${teacherCode}, ${aqName}): Skipped duplicate. Teacher already has this AQ.`,
            );
            duplicateSkipped++;
          } else {
            existingAqSet.add(key);
            rowsToProcess.push({ rowNumber, teacherCode, pscsId, aqName, status });
          }
        }
      });

      // Process each row asynchronously
      for (const item of rowsToProcess) {
        const customAqCode = `AQ-${Date.now()}-${item.rowNumber}`;
        const aqContents: Record<string, JSONValue> = {
          custom_aq_id: customAqCode,
        };

        const res = await createTeacherAQ(item.pscsId, item.aqName, aqContents, item.status);
        if (res?.success) {
          successCount++;
          logs.push(`Row ${item.rowNumber} (${item.teacherCode}, ${item.aqName}): Imported successfully.`);
          // Add newly created AQ to the existing set to prevent duplicates within the same import batch
          const key = `${item.pscsId}|||${item.aqName.toUpperCase()}`;
          existingAqSet.add(key);
        } else {
          logs.push(
            `Row ${item.rowNumber} (${item.teacherCode}, ${item.aqName}): ${res?.error || "Creation failed."}`,
          );
          failCount++;
        }
      }

      // Report duplicates skipped
      if (duplicateSkipped > 0) {
        logs.push(`${duplicateSkipped} duplicate(s) skipped — teacher(s) already have these AQ(s).`);
      }

      const readyRowCount = new Set(rowsToProcess.map((item) => item.rowNumber)).size;
      logs.unshift(`${readyRowCount} row(s) ready to import.`);
      setImportLogs((prev) => [
        ...prev,
        `Import Completed: ${successCount} successful, ${failCount} failed.`,
        ...logs,
      ]);

      if (successCount > 0) {
        triggerToast("success", `Imported ${successCount} AQ records successfully.`);
        // Reload data
        await loadData(currentPage, employmentFilter);
      }
    } catch (err) {
      console.error(err);
      setFormatError("Error: Unable to parse Excel workbook format using ExcelJS.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <style>{`
        .teacher-aq-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .teacher-aq-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .teacher-aq-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.3);
          border-radius: 3px;
        }
        .teacher-aq-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(107, 114, 128, 0.5);
        }
        .dark .teacher-aq-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(107, 114, 128, 0.3);
        }
        .dark .teacher-aq-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.5);
        }
        .teacher-aq-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(156, 163, 175, 0.3) transparent;
        }
        .dark .teacher-aq-scrollbar {
          scrollbar-color: rgba(107, 114, 128, 0.3) transparent;
        }
      `}</style>

      {showToast && (
        <div className="fixed right-5 bottom-5 z-50 flex flex-col items-end">
          <Toast>
            <div
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                toastType === "success"
                  ? "bg-green-100 text-green-500 dark:bg-green-800 dark:text-green-200"
                  : "bg-red-100 text-red-500 dark:bg-red-800 dark:text-red-200"
              }`}
            >
              {toastType === "success" ? (
                <HiCheck className="h-5 w-5" />
              ) : (
                <HiExclamation className="h-5 w-5" />
              )}
            </div>

            <div className="ml-3 text-sm font-normal">{toastMessage}</div>

            <button
              type="button"
              className="-mx-1.5 -my-1.5 ml-auto inline-flex h-8 w-8 cursor-pointer rounded-lg bg-white p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-900 focus:ring-2 focus:ring-gray-300 dark:bg-gray-800 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-white"
              onClick={() => setShowToast(false)}
            >
              <HiX className="h-5 w-5" />
            </button>
          </Toast>
          <div className="mt-1 w-full px-1">
            <Progress
              progress={progress}
              size="xs"
              color={toastType === "success" ? "green" : "red"}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div
          className={`${selectedTeacher ? "lg:col-span-7" : "lg:col-span-12"} transition-all duration-300`}
        >
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Teacher Academic Qualifications
          </h1>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Review and manage teacher credentials, handle approvals or
            rejections, and request updates.
          </p>

          <div className={"mt-2"}>
            <div className="flex-col justify-between gap-4 md:flex md:flex-row md:items-center">
              <div className="relative mr-4 mb-2 w-full md:w-64">
                <TextInput
                  id="searchTeacher"
                  type="text"
                  placeholder="Search teachers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  icon={HiSearch}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="w-full sm:w-48">
                  <Select
                    id="employment-filter"
                    value={employmentFilter}
                    onChange={(e) => {
                      const selectedVal = e.target.value;
                      setEmploymentFilter(selectedVal);
                      setCurrentPage(1);
                      void loadData(1, selectedVal);
                    }}
                    className="w-full cursor-pointer"
                  >
                    <option value="All Employment Types">
                      All Employment Types
                    </option>
                    <option value="Full-Time">Full-Time</option>
                    <option value="Part-Time Full Load">
                      Part-Time Full Load
                    </option>
                    <option value="Part-Time">Part-Time</option>
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

            <div className="mt-2 overflow-x-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner size="xl" />
                </div>
              ) : (
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

                      <TableHeadCell>
                        <span>Employment</span>
                      </TableHeadCell>

                      <TableHeadCell
                        className="cursor-pointer text-blue-500 select-none"
                        onClick={() => handleSorting("aq_count")}
                      >
                        <div className="flex items-center gap-1">
                          <span>Total AQ</span>
                          {sortBy === "aq_count" &&
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
                    {filteredTeachers.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-6 text-center text-gray-500"
                        >
                          No teachers found matching your criteria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTeachers.map((teacher) => {
                        const { approved, pending, failed, denied } =
                          getAQStatusCounts(teacher.pscs_id);
                        const isSelected =
                          selectedTeacher?.teacher_id === teacher.teacher_id;

                        return (
                          <TableRow
                            key={teacher.teacher_id}
                            onClick={() => setSelectedTeacher(teacher)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-blue-50 dark:bg-gray-700"
                                : "bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                            }`}
                          >
                            <TableCell className="font-medium whitespace-nowrap text-gray-900 dark:text-white">
                              <div>{teacher.full_name}</div>
                              <div className="text-xs text-gray-500">
                                {teacher.email}
                              </div>
                            </TableCell>

                            <TableCell>
                              {teacher.teacher_code || "N/A"}
                            </TableCell>
                            <TableCell>{teacher.department || "N/A"}</TableCell>
                            <TableCell>
                              {teacher.employment_type || "—"}
                            </TableCell>

                            {/* Total AQ Cell */}
                            <TableCell>
                              <div className="flex items-center justify-center">
                                <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-sm font-bold text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                  {approved + pending + failed + denied}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </div>

            <TablePaginationFooter
              className="pt-4"
              currentPage={currentPage}
              pageSize={limit}
              totalCount={teachersCount}
              onPageChange={(p) => setCurrentPage(p)}
            />
          </div>
        </div>

        {/* Side Panel Inspector - Desktop */}
        {selectedTeacher && (
          <div className="hidden lg:col-span-5 lg:block">
            <Card className="sticky top-4 h-[calc(100vh-8rem)] overflow-hidden bg-white dark:bg-gray-900">
              <div className="h-full overflow-y-auto p-4 teacher-aq-scrollbar">
              <div className="flex items-start justify-between border-b pb-4 dark:border-gray-700">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {selectedTeacher.full_name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {selectedTeacher.email}
                  </p>
                </div>

                <Tooltip content={"Close"}>
                  <Button
                    color="red"
                    size="xs"
                    className="cursor-pointer"
                    onClick={() => setSelectedTeacher(null)}
                  >
                    <HiX className="h-4 w-4" />
                  </Button>
                </Tooltip>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Academic Qualifications List
                  </h4>
                  <Button
                    size="xs"
                    color="blue"
                    className="cursor-pointer"
                    onClick={() => {
                      setIsAddAQOpen(true);
                    }}
                  >
                    <FaPlus className="mr-1 h-3 w-3" />
                    <span>Add AQ</span>
                  </Button>
                </div>

                {(() => {
                  const teacherAqs = getTeacherAQs(selectedTeacher.pscs_id);

                  if (teacherAqs.length === 0) {
                    return (
                      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
                        No Academic Qualifications found for this teacher.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {teacherAqs.map((record) => {
                        const status = (
                          record.approved || "Pending"
                        ).toLowerCase();

                        return (
                          <div
                            key={record.aq_id}
                            className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <FaGraduationCap className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {record.aq}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {renderStatusBadge(record.approved)}
                                <Tooltip content="Remove AQ">
                                  <button
                                    type="button"
                                    onClick={() => confirmDeleteAQ(record)}
                                    className="cursor-pointer text-gray-400 transition-colors hover:text-red-600 dark:hover:text-red-400"
                                  >
                                    <HiTrash className="mt-2" />
                                  </button>
                                </Tooltip>
                              </div>
                            </div>

                            {/* Status Actions */}
                            {status !== "approved" && (
                              <div className="flex items-center justify-between border-t border-gray-200/60 pt-2 dark:border-gray-700">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                  Status Action:
                                </span>

                                {(status === "pending" ||
                                  status === "failed") && (
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="xs"
                                      color="success"
                                      className="cursor-pointer"
                                      onClick={() =>
                                        handleStatusChange(record, "Approved")
                                      }
                                    >
                                      <HiCheck className="mr-1 h-3.5 w-3.5" />
                                      <span>Approve</span>
                                    </Button>
                                    <Button
                                      size="xs"
                                      color="red"
                                      className="cursor-pointer"
                                      onClick={() =>
                                        handleStatusChange(record, "Denied")
                                      }
                                    >
                                      <HiX className="mr-1 h-3.5 w-3.5" />
                                      <span>Deny</span>
                                    </Button>
                                  </div>
                                )}

                                {status === "denied" && (
                                  <Tooltip content="Change AQ status to approved">
                                    <Button
                                      size="xs"
                                      color="warning"
                                      className="cursor-pointer"
                                      onClick={() =>
                                        handleStatusChange(record, "Approved")
                                      }
                                    >
                                      <IoRefresh className="mr-1 h-4 w-4" />
                                      <span>Approve</span>
                                    </Button>
                                  </Tooltip>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
              </div>
            </Card>
          </div>

        )}

      {/* Mobile Modal for Side Panel */}
      <Modal show={!!selectedTeacher} onClose={() => setSelectedTeacher(null)} size="xl" popup className="lg:hidden">
        <ModalHeader>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {selectedTeacher?.full_name}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {selectedTeacher?.email}
              </p>
            </div>
            <Button
              color="red"
              size="xs"
              className="cursor-pointer"
              onClick={() => setSelectedTeacher(null)}
            >
              <HiX className="h-4 w-4" />
            </Button>
          </div>
        </ModalHeader>
        <ModalBody className="max-h-[70vh] overflow-y-auto teacher-aq-scrollbar">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Academic Qualifications List
              </h4>
              <Button
                size="xs"
                color="blue"
                className="cursor-pointer"
                onClick={() => {
                  setIsAddAQOpen(true);
                }}
              >
                <FaPlus className="mr-1 h-3 w-3" />
                <span>Add AQ</span>
              </Button>
            </div>

            {(() => {
              const teacherAqs = selectedTeacher ? getTeacherAQs(selectedTeacher.pscs_id) : [];

              if (teacherAqs.length === 0) {
                return (
                  <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
                    No Academic Qualifications found for this teacher.
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {teacherAqs.map((record) => {
                    return (
                      <div
                        key={record.aq_id}
                        className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <FaGraduationCap className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {record.aq}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {renderStatusBadge(record.approved)}
                            <Tooltip content="Remove AQ">
                              <button
                                type="button"
                                onClick={() => confirmDeleteAQ(record)}
                                className="cursor-pointer text-gray-400 transition-colors hover:text-red-600 dark:hover:text-red-400"
                              >
                                <HiTrash className="mt-2" />
                              </button>
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </ModalBody>
      </Modal>
      </div>

      {/* Add AQ Searchable Modal */}
      <Modal show={isAddAQOpen} onClose={() => setIsAddAQOpen(false)}>
        <ModalHeader>Add Academic Qualification</ModalHeader>
        <ModalBody className="overflow-visible">
          <div className="space-y-4">
            <div>
              <div className="mb-2 block">
                <Label htmlFor="teacher-name-modal">Selected Teacher</Label>
              </div>
              <span className={"text-md font-bold dark:text-white"}>
                {selectedTeacher?.full_name || ""}
                <span className={"ml-2 text-gray-400"}>
                  ({selectedTeacher?.department || "No Department"})
                </span>
              </span>
            </div>

            {/* Search & Lock Academic Qualification */}
            <div className="relative" ref={dropdownRef}>
              <div className="mb-2 flex items-center justify-between">
                <Label htmlFor="aq-search-modal">Search Qualification</Label>
                {isAQLocked && (
                  <span className="flex items-center text-xs font-semibold text-green-600 dark:text-green-400">
                    <HiLockClosed className="mr-1 h-3.5 w-3.5" /> Selection
                    Locked
                  </span>
                )}
              </div>

              <div className="relative">
                <TextInput
                  id="aq-search-modal"
                  type="text"
                  placeholder="Search Academic Qualification (e.g., IT, PhD)..."
                  value={aqSearchQuery}
                  onChange={handleAQQueryChange}
                  onFocus={() => !isAQLocked && setShowSuggestions(true)}
                  disabled={isAQLocked}
                  icon={HiSearch}
                />
                {isAQLocked && (
                  <button
                    type="button"
                    onClick={handleUnlockAQ}
                    className="absolute top-2.5 right-2 cursor-pointer rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-white"
                    title="Unlock to search again"
                  >
                    <HiX className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Search Suggestions Dropdown */}
              {showSuggestions && !isAQLocked && (
                <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  {isSearchingAqs ? (
                    <div className="flex items-center justify-center p-4">
                      <Spinner size="sm" className="mr-2" />
                      <span className="text-xs text-gray-500">
                        Searching qualifications...
                      </span>
                    </div>
                  ) : aqSearchResults.length > 0 ? (
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
                                typeof entry === "string" ? entry : entry.aq,
                              )
                              .filter(Boolean);

                            return (
                              <div
                                key={opt.name}
                                onClick={() => handleSelectAQ(opt)}
                                className="cursor-pointer border-b border-gray-100 px-3 py-2 text-sm transition-colors hover:bg-blue-50 dark:border-gray-700 dark:hover:bg-gray-700"
                              >
                                <div className="flex items-center gap-2 font-medium text-blue-600 dark:text-blue-400">
                                  <MdFolderCopy className="h-4 w-4 shrink-0 text-blue-500" />
                                  <span>{opt.name}</span>
                                </div>
                                {subEntriesLabels.length > 0 && (
                                  <div className="mt-1 ml-6 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
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
                      {maqOptions.length > 0 && (
                        <div>
                          <div className="border-b border-gray-100 bg-gray-50 px-3 py-1.5 text-[10px] font-bold tracking-wider text-gray-500 uppercase dark:border-gray-700 dark:bg-gray-700 dark:text-gray-400">
                            Individual Qualifications
                          </div>
                          {maqOptions.map((opt) => (
                            <div
                              key={opt.name}
                              onClick={() => handleSelectAQ(opt)}
                              className="cursor-pointer flex items-center gap-2 border-b border-gray-100 px-3 py-2 text-sm text-gray-700 last:border-none transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                            >
                              <IoMdDocument className="h-4 w-4 shrink-0 text-gray-400" />
                              <span className="truncate">{opt.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-4 text-center text-xs text-gray-500">
                      No matching or unassigned qualifications found.
                    </div>
                  )}
                </div>
              )}
            </div>

            {aqSubmitError && (
              <p className="text-xs font-medium text-red-500">
                {aqSubmitError}
              </p>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            color="blue"
            className="cursor-pointer"
            onClick={handleAddAQSubmit}
            disabled={isSubmittingAQ || !selectedAQOption || !isAQLocked}
          >
            {isSubmittingAQ ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Submitting...
              </>
            ) : (
              "Submit AQ"
            )}
          </Button>
          <Button
            color="gray"
            className="cursor-pointer"
            onClick={() => closeAqAddModal()}
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        show={isDeleteModalOpen}
        size="md"
        onClose={() => setIsDeleteModalOpen(false)}
        popup
      >
        <ModalHeader />
        <ModalBody>
          <div className="text-center">
            <HiExclamation className="mx-auto mb-4 h-12 w-12 text-red-500 dark:text-red-400" />
            <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
              Are you sure you want to remove{" "}
              <span className="font-semibold text-gray-800 dark:text-white">
                {aqToDelete?.aq}
              </span>{" "}
              for this teacher?
            </h3>
            <div className="flex justify-center gap-4">
              <Button
                color="red"
                className="cursor-pointer"
                onClick={handleDeleteAQConfirmed}
                disabled={isDeletingAQ}
              >
                {isDeletingAQ ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Deleting...
                  </>
                ) : (
                  "Yes, I'm sure"
                )}
              </Button>
              <Button
                color="gray"
                className="cursor-pointer"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setAqToDelete(null);
                }}
                disabled={isDeletingAQ}
              >
                No, cancel
              </Button>
            </div>
          </div>
        </ModalBody>
      </Modal>

      {/* --- MODAL: EXCEL OPERATIONS --- */}
      <Modal show={openExcelModal} onClose={() => setOpenExcelModal(false)} size="lg">
        <ModalHeader>
          <div className="flex items-center gap-2">
            <FaFileExcel className="text-green-600 h-5 w-5" />
            <span>Excel Operations & Teacher AQ Management</span>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => {
                  setActiveExcelTab("import");
                  setFormatError("");
                  setImportLogs([]);
                  setImportFile(null);
                }}
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
                <span className="text-xs font-semibold">Export AQs</span>
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
                  <span className="font-semibold uppercase tracking-wide">Validation Rule:</span> The template has 4 sheets: Instructions, TeacherAQ, AQ Cluster, and Individual AQ. Only the TeacherAQ sheet is imported. Columns A–E are read-only. Column F (&quot;Add Cluster&quot;) and Column G (&quot;Add Individual AQ&quot;) accept comma-separated text — copy exact names from the reference sheets. Each entry is validated against system data. Status defaults to <b className="font-mono">Approved</b>.
                </div>

                {formatError && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                    <HiExclamation className="h-4 w-4 shrink-0 text-red-500" />
                    <div>{formatError}</div>
                  </div>
                )}

                <ImportResultsPanel logs={importLogs} ariaLabel="Teacher AQ import summary and results" />

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
                    Export All Teacher AQ Data
                  </h4>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Generates a read-only Excel spreadsheet with all teachers, their total AQ count, and existing AQ records.
                  </p>
                </div>
                <Button onClick={handleExportExcel} className="w-full" color="green">
                  <FaFileExport className="mr-2 h-4 w-4" /> Export All Teacher AQ Data
                </Button>
              </div>
            )}

            {activeExcelTab === "template" && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-4 dark:border-gray-700 dark:bg-gray-800">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                    Download Pre-Filled Excel Template
                  </h4>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Contains 4 sheets: Instructions (step-by-step guide), TeacherAQ (pre-filled with all teachers, columns F and G accept comma-separated text), AQ Cluster (reference list of clusters), and Individual AQ (reference list of individual qualifications). Copy exact names from reference sheets and paste into the TeacherAQ sheet.
                  </p>
                </div>
                <Button
                  onClick={handleDownloadTemplate}
                  className="w-full"
                  color="blue"
                  disabled={isLoadingAqDropdowns}
                >
                  {isLoadingAqDropdowns ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <FaDownload className="mr-2 h-4 w-4" /> Download Pre-Filled Template
                    </>
                  )}
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