"use client";

import {
    Button,
    Card,
    FileInput,
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
import {
    FaPlus,
    FaSortDown,
    FaSortUp,
    FaTrash,
    FaFileExcel,
    FaFileImport,
    FaFileExport,
    FaDownload,
} from "react-icons/fa6";
import { HiCheck, HiExclamation, HiX, HiSearch } from "react-icons/hi";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import { filterAlphanumericDashUnderscore } from "@/utils/validation";
import ExcelJS from "exceljs";

interface RoomTypeItem {
    room_type_id: string;
    value: string;
}

interface DataValidationRule {
    type: string;
    operator?: string;
    allowBlank: boolean;
    formulae: (string | number)[];
    showErrorMessage?: boolean;
    errorTitle?: string;
    error?: string;
}

interface WorksheetWithValidation extends ExcelJS.Worksheet {
    dataValidations: {
        add: (range: string, validation: DataValidationRule) => void;
    };
}

const REQUIRED_HEADERS = ["Room Name", "Room Type", "Floor Level"];
const MAX_ROW_ROOM = 10;

export default function RoomsManagement() {
    const { instance, accounts } = useMsal();
    const activeAccount = useMemo(
        () => instance.getActiveAccount() || accounts[0],
        [instance, accounts]
    );
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
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // --- Modal States --- //
    const [openAddRoomModal, setOpenAddRoomModal] = useState(false);
    const [openEditRoomModal, setOpenEditRoomModal] = useState(false);
    const [openDeleteModal, setOpenDeleteModal] = useState(false);
    const [openExcelModal, setOpenExcelModal] = useState(false);

    // --- Excel Modal Options --- //
    const [activeExcelTab, setActiveExcelTab] = useState<"import" | "export" | "template">("import");
    const [importFile, setImportFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importLogs, setImportLogs] = useState<string[]>([]);
    const [formatError, setFormatError] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Form & Validation States --- //
    const [rowID, setRowID] = useState("");
    const [roomNameError, setRoomNameError] = useState("");
    const [roomTypeError, setRoomTypeError] = useState("");
    const [editRoomNameError, setEditRoomNameError] = useState("");
    const [editRoomTypeError, setEditRoomTypeError] = useState("");

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
    const [currentRoomPage, setCurrentRoomPage] = useState(1);
    const [pageChangingRooms, setPageChangingRooms] = useState(false);

    // --- Toast State --- //
    const [showToast, setShowToast] = useState(false);
    const [toastType, setToastType] = useState("");
    const [toastMessage, setToastMessage] = useState("");
    const [showToastTimer, setShowToastTimer] = useState(false);
    const [progress, setProgress] = useState(0);

    const roomTypeMap = useMemo(() => {
        const map = new Map<string, string>();
        roomTypes.forEach((rt) => map.set(rt.room_type_id, rt.value));
        return map;
    }, [roomTypes]);

    /** --- Helper for Triggering File Downloads --- **/
    const downloadWorkbook = (buffer: ArrayBuffer, filename: string) => {
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        window.URL.revokeObjectURL(url);
    };

    /** --- Toast Timer --- **/
    const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

    const clearToastTimer = useCallback(() => {
        if (toastTimerRef.current) {
            clearInterval(toastTimerRef.current);
            toastTimerRef.current = null;
        }
    }, []);

    const closeToast = useCallback(() => {
        clearToastTimer();
        setShowToast(false);
        setToastType("");
        setToastMessage("");
        setShowToastTimer(false);
    }, [clearToastTimer]);

    const triggerToast = useCallback((msg: string, type: "success" | "warning" | "error" = "success") => {
        clearToastTimer();
        setToastMessage(msg);
        setToastType(type);
        setShowToast(true);
        setShowToastTimer(true);
        setProgress(0);

        const duration = 5000;
        const intervalTime = 50;
        const step = 100 / (duration / intervalTime);

        toastTimerRef.current = setInterval(() => {
            setProgress((prev) => {
                if (prev + step >= 100) {
                    clearToastTimer();
                    setShowToast(false);
                    setShowToastTimer(false);
                    return 100;
                }
                return prev + step;
            });
        }, intervalTime);
    }, [clearToastTimer]);

    useEffect(() => {
        return () => clearToastTimer();
    }, [clearToastTimer]);

    /** --- Fetch Room Types Dropdown Options --- **/
    const loadRoomTypes = useCallback(async () => {
        const response = await fetchRoomTypeList(null, "ASC", 100, 1);
        if (response?.success && response.data) {
            setRoomTypes(response.data as RoomTypeItem[]);
        }
    }, []);

    useEffect(() => {
        document.title = "AceHub | Rooms";
        void loadRoomTypes();
    }, [loadRoomTypes]);

    // Debounce search input
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentRoomPage(1);
        }, 250);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    /** --- Table Data Query Handlers --- **/
    const getRoomsCount = useCallback(async (search?: string | null) => {
        const response = await fetchRoomsCount(search);
        if (response?.success) {
            setRoomsCount(response.count);
        } else {
            triggerToast(
                response?.error ?? "[fetchRoomsCount]: An unexpected error occurred",
                "error"
            );
            setRoomsCount(0);
        }
    }, [triggerToast]);

    const getRooms = useCallback(async (
        search: string | null = debouncedSearch,
        sortby: string = sortRoomsBy,
        sortdir: string = sortRoomsDir,
        limit: number = MAX_ROW_ROOM,
        page: number = currentRoomPage,
    ) => {
        setLoading(true);

        const response = await fetchRooms(search, sortby, sortdir, limit, page);

        if (response?.success && response.data) {
            setRooms(response.data);
        } else {
            triggerToast(
                response?.error ?? "[fetchRooms]: An unexpected error occurred",
                "error"
            );
            setRooms([]);
        }

        setLoading(false);
        await getRoomsCount(search);
    }, [debouncedSearch, sortRoomsBy, sortRoomsDir, currentRoomPage, getRoomsCount, triggerToast]);

    useEffect(() => {
        void getRooms(
            debouncedSearch,
            sortRoomsBy,
            sortRoomsDir,
            MAX_ROW_ROOM,
            currentRoomPage
        );
    }, [debouncedSearch, sortRoomsBy, sortRoomsDir, currentRoomPage, getRooms]);

    /** --- Table Sorting & Pagination Handlers --- **/
    const handleRoomSorting = useCallback((sortByColumn: string) => {
        setSortRoomsBy((prevSort) => {
            if (prevSort === sortByColumn) {
                setSortRoomsDir((prevDir) => (prevDir === "ASC" ? "DESC" : "ASC"));
            } else {
                setSortRoomsDir("ASC");
            }
            return sortByColumn;
        });
        setRooms([]);
        setCurrentRoomPage(1);
    }, []);

    const onPageChangeRooms = useCallback((page: number) => {
        if (pageChangingRooms) return;
        setPageChangingRooms(true);
        setRooms([]);
        setCurrentRoomPage(page);
        setPageChangingRooms(false);
    }, [pageChangingRooms]);

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    }, []);

    const handleClearSearch = useCallback(() => {
        setSearchTerm("");
        setDebouncedSearch("");
        setCurrentRoomPage(1);
    }, []);

    /** --- Form Validation and Controls --- **/
    const handleAddRoomNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = filterAlphanumericDashUnderscore(e.target.value).slice(0, 50);
        setAddRoomName(val);
        setRoomNameError(!val.trim() ? "Room name is required." : "");
    }, []);

    const handleAddRoomTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setAddRoomType(val);
        setRoomTypeError(!val ? "Room type is required." : "");
    }, []);

    const handleEditRoomNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = filterAlphanumericDashUnderscore(e.target.value).slice(0, 50);
        setEditRoomName(val);
        setEditRoomNameError(!val.trim() ? "Room name is required." : "");
    }, []);

    const handleEditRoomTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setEditRoomType(val);
        setEditRoomTypeError(!val ? "Room type is required." : "");
    }, []);

    const loadEditData = useCallback((row_id: string) => {
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

            setEditRoomNameError("");
            setEditRoomTypeError("");
            setOpenEditRoomModal(true);
        }
    }, [rooms]);

    const handleCloseModals = useCallback(() => {
        setRowID("");
        setRoomNameError("");
        setRoomTypeError("");
        setEditRoomNameError("");
        setEditRoomTypeError("");

        setOpenAddRoomModal(false);
        setOpenEditRoomModal(false);
        setOpenDeleteModal(false);
        setOpenExcelModal(false);

        setImportFile(null);
        setImportLogs([]);
        setFormatError("");
        setIsImporting(false);

        setAddRoomName("");
        setAddRoomType("");
        setAddFloorLevel("1");

        setEditRoomName("");
        setEditRoomType("");
        setEditFloorLevel("1");
    }, []);

    /** --- Server Operations --- **/
    const handleRoomSubmit = useCallback(async () => {
        let hasError = false;
        if (!addRoomName.trim()) {
            setRoomNameError("Room name is required.");
            hasError = true;
        }
        if (!addRoomType) {
            setRoomTypeError("Room type is required.");
            hasError = true;
        }
        if (hasError) return;

        const payload: RoomInput = {
            room_name: addRoomName.trim(),
            room_type: addRoomType.trim(),
            floor_level: Number(addFloorLevel),
        };

        const response = await createRoom(username ?? "system", payload);

        if (response?.success) {
            triggerToast("Room created successfully", "success");
            handleCloseModals();
            void getRooms();
        } else {
            triggerToast(response?.error ?? "[CreateRoom]: An unexpected error occurred", "error");
        }
    }, [addRoomName, addRoomType, addFloorLevel, username, triggerToast, handleCloseModals, getRooms]);

    const handleRoomUpdate = useCallback(async () => {
        let hasError = false;
        if (!editRoomName.trim()) {
            setEditRoomNameError("Room name is required.");
            hasError = true;
        }
        if (!editRoomType) {
            setEditRoomTypeError("Room type is required.");
            hasError = true;
        }
        if (hasError) return;

        const payload: Partial<RoomInput> = {
            room_name: editRoomName.trim(),
            room_type: editRoomType.trim(),
            floor_level: Number(editFloorLevel),
        };

        const response = await updateRoom(username ?? "system", rowID, payload);

        if (response?.success) {
            triggerToast("Room updated successfully", "success");
            handleCloseModals();
            void getRooms();
        } else {
            triggerToast(response?.error ?? "[UpdateRoom]: An unexpected error occurred", "error");
        }
    }, [editRoomName, editRoomType, editFloorLevel, username, rowID, triggerToast, handleCloseModals, getRooms]);

    const handleRoomDelete = useCallback(async () => {
        const response = await deleteRoom(username ?? "system", rowID);

        if (response?.success) {
            triggerToast("Room deleted successfully", "success");
            handleCloseModals();
            void getRooms();
        } else {
            triggerToast(response?.error ?? "[DeleteRoom]: An unexpected error occurred", "error");
        }
    }, [username, rowID, triggerToast, handleCloseModals, getRooms]);

    /** --- Excel Operations (ExcelJS) --- **/
    const handleDownloadTemplate = useCallback(async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Template") as unknown as WorksheetWithValidation;

        // Generous, un-cramped column width definitions (accounting for dropdown arrow icons)
        worksheet.columns = [
            { header: "Room Name", key: "room_name", width: 32 },
            { header: "Room Type", key: "room_type", width: 42 },
            { header: "Floor Level", key: "floor_level", width: 20 },
        ];

        worksheet.addRow({
            room_name: "Lab 101",
            room_type: roomTypes[0]?.value || "Lecture Room",
            floor_level: 1,
        });

        const typeValues = roomTypes.map((rt) => rt.value.replace(/"/g, '""')).join(",");
        const validationFormula = `"${typeValues}"`;

        worksheet.dataValidations.add("B2:B1000", {
            type: "list",
            allowBlank: false,
            formulae: [validationFormula],
            showErrorMessage: true,
            errorTitle: "Invalid Room Type",
            error: "Please select a valid room type from the dropdown list.",
        });

        const buffer = await workbook.xlsx.writeBuffer();
        downloadWorkbook(buffer, "Rooms_Import_Template.xlsx");

        triggerToast("Blank Excel template downloaded successfully with dynamic room type options!", "success");
    }, [roomTypes, triggerToast]);

    const handleExportExcel = useCallback(async () => {
        try {
            const response = await fetchRooms(debouncedSearch, sortRoomsBy, sortRoomsDir, 10000, 1);
            const exportList = response?.success && response.data ? response.data : rooms;

            if (exportList.length === 0) {
                triggerToast("No room records available to export.", "warning");
                return;
            }

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("Rooms") as unknown as WorksheetWithValidation;

            worksheet.columns = [
                { header: "No.", key: "no", width: 10 },
                { header: "Room Name", key: "room_name", width: 32 },
                { header: "Room Type", key: "room_type", width: 42 },
                { header: "Floor Level", key: "floor_level", width: 20 },
            ];

            exportList.forEach((item, index) => {
                worksheet.addRow({
                    no: index + 1,
                    room_name: item.room_name || "",
                    room_type: (item.room_type ? roomTypeMap.get(item.room_type) : null) || item.room_type_name || item.room_type || "—",
                    floor_level: item.floor_level !== null && item.floor_level !== undefined ? item.floor_level : "—",
                });
            });

            const typeValues = roomTypes.map((rt) => rt.value.replace(/"/g, '""')).join(",");
            worksheet.dataValidations.add("C2:C1000", {
                type: "list",
                allowBlank: false,
                formulae: [`"${typeValues}"`],
            });

            const buffer = await workbook.xlsx.writeBuffer();
            downloadWorkbook(buffer, `Rooms_Export_${new Date().toISOString().split("T")[0]}.xlsx`);

            triggerToast("Rooms exported to Excel successfully", "success");
        } catch (err) {
            console.error(err);
            triggerToast("Failed to export rooms to Excel", "error");
        }
    }, [debouncedSearch, sortRoomsBy, sortRoomsDir, rooms, roomTypeMap, roomTypes, triggerToast]);

    const validateAndSelectFile = useCallback((file: File | null) => {
        setFormatError("");
        setImportLogs([]);

        if (!file) return;

        const validExtensions = [".xlsx", ".xls", ".csv"];
        const fileName = file.name.toLowerCase();
        const isValid = validExtensions.some((ext) => fileName.endsWith(ext));

        if (!isValid) {
            setFormatError("Invalid file type. Strictly accepts Excel files (.xlsx, .xls) or .csv.");
            setImportFile(null);
            return;
        }

        setImportFile(file);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            validateAndSelectFile(e.dataTransfer.files[0]);
        }
    }, [validateAndSelectFile]);

    const handleImportSubmit = useCallback(async () => {
        if (!importFile) return;

        setIsImporting(true);
        setFormatError("");
        setImportLogs(["Reading Excel workbook with ExcelJS..."]);

        try {
            const buffer = await importFile.arrayBuffer();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);

            const worksheet = workbook.worksheets[0];
            if (!worksheet || worksheet.rowCount === 0) {
                setFormatError("The uploaded Excel file contains no worksheets or data.");
                setIsImporting(false);
                return;
            }

            const headerRow = worksheet.getRow(1);
            const uploadedHeaders: string[] = [];
            headerRow.eachCell((cell) => {
                if (cell.value) uploadedHeaders.push(String(cell.value).trim());
            });

            const isHeaderValid = REQUIRED_HEADERS.every((reqHeader) =>
                uploadedHeaders.some((uh) => uh.toLowerCase() === reqHeader.toLowerCase())
            );

            if (!isHeaderValid) {
                setFormatError(
                    `Strict Format Violation: Missing required headers. Your file must include: [${REQUIRED_HEADERS.join(", ")}]`
                );
                setIsImporting(false);
                return;
            }

            setImportLogs((prev) => [...prev, `Headers verified. Processing rows...`]);

            let successCount = 0;
            let failCount = 0;
            const logs: string[] = [];

            const typeNameToIdMap = new Map<string, string>();
            roomTypes.forEach((rt) => {
                typeNameToIdMap.set(rt.value.toLowerCase().trim(), rt.room_type_id);
                typeNameToIdMap.set(rt.room_type_id.toLowerCase().trim(), rt.room_type_id);
            });

            const headerIndexMap: Record<string, number> = {};
            headerRow.eachCell((cell, colNumber) => {
                if (cell.value) {
                    headerIndexMap[String(cell.value).trim().toLowerCase()] = colNumber;
                }
            });

            const nameCol = headerIndexMap["room name"] || 1;
            const typeCol = headerIndexMap["room type"] || 2;
            const floorCol = headerIndexMap["floor level"] || 3;

            const rowsToProcess: { rowNum: number; name: string; typeId: string; floor: number }[] = [];

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;
                const rawName = String(row.getCell(nameCol).value || "").trim();
                const rawType = String(row.getCell(typeCol).value || "").trim();
                const rawFloor = Number(row.getCell(floorCol).value || 1);

                if (!rawName) {
                    logs.push(`Row ${rowNumber}: Skipped. Room Name is empty.`);
                    failCount++;
                    return;
                }

                const matchedTypeId = typeNameToIdMap.get(rawType.toLowerCase());
                if (!matchedTypeId) {
                    logs.push(`Row ${rowNumber} (${rawName}): Failed. Room type "${rawType}" not found.`);
                    failCount++;
                    return;
                }

                const floorLevel = isNaN(rawFloor) ? 1 : Math.max(1, Math.min(15, rawFloor));
                rowsToProcess.push({
                    rowNum: rowNumber,
                    name: rawName,
                    typeId: matchedTypeId,
                    floor: floorLevel,
                });
            });

            for (const item of rowsToProcess) {
                const payload: RoomInput = {
                    room_name: filterAlphanumericDashUnderscore(item.name).slice(0, 50),
                    room_type: item.typeId,
                    floor_level: item.floor,
                };

                const res = await createRoom(username ?? "system", payload);
                if (res?.success) {
                    successCount++;
                } else {
                    logs.push(`Row ${item.rowNum} (${item.name}): ${res?.error || "Creation failed."}`);
                    failCount++;
                }
            }

            setImportLogs((prev) => [
                ...prev,
                `Import Completed: ${successCount} successful, ${failCount} failed.`,
                ...logs,
            ]);

            if (successCount > 0) {
                triggerToast(`Imported ${successCount} rooms successfully.`, "success");
                void getRooms();
            }
        } catch (err) {
            console.error(err);
            setFormatError("Error: Unable to parse Excel workbook format using ExcelJS.");
        } finally {
            setIsImporting(false);
        }
    }, [importFile, roomTypes, username, triggerToast, getRooms]);

    const isAddFormInvalid =
        !addRoomName.trim() || !addRoomType || Boolean(roomNameError) || Boolean(roomTypeError);

    const isEditFormInvalid =
        !editRoomName.trim() || !editRoomType || Boolean(editRoomNameError) || Boolean(editRoomTypeError);

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
                        <ToastToggle onDismiss={closeToast} />
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

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative mr-2 w-full md:w-64">
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
                            color="gray"
                            className="whitespace-nowrap"
                            onClick={() => setOpenExcelModal(true)}
                        >
                            <FaFileExcel className="mr-2 text-green-600 h-4 w-4" />
                            Excel Operations
                        </Button>

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
                                        <TableCell className="font-medium whitespace-nowrap text-gray-900 dark:text-white">
                                            {item.room_name}
                                        </TableCell>
                                        <TableCell>
                                            {(item.room_type ? roomTypeMap.get(item.room_type) : null) ||
                                                item.room_type_name ||
                                                item.room_type ||
                                                "—"}
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
                                        {debouncedSearch
                                            ? `No rooms matching "${debouncedSearch}" found.`
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
                        totalPages={Math.ceil(roomsCount / MAX_ROW_ROOM) || 1}
                        onPageChange={onPageChangeRooms}
                        showIcons
                    />
                </div>
            </div>

            {/* Modal: Consolidated Excel Operations */}
            <Modal show={openExcelModal} onClose={handleCloseModals} size="lg">
                <ModalHeader>
                    <div className="flex items-center gap-2">
                        <FaFileExcel className="text-green-600 h-5 w-5" />
                        <span>Excel Operations & Data Management</span>
                    </div>
                </ModalHeader>
                <ModalBody>
                    <div className="flex flex-col gap-5">
                        {/* Action Switcher Cards */}
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                type="button"
                                onClick={() => setActiveExcelTab("import")}
                                className={`flex flex-col items-center justify-center rounded-xl border p-3.5 text-center transition-all ${
                                    activeExcelTab === "import"
                                        ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                                }`}
                            >
                                <FaFileImport className="mb-1.5 h-6 w-6 text-blue-600" />
                                <span className="text-xs font-semibold">Import Excel</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveExcelTab("export")}
                                className={`flex flex-col items-center justify-center rounded-xl border p-3.5 text-center transition-all ${
                                    activeExcelTab === "export"
                                        ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                                }`}
                            >
                                <FaFileExport className="mb-1.5 h-6 w-6 text-green-600" />
                                <span className="text-xs font-semibold">Export Rooms</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveExcelTab("template")}
                                className={`flex flex-col items-center justify-center rounded-xl border p-3.5 text-center transition-all ${
                                    activeExcelTab === "template"
                                        ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                                }`}
                            >
                                <FaDownload className="mb-1.5 h-6 w-6 text-emerald-600" />
                                <span className="text-xs font-semibold">Blank Template</span>
                            </button>
                        </div>

                        {/* TAB 1: IMPORT WITH DRAG & DROP & VALIDATION */}
                        {activeExcelTab === "import" && (
                            <div className="space-y-4">
                                <div
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all ${
                                        isDragging
                                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                                            : "border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                                    }`}
                                >
                                    <FileInput
                                        id="excel-file-input"
                                        ref={fileInputRef}
                                        accept=".xlsx, .xls, .csv"
                                        onChange={(e) =>
                                            validateAndSelectFile(e.target.files ? e.target.files[0] : null)
                                        }
                                        className="hidden"
                                    />
                                    <FaFileImport className="mx-auto mb-2 h-8 w-8 text-blue-500" />
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {importFile ? importFile.name : "Drag & drop your Excel file here or browse"}
                                    </p>
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        {importFile
                                            ? `${(importFile.size / 1024).toFixed(1)} KB`
                                            : "Strictly accepts .xlsx, .xls, or .csv files"}
                                    </p>
                                </div>

                                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
                                    <span className="font-semibold uppercase tracking-wide">Strict Header Standard:</span> Headers must strictly contain{" "}
                                    <b>Room Name</b>, <b>Room Type</b>, and <b>Floor Level</b>.
                                </div>

                                {formatError && (
                                    <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                                        <HiExclamation className="h-4 w-4 shrink-0 text-red-500" />
                                        <div>{formatError}</div>
                                    </div>
                                )}

                                {importLogs.length > 0 && (
                                    <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-gray-900 p-3 font-mono text-xs dark:border-gray-700">
                                        {importLogs.map((log, index) => (
                                            <div
                                                key={index}
                                                className={
                                                    log.includes("Error") || log.includes("Failed") || log.includes("Skipped")
                                                        ? "text-red-400"
                                                        : log.includes("Completed") || log.includes("Found")
                                                            ? "font-bold text-green-400"
                                                            : "text-gray-300"
                                                }
                                            >
                                                {log}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <Button
                                    onClick={handleImportSubmit}
                                    disabled={!importFile || isImporting}
                                    className="w-full"
                                >
                                    {isImporting ? (
                                        <>
                                            <Spinner size="sm" className="mr-2" />
                                            Processing & Validating...
                                        </>
                                    ) : (
                                        "Execute Excel Import"
                                    )}
                                </Button>
                            </div>
                        )}

                        {/* TAB 2: EXPORT */}
                        {activeExcelTab === "export" && (
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-4 dark:border-gray-700 dark:bg-gray-800">
                                <div>
                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                        Export Filtered Room Records
                                    </h4>
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        Generates a standardized Excel spreadsheet containing all active query results.
                                    </p>
                                </div>
                                <Button onClick={handleExportExcel} className="w-full" color="green">
                                    <FaFileExport className="mr-2 h-4 w-4" /> Export {roomsCount} Rooms to Excel
                                </Button>
                            </div>
                        )}

                        {/* TAB 3: DOWNLOAD BLANK TEMPLATE */}
                        {activeExcelTab === "template" && (
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-4 dark:border-gray-700 dark:bg-gray-800">
                                <div>
                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                        Download Blank Excel Template
                                    </h4>
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        Includes un-cramped formatted columns (<b className="font-mono">Room Name, Room Type, Floor Level</b>) and dynamic dropdown validation populated from active database room types.
                                    </p>
                                </div>
                                <Button onClick={handleDownloadTemplate} className="w-full" color="blue">
                                    <FaDownload className="mr-2 h-4 w-4" /> Download Blank Excel Template
                                </Button>
                            </div>
                        )}
                    </div>
                </ModalBody>
                <ModalFooter className="flex justify-end">
                    <Button color="alternative" onClick={handleCloseModals}>
                        Close Window
                    </Button>
                </ModalFooter>
            </Modal>

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
                            <Label htmlFor="room_type">Room Type *</Label>
                            <Select
                                id="room_type"
                                value={addRoomType}
                                onChange={handleAddRoomTypeChange}
                                color={roomTypeError ? "failure" : "gray"}
                            >
                                <option value="" hidden={true}>
                                    Select Room Type...
                                </option>
                                {roomTypes.map((type) => (
                                    <option key={type.room_type_id} value={type.room_type_id}>
                                        {type.value}
                                    </option>
                                ))}
                            </Select>
                            {roomTypeError && (
                                <HelperText color="failure" className="mt-1">
                                    {roomTypeError}
                                </HelperText>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="floor_level">Floor Level (1 - 10) *</Label>
                            <Select
                                id="floor_level"
                                value={addFloorLevel}
                                onChange={(e) => setAddFloorLevel(e.target.value)}
                                className="[&_select]:max-h-40 [&_select]:overflow-y-auto"
                            >
                                {Array.from({ length: 10 }, (_, i) => i + 1).map((floor) => (
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
                            <Label htmlFor="edit_room_type">Room Type *</Label>
                            <Select
                                id="edit_room_type"
                                value={editRoomType}
                                onChange={handleEditRoomTypeChange}
                                color={editRoomTypeError ? "failure" : "gray"}
                            >
                                <option value="" hidden={true}>
                                    Select Room Type...
                                </option>
                                {roomTypes.map((type) => (
                                    <option key={type.room_type_id} value={type.room_type_id}>
                                        {type.value}
                                    </option>
                                ))}
                            </Select>
                            {editRoomTypeError && (
                                <HelperText color="failure" className="mt-1">
                                    {editRoomTypeError}
                                </HelperText>
                            )}
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
            <Modal show={openDeleteModal} onClose={handleCloseModals} size="md" popup>
                <ModalHeader />
                <ModalBody>
                    <div className="text-center">
                        <HiExclamation className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
                        <h3 className="mb-2 text-lg font-normal text-gray-500 dark:text-gray-400">
                            Are you sure you want to delete this room permanently?
                        </h3>
                        <p className="mb-5 text-sm text-gray-400 dark:text-gray-500">
                            Deleting this room will cause all schedules assigned to it to become unassigned without rooms.
                        </p>
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