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
    ToastToggle,
    Tooltip,
} from "flowbite-react";
import {
    FaBan,
    FaPlus,
    FaSortDown,
    FaSortUp,
    FaUserSlash,
} from "react-icons/fa6";
import { HiCheck } from "react-icons/hi2";
import { useEffect, useState } from "react";
import { HiExclamation, HiX, HiSearch } from "react-icons/hi";
import {
    filterAlpha,
    filterAlphaDashSpace,
    filterAlphanumericDashUnderscore,
    filterEmail,
} from "@/utils/validation";
import { useMsal } from "@azure/msal-react";
import {
    createTeacher,
    fetchTeachers,
    fetchTeachersCount,
    updateTeacher,
    archiveTeacher,
} from "@/app/actions/system";

export interface Teacher {
    teacher_id: string;
    pscs_id: string | null;
    email: string | null;
    f_name: string | null;
    m_name: string | null;
    surname: string | null;
    suffix: string | null;
    teacher_code: string | null;
    specialization: string | null;
    employment_type: string | null;
    availability?: Record<string, unknown> | null;
    preferences?: Record<string, unknown> | null;
    created_at?: string;
    updated_at?: string;
    is_archived?: boolean;
}

export default function TeachersManagement() {
    const { instance, accounts } = useMsal();
    const activeAccount = instance.getActiveAccount() || accounts[0];
    const username = activeAccount?.username;
    const [isLoading, setLoading] = useState(true);

    // --- Table Constants --- //
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [teachersCount, setTeachersCount] = useState(0);
    const [sortTeachersBy, setSortTeachersBy] = useState("surname");
    const [sortTeachersDir, setSortTeachersDir] = useState("ASC");
    const [searchTerm, setSearchTerm] = useState("");

    // --- Modal Constants --- //
    const [openAddTeacherModal, setOpenAddTeacherModal] = useState(false);
    const [openEditTeacherModal, setOpenEditTeacherModal] = useState(false);
    const [openArchiveModal, setOpenArchiveModal] = useState(false);

    // --- Form Error States --- //
    const [rowID, setRowID] = useState("");
    const [emailError, setEmailError] = useState("");
    const [editEmailError, setEditEmailError] = useState("");

    // --- Add Form State --- //
    const [inputPscsId, setInputPscsId] = useState("");
    const [inputEmail, setInputEmail] = useState("");
    const [inputFName, setInputFName] = useState("");
    const [inputMName, setInputMName] = useState("");
    const [inputSurname, setInputSurname] = useState("");
    const [inputSuffix, setInputSuffix] = useState("");
    const [inputTeacherCode, setInputTeacherCode] = useState("");
    const [inputSpecialization, setInputSpecialization] = useState("");
    const [inputEmploymentType, setInputEmploymentType] = useState("Full-Time");

    // --- Edit Form State --- //
    const [newPscsId, editPscsId] = useState("");
    const [newEmail, editEmail] = useState("");
    const [newFName, editFName] = useState("");
    const [newMName, editMName] = useState("");
    const [newSurname, editSurname] = useState("");
    const [newSuffix, editSuffix] = useState("");
    const [newTeacherCode, editTeacherCode] = useState("");
    const [newSpecialization, editSpecialization] = useState("");
    const [newEmploymentType, editEmploymentType] = useState("Full-Time");

    // --- Baseline Comparison State --- //
    const [basePscsId, setBasePscsId] = useState("");
    const [baseEmail, setBaseEmail] = useState("");
    const [baseFName, setBaseFName] = useState("");
    const [baseMName, setBaseMName] = useState("");
    const [baseSurname, setBaseSurname] = useState("");
    const [baseSuffix, setBaseSuffix] = useState("");
    const [baseTeacherCode, setBaseTeacherCode] = useState("");
    const [baseSpecialization, setBaseSpecialization] = useState("");
    const [baseEmploymentType, setBaseEmploymentType] = useState("Full-Time");

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

    /**************
     *  FUNCTIONS *
     **************/

    /** --- Validation Utilities --- **/

        // Strict email format validation regex
    const validateEmailFormat = (email: string): boolean => {
            const emailRegex = /^[a-zA-Z0-9]+([._+-][a-zA-Z0-9]+)*@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;
            return emailRegex.test(email);
        };

    /** --- Table Functions --- **/
    function handleTeacherSorting(sortBy: string) {
        const newDir =
            sortBy === sortTeachersBy && sortTeachersDir === "ASC" ? "DESC" : "ASC";
        setSortTeachersBy(sortBy);
        setSortTeachersDir(newDir);
        setTeachers([]);
        setCurrentTeacherPage(1);
        void getTeachers(searchTerm, sortBy, newDir, maxRowTeacher, 1);
    }

    function onPageChangeTeachers(page: number) {
        if (pageChangingTeachers) return;

        setPageChangingTeachers(true);
        setTeachers([]);

        void getTeachers(
            searchTerm,
            sortTeachersBy,
            sortTeachersDir,
            maxRowTeacher,
            page
        );

        setPageChangingTeachers(false);
        setCurrentTeacherPage(page);
    }

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentTeacherPage(1);
    };

    const handleClearSearch = () => {
        setSearchTerm("");
        setCurrentTeacherPage(1);
    };

    /** --- Input Change Handlers with Validation --- **/

        // Email Input Handlers
    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const val = filterEmail(e.target.value);
            setInputEmail(val);

            if (!val) {
                setEmailError("Email is required.");
            } else if (!validateEmailFormat(val)) {
                setEmailError("Please enter a valid email address (e.g. user@domain.com).");
            } else {
                setEmailError("");
            }
        };

    const handleNewEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = filterEmail(e.target.value);
        editEmail(val);

        if (!val) {
            setEditEmailError("Email is required.");
        } else if (!validateEmailFormat(val)) {
            setEditEmailError("Please enter a valid email address (e.g. user@domain.com).");
        } else {
            setEditEmailError("");
        }
    };

    // Add Form Handlers
    const handlePscsIdChange = (e: React.ChangeEvent<HTMLInputElement>) =>
        setInputPscsId(filterAlphanumericDashUnderscore(e.target.value));

    const handleTeacherCodeChange = (e: React.ChangeEvent<HTMLInputElement>) =>
        setInputTeacherCode(filterAlphanumericDashUnderscore(e.target.value));

    const handleFNameChange = (e: React.ChangeEvent<HTMLInputElement>) =>
        setInputFName(filterAlphaDashSpace(e.target.value));

    const handleMNameChange = (e: React.ChangeEvent<HTMLInputElement>) =>
        setInputMName(filterAlphaDashSpace(e.target.value));

    const handleSurnameChange = (e: React.ChangeEvent<HTMLInputElement>) =>
        setInputSurname(filterAlphaDashSpace(e.target.value));

    const handleSuffixChange = (e: React.ChangeEvent<HTMLInputElement>) =>
        setInputSuffix(filterAlpha(e.target.value));

    const handleSpecializationChange = (e: React.ChangeEvent<HTMLInputElement>) =>
        setInputSpecialization(filterAlphaDashSpace(e.target.value));

    // Edit Form Handlers
    const handleNewPscsIdChange = (e: React.ChangeEvent<HTMLInputElement>) =>
        editPscsId(filterAlphanumericDashUnderscore(e.target.value));

    const handleNewTeacherCodeChange = (e: React.ChangeEvent<HTMLInputElement>) =>
        editTeacherCode(filterAlphanumericDashUnderscore(e.target.value));

    const handleNewFNameChange = (e: React.ChangeEvent<HTMLInputElement>) =>
        editFName(filterAlphaDashSpace(e.target.value));

    const handleNewMNameChange = (e: React.ChangeEvent<HTMLInputElement>) =>
        editMName(filterAlphaDashSpace(e.target.value));

    const handleNewSurnameChange = (e: React.ChangeEvent<HTMLInputElement>) =>
        editSurname(filterAlphaDashSpace(e.target.value));

    const handleNewSuffixChange = (e: React.ChangeEvent<HTMLInputElement>) =>
        editSuffix(filterAlpha(e.target.value));

    const handleNewSpecializationChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => editSpecialization(filterAlphaDashSpace(e.target.value));

    /** --- Form Helpers --- **/
    function loadEditData(row_id: string) {
        setRowID(row_id);
        setOpenEditTeacherModal(true);

        const selectedTeacher = teachers.find((item) => item.teacher_id === row_id);

        if (selectedTeacher) {
            const pscs = selectedTeacher.pscs_id ?? "";
            const emailVal = selectedTeacher.email ?? "";
            const fname = selectedTeacher.f_name ?? "";
            const mname = selectedTeacher.m_name ?? "";
            const sname = selectedTeacher.surname ?? "";
            const sfx = selectedTeacher.suffix ?? "";
            const code = selectedTeacher.teacher_code ?? "";
            const spec = selectedTeacher.specialization ?? "";
            const emp = selectedTeacher.employment_type ?? "Full-Time";

            setBasePscsId(pscs);
            setBaseEmail(emailVal);
            setBaseFName(fname);
            setBaseMName(mname);
            setBaseSurname(sname);
            setBaseSuffix(sfx);
            setBaseTeacherCode(code);
            setBaseSpecialization(spec);
            setBaseEmploymentType(emp);

            editPscsId(pscs);
            editEmail(emailVal);
            editFName(fname);
            editMName(mname);
            editSurname(sname);
            editSuffix(sfx);
            editTeacherCode(code);
            editSpecialization(spec);
            editEmploymentType(emp);
        }
    }

    const handleCloseTeacherModals = () => {
        setRowID("");
        setEmailError("");
        setEditEmailError("");
        setOpenAddTeacherModal(false);
        setOpenEditTeacherModal(false);
        setOpenArchiveModal(false);

        setInputPscsId("");
        setInputEmail("");
        setInputFName("");
        setInputMName("");
        setInputSurname("");
        setInputSuffix("");
        setInputTeacherCode("");
        setInputSpecialization("");
        setInputEmploymentType("Full-Time");

        editPscsId("");
        editEmail("");
        editFName("");
        editMName("");
        editSurname("");
        editSuffix("");
        editTeacherCode("");
        editSpecialization("");
        editEmploymentType("Full-Time");
    };

    /** --- Change Detection Helper for Edit Form --- **/
    const isEditFormUnchanged =
        newPscsId === basePscsId &&
        newEmail === baseEmail &&
        newFName === baseFName &&
        newMName === baseMName &&
        newSurname === baseSurname &&
        newSuffix === baseSuffix &&
        newTeacherCode === baseTeacherCode &&
        newSpecialization === baseSpecialization &&
        newEmploymentType === baseEmploymentType;

    /** --- Database CRUD Integration --- **/

    async function getTeacherCount(search?: string | null) {
        const response = await fetchTeachersCount(search);

        if (response?.success) {
            setTeachersCount(response.count);
        } else {
            setToastMessage(
                response?.error ?? "[fetchTeachersCount]: An unexpected error occurred"
            );
            setToastType("error");
            setShowToast(true);
            setTeachersCount(0);
        }
    }

    async function getTeachers(
        search: string | null = searchTerm,
        sortby: string = sortTeachersBy,
        sortdir: string = sortTeachersDir,
        limit: number = maxRowTeacher,
        page: number = currentTeacherPage
    ) {
        setLoading(true);

        const response = await fetchTeachers(search, sortby, sortdir, limit, page);

        if (response?.success && response.data) {
            setTeachers(response.data);
            setLoading(false);
        } else {
            setToastMessage(
                response?.error ?? "[fetchTeachers]: An unexpected error occurred"
            );
            setToastType("error");
            setShowToast(true);
            setTeachers([]);
            setLoading(false);
        }

        await getTeacherCount(search);
    }

    async function handleTeacherSubmit() {
        const trimmedEmail = inputEmail.trim();

        if (!trimmedEmail) {
            setEmailError("Email is required.");
            return;
        }

        if (!validateEmailFormat(trimmedEmail)) {
            setEmailError("Please enter a valid email address.");
            return;
        }

        const payload = {
            pscs_id: inputPscsId.trim() || null,
            email: trimmedEmail,
            f_name: inputFName.trim() || null,
            m_name: inputMName.trim() || null,
            surname: inputSurname.trim() || null,
            suffix: inputSuffix.trim() || null,
            teacher_code: inputTeacherCode.trim() || null,
            specialization: inputSpecialization.trim() || null,
            employment_type: inputEmploymentType,
        };

        const response = await createTeacher(username ?? "system", payload);

        if (response?.success) {
            setToastMessage("Instructor added successfully");
            setToastType("success");
            toastTimer();
        } else {
            setToastMessage(
                response?.error ?? "[AddTeacher]: An unexpected error occurred"
            );
            setToastType("error");
            setShowToast(true);
        }

        handleCloseTeacherModals();
        void getTeachers(
            searchTerm,
            sortTeachersBy,
            sortTeachersDir,
            maxRowTeacher,
            currentTeacherPage
        );
    }

    async function handleTeacherUpdate() {
        const trimmedEmail = newEmail.trim();

        if (!trimmedEmail) {
            setEditEmailError("Email is required.");
            return;
        }

        if (!validateEmailFormat(trimmedEmail)) {
            setEditEmailError("Please enter a valid email address.");
            return;
        }

        const payload = {
            pscs_id: newPscsId.trim() || null,
            email: trimmedEmail || null,
            f_name: newFName.trim() || null,
            m_name: newMName.trim() || null,
            surname: newSurname.trim() || null,
            suffix: newSuffix.trim() || null,
            teacher_code: newTeacherCode.trim() || null,
            specialization: newSpecialization.trim() || null,
            employment_type: newEmploymentType,
        };

        const response = await updateTeacher(username ?? "system", rowID, payload);

        if (response?.success) {
            setToastMessage("Instructor updated successfully");
            setToastType("success");
            setShowToast(true);
            toastTimer();
        } else {
            setToastMessage(
                response?.error ?? "[UpdateTeacher]: An unexpected error occurred"
            );
            setToastType("error");
            setShowToast(true);
        }

        handleCloseTeacherModals();
        void getTeachers(
            searchTerm,
            sortTeachersBy,
            sortTeachersDir,
            maxRowTeacher,
            currentTeacherPage
        );
    }

    async function handleTeacherArchive() {
        const response = await archiveTeacher(username ?? "system", rowID);

        if (response?.success) {
            setToastMessage("Instructor record archived successfully");
            setToastType("success");
            toastTimer();
        } else {
            setToastMessage(
                response?.error ?? "[ArchiveTeacher]: An unexpected error occurred"
            );
            setToastType("error");
            setShowToast(true);
        }

        handleCloseTeacherModals();
        void getTeachers(
            searchTerm,
            sortTeachersBy,
            sortTeachersDir,
            maxRowTeacher,
            currentTeacherPage
        );
    }

    /** --- Toast Utility --- **/
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
            void getTeachers(
                searchTerm,
                sortTeachersBy,
                sortTeachersDir,
                maxRowTeacher,
                currentTeacherPage
            );
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    return (
        <>
            {/* --- Toast Container --- */}
            {showToast && (
                <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-gray-500/30">
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
                    <h2 className="mb-1 text-lg font-bold">Faculty Management</h2>
                    <p className="text-gray-500">
                        Manage instructors, specializations, and employment status.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative mr-4 w-full md:w-64">
                        <TextInput
                            id="search-teachers"
                            type="text"
                            placeholder="Search code, name, specialization..."
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
                        onClick={() => setOpenAddTeacherModal(true)}
                    >
                        <FaPlus className="mr-2" />
                        Add Instructor
                    </Button>
                </div>
            </div>

            {/* --- Data Table --- */}
            <Card className="overflow-x-auto">
                <Table hoverable>
                    <TableHead>
                        <TableRow>
                            <TableHeadCell
                                onClick={() => handleTeacherSorting("teacher_code")}
                            >
                                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                                    Code
                                    {sortTeachersBy === "teacher_code" &&
                                        (sortTeachersDir === "ASC" ? (
                                            <FaSortUp className="ml-1" />
                                        ) : (
                                            <FaSortDown className="ml-1" />
                                        ))}
                                </div>
                            </TableHeadCell>

                            <TableHeadCell onClick={() => handleTeacherSorting("surname")}>
                                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                                    Instructor Name
                                    {sortTeachersBy === "surname" &&
                                        (sortTeachersDir === "ASC" ? (
                                            <FaSortUp className="ml-1" />
                                        ) : (
                                            <FaSortDown className="ml-1" />
                                        ))}
                                </div>
                            </TableHeadCell>

                            <TableHeadCell onClick={() => handleTeacherSorting("email")}>
                                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                                    Email
                                    {sortTeachersBy === "email" &&
                                        (sortTeachersDir === "ASC" ? (
                                            <FaSortUp className="ml-1" />
                                        ) : (
                                            <FaSortDown className="ml-1" />
                                        ))}
                                </div>
                            </TableHeadCell>

                            <TableHeadCell
                                onClick={() => handleTeacherSorting("specialization")}
                            >
                                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                                    Specialization
                                    {sortTeachersBy === "specialization" &&
                                        (sortTeachersDir === "ASC" ? (
                                            <FaSortUp className="ml-1" />
                                        ) : (
                                            <FaSortDown className="ml-1" />
                                        ))}
                                </div>
                            </TableHeadCell>

                            <TableHeadCell
                                onClick={() => handleTeacherSorting("employment_type")}
                            >
                                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                                    Employment
                                    {sortTeachersBy === "employment_type" &&
                                        (sortTeachersDir === "ASC" ? (
                                            <FaSortUp className="ml-1" />
                                        ) : (
                                            <FaSortDown className="ml-1" />
                                        ))}
                                </div>
                            </TableHeadCell>

                            <TableHeadCell>
                                <span className="sr-only">Edit</span>
                            </TableHeadCell>
                        </TableRow>
                    </TableHead>

                    <TableBody className="divide-y">
                        {teachers.length > 0 ? (
                            teachers.map((item) => {
                                const fullName = [
                                    item.surname ? `${item.surname},` : "",
                                    item.f_name ?? "",
                                    item.m_name ? `${item.m_name.charAt(0)}.` : "",
                                    item.suffix ?? "",
                                ]
                                    .filter(Boolean)
                                    .join(" ");

                                return (
                                    <TableRow
                                        key={item.teacher_id}
                                        className={`${
                                            item.is_archived ? "text-red-500" : ""
                                        } bg-white dark:border-gray-700 dark:bg-gray-800`}
                                    >
                                        <TableCell className="font-mono text-sm">
                                            {item.teacher_code || "—"}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap font-medium">
                                            {item.is_archived ? (
                                                <Tooltip content={"Archived Record"}>
                                                    <span className="flex items-center">
                                                        <FaUserSlash className="mr-2" />
                                                        {fullName || "—"}
                                                    </span>
                                                </Tooltip>
                                            ) : (
                                                fullName || "—"
                                            )}
                                        </TableCell>
                                        <TableCell>{item.email || "—"}</TableCell>
                                        <TableCell>{item.specialization || "—"}</TableCell>
                                        <TableCell>{item.employment_type || "—"}</TableCell>
                                        <TableCell>
                                            <a
                                                onClick={() => loadEditData(item.teacher_id)}
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
                                    colSpan={6}
                                    className="py-6 text-center text-sm italic text-gray-500 dark:text-gray-400"
                                >
                                    <div className="flex items-center justify-center">
                                        <Spinner />
                                        <span className="ml-4">Fetching faculty data...</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                                <TableCell
                                    colSpan={6}
                                    className="py-6 text-center text-sm italic text-gray-500 dark:text-gray-400"
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
                    currentPage={currentTeacherPage || 1}
                    itemsPerPage={maxRowTeacher}
                    totalItems={teachersCount || 1}
                    onPageChange={onPageChangeTeachers}
                    showIcons
                />
            </div>

            {/* --- Add Instructor Modal --- */}
            <Modal show={openAddTeacherModal} onClose={handleCloseTeacherModals}>
                <ModalHeader>Add Instructor</ModalHeader>
                <ModalBody>
                    <form
                        className="flex flex-col gap-4"
                        onSubmit={(e) => e.preventDefault()}
                    >
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="mb-2 block">
                                    <Label htmlFor="pscs_id">PSCS ID</Label>
                                </div>
                                <TextInput
                                    id="pscs_id"
                                    placeholder="e.g. PSCS_0102"
                                    value={inputPscsId}
                                    onChange={handlePscsIdChange}
                                />
                            </div>

                            <div>
                                <div className="mb-2 block">
                                    <Label htmlFor="teacher_code">Teacher Code</Label>
                                </div>
                                <TextInput
                                    id="teacher_code"
                                    placeholder="e.g. T_102"
                                    value={inputTeacherCode}
                                    onChange={handleTeacherCodeChange}
                                />
                            </div>
                        </div>

                        <div>
                            <div className="mb-2 block">
                                <Label htmlFor="email">Email *</Label>
                            </div>
                            <TextInput
                                id="email"
                                type="email"
                                placeholder="e.g. instructor@school.edu"
                                value={inputEmail}
                                onChange={handleEmailChange}
                                color={emailError ? "failure" : "gray"}
                                helperText={emailError}
                            />
                        </div>

                        {/* Name Fields */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="mb-2 block">
                                    <Label htmlFor="f_name">First Name</Label>
                                </div>
                                <TextInput
                                    id="f_name"
                                    placeholder="e.g. Jane"
                                    value={inputFName}
                                    onChange={handleFNameChange}
                                />
                            </div>
                            <div>
                                <div className="mb-2 block">
                                    <Label htmlFor="m_name">Middle Name</Label>
                                </div>
                                <TextInput
                                    id="m_name"
                                    placeholder="e.g. Marie"
                                    value={inputMName}
                                    onChange={handleMNameChange}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="mb-2 block">
                                    <Label htmlFor="surname">Surname</Label>
                                </div>
                                <TextInput
                                    id="surname"
                                    placeholder="e.g. Doe"
                                    value={inputSurname}
                                    onChange={handleSurnameChange}
                                />
                            </div>
                            <div>
                                <div className="mb-2 block">
                                    <Label htmlFor="suffix">Suffix</Label>
                                </div>
                                <TextInput
                                    id="suffix"
                                    placeholder="e.g. Jr., III"
                                    value={inputSuffix}
                                    onChange={handleSuffixChange}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="mb-2 block">
                                    <Label htmlFor="specialization">Specialization</Label>
                                </div>
                                <TextInput
                                    id="specialization"
                                    placeholder="e.g. Web Development"
                                    value={inputSpecialization}
                                    onChange={handleSpecializationChange}
                                />
                            </div>
                            <div>
                                <div className="mb-2 block">
                                    <Label htmlFor="employment_type">Employment Type</Label>
                                </div>
                                <Select
                                    id="employment_type"
                                    value={inputEmploymentType}
                                    onChange={(e) => setInputEmploymentType(e.target.value)}
                                >
                                    <option value="Full-Time">Full-Time</option>
                                    <option value="Part-Time">Part-Time</option>
                                </Select>
                            </div>
                        </div>
                    </form>
                </ModalBody>
                <ModalFooter>
                    <Button
                        disabled={!!emailError || !inputEmail.trim()}
                        onClick={handleTeacherSubmit}
                    >
                        Save
                    </Button>
                    <Button color="gray" onClick={handleCloseTeacherModals}>
                        Cancel
                    </Button>
                </ModalFooter>
            </Modal>

            {/* --- Edit Instructor Modal --- */}
            <Modal show={openEditTeacherModal} onClose={handleCloseTeacherModals}>
                <ModalHeader>Edit Instructor Details</ModalHeader>
                <ModalBody>
                    <form
                        className="flex flex-col gap-4"
                        onSubmit={(e) => e.preventDefault()}
                    >
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="mb-2 block">
                                    <Label htmlFor="edit_pscs_id">PSCS ID</Label>
                                </div>
                                <TextInput
                                    id="edit_pscs_id"
                                    value={newPscsId}
                                    onChange={handleNewPscsIdChange}
                                />
                            </div>

                            <div>
                                <div className="mb-2 block">
                                    <Label htmlFor="edit_teacher_code">Teacher Code</Label>
                                </div>
                                <TextInput
                                    id="edit_teacher_code"
                                    value={newTeacherCode}
                                    onChange={handleNewTeacherCodeChange}
                                />
                            </div>
                        </div>

                        <div>
                            <div className="mb-2 block">
                                <Label htmlFor="edit_email">Email *</Label>
                            </div>
                            <TextInput
                                id="edit_email"
                                type="email"
                                value={newEmail}
                                onChange={handleNewEmailChange}
                                color={editEmailError ? "failure" : "gray"}
                                helperText={editEmailError}
                            />
                        </div>

                        {/* Name Fields */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="mb-2 block">
                                    <Label htmlFor="edit_f_name">First Name</Label>
                                </div>
                                <TextInput
                                    id="edit_f_name"
                                    value={newFName}
                                    onChange={handleNewFNameChange}
                                />
                            </div>
                            <div>
                                <div className="mb-2 block">
                                    <Label htmlFor="edit_m_name">Middle Name</Label>
                                </div>
                                <TextInput
                                    id="edit_m_name"
                                    value={newMName}
                                    onChange={handleNewMNameChange}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="mb-2 block">
                                    <Label htmlFor="edit_surname">Surname</Label>
                                </div>
                                <TextInput
                                    id="edit_surname"
                                    value={newSurname}
                                    onChange={handleNewSurnameChange}
                                />
                            </div>
                            <div>
                                <div className="mb-2 block">
                                    <Label htmlFor="edit_suffix">Suffix</Label>
                                </div>
                                <TextInput
                                    id="edit_suffix"
                                    value={newSuffix}
                                    onChange={handleNewSuffixChange}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="mb-2 block">
                                    <Label htmlFor="edit_specialization">Specialization</Label>
                                </div>
                                <TextInput
                                    id="edit_specialization"
                                    value={newSpecialization}
                                    onChange={handleNewSpecializationChange}
                                />
                            </div>
                            <div>
                                <div className="mb-2 block">
                                    <Label htmlFor="edit_employment_type">Employment Type</Label>
                                </div>
                                <Select
                                    id="edit_employment_type"
                                    value={newEmploymentType}
                                    onChange={(e) => editEmploymentType(e.target.value)}
                                >
                                    <option value="Full-Time">Full-Time</option>
                                    <option value="Part-Time">Part-Time</option>
                                </Select>
                            </div>
                        </div>
                    </form>
                </ModalBody>
                <ModalFooter className="flex justify-between">
                    <Button
                        color="failure"
                        onClick={() => {
                            setOpenEditTeacherModal(false);
                            setOpenArchiveModal(true);
                        }}
                    >
                        <FaBan className="mr-2" /> Archive
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            disabled={isEditFormUnchanged || !!editEmailError || !newEmail.trim()}
                            onClick={handleTeacherUpdate}
                        >
                            Save Changes
                        </Button>
                        <Button color="gray" onClick={handleCloseTeacherModals}>
                            Cancel
                        </Button>
                    </div>
                </ModalFooter>
            </Modal>

            {/* --- Archive Instructor Modal --- */}
            <Modal show={openArchiveModal} onClose={handleCloseTeacherModals} size="md">
                <ModalHeader>Archive Instructor Record</ModalHeader>
                <ModalBody>
                    <div className="text-center">
                        <HiExclamation className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
                        <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
                            Are you sure you want to archive this instructor record?
                        </h3>
                    </div>
                </ModalBody>
                <ModalFooter className="flex justify-center gap-4">
                    <Button color="failure" onClick={handleTeacherArchive}>
                        Yes, Archive
                    </Button>
                    <Button color="gray" onClick={handleCloseTeacherModals}>
                        No, Cancel
                    </Button>
                </ModalFooter>
            </Modal>
        </>
    );
}