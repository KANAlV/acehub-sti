"use client";

import {
  fetchDepartments,
  fetchScheduleByName,
  fetchScheduleTeacherMetricsComputation,
  fetchScheduleTeacherMetricsCount,
  fetchScheduleTeacherMetricsTable,
  TeacherMetricRow,
  TeacherStatusFilter,
} from "@/app/actions/system";
import React, { useEffect, useState } from "react";
import {
  Button,
  Card,
  Modal,
  ModalBody,
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
} from "flowbite-react";
import {
  HiCheck,
  HiChevronRight,
  HiOutlineExclamationCircle,
} from "react-icons/hi2";
import {
  HiArrowLeft,
  HiExclamation,
  HiOutlineExternalLink,
  HiSearch,
  HiX,
} from "react-icons/hi";
import { useRouter } from "next/navigation";
import { FaSortDown, FaSortUp } from "react-icons/fa6";
import { DepartmentRecord } from "@/components/teachers/TeachersManagement";

interface ScheduleSummaryProps {
  scheduleName: string;
}

export default function SchedulesTeachersTable({
  scheduleName,
}: ScheduleSummaryProps) {
  const router = useRouter();
  const { computedMode } = useThemeMode();
  const isDarkMode = computedMode === "dark";

  // --- Page Loading Constants ---
  const [isLoading, setIsLoading] = useState(true);
  const [isTableLoading, setIsTableLoading] = useState(true);
  const [scheduleExists, setScheduleExists] = useState(false);
  const [scheduleID, setScheduleID] = useState<string | null>(null);

  // --- Display Constants ---
  const [overloadedCount, setOverloadedCount] = useState<number | null>(null);
  const [onLeaveCount, setOnLeaveCount] = useState<number | null>(null);
  const [total_teachers, setTotal_teachers] = useState<number | null>(null);
  const [active_count, setActive_count] = useState<number | null>(null);

  // --- Table Constants ---
  const [teachers, setTeachers] = useState<TeacherMetricRow[]>([]);
  const [teachersCount, setTeachersCount] = useState(0);
  const [sortTeachersBy, setSortTeachersBy] = useState("surname");
  const [sortTeachersDir, setSortTeachersDir] = useState("ASC");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<TeacherStatusFilter>(
    "All Active & On Leave",
  );
  const [allDepartments, setAllDepartments] = useState<string[]>([]);
  const [departmentFilter, setDepartmentFilter] =
    useState<string>("All Departments");

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

  // --- Data Fetching ---
  async function fetchScheduleData() {
    setIsLoading(true);
    const res = await fetchScheduleByName(scheduleName);

    if (res.success && res.data) {
      setScheduleExists(true);
      setScheduleID(res.data.schedule_id);
    } else {
      setScheduleExists(false);
    }
    setIsLoading(false);
  }

  async function fetchScheduleTeacherMetrics() {
    const res = await fetchScheduleTeacherMetricsComputation(scheduleID!);

    if (res.success && res.data) {
      setOverloadedCount(res.data.overloaded);
      setOnLeaveCount(res.data.on_leave_count);
      setTotal_teachers(res.data.total_teachers);
      setActive_count(res.data.active_count);
    } else {
    }
  }

  async function loadAllDepartments() {
    // Fixed: pass a valid limit (e.g. 100) and 0 offset to load all departments properly
    const response = await fetchDepartments("", "dept_name", "ASC", 100, 0);
    if (response?.success && response.data) {
      const names = (response.data as DepartmentRecord[]).map(
        (d) => d.dept_name,
      );
      setAllDepartments(names);
    }
  }

  async function getTeachers(
    search: string | null = searchTerm,
    status: TeacherStatusFilter = statusFilter,
    department: string = departmentFilter,
    sortby: string = sortTeachersBy,
    sortdir: string = sortTeachersDir,
    limit: number = maxRowTeacher,
    page: number = currentTeacherPage,
  ) {
    setIsTableLoading(true);

    // Fixed: properly compute zero-indexed SQL offset ((page - 1) * limit)
    const calculatedOffset = Math.max(0, (page - 1) * limit);

    const params = {
      scheduleId: scheduleID!,
      search: search,
      status: status,
      department: department,
      sortBy: sortby,
      sortDir: sortdir,
      limit: limit,
      offset: calculatedOffset,
    };

    const response = await fetchScheduleTeacherMetricsTable(params);

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

    setIsTableLoading(false);
    await getTeacherCount(search, status, department);
  }

  async function getTeacherCount(
    search: string | null = searchTerm,
    status: TeacherStatusFilter = statusFilter,
    department: string = departmentFilter,
  ) {
    const params = {
      scheduleId: scheduleID!,
      search: search,
      status: status,
      department: department,
    };

    const response = await fetchScheduleTeacherMetricsCount(params);

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
  }

  // --- Use Effects ---
  useEffect(() => {
    void loadAllDepartments();
    void fetchScheduleData();
  }, [scheduleName]);

  useEffect(() => {
    if (scheduleID !== null) {
      void fetchScheduleTeacherMetrics();
      void getTeachers();
    }
  }, [scheduleID]);

  useEffect(() => {
    if (searchTerm.length > 2 || searchTerm.length === 0) {
      void getTeachers();
    }
  }, [searchTerm]);

  // --- UI FUNCTIONS ---
  function getCapacityTextColor(current: number | null, max: number | null) {
    if (current == null || max == null) {
      return "text-gray-500 dark:text-gray-400";
    }

    if (current >= max) {
      return "text-red-500 dark:text-red-400";
    }

    const ratio = current / max;
    if (ratio >= 0.8) {
      return "text-yellow-500 dark:text-yellow-400";
    }

    return "text-emerald-500 dark:text-emerald-400";
  }

  // --- TABLE FILTER FUNCTIONS ---
  const handleDepartmentFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const selectedDept = e.target.value;
    setDepartmentFilter(selectedDept);
    setCurrentTeacherPage(1);
    void getTeachers(
      searchTerm,
      statusFilter,
      selectedDept,
      sortTeachersBy,
      sortTeachersDir,
      maxRowTeacher,
      1,
    );
  };

  const handleStatusFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const selectedStatus = e.target.value as TeacherStatusFilter;
    setStatusFilter(selectedStatus);
    setCurrentTeacherPage(1);
    void getTeachers(
      searchTerm,
      selectedStatus,
      departmentFilter,
      sortTeachersBy,
      sortTeachersDir,
      maxRowTeacher,
      1,
    );
  };

  function handleTeacherSorting(sortBy: string) {
    const newDir =
      sortBy === sortTeachersBy && sortTeachersDir === "ASC" ? "DESC" : "ASC";
    setSortTeachersBy(sortBy);
    setSortTeachersDir(newDir);
    setTeachers([]);
    setCurrentTeacherPage(1);
    void getTeachers(
      searchTerm,
      statusFilter,
      departmentFilter,
      sortBy,
      newDir,
      maxRowTeacher,
      1,
    );
  }

  // --- TABLE SEARCH ---
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentTeacherPage(1);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setCurrentTeacherPage(1);
  };

  // --- PAGINATION ---
  function onPageChangeTeachers(page: number) {
    if (pageChangingTeachers) return;

    setPageChangingTeachers(true);
    setTeachers([]);

    void getTeachers(
      searchTerm,
      statusFilter,
      departmentFilter,
      sortTeachersBy,
      sortTeachersDir,
      maxRowTeacher,
      page,
    );

    setPageChangingTeachers(false);
    setCurrentTeacherPage(page);
  }

  // --- TOAST FUNCTIONS ---
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

  return (
    <>
      {/* Top Action Bar */}
      <div className="mb-4 flex items-center justify-between">
        <button
          className="flex items-center text-xs text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          onClick={() => router.push(`/schedules/${scheduleName}`)}
        >
          <HiArrowLeft className="mr-1.5 h-4 w-4" /> Back to Schedule Summary
        </button>
        <div className="flex items-center gap-3">
          {/* TODO: Add Export Teacher Schedule function */}
          <Button
            color="blue"
            size="sm"
            className="bg-cyan-600 text-white hover:bg-cyan-700"
          >
            <HiOutlineExternalLink className="mr-1.5 h-4 w-4" />
            Export Teacher Schedule
          </Button>
        </div>
      </div>

      {/* Teacher Workload Summary Banner */}
      <div className="mb-4 grid grid-cols-2 gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:grid-cols-5 dark:border-gray-800 dark:bg-gray-800">
        <div className={"col-span-2 border-gray-400 md:col-span-1 md:border-r"}>
          <p className="mb-1 text-[11px] font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
            Schedule Name
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {scheduleName}
          </p>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
            Total Teachers
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {total_teachers ?? "0"}
          </p>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
            Active in Schedule
          </p>
          <p
            className={`text-2xl font-bold ${getCapacityTextColor(active_count ?? null, total_teachers ?? null)} `}
          >
            {active_count !== null ? active_count : <Spinner size="sm" />}
          </p>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
            Overloaded
          </p>
          <p
            className={`text-2xl font-bold ${overloadedCount === null || overloadedCount === 0 ? "text-gray-600 dark:text-gray-500" : "text-red-600 dark:text-red-500"}`}
          >
            {overloadedCount !== null ? overloadedCount : <Spinner size="sm" />}
          </p>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
            On Leave
          </p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {onLeaveCount !== null ? onLeaveCount : <Spinner size="sm" />}
          </p>
        </div>
      </div>

      {/* Table Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3 md:justify-end">
        {/* Department Dropdown Filter */}
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

        {/* Status Dropdown Filter */}
        <div className="w-full md:w-52">
          <Select
            id="status-filter"
            value={statusFilter}
            onChange={handleStatusFilterChange}
          >
            <option value="All Active & On Leave">All Active & On Leave</option>
            <option value="Active">Active</option>
            <option value="On Leave">On Leave</option>
          </Select>
        </div>

        {/* Search Bar */}
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
          <span
            className={`${searchTerm.length > 0 && searchTerm.length < 3 ? null : "hidden"}
              absolute inset-y-0 left-0 -mt-2 px-1 ml-2 h-4 block text-[11px] text-gray-400 dark:text-gray-500
              bg-white dark:bg-gray-900
            `}
          >
            Type at least 3 characters to search
          </span>
        </div>
      </div>

      {scheduleID !== null && (
        <>
          {/* Table Section */}
          <Card className="overflow-x-auto">
            <Table hoverable>
              <TableHead>
                <TableRow>
                  <TableHeadCell onClick={() => handleTeacherSorting("code")}>
                    <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                      Code
                      {sortTeachersBy === "code" &&
                        (sortTeachersDir === "ASC" ? (
                          <FaSortUp className="ml-1" />
                        ) : (
                          <FaSortDown className="ml-1" />
                        ))}
                    </div>
                  </TableHeadCell>

                  <TableHeadCell onClick={() => handleTeacherSorting("name")}>
                    <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                      Instructor Name
                      {sortTeachersBy === "name" &&
                        (sortTeachersDir === "ASC" ? (
                          <FaSortUp className="ml-1" />
                        ) : (
                          <FaSortDown className="ml-1" />
                        ))}
                    </div>
                  </TableHeadCell>

                  <TableHeadCell
                    onClick={() => handleTeacherSorting("id_number")}
                  >
                    <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                      ID Number
                      {sortTeachersBy === "id_number" &&
                        (sortTeachersDir === "ASC" ? (
                          <FaSortUp className="ml-1" />
                        ) : (
                          <FaSortDown className="ml-1" />
                        ))}
                    </div>
                  </TableHeadCell>

                  <TableHeadCell
                    onClick={() => handleTeacherSorting("department")}
                  >
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

                  <TableHeadCell
                    onClick={() => handleTeacherSorting("current_units")}
                  >
                    <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                      Units (Current / Max)
                      {sortTeachersBy === "current_units" &&
                        (sortTeachersDir === "ASC" ? (
                          <FaSortUp className="ml-1" />
                        ) : (
                          <FaSortDown className="ml-1" />
                        ))}
                    </div>
                  </TableHeadCell>

                  <TableHeadCell
                    onClick={() => handleTeacherSorting("available")}
                  >
                    <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                      Available
                      {sortTeachersBy === "available" &&
                        (sortTeachersDir === "ASC" ? (
                          <FaSortUp className="ml-1" />
                        ) : (
                          <FaSortDown className="ml-1" />
                        ))}
                    </div>
                  </TableHeadCell>

                  <TableHeadCell
                    onClick={() => handleTeacherSorting("utilization")}
                  >
                    <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                      Utilization
                      {sortTeachersBy === "utilization" &&
                        (sortTeachersDir === "ASC" ? (
                          <FaSortUp className="ml-1" />
                        ) : (
                          <FaSortDown className="ml-1" />
                        ))}
                    </div>
                  </TableHeadCell>
                  <TableHeadCell />
                </TableRow>
              </TableHead>

              <TableBody className="divide-y">
                {teachers.length > 0 ? (
                  teachers.map((item: TeacherMetricRow) => {
                    const isDeptValid =
                      !item.department ||
                      allDepartments.some(
                        (dept) =>
                          dept.toLowerCase() ===
                          item.department?.trim().toLowerCase(),
                      );

                    const isOverloaded = item.current_units >= item.max_units;
                    const isNearCapacity = item.utilization >= 80;

                    return (
                      <TableRow
                        key={item.teacher_id}
                        onClick={() =>
                          router.push(
                            `/schedules/${scheduleName}/teachers/${item.id_number}`,
                          )
                        }
                        className="bg-white dark:border-gray-700 dark:bg-gray-800"
                      >
                        {/* Code */}
                        <TableCell className="font-mono text-sm">
                          {item.code || "—"}
                        </TableCell>

                        {/* Instructor Name */}
                        <TableCell className="font-medium whitespace-nowrap text-gray-900 dark:text-white">
                          {item.name || "—"}
                        </TableCell>

                        {/* ID Number */}
                        <TableCell className="font-mono text-sm text-gray-500 dark:text-gray-400">
                          {item.id_number || "—"}
                        </TableCell>

                        {/* Department */}
                        <TableCell>
                          {!isDeptValid ? (
                            <Tooltip
                              className="border-2 border-gray-900 bg-white text-gray-500 dark:border-white dark:bg-gray-800 dark:text-gray-300"
                              placement="right"
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

                        {/* Status */}
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

                        {/* Units (Current / Max) */}
                        <TableCell
                          className={`font-mono text-sm font-semibold ${
                            isOverloaded
                              ? "text-red-600 dark:text-red-400"
                              : isNearCapacity
                                ? "text-yellow-500 dark:text-yellow-400"
                                : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {item.current_units?.toFixed(1)} / {item.max_units}
                          {item.absolute_max && (
                            <span className="ml-1 text-xs font-normal text-gray-400">
                              (Abs Max: {item.absolute_max})
                            </span>
                          )}
                        </TableCell>

                        {/* Available */}
                        <TableCell className="font-mono text-sm text-emerald-600 dark:text-emerald-400">
                          +{item.available?.toFixed(1)}
                        </TableCell>

                        {/* Utilization */}
                        <TableCell className="font-mono text-sm font-medium">
                          <span
                            className={
                              isOverloaded
                                ? "text-red-600 dark:text-red-400"
                                : isNearCapacity
                                  ? "text-yellow-500 dark:text-yellow-400"
                                  : "text-emerald-600 dark:text-emerald-400"
                            }
                          >
                            {item.utilization?.toFixed(1)}%
                          </span>
                        </TableCell>

                        <TableCell>
                          <HiChevronRight />
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : isLoading ? (
                  <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <TableCell
                      colSpan={9}
                      className="py-6 text-center text-sm text-gray-500 italic dark:text-gray-400"
                    >
                      <div className="flex items-center justify-center">
                        <Spinner />
                        <span className="ml-4">
                          Fetching faculty metrics data...
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <TableCell
                      colSpan={9}
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
        </>
      )}

      {/* Page Does Not Exist Modal */}
      <Modal
        show={!scheduleExists && !isLoading}
        size="md"
        onClose={() => {}}
        popup
      >
        <ModalHeader />
        <ModalBody>
          <div className="text-center">
            <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-red-400 dark:text-red-500" />
            <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">
              Schedule Not Found
            </h3>
            <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
              The schedule <span className="font-semibold">{scheduleName}</span>{" "}
              does not exist or may have been deleted.
            </p>
            <div className="flex justify-center">
              <button
                className="flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                onClick={() => router.push("/schedules")}
              >
                <HiArrowLeft className="mr-1.5 h-4 w-4" /> Back to Schedules
              </button>
            </div>
          </div>
        </ModalBody>
      </Modal>

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
    </>
  );
}
