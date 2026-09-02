"use client";

import {
  Card,
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
  Toast,
  ToastToggle,
} from "flowbite-react";
import { useEffect, useState } from "react";
import { FaSortDown, FaSortUp } from "react-icons/fa6";
import { HiCheck, HiMagnifyingGlass } from "react-icons/hi2";
import { HiExclamation, HiX } from "react-icons/hi";
import { fetchLogList, SystemLog } from "@/app/actions/system";

export default function AuditLogs() {
  const [isLoading, setLoading] = useState(true);

  // --- Table Constants --- //
  const [logList, setLogList] = useState<SystemLog[]>([]);
  const [logCount, setLogCount] = useState(0);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState("DESC");
  const [searchQuery, setSearchQuery] = useState("");

  // --- Pagination Constants --- //
  const maxRows = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageChanging, setPageChanging] = useState(false);

  // --- Toast Constants --- //
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [showToastTimer, setShowToastTimer] = useState(false);
  const [progress, setProgress] = useState(0);

  /**************
   *  FUNCTIONS *
   **************/

  /** --- Table Related Functions --- **/
  function handleSorting(column: string) {
    const nextDir = column === sortBy && sortDir === "ASC" ? "DESC" : "ASC";

    setSortBy(column);
    setSortDir(nextDir);
    setLogList([]);

    setCurrentPage(1);
    getLogs(searchQuery, column, nextDir, maxRows, 1);
  }

  function onPageChange(page: number) {
    if (pageChanging) return;

    setPageChanging(true);
    setLogList([]);

    getLogs(searchQuery, sortBy, sortDir, maxRows, page);

    setPageChanging(false);
    setCurrentPage(page);
  }

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const query = e.target.value;
    setSearchQuery(query);
    setCurrentPage(1);
    getLogs(query, sortBy, sortDir, maxRows, 1);
  }

  /** --- Data Fetching --- **/
  async function getLogs(
    search?: string | null,
    sortColParam?: string,
    sortDirParam?: string,
    limitParam?: number,
    pageParam?: number,
  ) {
    setLoading(true);

    const activePage = pageParam ?? currentPage;
    const response = await fetchLogList(
      search,
      sortColParam ?? sortBy,
      sortDirParam ?? sortDir,
      limitParam ?? maxRows,
      activePage,
    );

    if (response.success && response.data) {
      setLogList(response.data);

      if (typeof response.count === "number") {
        setLogCount(response.count);
      } else {
        const estimatedTotal =
          response.data.length === maxRows
            ? activePage * maxRows + 1
            : (activePage - 1) * maxRows + response.data.length;
        setLogCount(estimatedTotal);
      }
    } else {
      setToastMessage(
        response?.error ?? "[fetchLogList]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
      setLogList([]);
      setLogCount(0);
    }

    setLoading(false);
  }

  /** --- Toast Timer --- **/
  function closeToast() {
    setShowToast(false);
    setToastType("");
    setToastMessage("");
    setShowToastTimer(false);
  }

  /** --- UseEffects --- **/
  useEffect(() => {
    getLogs();
  }, []);

  return (
    <>
      {/* --- Toast --- */}
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

      {/* --- Header & Search Bar --- */}
      <div className="mb-4 justify-between md:flex md:items-end">
        <div>
          <h2 className="mb-1 text-lg font-bold">System Logs</h2>
          <p className="mb-4 text-gray-500 md:mb-0">
            View administrative actions, audit trails, and system event activity
            history.
          </p>
        </div>
        <div className="w-full md:w-64">
          <TextInput
            id="log_search"
            type="text"
            icon={HiMagnifyingGlass}
            placeholder="Search logs..."
            value={searchQuery}
            onChange={handleSearch}
          />
        </div>
      </div>

      {/* --- Data Table --- */}
      <Card className="overflow-x-auto">
        <Table hoverable>
          <TableHead>
            <TableRow>
              <TableHeadCell onClick={() => handleSorting("created_at")}>
                <div className="flex cursor-pointer items-center text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Timestamp
                  {sortBy === "created_at" &&
                    (sortDir === "ASC" ? (
                      <FaSortUp className="ml-1" />
                    ) : (
                      <FaSortDown className="ml-1" />
                    ))}
                </div>
              </TableHeadCell>
              <TableHeadCell onClick={() => handleSorting("username")}>
                <div className="flex cursor-pointer items-center text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  User
                  {sortBy === "username" &&
                    (sortDir === "ASC" ? (
                      <FaSortUp className="ml-1" />
                    ) : (
                      <FaSortDown className="ml-1" />
                    ))}
                </div>
              </TableHeadCell>
              <TableHeadCell onClick={() => handleSorting("action")}>
                <div className="flex cursor-pointer items-center text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Action
                  {sortBy === "action" &&
                    (sortDir === "ASC" ? (
                      <FaSortUp className="ml-1" />
                    ) : (
                      <FaSortDown className="ml-1" />
                    ))}
                </div>
              </TableHeadCell>
              <TableHeadCell>
                <div className="flex cursor-pointer items-center">Details</div>
              </TableHeadCell>
            </TableRow>
          </TableHead>
          <TableBody className="divide-y">
            {logList.length > 0 ? (
              logList.map((item, index) => (
                <TableRow
                  key={item.log_id ?? `${item.created_at}-${index}`}
                  className="bg-white dark:border-gray-700 dark:bg-gray-800"
                >
                  <TableCell className="text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {new Date(item.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-medium whitespace-nowrap text-gray-900 dark:text-white">
                    {item.username}
                  </TableCell>
                  <TableCell className="font-semibold whitespace-nowrap text-gray-800 dark:text-gray-200">
                    {item.action}
                  </TableCell>
                  <TableCell className="text-gray-700 dark:text-gray-300">
                    {item.details}
                  </TableCell>
                </TableRow>
              ))
            ) : isLoading ? (
              <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                <TableCell
                  colSpan={4}
                  className="py-6 text-center text-sm text-gray-500 italic dark:text-gray-400"
                >
                  <div className="flex items-center justify-center">
                    <Spinner />
                    <span className="ml-4">Fetching logs...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                <TableCell
                  colSpan={4}
                  className="py-6 text-center text-sm text-gray-500 italic dark:text-gray-400"
                >
                  No log records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* --- Pagination --- */}
      <div
        className={`mt-4 ${
          isLoading
            ? "pointer-events-none opacity-50 [&_a]:cursor-not-allowed [&_button]:cursor-not-allowed"
            : ""
        } flex w-full justify-center`}
      >
        <Pagination
          layout="table"
          currentPage={currentPage ? currentPage : 1}
          itemsPerPage={maxRows}
          totalItems={logCount ? logCount : 1}
          onPageChange={onPageChange}
          showIcons
        />
      </div>
    </>
  );
}
