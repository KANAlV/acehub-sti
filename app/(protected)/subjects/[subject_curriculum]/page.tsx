"use client";

import React, {
    useState,
    useEffect,
    useCallback,
    useTransition,
    useRef,
    useMemo,
} from "react";
import { useParams, useRouter } from "next/navigation";
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
    Label,
    HelperText,
    Modal,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Pagination,
    Spinner,
    Card,
    Toast,
    ToastToggle,
    Progress,
} from "flowbite-react";
import {
    HiSearch,
    HiX,
    HiCheck,
    HiExclamation,
    HiOutlineTrash,
    HiArrowLeft,
} from "react-icons/hi";
import { FaPlus, FaSortUp, FaSortDown } from "react-icons/fa";
import { useMsal } from "@azure/msal-react";

import {
    fetchSubjects,
    fetchSubjectsCount,
    createSubject,
    updateSubject,
    deleteSubject,
    fetchPrograms,
    fetchRoomTypeList,
    SubjectRecord,
    SubjectInput,
} from "@/app/actions/system";

export interface ProgramRecord {
    program_code: string;
    program_name: string;
    year_level: string;
}

export interface RoomType {
    room_type_id: string;
    value: string;
}

export default function CurriculumSubjectsPage() {
    const router = useRouter();
    const params = useParams();

    // Directly read and decode the dynamic parameter from the URL path
    const curriculumVersion = decodeURIComponent(
        (params?.subject_curriculum as string) || ""
    );

    // --- MSAL Auth State for Actor ---
    const { instance, accounts } = useMsal();
    const activeAccount = instance.getActiveAccount() || accounts[0];
    const actor = activeAccount?.username || "system";

    // --- Data State ---
    const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
    const [subjectsCount, setSubjectsCount] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isPending, startTransition] = useTransition();

    // --- External Dropdown Data ---
    const [programsList, setProgramsList] = useState<ProgramRecord[]>([]);
    const [isLoadingPrograms, setIsLoadingPrograms] = useState<boolean>(false);
    const [roomTypeList, setRoomTypeList] = useState<RoomType[]>([]);
    const [isLoadingRoomTypes, setIsLoadingRoomTypes] = useState<boolean>(false);

    // --- Search, Filter & Pagination State ---
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [debouncedSearch, setDebouncedSearch] = useState<string>("");
    const [selectedProgramFilter, setSelectedProgramFilter] = useState<string>("ALL");
    const [allProgramsFilterList, setAllProgramsFilterList] = useState<ProgramRecord[]>([]);

    const [currentPage, setCurrentPage] = useState<number>(1);
    const [maxRow] = useState<number>(10);
    const [sortBy, setSortBy] = useState<string>("course_code");
    const [sortDir, setSortDir] = useState<"ASC" | "DESC">("ASC");

    // --- Modal States ---
    const [openAddModal, setOpenAddModal] = useState<boolean>(false);
    const [openEditModal, setOpenEditModal] = useState<boolean>(false);
    const [openDeleteModal, setOpenDeleteModal] = useState<boolean>(false);
    const [openAddConfirmation, setOpenAddConfirmation] = useState(false);

    // --- Target Record ---
    const [selectedSubject, setSelectedSubject] = useState<SubjectRecord | null>(null);

    // --- Form State ---
    const initialFormState: SubjectInput = useMemo(() => ({
        curriculum: curriculumVersion,
        program_code: "",
        course_code: "",
        course_name: "",
        lecture_units: 3,
        lab_units: 0,
        lab_type: null,
        year_term: null,
    }), [curriculumVersion]);

    const [formData, setFormData] = useState<SubjectInput>(initialFormState);
    const [selectedYear, setSelectedYear] = useState<string>("");

    // --- Validation State ---
    const [programError, setProgramError] = useState<string>("");
    const [courseCodeError, setCourseCodeError] = useState<string>("");
    const [courseNameError, setCourseNameError] = useState<string>("");
    const [lecUnitsError, setLecUnitsError] = useState<string>("");
    const [labUnitsError, setLabUnitsError] = useState<string>("");
    const [yearLevelError, setYearLevelError] = useState<string>("");

    // --- Toast State & Timer Ref ---
    const [showToast, setShowToast] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string>("");
    const [toastType, setToastType] = useState<"success" | "warning" | "error">("success");
    const [progress, setProgress] = useState<number>(0);
    const [showToastTimer, setShowToastTimer] = useState<boolean>(false);
    const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

    const clearToastTimer = () => {
        if (toastTimerRef.current) {
            clearInterval(toastTimerRef.current);
            toastTimerRef.current = null;
        }
    };

    const closeToast = () => {
        clearToastTimer();
        setShowToast(false);
        setShowToastTimer(false);
    };

    const triggerToast = (msg: string, type: "success" | "warning" | "error" = "success") => {
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
    };

    useEffect(() => {
        return () => clearToastTimer();
    }, []);

    // Parallelized mount data loading
    useEffect(() => {
        const loadInitialData = async () => {
            setIsLoadingRoomTypes(true);
            try {
                const [roomTypesRes, shsProgRes, tertiaryProgRes] = await Promise.all([
                    fetchRoomTypeList(null, "ASC", 100, 1),
                    fetchPrograms(null, "shs", "program_code", "ASC", 0, 1),
                    fetchPrograms(null, "tertiary", "program_code", "ASC", 0, 1),
                ]);

                if (roomTypesRes?.success && Array.isArray(roomTypesRes.data)) {
                    setRoomTypeList(roomTypesRes.data as RoomType[]);
                } else if (Array.isArray(roomTypesRes)) {
                    setRoomTypeList(roomTypesRes as RoomType[]);
                }

                const combinedPrograms: ProgramRecord[] = [
                    ...(shsProgRes?.success && Array.isArray(shsProgRes.data) ? shsProgRes.data : []),
                    ...(tertiaryProgRes?.success && Array.isArray(tertiaryProgRes.data) ? tertiaryProgRes.data : []),
                ];
                setAllProgramsFilterList(combinedPrograms);
            } catch (err) {
                console.error("Failed to load initial dropdown data:", err);
            } finally {
                setIsLoadingRoomTypes(false);
            }
        };

        loadInitialData();
    }, []);

    const getEducationLevel = (year: string): "shs" | "tertiary" | "none" => {
        if (["11", "12", "Grade 11", "Grade 12"].includes(year)) return "shs";
        if (["1st Year", "2nd Year", "3rd Year", "4th Year"].includes(year)) return "tertiary";
        return "none";
    };

    const currentEduLevel = getEducationLevel(selectedYear);

    useEffect(() => {
        if (currentEduLevel === "none") {
            setProgramsList([]);
            return;
        }

        const loadPrograms = async () => {
            setIsLoadingPrograms(true);
            const levelFilter = currentEduLevel === "shs" ? "shs" : "tertiary";
            const res = await fetchPrograms(null, levelFilter, "program_code", "ASC", 0, 1);
            if (res.success && res.data) {
                setProgramsList(res.data);
            } else {
                setProgramsList([]);
            }
            setIsLoadingPrograms(false);
        };

        loadPrograms();
    }, [currentEduLevel]);

    useEffect(() => {
        if (!selectedYear) {
            setFormData((prev) => ({ ...prev, year_term: null }));
            return;
        }

        const isSHS = ["11", "12", "Grade 11", "Grade 12"].includes(selectedYear);
        const num = selectedYear === "Grade 11" ? "11" : selectedYear === "Grade 12" ? "12" : selectedYear;
        const combined = isSHS ? `SHS ${num}` : selectedYear;

        setFormData((prev) => ({ ...prev, year_term: combined }));
    }, [selectedYear]);

    // Fast 150ms search debounce
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1);
        }, 150);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    const loadData = useCallback(() => {
        if (!curriculumVersion) return;

        startTransition(async () => {
            const programCodeParam = selectedProgramFilter === "ALL" ? null : selectedProgramFilter;

            const [resData, resCount] = await Promise.all([
                fetchSubjects(
                    debouncedSearch,
                    programCodeParam,
                    curriculumVersion,
                    sortBy,
                    sortDir,
                    maxRow,
                    currentPage,
                ),
                fetchSubjectsCount(debouncedSearch, programCodeParam),
            ]);

            if (resData.success && resData.data) {
                setSubjects(resData.data);
            }
            if (resCount.success) {
                setSubjectsCount(resCount.count);
            }
            setIsLoading(false);
        });
    }, [debouncedSearch, selectedProgramFilter, curriculumVersion, sortBy, sortDir, maxRow, currentPage]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSorting = (column: string) => {
        startTransition(() => {
            if (sortBy === column) {
                setSortDir((prev) => (prev === "ASC" ? "DESC" : "ASC"));
            } else {
                setSortBy(column);
                setSortDir("ASC");
            }
            setCurrentPage(1);
        });
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { id, value, type } = e.target;

        if (id === "program_code") {
            setProgramError(value.trim() === "" ? "Program is required." : "");
            setFormData((prev) => ({ ...prev, program_code: value }));
            return;
        }

        if (id === "course_code") {
            setCourseCodeError(value.trim() === "" ? "Course code is required." : "");
            setFormData((prev) => ({ ...prev, course_code: value }));
            return;
        }

        if (id === "course_name") {
            setCourseNameError(value.trim() === "" ? "Course name is required." : "");
            setFormData((prev) => ({ ...prev, course_name: value }));
            return;
        }

        if (id === "lab_type") {
            setFormData((prev) => ({ ...prev, lab_type: value || null }));
            return;
        }

        if (type === "number") {
            let numVal = parseFloat(value) || 0;
            if (numVal < 0) numVal = 0;
            if (numVal > 8) numVal = 8;

            if (id === "lecture_units") setLecUnitsError("");
            if (id === "lab_units") {
                setLabUnitsError("");
                if (numVal === 0) {
                    setFormData((prev) => ({ ...prev, lab_type: null, lab_units: 0 }));
                    return;
                }
            }

            setFormData((prev) => ({ ...prev, [id]: numVal }));
            return;
        }

        setFormData((prev) => ({ ...prev, [id]: value || null }));
    };

    const handleCloseModals = () => {
        setOpenAddModal(false);
        setOpenAddConfirmation(false);
        setOpenEditModal(false);
        setOpenDeleteModal(false);
        setSelectedSubject(null);
        setFormData({ ...initialFormState, curriculum: curriculumVersion });
        setSelectedYear("");
        setProgramError("");
        setCourseCodeError("");
        setCourseNameError("");
        setLecUnitsError("");
        setLabUnitsError("");
        setYearLevelError("");
    };

    const handleOpenEdit = (subject: SubjectRecord) => {
        setSelectedSubject(subject);

        const existingYearTerm = subject.year_term || "";
        let cleanYear = existingYearTerm.startsWith("SHS ") ? existingYearTerm.replace("SHS ", "") : existingYearTerm;
        if (cleanYear === "Grade 11") cleanYear = "11";
        if (cleanYear === "Grade 12") cleanYear = "12";
        setSelectedYear(cleanYear);

        setFormData({
            curriculum: curriculumVersion,
            program_code: subject.program_code ?? "",
            course_code: subject.course_code || "",
            course_name: subject.course_name || "",
            lecture_units: Math.min(Math.max(subject.lecture_units ?? 0, 0), 8),
            lab_units: Math.min(Math.max(subject.lab_units ?? 0, 0), 8),
            lab_type: subject.lab_type ?? null,
            year_term: subject.year_term ?? null,
        });
        setOpenEditModal(true);
    };

    const handleCreateSubject = async () => {
        if (
            !formData.program_code?.trim() ||
            !formData.course_code?.trim() ||
            !formData.course_name?.trim() ||
            !selectedYear.trim()
        ) {
            return;
        }

        const payload = { ...formData, curriculum: curriculumVersion };
        const res = await createSubject(actor, payload);
        if (res.success) {
            triggerToast("Subject created successfully under this curriculum!", "success");
            handleCloseModals();
            loadData();
        } else {
            triggerToast(res.error || "Failed to create subject.", "error");
        }
    };

    const handleUpdateSubject = async () => {
        if (!selectedSubject) return;

        if (
            !formData.program_code?.trim() ||
            !formData.course_code?.trim() ||
            !formData.course_name?.trim() ||
            !selectedYear.trim()
        ) {
            return;
        }

        const payload = { ...formData, curriculum: curriculumVersion };
        const res = await updateSubject(actor, selectedSubject.subject_id, payload);
        if (res.success) {
            triggerToast("Subject updated successfully!", "success");
            handleCloseModals();
            loadData();
        } else {
            triggerToast(res.error || "Failed to update subject.", "error");
        }
    };

    const handleDeleteSubject = async () => {
        if (!selectedSubject) return;
        const res = await deleteSubject(actor, selectedSubject.subject_id);
        if (res.success) {
            triggerToast("Subject deleted successfully!", "success");
            handleCloseModals();
            loadData();
        } else {
            triggerToast(res.error || "Failed to delete subject.", "error");
        }
    };

    const isFormInvalid =
        !formData.program_code?.trim() ||
        !formData.course_code?.trim() ||
        !formData.course_name?.trim() ||
        !selectedYear.trim() ||
        Boolean(programError) ||
        Boolean(courseCodeError) ||
        Boolean(courseNameError) ||
        Boolean(lecUnitsError) ||
        Boolean(labUnitsError) ||
        Boolean(yearLevelError);

    // Optimized O(1) Lookup Map for Room Types
    const roomTypeMap = useMemo(() => {
        const map = new Map<string, string>();
        roomTypeList.forEach((rt) => map.set(rt.room_type_id, rt.value));
        return map;
    }, [roomTypeList]);

    return (
        <div className="m-8">
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

            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button color="alternative" size="sm" onClick={() => router.push("/subjects")}>
                        <HiArrowLeft className="mr-2 h-4 w-4" /> Back to Curriculum
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold">
                            Curriculum: <span className="font-mono text-blue-600">{curriculumVersion}</span>
                        </h1>
                        <p className="text-sm text-gray-500">
                            Managing all subjects registered under this curriculum version.
                        </p>
                    </div>
                </div>
            </div>

            <div className="mb-4 flex-col justify-between gap-4 md:flex md:flex-row md:items-center">
                <div className="relative mr-4 mb-2 w-full md:w-64">
                    <TextInput
                        id="search-subjects"
                        type="text"
                        placeholder="Search subjects..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        icon={HiSearch}
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm("")}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
                        >
                            <HiX className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="w-full sm:w-48">
                        <Select
                            id="program-filter-select"
                            value={selectedProgramFilter}
                            onChange={(e) => {
                                setSelectedProgramFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                        >
                            <option value="ALL">All Programs</option>
                            {allProgramsFilterList.map((prog) => (
                                <option key={`filter-${prog.program_code}`} value={prog.program_code}>
                                    {prog.program_code} - {prog.program_name}
                                </option>
                            ))}
                        </Select>
                    </div>

                    <Button
                        className="w-full whitespace-nowrap sm:w-auto"
                        onClick={() => {
                            setFormData({ ...initialFormState, curriculum: curriculumVersion });
                            setSelectedYear("");
                            setProgramError("");
                            setCourseCodeError("");
                            setCourseNameError("");
                            setLecUnitsError("");
                            setLabUnitsError("");
                            setYearLevelError("");
                            setOpenAddModal(true);
                        }}
                    >
                        <FaPlus className="mr-2" />
                        Add Subject
                    </Button>
                </div>
            </div>

            <Card className={`overflow-x-auto transition-opacity ${isPending ? "opacity-60" : "opacity-100"}`}>
                <Table hoverable>
                    <TableHead>
                        <TableRow>
                            <TableHeadCell onClick={() => handleSorting("course_code")}>
                                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                                    Course Code
                                    {sortBy === "course_code" &&
                                        (sortDir === "ASC" ? <FaSortUp className="ml-1" /> : <FaSortDown className="ml-1" />)}
                                </div>
                            </TableHeadCell>

                            <TableHeadCell onClick={() => handleSorting("course_name")}>
                                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                                    Course Name
                                    {sortBy === "course_name" &&
                                        (sortDir === "ASC" ? <FaSortUp className="ml-1" /> : <FaSortDown className="ml-1" />)}
                                </div>
                            </TableHeadCell>

                            <TableHeadCell>Program / Strand</TableHeadCell>
                            <TableHeadCell>Year Level</TableHeadCell>
                            <TableHeadCell>Lec Units</TableHeadCell>
                            <TableHeadCell>Lab Units</TableHeadCell>
                            <TableHeadCell>Lab Type</TableHeadCell>
                            <TableHeadCell>
                                <span className="sr-only">Actions</span>
                            </TableHeadCell>
                        </TableRow>
                    </TableHead>

                    <TableBody className="divide-y">
                        {subjects.length > 0 ? (
                            subjects.map((item) => (
                                <TableRow key={item.subject_id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                                    <TableCell className="font-medium whitespace-nowrap text-gray-900 dark:text-white">
                                        {item.course_code}
                                    </TableCell>
                                    <TableCell>{item.course_name}</TableCell>
                                    <TableCell>{item.program_code || "—"}</TableCell>
                                    <TableCell>{item.year_term || "—"}</TableCell>
                                    <TableCell>{item.lecture_units}</TableCell>
                                    <TableCell>{item.lab_units}</TableCell>
                                    <TableCell>
                                        {(item.lab_type ? roomTypeMap.get(item.lab_type) : null) ||
                                            item.lab_type_name ||
                                            item.lab_type ||
                                            "No Laboratory"}
                                    </TableCell>
                                    <TableCell>
                                        <a
                                            onClick={() => handleOpenEdit(item)}
                                            className="text-primary-600 dark:text-primary-500 cursor-pointer font-medium hover:underline"
                                        >
                                            Edit
                                        </a>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : isLoading ? (
                            <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                                <TableCell colSpan={8} className="py-6 text-center text-sm text-gray-500 italic dark:text-gray-400">
                                    <div className="flex items-center justify-center">
                                        <Spinner />
                                        <span className="ml-4">Fetching subjects...</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                                <TableCell colSpan={8} className="py-6 text-center text-sm text-gray-500 italic dark:text-gray-400">
                                    {searchTerm || selectedProgramFilter !== "ALL"
                                        ? `No matching subjects found in this curriculum.`
                                        : "No subject entries found in this curriculum yet."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Card>

            <div className={`mt-4 ${isLoading ? "pointer-events-none opacity-50" : ""} flex w-full justify-center`}>
                <Pagination
                    layout="pagination"
                    currentPage={currentPage || 1}
                    totalPages={Math.ceil(subjectsCount / maxRow) || 1}
                    onPageChange={(p) => setCurrentPage(p)}
                    showIcons
                />
            </div>

            {/* --- MODAL: ADD SUBJECT --- */}
            <Modal show={openAddModal} onClose={handleCloseModals} size="md">
                <ModalHeader>
                    Add Subject to <span className="font-mono text-blue-600">{curriculumVersion}</span>
                </ModalHeader>
                <ModalBody>
                    <div className="flex flex-col gap-4">
                        <div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="course_code">Course Code *</Label>
                                <span className="text-xs text-gray-500">{(formData.course_code || "").length}/10</span>
                            </div>
                            <TextInput
                                id="course_code"
                                placeholder="e.g. CS101"
                                value={formData.course_code || ""}
                                onChange={handleInputChange}
                                color={courseCodeError ? "failure" : "gray"}
                                maxLength={10}
                            />
                            {courseCodeError && <HelperText color="failure">{courseCodeError}</HelperText>}
                        </div>

                        <div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="course_name">Course Name *</Label>
                                <span className="text-xs text-gray-500">{(formData.course_name || "").length}/200</span>
                            </div>
                            <TextInput
                                id="course_name"
                                placeholder="e.g. Intro to Computing"
                                value={formData.course_name || ""}
                                onChange={handleInputChange}
                                color={courseNameError ? "failure" : "gray"}
                                maxLength={200}
                            />
                            {courseNameError && <HelperText color="failure">{courseNameError}</HelperText>}
                        </div>

                        <div>
                            <Label htmlFor="year_level_select">Year Level *</Label>
                            <Select
                                id="year_level_select"
                                value={selectedYear}
                                color={yearLevelError ? "failure" : "gray"}
                                onChange={(e) => {
                                    const yr = e.target.value;
                                    setSelectedYear(yr);
                                    setYearLevelError(yr.trim() === "" ? "Year Level is required." : "");
                                    setFormData((prev) => ({ ...prev, program_code: "" }));
                                }}
                            >
                                <option value="">Select Year...</option>
                                <option value="11">Grade 11</option>
                                <option value="12">Grade 12</option>
                                <option value="1st Year">1st Year</option>
                                <option value="2nd Year">2nd Year</option>
                                <option value="3rd Year">3rd Year</option>
                                <option value="4th Year">4th Year</option>
                            </Select>
                            {yearLevelError && <HelperText color="failure">{yearLevelError}</HelperText>}
                        </div>

                        <div>
                            <Label htmlFor="program_code">Program *</Label>
                            <Select
                                id="program_code"
                                value={formData.program_code || ""}
                                onChange={handleInputChange}
                                disabled={!selectedYear || isLoadingPrograms}
                                color={programError ? "failure" : "gray"}
                            >
                                <option value="">
                                    {isLoadingPrograms
                                        ? "Loading programs..."
                                        : !selectedYear
                                            ? "Select Year Level first..."
                                            : "Select Program..."}
                                </option>
                                {programsList.map((prog) => (
                                    <option key={prog.program_code} value={prog.program_code}>
                                        {prog.program_code} - {prog.program_name}
                                    </option>
                                ))}
                            </Select>
                            {programError && <HelperText color="failure">{programError}</HelperText>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="lecture_units">Lec Units (0 - 8)</Label>
                                <TextInput
                                    id="lecture_units"
                                    type="number"
                                    min={0}
                                    max={8}
                                    step="0.5"
                                    value={formData.lecture_units ?? 0}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div>
                                <Label htmlFor="lab_units">Lab Units (0 - 8)</Label>
                                <TextInput
                                    id="lab_units"
                                    type="number"
                                    min={0}
                                    max={8}
                                    step="0.5"
                                    value={formData.lab_units ?? 0}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="lab_type">Lab Type</Label>
                            <Select
                                id="lab_type"
                                value={formData.lab_type || ""}
                                onChange={handleInputChange}
                                disabled={isLoadingRoomTypes || (formData.lab_units ?? 0) === 0}
                            >
                                <option value="" hidden={true}>
                                    {(formData.lab_units ?? 0) === 0 ? "No lab units (Disabled)" : "Select Lab Type..."}
                                </option>
                                {roomTypeList.map((type) => (
                                    <option key={type.room_type_id} value={type.room_type_id}>
                                        {type.value}
                                    </option>
                                ))}
                            </Select>
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button onClick={() => setOpenAddConfirmation(true)} disabled={isFormInvalid || isPending}>
                        Create Subject
                    </Button>
                    <Button color="alternative" onClick={handleCloseModals}>
                        Cancel
                    </Button>
                </ModalFooter>
            </Modal>

            {/* --- MODAL: ADD CONFIRMATION --- */}
            <Modal show={openAddConfirmation} onClose={() => setOpenAddConfirmation(false)}>
                <ModalHeader>Confirm Add Subject</ModalHeader>
                <ModalBody className="dark:text-white">
                    Are you sure you want to add this subject to <strong className="font-mono text-blue-600">{curriculumVersion}</strong>?
                    <div className="flex gap-8 my-3">
                        <div>
                            <Label className="text-gray-400">Course Code</Label>
                            <div className="font-bold">{formData.course_code}</div>
                        </div>
                        <div>
                            <Label className="text-gray-400">Course Name</Label>
                            <div className="font-bold">{formData.course_name}</div>
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button onClick={handleCreateSubject} disabled={isFormInvalid || isPending}>
                        Confirm & Create
                    </Button>
                    <Button color="alternative" onClick={() => setOpenAddConfirmation(false)}>
                        Cancel
                    </Button>
                </ModalFooter>
            </Modal>

            {/* --- MODAL: EDIT SUBJECT --- */}
            <Modal show={openEditModal} onClose={handleCloseModals} size="md">
                <ModalHeader>Edit Subject</ModalHeader>
                <ModalBody>
                    <div className="flex flex-col gap-4">
                        <div>
                            <Label>Course Code</Label>
                            <div className="font-semibold dark:text-white">{formData.course_code || ""}</div>
                        </div>

                        <div>
                            <Label>Course Name</Label>
                            <div className="font-semibold dark:text-white">{formData.course_name || ""}</div>
                        </div>

                        <div>
                            <Label htmlFor="year_level_select_edit">Year Level *</Label>
                            <Select
                                id="year_level_select_edit"
                                value={selectedYear}
                                onChange={(e) => {
                                    const yr = e.target.value;
                                    setSelectedYear(yr);
                                    setFormData((prev) => ({ ...prev, program_code: "" }));
                                }}
                            >
                                <option value="">Select Year...</option>
                                <option value="11">Grade 11</option>
                                <option value="12">Grade 12</option>
                                <option value="1st Year">1st Year</option>
                                <option value="2nd Year">2nd Year</option>
                                <option value="3rd Year">3rd Year</option>
                                <option value="4th Year">4th Year</option>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="program_code_edit">Program *</Label>
                            <Select
                                id="program_code"
                                value={formData.program_code || ""}
                                onChange={handleInputChange}
                                disabled={!selectedYear || isLoadingPrograms}
                            >
                                <option value="">Select Program...</option>
                                {programsList.map((prog) => (
                                    <option key={prog.program_code} value={prog.program_code}>
                                        {prog.program_code} - {prog.program_name}
                                    </option>
                                ))}
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="lecture_units">Lec Units (0 - 8)</Label>
                                <TextInput
                                    id="lecture_units"
                                    type="number"
                                    min={0}
                                    max={8}
                                    step="0.5"
                                    value={formData.lecture_units ?? 0}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div>
                                <Label htmlFor="lab_units">Lab Units (0 - 8)</Label>
                                <TextInput
                                    id="lab_units"
                                    type="number"
                                    min={0}
                                    max={8}
                                    step="0.5"
                                    value={formData.lab_units ?? 0}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="lab_type">Lab Type</Label>
                            <Select
                                id="lab_type"
                                value={formData.lab_type || ""}
                                onChange={handleInputChange}
                                disabled={isLoadingRoomTypes || (formData.lab_units ?? 0) === 0}
                            >
                                <option value="" hidden={true}>Select Lab Type...</option>
                                {roomTypeList.map((type) => (
                                    <option key={type.room_type_id} value={type.room_type_id}>
                                        {type.value}
                                    </option>
                                ))}
                            </Select>
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter className="flex flex-row items-center justify-between gap-3">
                    <Button
                        color="red"
                        onClick={() => {
                            setOpenEditModal(false);
                            setOpenDeleteModal(true);
                        }}
                    >
                        <HiOutlineTrash className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:block">Delete</span>
                    </Button>

                    <div className="flex gap-2">
                        <Button onClick={handleUpdateSubject} disabled={isFormInvalid || isPending}>
                            Save Changes
                        </Button>
                        <Button color="alternative" onClick={handleCloseModals}>
                            Cancel
                        </Button>
                    </div>
                </ModalFooter>
            </Modal>

            {/* --- MODAL: CONFIRM DELETE --- */}
            <Modal show={openDeleteModal} onClose={handleCloseModals} size="md">
                <ModalHeader>Confirm Delete</ModalHeader>
                <ModalBody>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Are you sure you want to delete{" "}
                        <strong className="text-gray-900 dark:text-white">
                            {selectedSubject?.course_code} - {selectedSubject?.course_name}
                        </strong>
                        ? This action cannot be undone.
                    </p>
                </ModalBody>
                <ModalFooter className="flex justify-end gap-2">
                    <Button color="red" onClick={handleDeleteSubject}>
                        Confirm Delete
                    </Button>
                    <Button color="alternative" onClick={handleCloseModals}>
                        Cancel
                    </Button>
                </ModalFooter>
            </Modal>
        </div>
    );
}