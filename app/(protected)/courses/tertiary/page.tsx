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
  filterAlphaDashSpace,
} from "@/utils/validation";

// Models the student distribution per year level inside the JSON column
export interface YearLevelDistribution {
  first_year?: number;
  second_year?: number;
  third_year?: number;
  fourth_year?: number;
  [key: string]: unknown;
}

// Matches the "programs" table schema
export interface Program {
  program_code: string;
  program_name: string | null;
  year_level: string | null;
  students: YearLevelDistribution | null;
  created_at?: string;
  updated_at?: string;
}

export default function ProgramsManagement() {
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];
  const activeUser = activeAccount?.username;
  const [isLoading, setLoading] = useState(false);

  // --- Table & Filter States --- //
  const [programs, setPrograms] = useState<Program[]>([]);
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
  const [inputYearLevel, setInputYearLevel] = useState("1st Year");
  const [inputFirstYearCount, setInputFirstYearCount] = useState<number | "">(0);
  const [inputSecondYearCount, setInputSecondYearCount] = useState<number | "">(0);
  const [inputThirdYearCount, setInputThirdYearCount] = useState<number | "">(0);
  const [inputFourthYearCount, setInputFourthYearCount] = useState<number | "">(0);

  // Update State
  const [editProgramName, setEditProgramName] = useState("");
  const [editYearLevel, setEditYearLevel] = useState("1st Year");
  const [editFirstYearCount, setEditFirstYearCount] = useState<number | "">(0);
  const [editSecondYearCount, setEditSecondYearCount] = useState<number | "">(0);
  const [editThirdYearCount, setEditThirdYearCount] = useState<number | "">(0);
  const [editFourthYearCount, setEditFourthYearCount] = useState<number | "">(0);

  // Baseline Comparison State for Edit Form
  const [baseProgramName, setBaseProgramName] = useState("");
  const [baseYearLevel, setBaseYearLevel] = useState("1st Year");
  const [baseFirstYearCount, setBaseFirstYearCount] = useState<number | "">(0);
  const [baseSecondYearCount, setBaseSecondYearCount] = useState<number | "">(0);
  const [baseThirdYearCount, setBaseThirdYearCount] = useState<number | "">(0);
  const [baseFourthYearCount, setBaseFourthYearCount] = useState<number | "">(0);

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
    const val = filterAlphaDashSpace(rawVal);
    setInputProgramName(val);
  };

  const handleEditProgramNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.slice(0, 100);
    const val = filterAlphaDashSpace(rawVal);
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

  const getTotalStudents = (students: YearLevelDistribution | null): number => {
    if (!students) return 0;
    const { first_year = 0, second_year = 0, third_year = 0, fourth_year = 0 } = students;
    return (
      (Number(first_year) || 0) +
      (Number(second_year) || 0) +
      (Number(third_year) || 0) +
      (Number(fourth_year) || 0)
    );
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
    getPrograms(searchTerm, sortBy, newDir, maxRowPrograms, 1);
  };

  const onPageChangePrograms = (page: number) => {
    if (pageChangingPrograms) return;
    setPageChangingPrograms(true);
    setPrograms([]);
    getPrograms(searchTerm, sortProgramsBy, sortProgramsDir, maxRowPrograms, page);
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
      const first = selected.students?.first_year ?? 0;
      const second = selected.students?.second_year ?? 0;
      const third = selected.students?.third_year ?? 0;
      const fourth = selected.students?.fourth_year ?? 0;

      setBaseProgramName(selected.program_name ?? "");
      setBaseYearLevel(selected.year_level ?? "1st Year");
      setBaseFirstYearCount(first);
      setBaseSecondYearCount(second);
      setBaseThirdYearCount(third);
      setBaseFourthYearCount(fourth);

      setEditProgramName(selected.program_name ?? "");
      setEditYearLevel(selected.year_level ?? "1st Year");
      setEditFirstYearCount(first);
      setEditSecondYearCount(second);
      setEditThirdYearCount(third);
      setEditFourthYearCount(fourth);

      setOpenEditProgramModal(true);
    }
  };

  const handleCloseProgramModals = () => {
    setSelectedProgramCode("");
    setProgramCodeError("");
    setOpenAddProgramModal(false);
    setOpenEditProgramModal(false);
    setOpenDeleteProgramModal(false);

    // Reset add state
    setInputProgramCode("");
    setInputProgramName("");
    setInputYearLevel("1st Year");
    setInputFirstYearCount(0);
    setInputSecondYearCount(0);
    setInputThirdYearCount(0);
    setInputFourthYearCount(0);

    // Reset edit state
    setEditProgramName("");
    setEditYearLevel("1st Year");
    setEditFirstYearCount(0);
    setEditSecondYearCount(0);
    setEditThirdYearCount(0);
    setEditFourthYearCount(0);
  };

  /**********************
   * STUBBED CRUD LOGIC *
   **********************/

  // Count
  async function getProgramCount(search?: string | null) {
    // TODO: Plug in server action -> fetchProgramsCount(search)
  }

  // Read
  async function getPrograms(
    search: string | null = searchTerm,
    sortby: string = sortProgramsBy,
    sortdir: "ASC" | "DESC" = sortProgramsDir,
    limit: number = maxRowPrograms,
    page: number = currentProgramPage
  ) {
    setLoading(true);

    // TODO: Plug in server action -> fetchPrograms(search, sortby, sortdir, limit, page)

    setLoading(false);
  }

  // Create
  async function handleProgramSubmit() {
    if (!inputProgramCode.trim()) {
      setProgramCodeError("Program code is required.");
      return;
    }

    const studentsDistribution: YearLevelDistribution = {
      first_year: Number(inputFirstYearCount) || 0,
      second_year: Number(inputSecondYearCount) || 0,
      third_year: Number(inputThirdYearCount) || 0,
      fourth_year: Number(inputFourthYearCount) || 0,
    };

    // TODO: Plug in server action -> createProgram(activeUser, { program_code, program_name, year_level, students: studentsDistribution })

    handleCloseProgramModals();
    getPrograms(searchTerm, sortProgramsBy, sortProgramsDir, maxRowPrograms, currentProgramPage);
  }

  // Update
  async function handleProgramUpdate() {
    const studentsDistribution: YearLevelDistribution = {
      first_year: Number(editFirstYearCount) || 0,
      second_year: Number(editSecondYearCount) || 0,
      third_year: Number(editThirdYearCount) || 0,
      fourth_year: Number(editFourthYearCount) || 0,
    };

    // TODO: Plug in server action -> updateProgram(activeUser, selectedProgramCode, { program_name, year_level, students: studentsDistribution })

    handleCloseProgramModals();
    getPrograms(searchTerm, sortProgramsBy, sortProgramsDir, maxRowPrograms, currentProgramPage);
  }

  // Delete
  async function handleProgramDelete() {
    // TODO: Plug in server action -> deleteProgram(activeUser, selectedProgramCode)

    handleCloseProgramModals();
    getPrograms(searchTerm, sortProgramsBy, sortProgramsDir, maxRowPrograms, currentProgramPage);
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
      void getPrograms(searchTerm, sortProgramsBy, sortProgramsDir, maxRowPrograms, currentProgramPage);
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

      {/* --- Header Section with Search & Add Button --- */}
      <div className="mb-4 flex-col justify-between gap-4 md:flex md:flex-row md:items-center">
        <div>
          <h2 className="mb-1 text-lg font-bold">Programs Management</h2>
          <p className="text-gray-500">
            Manage academic programs, year levels, and student counts per batch.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative mr-4 w-full md:w-64">
            <TextInput
              id="search-programs"
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

      {/* --- Main Programs Table --- */}
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

              <TableHeadCell onClick={() => handleProgramSorting("year_level")}>
                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Active Year Level
                  {sortProgramsBy === "year_level" && (
                    sortProgramsDir === "ASC" ? <FaSortUp className="ml-1" /> : <FaSortDown className="ml-1" />
                  )}
                </div>
              </TableHeadCell>

              <TableHeadCell>Student Distribution (1st - 4th Yr)</TableHeadCell>

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
                const st = item.students;
                return (
                  <TableRow
                    key={item.program_code}
                    className="bg-white dark:border-gray-700 dark:bg-gray-800"
                  >
                    <TableCell className="font-medium whitespace-nowrap">
                      {item.program_code}
                    </TableCell>
                    <TableCell>{item.program_name || "—"}</TableCell>
                    <TableCell>{item.year_level || "—"}</TableCell>
                    <TableCell>
                      {st ? (
                        <span className="text-xs">
                          1st: <strong>{st.first_year ?? 0}</strong> | 2nd:{" "}
                          <strong>{st.second_year ?? 0}</strong> | 3rd:{" "}
                          <strong>{st.third_year ?? 0}</strong> | 4th:{" "}
                          <strong>{st.fourth_year ?? 0}</strong>
                        </span>
                      ) : (
                        "—"
                      )}
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
                  colSpan={6}
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
                  colSpan={6}
                  className="py-6 text-center text-sm text-gray-500 italic dark:text-gray-400"
                >
                  {searchTerm
                    ? `No programs matching "${searchTerm}" found.`
                    : "No program entries found yet."}
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

      {/* --- Add Program Modal --- */}
      <Modal show={openAddProgramModal} onClose={handleCloseProgramModals}>
        <ModalHeader>Add Program</ModalHeader>
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
                <Label htmlFor="year_level">Active Year Level</Label>
              </div>
              <Select
                id="year_level"
                value={inputYearLevel}
                onChange={(e) => setInputYearLevel(e.target.value)}
              >
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </Select>
            </div>

            <div>
              <div className="mb-2 block">
                <Label>Student Distribution by Year Level (Max 1,000 per year)</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="input_first_year" className="text-xs">
                    1st Year Students
                  </Label>
                  <TextInput
                    id="input_first_year"
                    type="number"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={inputFirstYearCount}
                    onChange={(e) =>
                      setInputFirstYearCount(clampStudentCount(e.target.value))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="input_second_year" className="text-xs">
                    2nd Year Students
                  </Label>
                  <TextInput
                    id="input_second_year"
                    type="number"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={inputSecondYearCount}
                    onChange={(e) =>
                      setInputSecondYearCount(clampStudentCount(e.target.value))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="input_third_year" className="text-xs">
                    3rd Year Students
                  </Label>
                  <TextInput
                    id="input_third_year"
                    type="number"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={inputThirdYearCount}
                    onChange={(e) =>
                      setInputThirdYearCount(clampStudentCount(e.target.value))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="input_fourth_year" className="text-xs">
                    4th Year Students
                  </Label>
                  <TextInput
                    id="input_fourth_year"
                    type="number"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={inputFourthYearCount}
                    onChange={(e) =>
                      setInputFourthYearCount(clampStudentCount(e.target.value))
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

      {/* --- Edit Program Modal --- */}
      <Modal show={openEditProgramModal} onClose={handleCloseProgramModals}>
        <ModalHeader>Edit Program ({selectedProgramCode})</ModalHeader>
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
                <Label htmlFor="edit_year_level">Active Year Level</Label>
              </div>
              <Select
                id="edit_year_level"
                value={editYearLevel}
                onChange={(e) => setEditYearLevel(e.target.value)}
              >
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </Select>
            </div>

            <div>
              <div className="mb-2 block">
                <Label>Student Distribution by Year Level (Max 1,000 per year)</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit_first_year" className="text-xs">
                    1st Year Students
                  </Label>
                  <TextInput
                    id="edit_first_year"
                    type="number"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={editFirstYearCount}
                    onChange={(e) =>
                      setEditFirstYearCount(clampStudentCount(e.target.value))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit_second_year" className="text-xs">
                    2nd Year Students
                  </Label>
                  <TextInput
                    id="edit_second_year"
                    type="number"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={editSecondYearCount}
                    onChange={(e) =>
                      setEditSecondYearCount(clampStudentCount(e.target.value))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit_third_year" className="text-xs">
                    3rd Year Students
                  </Label>
                  <TextInput
                    id="edit_third_year"
                    type="number"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={editThirdYearCount}
                    onChange={(e) =>
                      setEditThirdYearCount(clampStudentCount(e.target.value))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit_fourth_year" className="text-xs">
                    4th Year Students
                  </Label>
                  <TextInput
                    id="edit_fourth_year"
                    type="number"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={editFourthYearCount}
                    onChange={(e) =>
                      setEditFourthYearCount(clampStudentCount(e.target.value))
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
                baseYearLevel === editYearLevel &&
                baseFirstYearCount === editFirstYearCount &&
                baseSecondYearCount === editSecondYearCount &&
                baseThirdYearCount === editThirdYearCount &&
                baseFourthYearCount === editFourthYearCount
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