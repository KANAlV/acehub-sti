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
  Badge,
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
  HiPencil,
  HiTrash,
} from "react-icons/hi";
import {
  fetchMaqClustersWithEntries,
  fetchMaqClustersCount,
  createMaqCluster,
  syncMaqClusterEntries,
  deleteMaqCluster,
  fetchMaq,
  MaqClusterWithEntriesRecord,
  MaqRecord,
  MaqClusterEntryItem,
} from "@/app/actions/system";
import {
  filterAlphanumericDashUnderscoreComma,
  filterAlphaUnderscore,
} from "@/utils/validation";
import { useMsal } from "@azure/msal-react";

export default function MaqClusterPage() {
  // --- MSAL Auth State for Actor ---
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];
  const actor = activeAccount?.username || "system";

  const [clusters, setClusters] = useState<MaqClusterWithEntriesRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Search, Sorting, and Pagination State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("cluster_name");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("ASC");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const pageSize = 10;

  // AQ Master Suggestions Options
  const [aqOptions, setAqOptions] = useState<string[]>([]);

  // Modal States
  const [openAddModal, setOpenAddModal] = useState<boolean>(false);
  const [openEditModal, setOpenEditModal] = useState<boolean>(false);
  const [openDeleteModal, setOpenDeleteModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form States
  const [selectedClusterName, setSelectedClusterName] = useState<string>("");
  const [clusterNameInput, setClusterNameInput] = useState<string>("");
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [aqSearchInput, setAqSearchInput] = useState<string>("");
  const [showAqDropdown, setShowAqDropdown] = useState<boolean>(false);

  // Form Validation Errors
  const [nameError, setNameError] = useState<string>("");

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

  // Load Clusters Data & AQ Master Suggestions
  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const [dataRes, countRes, aqRes] = await Promise.all([
      fetchMaqClustersWithEntries(
        debouncedSearch,
        sortBy,
        sortDir,
        pageSize,
        currentPage,
      ),
      fetchMaqClustersCount(debouncedSearch),
      fetchMaq(null, "aq", "ASC", 0, 1),
    ]);

    if (dataRes.success && dataRes.data) {
      setClusters(dataRes.data);
    } else {
      const err = dataRes.error || "Failed to load clusters.";
      setErrorMessage(err);
      triggerToast(err, "error");
    }

    if (countRes.success) {
      setTotalCount(countRes.count);
    }

    if (aqRes.success && aqRes.data) {
      setAqOptions(aqRes.data.map((item: MaqRecord) => item.aq));
    }

    setLoading(false);
  }, [debouncedSearch, sortBy, sortDir, currentPage, triggerToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Filter AQ options for dropdown based on trimmed input and existing selections
  const trimmedAqInput = aqSearchInput.trim();

  const filteredAqOptions = aqOptions.filter(
    (opt) =>
      opt.toLowerCase().includes(trimmedAqInput.toLowerCase()) &&
      !selectedEntries.includes(opt),
  );

  // Validate AQ Search Input state whenever typing occurs
  const handleAqInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const filtered = filterAlphaUnderscore(e.target.value).slice(0, 8);
    setAqSearchInput(filtered);

    const trimmed = filtered.trim();
    if (trimmed.length > 0) {
      setShowAqDropdown(true);
    } else {
      setShowAqDropdown(false);
    }
  };

  // Add AQ item on option click
  const handleSelectAq = (aq: string) => {
    if (!selectedEntries.includes(aq)) {
      setSelectedEntries((prev) => [...prev, aq]);
    }
    setAqSearchInput("");
    setShowAqDropdown(false);
  };

  // Add Custom AQ item when no matches exist
  const handleAddCustomAq = () => {
    const trimmed = aqSearchInput.trim();
    if (trimmed && !selectedEntries.includes(trimmed)) {
      setSelectedEntries((prev) => [...prev, trimmed]);
    }
    setAqSearchInput("");
    setShowAqDropdown(false);
  };

  // Remove AQ item
  const handleRemoveAq = (aqToRemove: string) => {
    setSelectedEntries((prev) => prev.filter((item) => item !== aqToRemove));
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setClusterNameInput("");
    setSelectedEntries([]);
    setAqSearchInput("");
    setNameError("");
    setOpenAddModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (cluster: MaqClusterWithEntriesRecord) => {
    let rawEntries: (string | MaqClusterEntryItem)[] = [];
    if (Array.isArray(cluster.entries)) {
      rawEntries = cluster.entries;
    } else if (typeof cluster.entries === "string") {
      rawEntries = JSON.parse(cluster.entries);
    }

    const entriesList = rawEntries.map((e) =>
      typeof e === "string" ? e : e.aq,
    );

    setSelectedClusterName(cluster.cluster_name);
    setClusterNameInput(cluster.cluster_name);
    setSelectedEntries(entriesList);
    setAqSearchInput("");
    setNameError("");
    setOpenEditModal(true);
  };

  // Open Delete Modal
  const handleOpenDelete = (clusterName: string) => {
    setSelectedClusterName(clusterName);
    setOpenDeleteModal(true);
  };

  // Submit Add Cluster
  const handleCreate = async () => {
    if (!clusterNameInput.trim()) {
      setNameError("Cluster name is required.");
      return;
    }

    setIsSubmitting(true);

    const res = await createMaqCluster(actor, clusterNameInput.trim());

    if (res.success) {
      if (selectedEntries.length > 0) {
        await syncMaqClusterEntries(
          actor,
          clusterNameInput.trim(),
          selectedEntries,
        );
      }
      setOpenAddModal(false);
      triggerToast("MAQ Cluster created successfully!", "success");
      void loadData();
    } else {
      triggerToast(res.error || "Failed to create cluster.", "error");
    }
    setIsSubmitting(false);
  };

  // Submit Edit Cluster using syncMaqClusterEntries
  const handleUpdate = async () => {
    if (!clusterNameInput.trim()) {
      setNameError("Cluster name is required.");
      return;
    }

    setIsSubmitting(true);

    const res = await syncMaqClusterEntries(
      actor,
      clusterNameInput.trim(),
      selectedEntries,
    );
    setIsSubmitting(false);

    if (res.success) {
      setOpenEditModal(false);
      triggerToast("MAQ Cluster entries updated successfully!", "success");
      void loadData();
    } else {
      triggerToast(res.error || "Failed to update cluster entries.", "error");
    }
  };

  // Submit Delete Cluster
  const handleDelete = async () => {
    setIsSubmitting(true);

    const res = await deleteMaqCluster(actor, selectedClusterName);
    setIsSubmitting(false);

    if (res.success) {
      setOpenDeleteModal(false);
      triggerToast("MAQ Cluster deleted successfully!", "success");
      void loadData();
    } else {
      triggerToast(res.error || "Failed to delete cluster.", "error");
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-4 p-4">
      {/* Page Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            MAQ Clusters
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            View and manage Minimum Academic Qualification (MAQ) clusters.
          </p>
        </div>

        {/* Search Bar & Add Button */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="w-full sm:w-64">
            <TextInput
              id="search_clusters"
              type="text"
              icon={HiSearch}
              placeholder="Search cluster name..."
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
            <HiPlus className="mr-2 h-4 w-4" /> Add Cluster
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
                onClick={() => handleSort("cluster_name")}
              >
                <div className="flex items-center gap-1">
                  <span>Cluster Name</span>
                  {sortBy === "cluster_name" &&
                    (sortDir === "ASC" ? (
                      <HiChevronUp className="h-4 w-4" />
                    ) : (
                      <HiChevronDown className="h-4 w-4" />
                    ))}
                </div>
              </TableHeadCell>
              <TableHeadCell>Academic Qualifications</TableHeadCell>
              <TableHeadCell className="text-center">Actions</TableHeadCell>
            </TableRow>
          </TableHead>
          <TableBody className="divide-y">
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Loading clusters...
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : clusters.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  No MAQ clusters found.
                </TableCell>
              </TableRow>
            ) : (
              clusters.map((cluster) => {
                let entriesList: (string | MaqClusterEntryItem)[] = [];
                if (Array.isArray(cluster.entries)) {
                  entriesList = cluster.entries;
                } else if (typeof cluster.entries === "string") {
                  entriesList = JSON.parse(cluster.entries);
                }

                return (
                  <TableRow
                    key={cluster.cluster_name}
                    className="bg-white dark:border-gray-700 dark:bg-gray-800"
                  >
                    <TableCell className="font-medium text-gray-900 dark:text-white">
                      {cluster.cluster_name}
                    </TableCell>
                    <TableCell className="max-w-[320px]">
                      {entriesList.length > 0 ? (
                        <div className="relative">
                          <div className="max-h-20 overflow-y-auto pr-1">
                            <div className="flex flex-wrap gap-1.5">
                              {entriesList.map((entry, i) => {
                                const aqLabel =
                                  typeof entry === "string" ? entry : entry.aq;
                                return (
                                  <Badge key={i} color="alternative" size="sm">
                                    {aqLabel}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          No entries
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-2">
                        <Button
                          size="xs"
                          color="alternative"
                          onClick={() => handleOpenEdit(cluster)}
                        >
                          <HiPencil className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button
                          size="xs"
                          color="alternative"
                          onClick={() => handleOpenDelete(cluster.cluster_name)}
                        >
                          <HiTrash className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
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

      {/* ADD / EDIT MODAL */}
      {(openAddModal || openEditModal) && (
        <Modal
          show={openAddModal || openEditModal}
          onClose={() => {
            setOpenAddModal(false);
            setOpenEditModal(false);
          }}
        >
          <ModalHeader>
            {openAddModal ? "Add New MAQ Cluster" : "Edit MAQ Cluster"}
          </ModalHeader>
          <ModalBody className="space-y-4">
            {/* Cluster Name Field */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label htmlFor="cluster_name">Cluster Name</Label>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {clusterNameInput.length}/50
                </span>
              </div>
              <TextInput
                id="cluster_name"
                placeholder="e.g. Computer Science"
                value={clusterNameInput}
                disabled={openEditModal}
                maxLength={50}
                onChange={(e) => {
                  const filtered = filterAlphanumericDashUnderscoreComma(
                    e.target.value,
                  ).slice(0, 50);
                  setClusterNameInput(filtered);
                  setNameError("");
                }}
                color={nameError ? "failure" : "gray"}
              />
              {nameError && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-500">
                  {nameError}
                </p>
              )}
            </div>

            {/* Academic Qualifications Selection */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label>Academic Qualifications</Label>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {aqSearchInput.length}/8
                </span>
              </div>

              {/* AQ Suggestion Input (Placed on top) */}
              <div className="relative mb-2">
                <TextInput
                  placeholder="Type to search qualifications..."
                  value={aqSearchInput}
                  maxLength={8}
                  onChange={handleAqInputChange}
                  onFocus={() => {
                    if (aqSearchInput.trim().length > 0) {
                      setShowAqDropdown(true);
                    }
                  }}
                  color="gray"
                />

                {/* Dropdown Options */}
                {showAqDropdown && trimmedAqInput.length > 0 && (
                  <div className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    {filteredAqOptions.length > 0 ? (
                      filteredAqOptions.map((opt) => (
                        <div
                          key={opt}
                          className="cursor-pointer px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                          onClick={() => handleSelectAq(opt)}
                        >
                          {opt}
                        </div>
                      ))
                    ) : (
                      <div className="p-2">
                        <Button
                          size="xs"
                          color="blue"
                          className="w-full justify-center"
                          onClick={handleAddCustomAq}
                        >
                          <HiPlus className="mr-1.5 h-4 w-4" /> Add &#34;
                          {trimmedAqInput}&#34;
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Selected AQ Badges List (Placed below TextInput) */}
              <div className="flex min-h-[42px] flex-wrap gap-1.5 rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                {selectedEntries.length === 0 ? (
                  <span className="self-center text-xs text-gray-400 dark:text-gray-500">
                    Type above to search and add qualifications...
                  </span>
                ) : (
                  selectedEntries.map((aq) => (
                    <Badge key={aq} color="blue" size="sm">
                      <span className="inline-flex items-center gap-1.5">
                        <span>{aq}</span>
                        <HiX
                          className="h-3.5 w-3.5 shrink-0 cursor-pointer hover:text-red-500"
                          onClick={() => handleRemoveAq(aq)}
                        />
                      </span>
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              color="blue"
              disabled={isSubmitting}
              onClick={openAddModal ? handleCreate : handleUpdate}
            >
              {isSubmitting ? (
                <Spinner size="sm" className="mr-2" />
              ) : openAddModal ? (
                "Save Cluster"
              ) : (
                "Update Cluster"
              )}
            </Button>
            <Button
              color="alternative"
              onClick={() => {
                setOpenAddModal(false);
                setOpenEditModal(false);
              }}
            >
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
                Are you sure you want to delete cluster{" "}
                <strong className="text-gray-900 dark:text-white">
                  &#34;{selectedClusterName}&#34;
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