"use client";

import {
  Badge,
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
  ToggleSwitch,
  Tooltip,
} from "flowbite-react";
import {
  archiveAllActiveFcce,
  createFcce,
  deleteFcce,
  fetchAcademicYears,
  fetchFcce,
  fetchFcceCount,
  fetchFcceUnmatched,
  fetchFcceUnmatchedCount,
  fetchSubjects,
  fetchTeachers,
  updateFcce,
  FcceRecord,
  FcceInput,
  SubjectRecord,
  TeacherRecord,
  AcademicYearRecord,
  ArchivedMode,
} from "@/app/actions/system";
import { FaPlus, FaSortDown, FaSortUp, FaTrash } from "react-icons/fa6";
import {
  HiCheck,
  HiExclamation,
  HiX,
  HiSearch,
  HiOutlineArchive,
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
  const [academicYearList, setAcademicYearList] = useState<AcademicYearRecord[]>([]);
  const [selectedAySem, setSelectedAySem] = useState<string>("ALL");

  // --- Subjects / Course Suggestions State --- //
  const [subjectList, setSubjectList] = useState<SubjectRecord[]>([]);
  const [filteredSubjects, setFilteredSubjects] = useState<SubjectRecord[]>([]);

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
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [openArchiveAllModal, setOpenArchiveAllModal] = useState(false);

  // --- Form & Validation States --- //
  const [fcceId, setFcceId] = useState("");
  const [pscsIdError, setPscsIdError] = useState("");
  const [courseNameError, setCourseNameError] = useState("");
  const [aySemError, setAySemError] = useState("");
  const [editPscsIdError, setEditPscsIdError] = useState("");
  const [editCourseNameError, setEditCourseNameError] = useState("");
  const [editAySemError, setEditAySemError] = useState("");

  // Add Form State (Defaulting pass state to true)
  const [addPscsId, setAddPscsId] = useState("");
  const [addCourseName, setAddCourseName] = useState("");
  const [addPass, setAddPass] = useState(true);

  // Add Modal - AY/Sem State
  const [isNewAySem, setIsNewAySem] = useState(false);
  const [addAySem, setAddAySem] = useState("");

  // Edit Form State
  const [editPscsId, setEditPscsId] = useState("");
  const [editTeacherName, setEditTeacherName] = useState("");
  const [editCourseName, setEditCourseName] = useState("");
  const [editAySem, setEditAySem] = useState("");
  const [isEditNewAySem, setIsEditNewAySem] = useState(false);
  const [editPass, setEditPass] = useState(false);
  const [editArchived, setEditArchived] = useState(false);

  // Base State for Change Tracking
  const [basePscsId, setBasePscsId] = useState("");
  const [baseCourseName, setBaseCourseName] = useState("");
  const [baseAySem, setBaseAySem] = useState("");
  const [basePass, setBasePass] = useState(false);
  const [baseArchived, setBaseArchived] = useState(false);

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

  /** --- Helper Filters --- **/
  const filterAlphanumeric = (val: string) => {
    return val.replace(/[^a-zA-Z0-9]/g, "");
  };

  const filterAlphanumericNoSpace = (val: string) => {
    return val.replace(/[^a-zA-Z0-9]/g, "");
  };

  const filterAlphanumericDashUnderscoreComma = (val: string) => {
    return val.replace(/[^a-zA-Z0-9\-_,\s]/g, "");
  };

  const containsAlpha = (val: string) => {
    return /[a-zA-Z]/.test(val);
  };

  /** --- Load Academic Years --- **/
  async function loadAcademicYears() {
    const res = await fetchAcademicYears(null, "ay_sem", "DESC", 0, 1);
    if (res?.success && res.data) {
      setAcademicYearList(res.data);
    }
  }

  /** --- Load Subjects for Auto-suggestions & Validation --- **/
  async function loadSubjects() {
    const res = await fetchSubjects(null, "course_name", "ASC", 0, 1);
    if (res?.success && res.data) {
      setSubjectList(res.data);
    }
  }

  useEffect(() => {
    void loadAcademicYears();
    void loadSubjects();
  }, []);

  /** --- Filter Courses locally by code or course name --- **/
  const filterCourses = (term: string) => {
    if (!term.trim()) {
      setFilteredSubjects([]);
      return;
    }
    const lower = term.toLowerCase();
    const matches = subjectList.filter((subj) => {
      const codeMatch = subj.course_code?.toLowerCase().includes(lower);
      const nameMatch = subj.course_name?.toLowerCase().includes(lower);
      return codeMatch || nameMatch;
    });
    setFilteredSubjects(matches.slice(0, 10));
  };

  /** --- Fetch Teachers by Name or PSCS ID --- **/
  async function searchTeachers(term: string) {
    if (!term.trim()) {
      setTeacherList([]);
      return;
    }
    const res = await fetchTeachers(term, "surname", "ASC", 10, 1);
    if (res?.success && res.data) {
      setTeacherList(res.data);
    }
  }

  /** --- Fetch Unmatched Count for Badge --- **/
  async function checkUnmatchedCount() {
    const res = await fetchFcceUnmatchedCount(searchTerm, selectedAySem || "ALL", archiveFilter);
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
    return subjectList.some(
        (subj) =>
            subj.course_name?.toLowerCase().trim() ===
            courseName.toLowerCase().trim()
    );
  };

  const hasInvalidSubjects = records.some(
      (item) => !isCourseValid(item.course_name)
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
        viewMode
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
        viewMode
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
      e: React.ChangeEvent<HTMLSelectElement>
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
        viewMode
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
        viewMode
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
        nextMode
    );
  };

  /** --- Form Validation and Handlers --- **/
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

  const handleAddCourseNameChange = (
      e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const val = filterAlphanumericDashUnderscoreComma(e.target.value).slice(0, 150);
    setAddCourseName(val);
    setCourseNameError(!val.trim() ? "Course name is required." : "");
    filterCourses(val);
  };

  const handleAddAySemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterAlphanumericNoSpace(e.target.value).slice(0, 8);
    setAddAySem(val);
    setAySemError(!val.trim() ? "Academic Year / Semester is required." : "");
  };

  const handleSelectAddAySemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setAddAySem(val);
    setAySemError(!val.trim() ? "Academic Year / Semester is required." : "");
  };

  const handleEditPscsIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, 15);
    setEditPscsId(val);
    setEditPscsIdError(validatePscsId(val));
    void searchTeachers(val);
  };

  const handleEditCourseNameChange = (
      e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const val = filterAlphanumericDashUnderscoreComma(e.target.value).slice(0, 150);
    setEditCourseName(val);
    setEditCourseNameError(!val.trim() ? "Course name is required." : "");
    filterCourses(val);
  };

  const handleEditAySemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterAlphanumericNoSpace(e.target.value).slice(0, 8);
    setEditAySem(val);
    setEditAySemError(!val.trim() ? "Academic Year / Semester is required." : "");
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

  const handleSelectAddCourse = (subject: SubjectRecord) => {
    const course = filterAlphanumericDashUnderscoreComma(subject.course_name).slice(0, 150);
    setAddCourseName(course);
    setCourseNameError("");
    setFilteredSubjects([]);
  };

  const handleSelectEditPscsId = (teacher: TeacherRecord) => {
    const selectedPscs = teacher.pscs_id ? filterAlphanumeric(teacher.pscs_id).slice(0, 15) : "";
    setEditPscsId(selectedPscs);
    setEditTeacherName(teacher.full_name);
    setEditPscsIdError(validatePscsId(selectedPscs));
    setTeacherList([]);
  };

  const handleSelectEditCourse = (subject: SubjectRecord) => {
    const course = filterAlphanumericDashUnderscoreComma(subject.course_name).slice(0, 150);
    setEditCourseName(course);
    setEditCourseNameError("");
    setFilteredSubjects([]);
  };

  function loadEditData(id: string) {
    setFcceId(id);
    const selectedRecord = records.find((item) => item.fcce_id === id);

    if (selectedRecord) {
      const pscs = filterAlphanumeric(selectedRecord.pscs_id || "").slice(0, 15);
      const teacher = selectedRecord.teacher_name || "";
      const course = filterAlphanumericDashUnderscoreComma(selectedRecord.course_name || "").slice(0, 150);
      const aySemVal = selectedRecord.ay_sem || "";
      const pass = !!selectedRecord.pass;
      const archived = !!selectedRecord.archived;

      setBasePscsId(pscs);
      setBaseCourseName(course);
      setBaseAySem(aySemVal);
      setBasePass(pass);
      setBaseArchived(archived);

      setEditPscsId(pscs);
      setEditTeacherName(teacher);
      setEditCourseName(course);
      setEditAySem(aySemVal);
      setIsEditNewAySem(false);
      setEditPass(pass);
      setEditArchived(archived);

      setOpenEditModal(true);
    }
  }

  const handleCloseModals = () => {
    setFcceId("");
    setPscsIdError("");
    setCourseNameError("");
    setAySemError("");
    setEditPscsIdError("");
    setEditCourseNameError("");
    setEditAySemError("");

    setOpenAddModal(false);
    setOpenEditModal(false);
    setOpenDeleteModal(false);
    setOpenArchiveAllModal(false);

    setAddPscsId("");
    setAddCourseName("");
    setAddPass(true);
    setIsNewAySem(false);
    setAddAySem("");
    setEditPscsId("");
    setEditTeacherName("");
    setEditCourseName("");
    setEditAySem("");
    setIsEditNewAySem(false);
    setEditPass(false);
    setEditArchived(false);
    setTeacherList([]);
    setFilteredSubjects([]);
  };

  /** --- Server Integration Actions --- **/
  async function getFcceCount(
      search?: string | null,
      aySem: string = selectedAySem || "ALL",
      archivedMode: ArchivedMode = archiveFilter,
      mode: "ALL" | "UNMATCHED" = viewMode
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
          }]: An unexpected error occurred`
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
      mode: "ALL" | "UNMATCHED" = viewMode
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
                page
            )
            : await fetchFcce(
                search,
                aySem,
                archivedMode,
                sortby,
                sortdir,
                limit,
                page
            );

    if (response?.success && response.data) {
      setRecords(response.data);
    } else {
      setToastMessage(
          response?.error ??
          `[${
              mode === "UNMATCHED" ? "fetchFcceUnmatched" : "fetchFcce"
          }]: An unexpected error occurred`
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
          viewMode
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
          response?.error ?? "[CreateFcce]: An unexpected error occurred"
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseModals();
    void refreshData();
  }

  async function handleFcceUpdate() {
    const pscsError = validatePscsId(editPscsId);
    if (pscsError) {
      setEditPscsIdError(pscsError);
      return;
    }
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
      archived: editArchived,
    };

    const response = await updateFcce(username ?? "system", fcceId, payload);

    if (response?.success) {
      setToastMessage("FCCE record updated successfully");
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(
          response?.error ?? "[UpdateFcce]: An unexpected error occurred"
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseModals();
    void refreshData();
  }

  async function handleFcceDelete() {
    const response = await deleteFcce(username ?? "system", fcceId);

    if (response?.success) {
      setToastMessage("FCCE record deleted successfully");
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(
          response?.error ?? "[DeleteFcce]: An unexpected error occurred"
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
          `Successfully archived ${response.archivedCount} active record(s)`
      );
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(
          response?.error ?? "[ArchiveAllActive]: An unexpected error occurred"
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
          viewMode
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
      !editPscsId.trim() ||
      !editCourseName.trim() ||
      !editAySem.trim() ||
      containsAlpha(editPscsId) ||
      !!editPscsIdError ||
      !!editCourseNameError ||
      !!editAySemError;

  const isEditUnchanged =
      editPscsId === basePscsId &&
      editCourseName === baseCourseName &&
      editAySem === baseAySem &&
      editPass === basePass &&
      editArchived === baseArchived;

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
                  color="warning"
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
                            "bg-gray-200 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 hover:dark:bg-gray-700 line-through"
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

                  <TableHeadCell onClick={() => handleFcceSorting("teacher_name")}>
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
                              <a
                                  onClick={() => loadEditData(item.fcce_id)}
                                  className="text-primary-600 dark:text-primary-500 cursor-pointer font-medium no-underline hover:underline"
                              >
                                Edit
                              </a>
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

        {/* Modal: Add Record */}
        <Modal show={openAddModal} onClose={handleCloseModals} size="md">
          <ModalHeader>Add New FCCE Record</ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              {/* PSCS ID Search Input with Dropdown Recommendations */}
              <div className="relative">
                <div className="mb-1 flex items-center justify-between">
                  <Label htmlFor="pscs_id">PSCS ID *</Label>
                  <span className="text-xs text-gray-500">{addPscsId.length}/15</span>
                </div>
                <TextInput
                    id="pscs_id"
                    placeholder="Search by teacher name or enter PSCS ID..."
                    value={addPscsId}
                    maxLength={15}
                    onChange={handleAddPscsIdChange}
                    color={pscsIdError ? "failure" : "gray"}
                />
                {teacherList.length > 0 && (
                    <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-700">
                      {teacherList.map((teacher) => (
                          <li
                              key={teacher.teacher_id}
                              onClick={() => handleSelectAddPscsId(teacher)}
                              className="cursor-pointer px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600"
                          >
                            {teacher.full_name} | {teacher.pscs_id ?? "No PSCS ID"}
                          </li>
                      ))}
                    </ul>
                )}
                {pscsIdError && (
                    <HelperText color="failure" className="mt-1">
                      {pscsIdError}
                    </HelperText>
                )}
              </div>

              {/* Course Name Input with Dropdown Recommendations */}
              <div className="relative">
                <div className="mb-1 flex items-center justify-between">
                  <Label htmlFor="course_name">Course Name *</Label>
                  <span className="text-xs text-gray-500">{addCourseName.length}/150</span>
                </div>
                <TextInput
                    id="course_name"
                    placeholder="Search by course code or course name..."
                    value={addCourseName}
                    maxLength={150}
                    onChange={handleAddCourseNameChange}
                    color={courseNameError ? "failure" : "gray"}
                />
                {filteredSubjects.length > 0 && (
                    <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-700">
                      {filteredSubjects.map((subj) => (
                          <li
                              key={subj.subject_id}
                              onClick={() => handleSelectAddCourse(subj)}
                              className="cursor-pointer px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600"
                          >
                            {subj.course_code
                                ? `${subj.course_code} - ${subj.course_name}`
                                : subj.course_name}
                          </li>
                      ))}
                    </ul>
                )}
                {courseNameError && (
                    <HelperText color="failure" className="mt-1">
                      {courseNameError}
                    </HelperText>
                )}
              </div>

              {/* Academic Year / Semester Selection with Toggle for New Input */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label htmlFor="add_ay_sem">Academic Year / Semester *</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">New AY/Sem</span>
                    <ToggleSwitch
                        checked={isNewAySem}
                        onChange={(checked) => {
                          setIsNewAySem(checked);
                          setAddAySem("");
                          setAySemError("");
                        }}
                    />
                  </div>
                </div>
                {isNewAySem ? (
                    <div>
                      <TextInput
                          id="add_ay_sem_input"
                          placeholder="Enter AY/Sem (e.g. 2526T1)..."
                          value={addAySem}
                          maxLength={8}
                          onChange={handleAddAySemChange}
                          color={aySemError ? "failure" : "gray"}
                      />
                      <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                        <div>
                          {aySemError && (
                              <HelperText color="failure">{aySemError}</HelperText>
                          )}
                        </div>
                        <span>{addAySem.length}/8</span>
                      </div>
                    </div>
                ) : (
                    <div>
                      <Select
                          id="add_ay_sem_select"
                          value={addAySem}
                          onChange={handleSelectAddAySemChange}
                          color={aySemError ? "failure" : "gray"}
                          className="[&_select]:max-h-48 [&_select]:overflow-y-auto"
                      >
                        <option value="">Select Academic Year / Semester</option>
                        {academicYearList.map((item) => (
                            <option key={item.ay_sem} value={item.ay_sem}>
                              {item.ay_sem}
                            </option>
                        ))}
                      </Select>
                      {aySemError && (
                          <HelperText color="failure" className="mt-1">
                            {aySemError}
                          </HelperText>
                      )}
                    </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <Label htmlFor="add_pass">Passing Status</Label>
                <ToggleSwitch
                    id="add_pass"
                    checked={addPass}
                    label={addPass ? "Passed" : "Failed"}
                    onChange={setAddPass}
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button onClick={handleFcceSubmit} disabled={isAddFormInvalid}>
              Create Record
            </Button>
            <Button color="alternative" onClick={handleCloseModals}>
              Cancel
            </Button>
          </ModalFooter>
        </Modal>

        {/* Modal: Edit Record */}
        <Modal show={openEditModal} onClose={handleCloseModals} size="md">
          <ModalHeader>Edit FCCE Record</ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              {/* Display Teacher Name if available */}
              {editTeacherName && (
                  <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
                    <Label className="text-xs uppercase text-gray-500 dark:text-gray-400">
                      Teacher Name
                    </Label>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {editTeacherName}
                    </div>
                  </div>
              )}

              {/* Edit PSCS ID Input with Dropdown Recommendations */}
              <div className="relative">
                <div className="mb-1 flex items-center justify-between">
                  <Label htmlFor="edit_pscs_id">PSCS ID *</Label>
                  <span className="text-xs text-gray-500">{editPscsId.length}/15</span>
                </div>
                <TextInput
                    id="edit_pscs_id"
                    value={editPscsId}
                    maxLength={15}
                    onChange={handleEditPscsIdChange}
                    color={editPscsIdError ? "failure" : "gray"}
                />
                {teacherList.length > 0 && (
                    <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-700">
                      {teacherList.map((teacher) => (
                          <li
                              key={teacher.teacher_id}
                              onClick={() => handleSelectEditPscsId(teacher)}
                              className="cursor-pointer px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600"
                          >
                            {teacher.full_name} | {teacher.pscs_id ?? "No PSCS ID"}
                          </li>
                      ))}
                    </ul>
                )}
                {editPscsIdError && (
                    <HelperText color="failure" className="mt-1">
                      {editPscsIdError}
                    </HelperText>
                )}
              </div>

              {/* Edit Course Name Input with Dropdown Recommendations */}
              <div className="relative">
                <div className="mb-1 flex items-center justify-between">
                  <Label htmlFor="edit_course_name">Course Name *</Label>
                  <span className="text-xs text-gray-500">{editCourseName.length}/150</span>
                </div>
                <TextInput
                    id="edit_course_name"
                    value={editCourseName}
                    maxLength={150}
                    onChange={handleEditCourseNameChange}
                    color={editCourseNameError ? "failure" : "gray"}
                />
                {filteredSubjects.length > 0 && (
                    <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-700">
                      {filteredSubjects.map((subj) => (
                          <li
                              key={subj.subject_id}
                              onClick={() => handleSelectEditCourse(subj)}
                              className="cursor-pointer px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600"
                          >
                            {subj.course_code
                                ? `${subj.course_code} - ${subj.course_name}`
                                : subj.course_name}
                          </li>
                      ))}
                    </ul>
                )}
                {editCourseNameError && (
                    <HelperText color="failure" className="mt-1">
                      {editCourseNameError}
                    </HelperText>
                )}
              </div>

              {/* Edit Academic Year / Semester Field */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label htmlFor="edit_ay_sem">Academic Year / Semester *</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">New AY/Sem</span>
                    <ToggleSwitch
                        checked={isEditNewAySem}
                        onChange={(checked) => {
                          setIsEditNewAySem(checked);
                          setEditAySem("");
                          setEditAySemError("");
                        }}
                    />
                  </div>
                </div>
                {isEditNewAySem ? (
                    <div>
                      <TextInput
                          id="edit_ay_sem_input"
                          placeholder="Enter AY/Sem (e.g. 2526T1)..."
                          value={editAySem}
                          maxLength={8}
                          onChange={handleEditAySemChange}
                          color={editAySemError ? "failure" : "gray"}
                      />
                      <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                        <div>
                          {editAySemError && (
                              <HelperText color="failure">{editAySemError}</HelperText>
                          )}
                        </div>
                        <span>{editAySem.length}/8</span>
                      </div>
                    </div>
                ) : (
                    <div>
                      <Select
                          id="edit_ay_sem_select"
                          value={editAySem}
                          onChange={handleSelectEditAySemChange}
                          color={editAySemError ? "failure" : "gray"}
                          className="[&_select]:max-h-48 [&_select]:overflow-y-auto"
                      >
                        <option value="">Select Academic Year / Semester</option>
                        {academicYearList.map((item) => (
                            <option key={item.ay_sem} value={item.ay_sem}>
                              {item.ay_sem}
                            </option>
                        ))}
                      </Select>
                      {editAySemError && (
                          <HelperText color="failure" className="mt-1">
                            {editAySemError}
                          </HelperText>
                      )}
                    </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <Label htmlFor="edit_pass">Passing Status</Label>
                <ToggleSwitch
                    id="edit_pass"
                    checked={editPass}
                    label={editPass ? "Passed" : "Failed"}
                    onChange={setEditPass}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="edit_archived">Archive Record</Label>
                <ToggleSwitch
                    id="edit_archived"
                    checked={editArchived}
                    label={editArchived ? "Archived" : "Active"}
                    onChange={setEditArchived}
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter className="flex justify-between">
            <Button
                color="red"
                onClick={() => {
                  setOpenEditModal(false);
                  setOpenDeleteModal(true);
                }}
            >
              <FaTrash className="h-4 w-4" />
            </Button>

            <div className="flex gap-2">
              <Button
                  onClick={handleFcceUpdate}
                  disabled={isEditUnchanged || isEditFormInvalid}
              >
                Save Changes
              </Button>
              <Button color="alternative" onClick={handleCloseModals}>
                Cancel
              </Button>
            </div>
          </ModalFooter>
        </Modal>

        {/* Modal: Archive All Confirmation */}
        <Modal
            show={openArchiveAllModal}
            onClose={handleCloseModals}
            size="md"
            popup
        >
          <ModalHeader />
          <ModalBody>
            <div className="text-center">
              <HiOutlineArchive className="mx-auto mb-4 h-14 w-14 text-yellow-500 dark:text-yellow-400" />
              <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
                Are you sure you want to archive all active FCCE records?
              </h3>
              <div className="flex justify-center gap-4">
                <Button color="yellow" onClick={handleArchiveAllActive}>
                  Yes, archive all
                </Button>
                <Button color="alternative" onClick={handleCloseModals}>
                  No, cancel
                </Button>
              </div>
            </div>
          </ModalBody>
        </Modal>

        {/* Modal: Delete Confirmation */}
        <Modal show={openDeleteModal} onClose={handleCloseModals} size="md" popup>
          <ModalHeader />
          <ModalBody>
            <div className="text-center">
              <HiExclamation className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
              <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
                Are you sure you want to delete this FCCE record permanently?
              </h3>
              <div className="flex justify-center gap-4">
                <Button color="red" onClick={handleFcceDelete}>
                  Yes, I&#39;m sure
                </Button>
                <Button color="alternative" onClick={handleCloseModals}>
                  No, cancel
                </Button>
              </div>
            </div>
          </ModalBody>
        </Modal>
      </>
  );
}