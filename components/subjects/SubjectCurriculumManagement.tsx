"use client";

import React, { useState, useEffect, useCallback, useTransition, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableHead,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  Button,
  TextInput,
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
import { HiSearch, HiX, HiCheck, HiExclamation, HiChevronRight } from "react-icons/hi";
import { FaPlus, FaSortUp, FaSortDown } from "react-icons/fa";
import { useMsal } from "@azure/msal-react";

import {
  fetchCurricula,
  createCurriculum,
  CurriculumRecord,
  CurriculumInput,
} from "@/app/actions/system";

import { filterCurricula } from "@/utils/validation";

export default function SubjectCurriculumManagement() {
  const router = useRouter();

  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];
  const actor = activeAccount?.username || "system";

  const [curriculaList, setCurriculaList] = useState<CurriculumRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [maxRow] = useState<number>(10);
  const [sortBy, setSortBy] = useState<string>("curriculum_version");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("DESC");

  const [openAddCurriculumModal, setOpenAddCurriculumModal] = useState<boolean>(false);
  const [openAddConfirmation, setOpenAddConfirmation] = useState<boolean>(false);

  const initialCurriculumForm: CurriculumInput = {
    curriculum_version: "",
  };

  const [formData, setFormData] = useState<CurriculumInput>(initialCurriculumForm);
  const [versionError, setVersionError] = useState<string>("");

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

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 150);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const loadCurriculaData = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await fetchCurricula(
          debouncedSearch || null,
          sortBy,
          sortDir,
          100,
          1,
        );
        if (res?.success && Array.isArray(res.data)) {
          setCurriculaList(res.data);
        } else if (Array.isArray(res)) {
          setCurriculaList(res);
        } else {
          setCurriculaList([]);
        }
      } catch (err) {
        console.error("Failed to fetch curricula:", err);
        setCurriculaList([]);
      } finally {
        setIsLoading(false);
      }
    });
  }, [debouncedSearch, sortBy, sortDir]);

  useEffect(() => {
    loadCurriculaData();
  }, [loadCurriculaData]);

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

  const handleCloseModals = () => {
    setOpenAddCurriculumModal(false);
    setOpenAddConfirmation(false);
    setFormData(initialCurriculumForm);
    setVersionError("");
  };

  const handleVersionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const filtered = filterCurricula(rawVal);
    const truncated = filtered.slice(0, 12);

    setFormData((prev) => ({
      ...prev,
      curriculum_version: truncated,
    }));

    setVersionError(!truncated.trim() ? "Curriculum version is required." : "");
  };

  const handleCreateCurriculum = async () => {
    if (!formData.curriculum_version?.trim() || Boolean(versionError)) return;

    const res = await createCurriculum(actor, formData);
    if (res.success) {
      triggerToast("Curriculum created successfully!", "success");
      handleCloseModals();
      loadCurriculaData();
    } else {
      triggerToast(res.error || "Failed to create curriculum.", "error");
    }
  };

  const isFormInvalid = !formData.curriculum_version?.trim() || Boolean(versionError);

  const paginatedCurricula = useMemo(() => {
    return curriculaList.slice(
      (currentPage - 1) * maxRow,
      currentPage * maxRow,
    );
  }, [curriculaList, currentPage, maxRow]);

  const navigateToDetail = (version: string) => {
    router.push(`/subjects/${encodeURIComponent(version)}`);
  };

  return (
    <div>
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
            <ToastToggle onDismiss={() => setShowToast(false)} />
          </Toast>
          <Progress
            progress={Math.min(Math.round(progress), 100)}
            size="sm"
            className={`${showToastTimer ? "" : "hidden"} ease-linear`}
          />
        </div>
      )}

      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="mb-1 text-lg font-bold">Curriculum Directory</h2>
          <p className="text-gray-500">
            Select a curriculum to view all associated subjects or create a new curriculum version.
          </p>
        </div>
        <Button
          onClick={() => {
            setFormData(initialCurriculumForm);
            setVersionError("");
            setOpenAddCurriculumModal(true);
          }}
          className="w-full sm:w-auto whitespace-nowrap"
        >
          <FaPlus className="mr-2" />
          Add Curriculum
        </Button>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="relative w-full md:w-64">
          <TextInput
            id="search-curriculum"
            type="text"
            placeholder="Search curriculum..."
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
      </div>

      <Card className={`overflow-x-auto transition-opacity ${isPending ? "opacity-60" : "opacity-100"}`}>
        <Table hoverable>
          <TableHead>
            <TableRow>
              <TableHeadCell onClick={() => handleSorting("curriculum_version")}>
                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Curriculum Version
                  {sortBy === "curriculum_version" &&
                    (sortDir === "ASC" ? <FaSortUp className="ml-1" /> : <FaSortDown className="ml-1" />)}
                </div>
              </TableHeadCell>
              <TableHeadCell onClick={() => handleSorting("created_at")}>
                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Created At
                  {sortBy === "created_at" &&
                    (sortDir === "ASC" ? <FaSortUp className="ml-1" /> : <FaSortDown className="ml-1" />)}
                </div>
              </TableHeadCell>
              <TableHeadCell className="w-16">
                <span className="sr-only">Details</span>
              </TableHeadCell>
            </TableRow>
          </TableHead>
          <TableBody className="divide-y">
            {paginatedCurricula.length > 0 ? (
              paginatedCurricula.map((item) => (
                <TableRow
                  key={item.curriculum_id}
                  className="cursor-pointer bg-white dark:border-gray-700 dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                  onMouseEnter={() => router.prefetch(`/subjects/${encodeURIComponent(item.curriculum_version)}`)}
                  onClick={() => navigateToDetail(item.curriculum_version)}
                >
                  <TableCell className="font-bold text-gray-900 dark:text-white">
                    {item.curriculum_version}
                  </TableCell>
                  <TableCell className="text-gray-600 dark:text-gray-300">
                    {item.created_at
                      ? new Date(item.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      type="button"
                      className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateToDetail(item.curriculum_version);
                      }}
                    >
                      <HiChevronRight className="h-6 w-6" />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            ) : isLoading ? (
              <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                <TableCell colSpan={3} className="py-6 text-center text-sm italic text-gray-500 dark:text-gray-400">
                  <div className="flex items-center justify-center">
                    <Spinner />
                    <span className="ml-4">Loading curricula...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                <TableCell colSpan={3} className="py-6 text-center text-sm italic text-gray-500 dark:text-gray-400">
                  No curriculum versions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="mt-4 flex w-full justify-center">
        <Pagination
          layout="pagination"
          currentPage={currentPage}
          totalPages={Math.ceil(curriculaList.length / maxRow) || 1}
          onPageChange={(p) => setCurrentPage(p)}
          showIcons
        />
      </div>

      <Modal show={openAddCurriculumModal} onClose={handleCloseModals} size="md">
        <ModalHeader>Add New Curriculum</ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="curriculum_version">Curriculum Version *</Label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {(formData.curriculum_version || "").length}/12
                                </span>
              </div>
              <TextInput
                id="curriculum_version"
                type="text"
                placeholder="e.g. BSIT-22-01"
                value={formData.curriculum_version || ""}
                onChange={handleVersionChange}
                color={versionError ? "failure" : "gray"}
                maxLength={12}
              />
              {versionError ? (
                <HelperText className="mt-1 text-red-600 dark:text-red-500">{versionError}</HelperText>
              ) : (
                <HelperText className="mt-1 text-gray-500 dark:text-gray-400">
                  Format: <b className="font-mono">BSIT-22-01</b> (Allowed: <b className="font-mono">A-Z, 0-9, -</b>)
                </HelperText>
              )}
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button onClick={() => setOpenAddConfirmation(true)} disabled={isFormInvalid || isPending}>
            Create Curriculum
          </Button>
          <Button color="alternative" onClick={handleCloseModals}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      <Modal show={openAddConfirmation} onClose={() => setOpenAddConfirmation(false)} size="md">
        <ModalHeader>Confirm Curriculum Details</ModalHeader>
        <ModalBody className="dark:text-white">
          Are you sure you want to create this curriculum version?
          <div className="my-3 flex flex-col gap-2">
            <div>
              <Label className="text-gray-400">Curriculum Version</Label>
              <div className="font-bold font-mono text-blue-600">{formData.curriculum_version}</div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button onClick={handleCreateCurriculum} disabled={isFormInvalid || isPending}>
            Confirm
          </Button>
          <Button color="alternative" onClick={() => setOpenAddConfirmation(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}