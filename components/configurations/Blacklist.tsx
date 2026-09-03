"use client";

import {
  Button,
  Card,
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
  Toast,
  ToastToggle,
} from "flowbite-react";
import {
  fetchBlacklist,
  fetchBlacklistCount,
  removeFromBlacklist,
} from "@/app/actions/system";
import {
  FaSortDown,
  FaSortUp,
  FaUserCheck,
  FaUserSlash,
} from "react-icons/fa6";
import { HiCheck } from "react-icons/hi2";
import { useEffect, useState } from "react";
import { HiExclamation, HiX, HiSearch } from "react-icons/hi";
import { useMsal } from "@azure/msal-react";

interface BlacklistedUser {
  blacklist_id: string;
  user_id: string;
  email: string;
  username: string;
  created_at: string;
}

export default function BlacklistManagement() {
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];
  const username = activeAccount?.username;
  const [isLoading, setLoading] = useState(true);

  // --- Table State --- //
  const [blacklist, setBlacklist] = useState<BlacklistedUser[]>([]);
  const [blacklistCount, setBlacklistCount] = useState(0);
  const [sortUsersBy, setSortUsersBy] = useState("created_at");
  const [sortUsersDir, setSortUsersDir] = useState("DESC");
  const [searchTerm, setSearchTerm] = useState("");

  // --- Modal & Action State --- //
  const [openRemoveModal, setOpenRemoveModal] = useState(false);
  const [selectedBlacklistId, setSelectedBlacklistId] = useState("");
  const [selectedEmail, setSelectedEmail] = useState("");

  // --- Pagination State --- //
  const maxRowUser = 10;
  const [currentUserPage, setCurrentUserPage] = useState(1);
  const [pageChangingUsers, setPageChangingUsers] = useState(false);

  // --- Toast State --- //
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [showToastTimer, setShowToastTimer] = useState(false);
  const [progress, setProgress] = useState(0);

  /** --- Table Functions --- **/

  function handleSorting(sortBy: string) {
    const newDir =
      sortBy === sortUsersBy && sortUsersDir === "ASC" ? "DESC" : "ASC";
    setSortUsersBy(sortBy);
    setSortUsersDir(newDir);
    setBlacklist([]);
    setCurrentUserPage(1);
    getBlacklistData(searchTerm, sortBy, newDir, maxRowUser, 1);
  }

  function onPageChange(page: number) {
    if (pageChangingUsers) return;

    setPageChangingUsers(true);
    setBlacklist([]);

    getBlacklistData(searchTerm, sortUsersBy, sortUsersDir, maxRowUser, page);

    setPageChangingUsers(false);
    setCurrentUserPage(page);
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentUserPage(1);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setCurrentUserPage(1);
  };

  /** --- Data Handlers --- **/

  async function getBlacklistCountData(search?: string | null) {
    const response = await fetchBlacklistCount(search);

    if (response.success) {
      setBlacklistCount(response.count);
    } else {
      setToastMessage(
        response?.error ??
          "[fetchBlacklistCount]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
      setBlacklistCount(0);
    }
  }

  async function getBlacklistData(
    search: string | null = searchTerm,
    sortby: string = sortUsersBy,
    sortdir: string = sortUsersDir,
    limit: number = maxRowUser,
    page: number = currentUserPage,
  ) {
    setLoading(true);

    const response = await fetchBlacklist(search, sortby, sortdir, limit, page);

    if (response.success && response.data) {
      setBlacklist(response.data);
      setLoading(false);
    } else {
      setToastMessage(
        response?.error ?? "[fetchBlacklist]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
      setBlacklist([]);
      setLoading(false);
    }

    await getBlacklistCountData(search);
  }

  function promptRemoveModal(blacklistId: string, email: string) {
    setSelectedBlacklistId(blacklistId);
    setSelectedEmail(email);
    setOpenRemoveModal(true);
  }

  function handleCloseModal() {
    setSelectedBlacklistId("");
    setSelectedEmail("");
    setOpenRemoveModal(false);
  }

  async function handleRemoveFromBlacklist() {
    if (!selectedBlacklistId) return;

    const response = await removeFromBlacklist(
      username ?? "system",
      selectedBlacklistId,
    );

    if (response.success) {
      setToastMessage("User removed from blacklist successfully.");
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(
        response?.error ??
          "[removeFromBlacklist]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseModal();
    getBlacklistData(
      searchTerm,
      sortUsersBy,
      sortUsersDir,
      maxRowUser,
      currentUserPage,
    );
  }

  /** --- Toast Functions --- **/

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

  /** --- Effects --- **/

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      void getBlacklistData(
        searchTerm,
        sortUsersBy,
        sortUsersDir,
        maxRowUser,
        currentUserPage,
      );
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

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

      {/* --- Header Section --- */}
      <div className="mb-4 flex-col justify-between gap-4 md:flex md:flex-row md:items-center">
        <div>
          <h2 className="mb-1 text-lg font-bold">Blacklist Management</h2>
          <p className="text-gray-500">
            View and manage blacklisted user accounts restricted from accessing
            the system.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-64">
            <TextInput
              id="search-blacklist"
              type="text"
              placeholder="Search email, username..."
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
      </div>

      {/* --- Table Section --- */}
      <Card className="overflow-x-auto">
        <Table hoverable>
          <TableHead>
            <TableRow>
              <TableHeadCell onClick={() => handleSorting("username")}>
                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Username
                  {sortUsersBy === "username" &&
                    (sortUsersDir === "ASC" ? (
                      <FaSortUp className="ml-1" />
                    ) : (
                      <FaSortDown className="ml-1" />
                    ))}
                </div>
              </TableHeadCell>

              <TableHeadCell onClick={() => handleSorting("email")}>
                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Email
                  {sortUsersBy === "email" &&
                    (sortUsersDir === "ASC" ? (
                      <FaSortUp className="ml-1" />
                    ) : (
                      <FaSortDown className="ml-1" />
                    ))}
                </div>
              </TableHeadCell>

              <TableHeadCell onClick={() => handleSorting("created_at")}>
                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Blacklisted On
                  {sortUsersBy === "created_at" &&
                    (sortUsersDir === "ASC" ? (
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
            {blacklist.length > 0 ? (
              blacklist.map((item) => (
                <TableRow
                  key={item.blacklist_id}
                  className="bg-white dark:border-gray-700 dark:bg-gray-800"
                >
                  <TableCell className="font-medium whitespace-nowrap text-gray-900 dark:text-white">
                    <span className="flex items-center text-red-500">
                      <FaUserSlash className="mr-2" />
                      {item.username || "—"}
                    </span>
                  </TableCell>
                  <TableCell>{item.email}</TableCell>
                  <TableCell>
                    {item.created_at
                      ? new Date(item.created_at).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() =>
                        promptRemoveModal(item.blacklist_id, item.email)
                      }
                      className="inline-flex items-center text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      <FaUserCheck className="mr-1 h-3.5 w-3.5" />
                      Remove
                    </button>
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
                  {searchTerm
                    ? `No blacklisted records matching "${searchTerm}" found.`
                    : "No blacklisted users found."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      <div
        className={`mt-4 ${isLoading ? "pointer-events-none opacity-50 [&_a]:cursor-not-allowed [&_button]:cursor-not-allowed" : ""} flex w-full justify-center`}
      >
        <Pagination
          layout="table"
          currentPage={currentUserPage || 1}
          itemsPerPage={maxRowUser}
          totalItems={blacklistCount || 1}
          onPageChange={onPageChange}
          showIcons
        />
      </div>

      {/* --- Unblacklist Confirmation Modal --- */}
      <Modal show={openRemoveModal} size="md" onClose={handleCloseModal} popup>
        <ModalHeader />
        <ModalBody>
          <div className="text-center">
            <FaUserCheck className="mx-auto mb-4 h-14 w-14 text-emerald-500" />
            <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">
              Remove from Blacklist?
            </h3>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to reinstate access for{" "}
              <span className="font-semibold text-gray-700 dark:text-gray-200">
                {selectedEmail}
              </span>
              ?
            </p>
            <div className="flex justify-center gap-4">
              <Button color="success" onClick={handleRemoveFromBlacklist}>
                Yes, reinstate
              </Button>
              <Button color="alternative" onClick={handleCloseModal}>
                Cancel
              </Button>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
}