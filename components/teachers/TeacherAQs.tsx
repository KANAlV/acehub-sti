"use client";

import {
  Accordion,
  AccordionContent,
  AccordionPanel,
  AccordionTitle,
  Badge,
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
  Tooltip,
} from "flowbite-react";
import { useEffect, useRef, useState } from "react";
import {
  FaFilePdf,
  FaGraduationCap,
  FaPlus,
  FaSortDown,
  FaSortUp,
} from "react-icons/fa6";
import {
  HiCheck,
  HiExclamation,
  HiEye,
  HiLockClosed,
  HiRefresh,
  HiSearch,
  HiX,
} from "react-icons/hi";
import { IoRefresh } from "react-icons/io5";
import {
  AQRecord,
  createTeacherAQ,
  fetchTeacherAQRecords,
  fetchTeachers,
  fetchMaq,
  MaqRecord,
  TeacherRecord,
  updateTeacherAQ,
  JSONValue,
} from "@/app/actions/system";

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
  const [aqSearchResults, setAqSearchResults] = useState<string[]>([]);
  const [selectedAQOption, setSelectedAQOption] = useState("");
  const [initialStatus, setInitialStatus] = useState("Pending");
  const [isAQLocked, setIsAQLocked] = useState(false);
  const [isSearchingAqs, setIsSearchingAqs] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [aqSubmitError, setAqSubmitError] = useState("");
  const [isSubmittingAQ, setIsSubmittingAQ] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // --- Pagination --- //
  const limit = 10;
  const [currentPage, setCurrentPage] = useState(1);

  // --- Toast Constants --- //
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [toastMessage, setToastMessage] = useState("");
  const [progress, setProgress] = useState(0);

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
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  useEffect(() => {
    void loadData(currentPage, employmentFilter);
  }, [currentPage, departmentFilter, sortBy, sortDir]);

  const handleAQSearch = async (query: string) => {
    setIsSearchingAqs(true);
    setAqSubmitError("");

    try {
      const res = await fetchMaq(query || undefined, "aq", "ASC", 0);
      if (res?.success && res.data) {
        const results = res.data.map((item: MaqRecord) => item.aq);
        setAqSearchResults(results);
      } else {
        setAqSearchResults([]);
      }
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
      setInitialStatus("Pending");
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
    }, 300);

    return () => clearTimeout(delayDebounce);
  };

  const handleSelectAQ = (aq: string) => {
    setSelectedAQOption(aq);
    setAqSearchQuery(aq);
    setIsAQLocked(true);
    setShowSuggestions(false);
    setAqSubmitError("");
  };

  const handleUnlockAQ = () => {
    setIsAQLocked(false);
    setSelectedAQOption("");
    setShowSuggestions(true);
  };

  const getTeacherAQs = (pscsId?: string | null) => {
    if (!pscsId) return [];
    return aqRecords.filter((rec) => rec.pscs_id === pscsId);
  };

  const getAQStatusCounts = (pscsId?: string | null) => {
    const list = getTeacherAQs(pscsId);
    let approved = 0;
    let pending = 0;
    let request = 0;
    let denied = 0;

    list.forEach((rec) => {
      const status = (rec.approved || "").toLowerCase();
      if (status === "approved") {
        approved++;
      } else if (status === "pending") {
        pending++;
      } else if (status === "denied") {
        denied++;
      } else {
        request++;
      }
    });

    return { approved, pending, request, denied };
  };

  const renderStatusBadge = (status?: string) => {
    switch ((status || "").toLowerCase()) {
      case "approved":
        return <Badge color="success">Approved</Badge>;
      case "pending":
        return <Badge color="warning">Pending</Badge>;
      case "denied":
        return <Badge color="failure">Denied</Badge>;
      case "request":
      default:
        return <Badge color="gray">Request</Badge>;
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

  const handleAddAQSubmit = async () => {
    if (!selectedAQOption || selectedAQOption.trim() === "") {
      setAqSubmitError(
        "Please search and select a valid Academic Qualification from the list.",
      );
      return;
    }

    if (!aqSearchResults.includes(selectedAQOption)) {
      setAqSubmitError(
        "Selected Academic Qualification does not exist in system records.",
      );
      return;
    }

    if (!selectedTeacher?.pscs_id) {
      setAqSubmitError("Selected teacher is missing a valid PSCS ID.");
      return;
    }

    setIsSubmittingAQ(true);
    setAqSubmitError("");

    const customAqCode = `AQ-${Date.now()}`;

    const aqContents: Record<string, JSONValue> = {
      custom_aq_id: customAqCode,
    };

    try {
      const res = await createTeacherAQ(
        selectedTeacher.pscs_id,
        selectedAQOption,
        aqContents,
        initialStatus,
      );

      if (res?.success) {
        triggerToast("success", "Academic Qualification added successfully!");

        await loadData(currentPage, employmentFilter);

        closeAqAddModal();
      } else {
        setAqSubmitError(res?.error || "Failed to add Academic Qualification.");
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

  const totalPages = Math.ceil(teachersCount / limit) || 1;

  function closeAqAddModal() {
    setIsAddAQOpen(false);
    setSelectedAQOption("");
    setAqSearchQuery("");
    setIsAQLocked(false);
  }

  return (
    <div className="space-y-6">
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
              className="-mx-1.5 -my-1.5 ml-auto inline-flex h-8 w-8 rounded-lg bg-white p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-900 focus:ring-2 focus:ring-gray-300 dark:bg-gray-800 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-white"
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

          <Card className={"mt-4"}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex w-full flex-wrap items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <TextInput
                    id="searchTeacher"
                    type="text"
                    placeholder="Search teachers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    icon={HiSearch}
                  />
                </div>

                <div className="w-full shrink-0 sm:w-56">
                  <Select
                    id="employment-filter"
                    value={employmentFilter}
                    onChange={(e) => {
                      const selectedVal = e.target.value;
                      setEmploymentFilter(selectedVal);
                      setCurrentPage(1);
                      void loadData(1, selectedVal);
                    }}
                    className="w-full"
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
              </div>
            </div>

            <div className="overflow-x-auto">
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
                          <span>AQ Breakdown</span>
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
                        const { approved, pending, request, denied } =
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

                            <TableCell>
                              <div className="flex items-center space-x-1.5 text-sm font-semibold">
                                <Tooltip
                                  content={
                                    <span className="font-bold text-green-400">
                                      AQ Approved: {approved}
                                    </span>
                                  }
                                >
                                  <span className="cursor-pointer text-green-500 hover:underline dark:text-green-400">
                                    {approved}
                                  </span>
                                </Tooltip>
                                <span className="text-gray-400 dark:text-gray-500">
                                  |
                                </span>
                                <Tooltip
                                  content={
                                    <span className="font-bold text-yellow-400">
                                      AQ Pending: {pending}
                                    </span>
                                  }
                                >
                                  <span className="cursor-pointer text-yellow-500 hover:underline dark:text-yellow-400">
                                    {pending}
                                  </span>
                                </Tooltip>
                                <span className="text-gray-400 dark:text-gray-500">
                                  |
                                </span>
                                <Tooltip
                                  content={
                                    <span className="font-bold text-gray-300">
                                      AQ Requested: {request}
                                    </span>
                                  }
                                >
                                  <span className="cursor-pointer text-gray-500 hover:underline dark:text-gray-300">
                                    {request}
                                  </span>
                                </Tooltip>
                                <span className="text-gray-400 dark:text-gray-500">
                                  |
                                </span>
                                <Tooltip
                                  content={
                                    <span className="font-bold text-red-400">
                                      AQ Denied: {denied}
                                    </span>
                                  }
                                >
                                  <span className="cursor-pointer text-red-500 hover:underline dark:text-red-400">
                                    {denied}
                                  </span>
                                </Tooltip>
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

            <div className="flex items-center justify-between pt-4">
              <span className="text-sm text-gray-500">
                Showing {filteredTeachers.length} of {teachersCount} Teachers
              </span>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(p) => setCurrentPage(p)}
                showIcons
              />
            </div>
          </Card>
        </div>

        {/* Side Panel Inspector */}
        {selectedTeacher && (
          <div className="lg:col-span-5">
            <Card className="sticky top-6">
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
                    onClick={() => {
                      setIsAddAQOpen(true);
                    }}
                    className="flex items-center gap-1"
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
                    <Accordion
                      collapseAll
                      className="divide-y divide-gray-200 border-none dark:divide-gray-700"
                    >
                      {teacherAqs.map((record) => {
                        const fileKey =
                          typeof record.contents?.bucket_key === "string"
                            ? record.contents.bucket_key
                            : undefined;
                        const fileName =
                          typeof record.contents?.file_name === "string"
                            ? record.contents.file_name
                            : "AQ_Certificate.pdf";
                        const status = (
                          record.approved || "Pending"
                        ).toLowerCase();

                        return (
                          <AccordionPanel key={record.aq_id}>
                            <AccordionTitle className="rounded-lg px-3 py-3 hover:bg-gray-100 dark:hover:bg-gray-800">
                              <div className="mr-2 flex w-full items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <FaGraduationCap className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {record.aq}
                                  </span>
                                </div>
                                <div className="ml-auto">
                                  {renderStatusBadge(record.approved)}
                                </div>
                              </div>
                            </AccordionTitle>

                            <AccordionContent className="rounded-b-lg border-t border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between rounded border border-gray-200 bg-white p-2.5 dark:border-gray-600 dark:bg-gray-700">
                                  <div className="flex items-center space-x-2 truncate">
                                    <FaFilePdf className="h-4 w-4 shrink-0 text-red-500" />
                                    <span className="truncate text-xs font-medium text-gray-700 dark:text-gray-200">
                                      {fileKey ? fileName : "No file attached"}
                                    </span>
                                  </div>

                                  {fileKey ? (
                                    <Tooltip content="View Document in S3 Bucket">
                                      <a
                                        href={`/api/bucket/download?key=${encodeURIComponent(fileKey)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center space-x-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                                      >
                                        <HiEye className="h-4 w-4" />
                                        <span>View</span>
                                      </a>
                                    </Tooltip>
                                  ) : (
                                    <span className="text-xs text-gray-400 italic">
                                      Unattached
                                    </span>
                                  )}
                                </div>

                                {/* Status Actions */}
                                {status !== "approved" && (
                                  <div className="flex items-center justify-between pt-1">
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                      Status Action:
                                    </span>

                                    {(status === "pending" ||
                                      status === "request") && (
                                      <div className="flex items-center gap-2">
                                        <Button
                                          size="xs"
                                          color="success"
                                          onClick={() =>
                                            handleStatusChange(
                                              record,
                                              "Approved",
                                            )
                                          }
                                          className="flex items-center gap-1"
                                        >
                                          <HiCheck className="h-3.5 w-3.5" />
                                          <span>Approve</span>
                                        </Button>
                                        <Button
                                          size="xs"
                                          color="failure"
                                          onClick={() =>
                                            handleStatusChange(record, "Denied")
                                          }
                                          className="flex items-center gap-1"
                                        >
                                          <HiX className="h-3.5 w-3.5" />
                                          <span>Deny</span>
                                        </Button>
                                      </div>
                                    )}

                                    {status === "denied" && (
                                      <Tooltip content="Request resubmission from teacher">
                                        <Button
                                          size="xs"
                                          color="warning"
                                          onClick={() =>
                                            handleStatusChange(
                                              record,
                                              "Pending",
                                            )
                                          }
                                          className="flex items-center gap-1"
                                        >
                                          <IoRefresh className="h-4 w-4" />
                                          <span>Request Resubmission</span>
                                        </Button>
                                      </Tooltip>
                                    )}
                                  </div>
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionPanel>
                        );
                      })}
                    </Accordion>
                  );
                })()}
              </div>
            </Card>
          </div>
        )}
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
              <span className={"text-md font-bold"}>
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
                    className="absolute top-2.5 right-2 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-white"
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
                    <ul className="py-1 text-sm text-gray-700 dark:text-gray-200">
                      {aqSearchResults.map((aq, idx) => (
                        <li
                          key={`${aq}-${idx}`}
                          onClick={() => handleSelectAQ(aq)}
                          className="cursor-pointer px-4 py-2 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-gray-700 dark:hover:text-blue-400"
                        >
                          <span className="font-medium">{aq}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-4 text-center text-xs text-gray-500">
                      No matching qualifications found.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Status Selection Dropdown */}
            <div>
              <div className="mb-2 block">
                <Label htmlFor="aq-status-select">AQ Status</Label>
              </div>
              <Select
                id="aq-status-select"
                value={initialStatus}
                onChange={(e) => setInitialStatus(e.target.value)}
              >
                <option value="Approved">Approved</option>
                <option value="Request">Requested</option>
              </Select>
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
          <Button color="gray" onClick={() => closeAqAddModal()}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
