"use client";

import React, { useState } from "react";
import {
    HiBookOpen,
    HiUserGroup,
    HiAcademicCap,
    HiCalendar,
    HiCog,
    HiShieldCheck,
    HiSearch,
    HiChevronRight,
    HiOutlineDesktopComputer,
    HiChartPie,
    HiCollection,
    HiOfficeBuilding,
    HiClipboardList,
    HiBookmark,
} from "react-icons/hi";

interface DetailedStep {
    stepNumber: number;
    title: string;
    description: string;
    buttonTarget?: string;
    details: string[];
}

interface ModuleGuide {
    id: string;
    title: string;
    route: string;
    icon: React.ElementType;
    description: string;
    roles: string[];
    features: string[];
    steps: DetailedStep[];
}

export default function HelpPage() {
    const [activeTab, setActiveTab] = useState<string>("dashboard");
    const [searchQuery, setSearchQuery] = useState<string>("");

    const modules: ModuleGuide[] = [
        {
            id: "dashboard",
            title: "Dashboard & Analytics",
            route: "/dashboard",
            icon: HiChartPie,
            description: "Overview of institutional workload metrics, room utilization, and teacher load capacities.",
            roles: ["Academic Head", "School Registrar", "Academic Assistant"],
            features: [
                "Real-time summary cards for total assigned units and active faculty count",
                "Overload warning flags for teachers exceeding standard teaching limits",
                "Quick statistics on room usage and active curriculum distributions",
            ],
            steps: [
                {
                    stepNumber: 1,
                    title: "Access System Metrics",
                    description: "Locate and enter the main analytics dashboard.",
                    buttonTarget: "Dashboard",
                    details: [
                        "Click the Dashboard item on the left sidebar navigation panel.",
                        "Wait for the live telemetry metrics to finish loading from the database.",
                    ],
                },
                {
                    stepNumber: 2,
                    title: "Audit High-Level Summary Cards",
                    description: "Review top-level metric counters across departments.",
                    details: [
                        "Examine Total Active Faculty to ensure all onboarded instructors are indexed.",
                        "Check Total Program Sections to verify projected enrollment metrics.",
                        "Review Room Utilization Percentage to identify peak scheduling hours.",
                    ],
                },
                {
                    stepNumber: 3,
                    title: "Inspect Overload and Constraint Alerts",
                    description: "Identify room overlaps or teaching load limit violations.",
                    buttonTarget: "View Warning Logs",
                    details: [
                        "Scroll down to the 'System Alerts & Warnings' panel.",
                        "Review flagged teachers exceeding the 30-unit maximum workload limit.",
                        "Click 'View Warning Logs' to inspect specific section conflicts requiring manual adjustments.",
                    ],
                },
                {
                    stepNumber: 4,
                    title: "Refresh Telemetry Data",
                    description: "Fetch live operational statistics after performing schedule updates.",
                    buttonTarget: "Refresh Metrics",
                    details: [
                        "Click the 'Refresh Metrics' button at the top-right header corner to re-sync real-time figures.",
                    ],
                },
            ],
        },
        {
            id: "courses",
            title: "Courses & Programs",
            route: "/courses",
            icon: HiAcademicCap,
            description: "Manage Senior High School strands and Tertiary degree programs with student population mapping.",
            roles: ["School Registrar", "Academic Head"],
            features: [
                "SHS Strand Management (STEM, ABM, HUMSS, TOP) with grade 11/12 headcounts",
                "Tertiary Program Management (BSIT, BSCPE, BSHM) across 1st to 4th year levels",
                "Automatic section calculation formula based on student population caps",
            ],
            steps: [
                {
                    stepNumber: 1,
                    title: "Select Educational Level",
                    description: "Choose between Senior High School and Tertiary management views.",
                    buttonTarget: "Senior High School / Tertiary Tab",
                    details: [
                        "Navigate to Courses via the main sidebar menu.",
                        "Click on the top tab switcher to select either 'Senior High School' or 'Tertiary'.",
                    ],
                },
                {
                    stepNumber: 2,
                    title: "Register a New Academic Program/Strand",
                    description: "Add a new program code and title to the institutional registry.",
                    buttonTarget: "+ Add New Program",
                    details: [
                        "Click the '+ Add New Program' button located in the top action toolbar.",
                        "In the modal dialog, fill in the Program Code (e.g., BSIT, STEM).",
                        "Enter the full Program Name (e.g., Bachelor of Science in Information Technology).",
                        "Click 'Save Program' to record the entry.",
                    ],
                },
                {
                    stepNumber: 3,
                    title: "Configure Headcounts & Section Limits",
                    description: "Set total enrolled students per year level to calculate section splits.",
                    buttonTarget: "Edit Headcount",
                    details: [
                        "Locate the target program card and click 'Edit Headcount'.",
                        "Enter student population figures per grade level (e.g., Grade 11: 180 students).",
                        "Set the Maximum Class Capacity (default max: 50 students per section).",
                        "Click 'Calculate Sections' to automatically project section tags (e.g., BSIT 101, BSIT 102).",
                    ],
                },
                {
                    stepNumber: 4,
                    title: "Commit Program Configurations",
                    description: "Save and deploy the section requirements to the scheduler registry.",
                    buttonTarget: "Commit & Apply",
                    details: [
                        "Review generated section list previews.",
                        "Click 'Commit & Apply' to lock sections for timetable generation.",
                    ],
                },
            ],
        },
        {
            id: "subjects",
            title: "Subjects Catalog",
            route: "/subjects",
            icon: HiCollection,
            description: "Manage curriculum subjects, course codes, lecture/lab units, and prerequisite associations.",
            roles: ["School Registrar", "Academic Head"],
            features: [
                "Comprehensive subject list filtered by program and term",
                "Unit allocation breakdown (Lecture units vs Laboratory units)",
                "Linkage to Matrix of Academic Qualifications (MAQ) requirements",
            ],
            steps: [
                {
                    stepNumber: 1,
                    title: "Filter Catalog View",
                    description: "Locate subjects by specific term, strand, or degree program.",
                    buttonTarget: "Filter by Program",
                    details: [
                        "Open the Subjects page from the sidebar menu.",
                        "Click 'Filter by Program' dropdown and select your target program (e.g., BSIT).",
                        "Select Semester / Term (e.g., 1st Year - 1st Semester).",
                    ],
                },
                {
                    stepNumber: 2,
                    title: "Add a New Course Subject",
                    description: "Create a subject listing with credit unit breakdowns.",
                    buttonTarget: "+ Add Subject",
                    details: [
                        "Click the blue '+ Add Subject' button at the upper right.",
                        "Fill in Course Code (e.g., IT204) and Subject Title (e.g., Data Structures and Algorithms).",
                        "Specify Lecture Hours (e.g., 2) and Laboratory Hours (e.g., 3).",
                        "Assign Credit Units (e.g., 3 units).",
                        "Select Required Facility Type (e.g., Computer Laboratory).",
                        "Click 'Create Subject' to save.",
                    ],
                },
                {
                    stepNumber: 3,
                    title: "Configure Prerequisites & Corequisites",
                    description: "Link course sequence dependencies.",
                    buttonTarget: "Manage Dependencies",
                    details: [
                        "Hover over any subject row and click 'Manage Dependencies'.",
                        "Select required prerequisite subjects from the dropdown list.",
                        "Click 'Save Dependencies' to validate academic progression rules.",
                    ],
                },
                {
                    stepNumber: 4,
                    title: "Export Curriculum Matrix",
                    description: "Download copies of the active curriculum listing.",
                    buttonTarget: "Export CSV / PDF",
                    details: [
                        "Click the 'Export CSV / PDF' button on the toolbar to export the filtered catalog.",
                    ],
                },
            ],
        },
        {
            id: "teachers",
            title: "Teachers & Faculty Management",
            route: "/teachers",
            icon: HiUserGroup,
            description: "Maintain faculty profiles, employment statuses, contact details, and assigned course loads.",
            roles: ["Academic Head", "School Registrar"],
            features: [
                "Profiles for Full-Time, Part-Time, Regular, and Probationary faculty",
                "Inspection of assigned teaching loads, prep limits, and overload units",
                "Direct auditing of faculty matrix qualifications",
            ],
            steps: [
                {
                    stepNumber: 1,
                    title: "Access Faculty Directory",
                    description: "Open the full instructor database.",
                    buttonTarget: "Teachers",
                    details: [
                        "Click 'Teachers' on the left navigation sidebar.",
                        "Use the search box to locate teachers by name, ID number, or employment status.",
                    ],
                },
                {
                    stepNumber: 2,
                    title: "Onboard New Instructor",
                    description: "Create an active teaching profile for a new faculty member.",
                    buttonTarget: "+ Register Teacher",
                    details: [
                        "Click '+ Register Teacher' on the top action bar.",
                        "Provide full legal name, institutional email address, and employee ID.",
                        "Set Employment Status: Full-Time (max 30 units) or Part-Time (max 15 units).",
                        "Click 'Save Profile' to finalize registration.",
                    ],
                },
                {
                    stepNumber: 3,
                    title: "Audit Faculty Workloads & Preps",
                    description: "Check current teaching load allocations and subject preparation counts.",
                    buttonTarget: "View Load Profile",
                    details: [
                        "Click 'View Load Profile' next to any teacher's name.",
                        "Inspect total assigned lecture and lab units.",
                        "Verify unique course preparations (maximum standard: 4 preps per instructor).",
                        "Check overload status indicators if total units exceed regular contracts.",
                    ],
                },
                {
                    stepNumber: 4,
                    title: "Toggle Instructor Availability & Status",
                    description: "Update employment standing or mark on-leave status.",
                    buttonTarget: "Edit Profile Status",
                    details: [
                        "Click 'Edit Profile Status' on the faculty details view.",
                        "Toggle active/inactive flags or update contract classifications.",
                        "Click 'Update Teacher' to save state.",
                    ],
                },
            ],
        },
        {
            id: "maq",
            title: "Matrix of Academic Qualifications (MAQ)",
            route: "/maq",
            icon: HiShieldCheck,
            description: "Map teacher credentials and subject competencies to ensure compliant teaching assignments.",
            roles: ["Academic Head"],
            features: [
                "Cluster-based qualification tagging for specialized subjects",
                "Automated validation during automated schedule generation",
                "Warning flags for uncertified teaching assignments",
            ],
            steps: [
                {
                    stepNumber: 1,
                    title: "Open MAQ Matrix Matrix Workspace",
                    description: "Access the qualification cross-reference grid.",
                    buttonTarget: "MAQ",
                    details: [
                        "Click 'MAQ' in the navigation sidebar.",
                        "Review the two-axis matrix mapping instructors against Subject Qualification Clusters.",
                    ],
                },
                {
                    stepNumber: 2,
                    title: "Assign Qualification Clusters to Instructor",
                    description: "Authorize teachers for specific academic subjects based on degrees/certifications.",
                    buttonTarget: "Assign Competency",
                    details: [
                        "Locate the target instructor row.",
                        "Click 'Assign Competency' or click directly on matrix intersection checkboxes.",
                        "Select relevant subject clusters (e.g., Web Development, Networking & Security, Mathematics).",
                        "Attach proof of qualification reference notes if required.",
                    ],
                },
                {
                    stepNumber: 3,
                    title: "Validate MAQ Compliance",
                    description: "Run verification checks against current course schedules.",
                    buttonTarget: "Run Compliance Audit",
                    details: [
                        "Click 'Run Compliance Audit' at the top of the matrix window.",
                        "Review red highlight warnings denoting uncertified instructors assigned to specialized courses.",
                        "Adjust cluster authorizations or reassign teaching loads accordingly.",
                    ],
                },
                {
                    stepNumber: 4,
                    title: "Save & Lock Qualification Matrix",
                    description: "Lock MAQ state prior to running automated schedule generation.",
                    buttonTarget: "Save MAQ Rules",
                    details: [
                        "Click 'Save MAQ Rules' to enforce competency constraints across all scheduling algorithms.",
                    ],
                },
            ],
        },
        {
            id: "rooms",
            title: "Rooms & Facilities",
            route: "/rooms",
            icon: HiOfficeBuilding,
            description: "Manage classroom inventories, physical floor placements, and facility categorization.",
            roles: ["Academic Assistant", "Academic Head"],
            features: [
                "Facility categorization (Lecture Rooms, Computer Labs, Science Labs, Kitchens)",
                "Floor level tracking (1st to 5th Floor) for transit optimization",
                "Seating capacity limits enforced during room allocation",
            ],
            steps: [
                {
                    stepNumber: 1,
                    title: "Review Physical Room Inventory",
                    description: "Examine active classrooms, capacities, and facility types.",
                    buttonTarget: "Rooms",
                    details: [
                        "Click 'Rooms' on the left navigation drawer.",
                        "Filter rooms by Building, Floor Level (1st to 5th Floor), or Type (Lecture vs Laboratory).",
                    ],
                },
                {
                    stepNumber: 2,
                    title: "Create a New Classroom Record",
                    description: "Add a newly designated room or lab space into the scheduler database.",
                    buttonTarget: "+ Add Room",
                    details: [
                        "Click '+ Add Room' on the action bar.",
                        "Input Room Name/Number (e.g., Lab 402, Room 301).",
                        "Select Facility Type: General Lecture, Computer Lab, Science Lab, or Culinary Kitchen.",
                        "Set Maximum Student Capacity (e.g., 45 students).",
                        "Specify Building Floor Level for transit conflict calculations.",
                        "Click 'Save Room' to register.",
                    ],
                },
                {
                    stepNumber: 3,
                    title: "Configure Maintenance & Blackout Windows",
                    description: "Set room unavailability slots for repairs or administrative events.",
                    buttonTarget: "Set Blackout Window",
                    details: [
                        "Select a room card and click 'Set Blackout Window'.",
                        "Choose designated day and time blocks when the room must not be assigned.",
                        "Click 'Apply Constraints' to lock the window.",
                    ],
                },
                {
                    stepNumber: 4,
                    title: "Update Seating Capacities",
                    description: "Adjust room capacity limits to account for physical renovations.",
                    buttonTarget: "Edit Room",
                    details: [
                        "Click 'Edit Room' on any room card.",
                        "Update student seat counts and click 'Update Changes'.",
                    ],
                },
            ],
        },
        {
            id: "schedules",
            title: "Schedules & Timetable Generator",
            route: "/schedules",
            icon: HiCalendar,
            description: "Run the 3-step automated timetable generator and review conflict-free section schedules.",
            roles: ["Academic Head", "School Registrar"],
            features: [
                "Automated section generation (`generateProgramSections`)",
                "Curriculum subject mapping (`assignSubjectsToSections`)",
                "Room and 30-minute time slot allocation with 3D collision checking",
            ],
            steps: [
                {
                    stepNumber: 1,
                    title: "Step 1: Execute Section Generation Engine",
                    description: "Generate student section rosters from program headcounts.",
                    buttonTarget: "1. Generate Sections",
                    details: [
                        "Navigate to the Schedules module.",
                        "Click the '1. Generate Sections' button under the Pipeline Controls header.",
                        "Verify that all enrollment populations have been converted into active section blocks.",
                    ],
                },
                {
                    stepNumber: 2,
                    title: "Step 2: Map Curriculum Subjects to Sections",
                    description: "Attach course offerings to newly projected student sections.",
                    buttonTarget: "2. Map Subjects",
                    details: [
                        "Click the '2. Map Subjects' button.",
                        "Confirm that lecture and laboratory course loads are bound to their respective section rosters.",
                    ],
                },
                {
                    stepNumber: 3,
                    title: "Step 3: Run Full Automated Timetable Generator",
                    description: "Execute the 30-minute slot allocation and 3D collision solver.",
                    buttonTarget: "3. Generate Schedule",
                    details: [
                        "Click the green '3. Generate Schedule' button to launch the background solver.",
                        "Wait for the algorithm to allocate rooms, faculty schedules, and student section time slots.",
                        "Review the post-execution conflict summary dialog to verify 0 hard constraint collisions.",
                    ],
                },
                {
                    stepNumber: 4,
                    title: "Inspect Timetable & Resolve Soft Conflicts",
                    description: "Review Master Grid, Section Views, and Teacher Calendars.",
                    buttonTarget: "Publish Schedule",
                    details: [
                        "Switch views between 'Master Schedule', 'Faculty Calendar', and 'Room Grid'.",
                        "If minor adjustments are needed, drag and drop class blocks manually on the calendar.",
                        "Once verified, click 'Publish Schedule' to release final timetables.",
                    ],
                },
            ],
        },
        {
            id: "teacher_pre-assignments",
            title: "Teacher Pre-assignments",
            route: "/teacher_pre-assignments",
            icon: HiClipboardList,
            description: "Pre-allocate specific teaching loads and preferred schedules before running full timetable generation.",
            roles: ["Academic Head"],
            features: [
                "Template-based teaching load distribution",
                "Locking preferred schedule slots for specific faculty members",
                "Prioritized assignment handling during scheduler execution",
            ],
            steps: [
                {
                    stepNumber: 1,
                    title: "Select Instructor for Priority Assignment",
                    description: "Choose a faculty member with special scheduling arrangements or fixed availability.",
                    buttonTarget: "Teacher Pre-assignments",
                    details: [
                        "Open the Teacher Pre-assignments module from the sidebar menu.",
                        "Select an instructor from the 'Faculty List' side panel.",
                    ],
                },
                {
                    stepNumber: 2,
                    title: "Pin Specific Sections and Courses",
                    description: "Hard-lock specific course assignments to the selected teacher.",
                    buttonTarget: "+ Assign Pre-allocation",
                    details: [
                        "Click '+ Assign Pre-allocation'.",
                        "Select the target Program, Section, and Subject Code.",
                        "Specify preferred day and time block parameters if applicable.",
                        "Toggle 'Hard Lock' to prevent the automated generator from overriding this choice.",
                    ],
                },
                {
                    stepNumber: 3,
                    title: "Review Load Allocations",
                    description: "Verify that pre-assigned loads stay within legal unit boundaries.",
                    buttonTarget: "Validate Pre-load",
                    details: [
                        "Click 'Validate Pre-load' to test assignment compatibility.",
                        "Ensure total locked units do not exceed maximum contract thresholds prior to full generation.",
                    ],
                },
                {
                    stepNumber: 4,
                    title: "Save Pre-assignment Rules",
                    description: "Store pre-allocations into the scheduler database.",
                    buttonTarget: "Save & Lock Pre-assignments",
                    details: [
                        "Click 'Save & Lock Pre-assignments' to ensure these rules take precedence during global timetable generation.",
                    ],
                },
            ],
        },
        {
            id: "booking",
            title: "Facility Bookings",
            route: "/booking",
            icon: HiBookmark,
            description: "Track and manage facility reservation requests for special events, meetings, and makeup classes.",
            roles: ["Academic Assistant", "Academic Head"],
            features: [
                "Calendar-based reservation tracking",
                "Conflict detection against regular class schedules",
                "Approval workflow for facility usage",
            ],
            steps: [
                {
                    stepNumber: 1,
                    title: "Open Booking Calendar View",
                    description: "Examine facility availability across specified dates.",
                    buttonTarget: "Facility Bookings",
                    details: [
                        "Click 'Booking' on the sidebar menu.",
                        "Filter by room or facility type to check open time windows.",
                    ],
                },
                {
                    stepNumber: 2,
                    title: "Submit a Room Reservation Request",
                    description: "Reserve a classroom or laboratory for an ad-hoc event.",
                    buttonTarget: "+ New Booking Request",
                    details: [
                        "Click '+ New Booking Request'.",
                        "Select the desired Room, Event Title, Responsible Organization/Faculty, Date, and Time range.",
                        "Click 'Check Availability' to run automated conflict check against active class schedules.",
                        "Click 'Submit Request' to post the booking request.",
                    ],
                },
                {
                    stepNumber: 3,
                    title: "Review & Approve Pending Reservations",
                    description: "Process pending facility usage applications.",
                    buttonTarget: "Approve Booking / Reject Request",
                    details: [
                        "Navigate to the 'Pending Approvals' tab.",
                        "Review request details, purpose, and potential conflict warnings.",
                        "Click 'Approve Booking' to grant access or 'Reject Request' to deny.",
                    ],
                },
                {
                    stepNumber: 4,
                    title: "Cancel or Reschedule Bookings",
                    description: "Manage existing reservations.",
                    buttonTarget: "Manage Reservations",
                    details: [
                        "Click 'Manage Reservations', select an active booking, and click 'Cancel Booking' to free up the room.",
                    ],
                },
            ],
        },
        {
            id: "configurations",
            title: "System Configurations",
            route: "/configurations",
            icon: HiCog,
            description: "Manage global class settings, institutional break periods, security blacklists, and role permissions.",
            roles: ["Academic Head"],
            features: [
                "Global limits (Max students per section = 50, Max teaching load = 30 units, Max overloads = 9 units)",
                "Institutional Break Periods (Lunch break blockouts)",
                "Role-Based Access Control (RBAC) across 13 system permission keys",
                "User Blacklist security isolation",
            ],
            steps: [
                {
                    stepNumber: 1,
                    title: "Configure Global System Parameters",
                    description: "Set institutional limits across sections and teaching loads.",
                    buttonTarget: "System Parameters Tab",
                    details: [
                        "Navigate to Configurations via the main menu.",
                        "Click the 'System Parameters Tab'.",
                        "Adjust 'Max Students Per Section' (default: 50).",
                        "Adjust 'Max Regular Faculty Workload' (default: 30 units).",
                        "Adjust 'Max Allowed Overload Units' (default: 9 units).",
                        "Click 'Save Parameters' to apply.",
                    ],
                },
                {
                    stepNumber: 2,
                    title: "Set Institutional Break Blocks",
                    description: "Lock global lunch and administrative breaks across all schedules.",
                    buttonTarget: "Institutional Breaks Tab",
                    details: [
                        "Click the 'Institutional Breaks Tab'.",
                        "Click '+ Add Break Window'.",
                        "Define global break hours (e.g., 12:00 PM – 1:00 PM Lunch Break).",
                        "Click 'Enforce Break Period' to prevent scheduling classes during this slot.",
                    ],
                },
                {
                    stepNumber: 3,
                    title: "Manage Role-Based Access Control (RBAC)",
                    description: "Toggle feature permissions for Academic Heads, Registrars, and Assistants.",
                    buttonTarget: "Access Control (RBAC) Tab",
                    details: [
                        "Click the 'Access Control (RBAC) Tab'.",
                        "Review the 13 system permission keys (e.g., can_edit_teachers, can_generate_schedules).",
                        "Check or uncheck permission toggles for specific user roles.",
                        "Click 'Update Permissions' to re-bind authorization levels.",
                    ],
                },
                {
                    stepNumber: 4,
                    title: "Manage User Blacklist & Security Isolation",
                    description: "Restrict access for unauthorized accounts or former staff.",
                    buttonTarget: "User Blacklist Tab",
                    details: [
                        "Click the 'User Blacklist Tab'.",
                        "To block a user, click 'Blacklist Account', type the email address, and select 'Confirm Block'.",
                        "To restore access, click 'Unblock Account' next to the blacklisted record.",
                    ],
                },
            ],
        },
        {
            id: "help",
            title: "Help & Manual Hub",
            route: "/help",
            icon: HiBookOpen,
            description: "Interactive system user manual and documentation center for all ACEHUB modules.",
            roles: ["Academic Head", "School Registrar", "Academic Assistant", "Faculty"],
            features: [
                "Comprehensive navigation-based guides",
                "Real-time keyword search filtering",
                "Step-by-step user operation instructions",
            ],
            steps: [
                {
                    stepNumber: 1,
                    title: "Search for Modules or Workflows",
                    description: "Quickly locate specific operational guidelines.",
                    buttonTarget: "Search Manual Bar",
                    details: [
                        "Focus on the 'Search Manual' bar at the top of the Help page.",
                        "Type keywords such as 'MAQ', 'Overload', 'Blacklist', or 'Generate Schedule'.",
                        "The sidebar list automatically filters to match your search query.",
                    ],
                },
                {
                    stepNumber: 2,
                    title: "Select Module Guide",
                    description: "Browse detailed operational steps for any ACEHUB feature.",
                    buttonTarget: "Module Drawer List",
                    details: [
                        "Click on any module tab in the left drawer panel.",
                        "Examine the authorized user roles to confirm permissions.",
                        "Review key features and follow the step-by-step instructions with highlighted button targets.",
                    ],
                },
            ],
        },
    ];

    const filteredModules = modules.filter(
        (mod) =>
            mod.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            mod.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            mod.features.some((f) => f.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const currentModule = modules.find((m) => m.id === activeTab) || modules[0];
    const CurrentIcon = currentModule.icon;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-6">
            {/* Header Banner */}
            <div className="mb-8 p-6 bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl shadow-lg text-white">
                <div className="flex items-center gap-3 mb-2">
                    <HiOutlineDesktopComputer className="w-8 h-8 text-blue-200" />
                    <h1 className="text-3xl font-bold">AceHub Help Guide</h1>
                </div>
                <p className="text-blue-100 text-sm max-w-3xl">
                    Select any system page from the sidebar navigation below to view its primary functions, authorized user roles, key features, and granular step-by-step instructions with exact guides on button click targets.
                </p>

                {/* Live Search Bar */}
                <div className="relative mt-6 max-w-xl">
                    <HiSearch className="absolute left-3 top-3.5 w-5 h-5 text-gray-300 dark:text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search modules, features, permissions, scheduler tasks..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder-blue-200 dark:placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm"
                    />
                </div>
            </div>

            {/* Main Container Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Navigation Sidebar Drawer */}
                <div className="space-y-2 lg:col-span-1">
                    <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                        System Modules
                    </h3>
                    {filteredModules.map((mod) => {
                        const Icon = mod.icon;
                        const isActive = activeTab === mod.id;
                        return (
                            <button
                                key={mod.id}
                                onClick={() => setActiveTab(mod.id)}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                                    isActive
                                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
                                }`}
                            >
                                <div className="flex items-center gap-3 truncate">
                                    <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-white" : "text-blue-600 dark:text-blue-400"}`} />
                                    <span className="truncate">{mod.title}</span>
                                </div>
                                <HiChevronRight className={`w-4 h-4 flex-shrink-0 ${isActive ? "opacity-100" : "opacity-40"}`} />
                            </button>
                        );
                    })}
                </div>

                {/* Content Area */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
                        {/* Title & Route Badge */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="px-2.5 py-1 text-xs font-mono font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded-lg">
                                        Route: {currentModule.route}
                                    </span>
                                </div>
                                <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                                    <CurrentIcon className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                                    {currentModule.title}
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{currentModule.description}</p>
                            </div>
                        </div>

                        <hr className="border-gray-200 dark:border-gray-700" />

                        {/* Authorized Roles */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-2">
                                Authorized User Roles
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {currentModule.roles.map((role, idx) => (
                                    <span
                                        key={idx}
                                        className="px-3 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-full text-xs font-medium"
                                    >
                                        {role}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Key Features */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-2">
                                Key Features & Capabilities
                            </h3>
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {currentModule.features.map((feature, idx) => (
                                    <li
                                        key={idx}
                                        className="p-3 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2"
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 flex-shrink-0"></span>
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <hr className="border-gray-200 dark:border-gray-700" />

                        {/* Detailed Step-by-Step Operation Guide */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-4">
                                Granular Step-by-Step Operation Guide
                            </h3>
                            <div className="space-y-6">
                                {currentModule.steps.map((step) => (
                                    <div
                                        key={step.stepNumber}
                                        className="p-5 bg-blue-50/40 dark:bg-gray-750/50 rounded-2xl border border-blue-100 dark:border-gray-700 space-y-3"
                                    >
                                        <div className="flex items-center justify-between gap-4 flex-wrap">
                                            <div className="flex items-center gap-3">
                                                <span className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full text-sm font-bold flex-shrink-0 shadow-sm">
                                                    {step.stepNumber}
                                                </span>
                                                <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-base">
                                                    {step.title}
                                                </h4>
                                            </div>

                                            {/* Actionable Button UI Indicator Badge */}
                                            {step.buttonTarget && (
                                                <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-gray-600 shadow-xs">
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Press UI Button:</span>
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-600 text-white shadow-xs">
                                                        [{step.buttonTarget}]
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-sm text-gray-600 dark:text-gray-300 pl-11">{step.description}</p>

                                        {/* Sub-steps & Detailed List */}
                                        <ul className="pl-11 space-y-2">
                                            {step.details.map((detail, dIdx) => (
                                                <li key={dIdx} className="text-xs text-gray-600 dark:text-gray-300 flex items-start gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></span>
                                                    <span>{detail}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}