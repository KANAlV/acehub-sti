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
  fetchFcce,
  fetchFcceCount,
  fetchSubjects,
  updateFcce,
  FcceRecord,
  FcceInput,
  SubjectRecord,
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
import { useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";

export default function FcceManagement() {
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];
  const username = activeAccount?.username;
  const [isLoading, setLoading] = useState(true);

  // --- Subjects / Course Suggestions State --- //
  const [subjectList, setSubjectList] = useState<SubjectRecord[]>([]);

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
  const [editPscsIdError, setEditPscsIdError] = useState("");
  const [editCourseNameError, setEditCourseNameError] = useState("");

  // Add Form State
  const [addPscsId, setAddPscsId] = useState("");
  const [addCourseName, setAddCourseName] = useState("");
  const [addPass, setAddPass] = useState(false);

  // Edit Form State
  const [editPscsId, setEditPscsId] = useState("");
  const [editCourseName, setEditCourseName] = useState("");
  const [editPass, setEditPass] = useState(false);
  const [editArchived, setEditArchived] = useState(false);

  // Base State for Change Tracking
  const [basePscsId, setBasePscsId] = useState("");
  const [baseCourseName, setBaseCourseName] = useState("");
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

  /** --- Load Subjects for Auto-suggestions & Validation --- **/
  async function loadSubjects() {
    const res = await fetchSubjects(null, "course_name", "ASC", 0, 1);
    if (res?.success && res.data) {
      setSubjectList(res.data);
    }
  }

  useEffect(() => {
    void loadSubjects();
  }, []);

  /** --- Helper to check if a course exists --- **/
  const isCourseValid = (courseName: string) => {
    if (!courseName) return false;
    return subjectList.some(
      (subj) =>
        subj.course_name?.toLowerCase().trim() ===
        courseName.toLowerCase().trim()
    );
  };

  // Check state for legends
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
    void getFcceRecords(searchTerm, archiveFilter, sortBy, newDir, maxRowFcce, 1);
  }

  function onPageChangeFcce(page: number) {
    if (pageChanging) return;

    setPageChanging(true);
    setRecords([]);
    void getFcceRecords(
      searchTerm,
      archiveFilter,
      sortFcceBy,
      sortFcceDir,
      maxRowFcce,
      page
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

  const handleArchiveFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setArchiveFilter(e.target.value as ArchivedMode);
    setCurrentFccePage(1);
  };

  /** --- Form Validation and Handlers --- **/
  const handleAddPscsIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAddPscsId(val);
    setPscsIdError(!val.trim() ? "PSCS ID is required." : "");
  };

  const handleAddCourseNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAddCourseName(val);
    setCourseNameError(!val.trim() ? "Course name is required." : "");
  };

  const handleEditPscsIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEditPscsId(val);
    setEditPscsIdError(!val.trim() ? "PSCS ID is required." : "");
  };

  const handleEditCourseNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEditCourseName(val);
    setEditCourseNameError(!val.trim() ? "Course name is required." : "");
  };

  function loadEditData(id: string) {
    setFcceId(id);
    const selectedRecord = records.find((item) => item.fcce_id === id);

    if (selectedRecord) {
      const pscs = selectedRecord.pscs_id || "";
      const course = selectedRecord.course_name || "";
      const pass = !!selectedRecord.pass;
      const archived = !!selectedRecord.archived;

      setBasePscsId(pscs);
      setBaseCourseName(course);
      setBasePass(pass);
      setBaseArchived(archived);

      setEditPscsId(pscs);
      setEditCourseName(course);
      setEditPass(pass);
      setEditArchived(archived);

      setOpenEditModal(true);
    }
  }

  const handleCloseModals = () => {
    setFcceId("");
    setPscsIdError("");
    setCourseNameError("");
    setEditPscsIdError("");
    setEditCourseNameError("");

    setOpenAddModal(false);
    setOpenEditModal(false);
    setOpenDeleteModal(false);
    setOpenArchiveAllModal(false);

    setAddPscsId("");
    setAddCourseName("");
    setAddPass(false);

    setEditPscsId("");
    setEditCourseName("");
    setEditPass(false);
    setEditArchived(false);
  };

  /** --- Server Integration Actions --- **/
  async function getFcceCount(
    search?: string | null,
    archivedMode: ArchivedMode = archiveFilter
  ) {
    const response = await fetchFcceCount(search, archivedMode);
    if (response?.success) {
      setRecordsCount(response.count);
    } else {
      setToastMessage(
        response?.error ?? "[fetchFcceCount]: An unexpected error occurred"
      );
      setToastType("error");
      setShowToast(true);
      setRecordsCount(0);
    }
  }

  async function getFcceRecords(
    search: string | null = searchTerm,
    archivedMode: ArchivedMode = archiveFilter,
    sortby: string = sortFcceBy,
    sortdir: string = sortFcceDir,
    limit: number = maxRowFcce,
    page: number = currentFccePage
  ) {
    setLoading(true);

    const response = await fetchFcce(
      search,
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
        response?.error ?? "[fetchFcce]: An unexpected error occurred"
      );
      setToastType("error");
      setShowToast(true);
      setRecords([]);
    }

    setLoading(false);
    await getFcceCount(search, archivedMode);
  }

  async function handleFcceSubmit() {
    if (!addPscsId.trim()) {
      setPscsIdError("PSCS ID is required.");
      return;
    }
    if (!addCourseName.trim()) {
      setCourseNameError("Course name is required.");
      return;
    }

    const payload: FcceInput = {
      pscs_id: addPscsId.trim(),
      course_name: addCourseName.trim(),
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
    void getFcceRecords(
      searchTerm,
      archiveFilter,
      sortFcceBy,
      sortFcceDir,
      maxRowFcce,
      currentFccePage
    );
  }

  async function handleFcceUpdate() {
    if (!editPscsId.trim()) {
      setEditPscsIdError("PSCS ID is required.");
      return;
    }
    if (!editCourseName.trim()) {
      setEditCourseNameError("Course name is required.");
      return;
    }

    const payload: Partial<FcceInput> = {
      pscs_id: editPscsId.trim(),
      course_name: editCourseName.trim(),
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
    void getFcceRecords(
      searchTerm,
      archiveFilter,
      sortFcceBy,
      sortFcceDir,
      maxRowFcce,
      currentFccePage
    );
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
    void getFcceRecords(
      searchTerm,
      archiveFilter,
      sortFcceBy,
      sortFcceDir,
      maxRowFcce,
      currentFccePage
    );
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
    void getFcceRecords(
      searchTerm,
      archiveFilter,
      sortFcceBy,
      sortFcceDir,
      maxRowFcce,
      currentFccePage
    );
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
    const delayDebounceFn = setTimeout(() => {
      void getFcceRecords(
        searchTerm,
        archiveFilter,
        sortFcceBy,
        sortFcceDir,
        maxRowFcce,
        currentFccePage
      );
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, archiveFilter]);

  const isAddFormInvalid =
    !addPscsId.trim() ||
    !addCourseName.trim() ||
    !!pscsIdError ||
    !!courseNameError;

  const isEditFormInvalid =
    !editPscsId.trim() ||
    !editCourseName.trim() ||
    !!editPscsIdError ||
    !!editCourseNameError;

  const isEditUnchanged =
    editPscsId === basePscsId &&
    editCourseName === baseCourseName &&
    editPass === basePass &&
    editArchived === baseArchived;

  return (
    <>
      {/* Shared DataList for Subject Auto-suggestions */}
      <datalist id="course-suggestions">
        {subjectList.map((subject, idx) => (
          <option key={idx} value={subject.course_name} />
        ))}
      </datalist>

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
        <div className="mb-4 flex-col justify-between gap-4 md:flex md:flex-row md:items-center">
          <div>
            <h2 className="mb-1 text-lg font-bold">FCCE Management</h2>
            <p className="text-gray-500">
              Manage and track FCCE student course passing statuses and archive
              records.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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

            <div className="relative w-full md:w-64">
              <TextInput
                id="search-fcce"
                type="text"
                placeholder="Search PSCS ID or Course..."
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
              <Tooltip content={"Row highlighted due to an invalid or missing subject."}>
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
              <Tooltip content={"Row highlighted in gray and text lined-through indicates an archived record."}>
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
              {records.length > 0 ? (
                records.map((item) => {
                  const exists = isCourseValid(item.course_name);

                  // Row background logic: archived gets gray background, invalid course gets yellow, standard gets white
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
                      <TableCell>{item.course_name}</TableCell>
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
              ) : isLoading ? (
                <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                  <TableCell
                    colSpan={5}
                    className="py-6 text-center text-sm text-gray-500 italic dark:text-gray-400"
                  >
                    <div className="flex items-center justify-center">
                      <Spinner />
                      <span className="ml-4">Fetching records...</span>
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
                      ? `No records matching "${searchTerm}" found.`
                      : archiveFilter === "ARCHIVED"
                        ? "No archived FCCE entries found."
                        : archiveFilter === "BOTH"
                          ? "No FCCE entries found."
                          : "No active FCCE entries found."}
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
            <div>
              <Label htmlFor="pscs_id">PSCS ID *</Label>
              <TextInput
                id="pscs_id"
                placeholder="e.g. PSCS-2024-001"
                value={addPscsId}
                onChange={handleAddPscsIdChange}
                color={pscsIdError ? "failure" : "gray"}
              />
              {pscsIdError && (
                <HelperText color="failure" className="mt-1">
                  {pscsIdError}
                </HelperText>
              )}
            </div>

            <div>
              <Label htmlFor="course_name">Course Name *</Label>
              <TextInput
                id="course_name"
                list="course-suggestions"
                placeholder="e.g. Computer Science 101"
                value={addCourseName}
                onChange={handleAddCourseNameChange}
                color={courseNameError ? "failure" : "gray"}
              />
              {courseNameError && (
                <HelperText color="failure" className="mt-1">
                  {courseNameError}
                </HelperText>
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
            <div>
              <Label htmlFor="edit_pscs_id">PSCS ID *</Label>
              <TextInput
                id="edit_pscs_id"
                value={editPscsId}
                onChange={handleEditPscsIdChange}
                color={editPscsIdError ? "failure" : "gray"}
              />
              {editPscsIdError && (
                <HelperText color="failure" className="mt-1">
                  {editPscsIdError}
                </HelperText>
              )}
            </div>

            <div>
              <Label htmlFor="edit_course_name">Course Name *</Label>
              <TextInput
                id="edit_course_name"
                list="course-suggestions"
                value={editCourseName}
                onChange={handleEditCourseNameChange}
                color={editCourseNameError ? "failure" : "gray"}
              />
              {editCourseNameError && (
                <HelperText color="failure" className="mt-1">
                  {editCourseNameError}
                </HelperText>
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