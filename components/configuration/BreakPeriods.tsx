"use client"

import {
  Button,
  Card,
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
} from "flowbite-react";
import {
  createBreakPeriod,
  deleteBreakPeriod,
  fetchBreakPeriods,
  fetchBreakPeriodsCount,
  updateBreakPeriod,
} from "@/app/actions/system";
import { FaPlus, FaSortDown, FaSortUp } from "react-icons/fa6";
import {
  HiCheck,
  HiOutlineExclamationCircle,
  HiTrash,
} from "react-icons/hi2";
import { useEffect, useState } from "react";
import { HiExclamation, HiX } from "react-icons/hi";
import { filterAlphanumericUnderscore } from "@/utils/validation";
import { useMsal } from "@azure/msal-react";

interface BreakPeriod {
  break_id: string;
  break_description: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export default function BreakPeriods() {
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];
  const [isLoading, setLoading] = useState(true);

  // --- Table Constants --- //
  const [breakPeriods, setBreakPeriods] = useState<BreakPeriod[]>([]);
  const [breakPeriodsCount, setBreakPeriodsCount] = useState(0);
  const [sortBreakPeriodsBy, setSortBreakPeriodsBy] =
    useState("break_description");
  const [sortBreakPeriodsDir, setSortBreakPeriodsDir] = useState("ASC");

  // --- Modal Constants --- //
  const [openAddBreakModal, setOpenAddBreakModal] = useState(false);
  const [openEditBreakModal, setOpenEditBreakModal] = useState(false);
  const [openDeleteBreakModal, setOpenDeleteBreakModal] = useState(false);

  // --- Break Period Form states --- //
  const [rowID, setRowID] = useState("");
  const [descriptionError, setDescriptionError] = useState("");
  const [timeError, setTimeError] = useState("");
  // Add
  const [description, setDescription] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  // Update
  const [newDescription, editDescription] = useState("");
  const [newDayOfWeek, editDayOfWeek] = useState(1);
  const [newStartTime, editStartTime] = useState("08:00");
  const [newEndTime, editEndTime] = useState("09:00");

  // --- Pagination Constants --- //
  const maxRowBreakPeriod = 10;
  const [currentBreakPeriodPage, setCurrentBreakPeriodPage] = useState(1);
  const [pageChangingBreakPeriods, setPageChangingBreakPeriods] =
    useState(false);

  // --- Toast Constants --- //
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [showToastTimer, setShowToastTimer] = useState(false);
  const [progress, setProgress] = useState(0);

  // --- Day Conversion Constants --- //

  const DAYS_OF_WEEK = [
    { id: 1, name: "Monday" },
    { id: 2, name: "Tuesday" },
    { id: 3, name: "Wednesday" },
    { id: 4, name: "Thursday" },
    { id: 5, name: "Friday" },
    { id: 6, name: "Saturday" },
  ];

  const DAYS_OF_WEEK_ABV = [
    { id: 1, name: "Mon" },
    { id: 2, name: "Tue" },
    { id: 3, name: "Wed" },
    { id: 4, name: "Thu" },
    { id: 5, name: "Fri" },
    { id: 6, name: "Sat" },
  ];

  /**************
   *  FUNCTIONS *
   **************/

  /** --- Translation Related Functions --- **/

  function translateDay(day: number) {
    return DAYS_OF_WEEK_ABV.find((d) => d.id === day)?.name || "";
  }

  function translateTime(time: string): string {
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const date = new Date();
    date.setHours(parseInt(hours, 10), parseInt(minutes, 10));

    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  /** --- Table Related Functions --- **/
  // Sorting
  function handleBreakPeriodSorting(sortBy: string) {
    if (sortBy == sortBreakPeriodsBy) {
      setSortBreakPeriodsDir(sortBreakPeriodsDir === "ASC" ? "DESC" : "ASC");
    } else {
      setSortBreakPeriodsBy(sortBy);
      setSortBreakPeriodsDir("ASC");
    }
    setBreakPeriods([]);
    onPageChangeBreakPeriods(1);
    getBreakPeriods(
      null,
      sortBreakPeriodsBy,
      sortBreakPeriodsDir,
      maxRowBreakPeriod,
      1,
    );
  }

  // Page Change
  function onPageChangeBreakPeriods(page: number) {
    if (pageChangingBreakPeriods) {
      return;
    }

    setPageChangingBreakPeriods(true);
    setBreakPeriods([]);

    getBreakPeriods(
      null,
      sortBreakPeriodsBy,
      sortBreakPeriodsDir,
      maxRowBreakPeriod,
      page,
    );

    setPageChangingBreakPeriods(false);
    setCurrentBreakPeriodPage(page);
  }

  /** --- Form Related Functions --- **/

  function loadEditData(row_id: string) {
    setRowID(row_id);
    setOpenEditBreakModal(true);

    // Find the selected break item from your state list by its ID
    const selectedBreak = breakPeriods.find((item) => item.break_id === row_id);

    if (selectedBreak) {
      // 1. Set initial baseline state (used for comparison)
      setDescription(selectedBreak.break_description);
      setDayOfWeek(selectedBreak.day_of_week);
      setStartTime(selectedBreak.start_time);
      setEndTime(selectedBreak.end_time);

      // 2. Set editable form state (bound to modal input fields)
      editDescription(selectedBreak.break_description);
      editDayOfWeek(selectedBreak.day_of_week);
      editStartTime(selectedBreak.start_time);
      editEndTime(selectedBreak.end_time);
    }
  }

  // --- Create Handlers --- //

  // Description handler
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDescription = filterAlphanumericUnderscore(e.target.value);
    setDescription(newDescription);
    if (newDescription) {
      setDescriptionError("");
    } else {
      setDescriptionError("Description is required.");
    }
  };

  // Time validation handler
  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = e.target.value;
    setStartTime(newStart);
    if (endTime && newStart >= endTime) {
      setTimeError("End time must be after start time.");
    } else {
      setTimeError("");
    }
  };

  const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = e.target.value;
    setEndTime(newEnd);
    if (startTime && newEnd <= startTime) {
      setTimeError("End time must be after start time.");
    } else {
      setTimeError("");
    }
  };

  // --- Update Handlers --- //

  // Description handler
  const handleNewDescriptionChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const newDescription = filterAlphanumericUnderscore(e.target.value);
    editDescription(newDescription);
    if (newDescription) {
      setDescriptionError("");
    } else {
      setDescriptionError("Description is required.");
    }
  };

  // Time validation handler
  const handleNewStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = e.target.value;
    editStartTime(newStart);
    if (newEndTime && newStart >= newEndTime) {
      setTimeError("End time must be after start time.");
    } else {
      setTimeError("");
    }
  };

  const handleNewEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = e.target.value;
    editEndTime(newEnd);
    if (newStartTime && newEnd <= newStartTime) {
      setTimeError("End time must be after start time.");
    } else {
      setTimeError("");
    }
  };

  // Clear Constants
  const handleCloseBreakPeriodModals = () => {
    setRowID("");
    setTimeError("");
    setDescriptionError("");
    setOpenAddBreakModal(false);
    setOpenEditBreakModal(false);
    setOpenDeleteBreakModal(false);
    //add consts
    setDescription("");
    setDayOfWeek(1);
    setStartTime("08:00");
    setEndTime("09:00");
    //update consts
    editDescription("");
    editDayOfWeek(1);
    editStartTime("08:00");
    editEndTime("09:00");
  };

  /** --- CRUD Related --- **/

  //Count
  async function getBreakPeriodCount() {
    const response = await fetchBreakPeriodsCount();

    if (response.success) {
      setBreakPeriodsCount(response.count);
      console.log("breakPeriods row count fetched successfully");
    } else {
      setToastMessage(
        response?.error ??
          "[fetchBreakPeriodsCount]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
      setBreakPeriodsCount(0);
    }
  }

  // Create
  async function handleBreakSubmit() {
    if (!description.trim()) {
      setDescriptionError("Description is required.");
      return;
    }
    if (startTime >= endTime) {
      setTimeError("End time must be after start time.");
      return;
    }

    const response = await createBreakPeriod(
      activeAccount.username,
      description.trim(),
      dayOfWeek,
      startTime,
      endTime,
    );

    if (response.success && response.data) {
      const msg = "Break Period Added successfully";
      console.log(msg);
      setToastMessage(msg);
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(
        response?.error ?? "[AddBreakPeriod]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseBreakPeriodModals();
    getBreakPeriods();
  }

  // Read
  async function getBreakPeriods(
    search?: string | null,
    sortby?: string,
    sortdir?: string,
    limit?: number,
    page?: number,
  ) {
    setLoading(true);

    const response = await fetchBreakPeriods(
      search,
      sortby,
      sortdir,
      limit,
      page,
    );

    if (response.success && response.data) {
      setBreakPeriods(response.data);
      setLoading(false)
      console.log("breakPeriods fetched successfully");
    } else {
      setToastMessage(
        response?.error ?? "[fetchBreakPeriods]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
      setBreakPeriods([]);
    }

    await getBreakPeriodCount();
  }

  // Update
  async function handleBreakUpdate() {
    if (!newDescription.trim()) {
      setDescriptionError("Description is required.");
      return;
    }
    if (newStartTime >= newEndTime) {
      setTimeError("End time must be after start time.");
      return;
    }

    const response = await updateBreakPeriod(
      activeAccount.username,
      rowID,
      newDescription.trim(),
      newDayOfWeek,
      newStartTime,
      newEndTime,
    );

    if (response.success) {
      const msg = "Break Period updated successfully";
      console.log(msg);
      setToastMessage(msg);
      setToastType("success");
      setShowToast(true);
      toastTimer();
    } else {
      setToastMessage(
        response?.error ?? "[UpdateBreakPeriod]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseBreakPeriodModals();
    getBreakPeriods();
  }

  // Delete
  async function handleBreakDelete() {
    const response = await deleteBreakPeriod(
      activeAccount.username,
      rowID
    );

    if (response.success) {
      const msg = "Break Period Deleted successfully";
      console.log(msg);
      setToastMessage(msg);
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(
        response?.error ?? "[DeleteBreakPeriod]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseBreakPeriodModals();
    getBreakPeriods();
  }

  /** --- Toast Related Functions --- **/

  function toastTimer() {
    setShowToastTimer(true);
    setShowToast(true);
    // Reset progress to 0 whenever a new toast opens
    setProgress(0);

    const duration = 5000; // 5 seconds
    const intervalTime = 50; // Update every 50ms
    const step = 100 / (duration / intervalTime);

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev + step >= 100) {
          clearInterval(timer);
          closeToast(); // <-- Trigger close ONLY when timer hits 100%
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

  /** --- UseEffects --- **/

  useEffect(() => {
    getBreakPeriods();
  }, []);

  return (
    <>
      {/* --- Toast --- */}
      {showToast && (
        <div className="fixed right-5 bottom-5 z-50 rounded-lg border border-gray-500/30">
          <Toast>
            <div
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                toastType == "success"
                  ? "bg-green-100 text-green-500 dark:bg-green-800 dark:text-green-200"
                  : toastType == "warning"
                    ? "bg-yellow-100 text-yellow-500 dark:bg-yellow-800 dark:text-yellow-200"
                    : "bg-red-100 text-red-500 dark:bg-red-800 dark:text-red-200"
              }`}
            >
              {toastType == "success" && <HiCheck className="h-5 w-5" />}
              {toastType == "warning" && <HiExclamation className="h-5 w-5" />}
              {toastType == "error" && <HiX className="h-5 w-5" />}
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

      <div className={"mb-4 justify-between md:flex"}>
        <div>
          <h2 className={`mb-1 text-lg font-bold`}>Break Periods</h2>
          <p className={`mb-4 text-gray-500 md:mb-0`}>
            Manage recurring daily or weekly break windows. Schedules generated
            by the system will automatically respect these intervals and avoid
            assigning classes during these times.
          </p>
        </div>
        <Button className={"min-w-40"} onClick={() => setOpenAddBreakModal(true)}>
          <FaPlus className={`mr-2`} />
          Add Break
        </Button>
      </div>

      <Card className={`overflow-x-auto`}>
        <Table hoverable>
          <TableHead>
            <TableRow>
              <TableHeadCell
                onClick={() => handleBreakPeriodSorting("break_description")}
              >
                <div className="flex cursor-pointer">
                  Description
                  {sortBreakPeriodsBy === "break_description" ? (
                    sortBreakPeriodsDir === "ASC" ? (
                      <FaSortUp className="ml-1" />
                    ) : (
                      <FaSortDown className="ml-1" />
                    )
                  ) : (
                    ""
                  )}
                </div>
              </TableHeadCell>
              <TableHeadCell
                onClick={() => handleBreakPeriodSorting("day_of_week")}
              >
                <div className="flex cursor-pointer">
                  Day
                  {sortBreakPeriodsBy === "day_of_week" ? (
                    sortBreakPeriodsDir === "ASC" ? (
                      <FaSortUp className="ml-1" />
                    ) : (
                      <FaSortDown className="ml-1" />
                    )
                  ) : (
                    ""
                  )}
                </div>
              </TableHeadCell>
              <TableHeadCell
                className="flex cursor-pointer"
                onClick={() => handleBreakPeriodSorting("start_time")}
              >
                Start
                {sortBreakPeriodsBy === "start_time" ? (
                  sortBreakPeriodsDir === "ASC" ? (
                    <FaSortUp className="ml-1" />
                  ) : (
                    <FaSortDown className="ml-1" />
                  )
                ) : (
                  ""
                )}
              </TableHeadCell>
              <TableHeadCell
                onClick={() => handleBreakPeriodSorting("end_time")}
              >
                <div className="flex cursor-pointer">
                  End
                  {sortBreakPeriodsBy === "end_time" ? (
                    sortBreakPeriodsDir === "ASC" ? (
                      <FaSortUp className="ml-1" />
                    ) : (
                      <FaSortDown className="ml-1" />
                    )
                  ) : (
                    ""
                  )}
                </div>
              </TableHeadCell>
              <TableHeadCell>
                <span className="sr-only">Edit</span>
              </TableHeadCell>
            </TableRow>
          </TableHead>
          <TableBody className="divide-y">
            {breakPeriods.length > 0 ? (
              breakPeriods.map((breakItem) => (
                <TableRow
                  key={breakItem.break_id}
                  className="bg-white dark:border-gray-700 dark:bg-gray-800"
                >
                  <TableCell className="font-medium whitespace-nowrap text-gray-900 dark:text-white">
                    {breakItem.break_description}
                  </TableCell>
                  <TableCell>{translateDay(breakItem.day_of_week)}</TableCell>
                  <TableCell>{translateTime(breakItem.start_time)}</TableCell>
                  <TableCell>{translateTime(breakItem.end_time)}</TableCell>
                  <TableCell>
                    <a
                      onClick={() => loadEditData(breakItem.break_id)}
                      className="text-primary-600 dark:text-primary-500 cursor-pointer font-medium hover:underline"
                    >
                      Edit
                    </a>
                  </TableCell>
                </TableRow>
              ))
            ) : isLoading ? (
              <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                <TableCell
                  colSpan={5}
                  className="py-6 text-center text-sm text-gray-500 italic dark:text-gray-400"
                >
                  <div className="flex items-center justify-center">
                    <Spinner />
                    <span className="ml-4">fetching data...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                <TableCell
                  colSpan={5}
                  className="py-6 text-center text-sm text-gray-500 italic dark:text-gray-400"
                >
                  No break entries found yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* break periods pagination */}
      <div className={`mt-4 ${isLoading ? "pointer-events-none opacity-50 [&_button]:cursor-not-allowed [&_a]:cursor-not-allowed" : ""} flex w-full justify-center`}>
        <Pagination
          layout="table"
          currentPage={currentBreakPeriodPage ? currentBreakPeriodPage : 1}
          itemsPerPage={maxRowBreakPeriod}
          totalItems={breakPeriodsCount ? breakPeriodsCount : 1}
          onPageChange={onPageChangeBreakPeriods}
          showIcons
        />
      </div>

      {/* --- Modals --- */}
      {/* --- Add Break Modal --- */}
      <Modal show={openAddBreakModal} onClose={handleCloseBreakPeriodModals}>
        <ModalHeader>Add Break Period</ModalHeader>
        <ModalBody>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => e.preventDefault()}
          >
            {/* Description Field */}
            <div>
              <div className="mb-2 block">
                <Label htmlFor="break_description">Break Description</Label>
              </div>
              <TextInput
                id="break_description"
                placeholder="e.g. Lunch Break, Assembly"
                value={description}
                onChange={handleDescriptionChange}
                color={descriptionError ? "failure" : "gray"}
                required
              />
            </div>

            {/* Validation Message */}
            {descriptionError && (
              <p className="text-sm font-medium text-red-600">
                {descriptionError}
              </p>
            )}

            {/* Day of Week Field */}
            <div>
              <div className="mb-2 block">
                <Label htmlFor="day_of_week">Day of the Week</Label>
              </div>
              <Select
                id="day_of_week"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                required
              >
                <option value={1} hidden>
                  Monday
                </option>
                {DAYS_OF_WEEK.map((day) => (
                  <option key={day.id} value={day.id}>
                    {day.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Time Pickers */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="mb-2 block">
                  <Label htmlFor="start_time">Start Time</Label>
                </div>
                <TextInput
                  id="start_time"
                  type="time"
                  value={startTime}
                  onChange={handleStartTimeChange}
                  color={timeError ? "failure" : "gray"}
                  required
                />
              </div>

              <div>
                <div className="mb-2 block">
                  <Label htmlFor="end_time">End Time</Label>
                </div>
                <TextInput
                  id="end_time"
                  type="time"
                  value={endTime}
                  onChange={handleEndTimeChange}
                  color={timeError ? "failure" : "gray"}
                  required
                />
              </div>
            </div>

            {/* Validation Message */}
            {timeError && (
              <p className="text-sm font-medium text-red-600">{timeError}</p>
            )}
          </form>
        </ModalBody>
        <ModalFooter>
          <Button
            onClick={handleBreakSubmit}
            disabled={Boolean(timeError) || !description.trim()}
          >
            Save
          </Button>
          <Button color="alternative" onClick={handleCloseBreakPeriodModals}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* --- Edit Break Modal --- */}
      <Modal show={openEditBreakModal} onClose={handleCloseBreakPeriodModals}>
        <ModalHeader>Edit Break Period</ModalHeader>
        <ModalBody>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => e.preventDefault()}
          >
            {/* Description Field */}
            <div>
              <div className="mb-2 block">
                <Label htmlFor="break_description">Break Description</Label>
              </div>
              <TextInput
                id="break_description"
                placeholder="e.g. Lunch Break, Assembly"
                value={newDescription}
                onChange={handleNewDescriptionChange}
                color={descriptionError ? "failure" : "gray"}
                required
              />
            </div>

            {/* Validation Message */}
            {descriptionError && (
              <p className="text-sm font-medium text-red-600">
                {descriptionError}
              </p>
            )}

            {/* Day of Week Field */}
            <div>
              <div className="mb-2 block">
                <Label htmlFor="day_of_week">Day of the Week</Label>
              </div>
              <Select
                id="day_of_week"
                value={newDayOfWeek}
                onChange={(e) => editDayOfWeek(Number(e.target.value))}
                required
              >
                <option value={1} hidden>
                  Monday
                </option>
                {DAYS_OF_WEEK.map((day) => (
                  <option key={day.id} value={day.id}>
                    {day.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Time Pickers */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="mb-2 block">
                  <Label htmlFor="start_time">Start Time</Label>
                </div>
                <TextInput
                  id="start_time"
                  type="time"
                  value={newStartTime}
                  onChange={handleNewStartTimeChange}
                  color={timeError ? "failure" : "gray"}
                  required
                />
              </div>

              <div>
                <div className="mb-2 block">
                  <Label htmlFor="end_time">End Time</Label>
                </div>
                <TextInput
                  id="end_time"
                  type="time"
                  value={newEndTime}
                  onChange={handleNewEndTimeChange}
                  color={timeError ? "failure" : "gray"}
                  required
                />
              </div>
            </div>

            {/* Validation Message */}
            {timeError && (
              <p className="text-sm font-medium text-red-600">{timeError}</p>
            )}
          </form>
        </ModalBody>
        <ModalFooter className={"flex w-full justify-between"}>
          <div className={"flex"}>
            <Button
              onClick={handleBreakUpdate}
              disabled={
                Boolean(timeError) ||
                !newDescription.trim() ||
                (description === newDescription.trim() &&
                  startTime === newStartTime &&
                  endTime === newEndTime)
              }
            >
              Save
            </Button>
            <Button color="alternative" className={"ml-4"} onClick={handleCloseBreakPeriodModals}>
              Cancel
            </Button>
          </div>
          <Button color={"red"} onClick={() => setOpenDeleteBreakModal(true)}>
            <HiTrash />
          </Button>
        </ModalFooter>
      </Modal>

      {/* --- Delete Modal --- */}
      <Modal
        show={openDeleteBreakModal}
        size="md"
        onClose={() => setOpenDeleteBreakModal(false)}
        popup
      >
        <ModalHeader />
        <ModalBody>
          <div className="text-center">
            <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
            <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
              Are you sure you want to delete this Break Period?
            </h3>
            <div className="flex justify-center gap-4">
              <Button color="red" onClick={() => handleBreakDelete()}>
                <p>Yes, I am sure</p>
              </Button>
              <Button
                color="alternative"
                onClick={() => setOpenDeleteBreakModal(false)}
              >
                No, cancel
              </Button>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
}