"use client";

import {
  Configuration,
  fetchBreakPeriods,
  fetchFacultyLoadConfig,
  fetchLecRoomID,
  fetchPrograms,
  fetchSubjectRequirements,
  getRoomsForGeneration,
  SubjectRequirementRecord,
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
export interface ScheduleEntry {
  sectionCode: string;
  subjectId: string;
  courseCode: string;
  courseName: string;
  componentType: "LECTURE" | "LABORATORY";
  units: number;
  roomId: string | null;
  roomName: string;
  day: string;
  startTime: string;
  endTime: string;
  type: string;
}
export interface ScheduleAssignmentResult {
  success: boolean;
  scheduleEntries: ScheduleEntry[];
  error?: string;
}

export interface BreakPeriodRecord {
  break_id: string;
  break_description: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

/** --- FUNCTIONS --- **/

export async function fetchSubjectsForGeneration(
  curricula: string[],
  term: string,
): Promise<{
  success: boolean;
  data: SubjectRequirementRecord[];
  error?: string;
}> {
  try {
    const subjectResult = await fetchSubjectRequirements(curricula, term);
    if (!subjectResult.success || !subjectResult.data) {
      throw new Error(
        subjectResult.error || "Failed to fetch subject requirements.",
      );
    }
    const allSubjects: SubjectRequirementRecord[] =
      subjectResult.data as SubjectRequirementRecord[];
    return { success: true, data: allSubjects };
  } catch (error) {
    console.error("Failed to fetch subjects for generation:", error);
    return {
      success: false,
      data: [],
      error:
        (error as Error).message || "Failed to fetch subjects for generation.",
    };
  }
}

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

    const isFirstTerm = termLower.includes("1") || termLower.includes("1st");
    const termNum = isFirstTerm ? 1 : 2;
    const termOffset = isFirstTerm ? 1 : 2; // For tertiary sequence formula

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
            const gradeIndicator = levelKey === "12" ? "2" : "1";
            const gradeTermCode = `${gradeIndicator}${termNum}`;
            const sectionNumber = String(s).padStart(1, "0");
            sectionCode = `${progCode}${gradeTermCode}${sectionNumber}`;
          } else {
            const yearNum = Number(levelKey);
            if (isNaN(yearNum)) continue;

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
  term: string,
  precomputedSections?: string[],
  precomputedSubjects?: SubjectRequirementRecord[],
): Promise<{
  success: boolean;
  assignments: SectionSubjectAssignment[];
  error?: string;
}> {
  try {
    let sections = precomputedSections;

    if (!sections || sections.length === 0) {
      const sectionResult = await generateProgramSections(_name, [], term);
      if (!sectionResult.success || !sectionResult.sections) {
        throw new Error(sectionResult.error || "Failed to generate sections.");
      }
      sections = sectionResult.sections;
    }

    const allSubjects: SubjectRequirementRecord[] = precomputedSubjects || [];
    if (allSubjects.length === 0) {
      throw new Error(
        "No precomputed subject requirements provided for section assignment.",
      );
    }

    const assignments: SectionSubjectAssignment[] = [];
    const termNum = term.toLowerCase().includes("2") ? 2 : 1;

    if (testMode) {
      console.log("sched_name: " + _name);
      console.log("term: " + term);
      console.log("sections: " + sections);
      console.log("subjects count: ", allSubjects.length);
    }

    for (const sectionCode of sections) {
      const shsMatch = sectionCode.match(/^([A-Z]+)([12])(\d)(\d+)$/);

      const matchedSubjects = allSubjects.filter((subject) => {
        const subProg = (subject.program_code || "").trim().toUpperCase();
        const yt = (subject.year_term || "").toLowerCase().trim();
        const isSubjectSHS = yt.includes("shs") || yt.includes("grade");

        if (shsMatch) {
          const [, progCode, gradeIndicator, sectionTermStr] = shsMatch;

          // Strict Program Matching: Only match exact program attribute or GEN/CORE general subjects
          const progMatches =
            subProg === progCode ||
            subProg === "GEN" ||
            subProg === "CORE";
          if (!progMatches) return false;

          if (isSubjectSHS) {
            const targetGradeNum = gradeIndicator === "2" ? "12" : "11";
            const gradeMatches = yt.includes(targetGradeNum);
            const termMatches =
              yt.includes(`term ${sectionTermStr}`) ||
              yt.includes(`semester ${sectionTermStr}`) ||
              yt.includes(`${sectionTermStr}`);

            return gradeMatches && termMatches;
          }
          return false;
        } else {
          // Tertiary Strict Matching
          const match = sectionCode.match(/^([A-Z]+)(\d+)$/);
          if (!match) return false;

          const progCode = match[1].trim().toUpperCase();
          const digits = match[2];
          const indicatorDigit = digits.charAt(0);

          if (subProg !== progCode || isSubjectSHS) {
            return false;
          }

          const codeDigit = Number(indicatorDigit);
          const targetYearNum = Math.ceil(codeDigit / 2);
          const targetTermNum = codeDigit % 2 === 1 ? 1 : 2;

          const yearMatched =
            yt.includes(`${targetYearNum}`) ||
            yt.includes(
              targetYearNum === 1
                ? "1st"
                : targetYearNum === 2
                  ? "2nd"
                  : targetYearNum === 3
                    ? "3rd"
                    : "4th",
            );

          const termMatched = yt.includes(`${targetTermNum}`);

          return yearMatched && termMatched;
        }
      });

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
  precomputedSections?: string[],
  precomputedSubjects?: SubjectRequirementRecord[],
): Promise<ScheduleAssignmentResult> {
  try {
    const roomsResult = await getRoomsForGeneration();
    if (!roomsResult.success || !roomsResult.data) {
      throw new Error(
        roomsResult.error || "Failed to fetch rooms for generation.",
      );
    }
    const rooms: RoomForGeneration[] = roomsResult.data;

    const breakPeriodsResult = await fetchBreakPeriods(
      null,
      "day_of_week",
      "ASC",
      -1,
      1,
    );
    const breakPeriods: BreakPeriodRecord[] =
      (breakPeriodsResult?.data as BreakPeriodRecord[]) || [];

    const lecRoomTypeResult = await fetchLecRoomID();
    const lecRoomData =
      lecRoomTypeResult.success && lecRoomTypeResult.data
        ? (lecRoomTypeResult.data as Array<{ room_type_id: string }>)
        : [];
    const lectureRoomTypeId =
      lecRoomData.length > 0 ? lecRoomData[0].room_type_id : null;

    let subjectsToUse = precomputedSubjects;
    if (!subjectsToUse || subjectsToUse.length === 0) {
      const fetchedSubjects = await fetchSubjectsForGeneration(
        _curricula,
        term,
      );
      if (!fetchedSubjects.success) {
        throw new Error(fetchedSubjects.error || "Failed to fetch subjects.");
      }
      subjectsToUse = fetchedSubjects.data;
    }

    const assignmentResult = await assignSubjectsToSections(
      _name,
      term,
      precomputedSections,
      subjectsToUse,
    );
    if (!assignmentResult.success || !assignmentResult.assignments) {
      throw new Error(
        assignmentResult.error ||
        "Failed to resolve section subject assignments.",
      );
    }
    const sectionAssignments = assignmentResult.assignments;

    const days: string[] = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const timeSlots: string[] = generateTimeSlots("07:00", "21:00", 30);

    const occupiedRoomSlots = new Set<string>();
    const occupiedSectionSlots = new Set<string>();
    const occupiedCourseSlots = new Set<string>();
    const sectionActiveDays = new Map<string, Set<string>>();

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
    }

    const scheduleEntries: ScheduleEntry[] = [];

    for (const assignment of sectionAssignments) {
      const { sectionCode, subjects } = assignment;
      if (!sectionActiveDays.has(sectionCode)) {
        sectionActiveDays.set(sectionCode, new Set<string>());
      }

      const preferredVacantDay =
        sectionPreferredVacantDay.get(sectionCode) || "Saturday";

      for (const subject of subjects) {
        const lectureUnits = subject.lecture_units || 0;
        const labUnits = subject.lab_units || 0;

        const lecHours = lectureUnits * 1.0; // Change from 1.5 to 1.0
        const labHours = labUnits * 1.0;     // Change from 2.0 to 1.0

        // Schedule Lecture Component Separately if lectureUnits > 0
        if (lectureUnits > 0) {
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
            breakPeriods,
            subject.lab_type,
            lectureRoomTypeId,
          );
        }

        // Schedule Laboratory Component Separately if labUnits > 0
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
            breakPeriods,
            subject.lab_type,
            lectureRoomTypeId,
          );
        }
      }
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

function isBreakTime(
  day: string,
  slot: string,
  breakPeriods: BreakPeriodRecord[],
): boolean {
  const [slotStart, slotEnd] = slot.split(" - ");
  const slotStartMinutes = timeToMinutes(slotStart);
  const slotEndMinutes = timeToMinutes(slotEnd);

  const dayMapping: Record<string, number> = {
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  const currentDayNum = dayMapping[day] || 1;
  const isWeekday = currentDayNum >= 1 && currentDayNum <= 5;

  for (const bp of breakPeriods) {
    const breakDayId = Number(bp.day_of_week);

    const matchesDay =
      breakDayId === 0 ||
      (breakDayId === 7 && isWeekday) ||
      breakDayId === currentDayNum;

    if (!matchesDay) {
      continue;
    }

    const bpStart = (bp.start_time || "").slice(0, 5);
    const bpEnd = (bp.end_time || "").slice(0, 5);

    if (!bpStart || !bpEnd) continue;

    const bpStartMinutes = timeToMinutes(bpStart);
    const bpEndMinutes = timeToMinutes(bpEnd);

    if (slotStartMinutes < bpEndMinutes && slotEndMinutes > bpStartMinutes) {
      return true;
    }
  }

  return false;
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function scheduleSession(
  subject: AssignedSubjectDetail,
  sectionCode: string,
  componentType: "LECTURE" | "LABORATORY",
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
  breakPeriods: BreakPeriodRecord[],
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

  // Pass 1: Room & Break Period Aware Assignment
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

      const hitsBreak = sessionSlots.some((slot) =>
        isBreakTime(day, slot, breakPeriods),
      );
      if (hitsBreak) continue;

      const isSectionFree = sessionSlots.every(
        (slot: string) =>
          !occupiedSectionSlots.has(`${sectionCode}_${day}_${slot}`),
      );
      if (!isSectionFree) continue;

      const isCourseFree = sessionSlots.every(
        (slot: string) =>
          !occupiedCourseSlots.has(`${subject.course_code}_${componentType}_${day}_${slot}`),
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
            occupiedCourseSlots.add(`${subject.course_code}_${componentType}_${day}_${slot}`);
          });
          activeDays.add(day);

          const startTime = sessionSlots[0].split(" - ")[0];
          const endTime = sessionSlots[sessionSlots.length - 1].split(" - ")[1];

          const units =
            componentType === "LECTURE"
              ? subject.lecture_units
              : subject.lab_units;

          scheduleEntries.push({
            sectionCode,
            subjectId: subject.subject_id,
            courseCode: subject.course_code,
            courseName: subject.course_name,
            componentType,
            units,
            roomId: room.room_id,
            roomName: room.room_name || "Unassigned Room",
            day,
            startTime,
            endTime,
            type: componentType.toLowerCase(), // e.g. "lecture" or "laboratory"
          });
          return;
        }
      }
    }
  }

  // Pass 2: Fallback Pass without room constraint
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

      const hitsBreak = sessionSlots.some((slot) =>
        isBreakTime(day, slot, breakPeriods),
      );
      if (hitsBreak) continue;

      const isSectionFree = sessionSlots.every(
        (slot: string) =>
          !occupiedSectionSlots.has(`${sectionCode}_${day}_${slot}`),
      );
      if (!isSectionFree) continue;

      const isCourseFree = sessionSlots.every(
        (slot: string) =>
          !occupiedCourseSlots.has(`${subject.course_code}_${componentType}_${day}_${slot}`),
      );
      if (!isCourseFree) continue;

      sessionSlots.forEach((slot: string) => {
        occupiedSectionSlots.add(`${sectionCode}_${day}_${slot}`);
        occupiedCourseSlots.add(`${subject.course_code}_${componentType}_${day}_${slot}`);
      });
      activeDays.add(day);

      const startTime = sessionSlots[0].split(" - ")[0];
      const endTime = sessionSlots[sessionSlots.length - 1].split(" - ")[1];

      const units =
        componentType === "LECTURE"
          ? subject.lecture_units
          : subject.lab_units;

      scheduleEntries.push({
        sectionCode,
        subjectId: subject.subject_id,
        courseCode: subject.course_code,
        courseName: subject.course_name,
        componentType,
        units,
        roomId: null,
        roomName: "Unassigned Room",
        day,
        startTime,
        endTime,
        type: componentType.toLowerCase(),
      });
      return;
    }
  }
}