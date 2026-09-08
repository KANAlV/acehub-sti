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
  FaPlus,
  FaSortDown,
  FaSortUp,
  FaTrash,
} from "react-icons/fa6";
import { HiCheck, HiExclamation, HiX, HiSearch } from "react-icons/hi";
import { useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";
import {
  filterAlphanumericDashUnderscore,
  filterAlphanumericDashUnderscoreComma,
  filterNumeric,
} from "@/utils/validation";
import {
  fetchPrograms,
  fetchProgramsCount,
  createProgram,
  updateProgram,
  deleteProgram,
  ProgramRecord,
  ProgramInput,
} from "@/app/actions/system";

// Matches {"1": 100, "2": 80, "3": 60, "4": 40} structure in DB
export interface CollegeYearLevelDistribution {
  "1"?: number;
  "2"?: number;
  "3"?: number;
  "4"?: number;
  [key: string]: unknown;
}

export interface CollegeProgram {
  program_code: string;
  program_name: string | null;
  students: CollegeYearLevelDistribution | null;
  created_at?: string;
  updated_at?: string;
}

export default function CollegeProgramsManagement() {
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];
  const activeUser = activeAccount?.username || "system";
  const [isLoading, setLoading] = useState(false);

  // --- Table & Filter States --- //
  const [programs, setPrograms] = useState<CollegeProgram[]>([]);
  const [programsCount, setProgramsCount] = useState(0);
  const [sortProgramsBy, setSortProgramsBy] = useState("program_code");
  const [sortProgramsDir, setSortProgramsDir] = useState<"ASC" | "DESC">("ASC");
  const [searchTerm, setSearchTerm] = useState("");

  // --- Modal Visibility States --- //
  const [openAddProgramModal, setOpenAddProgramModal] = useState(false);
  const [openEditProgramModal, setOpenEditProgramModal] = useState(false);
  const [openDeleteProgramModal, setOpenDeleteProgramModal] = useState(false);

  // --- Form & Selection States --- //
  const [selectedProgramCode, setSelectedProgramCode] = useState("");

  // Add State
  const [inputProgramCode, setInputProgramCode] = useState("");
  const [inputProgramName, setInputProgramName] = useState("");
  const [inputYear1Count, setInputYear1Count] = useState<number | "">(0);
  const [inputYear2Count, setInputYear2Count] = useState<number | "">(0);
  const [inputYear3Count, setInputYear3Count] = useState<number | "">(0);
  const [inputYear4Count, setInputYear4Count] = useState<number | "">(0);

  // Update State
  const [editProgramName, setEditProgramName] = useState("");
  const [editYear1Count, setEditYear1Count] = useState<number | "">(0);
  const [editYear2Count, setEditYear2Count] = useState<number | "">(0);
  const [editYear3Count, setEditYear3Count] = useState<number | "">(0);
  const [editYear4Count, setEditYear4Count] = useState<number | "">(0);

  // Baseline Comparison State for Edit Form
  const [baseProgramName, setBaseProgramName] = useState("");
  const [baseYear1Count, setBaseYear1Count] = useState<number | "">(0);
  const [baseYear2Count, setBaseYear2Count] = useState<number | "">(0);
  const [baseYear3Count, setBaseYear3Count] = useState<number | "">(0);
  const [baseYear4Count, setBaseYear4Count] = useState<number | "">(0);

  // Validation States
  const [programCodeError, setProgramCodeError] = useState("");

  // --- Pagination States --- //
  const maxRowPrograms = 10;
  const [currentProgramPage, setCurrentProgramPage] = useState(1);
  const [pageChangingPrograms, setPageChangingPrograms] = useState(false);

  // --- Toast States --- //
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState<"success" | "warning" | "error" | "">("");
  const [toastMessage, setToastMessage] = useState("");
  const [showToastTimer, setShowToastTimer] = useState(false);
  const [progress, setProgress] = useState(0);

  /***********************
   * INPUT VALIDATION *
   ***********************/

  const handleProgramCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.slice(0, 13);
    const val = filterAlphanumericDashUnderscore(rawVal);
    setInputProgramCode(val);
    if (val.trim()) {
      setProgramCodeError("");
    } else {
      setProgramCodeError("Program code is required.");
    }
  };

  const handleProgramNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.slice(0, 100);
    const val = filterAlphanumericDashUnderscoreComma(rawVal);
    setInputProgramName(val);
  };

  const handleEditProgramNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.slice(0, 100);
    const val = filterAlphanumericDashUnderscoreComma(rawVal);
    setEditProgramName(val);
  };

  const clampStudentCount = (val: string): number | "" => {
    if (val === "") return "";
    const parsed = parseInt(val, 10);
    if (isNaN(parsed)) return 0;
    return Math.min(1000, Math.max(0, parsed));
  };

  /***********************
   * HELPER UTILITIES *
   ***********************/

  const parseStudentsJSON = (students: unknown): CollegeYearLevelDistribution => {
    if (!students) return { "1": 0, "2": 0, "3": 0, "4": 0 };
    if (typeof students === "string") {
      try {
        return JSON.parse(students);
      } catch {
        return { "1": 0, "2": 0, "3": 0, "4": 0 };
      }
    }
    return students as CollegeYearLevelDistribution;
  };

  const getTotalStudents = (students: CollegeYearLevelDistribution | null): number => {
    if (!students) return 0;
    const parsed = parseStudentsJSON(students);
    const y1 = parsed["1"] ?? 0;
    const y2 = parsed["2"] ?? 0;
    const y3 = parsed["3"] ?? 0;
    const y4 = parsed["4"] ?? 0;
    return (Number(y1) || 0) + (Number(y2) || 0) + (Number(y3) || 0) + (Number(y4) || 0);
  };

  /***********************
   * TABLE & FORM EVENTS *
   ***********************/

  const handleProgramSorting = (sortBy: string) => {
    const newDir = sortBy === sortProgramsBy && sortProgramsDir === "ASC" ? "DESC" : "ASC";
    setSortProgramsBy(sortBy);
    setSortProgramsDir(newDir);
    setPrograms([]);
    setCurrentProgramPage(1);
    getCollegePrograms(searchTerm, sortBy, newDir, maxRowPrograms, 1);
  };

  const onPageChangePrograms = (page: number) => {
    if (pageChangingPrograms) return;
    setPageChangingPrograms(true);
    setPrograms([]);
    getCollegePrograms(searchTerm, sortProgramsBy, sortProgramsDir, maxRowPrograms, page);
    setPageChangingPrograms(false);
    setCurrentProgramPage(page);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentProgramPage(1);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setCurrentProgramPage(1);
  };

  const loadEditData = (program_code: string) => {
    setSelectedProgramCode(program_code);
    const selected = programs.find((item) => item.program_code === program_code);

    if (selected) {
      const parsed = parseStudentsJSON(selected.students);
      const y1 = parsed["1"] ?? 0;
      const y2 = parsed["2"] ?? 0;
      const y3 = parsed["3"] ?? 0;
      const y4 = parsed["4"] ?? 0;

      setBaseProgramName(selected.program_name ?? "");
      setBaseYear1Count(y1);
      setBaseYear2Count(y2);
      setBaseYear3Count(y3);
      setBaseYear4Count(y4);

      setEditProgramName(selected.program_name ?? "");
      setEditYear1Count(y1);
      setEditYear2Count(y2);
      setEditYear3Count(y3);
      setEditYear4Count(y4);

      setOpenEditProgramModal(true);
    }
  };

  const handleCloseProgramModals = () => {
    setSelectedProgramCode("");
    setProgramCodeError("");
    setOpenAddProgramModal(false);
    setOpenEditProgramModal(false);
    setOpenDeleteProgramModal(false);

    setInputProgramCode("");
    setInputProgramName("");
    setInputYear1Count(0);
    setInputYear2Count(0);
    setInputYear3Count(0);
    setInputYear4Count(0);

    setEditProgramName("");
    setEditYear1Count(0);
    setEditYear2Count(0);
    setEditYear3Count(0);
    setEditYear4Count(0);
  };

  /**********************
   * INTEGRATED CRUD LOGIC *
   **********************/

  // Read
  async function getCollegePrograms(
    search: string | null = searchTerm,
    sortby: string = sortProgramsBy,
    sortdir: "ASC" | "DESC" = sortProgramsDir,
    limit: number = maxRowPrograms,
    page: number = currentProgramPage
  ) {
    setLoading(true);

    const [dataRes, countRes] = await Promise.all([
      fetchPrograms(search, "tertiary", sortby, sortdir, limit, page),
      fetchProgramsCount(search, "tertiary"),
    ]);

    if (dataRes.success && Array.isArray(dataRes.data)) {
      const mappedPrograms: CollegeProgram[] = dataRes.data.map((item: ProgramRecord) => ({
        program_code: item.program_code,
        program_name: item.program_name,
        students: parseStudentsJSON(item.students),
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));

      setPrograms(mappedPrograms);
    } else {
      triggerToast("error", dataRes.error || "Failed to fetch college programs.");
      setPrograms([]);
    }

    if (countRes.success) {
      setProgramsCount(countRes.count);
    } else {
      setProgramsCount(0);
    }

    setLoading(false);
  }

  // Create
  async function handleProgramSubmit() {
    if (!inputProgramCode.trim()) {
      setProgramCodeError("Program code is required.");
      return;
    }

    const payload: ProgramInput = {
      program_code: inputProgramCode.trim(),
      program_name: inputProgramName.trim() || undefined,
      year_level: "tertiary",
      students: {
        "1": Number(inputYear1Count) || 0,
        "2": Number(inputYear2Count) || 0,
        "3": Number(inputYear3Count) || 0,
        "4": Number(inputYear4Count) || 0,
      },
    };

    const res = await createProgram(activeUser, payload);

    if (res.success) {
      triggerToast("success", `College Program "${inputProgramCode}" created successfully.`);
      handleCloseProgramModals();
      getCollegePrograms(searchTerm, sortProgramsBy, sortProgramsDir, maxRowPrograms, currentProgramPage);
    } else {
      triggerToast("error", res.error || "Failed to create college program.");
    }
  }

  // Update
  async function handleProgramUpdate() {
    const payload = {
      program_name: editProgramName.trim() || undefined,
      year_level: "tertiary",
      students: {
        "1": Number(editYear1Count) || 0,
        "2": Number(editYear2Count) || 0,
        "3": Number(editYear3Count) || 0,
        "4": Number(editYear4Count) || 0,
      },
    };

    const res = await updateProgram(activeUser, selectedProgramCode, payload);

    if (res.success) {
      triggerToast("success", `College Program "${selectedProgramCode}" updated successfully.`);
      handleCloseProgramModals();
      getCollegePrograms(searchTerm, sortProgramsBy, sortProgramsDir, maxRowPrograms, currentProgramPage);
    } else {
      triggerToast("error", res.error || "Failed to update college program.");
    }
  }

  // Delete
  async function handleProgramDelete() {
    const res = await deleteProgram(activeUser, selectedProgramCode);

    if (res.success) {
      triggerToast("success", `College Program "${selectedProgramCode}" deleted successfully.`);
      handleCloseProgramModals();
      getCollegePrograms(searchTerm, sortProgramsBy, sortProgramsDir, maxRowPrograms, currentProgramPage);
    } else {
      triggerToast("error", res.error || "Failed to delete college program.");
    }
  }

  /*******************
   * TOAST UTILITIES *
   *******************/

  function triggerToast(type: "success" | "warning" | "error", message: string) {
    setToastType(type);
    setToastMessage(message);
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
  }

  function closeToast() {
    setShowToast(false);
    setToastType("");
    setToastMessage("");
    setShowToastTimer(false);
  }

  /**************
   * USEEFFECTS *
   **************/

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      void getCollegePrograms(searchTerm, sortProgramsBy, sortProgramsDir, maxRowPrograms, currentProgramPage);
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
            <ToastToggle onDismiss={closeToast} />
          </Toast>
          <Progress
            progress={Math.min(Math.round(progress), 100)}
            size="sm"
            className={`${showToastTimer ? "" : "hidden"} ease-linear`}
          />
        </div>
      )}

      <div className={"m-8"}>
        {/* --- Header Section with Search & Add Button --- */}
        <div className="mb-4 flex-col justify-between gap-4 md:flex md:flex-row md:items-center">
          <div>
            <h2 className="mb-1 text-lg font-bold">College Programs Management</h2>
            <p className="text-gray-500">
              Manage college degree programs and student counts per year level (1st - 4th Year).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative mr-4 w-full md:w-64">
              <TextInput
                id="search-college-programs"
                type="text"
                placeholder="Search code, program name..."
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
              onClick={() => setOpenAddProgramModal(true)}
            >
              <FaPlus className="mr-2" />
              Add Program
            </Button>
          </div>
        </div>

        {/* --- Main College Programs Table --- */}
        <Card className="overflow-x-auto">
          <Table hoverable>
            <TableHead>
              <TableRow>
                <TableHeadCell onClick={() => handleProgramSorting("program_code")}>
                  <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                    Program Code
                    {sortProgramsBy === "program_code" && (
                      sortProgramsDir === "ASC" ? <FaSortUp className="ml-1" /> : <FaSortDown className="ml-1" />
                    )}
                  </div>
                </TableHeadCell>

                <TableHeadCell onClick={() => handleProgramSorting("program_name")}>
                  <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                    Program Name
                    {sortProgramsBy === "program_name" && (
                      sortProgramsDir === "ASC" ? <FaSortUp className="ml-1" /> : <FaSortDown className="ml-1" />
                    )}
                  </div>
                </TableHeadCell>

                <TableHeadCell>Student Distribution (1st - 4th Year)</TableHeadCell>

                <TableHeadCell>Total Students</TableHeadCell>

                <TableHeadCell>
                  <span className="sr-only">Edit</span>
                </TableHeadCell>
              </TableRow>
            </TableHead>

            <TableBody className="divide-y">
              {programs.length > 0 ? (
                programs.map((item) => {
                  const total = getTotalStudents(item.students);
                  const st = parseStudentsJSON(item.students);
                  return (
                    <TableRow
                      key={item.program_code}
                      className="bg-white dark:border-gray-700 dark:bg-gray-800"
                    >
                      <TableCell className="font-medium whitespace-nowrap">
                        {item.program_code}
                      </TableCell>
                      <TableCell>{item.program_name || "—"}</TableCell>
                      <TableCell>
                        <span className="text-xs">
                          1st Yr: <strong>{st["1"] ?? 0}</strong> | 2nd Yr:{" "}
                          <strong>{st["2"] ?? 0}</strong> | 3rd Yr:{" "}
                          <strong>{st["3"] ?? 0}</strong> | 4th Yr:{" "}
                          <strong>{st["4"] ?? 0}</strong>
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold">{total}</TableCell>
                      <TableCell>
                        <a
                          onClick={() => loadEditData(item.program_code)}
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
                      ? `No college programs matching "${searchTerm}" found.`
                      : "No college program entries found yet."}
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
            currentPage={currentProgramPage || 1}
            itemsPerPage={maxRowPrograms}
            totalItems={programsCount || 1}
            onPageChange={onPageChangePrograms}
            showIcons
          />
        </div>
      </div>

      {/* --- Add College Program Modal --- */}
      <Modal show={openAddProgramModal} onClose={handleCloseProgramModals}>
        <ModalHeader>Add College Program</ModalHeader>
        <ModalBody>
          <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label htmlFor="program_code">Program Code *</Label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {inputProgramCode.length} / 13
                </span>
              </div>
              <TextInput
                id="program_code"
                placeholder="e.g. BSIT"
                maxLength={13}
                value={inputProgramCode}
                onChange={handleProgramCodeChange}
                color={programCodeError ? "failure" : "gray"}
                required
              />
              {programCodeError && (
                <p className="mt-1 text-sm font-medium text-red-600">{programCodeError}</p>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label htmlFor="program_name">Program Name</Label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {inputProgramName.length} / 100
                </span>
              </div>
              <TextInput
                id="program_name"
                placeholder="e.g. Bachelor of Science in Information Technology"
                maxLength={100}
                value={inputProgramName}
                onChange={handleProgramNameChange}
              />
            </div>

            <div>
              <div className="mb-2 block">
                <Label>Student Distribution by Year Level (Max 1,000 per year)</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="input_year_1" className="text-xs">
                    1st Year Students
                  </Label>
                  <TextInput
                    id="input_year_1"
                    type="text"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={inputYear1Count}
                    onChange={(e) =>
                      setInputYear1Count(clampStudentCount(filterNumeric(e.target.value)))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="input_year_2" className="text-xs">
                    2nd Year Students
                  </Label>
                  <TextInput
                    id="input_year_2"
                    type="text"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={inputYear2Count}
                    onChange={(e) =>
                      setInputYear2Count(clampStudentCount(filterNumeric(e.target.value)))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="input_year_3" className="text-xs">
                    3rd Year Students
                  </Label>
                  <TextInput
                    id="input_year_3"
                    type="text"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={inputYear3Count}
                    onChange={(e) =>
                      setInputYear3Count(clampStudentCount(filterNumeric(e.target.value)))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="input_year_4" className="text-xs">
                    4th Year Students
                  </Label>
                  <TextInput
                    id="input_year_4"
                    type="text"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={inputYear4Count}
                    onChange={(e) =>
                      setInputYear4Count(clampStudentCount(filterNumeric(e.target.value)))
                    }
                  />
                </div>
              </div>
            </div>
          </form>
        </ModalBody>
        <ModalFooter>
          <Button onClick={handleProgramSubmit} disabled={!inputProgramCode.trim()}>
            Save
          </Button>
          <Button color="alternative" onClick={handleCloseProgramModals}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* --- Edit College Program Modal --- */}
      <Modal show={openEditProgramModal} onClose={handleCloseProgramModals}>
        <ModalHeader>Edit College Program ({selectedProgramCode})</ModalHeader>
        <ModalBody>
          <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label htmlFor="edit_program_name">Program Name</Label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {editProgramName.length} / 100
                </span>
              </div>
              <TextInput
                id="edit_program_name"
                maxLength={100}
                value={editProgramName}
                onChange={handleEditProgramNameChange}
              />
            </div>

            <div>
              <div className="mb-2 block">
                <Label>Student Distribution by Year Level (Max 1,000 per year)</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit_year_1" className="text-xs">
                    1st Year Students
                  </Label>
                  <TextInput
                    id="edit_year_1"
                    type="text"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={editYear1Count}
                    onChange={(e) =>
                      setEditYear1Count(clampStudentCount(filterNumeric(e.target.value)))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit_year_2" className="text-xs">
                    2nd Year Students
                  </Label>
                  <TextInput
                    id="edit_year_2"
                    type="text"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={editYear2Count}
                    onChange={(e) =>
                      setEditYear2Count(clampStudentCount(filterNumeric(e.target.value)))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit_year_3" className="text-xs">
                    3rd Year Students
                  </Label>
                  <TextInput
                    id="edit_year_3"
                    type="text"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={editYear3Count}
                    onChange={(e) =>
                      setEditYear3Count(clampStudentCount(filterNumeric(e.target.value)))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit_year_4" className="text-xs">
                    4th Year Students
                  </Label>
                  <TextInput
                    id="edit_year_4"
                    type="text"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={editYear4Count}
                    onChange={(e) =>
                      setEditYear4Count(clampStudentCount(filterNumeric(e.target.value)))
                    }
                  />
                </div>
              </div>
            </div>
          </form>
        </ModalBody>
        <ModalFooter className="flex w-full justify-between">
          <div className="flex gap-4">
            <Button
              onClick={handleProgramUpdate}
              disabled={
                baseProgramName === editProgramName.trim() &&
                baseYear1Count === editYear1Count &&
                baseYear2Count === editYear2Count &&
                baseYear3Count === editYear3Count &&
                baseYear4Count === editYear4Count
              }
            >
              Save
            </Button>
            <Button color="alternative" onClick={handleCloseProgramModals}>
              Cancel
            </Button>
          </div>
          <Button color="red" onClick={() => setOpenDeleteProgramModal(true)}>
            <FaTrash />
          </Button>
        </ModalFooter>
      </Modal>

      {/* --- Delete Confirmation Modal --- */}
      <Modal
        show={openDeleteProgramModal}
        size="md"
        onClose={() => setOpenDeleteProgramModal(false)}
        popup
      >
        <ModalHeader />
        <ModalBody>
          <div className="text-center">
            <FaTrash className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
            <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
              Are you sure you want to delete program &quot;{selectedProgramCode}&quot;?
            </h3>
            <div className="flex justify-center gap-4">
              <Button color="red" onClick={handleProgramDelete}>
                Yes, I&#39;m sure
              </Button>
              <Button
                color="alternative"
                onClick={() => setOpenDeleteProgramModal(false)}
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