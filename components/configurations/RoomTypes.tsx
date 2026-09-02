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
  RoomType,
  createRoomType,
  deleteRoomType,
  fetchRoomTypeList,
  fetchRoomTypeCount,
  updateRoomType,
} from "@/app/actions/system";
import { FaPlus, FaSortDown, FaSortUp } from "react-icons/fa6";
import { HiCheck, HiOutlineExclamationCircle, HiTrash } from "react-icons/hi2";
import { useEffect, useState } from "react";
import { HiExclamation, HiX } from "react-icons/hi";
import { useMsal } from "@azure/msal-react";
import { filterAlphaUnderscore } from "@/utils/validation";

export default function RoomTypes() {
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];
  const username = activeAccount?.username;
  const [isLoading, setLoading] = useState(true);

  // --- Table Constants --- //
  const [roomTypeList, setRoomTypeList] = useState<RoomType[]>([]);
  const [roomTypeCount, setRoomTypeCount] = useState(0);
  const [sortBy, setSortBy] = useState("room_type");
  const [sortDir, setSortDir] = useState("ASC");

  // --- Modal Constants --- //
  const [openAddModal, setOpenAddModal] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);

  // --- Form States --- //
  const [rowID, setRowID] = useState("");
  const [roomTypeError, setRoomTypeError] = useState("");

  // Add State
  const [roomType, setRoomType] = useState("");

  // Update State
  const [newRoomType, editRoomType] = useState("");
  const [initialRoomType, setInitialRoomType] = useState("");

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
    setRoomTypeList([]);

    setCurrentPage(1);
    getRoomTypes(null, nextDir, maxRows, 1);
  }

  function onPageChange(page: number) {
    if (pageChanging) return;

    setPageChanging(true);
    setRoomTypeList([]);

    getRoomTypes(null, sortDir, maxRows, page);

    setPageChanging(false);
    setCurrentPage(page);
  }

  /** --- Form Related Functions --- **/
  function loadEditData(item: RoomType) {
    setRowID(item.room_type_id ?? item.value);
    setInitialRoomType(item.value);
    editRoomType(item.value);
    setOpenEditModal(true);
  }

  // Input Handlers
  const handleRoomTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = filterAlphaUnderscore(e.target.value).slice(0, 30);
    setRoomType(value);
    if (value) {
      setRoomTypeError("");
    } else {
      setRoomTypeError("Room Type is required.");
    }
  };

  const handleNewRoomTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = filterAlphaUnderscore(e.target.value).slice(0, 30);
    editRoomType(value);
    if (value) {
      setRoomTypeError("");
    } else {
      setRoomTypeError("Room Type is required.");
    }
  };

  const handleCloseModals = () => {
    setRowID("");
    setRoomTypeError("");
    setOpenAddModal(false);
    setOpenEditModal(false);
    setOpenDeleteModal(false);

    // Reset Forms
    setRoomType("");
    editRoomType("");
    setInitialRoomType("");
  };

  /** --- CRUD Operations --- **/

  async function getRoomTypes(
    search?: string | null,
    sortdirParam?: string,
    limitParam?: number,
    pageParam?: number,
  ) {
    setLoading(true);

    const [listResponse, countResponse] = await Promise.all([
      fetchRoomTypeList(
        search,
        sortdirParam ?? sortDir,
        limitParam ?? maxRows,
        pageParam ?? currentPage,
      ),
      fetchRoomTypeCount(search),
    ]);

    // Handle List Response
    if (listResponse.success && listResponse.data) {
      setRoomTypeList(listResponse.data);
    } else {
      setToastMessage(
        listResponse?.error ??
          "[fetchRoomTypeList]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
      setRoomTypeList([]);
    }

    // Handle Count Response
    if (countResponse.success) {
      setRoomTypeCount(countResponse.count);
    } else {
      setToastMessage(
        countResponse?.error ??
          "[fetchRoomTypeCount]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
      setRoomTypeCount(0);
    }

    setLoading(false);
  }

  async function handleSubmit() {
    if (!roomType.trim()) {
      setRoomTypeError("Room Type is required.");
      return;
    }

    const response = await createRoomType(username ?? "", roomType.trim());

    if (response.success) {
      setToastMessage("Room Type added successfully");
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(
        response?.error ?? "[CreateRoomType]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseModals();
    getRoomTypes();
  }

  async function handleUpdate() {
    if (!newRoomType.trim()) {
      setRoomTypeError("Room Type is required.");
      return;
    }

    const response = await updateRoomType(
      username ?? "",
      rowID,
      newRoomType.trim(),
    );

    if (response.success) {
      setToastMessage("Room Type updated successfully");
      setToastType("success");
      setShowToast(true);
      toastTimer();
    } else {
      setToastMessage(
        response?.error ?? "[UpdateRoomType]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseModals();
    getRoomTypes();
  }

  async function handleDelete() {
    const response = await deleteRoomType(username ?? "", rowID);

    if (response.success) {
      setToastMessage("Room Type deleted successfully");
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(
        response?.error ?? "[DeleteRoomType]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseModals();
    getRoomTypes();
  }

  /** --- Toast Timer --- **/
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
    getRoomTypes();
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

      {/* --- Header --- */}
      <div className="mb-4 justify-between md:flex">
        <div>
          <h2 className="mb-1 text-lg font-bold">Room Types</h2>
          <p className="mb-4 text-gray-500 md:mb-0">
            Manage master room classifications (e.g. Lecture Room, Computer Lab,
            Science Lab).
          </p>
        </div>
        <Button className="min-w-40" onClick={() => setOpenAddModal(true)}>
          <FaPlus className="mr-2" />
          Add Room Type
        </Button>
      </div>

      {/* --- Data Table --- */}
      <Card className="overflow-x-auto">
        <Table hoverable>
          <TableHead>
            <TableRow>
              <TableHeadCell onClick={() => handleSorting("room_type")}>
                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Room Type / Classification
                  {sortBy === "room_type" ? (
                    sortDir === "ASC" ? (
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
            {roomTypeList.length > 0 ? (
              roomTypeList.map((item, index) => (
                <TableRow
                  key={item.room_type_id ?? `${item.value}-${index}`}
                  className="bg-white dark:border-gray-700 dark:bg-gray-800"
                >
                  <TableCell className="font-medium whitespace-nowrap text-gray-900 dark:text-white">
                    {item.value}
                  </TableCell>
                  <TableCell>
                    <a
                      onClick={() => loadEditData(item)}
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
                  colSpan={2}
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
                  colSpan={2}
                  className="py-6 text-center text-sm text-gray-500 italic dark:text-gray-400"
                >
                  No room types found yet.
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
          totalItems={roomTypeCount ? roomTypeCount : 1}
          onPageChange={onPageChange}
          showIcons
        />
      </div>

      {/* --- Modals --- */}
      {/* --- Add Modal --- */}
      <Modal show={openAddModal} onClose={handleCloseModals}>
        <ModalHeader>Add Room Type</ModalHeader>
        <ModalBody>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => e.preventDefault()}
          >
            <div>
              <div className="mb-2 block">
                <Label htmlFor="room_type_input">Room Type Name</Label>
              </div>
              <TextInput
                id="room_type_input"
                placeholder="e.g. Computer Lab, Lecture Room"
                value={roomType}
                onChange={handleRoomTypeChange}
                maxLength={30}
                color={roomTypeError ? "failure" : "gray"}
                required
              />
              <div className="mt-1 flex justify-between text-sm">
                <div>
                  {roomTypeError && (
                    <p className="font-medium text-red-600">{roomTypeError}</p>
                  )}
                </div>
                <span className="text-gray-400 dark:text-gray-500">
                  {roomType.length}/30
                </span>
              </div>
            </div>
          </form>
        </ModalBody>
        <ModalFooter>
          <Button
            onClick={handleSubmit}
            disabled={!roomType.trim() || Boolean(roomTypeError)}
          >
            Save
          </Button>
          <Button color="alternative" onClick={handleCloseModals}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* --- Edit Modal --- */}
      <Modal show={openEditModal} onClose={handleCloseModals}>
        <ModalHeader>Edit Room Type</ModalHeader>
        <ModalBody>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => e.preventDefault()}
          >
            <div>
              <div className="mb-2 block">
                <Label htmlFor="edit_room_type_input">Room Type Name</Label>
              </div>
              <TextInput
                id="edit_room_type_input"
                placeholder="e.g. Computer Lab, Lecture Room"
                value={newRoomType}
                onChange={handleNewRoomTypeChange}
                maxLength={30}
                color={roomTypeError ? "failure" : "gray"}
                required
              />
              <div className="mt-1 flex justify-between text-sm">
                <div>
                  {roomTypeError && (
                    <p className="font-medium text-red-600">{roomTypeError}</p>
                  )}
                </div>
                <span className="text-gray-400 dark:text-gray-500">
                  {newRoomType.length}/30
                </span>
              </div>
            </div>
          </form>
        </ModalBody>
        <ModalFooter className="flex w-full justify-between">
          <div className="flex">
            <Button
              onClick={handleUpdate}
              disabled={
                Boolean(roomTypeError) ||
                !newRoomType.trim() ||
                initialRoomType === newRoomType.trim()
              }
            >
              Save
            </Button>
            <Button
              color="alternative"
              className="ml-4"
              onClick={handleCloseModals}
            >
              Cancel
            </Button>
          </div>
          <Button color="red" onClick={() => setOpenDeleteModal(true)}>
            <HiTrash />
          </Button>
        </ModalFooter>
      </Modal>

      {/* --- Delete Modal --- */}
      <Modal
        show={openDeleteModal}
        size="md"
        onClose={() => setOpenDeleteModal(false)}
        popup
      >
        <ModalHeader />
        <ModalBody>
          <div className="text-center">
            <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
            <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
              Are you sure you want to delete this Room Type?
            </h3>
            <div className="flex justify-center gap-4">
              <Button color="red" onClick={handleDelete}>
                <p>Yes, I am sure</p>
              </Button>
              <Button
                color="alternative"
                onClick={() => setOpenDeleteModal(false)}
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
