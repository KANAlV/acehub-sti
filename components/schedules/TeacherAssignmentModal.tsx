"use client";

import React, { useEffect, useState } from "react";
import { Modal, ModalBody, ModalHeader, Button } from "flowbite-react";
import { HiOutlineExclamationCircle } from "react-icons/hi";
import {
  fetchSubjectRequirementById,
  getTeachersWithAqAndFcce,
  fetchFacultyLoadConfig,
  Configuration,
} from "@/app/actions/system";
import { LocalTimetableEntry } from "@/components/schedules/ScheduleTimetable";

export interface TeacherRecord {
  teacher_id: string;
  pscs_id?: string;
  email?: string;
  full_name: string;
  teacher_code: string;
  department?: string;
  employment_type?: string;
  status?: string;
  aqs?: unknown;
  fcces?: unknown;
}

export interface SubjectRequirementRecord {
  subject_id: string;
  curriculum?: string;
  program_code?: string;
  course_code?: string;
  course_name?: string;
  lecture_units?: number;
  lab_units?: number;
  lab_type?: string;
  year_term?: string;
  required_aqs?: string[];
}

interface TeacherAssignmentModalProps {
  show: boolean;
  onClose: () => void;
  entry: LocalTimetableEntry | null;
  onAssignTeacher: (
    teacher: TeacherRecord,
    applyToAllSections: boolean,
  ) => void;
  changedSchedules: LocalTimetableEntry[];
}

export default function TeacherAssignmentModal({
  show,
  onClose,
  entry,
  onAssignTeacher,
  changedSchedules,
}: TeacherAssignmentModalProps) {
  const [subjectRequirement, setSubjectRequirement] =
    useState<SubjectRequirementRecord | null>(null);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState<string>("");
  const [teacherList, setTeacherList] = useState<TeacherRecord[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherRecord | null>(
    null,
  );
  const [isTeacherLoading, setIsTeacherLoading] = useState<boolean>(false);
  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false);
  const [overrideWarningMessage, setOverrideWarningMessage] =
    useState<string>("");
  const [applyToAllSections, setApplyToAllSections] = useState<boolean>(true);
  const [config, setConfig] = useState<Configuration | null>(null);

  // Load Configuration Data on mount
  useEffect(() => {
    async function loadConfigData() {
      const res = await fetchFacultyLoadConfig();
      if (res.success && res.data && res.data.length > 0) {
        setConfig(res.data[0]);
      }
    }
    void loadConfigData();
  }, []);

  // Fetch teachers list whenever search query changes (requires at least 2 characters)
  useEffect(() => {
    async function fetchTeachers() {
      if (!show) return;

      if (!teacherSearchQuery || teacherSearchQuery.trim().length < 2) {
        setTeacherList([]);
        setIsTeacherLoading(false);
        return;
      }

      setIsTeacherLoading(true);
      try {
        const res = await getTeachersWithAqAndFcce({
          search: teacherSearchQuery.trim(),
        });
        if (res.success && res.data) {
          setTeacherList(res.data as TeacherRecord[]);
        } else {
          setTeacherList([]);
        }
      } catch (err) {
        console.error("Error fetching teachers:", err);
        setTeacherList([]);
      } finally {
        setIsTeacherLoading(false);
      }
    }

    const timer = setTimeout(() => {
      void fetchTeachers();
    }, 300);

    return () => clearTimeout(timer);
  }, [teacherSearchQuery, show]);

  // Load subject requirements when modal opens for a subject
  useEffect(() => {
    async function loadSubjectReq() {
      if (!show || !entry?.subject_id) {
        setSubjectRequirement(null);
        setSelectedTeacher(null);
        setTeacherSearchQuery("");
        setApplyToAllSections(false);
        return;
      }
      const res = await fetchSubjectRequirementById(entry.subject_id);
      if (res.success && res.data) {
        setSubjectRequirement(res.data as SubjectRequirementRecord);
      } else {
        setSubjectRequirement(null);
      }
    }
    void loadSubjectReq();
  }, [show, entry]);

  // Helper to map employment type to config limits
  const getLimitsForTeacher = (employmentType?: string) => {
    const normalized = (employmentType || "full_time").toLowerCase();
    const facultyLoad = config?.faculty_load ?? {
      full_time: 21,
      part_time: 12,
      part_time_full_load: 18,
    };
    const prepLimits = config?.prep_limits ?? {
      full_time: 7,
      part_time: 4,
      part_time_full_load: 6,
    };

    if (
      normalized.includes("part-time full load") ||
      normalized.includes("part_time_full_load")
    ) {
      return {
        prepLimit: Number(prepLimits.part_time_full_load ?? 6),
        facultyLoadLimit: Number(facultyLoad.part_time_full_load ?? 18),
      };
    } else if (normalized.includes("part")) {
      return {
        prepLimit: Number(prepLimits.part_time ?? 4),
        facultyLoadLimit: Number(facultyLoad.part_time ?? 12),
      };
    } else {
      return {
        prepLimit: Number(prepLimits.full_time ?? 7),
        facultyLoadLimit: Number(facultyLoad.full_time ?? 21),
      };
    }
  };

  const { prepLimit, facultyLoadLimit } = getLimitsForTeacher(
    selectedTeacher?.employment_type,
  );

  const overloadMax = Number(config?.overload_max ?? 3);
  const absoluteMaxLoad = facultyLoadLimit + overloadMax;

  // Safe AQ matching check
  const requiredAqs = subjectRequirement?.required_aqs || [];
  const teacherAqs: string[] = Array.isArray(selectedTeacher?.aqs)
    ? (selectedTeacher?.aqs as Array<Record<string, unknown>>)
        .map((item) =>
          item && typeof item === "object" && "aq" in item
            ? String(item.aq ?? "")
            : "",
        )
        .filter(Boolean)
    : [];

  const hasAllAqsMatch =
    requiredAqs.length > 0 &&
    requiredAqs.every((req) =>
      teacherAqs.some((tAq) => tAq.toLowerCase() === req.toLowerCase()),
    );

  // Specific FCCE Course Name matching check
  const teacherFcces = Array.isArray(selectedTeacher?.fcces)
    ? (selectedTeacher?.fcces as Array<Record<string, unknown>>)
    : [];

  const courseNameToCheck = (
    subjectRequirement?.course_name ||
    entry?.course_name ||
    ""
  )
    .trim()
    .toLowerCase();

  const hasFcceRecord = teacherFcces.some((f) => {
    const fCourse = String(f.course_name ?? "")
      .trim()
      .toLowerCase();
    return fCourse === courseNameToCheck && f.pass === true;
  });

  const isFullyMatched = hasAllAqsMatch && hasFcceRecord;

  // Dynamic Calculation of Proj Load & Prep from local state
  const teacherEntries = selectedTeacher
    ? changedSchedules.filter(
        (e) =>
          e.teacher_id === selectedTeacher.teacher_id &&
          e.day &&
          e.start_time > 0,
      )
    : [];

  const existingLoad = teacherEntries.reduce((sum, item) => {
    const lec = Number(item.lecture_units || 0);
    const lab = Number(item.lab_units || 0);
    return sum + lec + lab;
  }, 0);

  // Determine the target subject ID or course code to match against
  const targetSubjectId = subjectRequirement?.subject_id || entry?.subject_id;
  const targetCourseCode =
    subjectRequirement?.course_code || entry?.course_code;

  // Find all blocks/entries in the timetable belonging to this subject
  const subjectEntriesInSchedule = changedSchedules.filter((e) => {
    if (targetSubjectId) {
      return e.subject_id === targetSubjectId;
    }
    return e.course_code === targetCourseCode;
  });

  // Determine sections to add based on the toggle state
  const targetEntriesToAdd = applyToAllSections
    ? subjectEntriesInSchedule
    : subjectEntriesInSchedule.filter((e) => e.section === entry?.section);

  // Avoid double-counting units if the selected teacher is ALREADY assigned to some of these blocks
  const unassignedTargetEntries = targetEntriesToAdd.filter(
    (e) => e.teacher_id !== selectedTeacher?.teacher_id,
  );

  const additionalUnits = unassignedTargetEntries.reduce((sum, item) => {
    const lec = Number(item.lecture_units || 0);
    const lab = Number(item.lab_units || 0);
    return sum + lec + lab;
  }, 0);

  // Fallback if no schedule entries exist yet for this subject in the palette
  const fallbackUnits =
    Number(subjectRequirement?.lecture_units || entry?.lecture_units || 0) +
    Number(subjectRequirement?.lab_units || entry?.lab_units || 0);

  const totalAddedUnits = additionalUnits > 0 ? additionalUnits : fallbackUnits;

  const projectedLoad = Number(existingLoad) + Number(totalAddedUnits);

  // Projected Preps Calculation
  const existingPreps = new Set(
    teacherEntries.map((e) => e.subject_id || e.course_code),
  );
  if (targetSubjectId) {
    existingPreps.add(targetSubjectId);
  } else if (targetCourseCode) {
    existingPreps.add(targetCourseCode);
  }
  const projectedPreps = existingPreps.size;

  const handleConfirmClick = () => {
    if (!selectedTeacher) return;

    // Check Hard Limit Violation first (Load exceeds absoluteMax)
    if (projectedLoad > absoluteMaxLoad) {
      setOverrideWarningMessage(
        `Hard Limit Violation: Projected load (${projectedLoad.toFixed(1)} units) exceeds the absolute maximum allowed limit (${absoluteMaxLoad} units). Assignment cannot proceed.`,
      );
      setShowOverrideModal(true);
      return;
    }

    const warningReasons: string[] = [];

    if (!isFullyMatched) {
      warningReasons.push(
        "missing required Academic Qualifications (AQ) or a valid passed FCCE record",
      );
    }
    if (projectedLoad > facultyLoadLimit) {
      warningReasons.push(
        `exceeds standard faculty load limit (${facultyLoadLimit} units)`,
      );
    }
    if (projectedPreps > prepLimit) {
      warningReasons.push(
        `exceeds standard preparation limit (${prepLimit} preps)`,
      );
    }

    if (warningReasons.length > 0) {
      setOverrideWarningMessage(
        `The selected instructor ${selectedTeacher.full_name} is ${warningReasons.join(" and ")}. Do you still wish to override and proceed?`,
      );
      setShowOverrideModal(true);
    } else {
      onAssignTeacher(selectedTeacher, applyToAllSections);
    }
  };

  return (
    <>
      <Modal show={show} onClose={onClose} size="xl" popup>
        <ModalHeader />
        <ModalBody>
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Assign Teacher to Subject Block
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Search and select an instructor based on workload constraints
                and qualifications.
              </p>
            </div>

            {/* Selected Subject Card */}
            {subjectRequirement && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-blue-950 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/80 dark:text-white">
                <div className="flex items-center justify-between text-[10px] font-bold tracking-wider text-blue-700 uppercase dark:text-blue-300">
                  <span>Selected Subject for Assignment</span>
                  <span className="rounded bg-blue-200 px-2 py-0.5 text-blue-900 dark:bg-blue-900/80 dark:text-blue-200">
                    {subjectRequirement.program_code}
                  </span>
                </div>
                <div className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                  {subjectRequirement.course_name}
                </div>
                <div className="mt-0.5 text-xs text-gray-600 dark:text-blue-200">
                  {subjectRequirement.course_code} •{" "}
                  {subjectRequirement.lecture_units} Lec /{" "}
                  {subjectRequirement.lab_units} Lab Units •{" "}
                  {subjectRequirement.year_term}
                </div>
              </div>
            )}

            {/* Search Teacher Input */}
            {!selectedTeacher && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Search Teacher
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={teacherSearchQuery}
                    onChange={(e) => setTeacherSearchQuery(e.target.value)}
                    placeholder="Type at least 2 characters (e.g., Jo)..."
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-xs text-gray-900 focus:border-cyan-500 focus:ring-cyan-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                {teacherSearchQuery.trim().length >= 2 && !selectedTeacher && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800">
                    {isTeacherLoading ? (
                      <div className="p-3 text-center text-xs text-gray-500">
                        Searching...
                      </div>
                    ) : teacherList.length > 0 ? (
                      teacherList.map((tch) => (
                        <div
                          key={tch.teacher_id}
                          onClick={() => {
                            setSelectedTeacher(tch);
                            setTeacherSearchQuery(tch.full_name);
                          }}
                          className="cursor-pointer px-3 py-2 text-xs hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
                        >
                          <div className="font-bold">{tch.full_name}</div>
                          <div className="text-[10px] text-gray-400">
                            {tch.department || "No Department"}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-center text-xs text-gray-400">
                        No teachers found
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Selected Teacher Card */}
            {selectedTeacher && (
              <div
                className={`rounded-xl border p-3.5 shadow-sm transition-all ${
                  isFullyMatched
                    ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-700/50 dark:bg-emerald-950/90 dark:text-white"
                    : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/90 dark:text-white"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-bold tracking-wider uppercase">
                  <span
                    className={
                      isFullyMatched
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-amber-700 dark:text-amber-300"
                    }
                  >
                    Selected Teacher for Assignment
                  </span>
                  <button
                    onClick={() => {
                      setSelectedTeacher(null);
                      setTeacherSearchQuery("");
                    }}
                    className="text-xs underline hover:opacity-80"
                  >
                    Change
                  </button>
                </div>
                <div className="mt-1 text-sm font-bold">
                  {selectedTeacher.full_name} ({selectedTeacher.teacher_code})
                </div>
                <div
                  className={`mt-0.5 text-xs opacity-90 ${
                    isFullyMatched
                      ? "text-emerald-800 dark:text-emerald-200"
                      : "text-amber-800 dark:text-amber-200"
                  }`}
                >
                  {selectedTeacher.department || "General"} •{" "}
                  {selectedTeacher.employment_type || "Full-time"}
                </div>
              </div>
            )}

            {/* Scope Toggle: Section vs Entire Subject */}
            {selectedTeacher && (
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  Assignment Scope:
                </span>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={applyToAllSections}
                    onChange={(e) => setApplyToAllSections(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="peer h-5 w-9 rounded-full bg-gray-300 peer-checked:bg-cyan-600 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-gray-600"></div>
                  <span className="ml-2 font-medium text-gray-700 dark:text-gray-200">
                    {applyToAllSections
                      ? "All Sections (Entire Subject)"
                      : "This Section Only"}
                  </span>
                </label>
              </div>
            )}

            {/* Dynamic Workload & Preparation Stats Widget */}
            {selectedTeacher && (
              <div className="flex items-center justify-around rounded-xl border border-gray-200 bg-white p-3 text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">
                <div className="text-center">
                  <div className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                    Proj. Prep
                  </div>
                  <div
                    className={`mt-0.5 text-base font-bold ${
                      projectedPreps > prepLimit
                        ? "text-red-600 dark:text-red-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {projectedPreps} / {prepLimit}
                  </div>
                </div>
                <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />
                <div className="text-center">
                  <div className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                    Proj. Load
                  </div>
                  <div
                    className={`mt-0.5 text-base font-bold ${
                      projectedLoad > facultyLoadLimit
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-cyan-600 dark:text-cyan-400"
                    }`}
                  >
                    {Number(projectedLoad).toFixed(1)} / {facultyLoadLimit}
                  </div>
                </div>
              </div>
            )}

            {/* Academic Qualifications (AQ) Status Alert Box */}
            {selectedTeacher && (
              <div
                className={`rounded-lg border p-3 shadow-xs ${
                  hasAllAqsMatch
                    ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/60 dark:text-emerald-200"
                    : "border-red-200 bg-red-50 text-red-950 dark:border-red-900/50 dark:bg-red-950/60 dark:text-red-200"
                }`}
              >
                <div
                  className={`text-xs font-bold tracking-wide uppercase ${
                    hasAllAqsMatch
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-red-700 dark:text-red-300"
                  }`}
                >
                  {hasAllAqsMatch
                    ? "Academic Qualifications (AQ) Met"
                    : "Academic Qualifications (AQ) Mismatch"}
                </div>
                <div
                  className={`mt-0.5 text-[11px] opacity-90 ${
                    hasAllAqsMatch
                      ? "text-emerald-800 dark:text-emerald-300/80"
                      : "text-red-800 dark:text-red-300/80"
                  }`}
                >
                  {hasAllAqsMatch
                    ? `The teacher holds all required AQs: [${requiredAqs.join(", ")}].`
                    : `Required AQs: [${requiredAqs.length > 0 ? requiredAqs.join(", ") : "None specified"}]. Teacher AQs: [${teacherAqs.length > 0 ? teacherAqs.join(", ") : "None"}].`}
                </div>
              </div>
            )}

            {/* FCCE Status Alert Box */}
            {selectedTeacher && (
              <div
                className={`rounded-lg border p-3 shadow-xs ${
                  hasFcceRecord
                    ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/60 dark:text-emerald-200"
                    : "border-red-200 bg-red-50 text-red-950 dark:border-red-900/50 dark:bg-red-950/60 dark:text-red-200"
                }`}
              >
                <div
                  className={`text-xs font-bold tracking-wide uppercase ${
                    hasFcceRecord
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-red-700 dark:text-red-300"
                  }`}
                >
                  {hasFcceRecord
                    ? `Passed FCCE Found for "${subjectRequirement?.course_name || "Course"}"`
                    : `No Passed FCCE Found for "${subjectRequirement?.course_name || "Course"}"`}
                </div>
                <div
                  className={`mt-0.5 text-[11px] opacity-90 ${
                    hasFcceRecord
                      ? "text-emerald-800 dark:text-emerald-300/80"
                      : "text-red-800 dark:text-red-300/80"
                  }`}
                >
                  {hasFcceRecord
                    ? "The selected teacher has a matching passed FCCE record for this specific course."
                    : "The teacher does not have a passed FCCE record matching this course name."}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 pt-3">
              <Button
                color="alternative"
                size="sm"
                onClick={onClose}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                color="cyan"
                size="sm"
                onClick={handleConfirmClick}
                disabled={!selectedTeacher}
                className={`cursor-pointer bg-cyan-600 text-white hover:bg-cyan-700 ${
                  !selectedTeacher ? "cursor-not-allowed opacity-50" : ""
                }`}
              >
                Confirm Assignment
              </Button>
            </div>
          </div>
        </ModalBody>
      </Modal>

      {/* Override Warning / Hard Limit Modal */}
      <Modal
        show={showOverrideModal}
        onClose={() => setShowOverrideModal(false)}
        size="md"
        popup
      >
        <ModalHeader />
        <ModalBody>
          <div className="text-center">
            <HiOutlineExclamationCircle
              className={`mx-auto mb-4 h-14 w-14 ${
                projectedLoad > absoluteMaxLoad
                  ? "text-red-500 dark:text-red-400"
                  : "text-amber-500 dark:text-amber-400"
              }`}
            />
            <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">
              {projectedLoad > absoluteMaxLoad
                ? "Hard Limit Exceeded"
                : "Workload or Schedule Constraint Mismatch"}
            </h3>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              {overrideWarningMessage}
            </p>
            <div className="flex justify-center gap-4">
              {projectedLoad <= absoluteMaxLoad && (
                <Button
                  color="purple"
                  size="sm"
                  onClick={() => {
                    setShowOverrideModal(false);
                    if (selectedTeacher) {
                      onAssignTeacher(selectedTeacher, applyToAllSections);
                    }
                  }}
                  className="cursor-pointer"
                >
                  Yes, Override & Assign
                </Button>
              )}
              <Button
                color="alternative"
                size="sm"
                onClick={() => setShowOverrideModal(false)}
                className="cursor-pointer"
              >
                {projectedLoad > absoluteMaxLoad ? "Back" : "Go Back"}
              </Button>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
}