"use client";

import {
  Configuration,
  fetchFacultyLoadConfig,
  fetchLecRoomID,
  fetchPrograms,
  fetchSubjectRequirements,
  getRoomsForGeneration,
} from "@/app/actions/system";
import sql from "@/lib/database";

// For Debugging Only
const testMode = false;

/** --- INTERFACES --- **/

export interface AssignedSubjectDetail {
  subject_id: string;
  course_code: string;
  course_name: string;
  lecture_units: number;
  lab_units: number;
  lab_type: string | null;
  year_term: string | null;
  required_aqs: string[];
}
export interface ProgramRecord {
  program_code: string;
  program_name: string;
  year_level: string;
  students: Record<string, unknown> | Array<unknown> | string;
  created_at: string;
  updated_at: string;
}
export interface SectionSubjectAssignment {
  sectionCode: string;
  subjects: AssignedSubjectDetail[];
}
export interface RoomForGeneration {
  room_id: string;
  room_name: string | null;
  room_type: string | null;
  floor_level: number | null;
}
export interface AssignedSubjectDetail {
  subject_id: string;
  course_code: string;
  course_name: string;
  lecture_units: number;
  lab_units: number;
  lab_type: string | null;
  year_term: string | null;
  required_aqs: string[];
}
export interface ScheduleEntry {
  sectionCode: string;
  subjectId: string; // <-- Added here
  courseCode: string;
  courseName: string;
  componentType: "LECTURE" | "LABORATORY" | "LECTURE_LAB_COMBINED";
  units: number;
  roomId: string | null;
  roomName: string;
  day: string;
  startTime: string;
  endTime: string;
}
export interface ScheduleAssignmentResult {
  success: boolean;
  scheduleEntries: ScheduleEntry[];
  error?: string;
}

/** --- FUNCTIONS --- **/

export async function generateProgramSections(
  _name: string,
  _curricula: string[],
  term: string,
): Promise<{ success: boolean; sections: string[]; error?: string }> {
  try {
    const configResult = await fetchFacultyLoadConfig();

    let maxStudents = 40;
    if (
      configResult &&
      configResult.success &&
      Array.isArray(configResult.data) &&
      configResult.data.length > 0
    ) {
      maxStudents = (configResult.data[0] as Configuration).max_students ?? 40;
    }

    const programsResponse = await fetchPrograms(
      null,
      "all",
      "program_code",
      "ASC",
      0,
    );
    const programs: ProgramRecord[] =
      programsResponse?.data || programsResponse || [];

    const generatedSections: string[] = [];
    const termLower = term.toLowerCase();

    // Determine whether we are generating for Term 1 or Term 2
    const isFirstTerm = termLower.includes("1") || termLower.includes("1st");
    const termOffset = isFirstTerm ? 1 : 2; // Term 1 adds 0 to formula, Term 2 adds 1

    for (const prog of programs) {
      const progCode = prog.program_code.trim();
      const yearLevelType = prog.year_level;
      const rawStudents = prog.students;

      const studentsMap: Record<string, unknown> =
        typeof rawStudents === "string"
          ? JSON.parse(rawStudents)
          : rawStudents || {};

      for (const [levelKey, count] of Object.entries(studentsMap)) {
        const studentCount = Number(count) || 0;
        if (studentCount <= 0) continue;

        const isShs =
          String(yearLevelType).toLowerCase() === "shs" ||
          Number(levelKey) >= 11;

        const sectionCount = Math.ceil(studentCount / maxStudents);

        for (let s = 1; s <= sectionCount; s++) {
          let sectionCode = "";

          if (isShs) {
            const gradeShort = levelKey === "12" ? "2" : "1";
            const sectionNumber = 10 + s;
            sectionCode = `${progCode}${gradeShort}${sectionNumber}`;
          } else {
            // Tertiary: levelKey is Year Level ("1", "2", "3", "4")
            const yearNum = Number(levelKey);
            if (isNaN(yearNum)) continue;

            // Convert Year (1-4) and Term (1 or 2) into your 1-8 sequence code:
            // Year 1, Term 1 = 1 | Year 1, Term 2 = 2
            // Year 2, Term 1 = 3 | Year 2, Term 2 = 4, etc.
            const yearTermCode = (yearNum - 1) * 2 + termOffset;

            const sectionNumber = 10 + s;
            sectionCode = `${progCode}${yearTermCode}${sectionNumber}`;
          }

          generatedSections.push(sectionCode);
        }
      }
    }

    const uniqueSections = Array.from(new Set(generatedSections));

    return { success: true, sections: uniqueSections };
  } catch (error) {
    console.error("Failed to generate program sections:", error);
    return {
      success: false,
      sections: [],
      error:
        (error as Error).message ||
        "Failed to generate sections for assignment.",
    };
  }
}

export async function assignSubjectsToSections(
  _name: string,
  curricula: string[],
  term: string,
  precomputedSections?: string[],
): Promise<{
  success: boolean;
  assignments: SectionSubjectAssignment[];
  error?: string;
}>
{
  try {
    let sections = precomputedSections;

    // If sections weren't passed separately, generate them first
    if (!sections || sections.length === 0) {
      const sectionResult = await generateProgramSections(
        _name,
        curricula,
        term,
      );
      if (!sectionResult.success || !sectionResult.sections) {
        throw new Error(sectionResult.error || "Failed to generate sections.");
      }
      sections = sectionResult.sections;
    }

    // Fetch filtered subject requirements using your database function
    const subjectResult = await fetchSubjectRequirements(curricula, term);
    if (!subjectResult.success || !subjectResult.data) {
      throw new Error(
        subjectResult.error || "Failed to fetch subject requirements.",
      );
    }
    const allSubjects = subjectResult.data;

    const assignments: SectionSubjectAssignment[] = [];

    if (testMode) {
      console.log("sched_name: " + _name);
      console.log("curricula:" + curricula);
      console.log("term: " + term);
      console.log("sections: " + sections);
      console.log("subjects: ", JSON.stringify(allSubjects, null, 2));
    }

    // Map subjects to sections based on the parsed digit breakdown
    for (const sectionCode of sections) {
      // Separate program letters from the trailing digits (e.g., BSIT311 -> "BSIT" and "311")
      const match = sectionCode.match(/^([A-Z]+)(\d+)$/);
      if (!match) {
        console.log(`⚠️ Skipped section (Regex failed): "${sectionCode}"`);
        continue;
      }

      const progCode = match[1].trim().toUpperCase();
      const digits = match[2]; // e.g., "311" or "111"

      // Separate further: First digit as indicator, last 2 digits as section number
      const indicatorDigit = digits.charAt(0); // e.g., "3" or "1"
      const sectionNum = digits.slice(1); // e.g., "11"

      if (testMode) {
        console.log(
          `🔎 Checking Section: ${sectionCode} -> Prog: "${progCode}", Indicator: "${indicatorDigit}", SectionNum: "${sectionNum}"`,
        );
      }

      const matchedSubjects = allSubjects.filter((subject) => {
        const subProg = (subject.program_code || "").trim().toUpperCase();

        if (subProg !== progCode) {
          return false;
        }

        const yt = (subject.year_term || "").toLowerCase().trim();
        const isSubjectSHS = yt.includes("grade");

        if (isSubjectSHS) {
          // Senior High School: indicator '1' = Grade 11, '2' = Grade 12
          const targetGrade = indicatorDigit === "2" ? "grade 12" : "grade 11";
          const shsMatch = yt.includes(targetGrade);

          if (testMode) {
            console.log(
              `   [SHS Match] Sec: ${sectionCode} | Sub: ${subject.course_code} | DB: "${yt}" | Target: "${targetGrade}" => Match: ${shsMatch}`,
            );
          }

          return shsMatch;
        } else {
          // Tertiary: indicator digit is the 1-8 sequence code
          const codeDigit = Number(indicatorDigit);
          const targetYearNum = Math.ceil(codeDigit / 2);
          const targetTermNum = codeDigit % 2 === 1 ? 1 : 2;

          const yearSubstrings = [
            `${targetYearNum}st`,
            `${targetYearNum}nd`,
            `${targetYearNum}rd`,
            `${targetYearNum}th`,
            `year ${targetYearNum}`,
            `${targetYearNum} year`,
          ];

          const termSubstrings = [
            `term ${targetTermNum}`,
            `semester ${targetTermNum}`,
            `sem ${targetTermNum}`,
            `t${targetTermNum}`,
          ];

          const yearMatched =
            yearSubstrings.some((sub) => yt.includes(sub)) ||
            yt.startsWith(`${targetYearNum} `) ||
            yt.includes(` ${targetYearNum} `);

          const termMatched =
            termSubstrings.some((sub) => yt.includes(sub)) ||
            yt.includes(`${targetTermNum}`);

          const isMatch = yearMatched && termMatched;

          if (testMode) {
            console.log(
              `👉 [Tertiary Match] Sec: ${sectionCode} | Sub: ${subject.course_code} (${subProg}) | DB: "${yt}" | Target Y:${targetYearNum}, T:${targetTermNum} => YearMatch: ${yearMatched}, TermMatch: ${termMatched} -> Result: ${isMatch}`,
            );
          }

          return isMatch;
        }
      });

      if (testMode) {
        console.log(
          `✅ Assigned ${matchedSubjects.length} subjects to section ${sectionCode}\n`,
        );
      }

      const structuredSubjects: AssignedSubjectDetail[] = matchedSubjects.map(
        (subject) => ({
          subject_id: subject.subject_id,
          course_code: subject.course_code,
          course_name: subject.course_name,
          lecture_units: Number(subject.lecture_units) || 0,
          lab_units: Number(subject.lab_units) || 0,
          lab_type: subject.lab_type,
          year_term: subject.year_term,
          required_aqs: subject.required_aqs || [],
        }),
      );

      assignments.push({
        sectionCode,
        subjects: structuredSubjects,
      });
    }

    return { success: true, assignments };
  } catch (error) {
    console.error("Failed to assign subjects to sections:", error);
    return {
      success: false,
      assignments: [],
      error:
        (error as Error).message || "Failed to assign subjects to sections.",
    };
  }
}

export async function generateRoomAndClassSchedules(
  _name: string,
  _curricula: string[],
  term: string,
): Promise<ScheduleAssignmentResult> {
  try {
    if (testMode) {
      console.log(
        `🚀 [Schedule Generation] Starting for schedule: "${_name}" | Term: "${term}"`,
      );
    }

    // 1. Fetch rooms using your SSF
    const roomsResult = await getRoomsForGeneration();
    if (!roomsResult.success || !roomsResult.data) {
      throw new Error(
        roomsResult.error || "Failed to fetch rooms for generation.",
      );
    }
    const rooms: RoomForGeneration[] = roomsResult.data;

    // Fetch the lecture room type ID using your SSF
    const lecRoomTypeResult = await fetchLecRoomID();
    const lecRoomData =
      lecRoomTypeResult.success && lecRoomTypeResult.data
        ? (lecRoomTypeResult.data as Array<{ room_type_id: string }>)
        : [];
    const lectureRoomTypeId =
      lecRoomData.length > 0 ? lecRoomData[0].room_type_id : null;

    if (testMode) {
      console.log(
        `🏢 Fetched ${rooms.length} rooms. Lecture Room Type ID: ${lectureRoomTypeId || "None Found"}`,
      );
    }

    // 2. Get section-to-subject assignments using your existing pipeline
    const assignmentResult = await assignSubjectsToSections(
      _name,
      _curricula,
      term,
    );
    if (!assignmentResult.success || !assignmentResult.assignments) {
      throw new Error(
        assignmentResult.error ||
        "Failed to resolve section subject assignments.",
      );
    }
    const sectionAssignments = assignmentResult.assignments;

    if (testMode) {
      console.log(
        `📋 Resolved subjects for ${sectionAssignments.length} sections.`,
      );
    }

    // 3. Define Timetable slots (Mon - Sat, 7:00 AM to 9:00 PM in 30-min increments)
    const days: string[] = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const timeSlots: string[] = generateTimeSlots("07:00", "21:00", 30);

    // Track occupied slots and section tracking structures
    const occupiedRoomSlots = new Set<string>();
    const occupiedSectionSlots = new Set<string>();
    const occupiedCourseSlots = new Set<string>();
    const sectionActiveDays = new Map<string, Set<string>>(); // sectionCode -> Set of active days

    // Pre-assign distinct preferred vacant days for sections sharing the same year group/tier
    const tierVacantDays = new Map<string, Set<string>>();
    const sectionPreferredVacantDay = new Map<string, string>();

    for (const assignment of sectionAssignments) {
      const sectionCode = assignment.sectionCode;
      const tierMatch = sectionCode.match(/^([A-Z]+\d+)/);
      const tierKey = tierMatch
        ? tierMatch[1].slice(0, -1)
        : sectionCode.slice(0, 5);

      if (!tierVacantDays.has(tierKey)) {
        tierVacantDays.set(tierKey, new Set<string>());
      }
      const usedVacantDaysForTier = tierVacantDays.get(tierKey)!;

      let chosenVacantDay = days.find((d) => !usedVacantDaysForTier.has(d));
      if (!chosenVacantDay) {
        chosenVacantDay = days[Math.floor(Math.random() * days.length)];
      }

      usedVacantDaysForTier.add(chosenVacantDay);
      sectionPreferredVacantDay.set(sectionCode, chosenVacantDay);

      if (testMode) {
        console.log(
          `🗓️ Section [${sectionCode}] assigned preferred vacant day: ${chosenVacantDay}`,
        );
      }
    }

    const scheduleEntries: ScheduleEntry[] = [];

    for (const assignment of sectionAssignments) {
      const { sectionCode, subjects } = assignment;
      if (!sectionActiveDays.has(sectionCode)) {
        sectionActiveDays.set(sectionCode, new Set<string>());
      }

      const preferredVacantDay =
        sectionPreferredVacantDay.get(sectionCode) || "Saturday";

      if (testMode) {
        console.log(`\n----------------------------------------`);
        console.log(
          `📌 Processing Section: ${sectionCode} (${subjects.length} subjects found)`,
        );
        console.log(`----------------------------------------`);
      }

      for (const subject of subjects) {
        const lectureUnits = subject.lecture_units || 0;
        const labUnits = subject.lab_units || 0;

        const lecHours = lectureUnits * 1.5;
        const labHours = labUnits * 2.0;
        const combinedHours = lecHours + labHours;

        const canMerge = lectureUnits > 0 && labUnits > 0 && combinedHours <= 5;
        const shouldMerge = canMerge ? Math.random() < 0.8 : false;

        if (testMode) {
          console.log(
            `   📚 Subject: [${subject.course_code}] ${subject.course_name} (Lec Units: ${lectureUnits}, Lab Units: ${labUnits})`,
          );
        }

        if (shouldMerge) {
          if (testMode) {
            console.log(
              `      ⚡ Rule Triggered: Merging Lec & Lab into a single session (${combinedHours} hrs) using lab room.`,
            );
          }
          scheduleSession(
            subject,
            sectionCode,
            "LECTURE_LAB_COMBINED",
            combinedHours,
            rooms,
            days,
            timeSlots,
            occupiedRoomSlots,
            occupiedSectionSlots,
            occupiedCourseSlots,
            sectionActiveDays,
            scheduleEntries,
            preferredVacantDay,
            subject.lab_type,
            lectureRoomTypeId,
          );
        } else {
          if (lectureUnits > 0) {
            const splitLecture = lecHours >= 5 ? Math.random() < 0.5 : false;

            if (splitLecture) {
              if (testMode) {
                console.log(
                  `      ✂️ Splitting Lecture (${lecHours} hrs) into two ${lecHours / 2} hr sessions.`,
                );
              }
              scheduleSession(
                subject,
                sectionCode,
                "LECTURE",
                lecHours / 2,
                rooms,
                days,
                timeSlots,
                occupiedRoomSlots,
                occupiedSectionSlots,
                occupiedCourseSlots,
                sectionActiveDays,
                scheduleEntries,
                preferredVacantDay,
                subject.lab_type,
                lectureRoomTypeId,
              );
              scheduleSession(
                subject,
                sectionCode,
                "LECTURE",
                lecHours / 2,
                rooms,
                days,
                timeSlots,
                occupiedRoomSlots,
                occupiedSectionSlots,
                occupiedCourseSlots,
                sectionActiveDays,
                scheduleEntries,
                preferredVacantDay,
                subject.lab_type,
                lectureRoomTypeId,
              );
            } else {
              scheduleSession(
                subject,
                sectionCode,
                "LECTURE",
                lecHours,
                rooms,
                days,
                timeSlots,
                occupiedRoomSlots,
                occupiedSectionSlots,
                occupiedCourseSlots,
                sectionActiveDays,
                scheduleEntries,
                preferredVacantDay,
                subject.lab_type,
                lectureRoomTypeId,
              );
            }
          }

          if (labUnits > 0) {
            scheduleSession(
              subject,
              sectionCode,
              "LABORATORY",
              labHours,
              rooms,
              days,
              timeSlots,
              occupiedRoomSlots,
              occupiedSectionSlots,
              occupiedCourseSlots,
              sectionActiveDays,
              scheduleEntries,
              preferredVacantDay,
              subject.lab_type,
              lectureRoomTypeId,
            );
          }
        }
      }
    }

    if (testMode) {
      console.log(
        `\n🎉 Schedule generation complete! Total generated entries: ${scheduleEntries.length}`,
      );
    }

    return {
      success: true,
      scheduleEntries,
    };
  } catch (error) {
    console.error("Failed to generate room and class schedules:", error);
    return {
      success: false,
      scheduleEntries: [],
      error:
        (error as Error).message ||
        "Failed to generate room and class schedules.",
    };
  }
}

// --- Helper Functions ---

function generateTimeSlots(
  start: string,
  end: string,
  intervalMins: number,
): string[] {
  const slots: string[] = [];
  const startParts = start.split(":").map(Number);
  const endParts = end.split(":").map(Number);

  let currHour = startParts[0];
  let currMin = startParts[1];
  const endHour = endParts[0];
  const endMin = endParts[1];

  while (currHour < endHour || (currHour === endHour && currMin < endMin)) {
    const startStr = `${String(currHour).padStart(2, "0")}:${String(currMin).padStart(2, "0")}`;

    currMin += intervalMins;
    if (currMin >= 60) {
      currHour += Math.floor(currMin / 60);
      currMin %= 60;
    }

    const endStr = `${String(currHour).padStart(2, "0")}:${String(currMin).padStart(2, "0")}`;
    slots.push(`${startStr} - ${endStr}`);
  }
  return slots;
}

function scheduleSession(
  subject: AssignedSubjectDetail,
  sectionCode: string,
  componentType: "LECTURE" | "LABORATORY" | "LECTURE_LAB_COMBINED",
  durationHours: number,
  rooms: RoomForGeneration[],
  days: string[],
  timeSlots: string[],
  occupiedRoomSlots: Set<string>,
  occupiedSectionSlots: Set<string>,
  occupiedCourseSlots: Set<string>,
  sectionActiveDays: Map<string, Set<string>>,
  scheduleEntries: ScheduleEntry[],
  preferredVacantDay: string,
  requiredLabTypeId?: string | null,
  lectureRoomTypeId?: string | null,
): void {
  const slotsNeeded = Math.ceil((durationHours * 60) / 30);
  const activeDays = sectionActiveDays.get(sectionCode)!;

  const availableRooms = rooms.filter((r: RoomForGeneration) => {
    if (componentType === "LECTURE") {
      if (lectureRoomTypeId) {
        return r.room_type === lectureRoomTypeId;
      }
      return r.room_type !== requiredLabTypeId;
    } else {
      return r.room_type === requiredLabTypeId;
    }
  });

  const fallbackRooms =
    availableRooms.length > 0
      ? availableRooms
      : rooms.filter((r) => {
        if (componentType === "LECTURE" && requiredLabTypeId) {
          return r.room_type !== requiredLabTypeId;
        }
        return true;
      });

  const prioritizedDays = [
    ...days.filter((d) => d !== preferredVacantDay),
    preferredVacantDay,
  ];

  // PASS 1: Try to schedule with a valid available room
  for (const day of prioritizedDays) {
    if (
      day === preferredVacantDay &&
      activeDays.size < 5 &&
      activeDays.size > 0
    ) {
      continue;
    }

    if (!activeDays.has(day) && activeDays.size >= 5) {
      continue;
    }

    for (let i = 0; i <= timeSlots.length - slotsNeeded; i++) {
      const sessionSlots = timeSlots.slice(i, i + slotsNeeded);

      const isSectionFree = sessionSlots.every(
        (slot: string) =>
          !occupiedSectionSlots.has(`${sectionCode}_${day}_${slot}`),
      );
      if (!isSectionFree) continue;

      const isCourseFree = sessionSlots.every(
        (slot: string) =>
          !occupiedCourseSlots.has(`${subject.course_code}_${day}_${slot}`),
      );
      if (!isCourseFree) continue;

      for (const room of fallbackRooms) {
        const isRoomFree = sessionSlots.every(
          (slot: string) =>
            !occupiedRoomSlots.has(`${room.room_id}_${day}_${slot}`),
        );

        if (isRoomFree) {
          sessionSlots.forEach((slot: string) => {
            occupiedSectionSlots.add(`${sectionCode}_${day}_${slot}`);
            occupiedRoomSlots.add(`${room.room_id}_${day}_${slot}`);
            occupiedCourseSlots.add(`${subject.course_code}_${day}_${slot}`);
          });
          activeDays.add(day);

          const startTime = sessionSlots[0].split(" - ")[0];
          const endTime = sessionSlots[sessionSlots.length - 1].split(" - ")[1];

          let totalUnits = subject.lecture_units + subject.lab_units;
          if (componentType === "LECTURE") totalUnits = subject.lecture_units;
          if (componentType === "LABORATORY") totalUnits = subject.lab_units;

          if (testMode) {
            console.log(
              `         ✅ Scheduled [${subject.course_code}] (${componentType}) -> Room: ${room.room_name} | Day: ${day} (${startTime} - ${endTime})`,
            );
          }

          scheduleEntries.push({
            sectionCode,
            subjectId: subject.subject_id,
            courseCode: subject.course_code,
            courseName: subject.course_name,
            componentType,
            units: totalUnits,
            roomId: room.room_id,
            roomName: room.room_name || "Unassigned Room",
            day,
            startTime,
            endTime,
          });
          return;
        }
      }
    }
  }

  // PASS 2 (Fallback): If no room is available, schedule without a room as long as section & course are free
  for (const day of prioritizedDays) {
    if (
      day === preferredVacantDay &&
      activeDays.size < 5 &&
      activeDays.size > 0
    ) {
      continue;
    }

    if (!activeDays.has(day) && activeDays.size >= 5) {
      continue;
    }

    for (let i = 0; i <= timeSlots.length - slotsNeeded; i++) {
      const sessionSlots = timeSlots.slice(i, i + slotsNeeded);

      const isSectionFree = sessionSlots.every(
        (slot: string) =>
          !occupiedSectionSlots.has(`${sectionCode}_${day}_${slot}`),
      );
      if (!isSectionFree) continue;

      const isCourseFree = sessionSlots.every(
        (slot: string) =>
          !occupiedCourseSlots.has(`${subject.course_code}_${day}_${slot}`),
      );
      if (!isCourseFree) continue;

      sessionSlots.forEach((slot: string) => {
        occupiedSectionSlots.add(`${sectionCode}_${day}_${slot}`);
        occupiedCourseSlots.add(`${subject.course_code}_${day}_${slot}`);
      });
      activeDays.add(day);

      const startTime = sessionSlots[0].split(" - ")[0];
      const endTime = sessionSlots[sessionSlots.length - 1].split(" - ")[1];

      let totalUnits = subject.lecture_units + subject.lab_units;
      if (componentType === "LECTURE") totalUnits = subject.lecture_units;
      if (componentType === "LABORATORY") totalUnits = subject.lab_units;

      if (testMode) {
        console.warn(
          `         ⚠️ Scheduled WITHOUT ROOM [${subject.course_code}] (${componentType}) -> Day: ${day} (${startTime} - ${endTime})`,
        );
      }

      scheduleEntries.push({
        sectionCode,
        subjectId: subject.subject_id,
        courseCode: subject.course_code,
        courseName: subject.course_name,
        componentType,
        units: totalUnits,
        roomId: null,
        roomName: "Unassigned Room",
        day,
        startTime,
        endTime,
      });
      return;
    }
  }

  if (testMode) {
    console.warn(
      `❌ [Failed Completely] Could not find any valid time slot for ${subject.course_code} (${componentType}) in section ${sectionCode}`,
    );
  }
}