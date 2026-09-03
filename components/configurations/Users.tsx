"use client";

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
  ToastToggle, Tooltip,
} from "flowbite-react";
import {
  addToBlacklist,
  createUser,
  fetchUsers,
  fetchUsersCount,
  updateUser,
  fetchRoles,
} from "@/app/actions/system";
import {
  FaBan,
  FaPlus,
  FaSortDown,
  FaSortUp,
  FaUserSlash,
} from "react-icons/fa6";
import {
  HiCheck,
} from "react-icons/hi2";
import { useEffect, useState } from "react";
import { HiExclamation, HiX, HiSearch } from "react-icons/hi";
import { filterAlphanumericUnderscore, filterEmail } from "@/utils/validation";
import { useMsal } from "@azure/msal-react";

interface User {
  user_id: string;
  username: string;
  email: string;
  role_name: string;
  is_blacklisted: boolean;
}

interface Roles {
  role_id: string;
  role_name: string;
}

export default function UsersManagement() {
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];
  const username = activeAccount?.username;
  const [isLoading, setLoading] = useState(true);

  // --- Table Constants --- //
  const [users, setUsers] = useState<User[]>([]);
  const [usersCount, setUsersCount] = useState(0);
  const [sortUsersBy, setSortUsersBy] = useState("username");
  const [sortUsersDir, setSortUsersDir] = useState("ASC");
  const [searchTerm, setSearchTerm] = useState("");

  // --- Modal Constants --- //
  const [openAddUserModal, setOpenAddUserModal] = useState(false);
  const [openEditUserModal, setOpenEditUserModal] = useState(false);
  const [openBlacklistModal, setOpenBlacklistModal] = useState(false);

  // --- User Form states --- //
  const [rowID, setRowID] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [roles, setRoles] =useState<Roles[]>([]);

  // Add State
  const [inputUsername, setInputUsername] = useState("");
  const [inputEmail, setInputEmail] = useState("");
  const [inputRoleName, setInputRoleName] = useState("viewer");

  // Update State
  const [newUsername, editUsername] = useState("");
  const [newEmail, editEmail] = useState("");
  const [newRoleName, editRoleName] = useState("viewer");

  // Baseline Comparison State
  const [baseUsername, setBaseUsername] = useState("");
  const [baseEmail, setBaseEmail] = useState("");
  const [baseRoleName, setBaseRoleName] = useState("viewer");

  // --- Pagination Constants --- //
  const maxRowUser = 10;
  const [currentUserPage, setCurrentUserPage] = useState(1);
  const [pageChangingUsers, setPageChangingUsers] = useState(false);

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
  // Sorting
  function handleUserSorting(sortBy: string) {
    const newDir = sortBy === sortUsersBy && sortUsersDir === "ASC" ? "DESC" : "ASC";
    setSortUsersBy(sortBy);
    setSortUsersDir(newDir);
    setUsers([]);
    setCurrentUserPage(1);
    getUsers(
      searchTerm,
      sortBy,
      newDir,
      maxRowUser,
      1,
    );
  }

  // Page Change
  function onPageChangeUsers(page: number) {
    if (pageChangingUsers) {
      return;
    }

    setPageChangingUsers(true);
    setUsers([]);

    getUsers(
      searchTerm,
      sortUsersBy,
      sortUsersDir,
      maxRowUser,
      page,
    );

    setPageChangingUsers(false);
    setCurrentUserPage(page);
  }

  // Search Handler
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setCurrentUserPage(1);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setCurrentUserPage(1);
  };

  /** --- Form Related Functions --- **/

  function loadEditData(row_id: string) {
    setRowID(row_id);
    setOpenEditUserModal(true);

    const selectedUser = users.find((item) => item.user_id === row_id);

    if (selectedUser) {
      // Baseline state for comparison
      setBaseUsername(selectedUser.username ?? "");
      setBaseEmail(selectedUser.email ?? "");
      setBaseRoleName(selectedUser.role_name ?? "viewer");

      // Form state
      editUsername(selectedUser.username ?? "");
      editEmail(selectedUser.email ?? "");
      editRoleName(selectedUser.role_name ?? "viewer");
    }
  }

  // --- Create Handlers --- //
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterAlphanumericUnderscore(e.target.value);
    setInputUsername(val);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterEmail(e.target.value);
    setInputEmail(val);
    if (val) {
      setEmailError("");
    } else {
      setEmailError("Email is required.");
    }
  };

  // --- Update Handlers --- //
  const handleNewUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterAlphanumericUnderscore(e.target.value);
    editUsername(val);
  };

  // Clear Constants
  const handleCloseUserModals = () => {
    setRowID("");
    setUsernameError("");
    setEmailError("");
    setOpenAddUserModal(false);
    setOpenEditUserModal(false);
    setOpenBlacklistModal(false);

    // add consts
    setInputUsername("");
    setInputEmail("");
    setInputRoleName("viewer");

    // update consts
    editUsername("");
    editEmail("");
    editRoleName("viewer");
  };

  /** --- CRUD Related --- **/

  // Count
  async function getUserCount(search?: string | null) {
    const response = await fetchUsersCount(search);

    if (response.success) {
      setUsersCount(response.count);
    } else {
      setToastMessage(
        response?.error ??
        "[fetchUsersCount]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
      setUsersCount(0);
    }
  }

  // Create
  async function handleUserSubmit() {
    if (!inputEmail.trim()) {
      setEmailError("Email is required.");
      return;
    }

    const response = await createUser(
      username ?? "system",
      inputEmail.trim(),
      inputUsername.trim() || undefined,
      inputRoleName,
    );

    if (response.success) {
      const msg = "User added successfully";
      setToastMessage(msg);
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(
        response?.error ?? "[AddUser]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseUserModals();
    getUsers(searchTerm, sortUsersBy, sortUsersDir, maxRowUser, currentUserPage);
  }

  // Read
  async function getUsers(
    search: string | null = searchTerm,
    sortby: string = sortUsersBy,
    sortdir: string = sortUsersDir,
    limit: number = maxRowUser,
    page: number = currentUserPage,
  ) {
    setLoading(true);

    const response = await fetchUsers(
      search,
      sortby,
      sortdir,
      limit,
      page,
    );

    if (response.success && response.data) {
      setUsers(response.data);
      setLoading(false);
    } else {
      setToastMessage(
        response?.error ?? "[fetchUsers]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
      setUsers([]);
      setLoading(false);
    }

    await getUserCount(search);
  }

  // Update
  async function handleUserUpdate() {
    const response = await updateUser(
      username ?? "system",
      rowID,
      newUsername.trim(),
      newRoleName,
    );

    if (response.success) {
      const msg = "User updated successfully";
      setToastMessage(msg);
      setToastType("success");
      setShowToast(true);
      toastTimer();
    } else {
      setToastMessage(
        response?.error ?? "[UpdateUser]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseUserModals();
    getUsers(searchTerm, sortUsersBy, sortUsersDir, maxRowUser, currentUserPage);
  }

  // Delete
  async function handleUserBlacklist() {
    const response = await addToBlacklist(username ?? "system", rowID);

    if (response.success) {
      const msg = "User blacklisted successfully";
      setToastMessage(msg);
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(
        response?.error ?? "[BlacklistUser]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseUserModals();
    getUsers(searchTerm, sortUsersBy, sortUsersDir, maxRowUser, currentUserPage);
  }

  /** --- Toast Related Functions --- **/

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

  /** --- UseEffects --- **/

  // Trigger search with debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      getUsers(searchTerm, sortUsersBy, sortUsersDir, maxRowUser, currentUserPage);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  useEffect(() =>{
    async function getRoles() {
      const response = await fetchRoles(null, "role_name", "ASC", 0);

      if (response.success && response.data) {
        setRoles(response.data);
      } else {
        setToastMessage(
          response?.error ?? "[fetchRoles]: An unexpected error occurred",
        );
        setToastType("error");
        setShowToast(true);
        setRoles([]);
      }
    }

    getRoles();
  },[]);

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

      {/* --- Header Section with Search & Add Button --- */}
      <div
        className={
          "mb-4 flex-col justify-between gap-4 md:flex md:flex-row md:items-center"
        }
      >
        <div>
          <h2 className={`mb-1 text-lg font-bold`}>User Management</h2>
          <p className={`text-gray-500`}>
            Manage system users, assigned roles, and account access permissions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Input Bar */}
          <div className="relative mr-4 w-full md:w-64">
            <TextInput
              id="search-users"
              type="text"
              placeholder="Search email, username, role..."
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
            className={"whitespace-nowrap"}
            onClick={() => setOpenAddUserModal(true)}
          >
            <FaPlus className={`mr-2`} />
            Add User
          </Button>
        </div>
      </div>

      <Card className={`overflow-x-auto`}>
        <Table hoverable>
          <TableHead>
            <TableRow>
              <TableHeadCell onClick={() => handleUserSorting("username")}>
                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Username
                  {sortUsersBy === "username" ? (
                    sortUsersDir === "ASC" ? (
                      <FaSortUp className="ml-1" />
                    ) : (
                      <FaSortDown className="ml-1" />
                    )
                  ) : (
                    ""
                  )}
                </div>
              </TableHeadCell>

              <TableHeadCell onClick={() => handleUserSorting("email")}>
                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Email
                  {sortUsersBy === "email" ? (
                    sortUsersDir === "ASC" ? (
                      <FaSortUp className="ml-1" />
                    ) : (
                      <FaSortDown className="ml-1" />
                    )
                  ) : (
                    ""
                  )}
                </div>
              </TableHeadCell>

              <TableHeadCell onClick={() => handleUserSorting("role_name")}>
                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Role
                  {sortUsersBy === "role_name" ? (
                    sortUsersDir === "ASC" ? (
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
            {users.length > 0 ? (
              users.map((item) => (
                <TableRow
                  key={item.user_id}
                  className={`${item.is_blacklisted && "text-red-500"} bg-white dark:border-gray-700 dark:bg-gray-800`}
                >
                  <TableCell className="font-medium whitespace-nowrap">
                    {item.is_blacklisted ? (
                      <Tooltip content={"Blacklisted"}>
                        <span className="flex items-center">
                          <FaUserSlash className="mr-2" />
                          {item.username || "—"}
                        </span>
                      </Tooltip>
                    ) : (
                      item.username || "—"
                    )}
                  </TableCell>
                  <TableCell>{item.email}</TableCell>
                  <TableCell className="capitalize">{item.role_name}</TableCell>
                  <TableCell>
                    <a
                      onClick={() => loadEditData(item.user_id)}
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
                  colSpan={4}
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
                  colSpan={4}
                  className="py-6 text-center text-sm text-gray-500 italic dark:text-gray-400"
                >
                  {searchTerm
                    ? `No users matching "${searchTerm}" found.`
                    : "No user entries found yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* users pagination */}
      <div
        className={`mt-4 ${isLoading ? "pointer-events-none opacity-50 [&_a]:cursor-not-allowed [&_button]:cursor-not-allowed" : ""} flex w-full justify-center`}
      >
        <Pagination
          layout="table"
          currentPage={currentUserPage ? currentUserPage : 1}
          itemsPerPage={maxRowUser}
          totalItems={usersCount ? usersCount : 1}
          onPageChange={onPageChangeUsers}
          showIcons
        />
      </div>

      {/* --- Modals --- */}
      {/* --- Add User Modal --- */}
      <Modal show={openAddUserModal} onClose={handleCloseUserModals}>
        <ModalHeader>Add User</ModalHeader>
        <ModalBody>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => e.preventDefault()}
          >
            {/* Email Field (Required) */}
            <div>
              <div className="mb-2 block">
                <Label htmlFor="email">Email Address *</Label>
              </div>
              <TextInput
                id="email"
                type="email"
                placeholder="e.g. john@example.com"
                value={inputEmail}
                onChange={handleEmailChange}
                color={emailError ? "failure" : "gray"}
                required
              />
            </div>
            {emailError && (
              <p className="text-sm font-medium text-red-600">{emailError}</p>
            )}

            {/* Username Field (Optional) */}
            <div>
              <div className="mb-2 block">
                <Label htmlFor="username">Username (Optional)</Label>
              </div>
              <TextInput
                id="username"
                placeholder="e.g. jdoe"
                value={inputUsername}
                onChange={handleUsernameChange}
              />
            </div>

            {/* Role Name Field */}
            <div>
              <div className="mb-2 block">
                <Label htmlFor="role_name">Assigned Role</Label>
              </div>
              <Select
                id="role_name"
                value={inputRoleName}
                onChange={(e) => setInputRoleName(e.target.value)}
                required
              >
                {roles.length > 0 ? (
                  roles.map((option) => (
                    <option key={option.role_id} value={option.role_name}>
                      {option.role_name}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>
                    No Roles
                  </option>
                )}
              </Select>
            </div>
          </form>
        </ModalBody>
        <ModalFooter>
          <Button onClick={handleUserSubmit} disabled={!inputEmail.trim()}>
            Save
          </Button>
          <Button color="alternative" onClick={handleCloseUserModals}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* --- Edit User Modal --- */}
      <Modal show={openEditUserModal} onClose={handleCloseUserModals}>
        <ModalHeader>Edit User Account</ModalHeader>
        <ModalBody>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => e.preventDefault()}
          >
            {/* Email Field (Read-only on update) */}
            <div>
              <div className="mb-2 block">
                <Label htmlFor="edit_email">Email Address</Label>
              </div>
              <TextInput
                id="edit_email"
                type="email"
                value={newEmail}
                disabled
              />
            </div>

            {/* Username Field */}
            <div>
              <div className="mb-2 block">
                <Label htmlFor="edit_username">Username</Label>
              </div>
              <TextInput
                id="edit_username"
                placeholder="e.g. jdoe"
                value={newUsername}
                onChange={handleNewUsernameChange}
              />
            </div>

            {/* Role Name Field */}
            <div>
              <div className="mb-2 block">
                <Label htmlFor="edit_role_name">Assigned Role</Label>
              </div>
              <Select
                id="edit_role_name"
                value={newRoleName}
                onChange={(e) => editRoleName(e.target.value)}
                required
              >
                {roles.length > 0 ? (
                  roles.map((option) => (
                    <option key={option.role_id} value={option.role_name}>
                      {option.role_name}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>
                    No Roles
                  </option>
                )}
              </Select>
            </div>
          </form>
        </ModalBody>
        <ModalFooter className={"flex w-full justify-between"}>
          <div className={"flex"}>
            <Button
              onClick={handleUserUpdate}
              disabled={
                baseUsername === newUsername.trim() &&
                baseRoleName === newRoleName
              }
            >
              Save
            </Button>
            <Button
              color="alternative"
              className={"ml-4"}
              onClick={handleCloseUserModals}
            >
              Cancel
            </Button>
          </div>
          <Button color={"red"} onClick={() => setOpenBlacklistModal(true)}>
            <FaBan />
          </Button>
        </ModalFooter>
      </Modal>

      {/* --- Blacklist Modal --- */}
      <Modal
        show={openBlacklistModal}
        size="md"
        onClose={() => setOpenBlacklistModal(false)}
        popup
      >
        <ModalHeader />
        <ModalBody>
          <div className="text-center">
            <FaUserSlash className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
            <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
              Are you sure you want to blacklist this User?
            </h3>
            <div className="flex justify-center gap-4">
              <Button color="red" onClick={() => handleUserBlacklist()}>
                <p>Yes, I&#39;m sure</p>
              </Button>
              <Button
                color="alternative"
                onClick={() => setOpenBlacklistModal(false)}
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