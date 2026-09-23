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
  Select,
  Label,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Pagination,
  Spinner,
  Toast,
  ToastToggle,
  Progress,
  Badge,
  Tooltip,
} from "flowbite-react";
import { HiSearch, HiX, HiCheck, HiExclamation, HiPencil } from "react-icons/hi";
import { FaSortUp, FaSortDown, FaSync } from "react-icons/fa";
import { MdFolderCopy } from "react-icons/md";
import { IoMdDocument } from "react-icons/io";
import { useMsal } from "@azure/msal-react";

// Import fetch functions, types, and SyncSubjectAQInput from system
import {
  fetchMaq,
  fetchMaqClustersWithEntries,
  fetchSubjectsAQClusters,
  fetchSubjectsAQClustersCount,
  fetchPrograms,
  syncSubjectAQ,
  SubjectAQClusterRecord,
  MaqRecord,
  MaqClusterWithEntriesRecord,
  MaqClusterEntryItem,
  SyncSubjectAQInput,
} from "@/app/actions/system";

interface ProgramRecord {
  program_code: string;
  program_name: string;
}

interface SuggestionItem {
  name: string;
  type: "maq" | "cluster";
  entries: MaqClusterEntryItem[];
}

export default function SubjectAqManagement() {
  // --- MSAL Auth State for Actor ---
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];

  // --- Data State ---
  const [subjectAqs, setSubjectAqs] = useState<SubjectAQClusterRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();

  // --- AQ Master Suggestions Options ---
  const [aqOptions, setAqOptions] = useState<SuggestionItem[]>([]);

  // --- Program Filter State ---
  const [selectedProgramFilter, setSelectedProgramFilter] = useState<string>("ALL");
  const [allProgramsFilterList, setAllProgramsFilterList] = useState<ProgramRecord[]>([]);

  // --- Search & Pagination State ---
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [maxRow] = useState<number>(10);
  const [sortBy, setSortBy] = useState<string>("course_name");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("ASC");
  const [totalCount, setTotalCount] = useState<number>(0);

  // --- Modal States ---
  const [openSyncModal, setOpenSyncModal] = useState<boolean>(false);

  // --- Target Record / Form State for Sync & Badge Input ---
  const [selectedCourseName, setSelectedCourseName] = useState<string>("");
  const [selectedProgramCode, setSelectedProgramCode] = useState<string>("");
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [aqSearchInput, setAqSearchInput] = useState<string>("");
  const [showAqDropdown, setShowAqDropdown] = useState<boolean>(false);

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

  // Load Table Data and Recommendations
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setSubjectAqs([]);

    const programParam = selectedProgramFilter === "ALL" ? null : selectedProgramFilter;

    const [resData, countRes, progRes] = await Promise.all([
      fetchSubjectsAQClusters(debouncedSearch, programParam, sortBy, sortDir, maxRow, currentPage),
      fetchSubjectsAQClustersCount(debouncedSearch, programParam),
      fetchPrograms ? fetchPrograms() : Promise.resolve({ success: false, data: [] }),
    ]);

    if (resData.success && resData.data) {
      setSubjectAqs(resData.data);
    } else {
      triggerToast(resData.error || "Failed to load subjects with AQ and clusters.", "error");
    }

    if (countRes.success) {
      setTotalCount(countRes.count);
    }

    if (progRes.success && progRes.data) {
      setAllProgramsFilterList(progRes.data);
    }

    setIsLoading(false);
  }, [debouncedSearch, selectedProgramFilter, sortBy, sortDir, maxRow, currentPage, triggerToast]);

  // Load suggestions separately for modal dropdown
  const loadAqSuggestions = useCallback(async (queryFilter: string | null) => {
    const [aqRes, clusterRes] = await Promise.all([
      fetchMaq(queryFilter, "aq", "ASC", 0, 10),
      fetchMaqClustersWithEntries(queryFilter, "cluster_name", "ASC", 10, 1),
    ]);

    const combinedSuggestions: SuggestionItem[] = [];
    const addedNames = new Set<string>();

    if (clusterRes.success && clusterRes.data) {
      clusterRes.data.forEach((cluster: MaqClusterWithEntriesRecord) => {
        if (cluster.cluster_name && !addedNames.has(cluster.cluster_name)) {
          addedNames.add(cluster.cluster_name);
          combinedSuggestions.push({
            name: cluster.cluster_name,
            type: "cluster",
            entries: cluster.entries || [],
          });
        }
      });
    }

    if (aqRes.success && aqRes.data) {
      aqRes.data.forEach((item: MaqRecord) => {
        if (item.aq && !addedNames.has(item.aq)) {
          addedNames.add(item.aq);
          combinedSuggestions.push({
            name: item.aq,
            type: "maq",
            entries: [],
          });
        }
      });
    }

    setAqOptions(combinedSuggestions);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Handle suggestion lookups when typing inside the modal input
  useEffect(() => {
    if (openSyncModal) {
      const handler = setTimeout(() => {
        void loadAqSuggestions(aqSearchInput.trim() || null);
      }, 250);
      return () => clearTimeout(handler);
    }
  }, [aqSearchInput, openSyncModal, loadAqSuggestions]);

  // Sorting
  const handleSorting = (column: string) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === "ASC" ? "DESC" : "ASC"));
    } else {
      setSortBy(column);
      setSortDir("ASC");
    }
  };

  const handleCloseModal = () => {
    setOpenSyncModal(false);
    setSelectedCourseName("");
    setSelectedProgramCode("");
    setSelectedEntries([]);
    setAqSearchInput("");
    setShowAqDropdown(false);
  };

  const handleOpenSync = (record: SubjectAQClusterRecord) => {
    setSelectedCourseName(record.course_name);
    setSelectedProgramCode(record.program_code);
    setSelectedEntries(record.aq_list || []);
    setAqSearchInput("");
    setShowAqDropdown(false);
    setOpenSyncModal(true);
    void loadAqSuggestions(null);
  };

  // Filter AQ options for dropdown based on input and existing selections
  const trimmedAqInput = aqSearchInput.trim();
  const filteredAqOptions = aqOptions.filter(
    (opt) => opt.name.toLowerCase().includes(trimmedAqInput.toLowerCase())
  );

  const clusterOptions = filteredAqOptions.filter((opt) => opt.type === "cluster");
  const maqOptionsList = filteredAqOptions.filter(
    (opt) => opt.type === "maq" && !selectedEntries.includes(opt.name)
  );

  const handleAqInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAqSearchInput(val);
    setShowAqDropdown(val.trim().length > 0);
  };

  const handleSelectMaq = (name: string) => {
    if (!selectedEntries.includes(name)) {
      setSelectedEntries((prev) => [...prev, name]);
    }
    setAqSearchInput("");
    setShowAqDropdown(false);
  };

  const handleSelectCluster = (clusterItem: SuggestionItem) => {
    const clusterEntries = clusterItem.entries || [];
    const newAqNames: string[] = [];

    clusterEntries.forEach((entry: MaqClusterEntryItem) => {
      const aqLabel = typeof entry === "string" ? entry : entry.aq;
      if (aqLabel && !newAqNames.includes(aqLabel)) {
        newAqNames.push(aqLabel);
      }
    });

    setSelectedEntries((prev) => {
      const combined = [...prev];
      newAqNames.forEach((name) => {
        if (!combined.includes(name)) {
          combined.push(name);
        }
      });
      return combined;
    });

    setAqSearchInput("");
    setShowAqDropdown(false);
  };

  const handleRemoveAq = (aqToRemove: string) => {
    setSelectedEntries((prev) => prev.filter((item) => item !== aqToRemove));
  };

  const handleSyncSubmit = async () => {
    if (!selectedCourseName.trim() || !selectedProgramCode.trim()) return;

    startTransition(async () => {
      const actorEmail = activeAccount?.username || activeAccount?.name || "system_user";

      const payload: SyncSubjectAQInput = {
        courseName: selectedCourseName,
        programCode: selectedProgramCode,
        aqs: selectedEntries,
      };

      const res = await syncSubjectAQ(actorEmail, payload);

      if (res.success) {
        triggerToast("Subject Academic Qualifications successfully synced!", "success");
        handleCloseModal();
        void loadData();
      } else {
        triggerToast(res.error || "Failed to sync subject Academic Qualifications.", "error");
      }
    });
  };

  const totalPages = Math.ceil(totalCount / maxRow) || 1;

  return (
    <div className="space-y-4 p-4">
      {/* Page Header & Filters Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Subject Academic Qualification Management
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage and sync course academic qualifications (AQ) configuration entries.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Program Filter Dropdown */}
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
                <option
                  key={`filter-${prog.program_code}`}
                  value={prog.program_code}
                >
                  {prog.program_code} - {prog.program_name}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-full sm:w-64">
            <TextInput
              id="search-subject-aq"
              type="text"
              placeholder="Search course names..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={HiSearch}
            />
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm dark:border-gray-700">
        <Table hoverable>
          <TableHead>
            <TableRow>
              <TableHeadCell
                className="cursor-pointer select-none text-blue-500"
                onClick={() => handleSorting("course_name")}
              >
                <div className="flex items-center gap-1">
                  <span>Course Name</span>
                  {sortBy === "course_name" &&
                    (sortDir === "ASC" ? (
                      <FaSortUp className="h-4 w-4" />
                    ) : (
                      <FaSortDown className="h-4 w-4" />
                    ))}
                </div>
              </TableHeadCell>
              <TableHeadCell
                className="cursor-pointer select-none text-blue-500"
                onClick={() => handleSorting("program_code")}
              >
                <div className="flex items-center gap-1">
                  <span>Program</span>
                  {sortBy === "program_code" &&
                    (sortDir === "ASC" ? (
                      <FaSortUp className="h-4 w-4" />
                    ) : (
                      <FaSortDown className="h-4 w-4" />
                    ))}
                </div>
              </TableHeadCell>
              <TableHeadCell>Academic Qualification Entries</TableHeadCell>
              <TableHeadCell className="text-center">Actions</TableHeadCell>
            </TableRow>
          </TableHead>

          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Fetching Subject Academic Qualifications...
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : subjectAqs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  {searchTerm || selectedProgramFilter !== "ALL"
                    ? `No matching subject Academic Qualification records found.`
                    : "No subject Academic Qualification entries found."}
                </TableCell>
              </TableRow>
            ) : (
              subjectAqs.map((item, index) => {
                const entriesList = item.aq_list || [];

                return (
                  <TableRow
                    key={`subject-aq-${index}`}
                    className="bg-white dark:border-gray-700 dark:bg-gray-800"
                  >
                    <TableCell className="font-medium text-gray-900 dark:text-white">
                      {item.course_name}
                    </TableCell>
                    <TableCell className="text-gray-700 dark:text-gray-300">
                      <Badge color="gray" size="sm" className="inline-block w-fit">
                        {item.program_code}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate">
                      {entriesList.length > 0 ? (
                        <div className="max-w-[320px] truncate">
                          {item.cluster_names &&
                          item.cluster_names.length > 0 ? (
                            <Tooltip
                              className={"dark:bg-gray-800 dark:text-white"}
                              content={item.aq_list.map((entry) => {
                                const aqLabel =
                                  typeof entry === "string" ? entry : entry;
                                return (
                                  <div key={item.cluster_names + " " + aqLabel}>
                                    {aqLabel}
                                  </div>
                                );
                              })}
                              style="light"
                            >
                              {item.cluster_names.join(", ")} [
                              {item.aq_list.length.toString()}]
                            </Tooltip>
                          ) : (
                            item.aq_list.map((entry, i) => {
                              const aqLabel =
                                typeof entry === "string"
                                  ? entry
                                  : String(entry);
                              return (
                                <React.Fragment key={i}>
                                  {aqLabel}
                                  {i < entriesList.length - 1 ? ", " : ""}
                                </React.Fragment>
                              );
                            })
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          No entries
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="xs"
                        color="alternative"
                        onClick={() => handleOpenSync(item)}
                        className="inline-flex items-center"
                      >
                        <HiPencil className="mr-1.5 h-3 w-3" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
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

      {/* --- MODAL: SYNC SUBJECT AQ (Structured Section Dropdown Layout) --- */}
      {openSyncModal && (
        <Modal show={openSyncModal} onClose={handleCloseModal} size="md">
          <ModalHeader>Sync Academic Qualification Entries</ModalHeader>
          <ModalBody className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-xs font-semibold text-gray-500 uppercase dark:text-gray-400 mb-1">
                  Course Name
                </span>
                <p className="text-base font-medium text-gray-900 dark:text-white">
                  {selectedCourseName}
                </p>
              </div>
              <div>
                <span className="block text-xs font-semibold text-gray-500 uppercase dark:text-gray-400 mb-1">
                  Program Code
                </span>
                <p className="text-base font-medium text-gray-900 dark:text-white">
                  {selectedProgramCode}
                </p>
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label>Academic Qualifications (AQ)</Label>
              </div>

              {/* AQ Suggestion Input */}
              <div className="relative mb-2">
                <TextInput
                  placeholder="Type to search qualification or cluster..."
                  value={aqSearchInput}
                  onChange={handleAqInputChange}
                  onFocus={() => {
                    if (aqSearchInput.trim().length > 0) {
                      setShowAqDropdown(true);
                    }
                  }}
                  color="gray"
                />

                {/* Structured Dropdown Menu */}
                {showAqDropdown && trimmedAqInput.length > 0 && (
                  <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    {filteredAqOptions.length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-400 dark:text-gray-500">
                        No qualifications or clusters found.
                      </div>
                    ) : (
                      <>
                        {/* Clusters Section */}
                        {clusterOptions.length > 0 && (
                          <div>
                            <div className="bg-gray-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:bg-gray-700 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                              Clusters
                            </div>
                            {clusterOptions.map((opt) => {
                              const subEntries = opt.entries || [];
                              const subEntriesLabels = subEntries
                                .map((entry: MaqClusterEntryItem) =>
                                  typeof entry === "string" ? entry : entry.aq
                                )
                                .filter(Boolean);

                              return (
                                <div
                                  key={opt.name}
                                  className="border-b border-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-750 dark:hover:text-black cursor-pointer"
                                  onClick={() => handleSelectCluster(opt)}
                                >
                                  <div className="flex items-center gap-2 font-medium">
                                    <MdFolderCopy className="h-4 w-4 shrink-0 text-blue-500" />
                                    <span>{opt.name}</span>
                                  </div>
                                  {subEntriesLabels.length > 0 && (
                                    <div className="ml-6 mt-1 text-xs text-gray-400 dark:text-gray-500 dark:hover:text-black flex items-center gap-1">
                                      <span>└</span>
                                      <span className="truncate">
                                        {subEntriesLabels.join(", ")}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Individual Qualifications Section */}
                        {maqOptionsList.length > 0 && (
                          <div>
                            <div className="bg-gray-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:bg-gray-700 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                              Individual Qualifications
                            </div>
                            {maqOptionsList.map((opt) => (
                              <div
                                key={opt.name}
                                className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-750 dark:hover:text-black cursor-pointer last:border-none"
                                onClick={() => handleSelectMaq(opt.name)}
                              >
                                <IoMdDocument className="h-4 w-4 shrink-0 text-gray-400" />
                                <span className="truncate">{opt.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Selected AQ Badges List */}
              <div className="flex min-h-[42px] flex-wrap gap-1.5 rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                {selectedEntries.length === 0 ? (
                  <span className="self-center text-xs text-gray-400 dark:text-gray-500">
                    Type above to search and add academic qualifications...
                  </span>
                ) : (
                  selectedEntries.map((aqName) => {
                    return (
                      <Badge key={aqName} color="blue" size="sm">
                        <span className="inline-flex items-center gap-1.5">
                          <IoMdDocument className="h-3.5 w-3.5 shrink-0" />
                          <span>{aqName}</span>
                          <HiX
                            className="h-3.5 w-3.5 shrink-0 cursor-pointer hover:text-red-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveAq(aqName);
                            }}
                          />
                        </span>
                      </Badge>
                    );
                  })
                )}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              onClick={handleSyncSubmit}
              disabled={!selectedCourseName.trim() || !selectedProgramCode.trim() || isPending}
            >
              {isPending ? (
                <Spinner size="sm" className="mr-2" />
              ) : (
                <FaSync className="mr-2 h-3 w-3" />
              )}
              Save & Sync Qualifications
            </Button>
            <Button color="alternative" onClick={handleCloseModal}>
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