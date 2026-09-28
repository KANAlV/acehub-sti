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
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TextInput,
  Textarea,
  Toast,
  ToastToggle,
  Tooltip,
} from "flowbite-react";
import {
  filterAlphanumericDashUnderscore,
  filterAlphanumericDashUnderscoreComma,
} from "@/utils/validation";
import { FaPlus, FaSortDown, FaSortUp } from "react-icons/fa6";
import {
  HiCheck,
  HiExclamation,
  HiX,
  HiSearch,
  HiOutlineRefresh,
  HiOutlineTrash,
  HiOutlinePencil,
} from "react-icons/hi";
import { useEffect, useState, ChangeEvent } from "react";
import { useMsal } from "@azure/msal-react";

// --- Types matching database statement schema --- //
export interface ScheduleRecord {
  schedule_id: string; // uuid PRIMARY KEY (hidden from UI, used as key)
  schedule_name: string | null; // text
  generation_config: { description?: string } | null; // jsonb holding description
  created_at: string; // timestamp with time zone
}

export interface ScheduleInput {
  schedule_name: string;
  generation_config: { description: string };
}

export default function ScheduleManagement() {
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];
  const username = activeAccount?.username;
  const [isLoading, setLoading] = useState(true);

  // --- Table & View Filter State --- //
  const [records, setRecords] = useState<ScheduleRecord[]>([]);
  const [recordsCount, setRecordsCount] = useState(0);
  const [sortScheduleBy, setSortScheduleBy] = useState("created_at");
  const [sortScheduleDir, setSortScheduleDir] = useState("DESC");
  const [searchTerm, setSearchTerm] = useState("");

  // --- Modal States --- //
  const [openAddModal, setOpenAddModal] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);

  // --- Form & Validation States --- //
  const [scheduleId, setScheduleId] = useState("");
  const [scheduleNameError, setScheduleNameError] = useState("");

  // Add Form State
  const [addScheduleName, setAddScheduleName] = useState("");
  const [addDescription, setAddDescription] = useState("");

  // Edit Form State
  const [editScheduleName, setEditScheduleName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Base State for Change Tracking
  const [baseScheduleName, setBaseScheduleName] = useState("");
  const [baseDescription, setBaseDescription] = useState("");

  // --- Pagination State --- //
  const maxRowSchedule = 10;
  const [currentSchedulePage, setCurrentSchedulePage] = useState(1);
  const [pageChanging, setPageChanging] = useState(false);

  // --- Toast State --- //
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [showToastTimer, setShowToastTimer] = useState(false);
  const [progress, setProgress] = useState(0);

  /** --- Validation Helpers --- **/
  const validateScheduleName = (val: string): string => {
    const trimmed = val.trim();
    if (!trimmed) return "Schedule name is required.";
    if (trimmed.length < 3) return "Schedule name must be at least 3 characters.";
    return "";
  };

  /** --- Input Handlers using utils/validation.ts --- **/
  const handleAddScheduleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const sanitized = filterAlphanumericDashUnderscoreComma(e.target.value).slice(0, 150);
    setAddScheduleName(sanitized);
    setScheduleNameError(validateScheduleName(sanitized));
  };

  const handleEditScheduleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const sanitized = filterAlphanumericDashUnderscoreComma(e.target.value).slice(0, 150);
    setEditScheduleName(sanitized);
    setScheduleNameError(validateScheduleName(sanitized));
  };

  const handleAddDescriptionChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setAddDescription(e.target.value);
  };

  const handleEditDescriptionChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setEditDescription(e.target.value);
  };

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    const sanitized = filterAlphanumericDashUnderscore(e.target.value);
    setSearchTerm(sanitized);
    setCurrentSchedulePage(1);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setCurrentSchedulePage(1);
  };

  /** --- Table Sorting & Pagination Handlers --- **/
  function handleScheduleSorting(sortBy: string) {
    const newDir =
      sortBy === sortScheduleBy && sortScheduleDir === "ASC" ? "DESC" : "ASC";
    setSortScheduleBy(sortBy);
    setSortScheduleDir(newDir);
    setRecords([]);
    setCurrentSchedulePage(1);
    void getScheduleRecords(
      searchTerm,
      sortBy,
      newDir,
      maxRowSchedule,
      1,
    );
  }

  function onPageChangeSchedule(page: number) {
    if (pageChanging) return;

    setPageChanging(true);
    setRecords([]);
    void getScheduleRecords(
      searchTerm,
      sortScheduleBy,
      sortScheduleDir,
      maxRowSchedule,
      page,
    );
    setPageChanging(false);
    setCurrentSchedulePage(page);
  }

  function loadEditData(id: string) {
    setScheduleId(id);
    const selectedRecord = records.find((item) => item.schedule_id === id);

    if (selectedRecord) {
      const name = selectedRecord.schedule_name || "";
      const desc = selectedRecord.generation_config?.description || "";

      setBaseScheduleName(name);
      setBaseDescription(desc);

      setEditScheduleName(name);
      setEditDescription(desc);

      setScheduleNameError("");
      setOpenEditModal(true);
    }
  }

  function promptDelete(id: string) {
    setScheduleId(id);
    setOpenDeleteModal(true);
  }

  const handleCloseModals = () => {
    setScheduleId("");
    setScheduleNameError("");

    setOpenAddModal(false);
    setOpenEditModal(false);
    setOpenDeleteModal(false);

    setAddScheduleName("");
    setAddDescription("");

    setEditScheduleName("");
    setEditDescription("");
  };

  /** --- Server Integration Actions --- **/
  async function getScheduleCount(search?: string | null) {
    const response = { success: true, count: records.length };

    if (response?.success) {
      setRecordsCount(response.count);
    } else {
      setToastMessage("[fetchSchedulesCount]: An unexpected error occurred");
      setToastType("error");
      setShowToast(true);
      setRecordsCount(0);
    }
  }

  async function getScheduleRecords(
    search: string | null = searchTerm,
    sortby: string = sortScheduleBy,
    sortdir: string = sortScheduleDir,
    limit: number = maxRowSchedule,
    page: number = currentSchedulePage,
  ) {
    setLoading(true);

    const response = {
      success: true,
      data: [
        {
          schedule_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          schedule_name: "SHS Term 1 Master Schedule",
          generation_config: { description: "First semester timetable configuration for Senior High School department." },
          created_at: new Date().toISOString(),
        },
      ] as ScheduleRecord[],
    };

    if (response?.success && response.data) {
      setRecords(response.data);
    } else {
      setToastMessage("[fetchSchedules]: An unexpected error occurred");
      setToastType("error");
      setShowToast(true);
      setRecords([]);
    }

    setLoading(false);
    await getScheduleCount(search);
  }

  async function refreshData() {
    await getScheduleRecords(
      searchTerm,
      sortScheduleBy,
      sortScheduleDir,
      maxRowSchedule,
      currentSchedulePage,
    );
  }

  async function handleScheduleSubmit() {
    const nameErr = validateScheduleName(addScheduleName);
    if (nameErr) {
      setScheduleNameError(nameErr);
      return;
    }

    const payload: ScheduleInput = {
      schedule_name: addScheduleName.trim(),
      generation_config: {
        description: addDescription.trim(),
      },
    };

    const response = { success: true };

    if (response?.success) {
      setToastMessage("Schedule record created successfully");
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage("[CreateSchedule]: An unexpected error occurred");
      setToastType("error");
      setShowToast(true);
    }

    handleCloseModals();
    void refreshData();
  }

  async function handleScheduleUpdate() {
    const nameErr = validateScheduleName(editScheduleName);
    if (nameErr) {
      setScheduleNameError(nameErr);
      return;
    }

    const payload: ScheduleInput = {
      schedule_name: editScheduleName.trim(),
      generation_config: {
        description: editDescription.trim(),
      },
    };

    const response = { success: true };

    if (response?.success) {
      setToastMessage("Schedule record updated successfully");
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage("[UpdateSchedule]: An unexpected error occurred");
      setToastType("error");
      setShowToast(true);
    }

    handleCloseModals();
    void refreshData();
  }

  async function handleDeleteSchedule() {
    const response = { success: true };

    if (response?.success) {
      setToastMessage("Schedule record deleted successfully");
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage("[DeleteSchedule]: An unexpected error occurred");
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
      void getScheduleRecords(
        searchTerm,
        sortScheduleBy,
        sortScheduleDir,
        maxRowSchedule,
        currentSchedulePage,
      );
    }, 300);

    return () => clearInterval(delayDebounceFn);
  }, [searchTerm]);

  const isAddFormInvalid = !addScheduleName.trim() || !!scheduleNameError;

  const isEditFormInvalid = !editScheduleName.trim() || !!scheduleNameError;

  const isEditUnchanged =
    editScheduleName.trim() === baseScheduleName.trim() &&
    editDescription.trim() === baseDescription.trim();

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
          <h2 className="mb-1 text-lg font-bold">Schedule Management</h2>
          <p className="text-gray-500">
            Manage timetable schedules and their descriptions.
          </p>
        </div>

        <div className="my-4 flex-col justify-between gap-4 md:flex md:flex-row md:items-center">
          <div className="relative w-full md:w-64">
            <TextInput
              id="search-schedule"
              type="text"
              placeholder="Search Schedule Name..."
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
            <Button
              color="gray"
              className="whitespace-nowrap"
              onClick={() => refreshData()}
            >
              <HiOutlineRefresh className="mr-2 h-4 w-4" />
              Refresh
            </Button>

            <Button
              className="whitespace-nowrap"
              onClick={() => setOpenAddModal(true)}
            >
              <FaPlus className="mr-2" />
              Add Schedule
            </Button>
          </div>
        </div>

        {/* Table Container */}
        <Card className="overflow-x-auto">
          <Table hoverable>
            <TableHead>
              <TableRow>
                <TableHeadCell onClick={() => handleScheduleSorting("schedule_name")}>
                  <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                    Schedule Name
                    {sortScheduleBy === "schedule_name" &&
                      (sortScheduleDir === "ASC" ? (
                        <FaSortUp className="ml-1" />
                      ) : (
                        <FaSortDown className="ml-1" />
                      ))}
                  </div>
                </TableHeadCell>

                <TableHeadCell>Description</TableHeadCell>

                <TableHeadCell onClick={() => handleScheduleSorting("created_at")}>
                  <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                    Created At
                    {sortScheduleBy === "created_at" &&
                      (sortScheduleDir === "ASC" ? (
                        <FaSortUp className="ml-1" />
                      ) : (
                        <FaSortDown className="ml-1" />
                      ))}
                  </div>
                </TableHeadCell>

                <TableHeadCell>Actions</TableHeadCell>
              </TableRow>
            </TableHead>

            <TableBody className="divide-y">
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center">
                    <Spinner size="lg" />
                    <span className="ml-2 text-gray-500">Loading schedules...</span>
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-gray-500">
                    No schedule records found.
                  </TableCell>
                </TableRow>
              ) : (
                records.map((item) => (
                  <TableRow key={item.schedule_id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <TableCell className="font-medium text-gray-900 dark:text-white">
                      {item.schedule_name || "N/A"}
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {item.generation_config?.description || "No description provided."}
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {item.created_at
                        ? new Date(item.created_at).toLocaleString()
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Tooltip content="Edit Schedule">
                          <button
                            type="button"
                            onClick={() => loadEditData(item.schedule_id)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <HiOutlinePencil className="h-5 w-5" />
                          </button>
                        </Tooltip>
                        <Tooltip content="Delete Schedule">
                          <button
                            type="button"
                            onClick={() => promptDelete(item.schedule_id)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <HiOutlineTrash className="h-5 w-5" />
                          </button>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {recordsCount > 0 && (
            <div className="flex items-center justify-between p-4">
              <span className="text-sm text-gray-500">
                Showing {Math.min((currentSchedulePage - 1) * maxRowSchedule + 1, recordsCount)} to{" "}
                {Math.min(currentSchedulePage * maxRowSchedule, recordsCount)} of {recordsCount} entries
              </span>
              <Pagination
                currentPage={currentSchedulePage}
                totalPages={Math.ceil(recordsCount / maxRowSchedule)}
                onPageChange={onPageChangeSchedule}
                showIcons
              />
            </div>
          )}
        </Card>
      </div>

      {/* --- ADD MODAL --- */}
      <Modal show={openAddModal} onClose={handleCloseModals}>
        <ModalHeader>Add New Schedule</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <Label htmlFor="add-schedule-name">Schedule Name *</Label>
              <TextInput
                id="add-schedule-name"
                placeholder="e.g. SHS Term 1 Master Schedule"
                value={addScheduleName}
                onChange={handleAddScheduleNameChange}
                color={scheduleNameError ? "failure" : undefined}
              />
              {scheduleNameError && (
                <HelperText color="failure">{scheduleNameError}</HelperText>
              )}
            </div>

            <div>
              <Label htmlFor="add-description">Description</Label>
              <Textarea
                id="add-description"
                rows={4}
                placeholder="Enter description for this schedule..."
                value={addDescription}
                onChange={handleAddDescriptionChange}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button disabled={isAddFormInvalid} onClick={handleScheduleSubmit}>
            Save Schedule
          </Button>
          <Button color="gray" onClick={handleCloseModals}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* --- EDIT MODAL --- */}
      <Modal show={openEditModal} onClose={handleCloseModals}>
        <ModalHeader>Edit Schedule</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-schedule-name">Schedule Name *</Label>
              <TextInput
                id="edit-schedule-name"
                value={editScheduleName}
                onChange={handleEditScheduleNameChange}
                color={scheduleNameError ? "failure" : undefined}
              />
              {scheduleNameError && (
                <HelperText color="failure">{scheduleNameError}</HelperText>
              )}
            </div>

            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                rows={4}
                value={editDescription}
                onChange={handleEditDescriptionChange}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button disabled={isEditFormInvalid || isEditUnchanged} onClick={handleScheduleUpdate}>
            Update Schedule
          </Button>
          <Button color="gray" onClick={handleCloseModals}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* --- DELETE CONFIRMATION MODAL --- */}
      <Modal show={openDeleteModal} onClose={handleCloseModals} size="md">
        <ModalHeader>Confirm Deletion</ModalHeader>
        <ModalBody>
          <div className="text-center">
            <HiExclamation className="mx-auto mb-4 h-14 w-14 text-red-500" />
            <h3 className="mb-2 text-lg font-normal text-gray-500 dark:text-gray-400">
              Are you sure you want to delete this schedule?
            </h3>
          </div>
        </ModalBody>
        <ModalFooter className="justify-center">
          <Button color="failure" onClick={handleDeleteSchedule}>
            Yes, Delete
          </Button>
          <Button color="gray" onClick={handleCloseModals}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}