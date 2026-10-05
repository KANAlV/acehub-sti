"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useTransition,
} from "react";
import {
  Table,
  TableHead,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  Button,
  TextInput,
  Select,
  Pagination,
  Spinner,
  Toast,
  ToastToggle,
  Progress,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Card,
} from "flowbite-react";
import { HiSearch, HiX, HiCheck, HiExclamation } from "react-icons/hi";
import { FaSortUp, FaSortDown } from "react-icons/fa";
import { useMsal } from "@azure/msal-react";

// Import fetch actions and types from system actions
import {
  fetchTeachersWithPreassignment,
  fetchTeachersCountWithPreassignment,
  TeacherPreassignmentSummaryRecord,
  fetchFacultyLoadConfig,
  Configuration,
  fetchDepartments,
} from "@/app/actions/system";
import { DepartmentRecord } from "@/components/teachers/TeachersManagement";
import { HiCog6Tooth } from "react-icons/hi2";

interface TeacherPreassignmentManagementProps {
  preassignmentName?: string | null;
}

export default function TeacherPreassignmentManagement({
  preassignmentName = null,
}: TeacherPreassignmentManagementProps) {
  // --- MSAL Auth State for Actor/Logging if needed ---
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];

  // --- Data State ---
  const [teachers, setTeachers] = useState<TeacherPreassignmentSummaryRecord[]>(
    [],
  );
  const [config, setConfig] = useState<Configuration | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();

  // --- Department State --- //
  const [allDepartments, setAllDepartments] = useState<string[]>([]);

  // --- Search & Filter State ---
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>(
    "All Active & On Leave",
  );
  const [departmentFilter, setDepartmentFilter] =
    useState<string>("All Departments");

  // --- Pagination & Sorting State ---
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [maxRow] = useState<number>(10);
  const [sortBy, setSortBy] = useState<string>("surname");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("ASC");
  const [totalCount, setTotalCount] = useState<number>(0);

  // --- Form State ---
  const [selectedTeacherID, setSelectedTeacherID] = useState("");
  const [selectedTeacherName, setSelectedTeacherName] = useState("");

  // --- Toast State & Timer Ref ---
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [toastType, setToastType] = useState<"success" | "warning" | "error">(
    "success",
  );
  const [progress, setProgress] = useState<number>(100);
  const [showToastTimer, setShowToastTimer] = useState<boolean>(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const closeToast = useCallback(() => {
    setShowToast(false);
    setProgress(100);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const triggerToast = useCallback(
    (
      msg: string,
      type: "success" | "warning" | "error" = "success",
      durationMs: number = 4000,
    ) => {
      closeToast();
      setToastMessage(msg);
      setToastType(type);
      setShowToast(true);

      if (type === "error") {
        setShowToastTimer(false);
        return;
      }

      setShowToastTimer(true);
      setProgress(100);

      const intervalMs = 50;
      const step = (intervalMs / durationMs) * 100;

      timerRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev <= step) {
            closeToast();
            return 0;
          }
          return prev - step;
        });
      }, intervalMs);
    },
    [closeToast],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Load Configuration Data
  const loadConfig = useCallback(async () => {
    const res = await fetchFacultyLoadConfig();
    if (res.success && res.data && res.data.length > 0) {
      // Assuming we take the first active or relevant configuration record
      setConfig(res.data[0]);
    }
  }, []);

  // Load Table Data and Count
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setTeachers([]);

    const [resData, countRes] = await Promise.all([
      fetchTeachersWithPreassignment(
        preassignmentName,
        debouncedSearch,
        statusFilter,
        departmentFilter,
        sortBy,
        sortDir,
        maxRow,
        currentPage,
      ),
      fetchTeachersCountWithPreassignment(
        preassignmentName,
        debouncedSearch,
        statusFilter,
        departmentFilter,
      ),
      loadConfig(),
    ]);

    if (resData.success && resData.data) {
      setTeachers(resData.data);
    } else {
      triggerToast(
        resData.error || "Failed to load teachers with pre-assignment metrics.",
        "error",
      );
    }

    if (countRes.success) {
      setTotalCount(countRes.count);
    }

    setIsLoading(false);
  }, [
    preassignmentName,
    debouncedSearch,
    statusFilter,
    departmentFilter,
    sortBy,
    sortDir,
    maxRow,
    currentPage,
    triggerToast,
    loadConfig,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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

  // Sorting Handler
  const handleSorting = (column: string) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === "ASC" ? "DESC" : "ASC"));
    } else {
      setSortBy(column);
      setSortDir("ASC");
    }
  };

  // Helper to map employment type to config limits keys
  const getLimitsForTeacher = (employmentType: string) => {
    const normalized = employmentType?.toLowerCase() || "";
    if (
      normalized.includes("part-time full load") ||
      normalized.includes("part_time_full_load")
    ) {
      return {
        prepLimit: config?.prep_limits?.part_time_full_load ?? 0,
        facultyLoadLimit: config?.faculty_load?.part_time_full_load ?? 0,
      };
    } else if (normalized.includes("part")) {
      return {
        prepLimit: config?.prep_limits?.part_time ?? 0,
        facultyLoadLimit: config?.faculty_load?.part_time ?? 0,
      };
    } else {
      // Default / Full Time
      return {
        prepLimit: config?.prep_limits?.full_time ?? 0,
        facultyLoadLimit: config?.faculty_load?.full_time ?? 0,
      };
    }
  };

  const totalPages = Math.ceil(totalCount / maxRow) || 1;

  return (
    <div className={"flex"}>
      <div className="space-y-4 p-4">
        {/* Page Header & Actions Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Teachers Pre-assignment Summary
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {preassignmentName ? (
                <>
                  Viewing pre-assignment metrics for template:{" "}
                  <b className="font-bold text-black dark:text-white">
                    {preassignmentName}
                  </b>
                </>
              ) : (
                "Overview of teacher teaching loads, subjects count, and pre-assignment status."
              )}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Search Input */}
            <div className="w-full sm:w-64">
              <TextInput
                id="search-teachers"
                type="text"
                placeholder="Search teachers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                icon={HiSearch}
              />
            </div>

            {/* Status Filter */}
            <div className="w-full sm:w-48">
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="All Active & On Leave">
                  All Active & On Leave
                </option>
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Inactive">Inactive</option>
              </Select>
            </div>

            {/* Department Filter */}
            <div className="w-full sm:w-48">
              <Select
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="All Departments">All Departments</option>
                {allDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm dark:border-gray-700">
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
                <TableHeadCell>Employment</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
                <TableHeadCell className="text-center">
                  Subjects Count
                </TableHeadCell>
                <TableHeadCell className="text-center">
                  Total Load
                </TableHeadCell>
              </TableRow>
            </TableHead>

            <TableBody className="divide-y">
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Spinner size="sm" />
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Fetching Teachers Summary...
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : teachers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    {searchTerm ||
                    departmentFilter !== "All Departments" ||
                    statusFilter !== "All Active & On Leave"
                      ? `No matching teachers found for the current filters.`
                      : "No teacher records found."}
                  </TableCell>
                </TableRow>
              ) : (
                teachers.map((item, index) => {
                  const { prepLimit, facultyLoadLimit } = getLimitsForTeacher(
                    item.employment_type,
                  );

                  return (
                    <TableRow
                      key={`teacher-${item.teacher_id || index}`}
                      className="bg-white dark:border-gray-700 dark:bg-gray-800"
                    >
                      <TableCell className="font-medium text-gray-900 dark:text-white">
                        <div className="flex flex-col">
                          <span>
                            {item.full_name ||
                              `${item.surname}, ${item.f_name}`}
                          </span>
                          <span className="text-xs text-gray-500">
                            {item.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300">
                        {item.teacher_code}
                      </TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300">
                        {item.department}
                      </TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300">
                        {item.employment_type}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            item.status === "Active"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                          }`}
                        >
                          {item.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-semibold text-gray-900 dark:text-white">
                        {item.subjects_count} / {prepLimit}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-gray-900 dark:text-white">
                        {item.total_load} / {facultyLoadLimit}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Footer */}
        {!isLoading && totalPages > 0 && (
          <div className="flex w-full justify-center">
            <Pagination
              layout="pagination"
              currentPage={currentPage || 1}
              totalPages={totalPages}
              onPageChange={(p) => setCurrentPage(p)}
              showIcons
            />
          </div>
        )}

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
                {toastType === "warning" && (
                  <HiExclamation className="h-5 w-5" />
                )}
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
      </div>

      <div className={"max-w-md h-[calc(100vh-8rem)] rounded-2xl border-gray-500/20 border p-4"}>
        <div className={"flex"}>
          <h5 className="m-0 text-lg font-bold tracking-tight text-gray-900 dark:text-white">
            {!selectedTeacherID ? "Select A Teacher to assign Subjects" : selectedTeacherName}
          </h5>

          <HiCog6Tooth/>
        </div>
      </div>

      <Modal>
        <ModalHeader>

        </ModalHeader>
        <ModalBody>

        </ModalBody>
        <ModalFooter>

        </ModalFooter>
      </Modal>
    </div>
  );
}
