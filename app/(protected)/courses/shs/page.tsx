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

// Models the student distribution per grade level inside the JSON column for SHS
export interface GradeLevelDistribution {
  grade_11?: number;
  grade_12?: number;
  [key: string]: unknown;
}

// Matches the "strands" table schema
export interface Strand {
  strand_code: string;
  strand_name: string | null;
  grade_level: string | null;
  students: GradeLevelDistribution | null;
  created_at?: string;
  updated_at?: string;
}

export default function StrandsManagement() {
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];
  const activeUser = activeAccount?.username;
  const [isLoading, setLoading] = useState(false);

  // --- Table & Filter States --- //
  const [strands, setStrands] = useState<Strand[]>([]);
  const [strandsCount, setStrandsCount] = useState(0);
  const [sortStrandsBy, setSortStrandsBy] = useState("strand_code");
  const [sortStrandsDir, setSortStrandsDir] = useState<"ASC" | "DESC">("ASC");
  const [searchTerm, setSearchTerm] = useState("");

  // --- Modal Visibility States --- //
  const [openAddStrandModal, setOpenAddStrandModal] = useState(false);
  const [openEditStrandModal, setOpenEditStrandModal] = useState(false);
  const [openDeleteStrandModal, setOpenDeleteStrandModal] = useState(false);

  // --- Form & Selection States --- //
  const [selectedStrandCode, setSelectedStrandCode] = useState("");

  // Add State
  const [inputStrandCode, setInputStrandCode] = useState("");
  const [inputStrandName, setInputStrandName] = useState("");
  const [inputGradeLevel, setInputGradeLevel] = useState("Grade 11");
  const [inputGrade11Count, setInputGrade11Count] = useState<number | "">(0);
  const [inputGrade12Count, setInputGrade12Count] = useState<number | "">(0);

  // Update State
  const [editStrandName, setEditStrandName] = useState("");
  const [editGradeLevel, setEditGradeLevel] = useState("Grade 11");
  const [editGrade11Count, setEditGrade11Count] = useState<number | "">(0);
  const [editGrade12Count, setEditGrade12Count] = useState<number | "">(0);

  // Baseline Comparison State for Edit Form
  const [baseStrandName, setBaseStrandName] = useState("");
  const [baseGradeLevel, setBaseGradeLevel] = useState("Grade 11");
  const [baseGrade11Count, setBaseGrade11Count] = useState<number | "">(0);
  const [baseGrade12Count, setBaseGrade12Count] = useState<number | "">(0);

  // Validation States
  const [strandCodeError, setStrandCodeError] = useState("");

  // --- Pagination States --- //
  const maxRowStrands = 10;
  const [currentStrandPage, setCurrentStrandPage] = useState(1);
  const [pageChangingStrands, setPageChangingStrands] = useState(false);

  // --- Toast States --- //
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState<"success" | "warning" | "error" | "">("");
  const [toastMessage, setToastMessage] = useState("");
  const [showToastTimer, setShowToastTimer] = useState(false);
  const [progress, setProgress] = useState(0);

  /***********************
   * INPUT VALIDATION *
   ***********************/

  const handleStrandCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.slice(0, 13);
    const val = filterAlphanumericDashUnderscore(rawVal);
    setInputStrandCode(val);
    if (val.trim()) {
      setStrandCodeError("");
    } else {
      setStrandCodeError("Strand code is required.");
    }
  };

  const handleStrandNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.slice(0, 100);
    const val = filterAlphaDashSpace(rawVal);
    setInputStrandName(val);
  };

  const handleEditStrandNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.slice(0, 100);
    const val = filterAlphaDashSpace(rawVal);
    setEditStrandName(val);
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

  const getTotalStudents = (students: GradeLevelDistribution | null): number => {
    if (!students) return 0;
    const { grade_11 = 0, grade_12 = 0 } = students;
    return (Number(grade_11) || 0) + (Number(grade_12) || 0);
  };

  /***********************
   * TABLE & FORM EVENTS *
   ***********************/

  const handleStrandSorting = (sortBy: string) => {
    const newDir = sortBy === sortStrandsBy && sortStrandsDir === "ASC" ? "DESC" : "ASC";
    setSortStrandsBy(sortBy);
    setSortStrandsDir(newDir);
    setStrands([]);
    setCurrentStrandPage(1);
    getStrands(searchTerm, sortBy, newDir, maxRowStrands, 1);
  };

  const onPageChangeStrands = (page: number) => {
    if (pageChangingStrands) return;
    setPageChangingStrands(true);
    setStrands([]);
    getStrands(searchTerm, sortStrandsBy, sortStrandsDir, maxRowStrands, page);
    setPageChangingStrands(false);
    setCurrentStrandPage(page);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentStrandPage(1);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setCurrentStrandPage(1);
  };

  const loadEditData = (strand_code: string) => {
    setSelectedStrandCode(strand_code);
    const selected = strands.find((item) => item.strand_code === strand_code);

    if (selected) {
      const g11 = selected.students?.grade_11 ?? 0;
      const g12 = selected.students?.grade_12 ?? 0;

      setBaseStrandName(selected.strand_name ?? "");
      setBaseGradeLevel(selected.grade_level ?? "Grade 11");
      setBaseGrade11Count(g11);
      setBaseGrade12Count(g12);

      setEditStrandName(selected.strand_name ?? "");
      setEditGradeLevel(selected.grade_level ?? "Grade 11");
      setEditGrade11Count(g11);
      setEditGrade12Count(g12);

      setOpenEditStrandModal(true);
    }
  };

  const handleCloseStrandModals = () => {
    setSelectedStrandCode("");
    setStrandCodeError("");
    setOpenAddStrandModal(false);
    setOpenEditStrandModal(false);
    setOpenDeleteStrandModal(false);

    // Reset add state
    setInputStrandCode("");
    setInputStrandName("");
    setInputGradeLevel("Grade 11");
    setInputGrade11Count(0);
    setInputGrade12Count(0);

    // Reset edit state
    setEditStrandName("");
    setEditGradeLevel("Grade 11");
    setEditGrade11Count(0);
    setEditGrade12Count(0);
  };

  /**********************
   * STUBBED CRUD LOGIC *
   **********************/

  // Count
  async function getStrandCount(search?: string | null) {
    // TODO: Plug in server action -> fetchStrandsCount(search)
  }

  // Read
  async function getStrands(
    search: string | null = searchTerm,
    sortby: string = sortStrandsBy,
    sortdir: "ASC" | "DESC" = sortStrandsDir,
    limit: number = maxRowStrands,
    page: number = currentStrandPage
  ) {
    setLoading(true);

    // TODO: Plug in server action -> fetchStrands(search, sortby, sortdir, limit, page)

    setLoading(false);
  }

  // Create
  async function handleStrandSubmit() {
    if (!inputStrandCode.trim()) {
      setStrandCodeError("Strand code is required.");
      return;
    }

    const studentsDistribution: GradeLevelDistribution = {
      grade_11: Number(inputGrade11Count) || 0,
      grade_12: Number(inputGrade12Count) || 0,
    };

    // TODO: Plug in server action -> createStrand(activeUser, { strand_code, strand_name, grade_level, students: studentsDistribution })

    handleCloseStrandModals();
    getStrands(searchTerm, sortStrandsBy, sortStrandsDir, maxRowStrands, currentStrandPage);
  }

  // Update
  async function handleStrandUpdate() {
    const studentsDistribution: GradeLevelDistribution = {
      grade_11: Number(editGrade11Count) || 0,
      grade_12: Number(editGrade12Count) || 0,
    };

    // TODO: Plug in server action -> updateStrand(activeUser, selectedStrandCode, { strand_name, grade_level, students: studentsDistribution })

    handleCloseStrandModals();
    getStrands(searchTerm, sortStrandsBy, sortStrandsDir, maxRowStrands, currentStrandPage);
  }

  // Delete
  async function handleStrandDelete() {
    // TODO: Plug in server action -> deleteStrand(activeUser, selectedStrandCode)

    handleCloseStrandModals();
    getStrands(searchTerm, sortStrandsBy, sortStrandsDir, maxRowStrands, currentStrandPage);
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
      void getStrands(searchTerm, sortStrandsBy, sortStrandsDir, maxRowStrands, currentStrandPage);
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
          <h2 className="mb-1 text-lg font-bold">SHS Strands Management</h2>
          <p className="text-gray-500">
            Manage senior high school academic strands, grade levels, and student counts per batch.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative mr-4 w-full md:w-64">
            <TextInput
              id="search-strands"
              type="text"
              placeholder="Search code, strand name..."
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
            onClick={() => setOpenAddStrandModal(true)}
          >
            <FaPlus className="mr-2" />
            Add Strand
          </Button>
        </div>
      </div>

      {/* --- Main Strands Table --- */}
      <Card className="overflow-x-auto">
        <Table hoverable>
          <TableHead>
            <TableRow>
              <TableHeadCell onClick={() => handleStrandSorting("strand_code")}>
                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Strand Code
                  {sortStrandsBy === "strand_code" && (
                    sortStrandsDir === "ASC" ? <FaSortUp className="ml-1" /> : <FaSortDown className="ml-1" />
                  )}
                </div>
              </TableHeadCell>

              <TableHeadCell onClick={() => handleStrandSorting("strand_name")}>
                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Strand Name
                  {sortStrandsBy === "strand_name" && (
                    sortStrandsDir === "ASC" ? <FaSortUp className="ml-1" /> : <FaSortDown className="ml-1" />
                  )}
                </div>
              </TableHeadCell>

              <TableHeadCell onClick={() => handleStrandSorting("grade_level")}>
                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Active Grade Level
                  {sortStrandsBy === "grade_level" && (
                    sortStrandsDir === "ASC" ? <FaSortUp className="ml-1" /> : <FaSortDown className="ml-1" />
                  )}
                </div>
              </TableHeadCell>

              <TableHeadCell>Student Distribution (Grade 11 - 12)</TableHeadCell>

              <TableHeadCell>Total Students</TableHeadCell>

              <TableHeadCell>
                <span className="sr-only">Edit</span>
              </TableHeadCell>
            </TableRow>
          </TableHead>

          <TableBody className="divide-y">
            {strands.length > 0 ? (
              strands.map((item) => {
                const total = getTotalStudents(item.students);
                const st = item.students;
                return (
                  <TableRow
                    key={item.strand_code}
                    className="bg-white dark:border-gray-700 dark:bg-gray-800"
                  >
                    <TableCell className="font-medium whitespace-nowrap">
                      {item.strand_code}
                    </TableCell>
                    <TableCell>{item.strand_name || "—"}</TableCell>
                    <TableCell>{item.grade_level || "—"}</TableCell>
                    <TableCell>
                      {st ? (
                        <span className="text-xs">
                          Grade 11: <strong>{st.grade_11 ?? 0}</strong> | Grade 12:{" "}
                          <strong>{st.grade_12 ?? 0}</strong>
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="font-semibold">{total}</TableCell>
                    <TableCell>
                      <a
                        onClick={() => loadEditData(item.strand_code)}
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
                    ? `No strands matching "${searchTerm}" found.`
                    : "No strand entries found yet."}
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
          currentPage={currentStrandPage || 1}
          itemsPerPage={maxRowStrands}
          totalItems={strandsCount || 1}
          onPageChange={onPageChangeStrands}
          showIcons
        />
      </div>

      {/* --- Add Strand Modal --- */}
      <Modal show={openAddStrandModal} onClose={handleCloseStrandModals}>
        <ModalHeader>Add Strand</ModalHeader>
        <ModalBody>
          <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label htmlFor="strand_code">Strand Code *</Label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {inputStrandCode.length} / 13
                </span>
              </div>
              <TextInput
                id="strand_code"
                placeholder="e.g. STEM"
                maxLength={13}
                value={inputStrandCode}
                onChange={handleStrandCodeChange}
                color={strandCodeError ? "failure" : "gray"}
                required
              />
              {strandCodeError && (
                <p className="mt-1 text-sm font-medium text-red-600">{strandCodeError}</p>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label htmlFor="strand_name">Strand Name</Label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {inputStrandName.length} / 100
                </span>
              </div>
              <TextInput
                id="strand_name"
                placeholder="e.g. Science, Technology, Engineering, and Mathematics"
                maxLength={100}
                value={inputStrandName}
                onChange={handleStrandNameChange}
              />
            </div>

            <div>
              <div className="mb-2 block">
                <Label htmlFor="grade_level">Active Grade Level</Label>
              </div>
              <Select
                id="grade_level"
                value={inputGradeLevel}
                onChange={(e) => setInputGradeLevel(e.target.value)}
              >
                <option value="Grade 11">Grade 11</option>
                <option value="Grade 12">Grade 12</option>
              </Select>
            </div>

            <div>
              <div className="mb-2 block">
                <Label>Student Distribution by Grade Level (Max 1,000 per grade)</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="input_grade_11" className="text-xs">
                    Grade 11 Students
                  </Label>
                  <TextInput
                    id="input_grade_11"
                    type="number"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={inputGrade11Count}
                    onChange={(e) =>
                      setInputGrade11Count(clampStudentCount(e.target.value))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="input_grade_12" className="text-xs">
                    Grade 12 Students
                  </Label>
                  <TextInput
                    id="input_grade_12"
                    type="number"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={inputGrade12Count}
                    onChange={(e) =>
                      setInputGrade12Count(clampStudentCount(e.target.value))
                    }
                  />
                </div>
              </div>
            </div>
          </form>
        </ModalBody>
        <ModalFooter>
          <Button onClick={handleStrandSubmit} disabled={!inputStrandCode.trim()}>
            Save
          </Button>
          <Button color="alternative" onClick={handleCloseStrandModals}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* --- Edit Strand Modal --- */}
      <Modal show={openEditStrandModal} onClose={handleCloseStrandModals}>
        <ModalHeader>Edit Strand ({selectedStrandCode})</ModalHeader>
        <ModalBody>
          <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label htmlFor="edit_strand_name">Strand Name</Label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {editStrandName.length} / 100
                </span>
              </div>
              <TextInput
                id="edit_strand_name"
                maxLength={100}
                value={editStrandName}
                onChange={handleEditStrandNameChange}
              />
            </div>

            <div>
              <div className="mb-2 block">
                <Label htmlFor="edit_grade_level">Active Grade Level</Label>
              </div>
              <Select
                id="edit_grade_level"
                value={editGradeLevel}
                onChange={(e) => setEditGradeLevel(e.target.value)}
              >
                <option value="Grade 11">Grade 11</option>
                <option value="Grade 12">Grade 12</option>
              </Select>
            </div>

            <div>
              <div className="mb-2 block">
                <Label>Student Distribution by Grade Level (Max 1,000 per grade)</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit_grade_11" className="text-xs">
                    Grade 11 Students
                  </Label>
                  <TextInput
                    id="edit_grade_11"
                    type="number"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={editGrade11Count}
                    onChange={(e) =>
                      setEditGrade11Count(clampStudentCount(e.target.value))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit_grade_12" className="text-xs">
                    Grade 12 Students
                  </Label>
                  <TextInput
                    id="edit_grade_12"
                    type="number"
                    min={0}
                    max={1000}
                    placeholder="0"
                    value={editGrade12Count}
                    onChange={(e) =>
                      setEditGrade12Count(clampStudentCount(e.target.value))
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
              onClick={handleStrandUpdate}
              disabled={
                baseStrandName === editStrandName.trim() &&
                baseGradeLevel === editGradeLevel &&
                baseGrade11Count === editGrade11Count &&
                baseGrade12Count === editGrade12Count
              }
            >
              Save
            </Button>
            <Button color="alternative" onClick={handleCloseStrandModals}>
              Cancel
            </Button>
          </div>
          <Button color="red" onClick={() => setOpenDeleteStrandModal(true)}>
            <FaTrash />
          </Button>
        </ModalFooter>
      </Modal>

      {/* --- Delete Confirmation Modal --- */}
      <Modal
        show={openDeleteStrandModal}
        size="md"
        onClose={() => setOpenDeleteStrandModal(false)}
        popup
      >
        <ModalHeader />
        <ModalBody>
          <div className="text-center">
            <FaTrash className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
            <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
              Are you sure you want to delete strand &quot;{selectedStrandCode}&quot;?
            </h3>
            <div className="flex justify-center gap-4">
              <Button color="red" onClick={handleStrandDelete}>
                Yes, I&#39;m sure
              </Button>
              <Button
                color="alternative"
                onClick={() => setOpenDeleteStrandModal(false)}
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