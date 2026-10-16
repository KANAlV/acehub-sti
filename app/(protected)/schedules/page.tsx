"use client";

import {
  Button,
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
  Radio,
  Select,
} from "flowbite-react";
import {
  filterAlphanumericDashUnderscore,
  filterAlphanumericDashUnderscoreComma,
} from "@/utils/validation";
import { FaPlus, FaSortDown, FaSortUp } from "react-icons/fa6";
import { HiCheck, HiExclamation, HiX, HiSearch } from "react-icons/hi";
import { useEffect, useState, ChangeEvent } from "react";
import { HiChevronRight } from "react-icons/hi2";
import { fetchSchedules } from "@/app/actions/system";

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
  const [isLoading, setLoading] = useState(true);

  // --- Table & View Filter State --- //
  const [records, setRecords] = useState<ScheduleRecord[]>([]);
  const [sortScheduleBy, setSortScheduleBy] = useState("created_at");
  const [sortScheduleDir, setSortScheduleDir] = useState("DESC");
  const [searchTerm, setSearchTerm] = useState("");

  // --- Modal States & Wizard Steps --- //
  const [openAddModal, setOpenAddModal] = useState(false);
  const [addStep, setAddStep] = useState<"selection" | "form">("selection");
  const [creationMode, setCreationMode] = useState<"auto" | "template">("auto");

  // --- Form & Validation States --- //
  const [scheduleId, setScheduleId] = useState("");
  const [scheduleNameError, setScheduleNameError] = useState("");

  // Add Form State (Common / Template mode)
  const [addScheduleName, setAddScheduleName] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");

  // Auto Assign / Generation Specific State
  const [autoGenerationConfig, setAutoGenerationConfig] = useState("");

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
    if (trimmed.length < 3)
      return "Schedule name must be at least 3 characters.";
    return "";
  };

  /** --- Input Handlers using utils/validation.ts --- **/
  const handleAddScheduleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const sanitized = filterAlphanumericDashUnderscoreComma(
        e.target.value,
    ).slice(0, 150);
    setAddScheduleName(sanitized);
    setScheduleNameError(validateScheduleName(sanitized));
  };

  const handleAddDescriptionChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setAddDescription(e.target.value);
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
    void getScheduleRecords(searchTerm, sortBy, newDir, maxRowSchedule, 1);
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

  const handleCloseModals = () => {
    setScheduleId("");
    setScheduleNameError("");
    setOpenAddModal(false);
    setAddStep("selection");
    setCreationMode("auto");
    setAddScheduleName("");
    setAddDescription("");
    setSelectedTemplate("");
    setAutoGenerationConfig("");
  };

  /** --- Server Integration Actions --- **/
  async function getScheduleRecords(
      search: string | null = searchTerm,
      sortby: string = sortScheduleBy,
      sortdir: string = sortScheduleDir,
      limit: number = maxRowSchedule,
      page: number = currentSchedulePage,
  ) {
    setLoading(true);

    const response = await fetchSchedules({
      search: search,
      sortBy: sortby,
      sortDir: sortdir as 'ASC' | 'DESC',
      page: page,
      limit: limit,
    });

    if (response?.success && response.data) {
      setRecords(response.data as ScheduleRecord[]);
    } else {
      setToastMessage(
          response?.error ?? "[fetchSchedules]: An unexpected error occurred"
      );
      setToastType("error");
      setShowToast(true);
      setRecords([]);
    }

    setLoading(false);
  }

  async function handleScheduleSubmit() {
    if (creationMode === "template" && isAddFormInvalid) return;

    // Implement your schedule creation logic or server action call here based on creationMode
    setToastMessage("Schedule created successfully");
    setToastType("success");
    toastTimer();
    handleCloseModals();
    void getScheduleRecords();
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

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const isAddFormInvalid = creationMode === "template" && (!addScheduleName.trim() || !!scheduleNameError || !selectedTemplate);

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
          <div className={"mb-2"}>
            <h2 className="mb-1 text-lg font-bold">Schedule Management</h2>
            <p className="text-gray-500">
              Manage timetable schedules and their descriptions.
            </p>
          </div>

          <div className={"sm:flex w-full gap-2 sm:justify-end "}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="mb-2 relative w-full sm:w-auto">
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
            </div>

            <Button
                className="mb-2 w-full sm:w-auto whitespace-nowrap"
                onClick={() => {
                  setAddStep("selection");
                  setOpenAddModal(true);
                }}
            >
              <FaPlus className="mr-2" />
              Add Schedule
            </Button>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <Table hoverable>
              <TableHead>
                <TableRow>
                  <TableHeadCell
                      onClick={() => handleScheduleSorting("schedule_name")}
                  >
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

                  <TableHeadCell
                      onClick={() => handleScheduleSorting("created_at")}
                  >
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

              <TableBody>
                {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center">
                        <Spinner size="lg" />
                        <span className="ml-2 text-gray-500">
                      Loading schedules...
                    </span>
                      </TableCell>
                    </TableRow>
                ) : records.length === 0 ? (
                    <TableRow>
                      <TableCell
                          colSpan={4}
                          className="py-8 text-center text-gray-500"
                      >
                        No schedule records found.
                      </TableCell>
                    </TableRow>
                ) : (
                    records.map((item) => (
                        <TableRow
                            key={item.schedule_id}
                            className="cursor-pointer dark:border-gray-700 dark:bg-gray-800"
                        >
                          <TableCell className="font-medium text-gray-900 dark:text-white">
                            {item.schedule_name || "N/A"}
                          </TableCell>
                          <TableCell className="text-gray-500">
                            {item.generation_config?.description ||
                                "No description provided."}
                          </TableCell>
                          <TableCell className="text-gray-500">
                            {item.created_at
                                ? new Date(item.created_at).toLocaleString()
                                : "N/A"}
                          </TableCell>
                          <TableCell>
                            <HiChevronRight className="h-5 w-5 cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400" />
                          </TableCell>
                        </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-center pt-4">
            <Pagination
                currentPage={currentSchedulePage}
                totalPages={Math.ceil(records.length / maxRowSchedule) || 1}
                onPageChange={onPageChangeSchedule}
                showIcons
            />
          </div>
        </div>

        {/* --- ADD MODAL (Multi-step wizard) --- */}
        <Modal show={openAddModal} onClose={handleCloseModals}>
          <ModalHeader>
            {addStep === "selection" ? "Add New Schedule - Choose Mode" : creationMode === "auto" ? "Auto Assign / Generation Setup" : "Use Template Setup"}
          </ModalHeader>
          <ModalBody>
            {addStep === "selection" ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Please select how you would like to generate or create this schedule:
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer dark:border-gray-700">
                      <Radio
                          id="mode-auto"
                          name="creationMode"
                          value="auto"
                          checked={creationMode === "auto"}
                          onChange={() => setCreationMode("auto")}
                      />
                      <Label htmlFor="mode-auto" className="cursor-pointer">
                        <span className="font-semibold block">Auto Assign / Generation</span>
                        <span className="text-xs text-gray-500">Automatically map and generate time slots based on system rules and constraints.</span>
                      </Label>
                    </div>

                    <div className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer dark:border-gray-700">
                      <Radio
                          id="mode-template"
                          name="creationMode"
                          value="template"
                          checked={creationMode === "template"}
                          onChange={() => setCreationMode("template")}
                      />
                      <Label htmlFor="mode-template" className="cursor-pointer">
                        <span className="font-semibold block">Use Template</span>
                        <span className="text-xs text-gray-500">Create a schedule by selecting and applying a pre-existing template.</span>
                      </Label>
                    </div>
                  </div>
                </div>
            ) : creationMode === "auto" ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="auto-config">Auto-Generation Rules / Parameters</Label>
                    <Textarea
                        id="auto-config"
                        rows={4}
                        placeholder="Specify generation parameters, rules, or target criteria..."
                        value={autoGenerationConfig}
                        onChange={(e) => setAutoGenerationConfig(e.target.value)}
                    />
                    <HelperText>The system will use these parameters to build the schedule automatically.</HelperText>
                  </div>
                </div>
            ) : (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="template-select">Select Template *</Label>
                    <Select
                        id="template-select"
                        value={selectedTemplate}
                        onChange={(e) => setSelectedTemplate(e.target.value)}
                    >
                      <option value="" disabled>
                        -- Choose a template --
                      </option>
                      <option value="standard-shs">Standard Senior High School Template</option>
                      <option value="stem-track">STEM Track Master Template</option>
                      <option value="abm-track">ABM Track Master Template</option>
                    </Select>
                  </div>

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
                        rows={3}
                        placeholder="Enter description for this schedule..."
                        value={addDescription}
                        onChange={handleAddDescriptionChange}
                    />
                  </div>
                </div>
            )}
          </ModalBody>
          <ModalFooter>
            {addStep === "selection" ? (
                <>
                  <Button onClick={() => setAddStep("form")}>
                    Next
                  </Button>
                  <Button color="gray" onClick={handleCloseModals}>
                    Cancel
                  </Button>
                </>
            ) : (
                <>
                  <Button color="gray" onClick={() => setAddStep("selection")}>
                    Back
                  </Button>
                  <Button disabled={isAddFormInvalid} onClick={handleScheduleSubmit}>
                    Save Schedule
                  </Button>
                  <Button color="gray" onClick={handleCloseModals}>
                    Cancel
                  </Button>
                </>
            )}
          </ModalFooter>
        </Modal>
      </>
  );
}