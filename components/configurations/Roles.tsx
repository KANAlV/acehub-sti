"use client";

import {
  Button,
  Card,
  Checkbox,
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
  Toast,
  ToastToggle,
} from "flowbite-react";
import {
  createRole,
  deleteRole,
  fetchRoles,
  updateRole,
} from "@/app/actions/system";
import {
  FaPlus,
  FaSortDown,
  FaSortUp,
  FaTrash,
  FaCheck,
} from "react-icons/fa6";
import { HiCheck, HiExclamation, HiX, HiSearch } from "react-icons/hi";
import { useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";
import {FaTimes} from "react-icons/fa";
import {filterAlphanumericUnderscore} from "@/utils/validation";

export interface Role {
  role_id: string;
  role_name: string;
  booking: boolean;
  personal_schedule: boolean;
  academic_qualification: boolean;
  schedules: boolean;
  courses: boolean;
  rooms: boolean;
  subjects: boolean;
  teachers: boolean;
  maq: boolean;
  fcce: boolean;
  help: boolean;
  config: boolean;
  superuser: boolean;
  created_at?: string;
  updated_at?: string;
}

export type RolePermissions = Omit<Role, "role_id" | "created_at" | "updated_at">;

const PERMISSION_KEYS: Array<{ key: keyof Omit<RolePermissions, "role_name">; label: string }> = [
  { key: "booking", label: "Booking" },
  { key: "personal_schedule", label: "Personal Schedule" },
  { key: "academic_qualification", label: "Academic Qualification" },
  { key: "schedules", label: "Schedules" },
  { key: "courses", label: "Courses" },
  { key: "rooms", label: "Rooms" },
  { key: "subjects", label: "Subjects" },
  { key: "teachers", label: "Teachers" },
  { key: "maq", label: "MAQ" },
  { key: "fcce", label: "FCCE" },
  { key: "help", label: "Help" },
  { key: "config", label: "Config" },
  { key: "superuser", label: "Superuser" },
];

const initialPermissionState: RolePermissions = {
  role_name: "",
  booking: false,
  personal_schedule: false,
  academic_qualification: false,
  schedules: false,
  courses: false,
  rooms: false,
  subjects: false,
  teachers: false,
  maq: false,
  fcce: false,
  help: false,
  config: false,
  superuser: false,
};

export default function RolesManagement() {
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];
  const username = activeAccount?.username;
  const [isLoading, setLoading] = useState(true);

  // --- Table Constants --- //
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesCount, setRolesCount] = useState(0);
  const [sortRolesBy, setSortRolesBy] = useState("role_name");
  const [sortRolesDir, setSortRolesDir] = useState("ASC");
  const [searchTerm, setSearchTerm] = useState("");

  // --- Modal Constants --- //
  const [openAddRoleModal, setOpenAddRoleModal] = useState(false);
  const [openEditRoleModal, setOpenEditRoleModal] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);

  // --- Form States --- //
  const [rowID, setRowID] = useState("");
  const [roleNameError, setRoleNameError] = useState("");

  // Add State
  const [addFormData, setAddFormData] = useState<RolePermissions>(initialPermissionState);

  // Edit State
  const [editFormData, setEditFormData] = useState<RolePermissions>(initialPermissionState);
  const [baseFormData, setBaseFormData] = useState<RolePermissions>(initialPermissionState);

  // --- Pagination Constants --- //
  const maxRowRole = 10;
  const [currentRolePage, setCurrentRolePage] = useState(1);
  const [pageChangingRoles, setPageChangingRoles] = useState(false);

  // --- Toast Constants --- //
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [showToastTimer, setShowToastTimer] = useState(false);
  const [progress, setProgress] = useState(0);

  /****************
   *  FUNCTIONS   *
   ***************/

  /** --- Table Related Functions --- **/
  function handleRoleSorting(sortBy: string) {
    const newDir = sortBy === sortRolesBy && sortRolesDir === "ASC" ? "DESC" : "ASC";
    setSortRolesBy(sortBy);
    setSortRolesDir(newDir);
    setRoles([]);
    setCurrentRolePage(1);
    getRoles(searchTerm, sortBy, newDir, maxRowRole, 1);
  }

  function onPageChangeRoles(page: number) {
    if (pageChangingRoles) return;

    setPageChangingRoles(true);
    setRoles([]);

    getRoles(searchTerm, sortRolesBy, sortRolesDir, maxRowRole, page);

    setPageChangingRoles(false);
    setCurrentRolePage(page);
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = filterAlphanumericUnderscore(e.target.value);
    setSearchTerm(value);
    setCurrentRolePage(1);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setCurrentRolePage(1);
  };

  /** --- Form Related Functions --- **/
  function loadEditData(row_id: string) {
    setRowID(row_id);
    const selectedRole = roles.find((item) => item.role_id === row_id);

    if (selectedRole) {
      const { role_id, created_at, updated_at, ...permissions } = selectedRole;
      setBaseFormData(permissions);
      setEditFormData(permissions);
      setOpenEditRoleModal(true);
    }
  }

  const handleCloseRoleModals = () => {
    setRowID("");
    setRoleNameError("");
    setOpenAddRoleModal(false);
    setOpenEditRoleModal(false);
    setOpenDeleteModal(false);

    setAddFormData(initialPermissionState);
    setEditFormData(initialPermissionState);
    setBaseFormData(initialPermissionState);
  };

  /** --- CRUD Related --- **/
  async function getRoles(
    search: string | null = searchTerm,
    sortby: string = sortRolesBy,
    sortdir: string = sortRolesDir,
    limit: number = maxRowRole,
    page: number = currentRolePage,
  ) {
    setLoading(true);

    const response = await fetchRoles(search, sortby, sortdir, limit, page);

    if (response.success && response.data) {
      setRoles(response.data);
      setRolesCount(response.data.length);
    } else {
      setToastMessage(
        response?.error ?? "[fetchRoles]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
      setRoles([]);
      setRolesCount(0);
    }
    setLoading(false);
  }

  async function handleRoleSubmit() {
    if (!addFormData.role_name.trim()) {
      setRoleNameError("Role name is required.");
      return;
    }

    const response = await createRole(username ?? "system", addFormData);

    if (response.success) {
      setToastMessage("Role created successfully");
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(
        response?.error ?? "[CreateRole]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseRoleModals();
    getRoles(searchTerm, sortRolesBy, sortRolesDir, maxRowRole, currentRolePage);
  }

  async function handleRoleUpdate() {
    const response = await updateRole(
      username ?? "system",
      rowID,
      editFormData,
    );

    if (response.success) {
      setToastMessage("Role updated successfully");
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(
        response?.error ?? "[UpdateRole]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseRoleModals();
    getRoles(searchTerm, sortRolesBy, sortRolesDir, maxRowRole, currentRolePage);
  }

  async function handleRoleDelete() {
    const response = await deleteRole(username ?? "system", rowID);

    if (response.success) {
      setToastMessage("Role deleted successfully");
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(
        response?.error ?? "[DeleteRole]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseRoleModals();
    getRoles(searchTerm, sortRolesBy, sortRolesDir, maxRowRole, currentRolePage);
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
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      void getRoles(searchTerm, sortRolesBy, sortRolesDir, maxRowRole, currentRolePage);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const isEditUnchanged = JSON.stringify(baseFormData) === JSON.stringify(editFormData);

  return (
    <>
      {/* --- Toast Notification --- */}
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
          <h2 className="mb-1 text-lg font-bold">Role Management</h2>
          <p className="text-gray-500">
            Configure system roles and fine-tune module permission rights.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative mr-4 w-full md:w-64">
            <TextInput
              id="search-roles"
              type="text"
              placeholder="Search roles..."
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
            className="whitespace-nowrap"
            onClick={() => setOpenAddRoleModal(true)}
          >
            <FaPlus className="mr-2" />
            Add Role
          </Button>
        </div>
      </div>

      {/* --- Roles Table --- */}
      <Card className="overflow-x-auto">
        <Table hoverable>
          <TableHead>
            <TableRow>
              <TableHeadCell onClick={() => handleRoleSorting("role_name")}>
                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Role Name
                  {sortRolesBy === "role_name" ? (
                    sortRolesDir === "ASC" ? (
                      <FaSortUp className="ml-1" />
                    ) : (
                      <FaSortDown className="ml-1" />
                    )
                  ) : null}
                </div>
              </TableHeadCell>

              <TableHeadCell>Superuser</TableHeadCell>
              <TableHeadCell>Active Permissions</TableHeadCell>
              <TableHeadCell>
                <span className="sr-only">Edit</span>
              </TableHeadCell>
            </TableRow>
          </TableHead>
          <TableBody className="divide-y">
            {roles.length > 0 ? (
              roles.map((item) => {
                const activeCount = PERMISSION_KEYS.filter(
                  (p) => item[p.key as keyof Role] === true
                ).length;

                return (
                  <TableRow
                    key={item.role_id}
                    className="bg-white dark:border-gray-700 dark:bg-gray-800"
                  >
                    <TableCell className="font-medium whitespace-nowrap capitalize">
                      {item.role_name}
                    </TableCell>
                    <TableCell>
                      {item.superuser ? (
                        <FaCheck className="text-green-500" />
                      ) : (
                        <FaTimes className="text-gray-300 dark:text-gray-600" />
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-700/10 ring-inset dark:bg-blue-900/30 dark:text-blue-300">
                        {activeCount} / {PERMISSION_KEYS.length} Modules
                      </span>
                    </TableCell>
                    <TableCell>
                      <a
                        onClick={() => loadEditData(item.role_id)}
                        className="text-primary-600 dark:text-primary-500 cursor-pointer font-medium hover:underline"
                      >
                        Edit
                      </a>
                    </TableCell>
                  </TableRow>
                );
              })
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
                    ? `No roles matching "${searchTerm}" found.`
                    : "No role entries found yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* --- Pagination --- */}
      <div
        className={`mt-4 ${isLoading ? "pointer-events-none opacity-50 [&_a]:cursor-not-allowed [&_button]:cursor-not-allowed" : ""} flex w-full justify-center`}
      >
        <Pagination
          layout="table"
          currentPage={currentRolePage || 1}
          itemsPerPage={maxRowRole}
          totalItems={rolesCount || 1}
          onPageChange={onPageChangeRoles}
          showIcons
        />
      </div>

      {/* --- Add Role Modal --- */}
      <Modal show={openAddRoleModal} onClose={handleCloseRoleModals} size="lg">
        <ModalHeader>Add Role</ModalHeader>
        <ModalBody>
          <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <div className="mb-2 block">
                <Label htmlFor="role_name">Role Name *</Label>
              </div>
              <TextInput
                id="role_name"
                placeholder="e.g. Manager"
                value={addFormData.role_name}
                onChange={(e) => {
                  setAddFormData((prev) => ({
                    ...prev,
                    role_name: filterAlphanumericUnderscore(e.target.value),
                  }));
                  if (e.target.value.trim()) setRoleNameError("");
                }}
                color={roleNameError ? "failure" : "gray"}
                required
              />
              {roleNameError && (
                <p className="mt-1 text-sm font-medium text-red-600">{roleNameError}</p>
              )}
            </div>

            <div>
              <Label className="mb-2 block font-semibold">Module Access Permissions</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {PERMISSION_KEYS.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={`add-${key}`}
                      checked={addFormData[key]}
                      onChange={(e) =>
                        setAddFormData((prev) => ({
                          ...prev,
                          [key]: e.target.checked,
                        }))
                      }
                    />
                    <Label htmlFor={`add-${key}`} className="cursor-pointer">
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </form>
        </ModalBody>
        <ModalFooter>
          <Button onClick={handleRoleSubmit} disabled={!addFormData.role_name.trim()}>
            Save
          </Button>
          <Button color="alternative" onClick={handleCloseRoleModals}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* --- Edit Role Modal --- */}
      <Modal show={openEditRoleModal} onClose={handleCloseRoleModals} size="lg">
        <ModalHeader>Edit Role Permissions</ModalHeader>
        <ModalBody>
          <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <div className="mb-2 block">
                <Label htmlFor="edit_role_name">Role Name</Label>
              </div>
              <TextInput
                id="edit_role_name"
                value={editFormData.role_name}
                onChange={(e) =>
                  setEditFormData((prev) => ({ ...prev, role_name: filterAlphanumericUnderscore(e.target.value) }))
                }
              />
            </div>

            <div>
              <Label className="mb-2 block font-semibold">Module Access Permissions</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {PERMISSION_KEYS.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={`edit-${key}`}
                      checked={editFormData[key]}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          [key]: e.target.checked,
                        }))
                      }
                    />
                    <Label htmlFor={`edit-${key}`} className="cursor-pointer">
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </form>
        </ModalBody>
        <ModalFooter className="flex w-full justify-between">
          <div className="flex gap-2">
            <Button onClick={handleRoleUpdate} disabled={isEditUnchanged}>
              Save Changes
            </Button>
            <Button color="alternative" onClick={handleCloseRoleModals}>
              Cancel
            </Button>
          </div>
          <Button color="red" onClick={() => setOpenDeleteModal(true)}>
            <FaTrash />
          </Button>
        </ModalFooter>
      </Modal>

      {/* --- Delete Confirmation Modal --- */}
      <Modal
        show={openDeleteModal}
        size="md"
        onClose={() => setOpenDeleteModal(false)}
        popup
      >
        <ModalHeader />
        <ModalBody>
          <div className="text-center">
            <FaTrash className="mx-auto mb-4 h-12 w-12 text-gray-400 dark:text-gray-200" />
            <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
              Are you sure you want to delete this role permanently?
            </h3>
            <div className="flex justify-center gap-4">
              <Button color="red" onClick={handleRoleDelete}>
                Yes, I&#39;m sure
              </Button>
              <Button color="alternative" onClick={() => setOpenDeleteModal(false)}>
                No, cancel
              </Button>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
}