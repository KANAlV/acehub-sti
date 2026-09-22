"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TextInput,
  Pagination,
  Spinner,
  Toast,
  ToastToggle,
  Progress,
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Label,
} from "flowbite-react";
import {
  HiSearch,
  HiChevronUp,
  HiChevronDown,
  HiCheck,
  HiExclamation,
  HiX,
  HiPlus,
  HiTrash,
} from "react-icons/hi";
import {
  fetchMaq,
  fetchMaqCount,
  createMaq,
  deleteMaq,
  MaqRecord,
} from "@/app/actions/system";
import {
  filterAlphanumericDashUnderscoreComma,
  filterAlphaUnderscore,
} from "@/utils/validation";
import { useMsal } from "@azure/msal-react";

export default function MatrixOfAcademicQualificationPage() {
  // --- MSAL Auth State for Actor ---
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];
  const actor = activeAccount?.username || "system";

  const [maqs, setMaqs] = useState<MaqRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Search, Sorting, and Pagination State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("aq");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("ASC");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const pageSize = 10;

  // Modal States
  const [openAddModal, setOpenAddModal] = useState<boolean>(false);
  const [openDeleteModal, setOpenDeleteModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form States
  const [selectedAq, setSelectedAq] = useState<string>("");
  const [aqInput, setAqInput] = useState<string>("");

  // Form Validation Error
  const [aqError, setAqError] = useState<string>("");

  // Toast & Timer State
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [toastType, setToastType] = useState<"success" | "warning" | "error">(
    "success",
  );
  const [progress, setProgress] = useState<number>(100);
  const [showToastTimer, setShowToastTimer] = useState<boolean>(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const closeToast = useCallback(() => {
    setShowToast(false);
    setProgress(100);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const triggerToast = useCallback(
    (
      msg: string,
      type: "success" | "warning" | "error" = "success",
      durationMs: number = 4000,
    ) => {
      closeToast();
      setToastMessage(msg);
      setToastType(type);
      setShowToast(true);

      // Disable auto-dismiss timer on error
      if (type === "error") {
        setShowToastTimer(false);
        return;
      }

      setShowToastTimer(true);
      setProgress(100);

      const intervalMs = 50;
      const step = (intervalMs / durationMs) * 100;

      timerRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev <= step) {
            closeToast();
            return 0;
          }
          return prev - step;
        });
      }, intervalMs);
    },
    [closeToast],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Handle Sort Toggle
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === "ASC" ? "DESC" : "ASC"));
    } else {
      setSortBy(column);
      setSortDir("ASC");
    }
  };

  // Load MAQ Data
  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const [dataRes, countRes] = await Promise.all([
      fetchMaq(debouncedSearch, sortBy, sortDir, pageSize, currentPage),
      fetchMaqCount(debouncedSearch),
    ]);

    if (dataRes.success && dataRes.data) {
      setMaqs(dataRes.data);
    } else {
      const err = dataRes.error || "Failed to load academic qualifications.";
      setErrorMessage(err);
      triggerToast(err, "error");
    }

    if (countRes.success) {
      setTotalCount(countRes.count);
    }

    setLoading(false);
  }, [debouncedSearch, sortBy, sortDir, currentPage, triggerToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setAqInput("");
    setAqError("");
    setOpenAddModal(true);
  };

  // Open Delete Modal
  const handleOpenDelete = (aq: string) => {
    setSelectedAq(aq);
    setOpenDeleteModal(true);
  };

  // Submit Add MAQ
  const handleCreate = async () => {
    if (!aqInput.trim()) {
      setAqError("Academic Qualification name is required.");
      return;
    }

    setIsSubmitting(true);

    const res = await createMaq(actor, aqInput.trim());

    // Always close modal on completion so the user can see the toast
    setOpenAddModal(false);

    if (res.success) {
      triggerToast("Academic Qualification created successfully!", "success");
      void loadData();
    } else {
      triggerToast(res.error || "Failed to create record.", "error");
    }
    setIsSubmitting(false);
  };

  // Submit Delete MAQ
  const handleDelete = async () => {
    setIsSubmitting(true);

    const res = await deleteMaq(actor, selectedAq);
    setIsSubmitting(false);

    // Always close modal on completion so the user can see the toast
    setOpenDeleteModal(false);

    if (res.success) {
      triggerToast("Academic Qualification deleted successfully!", "success");
      void loadData();
    } else {
      triggerToast(res.error || "Failed to delete record.", "error");
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-4 p-4">
      {/* Page Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Matrix of Academic Qualifications
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            View and manage Minimum Academic Qualification (MAQ) master records.
          </p>
        </div>

        {/* Search Bar & Add Button */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="w-full sm:w-64">
            <TextInput
              id="search_maq"
              type="text"
              icon={HiSearch}
              placeholder="Search qualification..."
              value={searchQuery}
              onChange={(e) =>
                setSearchQuery(
                  filterAlphanumericDashUnderscoreComma(e.target.value),
                )
              }
            />
          </div>
          <Button
            color="blue"
            onClick={handleOpenAdd}
            className="whitespace-nowrap"
          >
            <HiPlus className="mr-2 h-4 w-4" /> Add Qualification
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <p className="text-sm font-medium text-red-600 dark:text-red-500">
          {errorMessage}
        </p>
      )}

      {/* Table Section */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm dark:border-gray-700">
        <Table hoverable>
          <TableHead>
            <TableRow>
              <TableHeadCell
                className="cursor-pointer select-none"
                onClick={() => handleSort("aq")}
              >
                <div className="flex items-center gap-1">
                  <span>Academic Qualification (AQ)</span>
                  {sortBy === "aq" &&
                    (sortDir === "ASC" ? (
                      <HiChevronUp className="h-4 w-4" />
                    ) : (
                      <HiChevronDown className="h-4 w-4" />
                    ))}
                </div>
              </TableHeadCell>
              <TableHeadCell className="w-32 text-center">
                Actions
              </TableHeadCell>
            </TableRow>
          </TableHead>
          <TableBody className="divide-y">
            {loading ? (
              <TableRow>
                <TableCell colSpan={2} className="py-8 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Loading qualifications...
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : maqs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={2}
                  className="py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  No Academic Qualifications found.
                </TableCell>
              </TableRow>
            ) : (
              maqs.map((item) => (
                <TableRow
                  key={item.aq}
                  className="bg-white dark:border-gray-700 dark:bg-gray-800"
                >
                  <TableCell className="font-medium text-gray-900 dark:text-white">
                    {item.aq}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-2">
                      <Button
                        size="xs"
                        color="alternative"
                        onClick={() => handleOpenDelete(item.aq)}
                      >
                        <HiTrash className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      {!loading && totalCount > 0 && (
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Showing{" "}
            <span className="font-semibold text-gray-900 dark:text-white">
              {(currentPage - 1) * pageSize + 1}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-gray-900 dark:text-white">
              {Math.min(currentPage * pageSize, totalCount)}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-gray-900 dark:text-white">
              {totalCount}
            </span>{" "}
            entries
          </span>

          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(page) => setCurrentPage(page)}
              showIcons
            />
          )}
        </div>
      )}

      {/* ADD MODAL */}
      {openAddModal && (
        <Modal show={openAddModal} onClose={() => setOpenAddModal(false)}>
          <ModalHeader>Add New Academic Qualification</ModalHeader>
          <ModalBody className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label htmlFor="aq_name">Academic Qualification</Label>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {aqInput.length}/8
                </span>
              </div>
              <TextInput
                id="aq_name"
                placeholder="e.g. BSCS"
                value={aqInput}
                maxLength={8}
                onChange={(e) => {
                  const filtered = filterAlphaUnderscore(e.target.value).slice(
                    0,
                    8,
                  );
                  setAqInput(filtered);
                  setAqError("");
                }}
                color={aqError ? "failure" : "gray"}
              />
              {aqError && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-500">
                  {aqError}
                </p>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="blue" disabled={isSubmitting} onClick={handleCreate}>
              {isSubmitting ? (
                <Spinner size="sm" className="mr-2" />
              ) : (
                "Save Qualification"
              )}
            </Button>
            <Button color="alternative" onClick={() => setOpenAddModal(false)}>
              Cancel
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {openDeleteModal && (
        <Modal
          show={openDeleteModal}
          size="md"
          onClose={() => setOpenDeleteModal(false)}
          popup
        >
          <ModalHeader />
          <ModalBody>
            <div className="text-center">
              <HiExclamation className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
              <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
                Are you sure you want to delete qualification{" "}
                <strong className="text-gray-900 dark:text-white">
                  &#34;{selectedAq}&#34;
                </strong>
                ?
              </h3>
              <div className="flex justify-center gap-4">
                <Button
                  color="red"
                  disabled={isSubmitting}
                  onClick={handleDelete}
                >
                  {isSubmitting ? <Spinner size="sm" /> : "Yes, I'm sure"}
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
      )}

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
          {showToastTimer && (
            <Progress
              progress={Math.min(Math.round(progress), 100)}
              size="sm"
              className="ease-linear"
            />
          )}
        </div>
      )}
    </div>
  );
}