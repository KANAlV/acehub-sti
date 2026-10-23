"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from "flowbite-react";
import { HiArrowLeft, HiOutlineExternalLink } from "react-icons/hi";
import { fetchTeacherDetailedMetrics } from "@/app/actions/system";
import { fetchUserRole } from "@/app/actions/user";

interface ScheduleTeacherProps {
  schedule_name: string;
  pscs_id: string;
}

interface TeacherInfo {
  name: string | null;
  pscs_id: string | null;
  teacher_code: string | null;
  employment_type: string | null;
}

interface UnitsAnalysis {
  current_units: number | null;
  max_units: number | null;
  absolute_max: number | null;
  remaining_units: number | null;
  unique_subjects: number | null;
  prep_limit: number | null;
  prep_utilization: number | null;
  utilization_rate: number | null;
  load_status: string | null;
}

interface ScheduleEntry {
  day: string;
  subject_name: string;
  start_time: string;
  end_time: string;
  room_name: string;
  section: string;
  units: number;
  code: string;
}

export default function SchedulesTeacherPage({
  schedule_name,
  pscs_id,
}: ScheduleTeacherProps) {
  const router = useRouter();
  const [canEdit, setCanEdit] = useState(false);

  // --- Page Loading States ---
  const [isLoading, setIsLoading] = useState(true);

  // --- Teacher Info States ---
  const [teacherInfo, setTeacherInfo] = useState<TeacherInfo>({
    name: null,
    pscs_id: null,
    teacher_code: null,
    employment_type: null,
  });

  // --- Units Analysis States ---
  const [unitsAnalysis, setUnitsAnalysis] = useState<UnitsAnalysis>({
    current_units: null,
    max_units: null,
    absolute_max: null,
    remaining_units: null,
    unique_subjects: null,
    prep_limit: null,
    prep_utilization: null,
    utilization_rate: null,
    load_status: null,
  });

  // --- Schedule & Breakdown States ---
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);

  // --- Data Fetching Effect ---
  useEffect(() => {
    async function fetchTeacherDetails() {
      setIsLoading(true);

      const res = await fetchTeacherDetailedMetrics(schedule_name, pscs_id);
      if (res.success && res.teacher && res.entries) {
        setTeacherInfo({
          name: res.teacher.name,
          pscs_id: res.teacher.pscs_id,
          teacher_code: res.teacher.teacher_code,
          employment_type: res.teacher.employment_type
        });

        setUnitsAnalysis({
          current_units: res.teacher.current_units,
          max_units: res.teacher.max_units,
          absolute_max: res.teacher.absolute_max,
          remaining_units: res.teacher.remaining_units,
          unique_subjects: res.teacher.unique_subjects,
          prep_limit: res.teacher.prep_limit,
          prep_utilization: res.teacher.prep_utilization,
          utilization_rate: res.teacher.utilization_rate,
          load_status: res.teacher.load_status,
        });

        setScheduleEntries(res.entries);
      }

      setIsLoading(false);
    }

    if (pscs_id && schedule_name) {
      void fetchTeacherDetails();
    }
  }, [schedule_name, pscs_id]);

  useEffect(() => {
    async function fetchUserPerm() {
      const res = await fetchUserRole("");

      if (res.success && res.data) {
        setCanEdit(res.data.schedules)
        console.log("Can Edit: " + Boolean(res.data.schedules));
      }
    }

    void fetchUserPerm()
  }, []);

  const DAYS_OF_WEEK = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between">
        <button
          className="flex items-center text-xs text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          onClick={() => router.push(`/schedules/${schedule_name}/teachers`)}
        >
          <HiArrowLeft className="mr-1.5 h-4 w-4" /> Back to Teachers Analysis
        </button>

        {/* TODO: ADD EXPORT FOR TEACHER SCEHDULE */}
        <Button
          color="blue"
          size="sm"
          className="bg-cyan-600 text-white hover:bg-cyan-700"
          hidden={!canEdit}
        >
          <HiOutlineExternalLink className="mr-1.5 h-4 w-4" />
          Export Teacher Schedule
        </Button>
      </div>

      {/* Header & Status Badge */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {teacherInfo.name !== null ? (
              teacherInfo.name
            ) : (
              <Spinner size="sm" />
            )}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Teacher Analysis • {schedule_name}
          </p>
        </div>
        <div className="inline-flex items-center rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          {unitsAnalysis.load_status !== null ? (
            unitsAnalysis.load_status
          ) : (
            <Spinner size="sm" />
          )}
        </div>
      </div>

      {/* Main Grid: Teacher Information & Units Analysis */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Teacher Information Card */}
        <Card className="lg:col-span-1">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
            👥 Teacher Information
          </h3>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Full Name
              </p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {teacherInfo.name !== null ? (
                  teacherInfo.name
                ) : (
                  <Spinner size="sm" />
                )}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                PSCS ID
              </p>
              <p className="font-mono text-gray-900 dark:text-white">
                {teacherInfo.pscs_id !== null ? (
                  teacherInfo.pscs_id
                ) : (
                  <Spinner size="sm" />
                )}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Teacher Code
              </p>
              <p className="font-mono text-gray-900 dark:text-white">
                {teacherInfo.teacher_code !== null ? (
                  teacherInfo.teacher_code
                ) : (
                  <Spinner size="sm" />
                )}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Employment Type
              </p>
              <p className="text-gray-900 dark:text-white">
                {teacherInfo.employment_type !== null ? (
                  teacherInfo.employment_type
                ) : (
                  <Spinner size="sm" />
                )}
              </p>
            </div>
          </div>
        </Card>

        {/* Units Analysis Card */}
        <Card className="lg:col-span-2">
          <h3 className="mb-6 text-sm font-semibold text-gray-900 dark:text-white">
            🕒 Units Analysis
          </h3>
          <div className="grid grid-cols-2 gap-4 text-center md:grid-cols-4">
            <div>
              <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                {unitsAnalysis.current_units !== null ? (
                  unitsAnalysis.current_units.toFixed(1)
                ) : (
                  <Spinner size="sm" />
                )}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Current Units
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                {unitsAnalysis.max_units !== null ? (
                  unitsAnalysis.max_units
                ) : (
                  <Spinner size="sm" />
                )}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Max Units
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {unitsAnalysis.absolute_max !== null ? (
                  unitsAnalysis.absolute_max
                ) : (
                  <Spinner size="sm" />
                )}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Absolute Max
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-2 dark:bg-emerald-950/40">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {unitsAnalysis.remaining_units !== null ? (
                  `+${unitsAnalysis.remaining_units.toFixed(1)}`
                ) : (
                  <Spinner size="sm" />
                )}
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Remaining Units
              </p>
            </div>
          </div>

          {/* Prep Utilization Box */}
          <div className="mt-6 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <div className="flex justify-between text-xs font-medium text-gray-700 dark:text-gray-300">
              <span>
                {unitsAnalysis.unique_subjects !== null ? (
                  `${unitsAnalysis.unique_subjects} Unique Subjects`
                ) : (
                  <Spinner size="sm" />
                )}
              </span>
              <span>
                {unitsAnalysis.prep_limit !== null ? (
                  `${unitsAnalysis.prep_limit} Prep Limit`
                ) : (
                  <Spinner size="sm" />
                )}
              </span>
              <span>
                {unitsAnalysis.prep_utilization !== null ? (
                  `${unitsAnalysis.prep_utilization.toFixed(1)}%`
                ) : (
                  <Spinner size="sm" />
                )}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Prep Utilization
            </p>
            <div className="mt-2 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-2 rounded-full bg-cyan-600 transition-all duration-300"
                style={{ width: `${unitsAnalysis.prep_utilization ?? 0}%` }}
              ></div>
            </div>
          </div>

          {/* Overall Utilization Rate */}
          <div className="mt-6">
            <div className="flex justify-between text-xs font-medium text-gray-700 dark:text-gray-300">
              <span>Utilization Rate</span>
              <span>
                {unitsAnalysis.utilization_rate !== null ? (
                  `${unitsAnalysis.utilization_rate.toFixed(1)}%`
                ) : (
                  <Spinner size="sm" />
                )}
              </span>
            </div>
            <div className="mt-2 h-2.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-2.5 rounded-full bg-blue-600 transition-all duration-300"
                style={{ width: `${unitsAnalysis.utilization_rate ?? 0}%` }}
              ></div>
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-gray-400">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Schedule by Day Section */}
      <div>
        <h3 className="mb-4 text-base font-bold text-gray-900 dark:text-white">
          📅 Schedule by Day
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {DAYS_OF_WEEK.map((day) => {
            const dayEntries = scheduleEntries.filter((e) => e.day === day);
            const totalDayUnits = dayEntries.reduce(
              (sum, e) => sum + e.units,
              0,
            );

            return (
              <Card key={day} className="flex flex-col justify-between">
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {day}
                    </h4>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {totalDayUnits.toFixed(1)} units
                    </span>
                  </div>

                  {isLoading ? (
                    <div className="py-6 text-center">
                      <Spinner size="sm" />
                    </div>
                  ) : dayEntries.length > 0 ? (
                    <div className="space-y-4 divide-y divide-gray-100 dark:divide-gray-800">
                      {dayEntries.map((entry, idx) => (
                        <div key={idx} className={idx > 0 ? "pt-3" : ""}>
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {entry.subject_name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {entry.start_time} - {entry.end_time}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Room: {entry.room_name} • Section:{" "}
                                {entry.section}
                              </p>
                            </div>
                            <Button size="xs" color="alternative">
                              Transfer
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="py-6 text-center text-xs text-gray-400 italic">
                      No classes scheduled
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Subject Breakdown Table Section
      TODO: ADD SUBJECT REASSIGN MODAL AND FUNCTION. IT MUST CHECK FOR FCCE AND MAQ
      */}
      <div>
        <h3 className="mb-4 text-base font-bold text-gray-900 dark:text-white">
          📖 Subject Breakdown
        </h3>
        <Card className="overflow-x-auto">
          <Table hoverable>
            <TableHead>
              <TableRow>
                <TableHeadCell>Subject</TableHeadCell>
                <TableHeadCell>Code</TableHeadCell>
                <TableHeadCell>Units</TableHeadCell>
                <TableHeadCell>Schedule</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody className="divide-y">
              {isLoading ? (
                <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                  <TableCell
                    colSpan={4}
                    className="py-6 text-center text-sm text-gray-500 italic"
                  >
                    <div className="flex items-center justify-center">
                      <Spinner size="sm" />
                      <span className="ml-3">Loading subject breakdown...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : scheduleEntries.length > 0 ? (
                scheduleEntries.map((item, index) => (
                  <TableRow
                    key={index}
                    className="bg-white dark:border-gray-700 dark:bg-gray-800"
                  >
                    <TableCell className="font-medium text-gray-900 dark:text-white">
                      {item.subject_name}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.code}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {item.units.toFixed(1)} units
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-500 dark:text-gray-400">
                      {item.day} {item.start_time} - {item.end_time}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                  <TableCell
                    colSpan={4}
                    className="py-6 text-center text-sm text-gray-500 italic dark:text-gray-400"
                  >
                    No subject breakdown entries found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}