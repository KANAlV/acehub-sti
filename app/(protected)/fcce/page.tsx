"use client";

import {
  Badge,
  Button,
  ButtonGroup,
  Card,
  Dropdown,
  DropdownItem,
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
import { FaPlus, FaSortDown, FaSortUp } from "react-icons/fa6";
import {
  HiCheck,
  HiExclamation,
  HiX,
  HiSearch,
  HiOutlineArchive,
  HiOutlineRefresh,
  HiOutlineTrash,
} from "react-icons/hi";
import { IoMdExit } from "react-icons/io";
import { useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";

export default function FcceManagement() {
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];
  const username = activeAccount?.username;
  const [isLoading, setLoading] = useState(true);

  // --- View Mode Toggle State (All vs Unmatched) --- //
  const [viewMode, setViewMode] = useState<"ALL" | "UNMATCHED">("ALL");
  const [unmatchedCount, setUnmatchedCount] = useState(0);

  // --- Academic Year State --- //
  const [academicYearList, setAcademicYearList] = useState<
    AcademicYearRecord[]
  >([]);
  const [selectedAySem, setSelectedAySem] = useState<string>("ALL");

  // --- Course Name Suggestions State (Replaced fetchSubjects) --- //
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

  // Archive Mode State strictly typed with ArchivedMode
  const [archiveFilter, setArchiveFilter] = useState<ArchivedMode>("ACTIVE");

  // --- Modal States --- //
  const [openAddModal, setOpenAddModal] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [openArchiveSingleModal, setOpenArchiveSingleModal] = useState(false);
  const [openUnarchiveModal, setOpenUnarchiveModal] = useState(false);
  const [openArchiveAllModal, setOpenArchiveAllModal] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);

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
  const [editTeacherName, setEditTeacherName] = useState("");
  const [editCourseName, setEditCourseName] = useState("");
  const [editAySem, setEditAySem] = useState("");
  const [isEditNewAySem, setIsEditNewAySem] = useState(false);
  const [editAyStartYear, setEditAyStartYear] = useState<string>("");
  const [editAyTerm, setEditAyTerm] = useState<string>("T1");
  const [editPass, setEditPass] = useState(false);
  const [isEditCourseMatched, setIsEditCourseMatched] = useState(true);

  // Base State for Change Tracking
  const [baseCourseName, setBaseCourseName] = useState("");
  const [baseAySem, setBaseAySem] = useState("");
  const [basePass, setBasePass] = useState(false);

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

  /** --- Generate Year Options Array --- **/
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from(
    { length: 21 },
    (_, i) => currentYear - 10 + i,
  );

  /** --- Helper Filters --- **/
  const containsAlpha = (val: string) => /[a-zA-Z]/.test(val);

  /** --- Short Code Format Generator --- **/
  const formatAySemCode = (
    startYrStr: string,
    endYrStr: string,
    termStr: string,
  ): string => {
    if (!startYrStr || !endYrStr || !termStr) return "";
    const formatYr = (y: string) => (y.length >= 4 ? y.slice(2) : y);
    return `${formatYr(startYrStr)}${formatYr(endYrStr)}${termStr}`;
  };

  /** --- Auto-calculate End Year and AY/Sem Code for Add Modal --- **/
  const handleAddCustomAyChange = (
    start: string = addAyStartYear,
    term: string = addAyTerm,
  ) => {
    setAddAyStartYear(start);
    setAddAyTerm(term);

    if (!start) {
      setAySemError("Start year is required.");
      setAddAySem("");
      return;
    }

    const startNum = parseInt(start, 10);
    const endNum = startNum + 1;
    const endStr = endNum.toString();

    setAySemError("");
    setAddAySem(formatAySemCode(start, endStr, term));
  };

  /** --- Auto-calculate End Year and AY/Sem Code for Edit Modal --- **/
  const handleEditCustomAyChange = (
    start: string = editAyStartYear,
    term: string = editAyTerm,
  ) => {
    setEditAyStartYear(start);
    setEditAyTerm(term);

    if (!start) {
      setEditAySemError("Start year is required.");
      setEditAySem("");
      return;
    }

    const startNum = parseInt(start, 10);
    const endNum = startNum + 1;
    const endStr = endNum.toString();

    setEditAySemError("");
    setEditAySem(formatAySemCode(start, endStr, term));
  };

  /** --- Load Academic Years --- **/
  async function loadAcademicYears() {
    const res = await fetchAcademicYears(null, "ay_sem", "DESC", 0, 1);
    if (res?.success && res.data) {
      setAcademicYearList(res.data);
    }
  }

  /** --- Load Distinct Course Names for Auto-suggestions & Validation --- **/
  async function loadCourseNames() {
    const res = await fetchDistinctCourseNames(null,  "ASC", 100, 1);
    if (res?.success && res.data) {
      setCourseNameList(res.data);
    }
  }

  useEffect(() => {
    void loadAcademicYears();
    void loadCourseNames();
  }, []);

  /** --- Filter Courses locally by course name --- **/
  const filterCourses = (term: string) => {
    if (!term.trim()) {
      setFilteredCourses([]);
      return;
    }
    const lower = term.toLowerCase();
    const matches = courseNameList.filter((name) =>
      name.toLowerCase().includes(lower)
    );
    setFilteredCourses(matches.slice(0, 10));
  };

  /** --- Fetch Teachers by Name or PSCS ID --- **/
  async function searchTeachers(term: string) {
    if (!term.trim()) {
      setTeacherList([]);
      return;
    }
    const res = await fetchTeachers(
      term,
      "All Active & On Leave",
      "All Departments",
      "surname",
      "ASC",
      10,
      1,
    );
    if (res?.success && res.data) {
      setTeacherList(res.data);
    }
  }

  /** --- Fetch Unmatched Count for Badge --- **/
  async function checkUnmatchedCount() {
    const res = await fetchFcceUnmatchedCount(
      searchTerm,
      selectedAySem || "ALL",
      archiveFilter,
    );
    if (res?.success) {
      setUnmatchedCount(res.count);
    }
  }

  useEffect(() => {
    void checkUnmatchedCount();
  }, [searchTerm, archiveFilter, selectedAySem]);

  /** --- Helper to check if a course exists --- **/
  const isCourseValid = (courseName: string) => {
    if (!courseName) return false;
    return courseNameList.some(
      (name) => name.toLowerCase().trim() === courseName.toLowerCase().trim()
    );
  };

  const hasInvalidSubjects = records.some(
    (item) => !isCourseValid(item.course_name),
  );
  const hasArchivedRecords = records.some((item) => item.archived);

  /** --- Table Sorting & Pagination Handlers --- **/
  function handleFcceSorting(sortBy: string) {
    const newDir =
      sortBy === sortFcceBy && sortFcceDir === "ASC" ? "DESC" : "ASC";
    setSortFcceBy(sortBy);
    setSortFcceDir(newDir);
    setRecords([]);
    setCurrentFccePage(1);
    void getFcceRecords(
      searchTerm,
      selectedAySem,
      archiveFilter,
      sortBy,
      newDir,
      maxRowFcce,
      1,
      viewMode,
    );
  }

  function onPageChangeFcce(page: number) {
    if (pageChanging) return;

    setPageChanging(true);
    setRecords([]);
    void getFcceRecords(
      searchTerm,
      selectedAySem,
      archiveFilter,
      sortFcceBy,
      sortFcceDir,
      maxRowFcce,
      page,
      viewMode,
    );
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

  const handleArchiveFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const newFilter = e.target.value as ArchivedMode;
    setArchiveFilter(newFilter);
    setCurrentFccePage(1);
    setRecords([]);
    setLoading(true);
    void getFcceRecords(
      searchTerm,
      selectedAySem,
      newFilter,
      sortFcceBy,
      sortFcceDir,
      maxRowFcce,
      1,
      viewMode,
    );
  };

  const handleAySemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAySem = e.target.value || "ALL";
    setSelectedAySem(newAySem);
    setCurrentFccePage(1);
    setRecords([]);
    setLoading(true);
    void getFcceRecords(
      searchTerm,
      newAySem,
      archiveFilter,
      sortFcceBy,
      sortFcceDir,
      maxRowFcce,
      1,
      viewMode,
    );
  };

  const handleViewModeToggle = () => {
    const nextMode = viewMode === "UNMATCHED" ? "ALL" : "UNMATCHED";
    setViewMode(nextMode);
    setCurrentFccePage(1);
    setRecords([]);
    setLoading(true);
    void getFcceRecords(
      searchTerm,
      selectedAySem,
      archiveFilter,
      sortFcceBy,
      sortFcceDir,
      maxRowFcce,
      1,
      nextMode,
    );
  };

  /** --- Form Validation and Handlers --- **/
  const validatePscsId = (val: string) => {
    if (!val.trim()) return "PSCS ID is required.";
    if (containsAlpha(val))
      return "PSCS ID cannot contain alphabetic characters.";
    return "";
  };

  const handleAddPscsIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, 15);
    setAddPscsId(val);
    setPscsIdError(validatePscsId(val));
    void searchTeachers(val);
  };

  const handleAddCourseNameChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const val = filterAlphanumericDashUnderscoreComma(e.target.value).slice(
      0,
      150,
    );
    setAddCourseName(val);
    setCourseNameError(!val.trim() ? "Course name is required." : "");
    filterCourses(val);
  };

  const handleSelectAddAySemChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const val = e.target.value;
    setAddAySem(val);
    setAySemError(!val.trim() ? "Academic Year / Semester is required." : "");
  };

  const handleEditCourseNameChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const val = filterAlphanumericDashUnderscoreComma(e.target.value).slice(
      0,
      150,
    );
    setEditCourseName(val);
    setEditCourseNameError(!val.trim() ? "Course name is required." : "");
    filterCourses(val);
  };

  const handleSelectEditAySemChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const val = e.target.value;
    setEditAySem(val);
    setEditAySemError(
      !val.trim() ? "Academic Year / Semester is required." : "",
    );
  };

  const handleSelectAddPscsId = (teacher: TeacherRecord) => {
    const selectedPscs = teacher.pscs_id
      ? filterAlphanumeric(teacher.pscs_id).slice(0, 15)
      : "";
    setAddPscsId(selectedPscs);
    setPscsIdError(validatePscsId(selectedPscs));
    setTeacherList([]);
  };

  const handleSelectAddCourse = (courseName: string) => {
    const course = filterAlphanumericDashUnderscoreComma(courseName).slice(
      0,
      150,
    );
    setAddCourseName(course);
    setCourseNameError("");
    setFilteredCourses([]);
  };

  const handleSelectEditCourse = (courseName: string) => {
    const course = filterAlphanumericDashUnderscoreComma(courseName).slice(
      0,
      150,
    );
    setEditCourseName(course);
    setEditCourseNameError("");
    setFilteredCourses([]);
  };

  function loadEditData(id: string) {
    setFcceId(id);
    const selectedRecord = records.find((item) => item.fcce_id === id);

    if (selectedRecord) {
      const pscs = filterAlphanumeric(selectedRecord.pscs_id || "").slice(
        0,
        15,
      );
      const teacher = selectedRecord.teacher_name || "";
      const course = filterAlphanumericDashUnderscoreComma(
        selectedRecord.course_name || "",
      ).slice(0, 150);
      const aySemVal = selectedRecord.ay_sem || "";
      const pass = !!selectedRecord.pass;
      const matched = isCourseValid(course);

      setBaseCourseName(course);
      setBaseAySem(aySemVal);
      setBasePass(pass);

      setEditPscsId(pscs);
      setEditTeacherName(teacher);
      setEditCourseName(course);
      setEditAySem(aySemVal);
      setIsEditNewAySem(false);
      setEditPass(pass);
      setIsEditCourseMatched(matched);

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

    setAddPscsId("");
    setAddCourseName("");
    setAddPass(true);
    setIsNewAySem(false);
    setAddAySem("");
    setAddAyStartYear("");
    setAddAyTerm("T1");

    setEditPscsId("");
    setEditTeacherName("");
    setEditCourseName("");
    setEditAySem("");
    setIsEditNewAySem(false);
    setEditAyStartYear("");
    setEditAyTerm("T1");
    setEditPass(false);
    setIsEditCourseMatched(true);

    setTeacherList([]);
    setFilteredCourses([]);
  };

  /** --- Server Integration Actions --- **/
  async function getFcceCount(
    search?: string | null,
    aySem: string = selectedAySem || "ALL",
    archivedMode: ArchivedMode = archiveFilter,
    mode: "ALL" | "UNMATCHED" = viewMode,
  ) {
    const response =
      mode === "UNMATCHED"
        ? await fetchFcceUnmatchedCount(search, aySem, archivedMode)
        : await fetchFcceCount(search, aySem, archivedMode);

    if (response?.success) {
      setRecordsCount(response.count);
    } else {
      setToastMessage(
        response?.error ??
        `[${
          mode === "UNMATCHED" ? "fetchFcceUnmatchedCount" : "fetchFcceCount"
        }]: An unexpected error occurred`,
      );
      setToastType("error");
      setShowToast(true);
      setRecordsCount(0);
    }
  }

  async function getFcceRecords(
    search: string | null = searchTerm,
    aySem: string = selectedAySem || "ALL",
    archivedMode: ArchivedMode = archiveFilter,
    sortby: string = sortFcceBy,
    sortdir: string = sortFcceDir,
    limit: number = maxRowFcce,
    page: number = currentFccePage,
    mode: "ALL" | "UNMATCHED" = viewMode,
  ) {
    setLoading(true);

    const response =
      mode === "UNMATCHED"
        ? await fetchFcceUnmatched(
          search,
          aySem,
          archivedMode,
          sortby,
          sortdir,
          limit,
          page,
        )
        : await fetchFcce(
          search,
          aySem,
          archivedMode,
          sortby,
          sortdir,
          limit,
          page,
        );

    if (response?.success && response.data) {
      setRecords(response.data);
    } else {
      setToastMessage(
        response?.error ??
        `[${
          mode === "UNMATCHED" ? "fetchFcceUnmatched" : "fetchFcce"
        }]: An unexpected error occurred`,
      );
      setToastType("error");
      setShowToast(true);
      setRecords([]);
    }

    setLoading(false);
    await getFcceCount(search, aySem, archivedMode, mode);
  }

  async function refreshData() {
    await Promise.all([
      getFcceRecords(
        searchTerm,
        selectedAySem,
        archiveFilter,
        sortFcceBy,
        sortFcceDir,
        maxRowFcce,
        currentFccePage,
        viewMode,
      ),
      checkUnmatchedCount(),
      loadAcademicYears(),
    ]);
  }

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
      setToastMessage(
        response?.error ?? "[CreateFcce]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseModals();
    void refreshData();
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
      setToastMessage(
        response?.error ?? "[UpdateFcce]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseModals();
    void refreshData();
  }

  async function handleArchiveSingleFcce() {
    const response = await updateFcce(username ?? "system", fcceId, {
      archived: true,
    });

    if (response?.success) {
      setToastMessage("FCCE record archived successfully");
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(
        response?.error ?? "[ArchiveFcce]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseModals();
    void refreshData();
  }

  async function handleDeleteFcce() {
    const response = await deleteFcce(username ?? "system", fcceId);

    if (response?.success) {
      setToastMessage("FCCE record deleted successfully");
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(
        response?.error ?? "[DeleteFcce]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseModals();
    void refreshData();
  }

  async function handleUnarchiveFcce() {
    if (!unarchiveRecordInfo) return;

    const response = await updateFcce(
      username ?? "system",
      unarchiveRecordInfo.id,
      {
        archived: false,
      },
    );

    if (response?.success) {
      setToastMessage("FCCE record restored successfully");
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(
        response?.error ?? "[UnarchiveFcce]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseModals();
    void refreshData();
  }

  async function handleArchiveAllActive() {
    const response = await archiveAllActiveFcce(username ?? "system");

    if (response?.success) {
      setToastMessage(
        `Successfully archived ${response.archivedCount} active record(s)`,
      );
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(
        response?.error ?? "[ArchiveAllActive]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseModals();
    void refreshData();
  }

  /** --- Toast Timers --- **/
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

    return () => clearInterval(timer);
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
      void getFcceRecords(
        searchTerm,
        selectedAySem,
        archiveFilter,
        sortFcceBy,
        sortFcceDir,
        maxRowFcce,
        currentFccePage,
        viewMode,
      );
    }, 300);

    return () => clearInterval(delayDebounceFn);
  }, [searchTerm, archiveFilter, viewMode, selectedAySem]);

  const isAddFormInvalid =
    !addPscsId.trim() ||
    !addCourseName.trim() ||
    !addAySem.trim() ||
    containsAlpha(addPscsId) ||
    !!pscsIdError ||
    !!courseNameError ||
    !!aySemError;

  const isEditFormInvalid =
    !editCourseName.trim() ||
    !editAySem.trim() ||
    !!editCourseNameError ||
    !!editAySemError;

  const isEditUnchanged =
    editCourseName === baseCourseName &&
    editAySem === baseAySem &&
    editPass === basePass;

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
            <ToastToggle onDismiss={() => closeToast()} />
          </Toast>
          <Progress
            progress={Math.min(Math.round(progress), 100)}
            size="sm"
            className={`${showToastTimer ? "" : "hidden"} ease-linear`}
          />
        </div>
      )}

      {/* Main Container */}
      <div className="m-8">
        {/* Header Bar */}
        <div>
          <h2 className="mb-1 text-lg font-bold">FCCE Management</h2>
          <p className="text-gray-500">
            Manage and track FCCE student course passing statuses and archive
            records.
          </p>
        </div>

        <div className="my-4 flex-col justify-between gap-4 md:flex md:flex-row md:items-center">
          <div className="relative w-full md:w-64">
            <TextInput
              id="search-fcce"
              type="text"
              placeholder="Search PSCS ID, Course, Teacher..."
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

          <div className="flex flex-wrap items-center gap-3">
            {/* Academic Year / Semester Dropdown Filter */}
            <div className="w-48">
              <Select
                id="ay-sem-filter"
                value={selectedAySem}
                onChange={handleAySemChange}
                className="[&_select]:max-h-48 [&_select]:overflow-y-auto"
              >
                <option value="ALL">All Academic Years</option>
                {academicYearList.map((item) => (
                  <option key={item.ay_sem} value={item.ay_sem}>
                    {item.ay_sem}
                  </option>
                ))}
              </Select>
            </div>

            {/* Unmatched Filter Badge Toggle Button */}
            {viewMode === "UNMATCHED" ? (
              <Tooltip
                placement={"right"}
                content={"Click to Go back to all records"}
              >
                <IoMdExit
                  className={"h-8 w-8 rotate-180 cursor-pointer"}
                  onClick={handleViewModeToggle}
                />
              </Tooltip>
            ) : (
              unmatchedCount > 0 && (
                <Tooltip
                  placement="right"
                  content={
                    <div className="text-center text-xs">
                      <div className="font-semibold">
                        {unmatchedCount} Unmatched Record
                        {unmatchedCount > 1 ? "s" : ""}
                      </div>
                      <div className="text-gray-300 dark:text-gray-400">
                        Click to filter unmatched
                      </div>
                    </div>
                  }
                >
                  <HiExclamation
                    className={
                      "h-8 w-8 cursor-pointer text-yellow-400 dark:text-yellow-300"
                    }
                    onClick={handleViewModeToggle}
                  />
                </Tooltip>
              )
            )}

            {/* Archive View Selection Dropdown */}
            <div className="w-40">
              <Select
                id="archive-filter"
                value={archiveFilter}
                onChange={handleArchiveFilterChange}
              >
                <option value="ACTIVE">Active Only</option>
                <option value="ARCHIVED">Archived Only</option>
                <option value="BOTH">All Records (Both)</option>
              </Select>
            </div>

            <Button
              color="yellow"
              className="whitespace-nowrap"
              onClick={() => setOpenArchiveAllModal(true)}
            >
              <HiOutlineArchive className="mr-2 h-4 w-4" />
              Archive All Active
            </Button>

            <Button
              className="whitespace-nowrap"
              onClick={() => setOpenAddModal(true)}
            >
              <FaPlus className="mr-2" />
              Add Record
            </Button>
          </div>
        </div>

        {/* Color Code Legend */}
        {(hasInvalidSubjects || hasArchivedRecords) && (
          <div className="m-2 flex flex-wrap gap-2">
            {hasInvalidSubjects && (
              <Tooltip
                placement={"right"}
                content={
                  "Row highlighted due to an invalid or missing subject."
                }
              >
                <Badge
                  className={
                    "bg-yellow-100 hover:bg-yellow-100 dark:bg-yellow-900/60 dark:text-gray-400 hover:dark:bg-yellow-900/60"
                  }
                >
                  Invalid / Missing Subject
                </Badge>
              </Tooltip>
            )}
            {hasArchivedRecords && (
              <Tooltip
                placement={"right"}
                content={
                  "Row highlighted in gray and text lined-through indicates an archived record."
                }
              >
                <Badge
                  className={
                    "bg-gray-200 text-gray-700 line-through hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 hover:dark:bg-gray-700"
                  }
                >
                  Archived Record
                </Badge>
              </Tooltip>
            )}
          </div>
        )}

        {/* Table Container */}
        <Card className="overflow-x-auto">
          <Table hoverable>
            <TableHead>
              <TableRow>
                <TableHeadCell onClick={() => handleFcceSorting("pscs_id")}>
                  <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                    PSCS ID
                    {sortFcceBy === "pscs_id" &&
                      (sortFcceDir === "ASC" ? (
                        <FaSortUp className="ml-1" />
                      ) : (
                        <FaSortDown className="ml-1" />
                      ))}
                  </div>
                </TableHeadCell>

                <TableHeadCell
                  onClick={() => handleFcceSorting("teacher_name")}
                >
                  <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                    Teacher Name
                    {sortFcceBy === "teacher_name" &&
                      (sortFcceDir === "ASC" ? (
                        <FaSortUp className="ml-1" />
                      ) : (
                        <FaSortDown className="ml-1" />
                      ))}
                  </div>
                </TableHeadCell>

                <TableHeadCell onClick={() => handleFcceSorting("course_name")}>
                  <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                    Course Name
                    {sortFcceBy === "course_name" &&
                      (sortFcceDir === "ASC" ? (
                        <FaSortUp className="ml-1" />
                      ) : (
                        <FaSortDown className="ml-1" />
                      ))}
                  </div>
                </TableHeadCell>

                <TableHeadCell onClick={() => handleFcceSorting("ay_sem")}>
                  <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                    AY / Sem
                    {sortFcceBy === "ay_sem" &&
                      (sortFcceDir === "ASC" ? (
                        <FaSortUp className="ml-1" />
                      ) : (
                        <FaSortDown className="ml-1" />
                      ))}
                  </div>
                </TableHeadCell>

                <TableHeadCell onClick={() => handleFcceSorting("pass")}>
                  <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                    Status
                    {sortFcceBy === "pass" &&
                      (sortFcceDir === "ASC" ? (
                        <FaSortUp className="ml-1" />
                      ) : (
                        <FaSortDown className="ml-1" />
                      ))}
                  </div>
                </TableHeadCell>

                <TableHeadCell onClick={() => handleFcceSorting("created_at")}>
                  <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                    Created At
                    {sortFcceBy === "created_at" &&
                      (sortFcceDir === "ASC" ? (
                        <FaSortUp className="ml-1" />
                      ) : (
                        <FaSortDown className="ml-1" />
                      ))}
                  </div>
                </TableHeadCell>

                <TableHeadCell>
                  <span className="sr-only">Actions</span>
                </TableHeadCell>
              </TableRow>
            </TableHead>

            <TableBody className="divide-y">
              {isLoading ? (
                <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                  <TableCell
                    colSpan={7}
                    className="py-6 text-center text-sm text-gray-500 italic dark:text-gray-400"
                  >
                    <div className="flex items-center justify-center">
                      <Spinner />
                      <span className="ml-4">Fetching records...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : records.length > 0 ? (
                records.map((item) => {
                  const exists = isCourseValid(item.course_name);

                  const rowBgClass = item.archived
                    ? "bg-gray-100 dark:bg-gray-700/60"
                    : !exists
                      ? "bg-yellow-100 dark:bg-yellow-900/40"
                      : "bg-white dark:bg-gray-800";

                  return (
                    <TableRow
                      key={item.fcce_id}
                      className={`dark:border-gray-700 ${rowBgClass} ${
                        item.archived
                          ? "bg-gray-200 text-gray-500 line-through dark:text-gray-400"
                          : ""
                      }`}
                    >
                      <TableCell className="font-medium whitespace-nowrap text-gray-900 dark:text-white">
                        {item.pscs_id}
                      </TableCell>
                      <TableCell>{item.teacher_name || "—"}</TableCell>
                      <TableCell>{item.course_name}</TableCell>
                      <TableCell>{item.ay_sem || "—"}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            item.pass
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                          }`}
                        >
                          {item.pass ? "Passed" : "Failed"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {new Date(item.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {item.archived ? (
                          <a
                            onClick={() => promptUnarchive(item)}
                            className="cursor-pointer font-medium text-green-600 no-underline hover:underline dark:text-green-400"
                          >
                            Unarchive
                          </a>
                        ) : (
                          <a
                            onClick={() => loadEditData(item.fcce_id)}
                            className="text-primary-600 dark:text-primary-500 cursor-pointer font-medium no-underline hover:underline"
                          >
                            Edit
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                  <TableCell
                    colSpan={7}
                    className="py-6 text-center text-sm text-gray-500 italic dark:text-gray-400"
                  >
                    {searchTerm
                      ? `No ${
                        viewMode === "UNMATCHED" ? "unmatched " : ""
                      }records matching "${searchTerm}" found.`
                      : archiveFilter === "ARCHIVED"
                        ? `No archived ${
                          viewMode === "UNMATCHED" ? "unmatched " : ""
                        }FCCE entries found.`
                        : archiveFilter === "BOTH"
                          ? `No ${
                            viewMode === "UNMATCHED" ? "unmatched " : ""
                          }FCCE entries found.`
                          : `No active ${
                            viewMode === "UNMATCHED" ? "unmatched " : ""
                          }FCCE entries found.`}
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
            currentPage={currentFccePage || 1}
            totalPages={Math.ceil(recordsCount / maxRowFcce) || 1}
            onPageChange={onPageChangeFcce}
            showIcons
          />
        </div>
      </div>

      {/* Modal: Add FCCE Record */}
      <Modal show={openAddModal} onClose={handleCloseModals}>
        <ModalHeader>Add FCCE Record</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            {/* PSCS ID Input + Search Suggestions */}
            <div className="relative">
              <Label htmlFor="add-pscs-id">PSCS ID</Label>
              <TextInput
                id="add-pscs-id"
                value={addPscsId}
                onChange={handleAddPscsIdChange}
                placeholder="Enter PSCS ID"
                className={pscsIdError ? "[&_input]:border-red-500" : ""}
              />
              {pscsIdError && (
                <HelperText className="mt-1 text-red-600 dark:text-red-500">
                  {pscsIdError}
                </HelperText>
              )}
              {teacherList.length > 0 && (
                <ul className="absolute z-10 max-h-40 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  {teacherList.map((teacher) => (
                    <li
                      key={teacher.teacher_id}
                      onClick={() => handleSelectAddPscsId(teacher)}
                      className="cursor-pointer px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <span className="font-medium text-gray-900 dark:text-white">
                        {teacher.full_name}
                      </span>
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                        ({teacher.pscs_id})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Course Name Input + Filter Suggestions */}
            <div className="relative">
              <Label htmlFor="add-course-name">Course Name</Label>
              <TextInput
                id="add-course-name"
                value={addCourseName}
                onChange={handleAddCourseNameChange}
                placeholder="Enter or select course name"
                className={courseNameError ? "[&_input]:border-red-500" : ""}
              />
              {courseNameError && (
                <HelperText className="mt-1 text-red-600 dark:text-red-500">
                  {courseNameError}
                </HelperText>
              )}
              {filteredCourses.length > 0 && (
                <ul className="absolute z-10 max-h-40 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  {filteredCourses.map((courseName, idx) => (
                    <li
                      key={`add-course-${idx}`}
                      onClick={() => handleSelectAddCourse(courseName)}
                      className="cursor-pointer px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <span className="font-medium text-gray-900 dark:text-white">
                        {courseName}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Academic Year / Semester Input/Dropdown Toggle */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label htmlFor="add-ay-sem">Academic Year / Semester</Label>
                <button
                  type="button"
                  onClick={() => {
                    const nextState = !isNewAySem;
                    setIsNewAySem(nextState);
                    setAddAySem("");
                    setAySemError("");
                    if (nextState) {
                      handleAddCustomAyChange(currentYear.toString(), "T1");
                    }
                  }}
                  className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  {isNewAySem ? "Select existing AY/Sem" : "+ Enter new AY/Sem"}
                </button>
              </div>

              {isNewAySem ? (
                <div>
                  <div className="flex items-center gap-2">
                    {/* Start Year Dropdown */}
                    <Select
                      id="add-ay-start-year"
                      value={addAyStartYear}
                      onChange={(e) =>
                        handleAddCustomAyChange(e.target.value, addAyTerm)
                      }
                      className={`w-full ${aySemError ? "[&_select]:border-red-500" : ""}`}
                    >
                      <option value="">Start Year</option>
                      {yearOptions.map((yr) => (
                        <option key={`start-${yr}`} value={yr.toString()}>
                          {yr}
                        </option>
                      ))}
                    </Select>
                    <span className="text-gray-500 dark:text-gray-400">-</span>

                    {/* Auto-Calculated Next Year Plain Text Display */}
                    <div className="flex h-10 w-full items-center justify-center text-sm text-gray-700 dark:text-gray-300">
                      <span>
                        {addAyStartYear
                          ? (parseInt(addAyStartYear, 10) + 1).toString()
                          : "End Year"}
                      </span>
                    </div>

                    <span className="text-gray-500 dark:text-gray-400">/</span>

                    {/* Term Dropdown */}
                    <Select
                      id="add-ay-term-select"
                      value={addAyTerm}
                      onChange={(e) =>
                        handleAddCustomAyChange(addAyStartYear, e.target.value)
                      }
                      className={`w-full ${aySemError ? "[&_select]:border-red-500" : ""}`}
                    >
                      <option value="T1">Term 1</option>
                      <option value="T2">Term 2</option>
                      <option value="T3">Term 3</option>
                      <option value="T4">Term 4</option>
                    </Select>
                  </div>

                  {aySemError ? (
                    <HelperText className="mt-1 text-red-600 dark:text-red-500">
                      {aySemError}
                    </HelperText>
                  ) : (
                    <HelperText className="mt-1 text-gray-500 dark:text-gray-400">
                      Stored format:{" "}
                      <b className="font-mono">{addAySem || "—"}</b>
                    </HelperText>
                  )}
                </div>
              ) : (
                <Select
                  id="add-ay-sem-select"
                  value={addAySem}
                  onChange={handleSelectAddAySemChange}
                  className={aySemError ? "[&_select]:border-red-500" : ""}
                >
                  <option value="">Select Academic Year / Sem</option>
                  {academicYearList.map((item) => (
                    <option key={item.ay_sem} value={item.ay_sem}>
                      {item.ay_sem}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            {/* Pass/Fail Status Toggle Switch */}
            <div className="flex items-center justify-between">
              <Label htmlFor="add-pass-toggle">Status</Label>
              <ToggleSwitch
                id="add-pass-toggle"
                checked={addPass}
                label={addPass ? "Passed" : "Failed"}
                onChange={setAddPass}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            disabled={isAddFormInvalid}
            onClick={() => void handleFcceSubmit()}
          >
            Submit
          </Button>
          <Button color="alternative" onClick={handleCloseModals}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal: Edit FCCE Record */}
      <Modal show={openEditModal} onClose={handleCloseModals}>
        <ModalHeader>Edit FCCE Record</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            {/* PSCS ID Plain Text Display (Not Editable) */}
            <div>
              <Label>PSCS ID</Label>
              <div className="mt-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {editPscsId}
                </span>
              </div>
              {editTeacherName && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Matched Teacher:{" "}
                  <b className="font-semibold">{editTeacherName}</b>
                </p>
              )}
            </div>

            {/* Course Name (Editable ONLY if missing match/unmatched) */}
            <div className="relative">
              <Label htmlFor="edit-course-name">Course Name</Label>
              {isEditCourseMatched ? (
                <div className="mt-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {editCourseName}
                  </span>
                </div>
              ) : (
                <>
                  <TextInput
                    id="edit-course-name"
                    value={editCourseName}
                    onChange={handleEditCourseNameChange}
                    className={
                      editCourseNameError ? "[&_input]:border-red-500" : ""
                    }
                  />
                  {editCourseNameError && (
                    <HelperText className="mt-1 text-red-600 dark:text-red-500">
                      {editCourseNameError}
                    </HelperText>
                  )}
                  {filteredCourses.length > 0 && (
                    <ul className="absolute z-10 max-h-40 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                      {filteredCourses.map((courseName, idx) => (
                        <li
                          key={`edit-course-${idx}`}
                          onClick={() => handleSelectEditCourse(courseName)}
                          className="cursor-pointer px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <span className="font-medium text-gray-900 dark:text-white">
                            {courseName}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            {/* Academic Year / Semester Input/Dropdown Toggle */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label htmlFor="edit-ay-sem">Academic Year / Semester</Label>
                <button
                  type="button"
                  onClick={() => {
                    const nextState = !isEditNewAySem;
                    setIsEditNewAySem(nextState);
                    setEditAySem("");
                    setEditAySemError("");
                    if (nextState) {
                      handleEditCustomAyChange(currentYear.toString(), "T1");
                    }
                  }}
                  className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  {isEditNewAySem
                    ? "Select existing AY/Sem"
                    : "+ Enter new AY/Sem"}
                </button>
              </div>

              {isEditNewAySem ? (
                <div>
                  <div className="flex items-center gap-2">
                    {/* Start Year Dropdown */}
                    <Select
                      id="edit-ay-start-year"
                      value={editAyStartYear}
                      onChange={(e) =>
                        handleEditCustomAyChange(e.target.value, editAyTerm)
                      }
                      className={`w-full ${editAySemError ? "[&_select]:border-red-500" : ""}`}
                    >
                      <option value="">Start Year</option>
                      {yearOptions.map((yr) => (
                        <option key={`edit-start-${yr}`} value={yr.toString()}>
                          {yr}
                        </option>
                      ))}
                    </Select>
                    <span className="text-gray-500 dark:text-gray-400">-</span>

                    {/* Auto-Calculated Next Year Plain Text Display */}
                    <div className="flex h-10 w-full items-center justify-center text-sm text-gray-700 dark:text-gray-300">
                      <span>
                        {editAyStartYear
                          ? (parseInt(editAyStartYear, 10) + 1).toString()
                          : "End Year"}
                      </span>
                    </div>

                    <span className="text-gray-500 dark:text-gray-400">/</span>

                    {/* Term Dropdown */}
                    <Select
                      id="edit-ay-term-select"
                      value={editAyTerm}
                      onChange={(e) =>
                        handleEditCustomAyChange(
                          editAyStartYear,
                          e.target.value,
                        )
                      }
                      className={`w-full ${editAySemError ? "[&_select]:border-red-500" : ""}`}
                    >
                      <option value="T1">Term 1</option>
                      <option value="T2">Term 2</option>
                      <option value="T3">Term 3</option>
                      <option value="T4">Term 4</option>
                    </Select>
                  </div>

                  {editAySemError ? (
                    <HelperText className="mt-1 text-red-600 dark:text-red-500">
                      {editAySemError}
                    </HelperText>
                  ) : (
                    <HelperText className="mt-1 text-gray-500 dark:text-gray-400">
                      Stored format:{" "}
                      <b className="font-mono">{editAySem || "—"}</b>
                    </HelperText>
                  )}
                </div>
              ) : (
                <Select
                  id="edit-ay-sem-select"
                  value={editAySem}
                  onChange={handleSelectEditAySemChange}
                  className={editAySemError ? "[&_select]:border-red-500" : ""}
                >
                  <option value="">Select Academic Year / Sem</option>
                  {academicYearList.map((item) => (
                    <option key={item.ay_sem} value={item.ay_sem}>
                      {item.ay_sem}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            {/* Status Switch (Passed / Failed) */}
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-pass-toggle">Passing Status</Label>
              <ToggleSwitch
                id="edit-pass-toggle"
                checked={editPass}
                label={editPass ? "Passed" : "Failed"}
                onChange={setEditPass}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Action Buttons (Archive & Delete Grouped) */}
          <ButtonGroup className="w-full sm:w-auto">
            <Button
              color="yellow"
              className="w-full sm:w-auto"
              onClick={() => {
                setOpenEditModal(false);
                setOpenArchiveSingleModal(true);
              }}
            >
              <HiOutlineArchive className="mr-2 h-4 w-4" />
              Archive
            </Button>

            <Dropdown
              arrowIcon={true}
              color="yellow"
              label=""
              dismissOnClick={true}
              className="border-l-3 border-white/30 dark:border-gray-800/30"
            >
              <DropdownItem
                className="text-red-600 dark:text-red-500"
                onClick={() => {
                  setOpenEditModal(false);
                  setOpenDeleteModal(true);
                }}
              >
                <HiOutlineTrash className="mr-2 h-4 w-4" />
                Delete Record
              </DropdownItem>
            </Dropdown>
          </ButtonGroup>

          {/* Form Actions (Save Changes & Cancel) */}
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <Button
              disabled={isEditFormInvalid || isEditUnchanged}
              onClick={() => void handleFcceUpdate()}
              className="w-full sm:w-auto"
            >
              Save Changes
            </Button>
            <Button
              color="alternative"
              onClick={handleCloseModals}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
          </div>
        </ModalFooter>
      </Modal>

      {/* Modal: Single Archive FCCE Record Confirmation */}
      <Modal
        show={openArchiveSingleModal}
        onClose={handleCloseModals}
        size="md"
      >
        <ModalHeader>Confirm Archive Record</ModalHeader>
        <ModalBody>
          <div className="text-center">
            <HiOutlineArchive className="mx-auto mb-4 h-14 w-14 text-yellow-500 dark:text-yellow-400" />
            <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
              Are you sure you want to archive the FCCE record for{" "}
              <b className="font-bold text-gray-900 dark:text-white">
                PSCS ID {editPscsId} ({editCourseName})
              </b>
              ? You can restore it later by setting its mode back in the view
              filters.
            </h3>
          </div>
        </ModalBody>
        <ModalFooter className="justify-center">
          <Button color="yellow" onClick={() => void handleArchiveSingleFcce()}>
            Yes, Archive
          </Button>
          <Button color="alternative" onClick={handleCloseModals}>
            No, Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal: Delete FCCE Record Confirmation */}
      <Modal show={openDeleteModal} onClose={handleCloseModals} size="md">
        <ModalHeader>Confirm Delete Record</ModalHeader>
        <ModalBody>
          <div className="text-center">
            <HiOutlineTrash className="mx-auto mb-4 h-14 w-14 text-red-600 dark:text-red-500" />
            <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
              Are you sure you want to permanently delete the FCCE record for{" "}
              <b className="font-bold text-gray-900 dark:text-white">
                PSCS ID {editPscsId} ({editCourseName})
              </b>
              ? This action cannot be undone.
            </h3>
          </div>
        </ModalBody>
        <ModalFooter className="justify-center">
          <Button color="red" onClick={() => void handleDeleteFcce()}>
            Yes, Delete
          </Button>
          <Button color="alternative" onClick={handleCloseModals}>
            No, Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal: Unarchive FCCE Record Confirmation */}
      <Modal show={openUnarchiveModal} onClose={handleCloseModals} size="md">
        <ModalHeader>Confirm Unarchive Record</ModalHeader>
        <ModalBody>
          <div className="text-center">
            <HiOutlineRefresh className="mx-auto mb-4 h-14 w-14 text-green-500 dark:text-green-400" />
            <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
              Are you sure you want to restore the FCCE record for{" "}
              <b className="font-bold text-gray-900 dark:text-white">
                PSCS ID {unarchiveRecordInfo?.pscs_id} (
                {unarchiveRecordInfo?.course_name})
              </b>
              ?
            </h3>
          </div>
        </ModalBody>
        <ModalFooter className="justify-center">
          <Button color="green" onClick={() => void handleUnarchiveFcce()}>
            Yes, Unarchive
          </Button>
          <Button color="alternative" onClick={handleCloseModals}>
            No, Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal: Archive All Active Records Confirmation */}
      <Modal show={openArchiveAllModal} onClose={handleCloseModals} size="md">
        <ModalHeader>Confirm Archive All Active</ModalHeader>
        <ModalBody>
          <div className="text-center">
            <HiOutlineArchive className="mx-auto mb-4 h-14 w-14 text-yellow-500 dark:text-yellow-400" />
            <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
              Are you sure you want to archive all currently active FCCE
              records? You can restore them individually later.
            </h3>
          </div>
        </ModalBody>
        <ModalFooter className="justify-center">
          <Button color="yellow" onClick={() => void handleArchiveAllActive()}>
            Yes, Archive All Active
          </Button>
          <Button color="alternative" onClick={handleCloseModals}>
            No, Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}