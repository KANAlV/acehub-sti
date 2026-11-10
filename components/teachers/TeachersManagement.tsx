"use client";

import {
  Button,
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
  Tooltip,
  useThemeMode,
  FileInput,
} from "flowbite-react";
import {
  FaPlus,
  FaSortDown,
  FaSortUp,
  FaFileExcel,
  FaFileImport,
  FaFileExport,
  FaDownload,
} from "react-icons/fa6";
import { HiCheck } from "react-icons/hi2";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  HiExclamation,
  HiX,
  HiSearch,
  HiArchive,
  HiRefresh,
} from "react-icons/hi";
import ExcelJS from "exceljs";
import {
  filterAlpha,
  filterAlphaDashSpace,
  filterAlphaNoSpace,
  filterEmail,
  filterNumeric,
} from "@/utils/validation";
import { useMsal } from "@azure/msal-react";
import {
  createTeacher,
  fetchTeachers,
  fetchTeachersCount,
  updateTeacher,
  archiveTeacher,
  fetchDepartments,
  TeacherStatusFilter,
  TeacherRecord,
} from "@/app/actions/system";

export interface DepartmentRecord {
  dept_id: string;
  dept_code?: string;
  dept_name: string;
  [key: string]: unknown;
}

export interface AvailabilitySlot {
  day: string;
  startTime: string;
  endTime: string;
}

const DAYS_OF_WEEK = [
  { id: 1, name: "Monday" },
  { id: 2, name: "Tuesday" },
  { id: 3, name: "Wednesday" },
  { id: 4, name: "Thursday" },
  { id: 5, name: "Friday" },
  { id: 6, name: "Saturday" },
];

const DEFAULT_FULLTIME_AVAILABILITY: AvailabilitySlot[] = [
  {
    day: "[Mon - Fri]",
    startTime: "7:00 AM",
    endTime: "8:00 PM",
  },
];

const REQUIRED_HEADERS = [
  "PSCS ID",
  "Teacher Code",
  "First Name",
  "Middle Name",
  "Surname",
  "Suffix",
  "Email",
  "Department",
  "Employment Type",
  "Status",
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

export default function TeachersManagement() {
  const { computedMode } = useThemeMode();
  const isDarkMode = computedMode === "dark";

  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];
  const username = activeAccount?.username;
  const [isLoading, setLoading] = useState(true);

  // --- Table & Filter Constants --- //
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [teachersCount, setTeachersCount] = useState(0);
  const [sortTeachersBy, setSortTeachersBy] = useState("surname");
  const [sortTeachersDir, setSortTeachersDir] = useState("ASC");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<TeacherStatusFilter>(
    "All Active & On Leave",
  );
  const [departmentFilter, setDepartmentFilter] =
    useState<string>("All Departments");

  // --- Modal Constants --- //
  const [openAddTeacherModal, setOpenAddTeacherModal] = useState(false);
  const [openEditTeacherModal, setOpenEditTeacherModal] = useState(false);
  const [openArchiveModal, setOpenArchiveModal] = useState(false);
  const [openUnarchiveModal, setOpenUnarchiveModal] = useState(false);
  const [openExcelModal, setOpenExcelModal] = useState(false);
  const [selectedUnarchiveTeacher, setSelectedUnarchiveTeacher] =
    useState<TeacherRecord | null>(null);

  // Excel Operations States
  const [activeExcelTab, setActiveExcelTab] = useState<"import" | "export" | "template">("import");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [formatError, setFormatError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Form Error States --- //
  const [rowID, setRowID] = useState("");
  const [pscsIdError, setPscsIdError] = useState("");
  const [teacherCodeError, setTeacherCodeError] = useState("");
  const [fNameError, setFNameError] = useState("");
  const [surnameError, setSurnameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [departmentError, setDepartmentError] = useState("");
  const [availError, setAvailError] = useState("");

  const [editPscsIdError, setEditPscsIdError] = useState("");
  const [editTeacherCodeError, setEditTeacherCodeError] = useState("");
  const [editFNameError, setEditFNameError] = useState("");
  const [editSurnameError, setEditSurnameError] = useState("");
  const [editEmailError, setEditEmailError] = useState("");
  const [editDepartmentError, setEditDepartmentError] = useState("");
  const [editAvailError, setEditAvailError] = useState("");

  // --- Department State --- //
  const [allDepartments, setAllDepartments] = useState<string[]>([]);

  // --- Add Form State --- //
  const [inputPscsId, setInputPscsId] = useState("");
  const [inputEmail, setInputEmail] = useState("");
  const [inputFName, setInputFName] = useState("");
  const [inputMName, setInputMName] = useState("");
  const [inputSurname, setInputSurname] = useState("");
  const [inputSuffix, setInputSuffix] = useState("");
  const [inputTeacherCode, setInputTeacherCode] = useState("");
  const [inputDepartment, setInputDepartment] = useState("");
  const [inputEmploymentType, setInputEmploymentType] = useState("Full-Time");
  const [inputStatus, setInputStatus] = useState("Active");
  const [availabilityList, setAvailabilityList] = useState<AvailabilitySlot[]>(
    DEFAULT_FULLTIME_AVAILABILITY,
  );

  // Add Availability Temp Input State
  const [addAvailDay, setAddAvailDay] = useState<number>(1);
  const [addAvailStart, setAddAvailStart] = useState("07:00");
  const [addAvailEnd, setAddAvailEnd] = useState("17:00");

  // --- Edit Form State --- //
  const [newPscsId, editPscsId] = useState("");
  const [newEmail, editEmail] = useState("");
  const [newFName, editFName] = useState("");
  const [newMName, editMName] = useState("");
  const [newSurname, editSurname] = useState("");
  const [newSuffix, editSuffix] = useState("");
  const [newTeacherCode, editTeacherCode] = useState("");
  const [newDepartment, editDepartment] = useState("");
  const [newEmploymentType, editEmploymentType] = useState("Full-Time");
  const [newStatus, editStatus] = useState("Active");
  const [editAvailabilityList, setEditAvailabilityList] = useState<
    AvailabilitySlot[]
  >([]);

  // Edit Availability Temp Input State
  const [editAvailDay, setEditAvailDay] = useState<number>(1);
  const [editAvailStart, setEditAvailStart] = useState("07:00");
  const [editAvailEnd, setEditAvailEnd] = useState("17:00");

  // --- Baseline Comparison State --- //
  const [basePscsId, setBasePscsId] = useState("");
  const [baseEmail, setBaseEmail] = useState("");
  const [baseFName, setBaseFName] = useState("");
  const [baseMName, setBaseMName] = useState("");
  const [baseSurname, setBaseSurname] = useState("");
  const [baseSuffix, setBaseSuffix] = useState("");
  const [baseTeacherCode, setBaseTeacherCode] = useState("");
  const [baseDepartment, setBaseDepartment] = useState("");
  const [baseEmploymentType, setBaseEmploymentType] = useState("Full-Time");
  const [baseStatus, setBaseStatus] = useState("Active");
  const [baseAvailabilityList, setBaseAvailabilityList] = useState<
    AvailabilitySlot[]
  >([]);

  // --- Pagination Constants --- //
  const maxRowTeacher = 10;
  const [currentTeacherPage, setCurrentTeacherPage] = useState(1);
  const [pageChangingTeachers, setPageChangingTeachers] = useState(false);

  // --- Toast Constants --- //
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [showToastTimer, setShowToastTimer] = useState(false);
  const [progress, setProgress] = useState(0);

  /** --- Time Formatting Helper (Memoized) --- **/
  const formatTime12hr = useCallback((time24: string) => {
    if (!time24) return "";
    const [h, m] = time24.split(":");
    let hours = parseInt(h, 10);
    const suffix = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${m} ${suffix}`;
  }, []);

  /** --- Availability Display Formatter --- **/
  const renderAvailability = useCallback((item: TeacherRecord) => {
    const isStrictPartTime = item.employment_type === "Part-Time";
    let avail: AvailabilitySlot[] = [];

    if (typeof item.availability === "string") {
      try {
        const parsed = JSON.parse(item.availability);
        if (Array.isArray(parsed)) {
          avail = parsed;
        } else if (parsed && typeof parsed === "object") {
          avail = [parsed as AvailabilitySlot];
        }
      } catch {
        avail = [];
      }
    } else if (Array.isArray(item.availability)) {
      avail = item.availability as AvailabilitySlot[];
    } else if (item.availability && typeof item.availability === "object") {
      avail = Array.isArray(item.availability)
        ? item.availability
        : [item.availability as unknown as AvailabilitySlot];
    }

    if (!isStrictPartTime) {
      return <span>[Mon - Fri] 7:00 AM - 8:00 PM</span>;
    }

    if (!Array.isArray(avail) || avail.length === 0) {
      return (
        <span className="font-medium text-yellow-500 dark:text-yellow-400">
          [No Preferred Time]
        </span>
      );
    }

    return (
      <div className="flex flex-col gap-0.5">
        {avail.map((slot, idx) => (
          <div key={idx} className="whitespace-nowrap">
            {slot?.day ?? ""}: {slot?.startTime ?? ""} - {slot?.endTime ?? ""}
          </div>
        ))}
      </div>
    );
  }, []);

  /** --- Validation Utilities --- **/
  const validateEmailFormat = useCallback((email: string): boolean => {
    return email.toLowerCase().endsWith("@alabang.sti.edu.ph");
  }, []);

  /** --- Initial Load: Fetch All Departments --- **/
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

  /** --- Excel Operations --- **/
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
    const worksheet = workbook.addWorksheet("Teachers Template") as WorksheetWithValidation;

    worksheet.columns = [
      { header: "PSCS ID", key: "pscs_id", width: 18 },
      { header: "Teacher Code", key: "teacher_code", width: 15 },
      { header: "First Name", key: "f_name", width: 25 },
      { header: "Middle Name", key: "m_name", width: 20 },
      { header: "Surname", key: "surname", width: 25 },
      { header: "Suffix", key: "suffix", width: 10 },
      { header: "Email", key: "email", width: 35 },
      { header: "Department", key: "department", width: 25 },
      { header: "Employment Type", key: "employment_type", width: 20 },
      { header: "Status", key: "status", width: 15 },
    ];

    worksheet.addRow({
      pscs_id: "1234567890123",
      teacher_code: "JMR",
      f_name: "James",
      m_name: "M.",
      surname: "Resurreccion",
      suffix: "",
      email: "j.resurreccion@alabang.sti.edu.ph",
      department: allDepartments[0] || "Information Technology",
      employment_type: "Full-Time",
      status: "Active",
    });

    worksheet.dataValidations.add("I2:I1000", {
      type: "list",
      allowBlank: false,
      formulae: ['"Full-Time,Part-Time Full Load,Part-Time"'],
      showErrorMessage: true,
      errorTitle: "Invalid Employment Type",
      error: "Please select a valid employment type from the dropdown.",
    });

    const buffer = await workbook.xlsx.writeBuffer();
    downloadWorkbook(buffer, "Teachers_Management_Template.xlsx");
    setToastMessage("Blank Excel template downloaded successfully!");
    setToastType("success");
    setShowToast(true);
  }, [allDepartments, downloadWorkbook]);

  const handleExportExcel = useCallback(async () => {
    try {
      const response = await fetchTeachers(
        searchTerm || null,
        statusFilter,
        departmentFilter,
        sortTeachersBy,
        sortTeachersDir,
        10000,
        1,
      );

      const exportList = response?.success && Array.isArray(response.data) ? response.data : [];

      if (exportList.length === 0) {
        setToastMessage("No teacher records available to export.");
        setToastType("warning");
        setShowToast(true);
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Teachers Export") as WorksheetWithValidation;

      worksheet.columns = [
        { header: "PSCS ID", key: "pscs_id", width: 18 },
        { header: "Teacher Code", key: "teacher_code", width: 15 },
        { header: "First Name", key: "f_name", width: 25 },
        { header: "Middle Name", key: "m_name", width: 20 },
        { header: "Surname", key: "surname", width: 25 },
        { header: "Suffix", key: "suffix", width: 10 },
        { header: "Email", key: "email", width: 35 },
        { header: "Department", key: "department", width: 25 },
        { header: "Employment Type", key: "employment_type", width: 20 },
        { header: "Status", key: "status", width: 15 },
      ];

      exportList.forEach((item: TeacherRecord) => {
        worksheet.addRow({
          pscs_id: item.pscs_id || "",
          teacher_code: item.teacher_code || "",
          f_name: item.f_name || "",
          m_name: item.m_name || "",
          surname: item.surname || "",
          suffix: item.suffix || "",
          email: item.email || "",
          department: item.department || "",
          employment_type: item.employment_type || "Full-Time",
          status: item.status || "Active",
        });
      });

      worksheet.dataValidations.add("I2:I1000", {
        type: "list",
        allowBlank: false,
        formulae: ['"Full-Time,Part-Time Full Load,Part-Time"'],
      });

      const buffer = await workbook.xlsx.writeBuffer();
      downloadWorkbook(buffer, `Teachers_Export_${new Date().toISOString().split("T")[0]}.xlsx`);
      setToastMessage("Teachers exported to Excel successfully");
      setToastType("success");
      setShowToast(true);
    } catch (err) {
      console.error(err);
      setToastMessage("Failed to export records to Excel");
      setToastType("error");
      setShowToast(true);
    }
  }, [searchTerm, statusFilter, departmentFilter, sortTeachersBy, sortTeachersDir, downloadWorkbook]);

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

      setImportLogs((prev) => [...prev, `Headers verified. Validating rows against system rules...`]);

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
      const codeCol = headerIndexMap["teacher code"] || 2;
      const fNameCol = headerIndexMap["first name"] || 3;
      const mNameCol = headerIndexMap["middle name"] || 4;
      const surnameCol = headerIndexMap["surname"] || 5;
      const suffixCol = headerIndexMap["suffix"] || 6;
      const emailCol = headerIndexMap["email"] || 7;
      const deptCol = headerIndexMap["department"] || 8;
      const empCol = headerIndexMap["employment type"] || 9;
      const statusCol = headerIndexMap["status"] || 10;

      const rowsToProcess: {
        rowNum: number;
        pscs_id: string;
        teacher_code: string;
        f_name: string;
        m_name: string;
        surname: string;
        suffix: string;
        email: string;
        department: string;
        employment_type: string;
        status: string;
      }[] = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const pscs_id = filterNumeric(String(row.getCell(pscsCol).value || "")).slice(0, 13);
        const teacher_code = filterAlphaNoSpace(String(row.getCell(codeCol).value || "")).slice(0, 6).toUpperCase();
        const f_name = filterAlphaDashSpace(String(row.getCell(fNameCol).value || "")).slice(0, 50).toUpperCase();
        const m_name = filterAlphaDashSpace(String(row.getCell(mNameCol).value || "")).slice(0, 50).toUpperCase();
        const surname = filterAlphaDashSpace(String(row.getCell(surnameCol).value || "")).slice(0, 50).toUpperCase();
        const suffix = filterAlpha(String(row.getCell(suffixCol).value || "")).slice(0, 10).toUpperCase();
        const email = filterEmail(String(row.getCell(emailCol).value || "")).slice(0, 100);
        const department = String(row.getCell(deptCol).value || "").trim();
        const employment_type = String(row.getCell(empCol).value || "Full-Time").trim();
        const status = String(row.getCell(statusCol).value || "Active").trim();

        if (!pscs_id || !teacher_code || !f_name || !surname || !email) {
          logs.push(`Row ${rowNumber}: Skipped. Mandatory fields are missing.`);
          failCount++;
          return;
        }

        if (!email.toLowerCase().endsWith("@alabang.sti.edu.ph")) {
          logs.push(`Row ${rowNumber} (${teacher_code}): Skipped. Email must use domain @alabang.sti.edu.ph.`);
          failCount++;
          return;
        }

        rowsToProcess.push({
          rowNum: rowNumber,
          pscs_id,
          teacher_code,
          f_name,
          m_name,
          surname,
          suffix,
          email,
          department,
          employment_type: ["Full-Time", "Part-Time Full Load", "Part-Time"].includes(employment_type)
            ? employment_type
            : "Full-Time",
          status: ["Active", "On Leave", "Inactive"].includes(status) ? status : "Active",
        });
      });

      for (const item of rowsToProcess) {
        const payload = {
          pscs_id: item.pscs_id,
          email: item.email,
          f_name: item.f_name,
          m_name: item.m_name || undefined,
          surname: item.surname,
          suffix: item.suffix || undefined,
          teacher_code: item.teacher_code,
          department: item.department || undefined,
          employment_type: item.employment_type,
          status: item.status,
          availability: DEFAULT_FULLTIME_AVAILABILITY,
        };

        const res = await createTeacher(username ?? "system", payload);
        if (res?.success) {
          successCount++;
        } else {
          logs.push(`Row ${item.rowNum} (${item.teacher_code}): ${res?.error || "Creation failed."}`);
          failCount++;
        }
      }

      setImportLogs((prev) => [
        ...prev,
        `Import Completed: ${successCount} successful, ${failCount} failed.`,
        ...logs,
      ]);

      if (successCount > 0) {
        setToastMessage(`Imported ${successCount} teacher records successfully.`);
        setToastType("success");
        setShowToast(true);
      }
    } catch (err) {
      console.error(err);
      setFormatError("Error: Unable to parse Excel workbook format using ExcelJS.");
    } finally {
      setIsImporting(false);
    }
  }, [importFile, username]);

  /** --- Employment Type Switch Logic --- **/
  const handleAddEmploymentChange = useCallback((type: string) => {
    setInputEmploymentType(type);
    setAvailError("");
    if (type === "Part-Time") {
      setAvailabilityList([]);
    } else {
      setAvailabilityList(DEFAULT_FULLTIME_AVAILABILITY);
    }
  }, []);

  const handleEditEmploymentChange = useCallback((type: string) => {
    editEmploymentType(type);
    setEditAvailError("");
    if (type === "Part-Time") {
      setEditAvailabilityList([]);
    } else {
      setEditAvailabilityList(DEFAULT_FULLTIME_AVAILABILITY);
    }
  }, []);

  /** --- Add Availability Slot Actions --- **/
  const handleAddAvailabilitySlot = useCallback(() => {
    if (!addAvailStart || !addAvailEnd) {
      setAvailError("Please specify both start and end times.");
      return;
    }
    if (addAvailStart >= addAvailEnd) {
      setAvailError("End time must be later than start time.");
      return;
    }

    const selectedDayName =
      DAYS_OF_WEEK.find((d) => d.id === addAvailDay)?.name || "Monday";
    const formattedStart = formatTime12hr(addAvailStart);
    const formattedEnd = formatTime12hr(addAvailEnd);

    setAvailabilityList((prev) => {
      const isDuplicate = prev.some(
        (slot) =>
          slot.day === selectedDayName &&
          slot.startTime === formattedStart &&
          slot.endTime === formattedEnd,
      );

      if (isDuplicate) {
        setAvailError("This availability slot has already been added.");
        return prev;
      }

      setAvailError("");
      return [
        ...prev,
        {
          day: selectedDayName,
          startTime: formattedStart,
          endTime: formattedEnd,
        },
      ];
    });
  }, [addAvailStart, addAvailEnd, addAvailDay, formatTime12hr]);

  const handleRemoveAvailabilitySlot = useCallback((index: number) => {
    setAvailabilityList((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleEditAddAvailabilitySlot = useCallback(() => {
    if (!editAvailStart || !editAvailEnd) {
      setEditAvailError("Please specify both start and end times.");
      return;
    }
    if (editAvailStart >= editAvailEnd) {
      setEditAvailError("End time must be later than start time.");
      return;
    }

    const selectedDayName =
      DAYS_OF_WEEK.find((d) => d.id === editAvailDay)?.name || "Monday";
    const formattedStart = formatTime12hr(editAvailStart);
    const formattedEnd = formatTime12hr(editAvailEnd);

    setEditAvailabilityList((prev) => {
      const isDuplicate = prev.some(
        (slot) =>
          slot.day === selectedDayName &&
          slot.startTime === formattedStart &&
          slot.endTime === formattedEnd,
      );

      if (isDuplicate) {
        setEditAvailError("This availability slot has already been added.");
        return prev;
      }

      setEditAvailError("");
      return [
        ...prev,
        {
          day: selectedDayName,
          startTime: formattedStart,
          endTime: formattedEnd,
        },
      ];
    });
  }, [editAvailStart, editAvailEnd, editAvailDay, formatTime12hr]);

  const handleEditRemoveAvailabilitySlot = useCallback((index: number) => {
    setEditAvailabilityList((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /** --- Table Functions --- **/
  const handleTeacherSorting = useCallback((sortBy: string) => {
    setSortTeachersBy((prevSort) => {
      setSortTeachersDir((prevDir) => {
        const newDir = sortBy === prevSort && prevDir === "ASC" ? "DESC" : "ASC";
        return newDir;
      });
      return sortBy;
    });
    setTeachers([]);
    setCurrentTeacherPage(1);
  }, []);

  const onPageChangeTeachers = useCallback((page: number) => {
    setPageChangingTeachers(true);
    setTeachers([]);
    setCurrentTeacherPage(page);
    setPageChangingTeachers(false);
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentTeacherPage(1);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchTerm("");
    setCurrentTeacherPage(1);
  }, []);

  const handleStatusFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value as TeacherStatusFilter);
    setCurrentTeacherPage(1);
  }, []);

  const handleDepartmentFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setDepartmentFilter(e.target.value);
    setCurrentTeacherPage(1);
  }, []);

  /** --- Input Handlers (Add Form) --- **/
  const handlePscsIdChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterNumeric(e.target.value).slice(0, 13);
    setInputPscsId(val);
    setPscsIdError(!val ? "PSCS ID is required." : "");
  }, []);

  const handleTeacherCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterAlphaNoSpace(e.target.value).slice(0, 6).toUpperCase();
    setInputTeacherCode(val);
    setTeacherCodeError(!val ? "Teacher code is required." : "");
  }, []);

  const handleFNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterAlphaDashSpace(e.target.value).slice(0, 50).toUpperCase();
    setInputFName(val);
    setFNameError(!val.trim() ? "First name is required." : "");
  }, []);

  const handleSurnameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterAlphaDashSpace(e.target.value).slice(0, 50).toUpperCase();
    setInputSurname(val);
    setSurnameError(!val.trim() ? "Surname is required." : "");
  }, []);

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterEmail(e.target.value).slice(0, 100);
    setInputEmail(val);

    if (!val) {
      setEmailError("Email is required.");
    } else if (!validateEmailFormat(val)) {
      setEmailError("Email must use the domain: @alabang.sti.edu.ph");
    } else {
      setEmailError("");
    }
  }, [validateEmailFormat]);

  /** --- Input Handlers (Edit Form) --- **/
  const handleNewPscsIdChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterNumeric(e.target.value).slice(0, 13);
    editPscsId(val);
    setEditPscsIdError(!val ? "PSCS ID is required." : "");
  }, []);

  const handleNewTeacherCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterAlphaNoSpace(e.target.value).slice(0, 6).toUpperCase();
    editTeacherCode(val);
    setEditTeacherCodeError(!val ? "Teacher code is required." : "");
  }, []);

  const handleNewFNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterAlphaDashSpace(e.target.value).slice(0, 50).toUpperCase();
    editFName(val);
    setEditFNameError(!val.trim() ? "First name is required." : "");
  }, []);

  const handleNewSurnameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterAlphaDashSpace(e.target.value).slice(0, 50).toUpperCase();
    editSurname(val);
    setEditSurnameError(!val.trim() ? "Surname is required." : "");
  }, []);

  const handleNewEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterEmail(e.target.value).slice(0, 100);
    editEmail(val);

    if (!val) {
      setEditEmailError("Email is required.");
    } else if (!validateEmailFormat(val)) {
      setEditEmailError("Email must use the domain: @alabang.sti.edu.ph");
    } else {
      setEditEmailError("");
    }
  }, [validateEmailFormat]);

  const handleCloseTeacherModals = useCallback(() => {
    setRowID("");
    setPscsIdError("");
    setTeacherCodeError("");
    setFNameError("");
    setSurnameError("");
    setEmailError("");
    setDepartmentError("");
    setAvailError("");

    setEditPscsIdError("");
    setEditTeacherCodeError("");
    setEditFNameError("");
    setEditSurnameError("");
    setEditEmailError("");
    setEditDepartmentError("");
    setEditAvailError("");

    setOpenAddTeacherModal(false);
    setOpenEditTeacherModal(false);
    setOpenArchiveModal(false);
    setOpenUnarchiveModal(false);
    setOpenExcelModal(false);
    setSelectedUnarchiveTeacher(null);

    setInputPscsId("");
    setInputEmail("");
    setInputFName("");
    setInputMName("");
    setInputSurname("");
    setInputSuffix("");
    setInputTeacherCode("");
    setInputDepartment("");
    setInputEmploymentType("Full-Time");
    setInputStatus("Active");
    setAvailabilityList(DEFAULT_FULLTIME_AVAILABILITY);

    editPscsId("");
    editEmail("");
    editFName("");
    editMName("");
    editSurname("");
    editSuffix("");
    editTeacherCode("");
    editDepartment("");
    editEmploymentType("Full-Time");
    editStatus("Active");
    setEditAvailabilityList([]);

    setImportFile(null);
    setImportLogs([]);
    setFormatError("");
    setIsImporting(false);
  }, []);

  const openUnarchiveConfirmation = useCallback((item: TeacherRecord) => {
    setSelectedUnarchiveTeacher(item);
    setOpenUnarchiveModal(true);
  }, []);

  const loadEditData = useCallback((row_id: string) => {
    setRowID(row_id);
    const selectedTeacher = teachers.find((item) => item.teacher_id === row_id);

    if (selectedTeacher) {
      const pscs = selectedTeacher.pscs_id ?? "";
      const emailVal = selectedTeacher.email ?? "";
      const fname = selectedTeacher.f_name ?? "";
      const mname = selectedTeacher.m_name ?? "";
      const sname = selectedTeacher.surname ?? "";
      const sfx = selectedTeacher.suffix ?? "";
      const code = selectedTeacher.teacher_code ?? "";
      const dept = selectedTeacher.department ?? "";
      const emp = selectedTeacher.employment_type ?? "Full-Time";
      const st = selectedTeacher.status ?? "Active";

      let slots: AvailabilitySlot[] = [];
      if (Array.isArray(selectedTeacher.availability)) {
        slots = selectedTeacher.availability as AvailabilitySlot[];
      } else if (typeof selectedTeacher.availability === "string") {
        try {
          const parsed = JSON.parse(selectedTeacher.availability);
          slots = Array.isArray(parsed) ? parsed : [];
        } catch {
          slots = [];
        }
      }

      const avail =
        slots.length > 0
          ? slots
          : emp === "Part-Time"
            ? []
            : DEFAULT_FULLTIME_AVAILABILITY;

      setBasePscsId(pscs);
      setBaseEmail(emailVal);
      setBaseFName(fname);
      setBaseMName(mname);
      setBaseSurname(sname);
      setBaseSuffix(sfx);
      setBaseTeacherCode(code);
      setBaseDepartment(dept);
      setBaseEmploymentType(emp);
      setBaseStatus(st);
      setBaseAvailabilityList(avail);

      editPscsId(pscs);
      editEmail(emailVal);
      editFName(fname);
      editMName(mname);
      editSurname(sname);
      editSuffix(sfx);
      editTeacherCode(code);
      editDepartment(dept);
      editEmploymentType(emp);
      editStatus(st);
      setEditAvailabilityList(avail);

      const isValid = allDepartments.some(
        (department) => department.toLowerCase() === dept.trim().toLowerCase(),
      );

      if (!isValid && dept !== "") {
        setEditDepartmentError(
          "Invalid department code or department missing.",
        );
      } else {
        setEditDepartmentError("");
      }

      setOpenEditTeacherModal(true);
    }
  }, [teachers, allDepartments]);

  const isAddFormInvalid = useMemo(() => {
    return (
      !inputPscsId.trim() ||
      !inputTeacherCode.trim() ||
      !inputFName.trim() ||
      !inputSurname.trim() ||
      !inputEmail.trim() ||
      !inputDepartment.trim() ||
      !!pscsIdError ||
      !!teacherCodeError ||
      !!fNameError ||
      !!surnameError ||
      !!emailError ||
      !!departmentError
    );
  }, [
    inputPscsId,
    inputTeacherCode,
    inputFName,
    inputSurname,
    inputEmail,
    inputDepartment,
    pscsIdError,
    teacherCodeError,
    fNameError,
    surnameError,
    emailError,
    departmentError,
  ]);

  const isEditFormInvalid = useMemo(() => {
    return (
      !newPscsId.trim() ||
      !newTeacherCode.trim() ||
      !newFName.trim() ||
      !newSurname.trim() ||
      !newEmail.trim() ||
      !newDepartment.trim() ||
      !!editPscsIdError ||
      !!editTeacherCodeError ||
      !!editFNameError ||
      !!editSurnameError ||
      !!editEmailError ||
      !!editDepartmentError
    );
  }, [
    newPscsId,
    newTeacherCode,
    newFName,
    newSurname,
    newEmail,
    newDepartment,
    editPscsIdError,
    editTeacherCodeError,
    editFNameError,
    editSurname,
    editEmailError,
    editDepartmentError,
  ]);

  const isEditFormUnchanged = useMemo(() => {
    return (
      newPscsId === basePscsId &&
      newEmail === baseEmail &&
      newFName === baseFName &&
      newMName === baseMName &&
      newSurname === baseSurname &&
      newSuffix === baseSuffix &&
      newTeacherCode === baseTeacherCode &&
      newDepartment === baseDepartment &&
      newEmploymentType === baseEmploymentType &&
      newStatus === baseStatus &&
      JSON.stringify(editAvailabilityList) === JSON.stringify(baseAvailabilityList)
    );
  }, [
    newPscsId,
    basePscsId,
    newEmail,
    baseEmail,
    newFName,
    baseFName,
    newMName,
    baseMName,
    newSurname,
    baseSurname,
    newSuffix,
    baseSuffix,
    newTeacherCode,
    baseTeacherCode,
    newDepartment,
    baseDepartment,
    newEmploymentType,
    baseEmploymentType,
    newStatus,
    baseStatus,
    editAvailabilityList,
    baseAvailabilityList,
  ]);

  /** --- Database Integration --- **/
  const getTeacherCount = useCallback(async (
    search: string | null = searchTerm,
    status: TeacherStatusFilter = statusFilter,
    department: string = departmentFilter,
  ) => {
    const response = await fetchTeachersCount(search, status, department);

    if (response?.success) {
      setTeachersCount(response.count);
    } else {
      setToastMessage(
        response?.error ?? "[fetchTeachersCount]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
      setTeachersCount(0);
    }
  }, [searchTerm, statusFilter, departmentFilter]);

  const getTeachers = useCallback(async (
    search: string | null = searchTerm,
    status: TeacherStatusFilter = statusFilter,
    department: string = departmentFilter,
    sortby: string = sortTeachersBy,
    sortdir: string = sortTeachersDir,
    limit: number = maxRowTeacher,
    page: number = currentTeacherPage,
  ) => {
    setLoading(true);

    const response = await fetchTeachers(
      search,
      status,
      department,
      sortby,
      sortdir,
      limit,
      page,
    );

    if (response?.success && response.data) {
      setTeachers(response.data);
    } else {
      setToastMessage(
        response?.error ?? "[fetchTeachers]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
      setTeachers([]);
    }

    setLoading(false);
    await getTeacherCount(search, status, department);
  }, [searchTerm, statusFilter, departmentFilter, sortTeachersBy, sortTeachersDir, currentTeacherPage, getTeacherCount]);

  const handleTeacherSubmit = useCallback(async () => {
    if (isAddFormInvalid) return;

    const payload = {
      pscs_id: inputPscsId.trim(),
      email: inputEmail.trim(),
      f_name: inputFName.trim(),
      m_name: inputMName.trim() || undefined,
      surname: inputSurname.trim(),
      suffix: inputSuffix.trim() || undefined,
      teacher_code: inputTeacherCode.trim(),
      department: inputDepartment.trim() || undefined,
      employment_type: inputEmploymentType,
      status: inputStatus,
      availability: availabilityList,
    };

    const response = await createTeacher(username ?? "system", payload);

    if (response?.success) {
      setToastMessage("Instructor added successfully");
      setToastType("success");
      setShowToastTimer(true);
      setShowToast(true);
      setProgress(0);
    } else {
      setToastMessage(
        response?.error ?? "[AddTeacher]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseTeacherModals();
    void getTeachers(
      searchTerm,
      statusFilter,
      departmentFilter,
      sortTeachersBy,
      sortTeachersDir,
      maxRowTeacher,
      currentTeacherPage,
    );
  }, [
    isAddFormInvalid,
    inputPscsId,
    inputEmail,
    inputFName,
    inputMName,
    inputSurname,
    inputSuffix,
    inputTeacherCode,
    inputDepartment,
    inputEmploymentType,
    inputStatus,
    availabilityList,
    username,
    handleCloseTeacherModals,
    getTeachers,
    searchTerm,
    statusFilter,
    departmentFilter,
    sortTeachersBy,
    sortTeachersDir,
    currentTeacherPage,
  ]);

  const handleTeacherUpdate = useCallback(async () => {
    if (isEditFormInvalid || isEditFormUnchanged) return;

    const payload = {
      pscs_id: newPscsId.trim(),
      email: newEmail.trim(),
      f_name: newFName.trim(),
      m_name: newMName.trim() || undefined,
      surname: newSurname.trim(),
      suffix: newSuffix.trim() || undefined,
      teacher_code: newTeacherCode.trim(),
      department: newDepartment.trim() || undefined,
      employment_type: newEmploymentType,
      status: newStatus,
      availability: editAvailabilityList,
    };

    const response = await updateTeacher(username ?? "system", rowID, payload);

    if (response?.success) {
      setToastMessage("Instructor updated successfully");
      setToastType("success");
      setShowToastTimer(true);
      setShowToast(true);
      setProgress(0);
    } else {
      setToastMessage(
        response?.error ?? "[UpdateTeacher]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseTeacherModals();
    void getTeachers(
      searchTerm,
      statusFilter,
      departmentFilter,
      sortTeachersBy,
      sortTeachersDir,
      maxRowTeacher,
      currentTeacherPage,
    );
  }, [
    isEditFormInvalid,
    isEditFormUnchanged,
    newPscsId,
    newEmail,
    newFName,
    newMName,
    newSurname,
    newSuffix,
    newTeacherCode,
    newDepartment,
    newEmploymentType,
    newStatus,
    editAvailabilityList,
    username,
    rowID,
    handleCloseTeacherModals,
    getTeachers,
    searchTerm,
    statusFilter,
    departmentFilter,
    sortTeachersBy,
    sortTeachersDir,
    currentTeacherPage,
  ]);

  const handleTeacherUnarchive = useCallback(async () => {
    if (!selectedUnarchiveTeacher) return;

    let parsedAvailability = selectedUnarchiveTeacher.availability;
    if (typeof parsedAvailability === "string") {
      try {
        parsedAvailability = JSON.parse(parsedAvailability);
      } catch {
        parsedAvailability = [];
      }
    }

    const payload = {
      pscs_id: selectedUnarchiveTeacher.pscs_id,
      email: selectedUnarchiveTeacher.email,
      f_name: selectedUnarchiveTeacher.f_name,
      m_name: selectedUnarchiveTeacher.m_name || undefined,
      surname: selectedUnarchiveTeacher.surname,
      suffix: selectedUnarchiveTeacher.suffix || undefined,
      teacher_code: selectedUnarchiveTeacher.teacher_code,
      department: selectedUnarchiveTeacher.department || undefined,
      employment_type: selectedUnarchiveTeacher.employment_type,
      status: "Active",
      availability: parsedAvailability,
    };

    const response = await updateTeacher(
      username ?? "system",
      selectedUnarchiveTeacher.teacher_id,
      payload,
    );

    if (response?.success) {
      setToastMessage("Instructor record restored successfully");
      setToastType("success");
      setShowToastTimer(true);
      setShowToast(true);
      setProgress(0);
    } else {
      setToastMessage(
        response?.error ?? "[UnarchiveTeacher]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseTeacherModals();
    void getTeachers(
      searchTerm,
      statusFilter,
      departmentFilter,
      sortTeachersBy,
      sortTeachersDir,
      maxRowTeacher,
      currentTeacherPage,
    );
  }, [
    selectedUnarchiveTeacher,
    username,
    handleCloseTeacherModals,
    getTeachers,
    searchTerm,
    statusFilter,
    departmentFilter,
    sortTeachersBy,
    sortTeachersDir,
    currentTeacherPage,
  ]);

  const handleTeacherArchive = useCallback(async () => {
    const response = await archiveTeacher(username ?? "system", rowID);

    if (response?.success) {
      setToastMessage("Instructor record archived successfully");
      setToastType("success");
      setShowToastTimer(true);
      setShowToast(true);
      setProgress(0);
    } else {
      setToastMessage(
        response?.error ?? "[ArchiveTeacher]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseTeacherModals();
    void getTeachers(
      searchTerm,
      statusFilter,
      departmentFilter,
      sortTeachersBy,
      sortTeachersDir,
      maxRowTeacher,
      currentTeacherPage,
    );
  }, [
    username,
    rowID,
    handleCloseTeacherModals,
    getTeachers,
    searchTerm,
    statusFilter,
    departmentFilter,
    sortTeachersBy,
    sortTeachersDir,
    currentTeacherPage,
  ]);

  const closeToast = useCallback(() => {
    setShowToast(false);
    setToastType("");
    setToastMessage("");
    setShowToastTimer(false);
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      void getTeachers(
        searchTerm,
        statusFilter,
        departmentFilter,
        sortTeachersBy,
        sortTeachersDir,
        maxRowTeacher,
        currentTeacherPage,
      );
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, statusFilter, departmentFilter, sortTeachersBy, sortTeachersDir, currentTeacherPage, getTeachers]);

  return (
    <>
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
            <ToastToggle onDismiss={closeToast} />
          </Toast>
          <Progress
            progress={Math.min(Math.round(progress), 100)}
            size="sm"
            className={`${showToastTimer ? "" : "hidden"} ease-linear`}
          />
        </div>
      )}

      {/* Header Bar */}
      <div className="mb-4 flex-col justify-between gap-4 md:flex md:flex-row md:items-center">
        <div className={"mb-2"}>
          <h2 className="mb-1 text-lg font-bold">Teachers Management</h2>
          <p className="text-gray-500">
            Manage instructors, departments, and employment status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full md:w-48">
            <Select
              id="department-filter"
              value={departmentFilter}
              onChange={handleDepartmentFilterChange}
            >
              <option value="All Departments">All Departments</option>
              {allDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-full md:w-52">
            <Select
              id="status-filter"
              value={statusFilter}
              onChange={handleStatusFilterChange}
            >
              <optgroup label="Active Statuses">
                <option value="All Active & On Leave">
                  All Active & On Leave
                </option>
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
              </optgroup>
              <optgroup label="Inactive & Historical">
                <option value="Inactive">Inactive</option>
                <option value="Archived (Soft-Deleted)">
                  Archived (Soft-Deleted)
                </option>
              </optgroup>
              <optgroup label="Everything">
                <option value="All Statuses">All Statuses</option>
              </optgroup>
            </Select>
          </div>

          <div className="relative w-full md:w-60">
            <TextInput
              id="search-teachers"
              type="text"
              placeholder="Search code, name, department..."
              value={searchTerm}
              onChange={handleSearchChange}
              icon={HiSearch}
              maxLength={100}
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
            onClick={() => setOpenAddTeacherModal(true)}
          >
            <FaPlus className="mr-2" />
            Add Instructor
          </Button>
        </div>
      </div>

      {/* Table Section */}
      <Card className="overflow-x-auto">
        <Table hoverable>
          <TableHead>
            <TableRow>
              <TableHeadCell
                onClick={() => handleTeacherSorting("teacher_code")}
              >
                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Code
                  {sortTeachersBy === "teacher_code" &&
                    (sortTeachersDir === "ASC" ? (
                      <FaSortUp className="ml-1" />
                    ) : (
                      <FaSortDown className="ml-1" />
                    ))}
                </div>
              </TableHeadCell>

              <TableHeadCell onClick={() => handleTeacherSorting("surname")}>
                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Instructor Name
                  {sortTeachersBy === "surname" &&
                    (sortTeachersDir === "ASC" ? (
                      <FaSortUp className="ml-1" />
                    ) : (
                      <FaSortDown className="ml-1" />
                    ))}
                </div>
              </TableHeadCell>

              <TableHeadCell onClick={() => handleTeacherSorting("email")}>
                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Email
                  {sortTeachersBy === "email" &&
                    (sortTeachersDir === "ASC" ? (
                      <FaSortUp className="ml-1" />
                    ) : (
                      <FaSortDown className="ml-1" />
                    ))}
                </div>
              </TableHeadCell>

              <TableHeadCell onClick={() => handleTeacherSorting("department")}>
                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Department
                  {sortTeachersBy === "department" &&
                    (sortTeachersDir === "ASC" ? (
                      <FaSortUp className="ml-1" />
                    ) : (
                      <FaSortDown className="ml-1" />
                    ))}
                </div>
              </TableHeadCell>

              <TableHeadCell
                onClick={() => handleTeacherSorting("employment_type")}
              >
                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Employment
                  {sortTeachersBy === "employment_type" &&
                    (sortTeachersDir === "ASC" ? (
                      <FaSortUp className="ml-1" />
                    ) : (
                      <FaSortDown className="ml-1" />
                    ))}
                </div>
              </TableHeadCell>

              <TableHeadCell onClick={() => handleTeacherSorting("status")}>
                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Status
                  {sortTeachersBy === "status" &&
                    (sortTeachersDir === "ASC" ? (
                      <FaSortUp className="ml-1" />
                    ) : (
                      <FaSortDown className="ml-1" />
                    ))}
                </div>
              </TableHeadCell>

              <TableHeadCell>
                <span>Availability</span>
              </TableHeadCell>

              <TableHeadCell>
                <span className="sr-only">Actions</span>
              </TableHeadCell>
            </TableRow>
          </TableHead>

          <TableBody className="divide-y">
            {teachers.length > 0 ? (
              teachers.map((item) => {
                const displayFullName =
                  item.full_name ||
                  [
                    item.surname ? `${item.surname},` : "",
                    item.f_name ?? "",
                    item.m_name ? `${item.m_name.charAt(0)}.` : "",
                    item.suffix ?? "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                const isDeptValid =
                  !item.department ||
                  allDepartments.some(
                    (dept) =>
                      dept.toLowerCase() ===
                      item.department?.trim().toLowerCase(),
                  );

                const isArchived = item.status
                  ?.toLowerCase()
                  .includes("archive");

                return (
                  <TableRow
                    key={item.teacher_id}
                    className="bg-white dark:border-gray-700 dark:bg-gray-800"
                  >
                    <TableCell className="font-mono text-sm">
                      {item.teacher_code || "—"}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      {displayFullName || "—"}
                    </TableCell>
                    <TableCell>{item.email || "—"}</TableCell>
                    <TableCell>
                      {!isDeptValid ? (
                        <Tooltip
                          className={
                            "border-2 border-gray-900 bg-white text-gray-500 dark:border-white dark:bg-gray-800 dark:text-gray-300"
                          }
                          placement={"right"}
                          content="Invalid department code or department missing"
                          style={isDarkMode ? "light" : "dark"}
                        >
                          <span className="cursor-pointer font-semibold text-red-600 dark:text-red-400">
                            {item.department || "—"}
                          </span>
                        </Tooltip>
                      ) : (
                        item.department || "—"
                      )}
                    </TableCell>
                    <TableCell>{item.employment_type || "—"}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          item.status === "Active"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                            : item.status === "On Leave"
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                              : item.status === "Inactive"
                                ? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                        }`}
                      >
                        {item.status || "Active"}
                      </span>
                    </TableCell>

                    <TableCell className="max-w-55">
                      <div className="relative">
                        <div className="h-12 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent overflow-y-auto mask-[linear-gradient(to_bottom,black_60%,transparent_100%)] pr-1 pb-4 text-xs text-gray-700 dark:scrollbar-thumb-white dark:text-gray-300">
                          {renderAvailability(item)}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="flex items-center gap-3">
                      {isArchived ? (
                        <a
                          onClick={() => openUnarchiveConfirmation(item)}
                          className="flex cursor-pointer items-center gap-1 font-medium text-emerald-600 hover:underline dark:text-emerald-500"
                        >
                          <HiRefresh className="h-4 w-4" />
                          Unarchive
                        </a>
                      ) : (
                        <a
                          onClick={() => loadEditData(item.teacher_id)}
                          className="text-primary-600 dark:text-primary-500 cursor-pointer font-medium hover:underline"
                        >
                          Edit
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : isLoading ? (
              <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                <TableCell
                  colSpan={8}
                  className="py-6 text-center text-sm text-gray-500 italic dark:text-gray-400"
                >
                  <div className="flex items-center justify-center">
                    <Spinner />
                    <span className="ml-4">Fetching faculty data...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                <TableCell
                  colSpan={8}
                  className="py-6 text-center text-sm text-gray-500 italic dark:text-gray-400"
                >
                  {searchTerm
                    ? `No instructors matching "${searchTerm}" found.`
                    : "No faculty entries found."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination Container */}
      <div
        className={`mt-4 ${
          isLoading
            ? "pointer-events-none opacity-50 [&_a]:cursor-not-allowed [&_button]:cursor-not-allowed"
            : ""
        } flex w-full justify-center`}
      >
        <Pagination
          layout="pagination"
          currentPage={currentTeacherPage || 1}
          totalPages={Math.ceil(teachersCount / maxRowTeacher) || 1}
          onPageChange={onPageChangeTeachers}
          showIcons
        />
      </div>

      {/* MODAL: EXCEL OPERATIONS */}
      <Modal show={openExcelModal} onClose={handleCloseTeacherModals} size="lg">
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
                  <span className="font-semibold uppercase tracking-wide">Required Format Headers:</span> {REQUIRED_HEADERS.join(", ")} (Employment type has dropdown validation).
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
                    Export Filtered Teachers
                  </h4>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Generates a standardized Excel spreadsheet containing all active query results with employment dropdown rules.
                  </p>
                </div>
                <Button onClick={handleExportExcel} className="w-full" color="green">
                  <FaFileExport className="mr-2 h-4 w-4" /> Export {teachersCount} Records to Excel
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
                    Includes columns formatted as: <b className="font-mono">{REQUIRED_HEADERS.join(", ")}</b> with built-in employment type dropdown lists.
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
          <Button color="alternative" onClick={handleCloseTeacherModals}>
            Close Window
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal: Add Teacher */}
      <Modal
        show={openAddTeacherModal}
        onClose={handleCloseTeacherModals}
        size="2xl"
      >
        <ModalHeader>Add New Faculty Member</ModalHeader>
        <ModalBody>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="pscs_id">PSCS ID *</Label>
              <TextInput
                id="pscs_id"
                placeholder="e.g. 1234567890123"
                value={inputPscsId}
                onChange={handlePscsIdChange}
                color={pscsIdError ? "failure" : "gray"}
                maxLength={13}
              />
              <div className="mt-1 flex items-center justify-between">
                {pscsIdError ? (
                  <HelperText color="failure">{pscsIdError}</HelperText>
                ) : (
                  <span />
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {inputPscsId.length}/13
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="teacher_code">Teacher Code *</Label>
              <TextInput
                id="teacher_code"
                placeholder="e.g. JMR"
                value={inputTeacherCode}
                onChange={handleTeacherCodeChange}
                color={teacherCodeError ? "failure" : "gray"}
                maxLength={6}
              />
              <div className="mt-1 flex items-center justify-between">
                {teacherCodeError ? (
                  <HelperText color="failure">{teacherCodeError}</HelperText>
                ) : (
                  <span />
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {inputTeacherCode.length}/6
                </span>
              </div>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="email">Email Address *</Label>
              <TextInput
                id="email"
                type="email"
                placeholder="e.g. instructor@alabang.sti.edu.ph"
                value={inputEmail}
                onChange={handleEmailChange}
                color={emailError ? "failure" : "gray"}
                maxLength={100}
              />
              <div className="mt-1 flex items-center justify-between">
                {emailError ? (
                  <HelperText color="failure">{emailError}</HelperText>
                ) : (
                  <span />
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {inputEmail.length}/100
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="f_name">First Name *</Label>
              <TextInput
                id="f_name"
                value={inputFName}
                onChange={handleFNameChange}
                color={fNameError ? "failure" : "gray"}
                maxLength={50}
              />
              <div className="mt-1 flex items-center justify-between">
                {fNameError ? (
                  <HelperText color="failure">{fNameError}</HelperText>
                ) : (
                  <span />
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {inputFName.length}/50
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="m_name">Middle Name</Label>
              <TextInput
                id="m_name"
                value={inputMName}
                onChange={(e) =>
                  setInputMName(
                    filterAlphaDashSpace(e.target.value)
                      .slice(0, 50)
                      .toUpperCase(),
                  )
                }
                maxLength={50}
              />
              <div className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
                {inputMName.length}/50
              </div>
            </div>

            <div>
              <Label htmlFor="surname">Surname *</Label>
              <TextInput
                id="surname"
                value={inputSurname}
                onChange={handleSurnameChange}
                color={surnameError ? "failure" : "gray"}
                maxLength={50}
              />
              <div className="mt-1 flex items-center justify-between">
                {surnameError ? (
                  <HelperText color="failure">{surnameError}</HelperText>
                ) : (
                  <span />
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {inputSurname.length}/50
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="suffix">Suffix</Label>
              <TextInput
                id="suffix"
                placeholder="e.g. Jr., III"
                value={inputSuffix}
                onChange={(e) =>
                  setInputSuffix(
                    filterAlpha(e.target.value).slice(0, 10).toUpperCase(),
                  )
                }
                maxLength={10}
              />
              <div className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
                {inputSuffix.length}/10
              </div>
            </div>

            <div>
              <Label htmlFor="department">Department *</Label>
              <Select
                id="department"
                value={inputDepartment}
                onChange={(e) => {
                  setInputDepartment(e.target.value);
                  setDepartmentError("");
                }}
              >
                <option value="" disabled>
                  Select a department
                </option>
                {allDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </Select>
              {departmentError && (
                <HelperText color="failure" className="mt-1">
                  {departmentError}
                </HelperText>
              )}
            </div>

            <div>
              <Label htmlFor="employment_type">Employment Type</Label>
              <Select
                id="employment_type"
                value={inputEmploymentType}
                onChange={(e) => handleAddEmploymentChange(e.target.value)}
              >
                <option value="Full-Time">Full-Time</option>
                <option value="Part-Time Full Load">Part-Time Full Load</option>
                <option value="Part-Time">Part-Time</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                id="status"
                value={inputStatus}
                onChange={(e) => setInputStatus(e.target.value)}
              >
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Inactive">Inactive</option>
              </Select>
            </div>

            {inputEmploymentType === "Part-Time" && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 sm:col-span-2 dark:border-gray-700 dark:bg-gray-800">
                <Label className="mb-2 block font-semibold">
                  Part-Time Availability
                </Label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
                  <div>
                    <Label
                      htmlFor="add_avail_day"
                      className="mb-1 block text-xs"
                    >
                      Day
                    </Label>
                    <Select
                      id="add_avail_day"
                      value={addAvailDay}
                      onChange={(e) => setAddAvailDay(Number(e.target.value))}
                    >
                      {DAYS_OF_WEEK.map((day) => (
                        <option key={day.id} value={day.id}>
                          {day.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <Label
                      htmlFor="add_avail_start"
                      className="mb-1 block text-xs"
                    >
                      Start Time
                    </Label>
                    <TextInput
                      id="add_avail_start"
                      type="time"
                      value={addAvailStart}
                      onChange={(e) => setAddAvailStart(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label
                      htmlFor="add_avail_end"
                      className="mb-1 block text-xs"
                    >
                      End Time
                    </Label>
                    <TextInput
                      id="add_avail_end"
                      type="time"
                      value={addAvailEnd}
                      onChange={(e) => setAddAvailEnd(e.target.value)}
                    />
                  </div>

                  <Button
                    type="button"
                    color="blue"
                    onClick={handleAddAvailabilitySlot}
                  >
                    <FaPlus className="mr-1 h-3 w-3" />
                    Add
                  </Button>
                </div>

                {availError && (
                  <HelperText color="failure" className="mt-2">
                    {availError}
                  </HelperText>
                )}

                {availabilityList.length > 0 && (
                  <div className="mt-4 border-t border-gray-200 pt-3 dark:border-gray-700">
                    <span className="text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                      Configured Schedules
                    </span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {availabilityList.map((slot, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        >
                          <span>
                            <strong>{slot.day}:</strong> {slot.startTime} –{" "}
                            {slot.endTime}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAvailabilitySlot(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <HiX className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button onClick={handleTeacherSubmit} disabled={isAddFormInvalid}>
            Create Record
          </Button>
          <Button color="alternative" onClick={handleCloseTeacherModals}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal: Edit Teacher */}
      <Modal
        show={openEditTeacherModal}
        onClose={handleCloseTeacherModals}
        size="2xl"
      >
        <ModalHeader>Update Faculty Member</ModalHeader>
        <ModalBody>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="edit_pscs_id">PSCS ID *</Label>
              <TextInput
                id="edit_pscs_id"
                value={newPscsId}
                onChange={handleNewPscsIdChange}
                color={editPscsIdError ? "failure" : "gray"}
                maxLength={13}
              />
              <div className="mt-1 flex items-center justify-between">
                {editPscsIdError ? (
                  <HelperText color="failure">{editPscsIdError}</HelperText>
                ) : (
                  <span />
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {newPscsId.length}/13
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="edit_teacher_code">Teacher Code *</Label>
              <TextInput
                id="edit_teacher_code"
                value={newTeacherCode}
                onChange={handleNewTeacherCodeChange}
                color={editTeacherCodeError ? "failure" : "gray"}
                maxLength={6}
              />
              <div className="mt-1 flex items-center justify-between">
                {editTeacherCodeError ? (
                  <HelperText color="failure">
                    {editTeacherCodeError}
                  </HelperText>
                ) : (
                  <span />
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {newTeacherCode.length}/6
                </span>
              </div>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="edit_email">Email Address *</Label>
              <TextInput
                id="edit_email"
                type="email"
                value={newEmail}
                onChange={handleNewEmailChange}
                color={editEmailError ? "failure" : "gray"}
                maxLength={100}
              />
              <div className="mt-1 flex items-center justify-between">
                {editEmailError ? (
                  <HelperText color="failure">{editEmailError}</HelperText>
                ) : (
                  <span />
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {newEmail.length}/100
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="edit_f_name">First Name *</Label>
              <TextInput
                id="edit_f_name"
                value={newFName}
                onChange={handleNewFNameChange}
                color={editFNameError ? "failure" : "gray"}
                maxLength={50}
              />
              <div className="mt-1 flex items-center justify-between">
                {editFNameError ? (
                  <HelperText color="failure">{editFNameError}</HelperText>
                ) : (
                  <span />
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {newFName.length}/50
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="edit_m_name">Middle Name</Label>
              <TextInput
                id="edit_m_name"
                value={newMName}
                onChange={(e) =>
                  editMName(
                    filterAlphaDashSpace(e.target.value)
                      .slice(0, 50)
                      .toUpperCase(),
                  )
                }
                maxLength={50}
              />
              <div className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
                {newMName.length}/50
              </div>
            </div>

            <div>
              <Label htmlFor="edit_surname">Surname *</Label>
              <TextInput
                id="edit_surname"
                value={newSurname}
                onChange={handleNewSurnameChange}
                color={editSurnameError ? "failure" : "gray"}
                maxLength={50}
              />
              <div className="mt-1 flex items-center justify-between">
                {editSurnameError ? (
                  <HelperText color="failure">{editSurnameError}</HelperText>
                ) : (
                  <span />
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {newSurname.length}/50
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="edit_suffix">Suffix</Label>
              <TextInput
                id="edit_suffix"
                value={newSuffix}
                onChange={(e) =>
                  editSuffix(
                    filterAlpha(e.target.value).slice(0, 10).toUpperCase(),
                  )
                }
                maxLength={10}
              />
              <div className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
                {newSuffix.length}/10
              </div>
            </div>

            <div>
              <Label htmlFor="edit_department">Department *</Label>
              <Select
                id="edit_department"
                value={newDepartment}
                onChange={(e) => {
                  editDepartment(e.target.value);
                  setEditDepartmentError("");
                }}
              >
                <option value="" disabled>
                  Select a department
                </option>
                {allDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </Select>
              {editDepartmentError && (
                <HelperText color="failure" className="mt-1">
                  {editDepartmentError}
                </HelperText>
              )}
            </div>

            <div>
              <Label htmlFor="edit_employment_type">Employment Type</Label>
              <Select
                id="edit_employment_type"
                value={newEmploymentType}
                onChange={(e) => handleEditEmploymentChange(e.target.value)}
              >
                <option value="Full-Time">Full-Time</option>
                <option value="Part-Time Full Load">Part-Time Full Load</option>
                <option value="Part-Time">Part-Time</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit_status">Status</Label>
              <Select
                id="edit_status"
                value={newStatus}
                onChange={(e) => editStatus(e.target.value)}
              >
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Inactive">Inactive</option>
              </Select>
            </div>

            {newEmploymentType === "Part-Time" && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 sm:col-span-2 dark:border-gray-700 dark:bg-gray-800">
                <Label className="mb-2 block font-semibold">
                  Part-Time Availability
                </Label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
                  <div>
                    <Label
                      htmlFor="edit_avail_day"
                      className="mb-1 block text-xs"
                    >
                      Day
                    </Label>
                    <Select
                      id="edit_avail_day"
                      value={editAvailDay}
                      onChange={(e) => setEditAvailDay(Number(e.target.value))}
                    >
                      {DAYS_OF_WEEK.map((day) => (
                        <option key={day.id} value={day.id}>
                          {day.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <Label
                      htmlFor="edit_avail_start"
                      className="mb-1 block text-xs"
                    >
                      Start Time
                    </Label>
                    <TextInput
                      id="edit_avail_start"
                      type="time"
                      value={editAvailStart}
                      onChange={(e) => setEditAvailStart(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label
                      htmlFor="edit_avail_end"
                      className="mb-1 block text-xs"
                    >
                      End Time
                    </Label>
                    <TextInput
                      id="edit_avail_end"
                      type="time"
                      value={editAvailEnd}
                      onChange={(e) => setEditAvailEnd(e.target.value)}
                    />
                  </div>

                  <Button
                    type="button"
                    color="blue"
                    onClick={handleEditAddAvailabilitySlot}
                  >
                    <FaPlus className="mr-1 h-3 w-3" />
                    Add
                  </Button>
                </div>

                {editAvailError && (
                  <HelperText color="failure" className="mt-2">
                    {editAvailError}
                  </HelperText>
                )}

                {editAvailabilityList.length > 0 && (
                  <div className="mt-4 border-t border-gray-200 pt-3 dark:border-gray-700">
                    <span className="text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                      Configured Schedules
                    </span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {editAvailabilityList?.length > 0 &&
                        editAvailabilityList.map((slot, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          >
                            <span>
                              <strong>{slot.day}:</strong> {slot.startTime} –{" "}
                              {slot.endTime}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleEditRemoveAvailabilitySlot(index)
                              }
                              className="text-red-500 hover:text-red-700"
                            >
                              <HiX className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter className="flex justify-between">
          <Button
            color="yellow"
            onClick={() => {
              setOpenEditTeacherModal(false);
              setOpenArchiveModal(true);
            }}
          >
            <HiArchive className="mr-1 h-5 w-5" />
            Archive
          </Button>

          <div className="flex gap-2">
            <Button
              onClick={handleTeacherUpdate}
              disabled={isEditFormUnchanged || isEditFormInvalid}
            >
              Save Changes
            </Button>
            <Button color="alternative" onClick={handleCloseTeacherModals}>
              Cancel
            </Button>
          </div>
        </ModalFooter>
      </Modal>

      {/* Modal: Archive Confirmation */}
      <Modal
        show={openArchiveModal}
        onClose={handleCloseTeacherModals}
        size="md"
      >
        <ModalHeader>Confirm Archival</ModalHeader>
        <ModalBody>
          <div className="text-center">
            <HiExclamation className="mx-auto mb-4 h-14 w-14 text-yellow-400 dark:text-yellow-300" />
            <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
              Are you sure you want to archive this instructor record?
            </h3>
          </div>
        </ModalBody>
        <ModalFooter className="justify-center">
          <Button color="yellow" onClick={handleTeacherArchive}>
            Yes, Archive
          </Button>
          <Button color="alternative" onClick={handleCloseTeacherModals}>
            No, Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal: Unarchive Confirmation */}
      <Modal
        show={openUnarchiveModal}
        onClose={handleCloseTeacherModals}
        size="md"
      >
        <ModalHeader>Confirm Unarchive</ModalHeader>
        <ModalBody>
          <div className="text-center">
            <HiRefresh className="mx-auto mb-4 h-14 w-14 text-emerald-500 dark:text-emerald-400" />
            <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
              Are you sure you want to unarchive{" "}
              <b className="font-bold dark:text-white">
                {selectedUnarchiveTeacher?.full_name}&#39;s
              </b>{" "}
              record? This will restore their status to Active.
            </h3>
          </div>
        </ModalBody>
        <ModalFooter className="justify-center">
          <Button color="green" onClick={() => void handleTeacherUnarchive()}>
            Yes, Unarchive
          </Button>
          <Button color="alternative" onClick={handleCloseTeacherModals}>
            No, Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}