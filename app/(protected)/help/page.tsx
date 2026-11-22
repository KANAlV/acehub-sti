"use client";

import React, { useState, useRef, useEffect } from "react";
import { fetchUserRole } from "@/app/actions/user";
import { Spinner } from "flowbite-react";
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
    HiX,
    HiDocumentReport,
    HiFolderOpen,
} from "react-icons/hi";

interface DetailedStep {
    stepNumber: number;
    title: string;
    description: string;
    details: string[];
}

interface SubTabGuide {
    tabId: string;
    tabName: string;
    summary: string;
    steps: DetailedStep[];
}

interface ModuleGuide {
    id: string;
    title: string;
    route: string;
    icon: React.ElementType;
    description: string;
    roles: string[];
    features: string[];
    tabs?: SubTabGuide[];
    steps?: DetailedStep[];
}

interface UserPermissions {
    booking: boolean;
    personal_schedule: boolean;
    academic_qualification: boolean;
    schedules: boolean;
    courses: boolean;
    rooms: boolean;
    subjects: boolean;
    teachers: boolean;
    maq: boolean;
    fcce: boolean;
    help: boolean;
    config: boolean;
    superuser: boolean;
}

export default function HelpPage() {
    const [activeModuleId, setActiveModuleId] = useState<string>("");
    const [activeSubTabId, setActiveSubTabId] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [debouncedSearch, setDebouncedSearch] = useState<string>("");
    const contentScrollRef = useRef<HTMLDivElement>(null);
    const [permissions, setPermissions] = useState<UserPermissions | null>(null);
    const [roleName, setRoleName] = useState<string>("");
    const [isLoading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchRole() {
            const res = await fetchUserRole("");
            if (res.success && res.data) {
                const perms = {
                    booking: Boolean(res.data.booking),
                    personal_schedule: Boolean(res.data.personal_schedule),
                    academic_qualification: Boolean(res.data.academic_qualification),
                    schedules: Boolean(res.data.schedules),
                    courses: Boolean(res.data.courses),
                    rooms: Boolean(res.data.rooms),
                    subjects: Boolean(res.data.subjects),
                    teachers: Boolean(res.data.teachers),
                    maq: Boolean(res.data.maq),
                    fcce: Boolean(res.data.fcce),
                    help: Boolean(res.data.help),
                    config: Boolean(res.data.config),
                    superuser: Boolean(res.data.superuser),
                };
                setPermissions(perms);
                const rawRole = (res.data as { role_name?: string }).role_name ?? "";
                setRoleName(rawRole);
                // Determine default module based on role
                const defaultModule = getDefaultModuleForRole(perms, rawRole);
                setActiveModuleId(defaultModule);
            }
            setLoading(false);
        }
        void fetchRole();
    }, []);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 1500);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    // Map each permission key to the module IDs that require it
    const permissionToModules: Record<keyof UserPermissions, string[]> = {
        booking: ["room_reservation"],
        personal_schedule: ["personal_info"],
        academic_qualification: ["teachers"],
        schedules: ["schedules", "teacher_pre-assignments"],
        courses: ["courses"],
        rooms: ["rooms"],
        subjects: ["subjects"],
        teachers: ["teachers"],
        maq: ["maq"],
        fcce: ["fcce"],
        help: ["help"],
        config: ["configurations"],
        superuser: ["configurations"],
    };

    // Determine which modules the current user can access based on permissions
    function getAccessibleModuleIds(perms: UserPermissions): string[] {
        const accessible = new Set<string>();
        // Always show Getting Started for users with config access
        if (perms.config || perms.superuser) {
            accessible.add("getting_started");
        }
        // Dashboard is shown to users with schedules or personal_schedule
        if (perms.schedules || perms.personal_schedule) {
            accessible.add("dashboard");
        }
        // Map permissions to modules
        for (const [perm, moduleIds] of Object.entries(permissionToModules)) {
            if (perms[perm as keyof UserPermissions]) {
                moduleIds.forEach((id) => accessible.add(id));
            }
        }
        return [...accessible];
    }

    // Get the default module for a role based on permissions
    function getDefaultModuleForRole(perms: UserPermissions, rawRole: string): string {
        const accessible = getAccessibleModuleIds(perms);
        const roleLower = rawRole.toLowerCase();

        // Academic Head / Superuser — start with Getting Started
        if ((roleLower.includes("academic") || roleLower.includes("super")) && perms.config) {
            return "getting_started";
        }
        // Teacher with personal_schedule — start with their personal schedule
        if (perms.personal_schedule && accessible.includes("personal_info")) {
            return "personal_info";
        }
        // School Registrar — start with Courses
        if (roleLower.includes("registrar") && perms.courses) {
            return "courses";
        }
        // Academic Assistant — start with Room Reservation if available
        if (roleLower.includes("assistant") && perms.booking) {
            return "room_reservation";
        }
        // Fallback: first accessible module
        if (accessible.length > 0) {
            return accessible[0];
        }
        return "help";
    }

    // Build role description for the welcome banner
    function getRoleDescription(perms: UserPermissions, rawRole: string): string {
        const roleLower = rawRole.toLowerCase();
        if (roleLower.includes("academic") || roleLower.includes("super")) {
            return "You have full access to all system modules — configure settings, manage faculty, generate schedules, and monitor evaluations.";
        }
        if (roleLower.includes("registrar")) {
            return "You can manage courses and programs, view the dashboard, and access help documentation.";
        }
        if (roleLower.includes("assistant")) {
            return "You can reserve rooms for special events and access help documentation.";
        }
        if (perms.personal_schedule) {
            return "You can view your personal teaching schedule, manage your availability and preferences, and access help documentation.";
        }
        return "Browse the available modules below to learn how to use AceHub.";
    }

    const accessibleModuleIds = permissions ? getAccessibleModuleIds(permissions) : [];
    const modules: ModuleGuide[] = [
        {
            id: "getting_started",
            title: "Getting Started — First-Time Setup",
            route: "/configurations",
            icon: HiCog,
            description:
                "Follow this step-by-step guide to configure AceHub for the first time. The system must be set up in the correct order — each step builds on the previous one so the scheduler has all the data it needs.",
            roles: ["Academic Head"],
            features: [
                "Ordered configuration workflow: Config → Rooms → Courses → MAQ (Matrix of Academic Qualifications) → Subjects → Teachers",
                "Each step links to its corresponding module guide for detailed instructions",
                "Requirements explained so you understand why the order matters",
                "Quick checklist to verify your system is ready for schedule generation",
            ],
            steps: [
                {
                    stepNumber: 1,
                    title: "Step 1 — Configurations: Set System-Wide Rules",
                    description:
                        "Before adding any rooms, courses, or teachers, configure the foundational rules that govern how the scheduler works.",
                    details: [
                        "Navigate to Configurations from the sidebar — this is the first and most important setup step.",
                        "Class Settings: Set 'Max Students per Section' (1–50). This determines how many sections the scheduler creates when splitting program cohorts.",
                        "Faculty Load: Define maximum teaching units for each employment type — Full-Time (FT), Part-Time Full Load (PTFL), and Part-Time (PT). These limits control how many units the scheduler can assign to each teacher. Note: FT = Full-Time, PTFL = Part-Time Full Load, PT = Part-Time.",
                        "Prep Limits: Set the maximum number of unique subjects each employment type can teach (1–10). This prevents overloading teachers with too many different courses.",
                        "Overloading Parameters: Set the maximum units above the load limit (0–10) that a teacher can be overloaded. This gives the scheduler flexibility when teacher pool is limited.",
                        "Break Periods: Add lunch breaks, assembly times, or other recurring unavailable time slots by day of the week. The scheduler will avoid placing classes during these windows.",
                        "Departments: Register all academic departments (e.g., CS Dept., Business Dept.) so teachers can be assigned to the correct division.",
                        "Room Types: Define facility classifications (e.g., Lecture Room, Computer Lab, Multimedia Lab). These types determine which rooms can host which subjects — lab subjects require matching lab room types.",
                        "After completing these settings, proceed to Step 2. Without proper configurations, the remaining steps will not work correctly.",
                    ],
                },
                {
                    stepNumber: 2,
                    title: "Step 2 — Rooms: Register Classrooms & Laboratories",
                    description:
                        "Add all physical classrooms and laboratories that the scheduler can assign classes to.",
                    details: [
                        "Navigate to Rooms from the sidebar.",
                        "Click '+ Add Room' to register each classroom or laboratory.",
                        "Enter the Room Name (e.g., 'Lab 301', 'Room A-101'), select the Room Type from the dropdown (the types you configured in Step 1), and select the Floor Level (Floor 1–10).",
                        "Floor level matters for transit-aware scheduling — rooms on the same floor are preferred for back-to-back classes to minimize teacher travel time.",
                        "Add all available rooms before proceeding. The scheduler needs a complete pool of rooms to work with.",
                        "You can also bulk-import rooms via Excel if you have a large facility inventory.",
                        "Tip: Ensure your lab room types match the lab requirements you will define in your Subjects (Step 4). A 'Computer Lab' subject needs a room with the 'Computer Lab' type.",
                    ],
                },
                {
                    stepNumber: 3,
                    title: "Step 3 — Courses: Define Programs & Student Counts",
                    description:
                        "Register all academic programs (SHS strands and Tertiary degree programs) and input student enrollment counts.",
                    details: [
                        "Navigate to Courses from the sidebar. There are two sub-modules: SHS Courses and Tertiary Courses.",
                        "SHS Courses: Add each Senior High School strand (e.g., STEM, ABM, HUMSS) with student counts for Grade 11 and Grade 12. The scheduler uses these counts along with your Max Students per Section setting to determine how many sections to create.",
                        "Tertiary Courses: Add each college degree program (e.g., BSIT, BSCS, BSHM) with student counts for 1st Year through 4th Year.",
                        "Student counts are critical — the scheduler divides total students by Max Students per Section to calculate the number of sections. Inaccurate counts will result in too few or too many sections.",
                        "After adding all programs and verifying student counts, proceed to Step 4.",
                    ],
                },
                {
                    stepNumber: 4,
                    title: "Step 4 — MAQ (Matrix of Academic Qualifications): Define Academic Qualifications",
                    description:
                        "Create the master list of Academic Qualification (AQ) codes that will be used to match teachers to subjects.",
                    details: [
                        "Navigate to MAQ (Matrix of Academic Qualifications) from the sidebar.",
                        "Switch to the 'Matrix of Academic Qualifications' tab.",
                        "Click '+ Add Qualification' to register each AQ (Academic Qualification) code (e.g., BSCS, BSIT, MIT, BA English). These are the degree or certification codes that qualify teachers to teach specific subjects.",
                        "Add all AQ codes that your faculty hold or may hold. You can also organize related AQs into MAQ Clusters for easier auditing.",
                        "Why this comes before Subjects: Each subject will require one or more AQ codes. The scheduler only assigns teachers who hold the required AQ for a subject. Define your AQs first so they are available when you configure subjects.",
                        "After adding all AQ codes, proceed to Step 5.",
                    ],
                },
                {
                    stepNumber: 5,
                    title: "Step 5 — Subjects: Add Curriculum & Link AQ (Academic Qualification) Requirements",
                    description:
                        "Register all courses offered by your institution and specify which academic qualifications are required to teach each one.",
                    details: [
                        "Navigate to Subjects from the sidebar.",
                        "In the 'Subject Management' tab, add each subject with its Course Code, Course Name, Program, Year/Term, Lecture Units, and Lab Units.",
                        "If a subject has laboratory components, specify Lab Units and select the required Lab Type (must match a Room Type from Step 1).",
                        "You can bulk-import subjects via Excel template if you have a large curriculum catalog — download the template, fill in the columns, and upload.",
                        "Switch to the 'Subject AQ' tab and assign the required Academic Qualification (AQ) codes to each subject. For example, 'Object-Oriented Programming' might require BSCS or BSIT AQ.",
                        "This is critical: without AQ requirements assigned, the scheduler cannot determine which teachers are qualified for which subjects.",
                        "You can also export the subject catalog to Excel for backup or review.",
                        "After completing all subjects and their AQ mappings, proceed to Step 6.",
                    ],
                },
                {
                    stepNumber: 6,
                    title: "Step 6 — Teachers: Register Faculty & Assign Qualifications",
                    description:
                        "Add all faculty members, assign their academic qualifications, and manage FCCE (Faculty Class & Course Evaluation) records.",
                    details: [
                        "Navigate to Teachers from the sidebar.",
                        "In the Faculty Directory, click '+ Add Teacher' to register each faculty member with their PSCS (Personal Standard Classification System) ID, full name, email, department, and employment type (FT, PTFL, PT, or Proby).",
                        "You can bulk-import teachers via Excel template — download the template, fill in the columns, and upload.",
                        "Teacher AQ: Click on each teacher to open their AQ (Academic Qualification) Inspector Panel, then click '+ Add AQ' to assign their academic qualifications (the AQ codes you created in Step 4). Set the status to Approved for verified credentials.",
                        "The scheduler uses these AQ assignments to determine which teachers can teach which subjects. A teacher without any AQ assigned will not be considered for subject assignments.",
                        "FCCE: Manage Faculty Class & Course Evaluation (FCCE) records. Create terms, add evaluation records, and track teacher performance evaluations.",
                        "After all teachers are registered with their AQs, your system is ready for the next phase.",
                    ],
                },
                {
                    stepNumber: 7,
                    title: "Step 7 — Optional: Set Teacher Pre-assignments",
                    description:
                        "Lock specific teachers to specific subjects and sections before running the scheduler.",
                    details: [
                        "Navigate to Teacher Pre-assignments from the sidebar or via the Teachers page.",
                        "Pre-assignments are optional but recommended if you have specific teacher-to-subject preferences that must be honored.",
                        "Select a teacher, choose the Program, Section, and Subject Code, and click 'Add Assignment' to lock the binding.",
                        "The scheduler will prioritize these pre-assigned bindings during schedule generation.",
                        "You can also bulk-import pre-assignments via Excel template.",
                        "If you skip this step, the scheduler will assign teachers freely based on AQ matching and load balancing.",
                    ],
                },
                {
                    stepNumber: 8,
                    title: "Step 8 — Generate Your Schedule",
                    description:
                        "With all requirements set up, run the timetable generator to create your class schedule.",
                    details: [
                        "Navigate to Schedules from the sidebar.",
                        "Review your configured data: Courses (with student counts), Subjects (with AQ requirements), Teachers (with AQ assignments), Rooms (with types), and Configurations (load limits, break periods).",
                        "Click the schedule generation button to start the engine. The scheduler will create sections based on student counts, map subjects to qualified teachers, and assign rooms and time slots.",
                        "After generation, review the Schedule Summary: check for unassigned entries, teacher overloads, and room conflicts.",
                        "Use the interactive timetable to make manual adjustments — drag and drop entries to fix any issues.",
                        "Once satisfied, set the schedule as active so it appears on the Dashboard.",
                        "Export the schedule to Excel for distribution to faculty and students.",
                    ],
                },
                {
                    stepNumber: 9,
                    title: "Verification Checklist",
                    description:
                        "Before generating your first schedule, verify that all the following are configured.",
                    details: [
                        "✓ Configurations: Max students per section, faculty load limits, prep limits, overload parameters, break periods, departments, and room types are all set.",
                        "✓ Rooms: At least one room of each required type is registered with a floor level.",
                        "✓ Courses: All SHS strands and/or Tertiary programs are registered with accurate student counts.",
                        "✓ MAQ (Matrix of Academic Qualifications): All Academic Qualification codes used by your faculty are registered.",
                        "✓ Subjects: All courses are registered with lecture/lab units, and each subject has at least one required AQ (Academic Qualification) assigned.",
                        "✓ Teachers: All faculty are registered with employment type, and each teacher has at least one approved AQ assigned.",
                        "✓ (Optional) Pre-assignments: Any locked teacher-to-subject bindings are saved in a template.",
                        "If all items are checked, proceed to Schedules to generate your timetable. If any item is missing, the scheduler may produce incomplete or incorrect results.",
                    ],
                },
            ],
        },
        {
            id: "dashboard",
            title: "Dashboard & Analytics",
            route: "/dashboard",
            icon: HiChartPie,
            description:
                "Central overview of the active master schedule, displaying entry counts, active teachers, subject totals, and individual faculty workload capacities.",
            roles: ["Academic Head", "Teacher"],
            features: [
                "KPI (Key Performance Indicator) stat cards for Total Entries, Active Teachers, Subjects, and Total Units",
                "Teacher Workload Summary bar tracking Active, Overloaded, and Average Usage",
                "Color-coded teacher capacity badges (Available, Moderate, Near Capacity, At Max, Overloaded)",
                "Quick navigation to Edit Timetable or inspect individual teacher load profiles",
            ],
            steps: [
                {
                    stepNumber: 1,
                    title: "Verify Active Master Schedule Banner",
                    description: "Check which schedule configuration is currently set as the active dashboard display.",
                    details: [
                        "Review the schedule title and generation description at the top banner — this tells you which timetable is currently published.",
                        "If no schedule is displayed yet, you will see a prompt to create or activate a schedule. Click 'Go to Schedules' to navigate to the Schedules module.",
                        "Only one schedule can be set as the active dashboard display at a time — the Academic Head controls this setting from the Schedule Summary page.",
                    ],
                },
                {
                    stepNumber: 2,
                    title: "Review Top-Level KPI (Key Performance Indicator) Cards",
                    description: "Inspect the four summary counters directly below the header for a quick system health check.",
                    details: [
                        "Total Entries: Shows the total number of scheduled class sessions across all sections and days. Compare this against expected curriculum hours.",
                        "Active Teachers: Displays the count of faculty members who have at least one class assigned in the current schedule.",
                        "Subjects: Shows the number of unique course codes scheduled in the active timetable.",
                        "Total Units: Represents the sum of all teaching hours assigned across the entire schedule — use this to verify overall institutional workload.",
                    ],
                },
                {
                    stepNumber: 3,
                    title: "Audit Teacher Workload Summary",
                    description: "Monitor department-wide teaching load health in the blue summary panel.",
                    details: [
                        "The Active count shows how many teachers currently have assigned units in the schedule.",
                        "The Overloaded counter highlights faculty who exceed their standard employment unit limit — investigate these cases to rebalance assignments.",
                        "Avg Usage displays the average percentage of teaching capacity used across all faculty — a healthy range is typically 70–90%.",
                        "If Overloaded is high, consider redistributing subjects or adjusting Faculty Load limits in Configurations.",
                    ],
                },
                {
                    stepNumber: 4,
                    title: "Inspect Individual Teacher Cards & Timetable",
                    description: "Drill down into specific faculty assignments or open the full timetable grid.",
                    details: [
                        "Each Teacher Card shows the instructor's name, assigned subjects, current units, remaining available units, and subject prep limit.",
                        "The capacity badge on each card is color-coded: green (Available), blue (Moderate), yellow (Near Capacity), orange (At Max), red (Overloaded).",
                        "Click any Teacher Card to expand and view their detailed workload breakdown.",
                        "Click 'View All Teachers' at the end of the grid to open the complete faculty roster with sortable columns.",
                        "Click 'Edit Timetable' (or 'View Timetable' depending on your role permissions) in the top-right header to open the full interactive schedule grid where you can drag-and-drop class entries.",
                    ],
                },
                {
                    stepNumber: 5,
                    title: "Navigate from Dashboard to Related Modules",
                    description: "Use the Dashboard as a launchpad to access other system modules for deeper inspection.",
                    details: [
                        "Click 'Go to Schedules' to manage schedule generation, activation, and export.",
                        "Click 'View All Teachers' to access the Teachers module for faculty directory and AQ (Academic Qualification) management.",
                        "Use the left sidebar to navigate directly to any module — the Dashboard provides a high-level overview, while individual modules offer detailed CRUD (Create, Read, Update, Delete) operations.",
                        "If you notice differences in KPI (Key Performance Indicator) numbers, check the corresponding module (e.g., Subjects for course count issues, Teachers for faculty count issues).",
                    ],
                },
            ],
        },
        {
            id: "personal_info",
            title: "Personal Info & Schedule",
            route: "/user",
            icon: HiUserGroup,
            description:
                "View your personal teaching schedule, monitor your unit load and workload capacity, and configure your scheduling preferences for rooms, times, years, and subjects.",
            roles: ["Teacher", "Academic Head"],
            features: [
                "Personal schedule overview showing all assigned class entries from the active master schedule",
                "Units analysis with current units, max units, remaining capacity, and load status badge",
                "Preparation usage tracking showing unique subjects taught against your prep limit",
                "Teacher preferences management for preferred rooms, times, year levels, and subjects",
                "Preference collision detection to prevent scheduling conflicts with existing class entries",
                "Direct link to the full timetable view for broader schedule inspection",
            ],
            steps: [
                {
                    stepNumber: 1,
                    title: "Open Your Personal Info Page",
                    description: "Access your individual teaching dashboard from the sidebar.",
                    details: [
                        "Click 'Personal Info' in the left navigation sidebar.",
                        "The page loads your profile data, current schedule entries, and workload metrics based on your logged-in account.",
                        "If no active schedule is set, you will see a notice prompting you to contact the Academic Head to activate a master schedule.",
                    ],
                },
                {
                    stepNumber: 2,
                    title: "Review Your Personal Schedule Entries",
                    description: "Inspect your assigned classes organized by day of the week.",
                    details: [
                        "The schedule table displays each class entry with the Day, Subject Name, Start Time, End Time, Room, Section, Units, and Course Code.",
                        "Times are displayed in 12-hour format (e.g., 7:00 AM – 8:30 AM) for easy reading.",
                        "Each row represents one scheduled class session from the active master timetable.",
                        "Click the 'View Timetable' link to open the full interactive timetable grid for a visual calendar view of your schedule.",
                    ],
                },
                {
                    stepNumber: 3,
                    title: "Monitor Your Units & Workload Analysis",
                    description: "Track your teaching load against your employment-type limits.",
                    details: [
                        "The Units Analysis card shows your Current Units (total hours currently assigned), Max Units (standard limit for your employment type), and Remaining Units (capacity left).",
                        "The Absolute Max field includes any approved overload units above your standard limit.",
                        "Your Load Status badge indicates whether you are Available, Moderate, Near Capacity, At Max, or Overloaded — color-coded for quick assessment.",
                        "Unique Subjects shows how many different courses you are teaching, and Prep Usage displays the percentage of your subject preparation limit that is used.",
                        "Usage Rate shows the overall percentage of your teaching capacity that is currently assigned.",
                    ],
                },
                {
                    stepNumber: 4,
                    title: "Set Your Scheduling Preferences",
                    description: "Configure your preferred rooms, time slots, year levels, and subjects to guide the scheduler.",
                    details: [
                        "Click 'Set Preferences' to open the Preferences modal with four tabs: Rooms, Times, Years, and Subjects.",
                        "In the Rooms tab, search for and add your preferred classroom or laboratory names — these rooms will be prioritized during schedule generation.",
                        "In the Times tab, select a Day of the Week, Start Time, and End Time to define preferred teaching windows. The system checks for collisions with your existing schedule entries and prevents overlapping time ranges.",
                        "In the Years tab, toggle your preferred year levels (e.g., 1st Year, 2nd Year, Grade 11) — the scheduler will favor assigning you to sections in these tiers.",
                        "In the Subjects tab, search for and add your preferred course names — the scheduler will prioritize these subject assignments.",
                        "Click 'Save Preferences' to commit your changes. A success message confirms the update.",
                    ],
                },
                {
                    stepNumber: 5,
                    title: "Remove or Modify Preferences",
                    description: "Update your scheduling preferences as your availability or teaching focus changes.",
                    details: [
                        "Reopen the Preferences modal and navigate to the relevant tab.",
                        "Click the red 'X' or remove button next to any preference tag to delete it.",
                        "For preferred times, remove individual time ranges to free up your availability window.",
                        "For preferred years, toggle the year off to remove it from your preferences.",
                        "After making changes, click 'Save Preferences' to update your profile.",
                    ],
                },
            ],
        },
        {
            id: "courses",
            title: "Courses & Programs",
            route: "/courses",
            icon: HiAcademicCap,
            description:
                "Manage Senior High School (SHS) strands and Tertiary college degree programs along with student population counts per grade or year level.",
            roles: ["School Registrar", "Academic Head"],
            features: [
                "Dedicated sub-modules for SHS Strands (/courses/shs) and Tertiary Programs (/courses/tertiary)",
                "Per-level student headcount input (up to 1,000 students per grade/year level)",
                "Automatic total student calculation and searchable, sortable program tables",
                "Direct input feeds into the section generator during schedule creation",
            ],
            tabs: [
                {
                    tabId: "courses-shs",
                    tabName: "SHS (Senior High School) Strands (/courses/shs)",
                    summary:
                        "Configure Senior High School (SHS) academic strands (e.g., STEM, ABM, HUMSS) and input student enrollment counts for Grade 11 and Grade 12.",
                    steps: [
                        {
                            stepNumber: 1,
                            title: "Open SHS (Senior High School) Strands Management",
                            description: "Access the Senior High School strand registry from the Courses menu.",
                            details: [
                                "Expand 'Courses' in the left navigation sidebar and select 'SHS Courses'.",
                                "Use the search bar to filter existing strands by Strand Code or Strand Name, or click column headers to sort.",
                            ],
                        },
                        {
                            stepNumber: 2,
                            title: "Add a New SHS (Senior High School) Strand",
                            description: "Register a new strand code, full name, and batch headcounts.",
                            details: [
                                "Click '+ Add Strand' at the top-right corner of the page.",
                                "Enter the Strand Code (up to 13 characters, e.g., STEM) and Strand Name (up to 100 characters).",
                                "Input the student counts for Grade 11 Students and Grade 12 Students (0 to 1,000 per grade).",
                                "Click 'Save' to record the strand into the database.",
                            ],
                        },
                        {
                            stepNumber: 3,
                            title: "Edit Student Counts or Remove a Strand",
                            description: "Update batch enrollment figures before running schedule generation.",
                            details: [
                                "Click 'Edit' on the right side of any strand row.",
                                "Adjust the Strand Name or Grade 11 / Grade 12 student counts and click 'Save'.",
                                "To permanently delete a strand, click the red trash icon inside the Edit modal and confirm deletion.",
                            ],
                        },
                    ],
                },
                {
                    tabId: "courses-tertiary",
                    tabName: "Tertiary Programs (/courses/tertiary)",
                    summary:
                        "Manage college degree programs (e.g., BSIT, BSCPE, BSHM) and maintain student headcounts across 1st Year through 4th Year.",
                    steps: [
                        {
                            stepNumber: 1,
                            title: "Open College Programs Management",
                            description: "Access the Tertiary degree program registry from the Courses menu.",
                            details: [
                                "Expand 'Courses' in the left navigation sidebar and select 'Tertiary Courses'.",
                                "Search by Program Code or Program Name, or sort columns ascending/descending.",
                            ],
                        },
                        {
                            stepNumber: 2,
                            title: "Register a New College Program",
                            description: "Create a tertiary program entry with 1st to 4th year student counts.",
                            details: [
                                "Click '+ Add Program' in the upper-right toolbar.",
                                "Enter the Program Code (up to 13 characters, e.g., BSIT) and full Program Name (up to 100 characters).",
                                "Enter enrolled student counts for 1st Year, 2nd Year, 3rd Year, and 4th Year (max 1,000 per year).",
                                "Click 'Save' to add the program.",
                            ],
                        },
                        {
                            stepNumber: 3,
                            title: "Update Year-Level Distributions",
                            description: "Keep student counts updated so section splits remain accurate.",
                            details: [
                                "Click 'Edit' on any program row to open the Edit College Program modal.",
                                "Modify the student population numbers per year level and click 'Save' (button enables once changes are detected).",
                                "Use the red delete button in the modal footer if a program needs to be removed.",
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "subjects",
            title: "Subjects & Subject AQ",
            route: "/subjects",
            icon: HiCollection,
            description:
                "Manage institutional course catalogs, lecture/laboratory unit allocations, required room types, Excel bulk operations, and Subject Academic Qualifications.",
            roles: ["Academic Head"],
            features: [
                "Two dedicated workspace tabs: Subject Management and Subject AQ (Academic Qualification)",
                "Lecture and Laboratory unit breakdowns with required Lab Room Type mapping",
                "Excel (.xlsx / .csv) template download, bulk subject import, and catalog export",
                "Subject-to-AQ mapping to enforce qualified teacher assignments during scheduling",
                "Note: AQ = Academic Qualification",
            ],
            tabs: [
                {
                    tabId: "subject-management",
                    tabName: "Subject Management Tab",
                    summary:
                        "Create, edit, search, and bulk-import curriculum subjects with lecture/lab units, year/term tags, and facility requirements.",
                    steps: [
                        {
                            stepNumber: 1,
                            title: "Browse & Filter the Subject Catalog",
                            description: "Locate subjects across programs and academic terms.",
                            details: [
                                "Ensure the 'Subject Management' tab is active at the top of the Subjects page.",
                                "Filter by Program or Year/Term, or type a Course Code or Course Name into the search bar.",
                            ],
                        },
                        {
                            stepNumber: 2,
                            title: "Add or Edit an Individual Subject",
                            description: "Define credit units and required room classifications.",
                            details: [
                                "Click '+ Add Subject' to open the subject creation modal.",
                                "Enter the Course Code, Course Name, Program Code, and Year/Term (e.g., Grade 11 or 1st Year - Term 1).",
                                "Specify Lecture Units and Lab Units, and select the required Lab Type if laboratory hours are included.",
                                "Click 'Save' to store the subject, or click 'Edit' on an existing row to modify its details.",
                            ],
                        },
                        {
                            stepNumber: 3,
                            title: "Bulk Import Subjects via Excel",
                            description: "Upload multiple curriculum subjects at once using a formatted Excel spreadsheet.",
                            details: [
                                "Click the Excel / Bulk Import button on the toolbar and download the official Subject Excel Template.",
                                "Fill in each row in Excel with exact Program Codes, Course Codes, Course Names, Lecture Units, Lab Units, Lab Types, and Year/Term labels—do not rename header columns.",
                                "Upload the saved .xlsx file in the import dialog and review the row-by-row validation preview.",
                                "Fix any flagged formatting or duplicate code warnings, then confirm to commit all valid subjects to the database.",
                            ],
                        },
                        {
                            stepNumber: 4,
                            title: "Export Subject List to Excel",
                            description: "Download a spreadsheet copy of the current curriculum catalog.",
                            details: [
                                "Apply any desired program or term filters first.",
                                "Click the Export button to generate and download an Excel workbook of the filtered subjects.",
                            ],
                        },
                    ],
                },
                {
                    tabId: "subject-aq",
                    tabName: "Subject AQ (Academic Qualification) Tab",
                    summary:
                        "Link Minimum Academic Qualification (MAQ) codes to specific subjects so the scheduler only assigns qualified instructors. Note: MAQ = Matrix of Academic Qualifications, AQ = Academic Qualification.",
                    steps: [
                        {
                            stepNumber: 1,
                            title: "Switch to Subject AQ Tab",
                            description: "Open the subject qualification requirement mapping interface.",
                            details: [
                                "Click the 'Subject AQ' tab next to 'Subject Management'.",
                                "Search for a subject by Course Code or Course Name to inspect its current required AQs (Academic Qualifications).",
                            ],
                        },
                        {
                            stepNumber: 2,
                            title: "Assign Required AQs to a Subject",
                            description: "Specify which academic credentials qualify a teacher to handle the course.",
                            details: [
                                "Select a subject row to open its qualification assignment panel or modal.",
                                "Choose one or more valid Academic Qualification (AQ) codes from the available MAQ (Matrix of Academic Qualifications) list.",
                                "Save the mapping so the schedule generator and pre-assignment validator recognize these requirements.",
                            ],
                        },
                        {
                            stepNumber: 3,
                            title: "Remove Outdated AQ (Academic Qualification) Requirements",
                            description: "Update qualification rules when curriculum standards change.",
                            details: [
                                "Open the target subject's assigned AQs (Academic Qualifications) and remove any qualification tag that is no longer required.",
                                "Confirm the update to immediately reflect the revised eligibility criteria.",
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "teachers",
            title: "Teachers & Faculty Management",
            route: "/teachers",
            icon: HiUserGroup,
            description:
                "Maintain the faculty directory, manage employment classifications, import teacher rosters via Excel, and review or approve Teacher Academic Qualifications (AQs) with fully detailed verification workflows.",
            roles: ["Academic Head"],
            features: [
                "Faculty directory with search, sorting, and Employment Status filtering (FT, PTFL, PT, Proby)",
                "Excel (.xlsx) bulk teacher import and roster export workflows with strict PSCS ID validation",
                "Teacher AQ Inspector Panel with Approved, Pending/Requested, and Denied approval workflows",
                "Credential verification and direct links to Teacher Pre-assignments templates",
                "Note: FT = Full-Time, PTFL = Part-Time Full Load, PT = Part-Time, PSCS = Personal Standard Classification System, AQ = Academic Qualification",
            ],
            tabs: [
                {
                    tabId: "teachers-directory",
                    tabName: "Faculty Directory & Excel Operations",
                    summary:
                        "Add, update, filter, and bulk-import instructor profiles and employment types into the institutional registry.",
                    steps: [
                        {
                            stepNumber: 1,
                            title: "Search & Filter Faculty Profiles",
                            description: "Locate instructors across departments and employment classifications.",
                            details: [
                                "Open the Teachers module from the sidebar.",
                                "Type a Name, Teacher Code / PSCS (Personal Standard Classification System) ID, or Email into the search input.",
                                "Filter by Employment Status (Full-Time, Part-Time Full Load, Part-Time, or Probationary) and click column headers to sort.",
                            ],
                        },
                        {
                            stepNumber: 2,
                            title: "Register or Edit a Teacher Profile",
                            description: "Create individual faculty records or update employment status and department affiliations.",
                            details: [
                                "Click '+ Add Teacher' to register a new faculty member with their ID, full name, institutional email, department, and employment type.",
                                "To update an existing instructor, click 'Edit' on their row, adjust their status or details, and save changes.",
                            ],
                        },
                        {
                            stepNumber: 3,
                            title: "Bulk Import & Export Faculty via Excel",
                            description: "Onboard or update multiple instructors simultaneously using formatted Excel spreadsheets.",
                            details: [
                                "Click the Import / Excel button and download the standard Faculty Excel Template.",
                                "Populate columns for PSCS (Personal Standard Classification System) ID, First Name, Middle Initial, Last Name, Email, Department, and Employment Type using valid system codes.",
                                "Upload the completed .xlsx file, inspect the validation summary for any missing fields or duplicate IDs, and confirm import.",
                                "Use the Export button at any time to download the current faculty directory as an Excel workbook.",
                            ],
                        },
                    ],
                },
                {
                    tabId: "teacher-aqs",
                    tabName: "Teacher AQ (Academic Qualification) Approvals & Inspector",
                    summary:
                        "Assign Academic Qualifications (AQ) to instructors and manage Pending, Approved, and Denied qualification verification statuses.",
                    steps: [
                        {
                            stepNumber: 1,
                            title: "Open the Teacher AQ (Academic Qualification) Inspector Panel",
                            description: "View all qualifications linked to a specific faculty member.",
                            details: [
                                "Click on any teacher row in the directory table to open their dedicated AQ (Academic Qualification) Inspector Panel.",
                                "Review existing qualification badges and their current verification statuses.",
                            ],
                        },
                        {
                            stepNumber: 2,
                            title: "Assign a New Academic Qualification (+ Add AQ)",
                            description: "Link a degree or certification code to the selected teacher.",
                            details: [
                                "Click '+ Add AQ (Academic Qualification)' inside the teacher's inspector panel.",
                                "Search for the matching qualification code, lock in your selection, set the initial status, and submit.",
                            ],
                        },
                        {
                            stepNumber: 3,
                            title: "Process Pending & Denied AQ (Academic Qualification) Workflows",
                            description: "Approve, deny, or request resubmission for faculty credentials.",
                            details: [
                                "For Pending / Requested items, click the green 'Approve' action to verify the credential or the red 'Deny' action to reject it.",
                                "For Denied items, click 'Request Resubmission' to reopen the qualification for updated documentation.",
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "maq",
            title: "Matrix of Academic Qualifications (MAQ)",
            route: "/maq",
            icon: HiShieldCheck,
            description:
                "Define master Academic Qualification (AQ) codes and organize them into MAQ (Matrix of Academic Qualifications) Clusters to standardize faculty-subject eligibility rules across all academic departments.",
            roles: ["Academic Head"],
            features: [
                "Two structured tabs: MAQ Clusters and Matrix of Academic Qualifications",
                "Master AQ code creation and deletion with strict uniqueness validation",
                "Cluster grouping to bundle related qualifications across programs for streamlined auditing",
                "Note: MAQ = Matrix of Academic Qualifications, AQ = Academic Qualification",
            ],
            tabs: [
                {
                    tabId: "maq-clusters",
                    tabName: "MAQ (Matrix of Academic Qualifications) Clusters Tab",
                    summary:
                        "Group related Academic Qualifications into logical clusters for streamlined curriculum and faculty competency mapping.",
                    steps: [
                        {
                            stepNumber: 1,
                            title: "View Existing MAQ (Matrix of Academic Qualifications) Clusters",
                            description: "Inspect grouped qualification clusters in the default MAQ view.",
                            details: [
                                "Open the MAQ (Matrix of Academic Qualifications) module from the sidebar (defaults to the 'MAQ Clusters' tab').",
                                "Use the search input to filter clusters by cluster name or included AQ (Academic Qualification) codes.",
                            ],
                        },
                        {
                            stepNumber: 2,
                            title: "Create or Update a Qualification Cluster",
                            description: "Bundle multiple AQ codes under a unified specialization cluster.",
                            details: [
                                "Click the Add Cluster button to open the cluster creation dialog.",
                                "Provide a descriptive Cluster Name and select the Academic Qualifications (AQ) that belong to the group.",
                                "Save the cluster to make it available for qualification audits and assignments.",
                            ],
                        },
                        {
                            stepNumber: 3,
                            title: "Edit or Delete Clusters",
                            description: "Maintain cluster definitions as academic offerings evolve.",
                            details: [
                                "Select an existing cluster to add or remove AQ (Academic Qualification) tags, or use the delete control to remove obsolete clusters.",
                            ],
                        },
                    ],
                },
                {
                    tabId: "maq-master-list",
                    tabName: "Matrix of Academic Qualifications Tab",
                    summary:
                        "Manage the master registry of valid Academic Qualification (AQ) codes (e.g., BSCS, BSIT, MIT) used across Subjects and Teachers. Note: MAQ = Matrix of Academic Qualifications, AQ = Academic Qualification.",
                    steps: [
                        {
                            stepNumber: 1,
                            title: "Switch to Matrix of Academic Qualifications",
                            description: "Access the master list of AQ (Academic Qualification) codes.",
                            details: [
                                "Click the 'Matrix of Academic Qualifications' tab on the MAQ page.",
                                "Search for specific qualifications using the 'Search qualification...' box or click the column header to sort alphabetically.",
                            ],
                        },
                        {
                            stepNumber: 2,
                            title: "Add a New Academic Qualification",
                            description: "Register a new AQ code in the master table.",
                            details: [
                                "Click '+ Add Qualification' at the upper right.",
                                "Enter the Academic Qualification (AQ) code (letters and underscores only, e.g., BSCS).",
                                "Click 'Save Qualification' to add it to the system registry.",
                            ],
                        },
                        {
                            stepNumber: 3,
                            title: "Delete an Academic Qualification",
                            description: "Remove an unused AQ (Academic Qualification) code from the master registry.",
                            details: [
                                "Click the red trash icon on the right side of the target qualification row.",
                                "Click 'Yes, I'm sure' in the confirmation popup to permanently remove the record.",
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "rooms",
            title: "Rooms & Facilities",
            route: "/rooms",
            icon: HiOfficeBuilding,
            description:
                "Manage physical classrooms, laboratories, room type classifications, and building floor levels for transit-aware scheduling.",
            roles: ["Academic Head"],
            features: [
                "Searchable, sortable room inventory with pagination",
                "Room Type classification (Lecture Rooms, Computer Labs, Specialized Labs)",
                "Floor level assignment (Floors 1–10 on creation, Floors 1–15 on edit)",
                "Full create, edit, and permanent deletion controls",
            ],
            steps: [
                {
                    stepNumber: 1,
                    title: "Browse & Search Room Inventory",
                    description: "Locate classrooms and laboratories across building floors.",
                    details: [
                        "Open 'Rooms' from the navigation sidebar.",
                        "Type a room name or number into 'Search rooms...' to filter results as you type.",
                        "Click 'Room Name', 'Room Type', or 'Floor Level' column headers to sort ascending or descending.",
                        "The room list is paginated — use the pagination controls at the bottom to navigate through all rooms.",
                        "Each row shows the Room Name, Room Type (e.g., Lecture Room, Computer Lab), and Floor Level.",
                    ],
                },
                {
                    stepNumber: 2,
                    title: "Add a New Room",
                    description: "Register a classroom or laboratory facility into the database.",
                    details: [
                        "Click '+ Add Room' in the upper-right toolbar.",
                        "Enter the Room Name (up to 50 characters, e.g., 'Lab 301', 'Room A-101').",
                        "Select the Room Type from the dropdown — available types are configured under Configurations > Room Types (e.g., Lecture Room, Computer Lab, Multimedia Lab).",
                        "Select the Floor Level from Floor 1 to Floor 10. Floor level affects transit-aware scheduling — rooms on the same floor are preferred for back-to-back classes.",
                        "Click 'Create Room' to save. A duplicate room name will be rejected.",
                    ],
                },
                {
                    stepNumber: 3,
                    title: "Edit Room Details or Floor Level",
                    description: "Update an existing room's name, facility type, or floor assignment.",
                    details: [
                        "Click 'Edit' on the right side of any room row to open the Edit Room modal.",
                        "Modify the Room Name, Room Type, or Floor Level (Floor 1 to Floor 15 on edit).",
                        "Click 'Save Changes' to commit the update.",
                        "Changing a room's type affects which subjects can be assigned to it during schedule generation — lab subjects require matching lab room types.",
                    ],
                },
                {
                    stepNumber: 4,
                    title: "Delete a Room Record",
                    description: "Remove decommissioned rooms from the scheduling pool.",
                    details: [
                        "Open the Edit Room modal for the target facility and click the red trash icon in the bottom-left footer.",
                        "Confirm by clicking 'Yes, I'm sure' in the deletion prompt.",
                        "Warning: Deleting a room that is currently assigned in an active schedule will leave those class entries without a room — reassign them manually in the timetable editor.",
                    ],
                },
                {
                    stepNumber: 5,
                    title: "Configure Room Types in Configurations",
                    description: "Manage the room type categories that determine which subjects can use which rooms.",
                    details: [
                        "Navigate to Configurations > Room Types to view all configured facility classifications.",
                        "Add new room types (e.g., 'Language Lab', 'Music Room') so they appear in the Room Type dropdown when creating rooms.",
                        "When adding a Subject with Lab Units, select the required Lab Type — the scheduler will only assign rooms of that type to the class.",
                        "Ensure room types in Configurations match the lab requirements defined in your Subject catalog for accurate scheduling.",
                    ],
                },
            ],
        },
        {
            id: "teacher_pre-assignments",
            title: "Teacher Pre-assignments",
            route: "/teacher_pre-assignments",
            icon: HiClipboardList,
            description:
                "Create pre-assignment templates to lock specific teachers to subjects and sections before running schedule generation.",
            roles: ["Academic Head"],
            features: [
                "Template-based pre-assignment management (/teacher_pre-assignments/[template])",
                "Tracking of pre-assigned units, subject prep counts, and load limits",
                "Excel template import/export for bulk pre-assignment distribution",
                "Priority enforcement during schedule generation",
            ],
            steps: [
                {
                    stepNumber: 1,
                    title: "Open or Create a Pre-assignment Template",
                    description: "Select a pre-assignment template workspace from the Teachers or Pre-assignments view.",
                    details: [
                        "Navigate to the Teacher Pre-assignments module from the Teachers page or directly via the template URL.",
                        "Each template represents a separate pre-assignment scenario — you can maintain multiple templates for different terms or what-if scenarios.",
                        "Review the faculty metrics list showing each instructor's current pre-assigned units against their employment load limit.",
                        "The metrics panel displays Current Units, Max Units, Remaining Units, and Load Status for each teacher.",
                    ],
                },
                {
                    stepNumber: 2,
                    title: "Assign Subjects & Sections to a Teacher",
                    description: "Manually bind specific courses and sections to an instructor before schedule generation.",
                    details: [
                        "Select an instructor from the template list to open their pre-assignment panel.",
                        "Choose the target Program, Section, and Subject Code from the dropdown selectors.",
                        "The system validates that the instructor holds the required Academic Qualification (AQ) for the selected subject — if not, an AQ mismatch warning appears. Note: AQ = Academic Qualification.",
                        "Verify the instructor remains within their allowed unit limit and subject prep limit after the assignment.",
                        "Click 'Add Assignment' to lock the pre-assignment. The teacher's unit counters update immediately.",
                    ],
                },
                {
                    stepNumber: 3,
                    title: "Remove or Modify Pre-assignments",
                    description: "Adjust existing pre-assignments when curriculum or faculty availability changes.",
                    details: [
                        "Open a teacher's pre-assignment panel and locate the assignment you want to modify.",
                        "Click the remove or delete control next to the assignment to free the teacher from that binding.",
                        "To reassign a different section or subject, remove the old assignment and create a new one.",
                        "Pre-assignments are enforced during schedule generation — removing them allows the engine to reassign freely.",
                    ],
                },
                {
                    stepNumber: 4,
                    title: "Bulk Import or Export Pre-assignments via Excel",
                    description: "Manage large-scale faculty load pre-assignments using Excel spreadsheets.",
                    details: [
                        "Click the Excel / Import button to download the Pre-assignment Excel template with the correct column headers.",
                        "Enter Teacher PSCS (Personal Standard Classification System) IDs, Section Codes, and Course Codes in the designated columns — do not rename or reorder headers.",
                        "Upload the completed .xlsx file and review the row-by-row validation summary for any missing fields, duplicate assignments, unit overloads, or AQ (Academic Qualification) mismatches.",
                        "Click 'Import' to commit all valid rows, or click 'Export' to download the current template as an Excel workbook for backup or distribution.",
                    ],
                },
                {
                    stepNumber: 5,
                    title: "Use Pre-assignments in Schedule Generation",
                    description: "Ensure pre-assignments are respected when running the timetable generator.",
                    details: [
                        "Before generating a schedule, verify that all desired pre-assignments are saved in the active template.",
                        "The scheduler prioritizes pre-assigned teacher-to-subject bindings during Stage 2 (Subject Mapping).",
                        "If a pre-assigned teacher is unavailable for a required slot, the engine may still place the class as unassigned — review and resolve manually.",
                        "After schedule generation, compare the final timetable against your pre-assignments to confirm all locked bindings were honored.",
                    ],
                },
            ],
        },
        {
            id: "schedules",
            title: "Schedules & Timetable Generator",
            route: "/schedules",
            icon: HiCalendar,
            description:
                "Generate, inspect, export, and activate master class timetables using the 3-stage scheduling engine and interactive timetable editor.",
            roles: ["Academic Head"],
            features: [
                "3-stage generator: Section Generation, Subject Mapping, and 30-min Slot/Room Allocation",
                "Lecture/Lab merging rules (up to 5 hrs) and preferred vacant day balancing per year tier",
                "Schedule Summary Dashboard (/schedules/[schedule_name]) with resource usage and unassigned alerts",
                "Excel (.xlsx) master timetable export and Dashboard Display activation",
            ],
            tabs: [
                {
                    tabId: "schedule-generation",
                    tabName: "Generation Pipeline",
                    summary:
                        "Run the engine to convert student headcounts into sections, map curriculum subjects, and allocate conflict-free rooms and time slots.",
                    steps: [
                        {
                            stepNumber: 1,
                            title: "Configure New Schedule Generation Parameters",
                            description: "Define the schedule name, target curricula, and academic term.",
                            details: [
                                "Open 'Schedules' from the left sidebar and click to create/generate a new schedule.",
                                "Enter a unique Schedule Name, select the included Curricula/Programs, and choose Term 1 or Term 2.",
                            ],
                        },
                        {
                            stepNumber: 2,
                            title: "Section & Subject Resolution",
                            description: "Understand how the engine builds sections and binds subjects.",
                            details: [
                                "Stage 1 (generateProgramSections): Divides student headcounts by the configured Max Students per Section (default 40–50) to generate section codes (e.g., BSIT111, STEM111).",
                                "Stage 2 (assignSubjectsToSections): Matches each section's program, year/grade level, and term to the active subject catalog.",
                            ],
                        },
                        {
                            stepNumber: 3,
                            title: "Room & 30-Minute Time Slot Allocation",
                            description: "Execute conflict-free scheduling across Monday–Saturday (7:00 AM – 9:00 PM).",
                            details: [
                                "Stage 3 (generateRoomAndClassSchedules): Allocates 30-minute time blocks while enforcing zero room, section, or course collisions.",
                                "Combined Lecture + Lab subjects (<= 5 hours total) are evaluated for single-session lab room merging, and each section tier is assigned a preferred vacant day.",
                                "If no matching room is free for a slot, the engine places the class as 'Unassigned Room' so it can be resolved manually.",
                            ],
                        },
                    ],
                },
                {
                    tabId: "schedule-summary",
                    tabName: "Schedule Summary & Excel Export",
                    summary:
                        "Audit generated schedule quality, set the active dashboard schedule, open the interactive timetable grid for manual adjustments, or export to Excel.",
                    steps: [
                        {
                            stepNumber: 1,
                            title: "Open Schedule Summary View",
                            description: "Inspect analytics and assignment health for a generated schedule.",
                            details: [
                                "Click on any schedule from the Schedules list to open its Summary Display page.",
                                "Review the four top KPI (Key Performance Indicator) cards: Total Entries, Active Teachers, Subjects, and Total Units.",
                                "The schedule banner shows the schedule name, generation date, and term (Term 1 or Term 2).",
                            ],
                        },
                        {
                            stepNumber: 2,
                            title: "Audit Resource Usage & Unassigned Metrics",
                            description: "Check for entries lacking a teacher or room assignment and assess overall schedule quality.",
                            details: [
                                "Inspect the Teacher usage progress bar to see what percentage of faculty are actively assigned.",
                                "Inspect the Room usage progress bar to evaluate facility usage across the schedule.",
                                "Check 'Entries Lacking Teacher' — these classes need manual teacher assignment in the timetable editor.",
                                "Check 'Entries Lacking Room' — these classes need a room assigned manually or the room pool needs expansion.",
                                "Review Active Sections count to confirm all expected sections are represented in the schedule.",
                            ],
                        },
                        {
                            stepNumber: 3,
                            title: "Open & Edit the Interactive Timetable",
                            description: "Use the visual timetable grid to inspect and manually adjust class entries.",
                            details: [
                                "Click 'Open Timetable' in the schedule banner to launch the full timetable grid view.",
                                "The timetable displays Monday through Saturday (7:00 AM – 9:00 PM) in 30-minute slots with rooms as columns and time as rows.",
                                "Click any class block to view its details: subject, section, teacher, room, and time range.",
                                "Drag and drop class blocks to reassign them to different time slots or rooms — the system checks for conflicts as you move them.",
                                "Use the filter controls to view the timetable by specific room, teacher, or section.",
                                "Click 'Save' after making manual adjustments to persist changes to the schedule.",
                            ],
                        },
                        {
                            stepNumber: 4,
                            title: "Export Schedule to Excel & Set Dashboard Display",
                            description: "Download spreadsheets for offline distribution or publish the schedule to the main Dashboard.",
                            details: [
                                "Click 'Export' in the top-right action bar to download the complete schedule data in Excel (.xlsx) format.",
                                "The exported file includes all class entries with day, time, subject, section, teacher, and room information.",
                                "Click 'Set as Display on Dashboard' to make this schedule the active institutional view — it will appear on the Dashboard for all users.",
                                "Only one schedule can be the active dashboard display at a time — setting a new one replaces the previous active schedule.",
                            ],
                        },
                        {
                            stepNumber: 5,
                            title: "Delete a Generated Schedule",
                            description: "Remove a schedule that is no longer needed.",
                            details: [
                                "From the Schedules list, click the delete control on the schedule you want to remove.",
                                "Confirm deletion in the dialog — this permanently removes all class entries and associated data for that schedule.",
                                "Warning: If the schedule is currently set as the active dashboard display, the Dashboard will show no active schedule until you activate another one.",
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "fcce",
            title: "FCCE (Faculty Class & Course Evaluation)",
            route: "/fcce",
            icon: HiDocumentReport,
            description:
                "Manage Faculty Class & Course Evaluation (FCCE) records across academic terms, including term creation, record management, Excel bulk operations, unmatched record tracking, and archiving workflows.",
            roles: ["Academic Head"],
            features: [
                "Two dedicated workspace tabs: FCCE Term Management and FCCE Management",
                "Academic Year / Semester CRUD (Create, Read, Update, Delete) with auto-generated AY-Semester codes (e.g., 202425T1)",
                "FCCE record creation with teacher PSCS ID lookup, course name suggestions, and pass/fail status",
                "Excel bulk import with drag-and-drop, template download, and strict 4-column header validation",
                "Unmatched records view to isolate records with invalid PSCS IDs or missing teacher data",
                "Archive and unarchive workflows for historical FCCE term records",
                "Search, sort, and paginate across all FCCE records with archive status filtering",
                "Note: FCCE = Faculty Class & Course Evaluation, PSCS = Personal Standard Classification System, AY = Academic Year, CRUD = Create, Read, Update, Delete",
            ],
            tabs: [
                {
                    tabId: "fcce-term-management",
                    tabName: "FCCE Term Management Tab",
                    summary:
                        "Create and manage Academic Year / Semester terms, add individual FCCE records, and link evaluations to specific academic periods.",
                    steps: [
                        {
                            stepNumber: 1,
                            title: "Browse Existing Academic Years",
                            description: "View all configured academic year and semester combinations.",
                            details: [
                                "Open the FCCE (Faculty Class & Course Evaluation) module from the left sidebar — it defaults to the 'FCCE Term Management' tab.",
                                "The table lists all Academic Year / Semester codes (e.g., 202425T1) sorted by most recent.",
                                "Use the search bar to filter by AY-Semester code, or click column headers to sort ascending or descending.",
                                "Each row shows the AY-Semester code and a 'View Records' button to navigate to that term's FCCE detail page.",
                            ],
                        },
                        {
                            stepNumber: 2,
                            title: "Create a New Academic Year / Semester",
                            description: "Register a new academic term for FCCE record tracking.",
                            details: [
                                "Click '+ Add Academic Year' at the top-right of the table.",
                                "Select the Start Year from the dropdown (spans a 21-year range centered on the current year).",
                                "Select the Term: 'T1' for First Semester or 'T2' for Second Semester.",
                                "The system auto-generates the AY-Semester code (e.g., selecting 2024 + T1 produces '202425T1'). Note: AY = Academic Year.",
                                "Click 'Save' to create the term. Duplicate AY-Semester codes will be rejected with an error.",
                            ],
                        },
                        {
                            stepNumber: 3,
                            title: "Add an Individual FCCE Record",
                            description: "Manually add a faculty evaluation record to the selected academic term.",
                            details: [
                                "Click '+ Add FCCE Record' to open the record creation modal.",
                                "Enter or search the Teacher's PSCS (Personal Standard Classification System) ID — the system validates against the registered teacher roster.",
                                "Enter the Course Name — use the autocomplete suggestions to match existing course names from the catalog.",
                                "Select the Academic Year / Semester from the dropdown of available terms.",
                                "Set the Status toggle to 'Pass' (default) or switch to 'Fail' as appropriate.",
                                "Click 'Save' to commit the record. The system will flag any invalid PSCS ID or missing required fields.",
                            ],
                        },
                        {
                            stepNumber: 4,
                            title: "View FCCE Records for a Specific Term",
                            description: "Navigate to a term's detail page to manage its FCCE records.",
                            details: [
                                "Click the 'View Records' button on any Academic Year row to open the term detail page.",
                                "The detail page shows all FCCE (Faculty Class & Course Evaluation) records for that term with search, sort, and pagination controls.",
                                "From here you can add, edit, or delete individual records, or use Excel import/export for bulk operations.",
                                "Click the back arrow to return to the Term Management overview.",
                            ],
                        },
                    ],
                },
                {
                    tabId: "fcce-management",
                    tabName: "FCCE Management Tab",
                    summary:
                        "Central FCCE record workspace with all-records view, unmatched records isolation, Excel bulk import/export, and archive management.",
                    steps: [
                        {
                            stepNumber: 1,
                            title: "Switch Between All Records and Unmatched Views",
                            description: "Toggle between the complete FCCE record set and records with data issues.",
                            details: [
                                "Open the 'FCCE Management' tab to access the central FCCE workspace.",
                                "Use the view mode toggle buttons at the top: 'ALL' shows every FCCE record, 'UNMATCHED' isolates records where the PSCS ID does not match any registered teacher.",
                                "Note: FCCE = Faculty Class & Course Evaluation, PSCS = Personal Standard Classification System.",
                                "The Unmatched count badge shows how many records currently have unresolved teacher data.",
                            ],
                        },
                        {
                            stepNumber: 2,
                            title: "Search, Filter, and Sort FCCE Records",
                            description: "Locate specific evaluation records across all academic terms.",
                            details: [
                                "Type a PSCS ID, Course Name, or AY-Semester code into the search bar to filter records as you type.",
                                "Use the Archive Filter dropdown to show only Active records, Archived records, or All records.",
                                "Click column headers (PSCS ID, Course Name, AY-Semester, Status) to sort ascending or descending.",
                                "Navigate through paginated results using the pagination controls at the bottom.",
                            ],
                        },
                        {
                            stepNumber: 3,
                            title: "Edit or Delete an FCCE Record",
                            description: "Update evaluation details or remove obsolete records.",
                            details: [
                                "Click 'Edit' on any FCCE record row to open the edit modal.",
                                "Modify the PSCS ID, Course Name, AY-Semester, or Pass/Fail Status as needed.",
                                "Click 'Save Changes' to commit the update, or click the red trash icon to permanently delete the record.",
                                "Confirm deletion in the popup dialog to remove the record from the database.",
                            ],
                        },
                        {
                            stepNumber: 4,
                            title: "Bulk Import FCCE Records via Excel",
                            description: "Upload a large batch of evaluation records using a formatted Excel spreadsheet.",
                            details: [
                                "Click the Excel / Import button on the toolbar to open the Excel operations modal.",
                                "Select the 'Import' tab, then drag and drop or browse for an .xlsx file.",
                                "The file must contain exactly 4 columns: 'PSCS ID', 'Course Name', 'Academic Year / Semester', and 'Status' (Pass/Fail).",
                                "The system validates headers and row data before importing — review any format errors in the log panel.",
                                "Click 'Import' to commit all valid rows. Invalid rows are logged but skipped.",
                            ],
                        },
                        {
                            stepNumber: 5,
                            title: "Export FCCE Records or Download Template",
                            description: "Download current FCCE data or a blank template for offline preparation.",
                            details: [
                                "In the Excel operations modal, switch to the 'Export' tab to download all currently displayed FCCE records as an .xlsx file.",
                                "Switch to the 'Template' tab to download a blank Excel template with the correct column headers and data validation rules.",
                                "The exported file includes all visible columns and respects the current search and archive filter.",
                            ],
                        },
                        {
                            stepNumber: 6,
                            title: "Archive and Unarchive FCCE Records",
                            description: "Move historical FCCE records to archived status to keep the active view clean.",
                            details: [
                                "Click the 'Archive All Active FCCE' button in the toolbar to bulk-archive all currently active records.",
                                "Confirm the archive action in the dialog — archived records remain searchable but are hidden from the default Active filter.",
                                "Switch the Archive Filter to 'Archived' or 'All' to inspect or restore archived records.",
                                "Individual records can also be archived or unarchived from their edit modal.",
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "booking",
            title: "Room Reservation & Facility Bookings",
            route: "/room_reservation",
            icon: HiBookmark,
            description:
                "Reserve classrooms and laboratories for special events, makeup classes, examinations, and other activities that fall outside the regular timetable schedule.",
            roles: ["Academic Assistant", "Academic Head"],
            features: [
                "Facility availability lookup across all registered classrooms and laboratories",
                "Automatic conflict detection against active class schedules and configured break periods",
                "Reservation creation with room, date, time range, purpose, and requesting faculty",
                "Reservation status tracking (Pending, Confirmed, Cancelled) with full history",
                "Visual calendar view to inspect existing reservations and identify open slots",
            ],
            steps: [
                {
                    stepNumber: 1,
                    title: "Open the Room Reservation Module",
                    description: "Access the facility booking workspace from the main navigation.",
                    details: [
                        "Click 'Room Reservation' in the left navigation sidebar.",
                        "The module displays a summary of upcoming reservations and quick-access buttons for creating new bookings.",
                        "If you do not see the Room Reservation link, confirm with your administrator that your role has the 'Booking' permission enabled.",
                    ],
                },
                {
                    stepNumber: 2,
                    title: "Check Room Availability",
                    description: "Verify which rooms are free for your desired date and time window before booking.",
                    details: [
                        "Select the target date using the date picker at the top of the reservation page.",
                        "The system displays all rooms and their scheduled class entries for the selected date.",
                        "Rooms with no overlapping class schedule entries during your desired time window are available for reservation.",
                        "Cross-reference with configured Break Periods (under Configurations) to avoid scheduling during institutional breaks.",
                    ],
                },
                {
                    stepNumber: 3,
                    title: "Create a New Room Reservation",
                    description: "Book a specific room for a defined date and time range.",
                    details: [
                        "Click '+ New Reservation' or 'Create Booking' to open the reservation form.",
                        "Select the Room from the dropdown — only rooms matching the required type (if applicable) will appear.",
                        "Set the Date using the calendar picker.",
                        "Specify the Start Time and End Time — the system validates that the range does not overlap with existing class schedules or other reservations.",
                        "Enter the Reservation Purpose (e.g., 'Makeup Class', 'Department Meeting', 'Final Examination').",
                        "Select the Requesting Faculty member if booking on behalf of another instructor.",
                        "Click 'Submit Reservation' to create the booking. A conflict error will appear if the slot is already occupied.",
                    ],
                },
                {
                    stepNumber: 4,
                    title: "View and Manage Existing Reservations",
                    description: "Inspect, modify, or cancel reservations that have already been created.",
                    details: [
                        "The reservations table lists all bookings with columns for Room, Date, Time Range, Purpose, Status, and Requesting Faculty.",
                        "Use the search bar to filter by room name, purpose, or faculty name.",
                        "Filter by status (Pending, Confirmed, Cancelled) to focus on specific reservation types.",
                        "Click 'Edit' on any reservation to update its time range, purpose, or assigned room.",
                        "Click 'Cancel' to mark a reservation as cancelled — this frees the room slot for other bookings.",
                    ],
                },
                {
                    stepNumber: 5,
                    title: "Resolve Reservation Conflicts",
                    description: "Handle situations where a new reservation overlaps with an existing class or booking.",
                    details: [
                        "If the system reports a conflict, review the conflicting entry shown in the error message.",
                        "Adjust the Start Time or End Time to avoid the overlap, or select a different room.",
                        "If the conflict is with a regular class schedule, consider scheduling the reservation on a different day or during a break period.",
                        "Contact the Academic Head if you need to override a conflict for a high-priority event.",
                    ],
                },
            ],
        },
        {
            id: "configurations",
            title: "System Configurations",
            route: "/configurations",
            icon: HiCog,
            description:
                "Administer institutional scheduling constraints, faculty workload rules, break windows, departments, room types, RBAC (Role-Based Access Control) roles, user accounts, blacklists, and audit logs.",
            roles: ["Academic Head"],
            features: [
                "9 modular configuration tabs covering academic limits, facility types, security, and auditing",
                "Input validation and change detection on all system parameters",
                "Complete audit logging of every administrative modification",
            ],
            tabs: [
                {
                    tabId: "config-class-faculty",
                    tabName: "Class Settings & Faculty Load",
                    summary:
                        "Set section student caps, maximum teaching units per employment type, subject prep limits, and overload ceilings.",
                    steps: [
                        {
                            stepNumber: 1,
                            title: "Configure Class Settings (Max Students per Section)",
                            description: "Set the student threshold used to split program cohorts into sections.",
                            details: [
                                "Open the 'Class Settings' tab inside Configurations.",
                                "Enter a value between 1 and 50 in 'Max Students per Section'.",
                                "Click 'Save Enrollment Configuration' (enabled once a valid change is entered).",
                            ],
                        },
                        {
                            stepNumber: 2,
                            title: "Set Teaching Load Parameters",
                            description: "Define standard maximum teaching units by employment classification.",
                            details: [
                                "Switch to the 'Faculty Load' tab.",
                                "In the 'Teaching Load Parameters' card, set max units (1 to 30) for Full-Time (FT), Part-Time Full Load (PTFL), and Part-Time (PT). Note: FT = Full-Time, PTFL = Part-Time Full Load, PT = Part-Time.",
                                "Click 'Save Load Configuration'.",
                            ],
                        },
                        {
                            stepNumber: 3,
                            title: "Configure Prep Limits & Overloading Parameters",
                            description: "Control unique subject preparations and maximum overload units.",
                            details: [
                                "In the 'Prep Limits (Number of Subjects)' card, set max subjects (1 to 10) for FT, PTFL, and PT, then click 'Save Prep Configuration'. Note: FT = Full-Time, PTFL = Part-Time Full Load, PT = Part-Time.",
                                "In the 'Overloading Parameters' card, set 'Maximum Units Above Load Limit' (0 to 10) and click 'Save Overload Configuration'.",
                            ],
                        },
                    ],
                },
                {
                    tabId: "config-breaks",
                    tabName: "Break Periods",
                    summary:
                        "Define recurring daily or weekly break windows that the scheduler respects when placing classes.",
                    steps: [
                        {
                            stepNumber: 1,
                            title: "Add a Recurring Break Window",
                            description: "Block off lunch or institutional activity periods on specific days.",
                            details: [
                                "Open the 'Break Periods' tab and click '+ Add Break'.",
                                "Enter a Break Description (e.g., Lunch Break, Assembly), select the Day of the Week (Monday–Saturday), and set Start Time and End Time.",
                                "Click 'Save' to enforce the break window during schedule generation.",
                            ],
                        },
                        {
                            stepNumber: 2,
                            title: "Edit or Delete a Break Period",
                            description: "Modify existing break times or remove obsolete windows.",
                            details: [
                                "Click 'Edit' on any row in the Break Periods table to update its description, day, or time range.",
                                "Click the red trash button inside the Edit modal and confirm to delete a break period.",
                            ],
                        },
                    ],
                },
                {
                    tabId: "config-departments-rooms",
                    tabName: "Departments & Room Types",
                    summary:
                        "Maintain academic department divisions and facility classification types used across Rooms and Subjects.",
                    steps: [
                        {
                            stepNumber: 1,
                            title: "Manage Academic Departments",
                            description: "Create, rename, or remove institutional departments.",
                            details: [
                                "Open the 'Departments' tab and click '+ Add Department' to register a new division (up to 50 characters).",
                                "Click 'Edit' on an existing department row to rename it or click the red trash icon to delete it.",
                            ],
                        },
                        {
                            stepNumber: 2,
                            title: "Manage Room Types",
                            description: "Define room categories (e.g., Lecture Room, Computer Lab) for room-to-subject matching.",
                            details: [
                                "Open the 'Room Types' tab to view all configured facility types.",
                                "Add new room classifications or edit/remove existing ones so Rooms and Subjects map accurately.",
                            ],
                        },
                    ],
                },
                {
                    tabId: "config-security-logs",
                    tabName: "Roles, Users, Blacklist & Logs",
                    summary:
                        "Control user access permissions, manage institutional user accounts, isolate blacklisted emails, and audit system logs.",
                    steps: [
                        {
                            stepNumber: 1,
                            title: "Configure Roles & Users",
                            description: "Manage RBAC permission flags and user role assignments.",
                            details: [
                                "Open the 'Roles' tab to toggle module permissions per role. Note: RBAC = Role-Based Access Control.",
                                "Open the 'Users' tab to inspect synced Microsoft accounts and assign or update their system roles.",
                            ],
                        },
                        {
                            stepNumber: 2,
                            title: "Manage Blacklisted Accounts",
                            description: "Restrict system access for unauthorized or separated accounts.",
                            details: [
                                "Open the 'Blacklist' tab to add an email address to the blocked list (users matching this list are redirected to /blacklisted upon login).",
                                "Remove an entry from the blacklist to restore access.",
                            ],
                        },
                        {
                            stepNumber: 3,
                            title: "Audit System Logs",
                            description: "Review chronological records of all administrative actions.",
                            details: [
                                "Open the 'Logs' tab to view Timestamp, User, Action, and Details for every create, update, and delete event.",
                                "Use the 'Search logs...' bar or sort by Timestamp, User, or Action to trace specific changes.",
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "help",
            title: "Help & User Manual",
            route: "/help",
            icon: HiBookOpen,
            description:
                "Interactive system user manual providing searchable, module-by-module and tab-by-tab operational instructions for every AceHub feature — from Dashboard analytics to Configuration management.",
            roles: ["Academic Head", "School Registrar", "Academic Assistant", "Teacher"],
            features: [
                "Instant keyword search across all modules, sub-tabs, features, and step-by-step details",
                "Left-side module navigation panel with 12 system modules and filter count",
                "Sub-tab switching for multi-tab modules (Courses, Subjects, Teachers, MAQ, Schedules, FCCE, Configurations)",
                "Authorized role badges showing which user roles can access each module",
                "Key features and capabilities summary for every module",
                "Numbered step-by-step operational walkthroughs with detailed action steps",
                "Route badges showing the exact URL path for each module",
            ],
            steps: [
                {
                    stepNumber: 1,
                    title: "Navigate the Help Page Layout",
                    description: "Understand the two-column layout and how to move between modules.",
                    details: [
                        "The Help page uses a split layout: the left column lists all System Modules, and the right column displays the detailed guide for the selected module.",
                        "The top banner contains the page title and a search bar for filtering modules by keyword.",
                        "Click any module in the left panel to load its guide in the right panel — the active module is highlighted in blue.",
                        "The module count badge at the top of the left panel shows how many modules match your current search filter.",
                    ],
                },
                {
                    stepNumber: 2,
                    title: "Search Across All Modules & Tasks",
                    description: "Instantly locate relevant instructions using keyword search.",
                    details: [
                        "Type any keyword into the search bar at the top right — for example: 'Excel', 'MAQ', 'Overload', 'Break', 'Schedule', 'Import', 'Preference', or 'Archive'.",
                        "The left module navigation list filters as you type to show only modules whose title, description, features, steps, or sub-tab content matches your keyword.",
                        "Click the 'X' button inside the search bar to clear the filter and restore all modules.",
                        "If no modules match your search, a 'No matching modules found' message appears in the left panel.",
                    ],
                },
                {
                    stepNumber: 3,
                    title: "Read Module Guides & Sub-Tabs",
                    description: "Explore detailed instructions for specific pages and their internal tabs.",
                    details: [
                        "Select any module from the left System Modules panel to view its guide.",
                        "Each module guide shows the Route badge (exact URL - Uniform Resource Locator), Module Tabs count (if applicable), Authorized User Roles, and Key Features.",
                        "Modules with multiple internal tabs (Courses, Subjects, Teachers, MAQ, Schedules, FCCE, Configurations) display sub-tab buttons below the features section — click a sub-tab to see its dedicated step-by-step guide.",
                        "Single-tab modules display their steps directly without sub-tab buttons.",
                    ],
                },
                {
                    stepNumber: 4,
                    title: "Follow Step-by-Step Operation Guides",
                    description: "Execute tasks by following the numbered instructions for each module or sub-tab.",
                    details: [
                        "Each step is numbered sequentially and includes a title, a one-sentence description, and a bulleted list of detailed actions.",
                        "Follow the steps in order — earlier steps often set up context required by later steps (e.g., creating a subject before assigning it in a schedule).",
                        "The detail bullets describe exact button labels, field names, and expected system behavior so you can replicate the actions in the application.",
                        "If a step references another module (e.g., 'configured under Configurations > Room Types'), navigate to that module's guide for additional context.",
                    ],
                },
                {
                    stepNumber: 5,
                    title: "Cross-Reference Related Modules",
                    description: "Use the Help page to understand how modules interconnect and depend on each other.",
                    details: [
                        "Many modules depend on data from other modules — for example, Schedules requires Courses, Subjects, Teachers, Rooms, and MAQ to be configured first.",
                        "Use the left navigation to quickly jump between related modules and review their setup steps.",
                        "The Configurations module guide documents system-wide settings (faculty load limits, break periods, room types) that affect multiple other modules.",
                        "The Teacher Pre-assignments module bridges Teachers, Subjects, and Schedules by locking instructor-to-course assignments before schedule generation.",
                    ],
                },
            ],
        },
    ];

    const filteredModules = modules.filter((mod) => {
        // Only show modules the user has permission to access
        if (accessibleModuleIds.length > 0 && !accessibleModuleIds.includes(mod.id)) {
            return false;
        }
        const q = debouncedSearch.toLowerCase();
        if (!q) return true;
        return (
            mod.title.toLowerCase().includes(q) ||
            mod.description.toLowerCase().includes(q) ||
            mod.features.some((f) => f.toLowerCase().includes(q)) ||
            (mod.steps &&
                mod.steps.some(
                    (s) =>
                        s.title.toLowerCase().includes(q) ||
                        s.description.toLowerCase().includes(q) ||
                        s.details.some((d) => d.toLowerCase().includes(q))
                )) ||
            (mod.tabs &&
                mod.tabs.some(
                    (t) =>
                        t.tabName.toLowerCase().includes(q) ||
                        t.summary.toLowerCase().includes(q) ||
                        t.steps.some(
                            (s) =>
                                s.title.toLowerCase().includes(q) ||
                                s.description.toLowerCase().includes(q) ||
                                s.details.some((d) => d.toLowerCase().includes(q))
                        )
                ))
        );
    });

    const currentModule = modules.find((m) => m.id === activeModuleId) || modules[0];
    const CurrentIcon = currentModule.icon;

    const handleSelectModule = (moduleId: string) => {
        setActiveModuleId(moduleId);
        const targetMod = modules.find((m) => m.id === moduleId);
        if (targetMod?.tabs && targetMod.tabs.length > 0) {
            setActiveSubTabId(targetMod.tabs[0].tabId);
        } else {
            setActiveSubTabId("");
        }
        if (contentScrollRef.current) {
            contentScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    const currentSubTab =
        currentModule.tabs && currentModule.tabs.length > 0
            ? currentModule.tabs.find((t) => t.tabId === activeSubTabId) ||
            currentModule.tabs[0]
            : null;

    const displayedSteps: DetailedStep[] = currentSubTab
        ? currentSubTab.steps
        : currentModule.steps || [];

    return (
        <div className="flex h-full flex-col overflow-hidden bg-gray-50 p-4 sm:p-6 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
            {isLoading ? (
                <div className="flex h-full items-center justify-center">
                    <div className="text-center space-y-6">
                        <Spinner />
                        <div className="text-sm text-gray-500 dark:text-gray-400">Loading Help Guide...</div>
                    </div>
                </div>
            ) : (
                <>
            {/* Fixed Top Header Banner */}
            <div className="mb-5 shrink-0 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-800 p-5 sm:p-6 text-white shadow-lg">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div>
                        <div className="flex items-center gap-3 mb-1.5">
                            <HiOutlineDesktopComputer className="h-7 w-7 text-blue-200 shrink-0" />
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                                AceHub Help Guide
                            </h1>
                        </div>
                        {roleName && (
                            <div className="flex flex-col gap-1 mb-2">
                                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold backdrop-blur-sm">
                                    <HiShieldCheck className="h-4 w-4" />
                                    {roleName}
                                </span>
                                <p className="text-blue-100 text-xs sm:text-sm max-w-2xl">
                                    {permissions ? getRoleDescription(permissions, roleName) : "Browse the available modules below to learn how to use AceHub."}
                                </p>
                            </div>
                        )}
                        <p className="text-blue-100 text-xs sm:text-sm max-w-2xl">
                            Select any system module to view authorized roles, tab functions, Excel workflows, and step-by-step instructions.
                        </p>
                    </div>

                    {/* Search Bar */}
                    <div className="relative w-full lg:w-96 shrink-0">
                        <HiSearch className="pointer-events-none absolute left-3.5 top-3 h-5 w-5 text-blue-200" />
                        <input
                            type="text"
                            placeholder="Search modules, tabs, Excel, tasks..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-xl border border-white/25 bg-white/15 py-2.5 pl-10 pr-9 text-sm text-white placeholder-blue-200 backdrop-blur-md transition focus:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                aria-label="Clear search"
                                className="absolute right-3 top-3 text-blue-200 hover:text-white"
                            >
                                <HiX className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Split Workspace: Perfectly Aligned Columns with Independent Scrolling */}
            <div className="flex min-h-0 flex-1 flex-col items-stretch gap-6 lg:flex-row">
                {/* Left Column: System Modules Navigation */}
                <aside className="flex h-full max-h-64 shrink-0 flex-col rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:max-h-none lg:w-72 xl:w-80">
                    <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700 shrink-0">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            System Modules
                        </h3>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            {filteredModules.length}
                        </span>
                    </div>

                    <nav
                        aria-label="System Modules"
                        className="flex-1 space-y-1.5 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent dark:scrollbar-thumb-gray-600"
                    >
                        {filteredModules.length === 0 ? (
                            <p className="py-6 text-center text-xs text-gray-500 dark:text-gray-400">
                                No matching modules found.
                            </p>
                        ) : (
                            filteredModules.map((mod) => {
                                const Icon = mod.icon;
                                const isActive = activeModuleId === mod.id;
                                return (
                                    <button
                                        key={mod.id}
                                        type="button"
                                        onClick={() => handleSelectModule(mod.id)}
                                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                                            isActive
                                                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                                : "bg-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/70"
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 truncate">
                                            <Icon
                                                className={`w-5 h-5 shrink-0 ${
                                                    isActive
                                                        ? "text-white"
                                                        : "text-blue-600 dark:text-blue-400"
                                                }`}
                                            />
                                            <span className="truncate">{mod.title}</span>
                                        </div>
                                        <HiChevronRight
                                            className={`w-4 h-4 shrink-0 transition-transform ${
                                                isActive
                                                    ? "translate-x-0.5 opacity-100"
                                                    : "opacity-40"
                                            }`}
                                        />
                                    </button>
                                );
                            })
                        )}
                    </nav>
                </aside>

                {/* Right Column: Instruction Guide Panel */}
                <section
                    ref={contentScrollRef}
                    className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 sm:p-7 shadow-sm dark:border-gray-700 dark:bg-gray-800 space-y-6 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent dark:scrollbar-thumb-gray-600"
                >
                    {/* Title & Route Badge */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-2.5 py-1 text-xs font-mono font-semibold bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 rounded-lg">
                                    Route: {currentModule.route}
                                </span>
                                {currentModule.tabs && (
                                    <span className="px-2.5 py-1 text-xs font-medium bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 rounded-lg">
                                        {currentModule.tabs.length} Module Tabs
                                    </span>
                                )}
                            </div>
                            <h2 className="text-2xl font-bold flex items-center gap-2.5 text-gray-900 dark:text-white">
                                <CurrentIcon className="w-7 h-7 text-blue-600 dark:text-blue-400 shrink-0" />
                                {currentModule.title}
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1.5 leading-relaxed">
                                {currentModule.description}
                            </p>
                        </div>
                    </div>

                    <hr className="border-gray-200 dark:border-gray-700" />

                    {/* Authorized Roles */}
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2.5">
                            Authorized User Roles
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {currentModule.roles.map((role, idx) => {
                                const isCurrentUser = roleName.toLowerCase() === role.toLowerCase()
                                    || (roleName.toLowerCase().includes("academic") && role.toLowerCase().includes("academic"))
                                    || (roleName.toLowerCase().includes("super") && role.toLowerCase().includes("academic"));
                                return (
                                    <span
                                        key={idx}
                                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                                            isCurrentUser
                                                ? "bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700 shadow-sm"
                                                : "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/70"
                                        }`}
                                    >
                                        {role}
                                        {isCurrentUser && " (You)"}
                                    </span>
                                );
                            })}
                        </div>
                    </div>

                    {/* Key Features */}
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2.5">
                            Key Features & Capabilities
                        </h3>
                        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {currentModule.features.map((feature, idx) => (
                                <li
                                    key={idx}
                                    className="p-3.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 flex items-start gap-2.5"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-2 shrink-0" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <hr className="border-gray-200 dark:border-gray-700" />

                    {/* Sub-Tab Selector (for modules with multiple tabs/views) */}
                    {currentModule.tabs && currentModule.tabs.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <HiFolderOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Module Tabs & Sub-Views
                                </h3>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {currentModule.tabs.map((tab) => {
                                    const isTabSelected = currentSubTab?.tabId === tab.tabId;
                                    return (
                                        <button
                                            key={tab.tabId}
                                            type="button"
                                            onClick={() => setActiveSubTabId(tab.tabId)}
                                            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                                                isTabSelected
                                                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                                    : "bg-gray-50 dark:bg-gray-900/60 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/60"
                                            }`}
                                        >
                                            {tab.tabName}
                                        </button>
                                    );
                                })}
                            </div>

                            {currentSubTab && (
                                <div className="rounded-xl border border-blue-200/80 bg-blue-50/70 p-4 dark:border-blue-800/50 dark:bg-blue-950/30">
                                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                                        {currentSubTab.tabName}
                                    </p>
                                    <p className="mt-1 text-xs sm:text-sm text-blue-800/90 dark:text-blue-300/90 leading-relaxed">
                                        {currentSubTab.summary}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Detailed Step-by-Step Operation Guide */}
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                            {currentSubTab
                                ? `Step-by-Step Guide: ${currentSubTab.tabName}`
                                : "Step-by-Step Operation Guide"}
                        </h3>

                        <div className="space-y-4">
                            {displayedSteps.map((step) => (
                                <div
                                    key={step.stepNumber}
                                    className="p-5 bg-slate-50/90 dark:bg-gray-900/60 rounded-2xl border border-gray-200/90 dark:border-gray-700 space-y-3 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="flex items-center justify-center w-8 h-8 bg-blue-600 dark:bg-blue-500 text-white rounded-full text-sm font-bold shrink-0 shadow-sm">
                                            {step.stepNumber}
                                        </span>
                                        <h4 className="font-semibold text-gray-900 dark:text-white text-base">
                                            {step.title}
                                        </h4>
                                    </div>

                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200 pl-9 sm:pl-11 leading-relaxed">
                                        {step.description}
                                    </p>

                                    <ul className="pl-9 sm:pl-11 space-y-2.5 pt-0.5">
                                        {step.details.map((detail, dIdx) => (
                                            <li
                                                key={dIdx}
                                                className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2.5 leading-relaxed"
                                            >
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-2 shrink-0" />
                                                <span>{detail}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </div>
                </>
            )}
        </div>
    );
}