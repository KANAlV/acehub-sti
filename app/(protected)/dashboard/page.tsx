"use client";

import React, { useEffect, useState } from "react";
import {
    Card,
    Button,
    Spinner,
    Progress,
    Badge,
} from "flowbite-react";
import {
    HiCalendar,
    HiUserGroup,
    HiBookOpen,
    HiClock,
    HiPencilAlt,
    HiExclamation,
} from "react-icons/hi";
import { useRouter } from "next/navigation";

// --- Types --- //
export interface Metrics {
    totalTeachers: number;
    activeTeachers: number;
    totalUnitsAssigned: number;
    averageUtilization: number;
    teacherLoads: Array<{ id: string; type: string; load: number }>;
    activeRooms: number;
    activeSections: number;
    totalEntries: number;
}

export interface Teacher {
    pscs_id: string;
    fname: string;
    sname: string;
    mi?: string;
    suffix?: string;
    employment_type: string;
}

export interface ScheduleEntry {
    id: string;
    teacher_id: string;
    subject_id: string;
    subjectId: string;
    start_time: number; // minutes from midnight
    end_time: number;   // minutes from midnight
}

export interface SystemSettings {
    overloadMax?: number;
    prepLimit?: number;
}

export default function DashboardSummary() {
    const router = useRouter();

    // --- States --- //
    const [loading, setLoading] = useState(true);
    const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
    const [scheduleName, setScheduleName] = useState("No Active Schedule");
    const [scheduleDescription, setScheduleDescription] = useState("");

    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
    const [systemSettings, setSystemSettings] = useState<SystemSettings>({});
    const [userPerms, setUserPerms] = useState<{ schedules?: boolean }>({ schedules: true });

    // Helper utility functions for limits & load calculations
    const getMaxUnits = (employmentType: string): number => {
        const type = String(employmentType || "").toLowerCase();
        if (type === "regular" || type === "ft" || type === "full-time") return 24;
        if (type === "ptfl" || type === "ftpt") return 18;
        if (type === "pt" || type === "part-time") return 12;
        if (type === "proby") return 20;
        return 24;
    };

    const getOverloadMaxSync = (settings: SystemSettings): number => {
        return settings.overloadMax ?? 6;
    };

    const getPrepLimitSync = (employmentType: string, settings: SystemSettings): number => {
        return settings.prepLimit ?? 4;
    };

    // --- Mock Data Initialization --- //
    const loadDashboardData = async () => {
        setLoading(true);
        try {
            // Simulating database/API delay
            await new Promise((resolve) => setTimeout(resolve, 600));

            // Hidden Schedule ID used for background key and navigation routes only
            const mockActiveScheduleId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
            const mockScheduleName = "SHS Term 1 Master Schedule";
            const mockDescription = "First semester timetable configuration for Senior High School department.";

            const mockTeachers: Teacher[] = [
                { pscs_id: "T001", fname: "Juan", mi: "A", sname: "Dela Cruz", employment_type: "Full-Time" },
                { pscs_id: "T002", fname: "Maria", mi: "B", sname: "Santos", employment_type: "Part-Time" },
                { pscs_id: "T003", fname: "John", mi: "C", sname: "Doe", employment_type: "Regular" },
                { pscs_id: "T004", fname: "Ana", mi: "D", sname: "Reyes", employment_type: "Proby" },
            ];

            const mockSchedules: ScheduleEntry[] = [
                { id: "S1", teacher_id: "T001", subject_id: "SUB1", subjectId: "SUB1", start_time: 480, end_time: 600 },
                { id: "S2", teacher_id: "T001", subject_id: "SUB2", subjectId: "SUB2", start_time: 600, end_time: 720 },
                { id: "S3", teacher_id: "T002", subject_id: "SUB3", subjectId: "SUB3", start_time: 480, end_time: 600 },
                { id: "S4", teacher_id: "T003", subject_id: "SUB1", subjectId: "SUB1", start_time: 720, end_time: 900 },
            ];

            const mockMetrics: Metrics = {
                totalTeachers: mockTeachers.length,
                activeTeachers: 3,
                totalUnitsAssigned: 12.5,
                averageUtilization: 68.5,
                teacherLoads: [
                    { id: "T001", type: "Full-Time", load: 26 },
                    { id: "T002", type: "Part-Time", load: 10 },
                    { id: "T003", type: "Regular", load: 20 },
                ],
                activeRooms: 8,
                activeSections: 12,
                totalEntries: mockSchedules.length,
            };

            setActiveScheduleId(mockActiveScheduleId);
            setScheduleName(mockScheduleName);
            setScheduleDescription(mockDescription);
            setTeachers(mockTeachers);
            setSchedules(mockSchedules);
            setMetrics(mockMetrics);
            setSystemSettings({ overloadMax: 6, prepLimit: 4 });
            setUserPerms({ schedules: true });
        } catch (error) {
            console.error("Dashboard Load Error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadDashboardData();
    }, []);

    const stats = {
        totalEntries: schedules.length,
        uniqueTeachers: new Set(schedules.map((s) => String(s.teacher_id))).size,
        uniqueSubjects: new Set(schedules.map((s) => String(s.subject_id))).size,
        totalUnits: schedules.reduce((total, s) => {
            return total + (Number(s.end_time) - Number(s.start_time)) / 60;
        }, 0),
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Spinner size="xl" />
            </div>
        );
    }

    if (!activeScheduleId) {
        return (
            <Card className="mx-auto my-8 max-w-2xl text-center">
                <HiExclamation className="mx-auto h-12 w-12 text-yellow-400" />
                <h3 className="mt-4 text-xl font-bold">No Dashboard Display Set</h3>
                <Button className="mx-auto mt-4" onClick={() => router.push("/schedules")}>
                    Go to Schedules
                </Button>
            </Card>
        );
    }

    if (scheduleName !== "No Active Schedule") {
        return (
            <div className="min-h-screen space-y-6 bg-gray-50 p-6 dark:bg-gray-900">
                {/* Header (Shows Schedule Name and Generation Config Description) */}
                <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{scheduleName}</h1>
                        {scheduleDescription && (
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {scheduleDescription}
                            </p>
                        )}
                    </div>
                    <Button
                        color="blue"
                        onClick={() =>
                            userPerms?.schedules
                                ? router.push(`/schedules/${activeScheduleId}/timetable`)
                                : router.push(`./timetable`)
                        }
                    >
                        {userPerms?.schedules ? (
                            <HiPencilAlt className="mr-2 h-5 w-5" />
                        ) : (
                            <HiCalendar className="mr-2 h-5 w-5" />
                        )}
                        {userPerms?.schedules ? "Edit Timetable" : "View Timetable"}
                    </Button>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatBox label="Total Entries" value={stats.totalEntries} icon={HiCalendar} color="text-blue-500" />
                    <StatBox label="Active Teachers" value={metrics?.activeTeachers ?? 0} icon={HiUserGroup} color="text-green-500" />
                    <StatBox label="Subjects" value={stats.uniqueSubjects} icon={HiBookOpen} color="text-purple-500" />
                    <StatBox label="Total Units" value={metrics?.totalUnitsAssigned ?? 0} icon={HiClock} color="text-orange-500" />
                </div>

                {/* Teacher Analysis Section */}
                <Card className="border-none shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-lg font-semibold">
                            <HiUserGroup className="h-5 w-5" /> Teacher Analysis
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Click on a teacher to view detailed analysis
                        </p>
                    </div>

                    {/* Blue Workload Summary Bar */}
                    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                        <h4 className="mb-3 text-sm font-semibold text-blue-800 dark:text-blue-200">
                            Teacher Workload Summary
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-xs md:grid-cols-5">
                            <div>
                                <p className="text-gray-600 dark:text-gray-400">Total Teachers</p>
                                <p className="text-lg font-bold">{metrics?.totalTeachers ?? 0}</p>
                            </div>
                            <div>
                                <p className="text-gray-600 dark:text-gray-400">Active in Schedule</p>
                                <p className="text-lg font-bold text-green-600">
                                    {metrics?.activeTeachers ?? 0}
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-600 dark:text-gray-400">Overloaded</p>
                                <p className="text-lg font-bold text-red-600">
                                    {metrics?.teacherLoads
                                        ? metrics.teacherLoads.filter((t) => {
                                            const maxUnits = getMaxUnits(t.type);
                                            return t.load > maxUnits;
                                        }).length
                                        : 0}
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-600 dark:text-gray-400">Total Units Assigned</p>
                                <p className="text-lg font-bold text-blue-600">
                                    {metrics?.totalUnitsAssigned ?? 0}
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-600 dark:text-gray-400">Avg Utilization</p>
                                <p className="text-lg font-bold text-purple-600">
                                    {metrics?.averageUtilization ? metrics.averageUtilization.toFixed(1) : "0.0"}%
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Teacher Cards Grid */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {teachers.slice(0, 5).map((teacher) => {
                            const teacherUnits = schedules.reduce((total, s) => {
                                if (String(s.teacher_id) === String(teacher.pscs_id)) {
                                    return total + (Number(s.end_time) - Number(s.start_time)) / 60;
                                }
                                return total;
                            }, 0);

                            const maxUnits = getMaxUnits(teacher.employment_type);
                            const overloadMax = getOverloadMaxSync(systemSettings);
                            const absoluteMax = maxUnits + overloadMax;
                            const utilizationRate = maxUnits > 0 ? (teacherUnits / maxUnits) * 100 : 0;
                            const remainingUnits = maxUnits - teacherUnits;

                            let statusColor = "green";
                            let statusText = "Available";
                            if (teacherUnits > absoluteMax) {
                                statusColor = "red";
                                statusText = "Overloaded";
                            } else if (teacherUnits > maxUnits) {
                                statusColor = "orange";
                                statusText = "Overloaded (Within Limit)";
                            } else if (teacherUnits >= maxUnits * 0.95) {
                                statusColor = "red";
                                statusText = "At Max Capacity";
                            } else if (teacherUnits >= maxUnits * 0.85) {
                                statusColor = "yellow";
                                statusText = "Near Capacity";
                            } else if (teacherUnits >= maxUnits * 0.6) {
                                statusColor = "blue";
                                statusText = "Moderate Load";
                            }

                            return (
                                <div
                                    key={teacher.pscs_id}
                                    className="cursor-pointer rounded-lg border border-gray-200 bg-gray-50 p-4 transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
                                    onClick={() =>
                                        userPerms?.schedules
                                            ? router.push(`/schedules/${activeScheduleId}/teachers/${teacher.pscs_id}`)
                                            : router.push(`./overview/${teacher.pscs_id}`)
                                    }
                                >
                                    <div className="mb-3 flex items-start justify-between">
                                        <div>
                                            <h4 className="text-sm font-semibold">
                                                {teacher.fname} {teacher.mi ? teacher.mi + "." : ""} {teacher.sname}{" "}
                                                {teacher.suffix ? `, ${teacher.suffix}` : ""}
                                            </h4>
                                            <p className="text-xs text-gray-500">{teacher.pscs_id}</p>
                                        </div>
                                        <Badge color={statusColor} size="sm">
                                            {statusText}
                                        </Badge>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <span>Current Units:</span>
                                            <span className="font-medium">{teacherUnits.toFixed(1)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span>Max Units:</span>
                                            <span className="font-medium">{maxUnits}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span>Absolute Max:</span>
                                            <span className="font-medium text-orange-600">{absoluteMax}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span>Available:</span>
                                            <span
                                                className={`font-medium ${
                                                    remainingUnits >= 0 ? "text-green-600" : "text-red-600"
                                                }`}
                                            >
                        {remainingUnits >= 0 ? "+" : ""}
                                                {remainingUnits.toFixed(1)}
                      </span>
                                        </div>
                                        <div className="mt-3">
                                            <div className="mb-1 flex justify-between text-xs">
                                                <span>Utilization</span>
                                                <span>{utilizationRate.toFixed(1)}%</span>
                                            </div>
                                            <Progress
                                                progress={Math.min(100, Math.max(0, utilizationRate))}
                                                color={statusColor}
                                                size="sm"
                                                className="h-2"
                                            />
                                        </div>

                                        {teacherUnits > 0 && (
                                            <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-600">
                                                <p className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                                                    Assigned Subjects:{" "}
                                                    {
                                                        new Set(
                                                            schedules
                                                                .filter((s) => String(s.teacher_id) === String(teacher.pscs_id))
                                                                .map((s) => s.subjectId)
                                                        ).size
                                                    }
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    Max Allowed: {getPrepLimitSync(teacher.employment_type, systemSettings)}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* View All Card */}
                        <div
                            onClick={() =>
                                userPerms?.schedules
                                    ? router.push(`/schedules/${activeScheduleId}/teachers`)
                                    : router.push(`/overview`)
                            }
                            className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-200 bg-transparent p-4 text-center text-gray-500 transition-all hover:bg-blue-500/20 hover:shadow-md dark:border-gray-700"
                        >
                            View All Teachers
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex h-[90%] w-full flex-col items-center justify-center bg-gray-50 px-4 text-center dark:bg-gray-900">
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400">
                    <svg
                        className="h-8 w-8"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        ></path>
                    </svg>
                </div>
                <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">No Schedule Set</h1>
                <p className="mb-6 text-gray-600 dark:text-gray-400">
                    The Academic Head has yet to set a schedule to display on the dashboard. Please wait till further notice.
                </p>
                <div className="mb-6 text-sm italic text-gray-500 dark:text-gray-500">
                    Thank you for your patience.
                </div>
            </div>
        </div>
    );
}

function StatBox({
                     label,
                     value,
                     icon: Icon,
                     color,
                 }: {
    label: string;
    value: number | string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
}) {
    return (
        <Card className="border-none shadow-sm">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-500">{label}</p>
                    <p className="text-2xl font-bold">{value}</p>
                </div>
                <Icon className={`h-8 w-8 ${color}`} />
            </div>
        </Card>
    );
}