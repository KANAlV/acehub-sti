"use client";

import { Badge, Button, Progress } from "flowbite-react";
import {
  HiCalendar,
  HiUserGroup,
  HiBookOpen,
  HiClock,
  HiArrowLeft,
  HiOutlineChartBar,
  HiOutlineExternalLink,
  HiOutlineTrash,
} from "react-icons/hi";

interface TeacherCardData {
  name: string;
  idNumber: string;
  code: string;
  status: string;
  currentUnits: number;
  maxUnits: number;
  absoluteMax: number;
  available: number;
  utilization: number;
}

interface ScheduleSummaryProps {
  scheduleName: string;
  scheduleId?: string;
  description?: string;
  totalEntries?: number;
  activeTeachers?: number;
  subjectsCount?: number;
  totalUnits?: number;
  dailyAverage?: string;
  avgClassDuration?: string;
  teachersUtil?: { current: number; max: number };
  roomsUtil?: { current: number; max: number };
  sectionsCount?: number;
  teachersList?: TeacherCardData[];
}

export default function SummaryDisplay({
  scheduleName = "test",
  scheduleId = "18a94041-ead7-445c-b8e2-44ef8d3e3591",
  description = "Summary Overview",
  totalEntries = 8,
  activeTeachers = 4,
  subjectsCount = 4,
  totalUnits = 13.5,
  dailyAverage = "2.7 units/day",
  avgClassDuration = "1.7 hours",
  teachersUtil = { current: 4, max: 26 },
  roomsUtil = { current: 7, max: 20 },
  sectionsCount = 2,
  teachersList = [
    {
      name: "Arvin A Marlin",
      idNumber: "10000148927",
      code: "AM",
      status: "Available",
      currentUnits: 0.0,
      maxUnits: 12,
      absoluteMax: 18,
      available: 12.0,
      utilization: 0.0,
    },
    {
      name: "Benz Kim F Dela Rosa",
      idNumber: "10000148757",
      code: "BFD",
      status: "Available",
      currentUnits: 0.0,
      maxUnits: 12,
      absoluteMax: 18,
      available: 12.0,
      utilization: 0.0,
    },
    {
      name: "Charles Arciaga",
      idNumber: "2000478221",
      code: "CA",
      status: "Available",
      currentUnits: 0.0,
      maxUnits: 12,
      absoluteMax: 18,
      available: 12.0,
      utilization: 0.0,
    },
    {
      name: "Darryl Pauline S Nietes",
      idNumber: "2000430053",
      code: "DSN",
      status: "Available",
      currentUnits: 0.0,
      maxUnits: 12,
      absoluteMax: 18,
      available: 12.0,
      utilization: 0.0,
    },
    {
      name: "James Murphy C Resurreccion",
      idNumber: "987352",
      code: "JCR",
      status: "Available",
      currentUnits: 0.0,
      maxUnits: 24,
      absoluteMax: 30,
      available: 24.0,
      utilization: 0.0,
    },
  ],
}: ScheduleSummaryProps) {
  return (
    <div className="min-h-screen bg-[#0b0f19] p-6 font-sans text-gray-100">
      {/* Top Action Bar */}
      <div className="mb-6 flex items-center justify-between">
        <button className="flex items-center text-xs text-gray-400 transition-colors hover:text-white">
          <HiArrowLeft className="mr-1.5 h-4 w-4" /> Back to Schedules
        </button>
        <div className="flex items-center gap-3">
          <Button
            color="gray"
            size="sm"
            className="border-gray-700 bg-[#1f2937] text-white hover:bg-gray-700"
          >
            Set as Display on Dashboard
          </Button>
          <Button
            color="blue"
            size="sm"
            className="bg-cyan-600 text-white hover:bg-cyan-700"
          >
            <HiOutlineExternalLink className="mr-1.5 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {/* Header Banner */}
      <div className="mb-6 flex flex-col justify-between rounded-2xl border border-gray-800 bg-[#111827] p-6 shadow-lg md:flex-row md:items-center">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-white">
            {scheduleName}
          </h1>
          <p className="font-mono text-xs text-gray-400">
            Schedule ID: {scheduleId} • {description}
          </p>
        </div>
        <div className="mt-4 flex items-center gap-3 md:mt-0">
          <Button
            size="sm"
            className="bg-cyan-600 font-medium text-white hover:bg-cyan-700"
          >
            <HiCalendar className="mr-2 h-4 w-4" /> Open Timetable
          </Button>
          <Button
            color="failure"
            size="sm"
            className="border border-red-500/50 bg-transparent text-red-400 hover:bg-red-500/10"
          >
            <HiOutlineTrash className="mr-1.5 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {/* Top Metric Cards Row */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1 */}
        <div className="flex items-center justify-between rounded-2xl border border-gray-800 bg-[#111827] p-5 shadow-sm">
          <div>
            <p className="mb-1 text-xs font-medium text-gray-400">
              Total Entries
            </p>
            <h3 className="text-3xl font-extrabold text-white">
              {totalEntries}
            </h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-800/40 bg-blue-950/60 text-blue-400">
            <HiCalendar className="h-5 w-5" />
          </div>
        </div>

        {/* Card 2 */}
        <div className="flex items-center justify-between rounded-2xl border border-gray-800 bg-[#111827] p-5 shadow-sm">
          <div>
            <p className="mb-1 text-xs font-medium text-gray-400">
              Active Teachers
            </p>
            <h3 className="text-3xl font-extrabold text-white">
              {activeTeachers}
            </h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-800/40 bg-emerald-950/60 text-emerald-400">
            <HiUserGroup className="h-5 w-5" />
          </div>
        </div>

        {/* Card 3 */}
        <div className="flex items-center justify-between rounded-2xl border border-gray-800 bg-[#111827] p-5 shadow-sm">
          <div>
            <p className="mb-1 text-xs font-medium text-gray-400">Subjects</p>
            <h3 className="text-3xl font-extrabold text-white">
              {subjectsCount}
            </h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-800/40 bg-purple-950/60 text-purple-400">
            <HiBookOpen className="h-5 w-5" />
          </div>
        </div>

        {/* Card 4 */}
        <div className="flex items-center justify-between rounded-2xl border border-gray-800 bg-[#111827] p-5 shadow-sm">
          <div>
            <p className="mb-1 text-xs font-medium text-gray-400">
              Total Units
            </p>
            <h3 className="text-3xl font-extrabold text-white">{totalUnits}</h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-800/40 bg-amber-950/60 text-amber-500">
            <HiClock className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Schedule Overview Details Section */}
      <div className="mb-8 rounded-2xl border border-gray-800 bg-[#111827] p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <HiOutlineChartBar className="h-5 w-5 text-cyan-400" />
          <h2 className="text-base font-bold tracking-wide text-white">
            Schedule Overview
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Resource Utilization Bars */}
          <div>
            <h4 className="mb-4 text-xs font-bold tracking-wider text-gray-300 uppercase">
              Resource Utilization
            </h4>
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-xs text-gray-400">
                  <span>Teachers</span>
                  <span className="font-mono">
                    {teachersUtil.current}/{teachersUtil.max}
                  </span>
                </div>
                <Progress
                  progress={(teachersUtil.current / teachersUtil.max) * 100}
                  size="sm"
                  color="blue"
                  className="bg-gray-800"
                />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-gray-400">
                  <span>Rooms</span>
                  <span className="font-mono">
                    {roomsUtil.current}/{roomsUtil.max}
                  </span>
                </div>
                <Progress
                  progress={(roomsUtil.current / roomsUtil.max) * 100}
                  size="sm"
                  color="green"
                  className="bg-gray-800"
                />
              </div>
              <div className="flex justify-between pt-1 text-xs text-gray-400">
                <span>Sections</span>
                <span className="font-mono font-bold text-gray-200">
                  {sectionsCount}
                </span>
              </div>
            </div>
          </div>

          {/* Schedule Details Summary Stats */}
          <div>
            <h4 className="mb-4 text-xs font-bold tracking-wider text-gray-300 uppercase">
              Schedule Details
            </h4>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between border-b border-gray-800 pb-2">
                <span className="text-gray-400">Schedule Name:</span>
                <span className="font-medium text-gray-100">
                  {scheduleName}
                </span>
              </div>
              <div className="flex justify-between border-b border-gray-800 pb-2">
                <span className="text-gray-400">Total Units:</span>
                <span className="font-mono font-semibold text-cyan-400">
                  {totalUnits}
                </span>
              </div>
              <div className="flex justify-between border-b border-gray-800 pb-2">
                <span className="text-gray-400">Daily Average:</span>
                <span className="font-mono text-gray-200">{dailyAverage}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-gray-400">Avg Class Duration:</span>
                <span className="font-mono text-gray-200">
                  {avgClassDuration}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Teacher Analysis Section */}
      <div className="mb-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HiUserGroup className="h-5 w-5 text-cyan-400" />
            <h2 className="text-base font-bold tracking-wide text-white">
              Teacher Analysis
            </h2>
          </div>
          <span className="text-xs text-gray-500">
            Click on a teacher to view detailed analysis
          </span>
        </div>

        {/* Teacher Workload Summary Banner */}
        <div className="mb-6 grid grid-cols-2 gap-4 rounded-2xl border border-gray-800 bg-[#111827] p-5 md:grid-cols-4">
          <div>
            <p className="mb-1 text-[11px] font-medium tracking-wider text-gray-400 uppercase">
              Total Teachers
            </p>
            <p className="text-2xl font-bold text-white">26</p>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium tracking-wider text-gray-400 uppercase">
              Active in Schedule
            </p>
            <p className="text-2xl font-bold text-emerald-400">
              {activeTeachers}
            </p>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium tracking-wider text-gray-400 uppercase">
              Overloaded
            </p>
            <p className="text-2xl font-bold text-red-500">0</p>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium tracking-wider text-gray-400 uppercase">
              Total Units Assigned
            </p>
            <p className="text-2xl font-bold text-blue-400">{totalUnits}</p>
          </div>
        </div>

        {/* Teacher Cards Grid */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {teachersList.map((teacher, idx) => (
            <div
              key={idx}
              className="relative flex flex-col justify-between rounded-2xl border border-gray-800 bg-[#111827] p-5 shadow-sm transition-all hover:border-gray-700"
            >
              <div>
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {teacher.name}
                    </h3>
                    <p className="font-mono text-[11px] text-gray-400">
                      {teacher.idNumber}
                    </p>
                    <p className="font-mono text-[11px] font-semibold text-gray-400">
                      {teacher.code}
                    </p>
                  </div>
                  <Badge
                    color="success"
                    size="sm"
                    className="border border-emerald-800/50 bg-emerald-950 px-2.5 py-0.5 font-normal text-emerald-400"
                  >
                    {teacher.status}
                  </Badge>
                </div>

                <div className="my-4 space-y-1.5 border-t border-gray-800/80 pt-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Current Units:</span>
                    <span className="font-mono text-gray-200">
                      {teacher.currentUnits.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Max Units:</span>
                    <span className="font-mono text-gray-200">
                      {teacher.maxUnits}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Absolute Max:</span>
                    <span className="font-mono font-semibold text-red-400">
                      {teacher.absoluteMax}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Available:</span>
                    <span className="font-mono text-emerald-400">
                      +{teacher.available.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Utilization:</span>
                    <span className="font-mono text-gray-200">
                      {teacher.utilization.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <Progress
                  progress={teacher.utilization}
                  size="sm"
                  color="blue"
                  className="bg-gray-800"
                />
              </div>
            </div>
          ))}

          {/* View All Teachers Card Placeholder */}
          <div className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-gray-800 bg-[#111827]/40 p-6 text-center transition-colors hover:border-gray-700">
            <span className="text-xs font-medium text-gray-500">
              View All Teachers
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
