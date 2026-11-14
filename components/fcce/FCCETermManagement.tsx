"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableHead,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  TextInput,
  Pagination,
  Spinner,
  Card,
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Label,
  HelperText,
  Select,
  ToggleSwitch,
  Toast,
  ToastToggle,
  Progress,
} from "flowbite-react";
import { HiSearch, HiX, HiChevronRight, HiCheck, HiExclamation } from "react-icons/hi";
import { FaSortUp, FaSortDown, FaPlus } from "react-icons/fa6";
import { useMsal } from "@azure/msal-react";

import {
  fetchAcademicYears,
  createFcce,
  fetchDistinctCourseNames,
  fetchTeachers,
  AcademicYearRecord,
  TeacherRecord,
  FcceInput,
} from "@/app/actions/system";
import {
  filterAlphanumeric,
  filterAlphanumericDashUnderscoreComma,
} from "@/utils/validation";

interface ExtendedAcademicYearRecord extends AcademicYearRecord {
  created_at?: string;
}

export default function FCCETermManagement() {
  const router = useRouter();
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];
  const username = activeAccount?.username || "system";

  const [academicYears, setAcademicYears] = useState<ExtendedAcademicYearRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [maxRow] = useState<number>(10);
  const [sortBy, setSortBy] = useState<string>("ay_sem");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("DESC");

  // Modal States
  const [openAddAyModal, setOpenAddAyModal] = useState<boolean>(false);
  const [openAddFcceModal, setOpenAddFcceModal] = useState<boolean>(false);

  // Add Academic Year State
  const [newAyStartYear, setNewAyStartYear] = useState<string>("");
  const [newAyTerm, setNewAyTerm] = useState<string>("T1");
  const [generatedAySem, setGeneratedAySem] = useState<string>("");
  const [aySemError, setAySemError] = useState<string>("");

  // Add FCCE Form State
  const [addPscsId, setAddPscsId] = useState<string>("");
  const [addCourseName, setAddCourseName] = useState<string>("");
  const [addAySem, setAddAySem] = useState<string>("");
  const [addPass, setAddPass] = useState<boolean>(true);
  const [pscsIdError, setPscsIdError] = useState<string>("");
  const [courseNameError, setCourseNameError] = useState<string>("");
  const [addFcceAyError, setAddFcceAyError] = useState<string>("");

  // Suggestions & Lists
  const [courseNameList, setCourseNameList] = useState<string[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<string[]>([]);
  const [teacherList, setTeacherList] = useState<TeacherRecord[]>([]);

  // Toast State
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastType, setToastType] = useState<string>("success");
  const [toastMessage, setToastMessage] = useState<string>("");
  const [showToastTimer, setShowToastTimer] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);

  const formatAySemCode = (startYrStr: string, termStr: string): string => {
    if (!startYrStr || !termStr) return "";
    const formatYr = (y: string) => (y.length >= 4 ? y.slice(2) : y);
    const startNum = parseInt(startYrStr, 10);
    const endStr = (startNum + 1).toString();
    return `${formatYr(startYrStr)}${formatYr(endStr)}${termStr}`;
  };

  const handleCustomAyChange = (start: string, term: string) => {
    setNewAyStartYear(start);
    setNewAyTerm(term);
    if (!start) {
      setAySemError("Start year is required.");
      setGeneratedAySem("");
      return;
    }
    setAySemError("");
    setGeneratedAySem(formatAySemCode(start, term));
  };

  async function loadCourseNames() {
    const res = await fetchDistinctCourseNames(null, "ASC", 100, 1);
    if (res?.success && res.data) {
      setCourseNameList(res.data);
    }
  }

  useEffect(() => {
    void loadCourseNames();
  }, []);

  const filterCourses = useCallback((term: string) => {
    if (!term.trim()) {
      setFilteredCourses([]);
      return;
    }
    const lower = term.toLowerCase();
    const matches = courseNameList.filter((name) => name.toLowerCase().includes(lower));
    setFilteredCourses(matches.slice(0, 10));
  }, [courseNameList]);

  const searchTeachers = useCallback(async (term: string) => {
    if (!term.trim()) {
      setTeacherList([]);
      return;
    }
    const res = await fetchTeachers(term, "All Active & On Leave", "All Departments", "surname", "ASC", 10, 1);
    if (res?.success && res.data) {
      setTeacherList(res.data);
    }
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 150);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const loadAcademicYearsData = useCallback(() => {
    startTransition(async () => {
      setIsLoading(true);
      // Matches exact fetch signature from FcceManagement
      const res = await fetchAcademicYears(
        debouncedSearch || null,
        sortBy,
        sortDir,
        0,
        1,
      );
      if (res?.success && Array.isArray(res.data)) {
        setAcademicYears(res.data as ExtendedAcademicYearRecord[]);
      } else {
        setAcademicYears([]);
      }
      setIsLoading(false);
    });
  }, [debouncedSearch, sortBy, sortDir]);

  useEffect(() => {
    loadAcademicYearsData();
  }, [loadAcademicYearsData]);

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

  const navigateToDetail = (aySem: string) => {
    router.push(`/fcce/${encodeURIComponent(aySem)}`);
  };

  const handleCloseModals = () => {
    setOpenAddAyModal(false);
    setOpenAddFcceModal(false);
    setNewAyStartYear("");
    setNewAyTerm("T1");
    setGeneratedAySem("");
    setAySemError("");
    setAddPscsId("");
    setAddCourseName("");
    setAddAySem("");
    setAddPass(true);
    setPscsIdError("");
    setCourseNameError("");
    setAddFcceAyError("");
    setTeacherList([]);
    setFilteredCourses([]);
  };

  const toastTimer = () => {
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
          setShowToast(false);
          setShowToastTimer(false);
          return 100;
        }
        return prev + step;
      });
    }, intervalTime);
  };

  const handleCreateAcademicYearTerm = () => {
    if (!generatedAySem) {
      setAySemError("Academic Year / Semester code is required.");
      return;
    }
    setToastMessage(`Academic term ${generatedAySem} initialized successfully.`);
    setToastType("success");
    toastTimer();
    handleCloseModals();
    router.push(`/fcce/${encodeURIComponent(generatedAySem)}`);
  };

  const validatePscsId = (val: string) => {
    if (!val.trim()) return "PSCS ID is required.";
    if (/[a-zA-Z]/.test(val)) return "PSCS ID cannot contain alphabetic characters.";
    return "";
  };

  const handleAddPscsIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, 15);
    setAddPscsId(val);
    setPscsIdError(validatePscsId(val));
    void searchTeachers(val);
  };

  const handleAddCourseNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterAlphanumericDashUnderscoreComma(e.target.value).slice(0, 150);
    setAddCourseName(val);
    setCourseNameError(!val.trim() ? "Course name is required." : "");
    filterCourses(val);
  };

  const handleFcceSubmit = async () => {
    const pscsErr = validatePscsId(addPscsId);
    if (pscsErr) {
      setPscsIdError(pscsErr);
      return;
    }
    if (!addCourseName.trim()) {
      setCourseNameError("Course name is required.");
      return;
    }
    if (!addAySem.trim()) {
      setAddFcceAyError("Academic Year / Semester is required.");
      return;
    }

    const payload: FcceInput = {
      pscs_id: addPscsId.trim(),
      course_name: addCourseName.trim(),
      ay_sem: addAySem.trim(),
      pass: addPass,
      archived: false,
    };

    const response = await createFcce(username, payload);
    if (response?.success) {
      setToastMessage("FCCE record created successfully. Term created_at aligns with its earliest record.");
      setToastType("success");
      toastTimer();
      handleCloseModals();
      loadAcademicYearsData();
    } else {
      setToastMessage(response?.error || "Failed to create FCCE record.");
      setToastType("error");
      setShowToast(true);
    }
  };

  const paginatedYears = academicYears.slice(
    (currentPage - 1) * maxRow,
    currentPage * maxRow,
  );

  const isAyFormInvalid = !generatedAySem || !!aySemError;
  const isFcceFormInvalid = !addPscsId.trim() || !addCourseName.trim() || !addAySem.trim() || !!pscsIdError || !!courseNameError || !!addFcceAyError;

  return (
    <div>
      {showToast && (
        <div className="fixed right-5 bottom-5 z-50 rounded-lg border border-gray-500/30">
          <Toast>
            <div className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toastType === "success" ? "bg-green-100 text-green-500" : "bg-red-100 text-red-500"}`}>
              {toastType === "success" ? <HiCheck className="h-5 w-5" /> : <HiExclamation className="h-5 w-5" />}
            </div>
            <div className="ml-3 text-sm font-normal">{toastMessage}</div>
            <ToastToggle onDismiss={() => setShowToast(false)} />
          </Toast>
          <Progress progress={Math.min(Math.round(progress), 100)} size="sm" className={showToastTimer ? "" : "hidden"} />
        </div>
      )}

      <div className="mb-4">
        <h2 className="mb-1 text-lg font-bold">
          Academic Terms / Semesters Directory
        </h2>
        <p className="text-gray-500">
          Select an academic year or semester term to view all associated
          student FCCE records.
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full md:w-64">
          <TextInput
            id="search-ay-sem"
            type="text"
            placeholder="Search academic term..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={HiSearch}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
            >
              <HiX className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button color="gray" onClick={() => setOpenAddAyModal(true)}>
            <FaPlus className="mr-2" /> Add Academic Year
          </Button>
          <Button onClick={() => setOpenAddFcceModal(true)}>
            <FaPlus className="mr-2" /> Add FCCE Record
          </Button>
        </div>
      </div>

      <Card className="overflow-x-auto">
        <Table hoverable>
          <TableHead>
            <TableRow>
              <TableHeadCell onClick={() => handleSorting("ay_sem")}>
                <div className="flex cursor-pointer text-blue-500 hover:underline">
                  Academic Year / Semester{" "}
                  {sortBy === "ay_sem" &&
                    (sortDir === "ASC" ? (
                      <FaSortUp className="ml-1" />
                    ) : (
                      <FaSortDown className="ml-1" />
                    ))}
                </div>
              </TableHeadCell>
              <TableHeadCell onClick={() => handleSorting("created_at")}>
                <div className="flex cursor-pointer text-blue-500 hover:underline">
                  Created At{" "}
                  {sortBy === "created_at" &&
                    (sortDir === "ASC" ? (
                      <FaSortUp className="ml-1" />
                    ) : (
                      <FaSortDown className="ml-1" />
                    ))}
                </div>
              </TableHeadCell>
              <TableHeadCell className="w-16">
                <span className="sr-only">Details</span>
              </TableHeadCell>
            </TableRow>
          </TableHead>
          <TableBody className="divide-y">
            {paginatedYears.length > 0 ? (
              paginatedYears.map((item) => (
                <TableRow
                  key={item.ay_sem}
                  className="cursor-pointer bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                  onClick={() => navigateToDetail(item.ay_sem)}
                >
                  <TableCell className="font-mono font-bold text-gray-900 dark:text-white">
                    {item.ay_sem}
                  </TableCell>
                  <TableCell>
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <HiChevronRight className="h-5 w-5 text-gray-400" />
                  </TableCell>
                </TableRow>
              ))
            ) : isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-6 text-center text-gray-500 italic"
                >
                  <div className="flex items-center justify-center">
                    <Spinner size="sm" />
                    <span className="ml-3">Loading terms...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-6 text-center text-gray-500 italic"
                >
                  No academic terms found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="mt-4 flex justify-center">
        <Pagination
          layout="pagination"
          currentPage={currentPage}
          totalPages={Math.ceil(academicYears.length / maxRow) || 1}
          onPageChange={(p) => setCurrentPage(p)}
          showIcons
        />
      </div>

      {/* --- MODAL: ADD ACADEMIC YEAR --- */}
      <Modal show={openAddAyModal} onClose={handleCloseModals}>
        <ModalHeader>Add Academic Year / Semester</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <Label>Configure Academic Term</Label>
              <div className="mt-2 flex items-center gap-2">
                <Select value={newAyStartYear} onChange={(e) => handleCustomAyChange(e.target.value, newAyTerm)}>
                  <option value="">Start Year</option>
                  {yearOptions.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
                </Select>
                <span>-</span>
                <div className="font-mono text-sm font-semibold">{newAyStartYear ? parseInt(newAyStartYear, 10) + 1 : "End Year"}</div>
                <Select value={newAyTerm} onChange={(e) => handleCustomAyChange(newAyStartYear, e.target.value)}>
                  <option value="T1">Term 1</option>
                  <option value="T2">Term 2</option>
                  <option value="T3">Term 3</option>
                  <option value="T4">Term 4</option>
                </Select>
              </div>
              {aySemError && <HelperText className="text-red-600">{aySemError}</HelperText>}
            </div>

            {generatedAySem && (
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                Generated Term Code: <span className="font-mono font-bold text-blue-600">{generatedAySem}</span>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button disabled={isAyFormInvalid} onClick={handleCreateAcademicYearTerm}>
            Create & View Term
          </Button>
          <Button color="alternative" onClick={handleCloseModals}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* --- MODAL: ADD FCCE RECORD --- */}
      <Modal show={openAddFcceModal} onClose={handleCloseModals}>
        <ModalHeader>Add FCCE Record</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="relative">
              <Label htmlFor="add-pscs-id">PSCS ID</Label>
              <TextInput id="add-pscs-id" value={addPscsId} onChange={handleAddPscsIdChange} placeholder="Enter PSCS ID" />
              {pscsIdError && <HelperText className="text-red-600">{pscsIdError}</HelperText>}
              {teacherList.length > 0 && (
                <ul className="absolute z-10 max-h-40 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
                  {teacherList.map((teacher) => (
                    <li key={teacher.teacher_id} onClick={() => { setAddPscsId(teacher.pscs_id || ""); setTeacherList([]); }} className="cursor-pointer px-4 py-2 hover:bg-gray-100">
                      {teacher.full_name} ({teacher.pscs_id})
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="relative">
              <Label htmlFor="add-course-name">Course Name</Label>
              <TextInput id="add-course-name" value={addCourseName} onChange={handleAddCourseNameChange} placeholder="Enter or select course name" />
              {courseNameError && <HelperText className="text-red-600">{courseNameError}</HelperText>}
              {filteredCourses.length > 0 && (
                <ul className="absolute z-10 max-h-40 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
                  {filteredCourses.map((c, idx) => (
                    <li key={idx} onClick={() => { setAddCourseName(c); setFilteredCourses([]); }} className="cursor-pointer px-4 py-2 hover:bg-gray-100">{c}</li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <Label htmlFor="add-ay-sem">Academic Year / Semester</Label>
              <Select id="add-ay-sem" value={addAySem} onChange={(e) => { setAddAySem(e.target.value); setAddFcceAyError(!e.target.value ? "Academic Year / Semester is required." : ""); }}>
                <option value="">Select Academic Year / Sem</option>
                {academicYears.map((item) => <option key={item.ay_sem} value={item.ay_sem}>{item.ay_sem}</option>)}
              </Select>
              {addFcceAyError && <HelperText className="text-red-600">{addFcceAyError}</HelperText>}
            </div>

            <div className="flex items-center justify-between">
              <Label>Status</Label>
              <ToggleSwitch checked={addPass} label={addPass ? "Passed" : "Failed"} onChange={setAddPass} />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button disabled={isFcceFormInvalid} onClick={() => void handleFcceSubmit()}>
            Submit
          </Button>
          <Button color="alternative" onClick={handleCloseModals}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}