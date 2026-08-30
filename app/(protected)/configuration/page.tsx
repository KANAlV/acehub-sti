"use client"

import { HiCheck, HiMiniCog6Tooth, HiMiniPlus } from "react-icons/hi2";
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
  TabItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  Tabs,
  TextInput,
  Toast,
  ToastToggle,
} from "flowbite-react";
import { FaCoffee, FaWeight } from "react-icons/fa";
import { useEffect, useState } from "react";
import { createBreakPeriod, fetchBreakPeriods, fetchBreakPeriodsCount} from "@/app/actions/system";
import { HiExclamation, HiX } from "react-icons/hi";
import { FaSortDown, FaSortUp } from "react-icons/fa6";

interface BreakPeriod {
  break_id: string;
  break_description: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export default function Configuration() {
  // --- Toast Constants --- //
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [showToastTimer, setShowToastTimer] = useState(false);
  const [progress, setProgress] = useState(0);

  // --- Modal Constants --- //
  const [openAddBreakModal, setOpenAddBreakModal] = useState(false);

  // --- Break Period Constants --- //
  const [breakPeriods, setBreakPeriods] = useState<BreakPeriod[]>([]);
  const [breakPeriodsCount, setBreakPeriodsCount] = useState(0);

  const maxRowBreakPeriod = 10;
  const [currentBreakPeriodPage, setCurrentBreakPeriodPage] = useState(1);
  const [pageChangingBreakPeriods, setPageChangingBreakPeriods] =
    useState(false);

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

  // break periods sorting
  const [sortBreakPeriodsBy, setSortBreakPeriodsBy] = useState("break_description");
  const [sortBreakPeriodsDir, setSortBreakPeriodsDir] = useState("ASC");

  // Break Period Form state
  const [description, setDescription] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [descriptionError, setDescriptionError] = useState("");
  const [timeError, setTimeError] = useState("");

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

  function handleBreakPeriodSorting(sortBy:string) {
    if(sortBy == sortBreakPeriodsBy) {
      setSortBreakPeriodsDir(sortBreakPeriodsDir === "ASC" ? "DESC" : "ASC");
    } else {
      setSortBreakPeriodsBy(sortBy);
      setSortBreakPeriodsDir("ASC");
    }
    setBreakPeriods([]);
    onPageChangeBreakPeriods(1);
    getBreakPeriods(null, sortBreakPeriodsBy, sortBreakPeriodsDir, maxRowBreakPeriod, 1)
  }

  // Description handler
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDescription = e.target.value;
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

  // Reset state when closing modal
  const handleCloseBreakPeriodModals = () => {
    setDescription("");
    setDayOfWeek(1);
    setStartTime("08:00");
    setEndTime("09:00");
    setDescriptionError("");
    setTimeError("");
    setOpenAddBreakModal(false);
  };

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

  // --- Break Period Functions --- //

  async function getBreakPeriodCount() {
    const response = await fetchBreakPeriodsCount();

    if (response.success) {
      setBreakPeriodsCount(response.count);
      console.log("breakPeriods row count fetched successfully");
    } else {
      setToastMessage(response?.error ?? "[fetchBreakPeriodsCount]: An unexpected error occurred");
      setToastType("error");
      setShowToast(true);
      setBreakPeriodsCount(0);
    }
  }

  async function getBreakPeriods(
    search?: string | null,
    sortby?: string,
    sortdir?: string,
    limit?: number,
    page?: number,
  ) {
    const response = await fetchBreakPeriods(
      search,
      sortby,
      sortdir,
      limit,
      page,
    );

    if (response.success && response.data) {
      setBreakPeriods(response.data);
      console.log("breakPeriods fetched successfully");
    } else {
      setToastMessage(response?.error ?? "[fetchBreakPeriods]: An unexpected error occurred");
      setToastType("error");
      setShowToast(true);
      setBreakPeriods([]);
    }

    await getBreakPeriodCount();
  }

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
        description,
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

      <div className={`w-full overflow-auto p-8`}>
        <h1 className={`mb-4 flex items-center text-2xl font-bold`}>
          <HiMiniCog6Tooth className={`mr-2`} />
          Configuration
        </h1>

        {/* --- Break Periods --- */}
        <Tabs aria-label="Default tabs" variant="underline">
          <TabItem active title="Break Periods" icon={FaCoffee}>
            <div className={"mb-4 justify-between md:flex"}>
              <div>
                <h2 className={`mb-1 text-lg font-bold`}>Break Periods</h2>
                <p className={`mb-4 text-gray-500 md:mb-0`}>
                  Manage recurring daily or weekly break windows. Schedules
                  generated by the system will automatically respect these
                  intervals and avoid assigning classes during these times.
                </p>
              </div>
              <Button onClick={() => setOpenAddBreakModal(true)}>
                <HiMiniPlus className={`mr-2`} />
                Add Break
              </Button>
            </div>

            <Card className={`overflow-x-auto`}>
              <Table hoverable>
                <TableHead>
                  <TableRow>
                    <TableHeadCell onClick={() => handleBreakPeriodSorting("break_description")} >
                      <div className="flex cursor-pointer">
                        Description
                        {sortBreakPeriodsBy === "break_description" ?
                        sortBreakPeriodsDir === "ASC" ? (
                          <FaSortUp className="ml-1" />
                        ) : (
                          <FaSortDown className="ml-1" />
                        ):""}
                      </div>
                    </TableHeadCell>
                    <TableHeadCell onClick={() => handleBreakPeriodSorting("day_of_week")} >
                      <div className="flex cursor-pointer">
                        Day
                        {sortBreakPeriodsBy === "day_of_week" ?
                        sortBreakPeriodsDir === "ASC" ? (
                          <FaSortUp className="ml-1" />
                        ) : (
                          <FaSortDown className="ml-1" />
                        ):""}
                      </div>
                    </TableHeadCell>
                    <TableHeadCell
                      className="flex cursor-pointer"
                      onClick={() => handleBreakPeriodSorting("start_time")}
                    >
                      Start
                      {sortBreakPeriodsBy === "start_time" ?
                      sortBreakPeriodsDir === "ASC" ? (
                        <FaSortUp className="ml-1" />
                      ) : (
                        <FaSortDown className="ml-1" />
                      ):""}
                    </TableHeadCell>
                    <TableHeadCell onClick={() => handleBreakPeriodSorting("end_time")} >
                      <div className="flex cursor-pointer">
                        End
                        {sortBreakPeriodsBy === "end_time" ?
                        sortBreakPeriodsDir === "ASC" ? (
                          <FaSortUp className="ml-1" />
                        ) : (
                          <FaSortDown className="ml-1" />
                        ):""}
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
                            href="#"
                            className="text-primary-600 dark:text-primary-500 font-medium hover:underline"
                          >
                            Edit
                          </a>
                        </TableCell>
                      </TableRow>
                    ))
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
            <div
              className={`${pageChangingBreakPeriods ? "pointer-events-none opacity-50" : ""} mt-4 flex w-full flex-1 justify-center`}
            >
              <Pagination
                layout="table"
                currentPage={
                  currentBreakPeriodPage ? currentBreakPeriodPage : 1
                }
                itemsPerPage={maxRowBreakPeriod}
                totalItems={breakPeriodsCount ? breakPeriodsCount : 1}
                onPageChange={onPageChangeBreakPeriods}
                showIcons
              />
            </div>
          </TabItem>

          <TabItem active title="Faculty Load" icon={FaWeight}></TabItem>

          <TabItem active title="Class Settings"></TabItem>

          <TabItem active title="Dropdown Values"></TabItem>

          <TabItem active title="Users"></TabItem>
        </Tabs>
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
                <option value={1} hidden>Monday</option>
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
            Add Break
          </Button>
          <Button color="alternative" onClick={handleCloseBreakPeriodModals}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}