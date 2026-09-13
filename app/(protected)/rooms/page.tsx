"use client";

import {
  Button,
  Card,
  HelperText,
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
  ToastToggle,
} from "flowbite-react";
import {
  createRoom,
  deleteRoom,
  fetchRooms,
  fetchRoomsCount,
  fetchRoomTypeList,
  updateRoom,
  RoomRecord,
  RoomInput,
} from "@/app/actions/system";
import { FaPlus, FaSortDown, FaSortUp, FaTrash } from "react-icons/fa6";
import { HiCheck, HiExclamation, HiX, HiSearch } from "react-icons/hi";
import { useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { filterAlphanumericDashUnderscore } from "@/utils/validation";

interface RoomTypeItem {
  room_type_id: string;
  value: string;
}

export default function RoomsManagement() {
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];
  const username = activeAccount?.username;
  const [isLoading, setLoading] = useState(true);

  // --- Room Types State --- //
  const [roomTypes, setRoomTypes] = useState<RoomTypeItem[]>([]);

  // --- Table State --- //
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [roomsCount, setRoomsCount] = useState(0);
  const [sortRoomsBy, setSortRoomsBy] = useState("room_name");
  const [sortRoomsDir, setSortRoomsDir] = useState("ASC");
  const [searchTerm, setSearchTerm] = useState("");

  // --- Modal States --- //
  const [openAddRoomModal, setOpenAddRoomModal] = useState(false);
  const [openEditRoomModal, setOpenEditRoomModal] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);

  // --- Form & Validation States --- //
  const [rowID, setRowID] = useState("");
  const [roomNameError, setRoomNameError] = useState("");
  const [editRoomNameError, setEditRoomNameError] = useState("");

  // Add Form State
  const [addRoomName, setAddRoomName] = useState("");
  const [addRoomType, setAddRoomType] = useState("");
  const [addFloorLevel, setAddFloorLevel] = useState("1");

  // Edit Form State
  const [editRoomName, setEditRoomName] = useState("");
  const [editRoomType, setEditRoomType] = useState("");
  const [editFloorLevel, setEditFloorLevel] = useState("1");

  // Base State for Change Tracking
  const [baseRoomName, setBaseRoomName] = useState("");
  const [baseRoomType, setBaseRoomType] = useState("");
  const [baseFloorLevel, setBaseFloorLevel] = useState("1");

  // --- Pagination State --- //
  const maxRowRoom = 10;
  const [currentRoomPage, setCurrentRoomPage] = useState(1);
  const [pageChangingRooms, setPageChangingRooms] = useState(false);

  // --- Toast State --- //
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [showToastTimer, setShowToastTimer] = useState(false);
  const [progress, setProgress] = useState(0);

  /** --- Fetch Room Types Dropdown Options --- **/
  async function loadRoomTypes() {
    const response = await fetchRoomTypeList(null, "ASC", 100, 1);
    if (response?.success && response.data) {
      setRoomTypes(response.data as RoomTypeItem[]);
    }
  }

  useEffect(() => {
    void loadRoomTypes();
  }, []);

  /** --- Table Sorting & Pagination Handlers --- **/
  function handleRoomSorting(sortBy: string) {
    const newDir =
        sortBy === sortRoomsBy && sortRoomsDir === "ASC" ? "DESC" : "ASC";
    setSortRoomsBy(sortBy);
    setSortRoomsDir(newDir);
    setRooms([]);
    setCurrentRoomPage(1);
    void getRooms(searchTerm, sortBy, newDir, maxRowRoom, 1);
  }

  function onPageChangeRooms(page: number) {
    if (pageChangingRooms) return;

    setPageChangingRooms(true);
    setRooms([]);
    void getRooms(
        searchTerm,
        sortRoomsBy,
        sortRoomsDir,
        maxRowRoom,
        page,
    );
    setPageChangingRooms(false);
    setCurrentRoomPage(page);
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentRoomPage(1);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setCurrentRoomPage(1);
  };

  /** --- Form Validation and Control --- **/
  const handleAddRoomNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterAlphanumericDashUnderscore(e.target.value).slice(0, 50);
    setAddRoomName(val);
    setRoomNameError(!val.trim() ? "Room name is required." : "");
  };

  const handleEditRoomNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterAlphanumericDashUnderscore(e.target.value).slice(0, 50);
    setEditRoomName(val);
    setEditRoomNameError(!val.trim() ? "Room name is required." : "");
  };

  function loadEditData(row_id: string) {
    setRowID(row_id);
    const selectedRoom = rooms.find((item) => item.room_id === row_id);

    if (selectedRoom) {
      const name = selectedRoom.room_name || "";
      const type = selectedRoom.room_type || "";
      const floor =
          selectedRoom.floor_level !== null && selectedRoom.floor_level !== undefined
              ? String(selectedRoom.floor_level)
              : "1";

      setBaseRoomName(name);
      setBaseRoomType(type);
      setBaseFloorLevel(floor);

      setEditRoomName(name);
      setEditRoomType(type);
      setEditFloorLevel(floor);

      setOpenEditRoomModal(true);
    }
  }

  const handleCloseModals = () => {
    setRowID("");
    setRoomNameError("");
    setEditRoomNameError("");

    setOpenAddRoomModal(false);
    setOpenEditRoomModal(false);
    setOpenDeleteModal(false);

    setAddRoomName("");
    setAddRoomType("");
    setAddFloorLevel("1");

    setEditRoomName("");
    setEditRoomType("");
    setEditFloorLevel("1");
  };

  /** --- Server Integration Actions --- **/
  async function getRoomsCount(search?: string | null) {
    const response = await fetchRoomsCount(search);
    if (response?.success) {
      setRoomsCount(response.count);
    } else {
      setToastMessage(
          response?.error ?? "[fetchRoomsCount]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
      setRoomsCount(0);
    }
  }

  async function getRooms(
      search: string | null = searchTerm,
      sortby: string = sortRoomsBy,
      sortdir: string = sortRoomsDir,
      limit: number = maxRowRoom,
      page: number = currentRoomPage,
  ) {
    setLoading(true);

    const response = await fetchRooms(search, sortby, sortdir, limit, page);

    if (response?.success && response.data) {
      setRooms(response.data);
    } else {
      setToastMessage(
          response?.error ?? "[fetchRooms]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
      setRooms([]);
    }

    setLoading(false);
    await getRoomsCount(search);
  }

  async function handleRoomSubmit() {
    if (!addRoomName.trim()) {
      setRoomNameError("Room name is required.");
      return;
    }

    const floorNum = Number(addFloorLevel);

    const payload: RoomInput = {
      room_name: addRoomName.trim(),
      room_type: addRoomType.trim() || null,
      floor_level: floorNum,
    };

    const response = await createRoom(username ?? "system", payload);

    if (response?.success) {
      setToastMessage("Room created successfully");
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(
          response?.error ?? "[CreateRoom]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseModals();
    void getRooms(
        searchTerm,
        sortRoomsBy,
        sortRoomsDir,
        maxRowRoom,
        currentRoomPage,
    );
  }

  async function handleRoomUpdate() {
    if (!editRoomName.trim()) {
      setEditRoomNameError("Room name is required.");
      return;
    }

    const floorNum = Number(editFloorLevel);

    const payload: Partial<RoomInput> = {
      room_name: editRoomName.trim(),
      room_type: editRoomType.trim() || null,
      floor_level: floorNum,
    };

    const response = await updateRoom(username ?? "system", rowID, payload);

    if (response?.success) {
      setToastMessage("Room updated successfully");
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(
          response?.error ?? "[UpdateRoom]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseModals();
    void getRooms(
        searchTerm,
        sortRoomsBy,
        sortRoomsDir,
        maxRowRoom,
        currentRoomPage,
    );
  }

  async function handleRoomDelete() {
    const response = await deleteRoom(username ?? "system", rowID);

    if (response?.success) {
      setToastMessage("Room deleted successfully");
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(
          response?.error ?? "[DeleteRoom]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseModals();
    void getRooms(
        searchTerm,
        sortRoomsBy,
        sortRoomsDir,
        maxRowRoom,
        currentRoomPage,
    );
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
    const delayDebounceFn = setTimeout(() => {
      void getRooms(
          searchTerm,
          sortRoomsBy,
          sortRoomsDir,
          maxRowRoom,
          currentRoomPage,
      );
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const isAddFormInvalid = !addRoomName.trim() || !!roomNameError;

  const isEditFormInvalid = !editRoomName.trim() || !!editRoomNameError;

  const isEditUnchanged =
      editRoomName === baseRoomName &&
      editRoomType === baseRoomType &&
      editFloorLevel === baseFloorLevel;

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
          <div className="mb-4 flex-col justify-between gap-4 md:flex md:flex-row md:items-center">
            <div>
              <h2 className="mb-1 text-lg font-bold">Rooms Management</h2>
              <p className="text-gray-500">
                Manage facility locations, room configurations, and floor levels.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative mr-4 w-full md:w-64">
                <TextInput
                    id="search-rooms"
                    type="text"
                    placeholder="Search rooms..."
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
                  onClick={() => setOpenAddRoomModal(true)}
              >
                <FaPlus className="mr-2" />
                Add Room
              </Button>
            </div>
          </div>

          {/* Rooms Table */}
          <Card className="overflow-x-auto">
            <Table hoverable>
              <TableHead>
                <TableRow>
                  <TableHeadCell onClick={() => handleRoomSorting("room_name")}>
                    <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                      Room Name
                      {sortRoomsBy === "room_name" &&
                          (sortRoomsDir === "ASC" ? (
                              <FaSortUp className="ml-1" />
                          ) : (
                              <FaSortDown className="ml-1" />
                          ))}
                    </div>
                  </TableHeadCell>

                  <TableHeadCell onClick={() => handleRoomSorting("room_type")}>
                    <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                      Room Type
                      {sortRoomsBy === "room_type" &&
                          (sortRoomsDir === "ASC" ? (
                              <FaSortUp className="ml-1" />
                          ) : (
                              <FaSortDown className="ml-1" />
                          ))}
                    </div>
                  </TableHeadCell>

                  <TableHeadCell onClick={() => handleRoomSorting("floor_level")}>
                    <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                      Floor Level
                      {sortRoomsBy === "floor_level" &&
                          (sortRoomsDir === "ASC" ? (
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
                {rooms.length > 0 ? (
                    rooms.map((item) => (
                        <TableRow
                            key={item.room_id}
                            className="bg-white dark:border-gray-700 dark:bg-gray-800"
                        >
                          <TableCell className="font-medium text-gray-900 whitespace-nowrap dark:text-white">
                            {item.room_name}
                          </TableCell>
                          <TableCell>
                            {item.room_type_name || item.room_type || "—"}
                          </TableCell>
                          <TableCell>
                            {item.floor_level !== null ? `Floor ${item.floor_level}` : "—"}
                          </TableCell>
                          <TableCell>
                            <a
                                onClick={() => loadEditData(item.room_id)}
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
                          <span className="ml-4">Fetching rooms...</span>
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
                            ? `No rooms matching "${searchTerm}" found.`
                            : "No room entries found."}
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
                currentPage={currentRoomPage || 1}
                totalPages={Math.ceil(roomsCount / maxRowRoom) || 1}
                onPageChange={onPageChangeRooms}
                showIcons
            />
          </div>
        </div>

        {/* Modal: Add Room */}
        <Modal show={openAddRoomModal} onClose={handleCloseModals} size="md">
          <ModalHeader>Add New Room</ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <div>
                <Label htmlFor="room_name">Room Name *</Label>
                <TextInput
                    id="room_name"
                    placeholder="e.g. Lab 301"
                    value={addRoomName}
                    onChange={handleAddRoomNameChange}
                    color={roomNameError ? "failure" : "gray"}
                    maxLength={50}
                />
                <div className="mt-1 flex items-center justify-between">
                  {roomNameError ? (
                      <HelperText color="failure">{roomNameError}</HelperText>
                  ) : (
                      <span />
                  )}
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {addRoomName.length}/50
                  </span>
                </div>
              </div>

              <div>
                <Label htmlFor="room_type">Room Type</Label>
                <Select
                    id="room_type"
                    value={addRoomType}
                    onChange={(e) => setAddRoomType(e.target.value)}
                >
                  <option value="" hidden={true}>Select Room Type...</option>
                  {roomTypes.map((type) => (
                      <option key={type.room_type_id} value={type.room_type_id}>
                        {type.value}
                      </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="floor_level">Floor Level (1 - 30) *</Label>
                <Select
                    id="floor_level"
                    value={addFloorLevel}
                    onChange={(e) => setAddFloorLevel(e.target.value)}
                    className="[&_select]:max-h-40 [&_select]:overflow-y-auto"
                >
                  {Array.from({ length: 15 }, (_, i) => i + 1).map((floor) => (
                      <option key={floor} value={String(floor)}>
                        Floor {floor}
                      </option>
                  ))}
                </Select>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button onClick={handleRoomSubmit} disabled={isAddFormInvalid}>
              Create Room
            </Button>
            <Button color="alternative" onClick={handleCloseModals}>
              Cancel
            </Button>
          </ModalFooter>
        </Modal>

        {/* Modal: Edit Room */}
        <Modal show={openEditRoomModal} onClose={handleCloseModals} size="md">
          <ModalHeader>Edit Room</ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <div>
                <Label htmlFor="edit_room_name">Room Name *</Label>
                <TextInput
                    id="edit_room_name"
                    value={editRoomName}
                    onChange={handleEditRoomNameChange}
                    color={editRoomNameError ? "failure" : "gray"}
                    maxLength={50}
                />
                <div className="mt-1 flex items-center justify-between">
                  {editRoomNameError ? (
                      <HelperText color="failure">{editRoomNameError}</HelperText>
                  ) : (
                      <span />
                  )}
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                  {editRoomName.length}/50
                </span>
                </div>
              </div>

              <div>
                <Label htmlFor="edit_room_type">Room Type</Label>
                <Select
                    id="edit_room_type"
                    value={editRoomType}
                    onChange={(e) => setEditRoomType(e.target.value)}
                >
                  <option value="" hidden={true}>Select Room Type...</option>
                  {roomTypes.map((type) => (
                    <option key={type.room_type_id} value={type.room_type_id}>
                      {type.value}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="edit_floor_level">Floor Level (1 - 15) *</Label>
                <Select
                    id="edit_floor_level"
                    value={editFloorLevel}
                    onChange={(e) => setEditFloorLevel(e.target.value)}
                    className="[&_select]:max-h-40 [&_select]:overflow-y-auto"
                >
                  {Array.from({ length: 15 }, (_, i) => i + 1).map((floor) => (
                      <option key={floor} value={String(floor)}>
                        Floor {floor}
                      </option>
                  ))}
                </Select>
              </div>
            </div>
          </ModalBody>
          <ModalFooter className="flex justify-between">
            <Button
                color="red"
                onClick={() => {
                  setOpenEditRoomModal(false);
                  setOpenDeleteModal(true);
                }}
            >
              <FaTrash className="h-4 w-4" />
            </Button>

            <div className="flex gap-2">
              <Button
                  onClick={handleRoomUpdate}
                  disabled={isEditUnchanged || isEditFormInvalid}
              >
                Save Changes
              </Button>
              <Button color="alternative" onClick={handleCloseModals}>
                Cancel
              </Button>
            </div>
          </ModalFooter>
        </Modal>

        {/* Modal: Delete Confirmation */}
        <Modal
            show={openDeleteModal}
            onClose={handleCloseModals}
            size="md"
            popup
        >
          <ModalHeader />
          <ModalBody>
            <div className="text-center">
              <HiExclamation className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
              <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
                Are you sure you want to delete this room permanently?
              </h3>
              <div className="flex justify-center gap-4">
                <Button color="red" onClick={handleRoomDelete}>
                  Yes, I&#39;m sure
                </Button>
                <Button color="alternative" onClick={handleCloseModals}>
                  No, cancel
                </Button>
              </div>
            </div>
          </ModalBody>
        </Modal>
      </>
  );
}