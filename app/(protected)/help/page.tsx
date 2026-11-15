"use client";

import React, { useState, useRef } from "react";
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

export default function HelpPage() {
    const [activeModuleId, setActiveModuleId] = useState<string>("dashboard");
    const [activeSubTabId, setActiveSubTabId] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const contentScrollRef = useRef<HTMLDivElement>(null);

    const modules: ModuleGuide[] = [
        {
            id: "dashboard",
            title: "Dashboard & Analytics",
            route: "/dashboard",
            icon: HiChartPie,
            description:
                "Central overview of the active master schedule, displaying entry counts, active teachers, subject totals, and individual faculty workload capacities.",
            roles: ["Academic Head", "Faculty"],
            features: [
                "Live KPI stat cards for Total Entries, Active Teachers, Subjects, and Total Units",
                "Teacher Workload Summary bar tracking Active, Overloaded, and Average Utilization",
                "Color-coded teacher capacity badges (Available, Moderate, Near Capacity, At Max, Overloaded)",
                "Quick navigation to Edit Timetable or inspect individual teacher load profiles",
            ],
            steps: [
                {
                    stepNumber: 1,
                    title: "Verify Active Master Schedule Banner",
                    description: "Check which schedule configuration is currently set as the active dashboard display.",
                    details: [
                        "Review the schedule title and generation description at the top banner.",
                        "If no schedule is displayed yet, click 'Go to Schedules' to select and activate an existing timetable.",
                    ],
                },
                {
                    stepNumber: 2,
                    title: "Review Top-Level KPI Cards",
                    description: "Inspect the four summary counters directly below the header.",
                    details: [
                        "Check Total Entries to verify the total scheduled class sessions.",
                        "Compare Active Teachers and Subjects against expected term offerings.",
                        "Review Total Units to confirm overall institutional teaching hours assigned.",
                    ],
                },
                {
                    stepNumber: 3,
                    title: "Audit Teacher Workload Summary",
                    description: "Monitor department-wide teaching load health in the blue summary panel.",
                    details: [
                        "Check the Overloaded counter to see if any faculty exceed their standard employment unit limit.",
                        "Review Avg Utilization percentage to evaluate balanced load distribution across instructors.",
                    ],
                },
                {
                    stepNumber: 4,
                    title: "Inspect Individual Teacher Cards & Timetable",
                    description: "Drill down into specific faculty assignments or open the full timetable.",
                    details: [
                        "Click any Teacher Card to view their assigned subjects, current units, remaining available units, and prep limit.",
                        "Click 'View All Teachers' at the end of the grid to inspect the complete faculty roster.",
                        "Click 'Edit Timetable' (or 'View Timetable' depending on role permissions) in the top-right header to open the full schedule grid.",
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
                "Direct input feeds into the automated section generator during schedule creation",
            ],
            tabs: [
                {
                    tabId: "courses-shs",
                    tabName: "SHS Strands (/courses/shs)",
                    summary:
                        "Configure Senior High School academic strands (e.g., STEM, ABM, HUMSS) and input student enrollment counts for Grade 11 and Grade 12.",
                    steps: [
                        {
                            stepNumber: 1,
                            title: "Open SHS Strands Management",
                            description: "Access the Senior High School strand registry from the Courses menu.",
                            details: [
                                "Expand 'Courses' in the left navigation sidebar and select 'SHS Courses'.",
                                "Use the search bar to filter existing strands by Strand Code or Strand Name, or click column headers to sort.",
                            ],
                        },
                        {
                            stepNumber: 2,
                            title: "Add a New SHS Strand",
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
                "Two dedicated workspace tabs: Subject Management and Subject AQ",
                "Lecture and Laboratory unit breakdowns with required Lab Room Type mapping",
                "Excel (.xlsx / .csv) template download, bulk subject import, and catalog export",
                "Subject-to-AQ mapping to enforce qualified teacher assignments during scheduling",
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
                    tabName: "Subject AQ Tab",
                    summary:
                        "Link Minimum Academic Qualification (MAQ) codes to specific subjects so the scheduler only assigns qualified instructors.",
                    steps: [
                        {
                            stepNumber: 1,
                            title: "Switch to Subject AQ Tab",
                            description: "Open the subject qualification requirement mapping interface.",
                            details: [
                                "Click the 'Subject AQ' tab next to 'Subject Management'.",
                                "Search for a subject by Course Code or Course Name to inspect its current required AQs.",
                            ],
                        },
                        {
                            stepNumber: 2,
                            title: "Assign Required AQs to a Subject",
                            description: "Specify which academic credentials qualify a teacher to handle the course.",
                            details: [
                                "Select a subject row to open its qualification assignment panel or modal.",
                                "Choose one or more valid Academic Qualification (AQ) codes from the available MAQ list.",
                                "Save the mapping so the automated schedule generator and pre-assignment validator recognize these requirements.",
                            ],
                        },
                        {
                            stepNumber: 3,
                            title: "Remove Outdated AQ Requirements",
                            description: "Update qualification rules when curriculum standards change.",
                            details: [
                                "Open the target subject's assigned AQs and remove any qualification tag that is no longer required.",
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
                "Comprehensive faculty directory with search, sorting, and Employment Status filtering (FT, PTFL, PT, Proby)",
                "Excel (.xlsx) bulk teacher import and roster export workflows with strict PSCS ID validation",
                "Teacher AQ Inspector Panel with Approved, Pending/Requested, and Denied approval workflows",
                "Real-time credential verification and direct links to Teacher Pre-assignments templates",
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
                                "Type a Name, Teacher Code / PSCS ID, or Email into the search input.",
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
                                "Populate columns for PSCS ID, First Name, Middle Initial, Last Name, Email, Department, and Employment Type using valid system codes.",
                                "Upload the completed .xlsx file, inspect the validation summary for any missing fields or duplicate IDs, and confirm import.",
                                "Use the Export button at any time to download the current faculty directory as an Excel workbook.",
                            ],
                        },
                    ],
                },
                {
                    tabId: "teacher-aqs",
                    tabName: "Teacher AQ Approvals & Inspector",
                    summary:
                        "Assign Academic Qualifications to instructors and manage Pending, Approved, and Denied qualification verification statuses.",
                    steps: [
                        {
                            stepNumber: 1,
                            title: "Open the Teacher AQ Inspector Panel",
                            description: "View all qualifications linked to a specific faculty member.",
                            details: [
                                "Click on any teacher row in the directory table to open their dedicated AQ Inspector Panel.",
                                "Review existing qualification badges and their current verification statuses.",
                            ],
                        },
                        {
                            stepNumber: 2,
                            title: "Assign a New Academic Qualification (+ Add AQ)",
                            description: "Link a degree or certification code to the selected teacher.",
                            details: [
                                "Click '+ Add AQ' inside the teacher's inspector panel.",
                                "Search for the matching qualification code, lock in your selection, set the initial status, and submit.",
                            ],
                        },
                        {
                            stepNumber: 3,
                            title: "Process Pending & Denied AQ Workflows",
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
                "Define master Academic Qualification (AQ) codes and organize them into MAQ Clusters to standardize faculty-subject eligibility rules across all academic departments.",
            roles: ["Academic Head"],
            features: [
                "Two structured tabs: MAQ Clusters and Matrix of Academic Qualifications",
                "Master AQ code creation and deletion with strict uniqueness validation",
                "Cluster grouping to bundle related qualifications across programs for streamlined auditing",
            ],
            tabs: [
                {
                    tabId: "maq-clusters",
                    tabName: "MAQ Clusters Tab",
                    summary:
                        "Group related Academic Qualifications into logical clusters for streamlined curriculum and faculty competency mapping.",
                    steps: [
                        {
                            stepNumber: 1,
                            title: "View Existing MAQ Clusters",
                            description: "Inspect grouped qualification clusters in the default MAQ view.",
                            details: [
                                "Open the MAQ module from the sidebar (defaults to the 'MAQ Clusters' tab).",
                                "Use the search input to filter clusters by cluster name or included AQ codes.",
                            ],
                        },
                        {
                            stepNumber: 2,
                            title: "Create or Update a Qualification Cluster",
                            description: "Bundle multiple AQ codes under a unified specialization cluster.",
                            details: [
                                "Click the Add Cluster button to open the cluster creation dialog.",
                                "Provide a descriptive Cluster Name and select the Academic Qualifications that belong to the group.",
                                "Save the cluster to make it available for qualification audits and assignments.",
                            ],
                        },
                        {
                            stepNumber: 3,
                            title: "Edit or Delete Clusters",
                            description: "Maintain cluster definitions as academic offerings evolve.",
                            details: [
                                "Select an existing cluster to add or remove AQ tags, or use the delete control to remove obsolete clusters.",
                            ],
                        },
                    ],
                },
                {
                    tabId: "maq-master-list",
                    tabName: "Matrix of Academic Qualifications Tab",
                    summary:
                        "Manage the master registry of valid Academic Qualification (AQ) codes (e.g., BSCS, BSIT, MIT) used across Subjects and Teachers.",
                    steps: [
                        {
                            stepNumber: 1,
                            title: "Switch to Matrix of Academic Qualifications",
                            description: "Access the master list of AQ codes.",
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
                                "Enter the Academic Qualification code (letters and underscores only, e.g., BSCS).",
                                "Click 'Save Qualification' to add it to the system registry.",
                            ],
                        },
                        {
                            stepNumber: 3,
                            title: "Delete an Academic Qualification",
                            description: "Remove an unused AQ code from the master registry.",
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
                        "Type a room name or number into 'Search rooms...' to filter results in real time.",
                        "Click 'Room Name', 'Room Type', or 'Floor Level' column headers to sort ascending or descending.",
                    ],
                },
                {
                    stepNumber: 2,
                    title: "Add a New Room",
                    description: "Register a classroom or laboratory facility into the database.",
                    details: [
                        "Click '+ Add Room' in the upper-right toolbar.",
                        "Enter the Room Name (up to 50 characters, e.g., Lab 301).",
                        "Select the Room Type from the dropdown list (configured under Configurations > Room Types).",
                        "Select the Floor Level (Floor 1 to Floor 10) and click 'Create Room'.",
                    ],
                },
                {
                    stepNumber: 3,
                    title: "Edit Room Details or Floor Level",
                    description: "Update an existing room's name, facility type, or floor assignment.",
                    details: [
                        "Click 'Edit' on the right side of any room row.",
                        "Modify the Room Name, Room Type, or Floor Level (Floor 1 to Floor 15) and click 'Save Changes'.",
                    ],
                },
                {
                    stepNumber: 4,
                    title: "Delete a Room Record",
                    description: "Remove decommissioned rooms from the scheduling pool.",
                    details: [
                        "Open the Edit Room modal for the target facility and click the red trash icon in the bottom-left footer.",
                        "Confirm by clicking 'Yes, I'm sure' in the deletion prompt.",
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
                "Create pre-assignment templates to lock specific teachers to subjects and sections before running automated schedule generation.",
            roles: ["Academic Head"],
            features: [
                "Template-based pre-assignment management (/teacher_pre-assignments/[template])",
                "Real-time tracking of pre-assigned units, subject prep counts, and load limits",
                "Excel template import/export for bulk pre-assignment distribution",
                "Priority enforcement during automated schedule generation",
            ],
            steps: [
                {
                    stepNumber: 1,
                    title: "Open or Create a Pre-assignment Template",
                    description: "Select a pre-assignment template workspace from the Teachers or Pre-assignments view.",
                    details: [
                        "Navigate to the target Teacher Pre-assignment template page.",
                        "Review the faculty metrics list showing each instructor's current pre-assigned units against their employment load limit.",
                    ],
                },
                {
                    stepNumber: 2,
                    title: "Assign Subjects & Sections to a Teacher",
                    description: "Manually bind specific courses and sections to an instructor.",
                    details: [
                        "Select an instructor from the template list to inspect or add pre-assignments.",
                        "Choose the target Program, Section, and Subject Code.",
                        "Verify that the instructor holds the required Academic Qualification (AQ) and remains within allowed unit and prep limits.",
                    ],
                },
                {
                    stepNumber: 3,
                    title: "Bulk Import or Export Pre-assignments via Excel",
                    description: "Manage large-scale faculty load pre-assignments using Excel.",
                    details: [
                        "Download the Pre-assignment Excel template if preparing loads offline.",
                        "Enter Teacher PSCS IDs, Section Codes, and Course Codes in the designated columns, then upload the .xlsx file.",
                        "Review validation feedback to ensure no unit overloads or AQ mismatches occurred, or click Export to download the active template.",
                    ],
                },
            ],
        },
        {
            id: "schedules",
            title: "Schedules & Automated Timetable Generator",
            route: "/schedules",
            icon: HiCalendar,
            description:
                "Generate, inspect, export, and activate master class timetables using the 3-stage automated scheduling engine and interactive timetable editor.",
            roles: ["Academic Head"],
            features: [
                "3-stage automated generator: Section Generation, Subject Mapping, and 30-min Slot/Room Allocation",
                "Automated Lecture/Lab merging rules (up to 5 hrs) and preferred vacant day balancing per year tier",
                "Schedule Summary Dashboard (/schedules/[schedule_name]) with resource utilization and unassigned alerts",
                "Excel (.xlsx) master timetable export and Dashboard Display activation",
            ],
            tabs: [
                {
                    tabId: "schedule-generation",
                    tabName: "Automated Generation Pipeline",
                    summary:
                        "Run the automated engine to convert student headcounts into sections, map curriculum subjects, and allocate conflict-free rooms and time slots.",
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
                            title: "Automated Section & Subject Resolution",
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
                                "Combined Lecture + Lab subjects (<= 5 hours total) are automatically evaluated for single-session lab room merging, and each section tier is assigned a preferred vacant day.",
                                "If no matching room is free for a slot, the engine places the class as 'Unassigned Room' so it can be resolved manually.",
                            ],
                        },
                    ],
                },
                {
                    tabId: "schedule-summary",
                    tabName: "Schedule Summary & Excel Export",
                    summary:
                        "Audit generated schedule quality, set the active dashboard schedule, open the timetable grid, or export to Excel.",
                    steps: [
                        {
                            stepNumber: 1,
                            title: "Open Schedule Summary View",
                            description: "Inspect analytics and assignment health for a generated schedule.",
                            details: [
                                "Click on any schedule from the Schedules list to open its Summary Display page.",
                                "Review the four top KPI cards: Total Entries, Active Teachers, Subjects, and Total Units.",
                            ],
                        },
                        {
                            stepNumber: 2,
                            title: "Audit Resource Utilization & Unassigned Metrics",
                            description: "Check for entries lacking a teacher or room assignment.",
                            details: [
                                "Inspect the Teacher and Room utilization progress bars and Active Sections count.",
                                "Check 'Entries Lacking Teacher' and 'Entries Lacking Room' under Performance & Unassigned Metrics to spot items needing manual attention.",
                            ],
                        },
                        {
                            stepNumber: 3,
                            title: "Export Schedule to Excel & Set Dashboard Display",
                            description: "Download spreadsheets or publish the schedule to the main dashboard.",
                            details: [
                                "Click 'Export' in the top-right action bar to download the schedule data in Excel format for offline distribution or printing.",
                                "Click 'Open Timetable' in the schedule banner to view or manually adjust class blocks on the calendar grid.",
                                "Click 'Set as Display on Dashboard' to make this schedule the active institutional view on the main Dashboard.",
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
                "Manage Faculty Class & Course Evaluation records, review faculty evaluation metrics, and import/export evaluation sheets with detailed audit trails.",
            roles: ["Academic Head"],
            features: [
                "Centralized faculty evaluation tracking and summary reporting",
                "Excel spreadsheet import/export support for evaluation records with strict column schema validation",
                "Search and filtering across instructors, evaluation scores, and academic terms",
            ],
            steps: [
                {
                    stepNumber: 1,
                    title: "Access the FCCE Module",
                    description: "Open the Faculty Class & Course Evaluation workspace.",
                    details: [
                        "Select 'FCCE' from the left navigation sidebar.",
                        "Use the search and filter controls to locate specific faculty evaluation records.",
                    ],
                },
                {
                    stepNumber: 2,
                    title: "Upload or Export FCCE Excel Records",
                    description: "Process evaluation data using standardized Excel workbooks.",
                    details: [
                        "Use the Excel import tool to upload compiled FCCE evaluation results matching the required column headers.",
                        "Verify parsed scores and instructor matches before saving, or use Export to generate an Excel summary report.",
                    ],
                },
            ],
        },
        {
            id: "booking",
            title: "Room Reservation & Facility Bookings",
            route: "/booking",
            icon: HiBookmark,
            description:
                "Manage special room reservations, makeup class bookings, and facility scheduling outside regular automated timetables.",
            roles: ["Academic Assistant", "Academic Head"],
            features: [
                "Facility availability lookup across classrooms and laboratories",
                "Conflict checking against active class schedules and break periods",
                "Reservation status tracking and management",
            ],
            steps: [
                {
                    stepNumber: 1,
                    title: "Open Room Reservation",
                    description: "Navigate to the facility booking workspace.",
                    details: [
                        "Select 'Room Reservation' in the left navigation sidebar.",
                        "Check available rooms, dates, and time windows before creating a reservation.",
                    ],
                },
                {
                    stepNumber: 2,
                    title: "Create & Manage Room Reservations",
                    description: "Book a room for an event, exam, or makeup session.",
                    details: [
                        "Specify the target Room, Date, Start/End Time, and Reservation Purpose.",
                        "Submit the booking once verified conflict-free, or update/cancel existing reservations as needed.",
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
                "Administer institutional scheduling constraints, faculty workload rules, break windows, departments, room types, RBAC roles, user accounts, blacklists, and audit logs.",
            roles: ["Academic Head"],
            features: [
                "9 modular configuration tabs covering academic limits, facility types, security, and auditing",
                "Real-time input validation and change detection on all system parameters",
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
                                "In the 'Teaching Load Parameters' card, set max units (1 to 30) for Full-Time (FT), Part-Time Full Load (PTFL), and Part-Time (PT).",
                                "Click 'Save Load Configuration'.",
                            ],
                        },
                        {
                            stepNumber: 3,
                            title: "Configure Prep Limits & Overloading Parameters",
                            description: "Control unique subject preparations and maximum overload units.",
                            details: [
                                "In the 'Prep Limits (Number of Subjects)' card, set max subjects (1 to 10) for FT, PTFL, and PT, then click 'Save Prep Configuration'.",
                                "In the 'Overloading Parameters' card, set 'Maximum Units Above Load Limit' (0 to 10) and click 'Save Overload Configuration'.",
                            ],
                        },
                    ],
                },
                {
                    tabId: "config-breaks",
                    tabName: "Break Periods",
                    summary:
                        "Define recurring daily or weekly break windows that the automated scheduler respects when placing classes.",
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
                                "Open the 'Roles' tab to toggle module permissions per role.",
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
                "Interactive system user manual providing searchable, module-by-module and tab-by-tab operational instructions for AceHub.",
            roles: ["Academic Head", "School Registrar", "Academic Assistant", "Faculty"],
            features: [
                "Instant keyword search across modules, sub-tabs, features, and step details",
                "Sub-tab switching for multi-tab modules (Courses, Subjects, Teachers, MAQ, Schedules, Configurations)",
                "Role badges and clear, numbered operational walkthroughs",
            ],
            steps: [
                {
                    stepNumber: 1,
                    title: "Search Across Manuals & Tasks",
                    description: "Filter system guides instantly using keywords.",
                    details: [
                        "Type any keyword (such as 'Excel', 'MAQ', 'Overload', 'Break', or 'Schedule') into the search bar at the top right.",
                        "The left module navigation list filters automatically to matching guides.",
                    ],
                },
                {
                    stepNumber: 2,
                    title: "Switch Modules & Sub-Tabs",
                    description: "Explore detailed instructions for specific pages and tabs.",
                    details: [
                        "Select any module from the left System Modules panel.",
                        "If a module contains multiple tabs (such as Subjects, MAQ, or Configurations), use the sub-tab pills below the module header to view instructions for each tab.",
                    ],
                },
            ],
        },
    ];

    const filteredModules = modules.filter((mod) => {
        const q = searchQuery.toLowerCase();
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
                        <p className="text-blue-100 text-xs sm:text-sm max-w-2xl">
                            Select any system module to view authorized roles, tab functions, Excel workflows, and step-by-step instructions.
                        </p>
                    </div>

                    {/* Live Search Bar */}
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
                        className="flex-1 space-y-1.5 overflow-y-auto p-3"
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
                    className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 sm:p-7 shadow-sm dark:border-gray-700 dark:bg-gray-800 space-y-6"
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
                            {currentModule.roles.map((role, idx) => (
                                <span
                                    key={idx}
                                    className="px-3 py-1 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/70 rounded-full text-xs font-medium"
                                >
                                    {role}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Key Features */}
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2.5">
                            Key Features & Capabilities
                        </h3>
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200 pl-11 leading-relaxed">
                                        {step.description}
                                    </p>

                                    <ul className="pl-11 space-y-2.5 pt-0.5">
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
        </div>
    );
}