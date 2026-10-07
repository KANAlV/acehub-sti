"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useTransition,
} from "react";
import {
  Table,
  TableHead,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  Button,
  TextInput,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Pagination,
  Spinner,
  Toast,
  ToastToggle,
  Progress,
  Tooltip,
} from "flowbite-react";
import { HiSearch, HiX, HiCheck, HiExclamation, HiPlus } from "react-icons/hi";
import { FaSortUp, FaSortDown } from "react-icons/fa";
import { useMsal } from "@azure/msal-react";
import { useRouter } from "next/navigation";

// Import fetch, create actions and types from system actions
import {
  fetchPreassignmentTemplates,
  fetchPreassignmentTemplatesCount,
  createPreassignmentTemplate,
  PreassignmentTemplateRecord,
} from "@/app/actions/system";
import { HiChevronRight } from "react-icons/hi2";

export default function PreassignmentTemplatesManagement() {
  const router = useRouter();

  // --- MSAL Auth State for Actor/Logging if needed ---
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];

  // --- Data State ---
  const [templates, setTemplates] = useState<PreassignmentTemplateRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();

  // --- Search & Pagination State ---
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [maxRow] = useState<number>(10);
  const [sortBy, setSortBy] = useState<string>("preassignment_name");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("ASC");
  const [totalCount, setTotalCount] = useState<number>(0);

  // --- Modal States ---
  const [openCreateModal, setOpenCreateModal] = useState<boolean>(false);
  const [newTemplateNameInput, setNewTemplateNameInput] = useState<string>("");

  // --- Toast State & Timer Ref ---
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
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Load Table Data and Count
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setTemplates([]);

    const [resData, countRes] = await Promise.all([
      fetchPreassignmentTemplates(
        debouncedSearch,
        sortBy,
        sortDir,
        maxRow,
        currentPage,
      ),
      fetchPreassignmentTemplatesCount(debouncedSearch),
    ]);

    if (resData.success && resData.data) {
      setTemplates(resData.data);
    } else {
      triggerToast(
        resData.error || "Failed to load pre-assignment templates.",
        "error",
      );
    }

    if (countRes.success) {
      setTotalCount(countRes.count);
    }

    setIsLoading(false);
  }, [debouncedSearch, sortBy, sortDir, maxRow, currentPage, triggerToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Sorting Handler
  const handleSorting = (column: string) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === "ASC" ? "DESC" : "ASC"));
    } else {
      setSortBy(column);
      setSortDir("ASC");
    }
  };

  // Create Submission Handler & Redirect
  const handleCreateSubmit = async () => {
    const trimmedName = newTemplateNameInput.trim();
    if (!trimmedName) return;

    startTransition(async () => {
      const res = await createPreassignmentTemplate(trimmedName);

      if (res.success) {
        setOpenCreateModal(false);
        setNewTemplateNameInput("");
        // Redirect 1 layer deep to /template_name
        router.push(`/teacher_assignment/${encodeURIComponent(trimmedName)}`);
      } else {
        triggerToast(
          res.error || "Failed to create pre-assignment template.",
          "error",
        );
      }
    });
  };

  const totalPages = Math.ceil(totalCount / maxRow) || 1;

  return (
    <div className="space-y-4 p-4">
      {/* Page Header & Actions Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Pre-assignment Templates Management
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage and organize pre-assignment templates configuration records.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="w-full sm:w-64">
            <TextInput
              id="search-templates"
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={HiSearch}
            />
          </div>

          <Button onClick={() => setOpenCreateModal(true)}>
            <HiPlus className="mr-2 h-4 w-4" />
            Add Template
          </Button>
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm dark:border-gray-700">
        <Table hoverable>
          <TableHead>
            <TableRow>
              <TableHeadCell
                className="cursor-pointer text-blue-500 select-none"
                onClick={() => handleSorting("preassignment_name")}
              >
                <div className="flex items-center gap-1">
                  <span>Pre-assignment Template Name</span>
                  {sortBy === "preassignment_name" &&
                    (sortDir === "ASC" ? (
                      <FaSortUp className="h-4 w-4" />
                    ) : (
                      <FaSortDown className="h-4 w-4" />
                    ))}
                </div>
              </TableHeadCell>
              <TableHeadCell
                className="cursor-pointer text-blue-500 select-none"
                onClick={() => handleSorting("date_added")}
              >
                <div className="flex items-center gap-1">
                  <span>Date Added</span>
                  {sortBy === "date_added" &&
                    (sortDir === "ASC" ? (
                      <FaSortUp className="h-4 w-4" />
                    ) : (
                      <FaSortDown className="h-4 w-4" />
                    ))}
                </div>
              </TableHeadCell>
              <TableHeadCell />
            </TableRow>
          </TableHead>

          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Fetching Pre-assignment Templates...
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  {searchTerm
                    ? `No matching pre-assignment templates found.`
                    : "No pre-assignment template entries found."}
                </TableCell>
              </TableRow>
            ) : (
              templates.map((item, index) => (
                <TableRow
                  key={`template-${index}`}
                  onClick={() =>
                    router.push(
                      `/teacher_assignment/${encodeURIComponent(item.preassignment_name.trim())}`,
                    )
                  }
                  className="cursor-pointer bg-white dark:border-gray-700 dark:bg-gray-800"
                >
                  <TableCell className="font-medium text-gray-900 dark:text-white">
                    <Tooltip content={"Click to Open Subject Assignment"}>
                      {item.preassignment_name}
                    </Tooltip>
                  </TableCell>
                  <TableCell className="font-medium text-gray-900 dark:text-white">
                    <Tooltip content={"Click to Open Subject Assignment"}>
                      {item.date_added.toString()}
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip content={"Click to Open Subject Assignment"}>
                      <HiChevronRight
                        className={"font-extrabold text-black dark:text-white"}
                      />
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      {!isLoading && totalPages > 0 && (
        <div className="flex w-full justify-center">
          <Pagination
            layout="pagination"
            currentPage={currentPage || 1}
            totalPages={totalPages}
            onPageChange={(p) => setCurrentPage(p)}
            showIcons
          />
        </div>
      )}

      {/* --- CREATE MODAL --- */}
      {openCreateModal && (
        <Modal
          show={openCreateModal}
          onClose={() => setOpenCreateModal(false)}
          size="md"
        >
          <ModalHeader>Create Pre-assignment Template</ModalHeader>
          <ModalBody className="space-y-4">
            <div>
              <span className="mb-1 block text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">
                Template Name
              </span>
              <TextInput
                placeholder="Enter preassignment template name..."
                value={newTemplateNameInput}
                onChange={(e) => setNewTemplateNameInput(e.target.value)}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              onClick={handleCreateSubmit}
              disabled={!newTemplateNameInput.trim() || isPending}
            >
              {isPending && <Spinner size="sm" className="mr-2" />}
              Save Template
            </Button>
            <Button
              color="alternative"
              onClick={() => {
                setOpenCreateModal(false);
                setNewTemplateNameInput("");
              }}
            >
              Cancel
            </Button>
          </ModalFooter>
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
          <Progress
            progress={Math.min(Math.round(progress), 100)}
            size="sm"
            className={`${showToastTimer ? "" : "hidden"} ease-linear`}
          />
        </div>
      )}
    </div>
  );
}
