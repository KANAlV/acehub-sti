"use client";

import {
  Configuration,
  fetchBreakPeriods,
  fetchFacultyLoadConfig,
  fetchLecRoomID,
  fetchPrograms,
  fetchRoomTypeList,
  fetchSubjectRequirements,
  fetchTeachers,
  getRoomsForGeneration,
  getTeachersWithAqAndFcce,
  SubjectRequirementRecord,
} from "@/app/actions/system";
import sql from "@/lib/database";
import {
  findPreferredRoom,
  findPreferredRooms,
  getTeacherPreferenceMatchScore,
} from "@/utils/autoSchedulePreferences";
import {
  formatGeneratedScheduleValidationError,
  validateGeneratedSchedule,
} from "@/utils/autoScheduleValidation";
import {
  getFatigueRiskEntries,
  repairGeneratedSchedule,
  trySwapSectionScheduleDays,
  type RepairScheduleOptions,
} from "@/utils/autoScheduleRepair";
import { parseSubjectYearTerm } from "@/utils/subjectYearTerm";
import { isTeacherTimeWithinAvailability } from "@/utils/teacherAvailability";

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
export interface CurriculumGenerationSelection {
  curriculumId: string;
  curriculumVersion: string;
  selectedYearLevels: string[];
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
  teacherId: string | null;
  teacherName: string | null;
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

export interface TeacherRecord {
  teacher_id: string;
  pscs_id?: string;
  email?: string;
  full_name: string;
  teacher_code: string;
  department?: string;
  employment_type?: string;
  status?: string;
  availability?: unknown;
  aqs?: unknown;
  fcces?: unknown;
  preferences?: {
    preferred_rooms?: string[];
    preferred_times?: Array<
      string | { day: string; start_time: string; end_time: string }
    >;
    preferred_year?: string[];
    preferred_subjects?: string[];
  };
}

export interface TeacherAssignmentResult {
  success: boolean;
  scheduleEntries: ScheduleEntry[];
  error?: string;
}

/** --- FUNCTIONS --- **/

export async function fetchSubjectsForGeneration(
  curricula: string[],
  tertiaryTerm: string,
  shsTerm: string = "Term 1",
  curriculumSelections?: CurriculumGenerationSelection[],
): Promise<{
  success: boolean;
  data: SubjectRequirementRecord[];
  error?: string;
}> {
  try {
    const subjectResult = await fetchSubjectRequirements(curricula);
    if (!subjectResult.success || !subjectResult.data) {
      throw new Error(
        subjectResult.error || "Failed to fetch subject requirements.",
      );
    }
    const allSubjects: SubjectRequirementRecord[] =
      subjectResult.data as SubjectRequirementRecord[];

    // Parse tertiary term digit (1-2) from "Semester 1" / "Semester 2"
    const tertiaryTermNum = parseInt(tertiaryTerm.replace(/[^0-9]/g, "")) || 1;
    const tertiaryTermDigit =
      tertiaryTermNum > 2 ? 2 : tertiaryTermNum < 1 ? 1 : tertiaryTermNum;

    // Parse SHS term digit (1-4)
    const shsTermNum = parseInt(shsTerm.replace(/[^0-9]/g, "")) || 1;
    const shsTermDigit = shsTermNum > 4 ? 4 : shsTermNum < 1 ? 1 : shsTermNum;

    // Filter subjects by selected curriculum levels and term/semester.
    const filteredSubjects = allSubjects.filter((subject) => {
      const yearTerm = parseSubjectYearTerm(subject.year_term);
      if (!yearTerm?.term) return false;

      if (curriculumSelections) {
        const curriculum = curriculumSelections.find(
          (selection) =>
            selection.curriculumId === subject.curriculum ||
            selection.curriculumVersion.trim().toLowerCase() ===
              (subject.curriculum || "").trim().toLowerCase(),
        );
        if (
          !curriculum ||
          !curriculum.selectedYearLevels.includes(yearTerm.yearLevel)
        ) {
          return false;
        }
      }

      const selectedTerm = yearTerm.isShs
        ? shsTermDigit
        : tertiaryTermDigit;
      return yearTerm.term === String(selectedTerm);
    });

    return { success: true, data: filteredSubjects };
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
  tertiaryTerm: string,
  shsTerm: string = "Term 1",
  subjectProgramCodes?: string[],
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
    const allowedProgramCodes =
      subjectProgramCodes === undefined
        ? null
        : new Set(
            subjectProgramCodes.map((programCode) =>
              programCode.trim().toUpperCase(),
            ),
          );

    const generatedSections: string[] = [];

    // Parse tertiary term
    const tertiaryTermLower = tertiaryTerm.toLowerCase();
    const isTertiaryFirstTerm =
      tertiaryTermLower.includes("1") || tertiaryTermLower.includes("1st");
    const tertiaryTermOffset = isTertiaryFirstTerm ? 1 : 2;

    // Parse SHS term (supports Term 1-4)
    const shsTermNum = parseInt(shsTerm.replace(/[^0-9]/g, "")) || 1;
    const shsTermDigit = shsTermNum > 4 ? 4 : shsTermNum < 1 ? 1 : shsTermNum;

    for (const prog of programs) {
      const progCode = prog.program_code.trim();
      if (
        allowedProgramCodes &&
        !allowedProgramCodes.has(progCode.toUpperCase())
      ) {
        continue;
      }
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
            const sectionNumber = 10 + s;
            sectionCode = `${progCode}${gradeIndicator}${sectionNumber}`;
          } else {
            const yearNum = Number(levelKey);
            if (isNaN(yearNum)) continue;

            const yearTermCode = (yearNum - 1) * 2 + tertiaryTermOffset;
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
  tertiaryTerm: string,
  precomputedSections?: string[],
  precomputedSubjects?: SubjectRequirementRecord[],
  shsTerm: string = "Term 1",
): Promise<{
  success: boolean;
  assignments: SectionSubjectAssignment[];
  error?: string;
}> {
  try {
    const allSubjects: SubjectRequirementRecord[] = precomputedSubjects || [];
    let sections = precomputedSections;

    if (!sections || sections.length === 0) {
      const sectionResult = await generateProgramSections(
        _name,
        [],
        tertiaryTerm,
        shsTerm,
        allSubjects.map((subject) => subject.program_code || ""),
      );
      if (!sectionResult.success || !sectionResult.sections) {
        throw new Error(sectionResult.error || "Failed to generate sections.");
      }
      sections = sectionResult.sections;
    }

    if (allSubjects.length === 0) {
      throw new Error(
        "No precomputed subject requirements provided for section assignment.",
      );
    }

    const assignments: SectionSubjectAssignment[] = [];

    for (const sectionCode of sections) {
      const shsMatch = sectionCode.match(/^([A-Z]+)([12])(\d{2})$/);

      const matchedSubjects = allSubjects.filter((subject) => {
        const subProg = (subject.program_code || "").trim().toUpperCase();
        const yt = (subject.year_term || "").toLowerCase().trim();
        const parsedYearTerm = parseSubjectYearTerm(subject.year_term);
        const isSubjectSHS =
          parsedYearTerm?.isShs ??
          (yt.includes("shs") || yt.includes("grade"));

        // Helper: try matching as a tertiary section
        function tryTertiaryMatch(): boolean {
          const match = sectionCode.match(/^([A-Z]+)(\d+)$/);
          if (!match) return false;

          const progCode = match[1].trim().toUpperCase();
          const digits = match[2];

          // Section code format: {ProgramCode}{YearTermCode}{SectionNumber}
          // SectionNumber is always 2 digits (10, 11, 12, ...)
          // YearTermCode = (year - 1) * 2 + termOffset (where termOffset is 1 or 2)
          if (digits.length < 3) {
            return false;
          }

          const yearTermCodeStr = digits.slice(0, -2);
          const yearTermCode = Number(yearTermCodeStr);
          if (isNaN(yearTermCode)) return false;

          if (subProg !== progCode || isSubjectSHS) {
            return false;
          }

          // Reverse-calculate the year from yearTermCode.
          // yearTermCode = (year - 1) * 2 + termOffset
          // termOffset is 1 (1st term) or 2 (2nd term)
          // So: year = floor((yearTermCode - 1) / 2) + 1
          const targetYearNum = Math.floor((yearTermCode - 1) / 2) + 1;

          // Match year using word boundaries to avoid "2" matching "12"
          const yearWord =
            targetYearNum === 1
              ? "1st"
              : targetYearNum === 2
                ? "2nd"
                : targetYearNum === 3
                  ? "3rd"
                  : "4th";

          // Use regex word boundary to match the year ordinal exactly
          const yearRegex = new RegExp(`\\b${yearWord}\\b`, "i");
          const yearMatched =
            parsedYearTerm?.yearLevel === String(targetYearNum) ||
            yearRegex.test(yt);

          // Tertiary year_term only stores the year (e.g. "1st Year"), not the term.
          // The term is already encoded in the section code, so we only match by year.
          return yearMatched;
        }

        if (shsMatch) {
          const [, progCode, gradeIndicator] = shsMatch;

          const progMatches =
            subProg === progCode || subProg === "GEN" || subProg === "CORE";
          if (!progMatches) return false;

          if (isSubjectSHS) {
            const targetGradeNum = gradeIndicator === "2" ? "12" : "11";
            // Use word boundary to avoid "11" matching inside other numbers
            const gradeRegex = new RegExp(`\\b${targetGradeNum}\\b`, "i");
            const gradeMatches =
              parsedYearTerm?.yearLevel === targetGradeNum ||
              gradeRegex.test(yt);

            return gradeMatches;
          }
          // Section looks like SHS but subject is tertiary — try tertiary matching
          return tryTertiaryMatch();
        } else {
          return tryTertiaryMatch();
        }
      });

      if (matchedSubjects.length === 0) continue;

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
  tertiaryTerm: string,
  precomputedSections?: string[],
  precomputedSubjects?: SubjectRequirementRecord[],
  shsTerm: string = "Term 1",
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

    // Fetch room types to identify kitchen labs
    const roomTypesResult = await fetchRoomTypeList(null, "ASC", -1, 1);
    const kitchenRoomTypeIds = new Set<string>();
    const ojtRoomTypeIds = new Set<string>();
    if (roomTypesResult.success && roomTypesResult.data) {
      for (const rt of roomTypesResult.data) {
        if (rt.value && rt.value.toLowerCase().includes("kitchen")) {
          kitchenRoomTypeIds.add(rt.room_type_id);
        }
        if (rt.value?.trim().toLowerCase() === "ojt") {
          ojtRoomTypeIds.add(rt.room_type_id.trim().toLowerCase());
        }
      }
    }

    let subjectsToUse = precomputedSubjects;
    if (!subjectsToUse || subjectsToUse.length === 0) {
      const fetchedSubjects = await fetchSubjectsForGeneration(
        _curricula,
        tertiaryTerm,
      );
      if (!fetchedSubjects.success) {
        throw new Error(fetchedSubjects.error || "Failed to fetch subjects.");
      }
      subjectsToUse = fetchedSubjects.data;
    }

    const assignmentResult = await assignSubjectsToSections(
      _name,
      tertiaryTerm,
      precomputedSections,
      subjectsToUse,
      shsTerm,
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
    const timeSlots: string[] = generateTimeSlots("07:00", "22:00", 30);
    const shsTimeSlots: string[] = generateTimeSlots("07:00", "18:00", 30);

    const occupiedRoomSlots = new Set<string>();
    const occupiedSectionSlots = new Set<string>();
    const occupiedCourseSlots = new Set<string>();
    const occupiedSubjectTimeSlots = new Set<string>();
    const sectionActiveDays = new Map<string, Set<string>>();

    // Track how many distinct subjects are scheduled on each day per section.
    // Used to balance: fill each of 5 days with 2 subjects first, then rotate 1 per day.
    const sectionDaySubjectCount = new Map<string, Map<string, number>>();

    const tierVacantDays = new Map<string, Set<string>>();
    const sectionPreferredVacantDay = new Map<string, string>();

    const shsDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

    // Count subjects per tertiary section to balance day selection across the week.
    // Sections with more subjects should have their vacant day on the most crowded day,
    // so their active days are the least crowded ones.
    const sectionSubjectCount = new Map<string, number>();
    for (const assignment of sectionAssignments) {
      const isShsSection = /^([A-Z]+)([12])(\d{2})$/.test(
        assignment.sectionCode,
      );
      if (!isShsSection) {
        sectionSubjectCount.set(
          assignment.sectionCode,
          assignment.subjects.length,
        );
      }
    }

    // Track cumulative subject load per day across all tertiary sections in a tier.
    // Used to pick the vacant day as the most loaded day, spreading schedules evenly.
    const tierDayLoad = new Map<string, Map<string, number>>();

    for (const assignment of sectionAssignments) {
      const sectionCode = assignment.sectionCode;
      const isShsSection = /^([A-Z]+)([12])(\d{2})$/.test(sectionCode);

      if (isShsSection) {
        // SHS sections always use Mon-Fri; Saturday is the fixed vacant day
        sectionPreferredVacantDay.set(sectionCode, "Saturday");
        sectionActiveDays.set(sectionCode, new Set(shsDays));
        continue;
      }

      // Tertiary sections: select 5 active days from Mon-Sat with a preferred vacant day
      const tierMatch = sectionCode.match(/^([A-Z]+\d+)/);
      const tierKey = tierMatch
        ? tierMatch[1].slice(0, -1)
        : sectionCode.slice(0, 5);

      if (!tierVacantDays.has(tierKey)) {
        tierVacantDays.set(tierKey, new Set<string>());
      }
      const usedVacantDaysForTier = tierVacantDays.get(tierKey)!;

      if (!tierDayLoad.has(tierKey)) {
        tierDayLoad.set(tierKey, new Map());
        for (const day of days) {
          tierDayLoad.get(tierKey)!.set(day, 0);
        }
      }
      const dayLoad = tierDayLoad.get(tierKey)!;

      // Choose the vacant day as the day with the highest current load (most crowded).
      // This way the section's 5 active days will be the least crowded days.
      // If all days have equal load, fall back to the first unused day for variety.
      const subjectCount = sectionSubjectCount.get(sectionCode) || 0;
      let chosenVacantDay: string;

      const maxLoad = Math.max(...days.map((d) => dayLoad.get(d) || 0));
      const maxLoadDays = days.filter((d) => (dayLoad.get(d) || 0) === maxLoad);

      if (maxLoadDays.length > 0) {
        // Among days with max load, prefer unused vacant days for variety
        const unusedMaxDays = maxLoadDays.filter(
          (d) => !usedVacantDaysForTier.has(d),
        );
        if (unusedMaxDays.length > 0) {
          chosenVacantDay = unusedMaxDays[0];
        } else if (usedVacantDaysForTier.size < days.length) {
          // All max-load days are used; pick first unused day
          chosenVacantDay = days.find((d) => !usedVacantDaysForTier.has(d))!;
        } else {
          // All days used as vacant days; pick the max load day
          chosenVacantDay = maxLoadDays[0];
        }
      } else {
        chosenVacantDay = days[0];
      }

      // Update day loads: add subject count to all days EXCEPT the chosen vacant day
      // (since the section won't have classes on its vacant day)
      for (const day of days) {
        if (day !== chosenVacantDay) {
          dayLoad.set(day, (dayLoad.get(day) || 0) + subjectCount);
        }
      }

      usedVacantDaysForTier.add(chosenVacantDay);
      sectionPreferredVacantDay.set(sectionCode, chosenVacantDay);
      sectionActiveDays.set(sectionCode, new Set<string>());
    }

    const scheduleEntries: ScheduleEntry[] = [];

    // Track scheduled components for same-day pairing: key = "sectionCode_subjectId_componentType"
    const scheduledComponents = new Map<
      string,
      { day: string; startIndex: number; endIndex: number }
    >();

    // Initialize day subject count map for each section
    for (const assignment of sectionAssignments) {
      if (!sectionDaySubjectCount.has(assignment.sectionCode)) {
        sectionDaySubjectCount.set(assignment.sectionCode, new Map());
      }
      for (const day of days) {
        sectionDaySubjectCount.get(assignment.sectionCode)!.set(day, 0);
      }
    }

    /**
     * Return the 5 active days for a section sorted by subject count (ascending).
     * Days with fewer subjects come first, ensuring balanced distribution:
     * - First 10 subjects: 2 per day across 5 days
     * - Remaining subjects: 1 per day, rotating through the 5 days
     * If fewer than 5 active days, also consider inactive days that can be added.
     */
    function getDaysSortedBySubjectCount(
      sectionCode: string,
      preferredVacantDay: string,
    ): string[] {
      const activeDays = sectionActiveDays.get(sectionCode)!;
      const dayCounts = sectionDaySubjectCount.get(sectionCode)!;

      // Build list of candidate days: active days first, then inactive days that can be added
      const candidateDays: string[] = [];

      // Add active days
      for (const day of days) {
        if (activeDays.has(day)) {
          candidateDays.push(day);
        }
      }

      // If fewer than 5 active days, add inactive days (excluding preferred vacant day if still building)
      if (activeDays.size < 5) {
        for (const day of days) {
          if (!activeDays.has(day) && day !== preferredVacantDay) {
            candidateDays.push(day);
          }
        }
        // Add preferred vacant day last
        candidateDays.push(preferredVacantDay);
      }

      // Sort by subject count ascending, then by day order for stability
      const dayOrder: Record<string, number> = {};
      days.forEach((d, i) => (dayOrder[d] = i));

      candidateDays.sort((a, b) => {
        const countA = dayCounts.get(a) || 0;
        const countB = dayCounts.get(b) || 0;
        if (countA !== countB) return countA - countB;
        return dayOrder[a] - dayOrder[b];
      });

      return candidateDays;
    }

    // Helper to schedule a single subject, preserving all existing logic
    function scheduleSubject(
      subject: AssignedSubjectDetail,
      sectionCode: string,
      sectionTimeSlots: string[],
      preferredVacantDay: string,
      preferBefore6PM: boolean = false,
    ) {
      const lectureUnits = subject.lecture_units || 0;
      const labUnits = subject.lab_units || 0;

      const lecHours = lectureUnits * 1.0;
      const labHours = labUnits * 1.0;

      const hasLecture = lectureUnits > 0;
      const hasLab = labUnits > 0;

      // Kitchen labs always schedule independently to avoid sharing the same room
      const isKitchenLab =
        subject.lab_type && kitchenRoomTypeIds.has(subject.lab_type);

      let scheduledDay: string | null = null;

      if (
        hasLecture &&
        hasLab &&
        !isKitchenLab &&
        !isOjtLabType(subject.lab_type, ojtRoomTypeIds)
      ) {
        // New pairing logic: try to schedule both components on the same day in adjacent slots
        const paired = trySchedulePaired(
          subject,
          sectionCode,
          sectionTimeSlots,
          preferredVacantDay,
          preferBefore6PM,
          lecHours,
          labHours,
          sectionDaySubjectCount,
        );
        if (paired) {
          // Find which day the paired subject was scheduled on from scheduleEntries
          const entryCount = scheduleEntries.length;
          if (entryCount >= 2) {
            scheduledDay = scheduleEntries[entryCount - 2].day;
          }
          // Increment subject count for the day where this subject was placed
          if (scheduledDay) {
            const dayCounts = sectionDaySubjectCount.get(sectionCode)!;
            dayCounts.set(scheduledDay, (dayCounts.get(scheduledDay) || 0) + 1);
          }
          return;
        }
      }

      // Fallback: independent scheduling if pairing failed or not applicable
      if (hasLecture) {
        const result = scheduleSession(
          subject,
          sectionCode,
          "LECTURE",
          lecHours,
          rooms,
          days,
          sectionTimeSlots,
          occupiedRoomSlots,
          occupiedSectionSlots,
          occupiedCourseSlots,
          occupiedSubjectTimeSlots,
          sectionActiveDays,
          scheduleEntries,
          preferredVacantDay,
          breakPeriods,
          subject.lab_type,
          lectureRoomTypeId,
          preferBefore6PM,
          sectionDaySubjectCount,
          ojtRoomTypeIds,
        );
        if (result) {
          scheduledDay = result.day;
        }
      }

      if (hasLab) {
        const result = scheduleSession(
          subject,
          sectionCode,
          "LABORATORY",
          labHours,
          rooms,
          days,
          sectionTimeSlots,
          occupiedRoomSlots,
          occupiedSectionSlots,
          occupiedCourseSlots,
          occupiedSubjectTimeSlots,
          sectionActiveDays,
          scheduleEntries,
          preferredVacantDay,
          breakPeriods,
          subject.lab_type,
          lectureRoomTypeId,
          preferBefore6PM,
          sectionDaySubjectCount,
          ojtRoomTypeIds,
        );
        if (result) {
          // If lecture and lab were scheduled independently, count the lab's day too
          if (!scheduledDay || result.day !== scheduledDay) {
            const dayCounts = sectionDaySubjectCount.get(sectionCode)!;
            dayCounts.set(result.day, (dayCounts.get(result.day) || 0) + 1);
          }
        }
      }

      // If lecture-only or if paired scheduling fell back to independent, count the lecture day
      if (hasLecture && !hasLab && scheduledDay) {
        const dayCounts = sectionDaySubjectCount.get(sectionCode)!;
        dayCounts.set(scheduledDay, (dayCounts.get(scheduledDay) || 0) + 1);
      }
    }

    // Try to schedule lecture and lab on the same day.
    // Strategy: find the earliest available time for the lab first (since lab phases run first),
    // then check if the lecture can fit immediately after without hitting a break or conflict.
    // If pairing would hit a break or conflict, return false so components schedule independently.
    // Skip pairing entirely if combined units (lec + lab) >= 4, as it would be too many units for one day.
    function trySchedulePaired(
      subject: AssignedSubjectDetail,
      sectionCode: string,
      sectionTimeSlots: string[],
      preferredVacantDay: string,
      preferBefore6PM: boolean,
      lecHours: number,
      labHours: number,
      sectionDaySubjectCount: Map<string, Map<string, number>>,
    ): boolean {
      // Skip pairing if combined units would be 4 or more
      if (lecHours + labHours >= 4) return false;

      const lecSlotsNeeded = Math.ceil((lecHours * 60) / 30);
      const labSlotsNeeded = Math.ceil((labHours * 60) / 30);
      const activeDays = sectionActiveDays.get(sectionCode)!;
      const prioritizedDays = getDaysSortedBySubjectCount(
        sectionCode,
        preferredVacantDay,
      );

      const labRooms = getFilteredRooms(
        "LABORATORY",
        rooms,
        subject.lab_type,
        null,
      );
      const lecRooms = getFilteredRooms(
        "LECTURE",
        rooms,
        subject.lab_type,
        lectureRoomTypeId,
      );

      // Helper to find the earliest available lab start slot on a given day.
      // Scans from the beginning, skipping occupied blocks and break periods.
      function findEarliestLabSlot(
        day: string,
        checkBefore6PM: boolean,
      ): number | null {
        for (let i = 0; i <= sectionTimeSlots.length - labSlotsNeeded; i++) {
          const labSlots = sectionTimeSlots.slice(i, i + labSlotsNeeded);

          // Skip if lab hits a break
          if (labSlots.some((slot) => isBreakTime(day, slot, breakPeriods))) {
            let jumped = false;
            for (let j = 0; j < labSlotsNeeded; j++) {
              if (isBreakTime(day, labSlots[j], breakPeriods)) {
                i = i + j;
                jumped = true;
                break;
              }
            }
            if (jumped) continue;
          }

          // Skip if lab slots are occupied by section or subject
          let occupied = false;
          for (let j = 0; j < labSlotsNeeded; j++) {
            const slot = labSlots[j];
            if (
              occupiedSectionSlots.has(`${sectionCode}_${day}_${slot}`) ||
              occupiedSubjectTimeSlots.has(
                `${subject.course_code}_${day}_${slot}`,
              )
            ) {
              occupied = true;
              i = i + j;
              break;
            }
          }
          if (occupied) continue;

          // Check lab course conflict
          const labFree = labSlots.every(
            (slot) =>
              !occupiedCourseSlots.has(
                `${subject.course_code}_LABORATORY_${day}_${slot}`,
              ),
          );
          if (!labFree) {
            i = i + labSlotsNeeded - 1;
            continue;
          }

          // Check before-6-PM preference for the combined block (lab + lec)
          const combinedEnd = i + labSlotsNeeded + lecSlotsNeeded;
          if (checkBefore6PM && combinedEnd <= sectionTimeSlots.length) {
            const lastSlot = sectionTimeSlots[combinedEnd - 1];
            const endTime = lastSlot.split(" - ")[1];
            const endMinutes = timeToMinutes(endTime);
            if (endMinutes > 18 * 60) {
              continue;
            }
          }

          return i;
        }
        return null;
      }

      // For each day, find earliest lab slot, then check if lecture can pair immediately after
      for (const day of prioritizedDays) {
        if (
          day === preferredVacantDay &&
          activeDays.size < 5 &&
          activeDays.size > 0
        )
          continue;
        if (!activeDays.has(day) && activeDays.size >= 5) continue;

        const labStart = findEarliestLabSlot(day, preferBefore6PM);
        if (labStart === null) continue;

        // Skip pairing if the lab component would start at 6 PM or later
        const labStartTime = sectionTimeSlots[labStart].split(" - ")[0];
        const labStartMinutes = timeToMinutes(labStartTime);
        if (labStartMinutes >= 18 * 60) continue;

        const labSlots = sectionTimeSlots.slice(
          labStart,
          labStart + labSlotsNeeded,
        );
        const lecStart = labStart + labSlotsNeeded;

        // Check if lecture fits within the time slots
        if (lecStart + lecSlotsNeeded > sectionTimeSlots.length) continue;

        const lecSlots = sectionTimeSlots.slice(
          lecStart,
          lecStart + lecSlotsNeeded,
        );

        // Check if lecture hits a break — if so, skip pairing for this day
        if (lecSlots.some((slot) => isBreakTime(day, slot, breakPeriods)))
          continue;

        // Check if lecture slots are occupied by section or subject
        let lecOccupied = false;
        for (const slot of lecSlots) {
          if (
            occupiedSectionSlots.has(`${sectionCode}_${day}_${slot}`) ||
            occupiedSubjectTimeSlots.has(
              `${subject.course_code}_${day}_${slot}`,
            )
          ) {
            lecOccupied = true;
            break;
          }
        }
        if (lecOccupied) continue;

        // Check lecture course conflict
        const lecFree = lecSlots.every(
          (slot) =>
            !occupiedCourseSlots.has(
              `${subject.course_code}_LECTURE_${day}_${slot}`,
            ),
        );
        if (!lecFree) continue;

        // Find available rooms
        let labRoom: RoomForGeneration | null = null;
        let lecRoom: RoomForGeneration | null = null;

        for (const room of labRooms) {
          if (
            labSlots.every(
              (slot) =>
                !occupiedRoomSlots.has(`${room.room_id}_${day}_${slot}`),
            )
          ) {
            labRoom = room;
            break;
          }
        }
        for (const room of lecRooms) {
          if (
            lecSlots.every(
              (slot) =>
                !occupiedRoomSlots.has(`${room.room_id}_${day}_${slot}`),
            )
          ) {
            lecRoom = room;
            break;
          }
        }

        if (labRoom && lecRoom) {
          // Schedule Lab first
          labSlots.forEach((slot) => {
            occupiedSectionSlots.add(`${sectionCode}_${day}_${slot}`);
            occupiedRoomSlots.add(`${labRoom.room_id}_${day}_${slot}`);
            occupiedCourseSlots.add(
              `${subject.course_code}_LABORATORY_${day}_${slot}`,
            );
            occupiedSubjectTimeSlots.add(
              `${subject.course_code}_${day}_${slot}`,
            );
          });
          activeDays.add(day);

          const labStartTime = labSlots[0].split(" - ")[0];
          const labEndTime = labSlots[labSlots.length - 1].split(" - ")[1];
          scheduleEntries.push({
            sectionCode,
            subjectId: subject.subject_id,
            courseCode: subject.course_code,
            courseName: subject.course_name,
            componentType: "LABORATORY",
            units: subject.lab_units,
            roomId: labRoom.room_id,
            roomName: labRoom.room_name || "Unassigned Room",
            day,
            startTime: labStartTime,
            endTime: labEndTime,
            type: "laboratory",
            teacherId: null,
            teacherName: null,
          });
          scheduledComponents.set(
            `${sectionCode}_${subject.subject_id}_LABORATORY`,
            {
              day,
              startIndex: labStart,
              endIndex: labStart + labSlotsNeeded,
            },
          );

          // Schedule Lecture immediately after
          lecSlots.forEach((slot) => {
            occupiedSectionSlots.add(`${sectionCode}_${day}_${slot}`);
            occupiedRoomSlots.add(`${lecRoom.room_id}_${day}_${slot}`);
            occupiedCourseSlots.add(
              `${subject.course_code}_LECTURE_${day}_${slot}`,
            );
            occupiedSubjectTimeSlots.add(
              `${subject.course_code}_${day}_${slot}`,
            );
          });

          const lecStartTime = lecSlots[0].split(" - ")[0];
          const lecEndTime = lecSlots[lecSlots.length - 1].split(" - ")[1];
          scheduleEntries.push({
            sectionCode,
            subjectId: subject.subject_id,
            courseCode: subject.course_code,
            courseName: subject.course_name,
            componentType: "LECTURE",
            units: subject.lecture_units,
            roomId: lecRoom.room_id,
            roomName: lecRoom.room_name || "Unassigned Room",
            day,
            startTime: lecStartTime,
            endTime: lecEndTime,
            type: "lecture",
            teacherId: null,
            teacherName: null,
          });
          scheduledComponents.set(
            `${sectionCode}_${subject.subject_id}_LECTURE`,
            {
              day,
              startIndex: lecStart,
              endIndex: lecStart + lecSlotsNeeded,
            },
          );

          return true;
        }
      }

      // If preferBefore6PM failed, retry without the constraint
      if (preferBefore6PM) {
        for (const day of prioritizedDays) {
          if (
            day === preferredVacantDay &&
            activeDays.size < 5 &&
            activeDays.size > 0
          )
            continue;
          if (!activeDays.has(day) && activeDays.size >= 5) continue;

          // Find earliest lab slot without before-6-PM constraint
          let labStart: number | null = null;
          for (let i = 0; i <= sectionTimeSlots.length - labSlotsNeeded; i++) {
            const labSlots = sectionTimeSlots.slice(i, i + labSlotsNeeded);

            if (labSlots.some((slot) => isBreakTime(day, slot, breakPeriods))) {
              let jumped = false;
              for (let j = 0; j < labSlotsNeeded; j++) {
                if (isBreakTime(day, labSlots[j], breakPeriods)) {
                  i = i + j;
                  jumped = true;
                  break;
                }
              }
              if (jumped) continue;
            }

            let occupied = false;
            for (let j = 0; j < labSlotsNeeded; j++) {
              const slot = labSlots[j];
              if (
                occupiedSectionSlots.has(`${sectionCode}_${day}_${slot}`) ||
                occupiedSubjectTimeSlots.has(
                  `${subject.course_code}_${day}_${slot}`,
                )
              ) {
                occupied = true;
                i = i + j;
                break;
              }
            }
            if (occupied) continue;

            const labFree = labSlots.every(
              (slot) =>
                !occupiedCourseSlots.has(
                  `${subject.course_code}_LABORATORY_${day}_${slot}`,
                ),
            );
            if (!labFree) {
              i = i + labSlotsNeeded - 1;
              continue;
            }

            labStart = i;
            break;
          }

          if (labStart === null) continue;

          // Skip pairing if the lab component would start at 6 PM or later
          const labStartTime = sectionTimeSlots[labStart].split(" - ")[0];
          const labStartMinutes = timeToMinutes(labStartTime);
          if (labStartMinutes >= 18 * 60) continue;

          const labSlots = sectionTimeSlots.slice(
            labStart,
            labStart + labSlotsNeeded,
          );
          const lecStart = labStart + labSlotsNeeded;

          if (lecStart + lecSlotsNeeded > sectionTimeSlots.length) continue;

          const lecSlots = sectionTimeSlots.slice(
            lecStart,
            lecStart + lecSlotsNeeded,
          );

          // Check if lecture hits a break — skip pairing
          if (lecSlots.some((slot) => isBreakTime(day, slot, breakPeriods)))
            continue;

          let lecOccupied = false;
          for (const slot of lecSlots) {
            if (
              occupiedSectionSlots.has(`${sectionCode}_${day}_${slot}`) ||
              occupiedSubjectTimeSlots.has(
                `${subject.course_code}_${day}_${slot}`,
              )
            ) {
              lecOccupied = true;
              break;
            }
          }
          if (lecOccupied) continue;

          const lecFree = lecSlots.every(
            (slot) =>
              !occupiedCourseSlots.has(
                `${subject.course_code}_LECTURE_${day}_${slot}`,
              ),
          );
          if (!lecFree) continue;

          let labRoom: RoomForGeneration | null = null;
          let lecRoom: RoomForGeneration | null = null;

          for (const room of labRooms) {
            if (
              labSlots.every(
                (slot) =>
                  !occupiedRoomSlots.has(`${room.room_id}_${day}_${slot}`),
              )
            ) {
              labRoom = room;
              break;
            }
          }
          for (const room of lecRooms) {
            if (
              lecSlots.every(
                (slot) =>
                  !occupiedRoomSlots.has(`${room.room_id}_${day}_${slot}`),
              )
            ) {
              lecRoom = room;
              break;
            }
          }

          if (labRoom && lecRoom) {
            labSlots.forEach((slot) => {
              occupiedSectionSlots.add(`${sectionCode}_${day}_${slot}`);
              occupiedRoomSlots.add(`${labRoom.room_id}_${day}_${slot}`);
              occupiedCourseSlots.add(
                `${subject.course_code}_LABORATORY_${day}_${slot}`,
              );
              occupiedSubjectTimeSlots.add(
                `${subject.course_code}_${day}_${slot}`,
              );
            });
            activeDays.add(day);

            scheduleEntries.push({
              sectionCode,
              subjectId: subject.subject_id,
              courseCode: subject.course_code,
              courseName: subject.course_name,
              componentType: "LABORATORY",
              units: subject.lab_units,
              roomId: labRoom.room_id,
              roomName: labRoom.room_name || "Unassigned Room",
              day,
              startTime: labSlots[0].split(" - ")[0],
              endTime: labSlots[labSlots.length - 1].split(" - ")[1],
              type: "laboratory",
              teacherId: null,
              teacherName: null,
            });
            scheduledComponents.set(
              `${sectionCode}_${subject.subject_id}_LABORATORY`,
              {
                day,
                startIndex: labStart,
                endIndex: labStart + labSlotsNeeded,
              },
            );

            lecSlots.forEach((slot) => {
              occupiedSectionSlots.add(`${sectionCode}_${day}_${slot}`);
              occupiedRoomSlots.add(`${lecRoom.room_id}_${day}_${slot}`);
              occupiedCourseSlots.add(
                `${subject.course_code}_LECTURE_${day}_${slot}`,
              );
              occupiedSubjectTimeSlots.add(
                `${subject.course_code}_${day}_${slot}`,
              );
            });

            scheduleEntries.push({
              sectionCode,
              subjectId: subject.subject_id,
              courseCode: subject.course_code,
              courseName: subject.course_name,
              componentType: "LECTURE",
              units: subject.lecture_units,
              roomId: lecRoom.room_id,
              roomName: lecRoom.room_name || "Unassigned Room",
              day,
              startTime: lecSlots[0].split(" - ")[0],
              endTime: lecSlots[lecSlots.length - 1].split(" - ")[1],
              type: "lecture",
              teacherId: null,
              teacherName: null,
            });
            scheduledComponents.set(
              `${sectionCode}_${subject.subject_id}_LECTURE`,
              {
                day,
                startIndex: lecStart,
                endIndex: lecStart + lecSlotsNeeded,
              },
            );

            return true;
          }
        }
      }

      return false;
    }

    // Categorize sections into SHS and Tertiary
    const shsAssignments: SectionSubjectAssignment[] = [];
    const tertiaryAssignments: SectionSubjectAssignment[] = [];

    for (const assignment of sectionAssignments) {
      const isShsSection = /^([A-Z]+)([12])(\d{2})$/.test(
        assignment.sectionCode,
      );
      if (isShsSection) {
        shsAssignments.push(assignment);
      } else {
        tertiaryAssignments.push(assignment);
      }
    }

    // Phase 1: SHS Lab schedules (subjects with lab units, including combined lec+lab)
    for (const assignment of shsAssignments) {
      const { sectionCode, subjects } = assignment;
      const preferredVacantDay =
        sectionPreferredVacantDay.get(sectionCode) || "Saturday";
      const sectionTimeSlots = shsTimeSlots;

      for (const subject of subjects) {
        const labUnits = subject.lab_units || 0;
        if (labUnits > 0) {
          scheduleSubject(
            subject,
            sectionCode,
            sectionTimeSlots,
            preferredVacantDay,
            false,
          );
        }
      }
    }

    // Phase 2: Tertiary Lab schedules (subjects with lab units, including combined lec+lab)
    for (const assignment of tertiaryAssignments) {
      const { sectionCode, subjects } = assignment;
      const preferredVacantDay =
        sectionPreferredVacantDay.get(sectionCode) || "Saturday";
      const sectionTimeSlots = timeSlots;

      for (const subject of subjects) {
        const labUnits = subject.lab_units || 0;
        if (labUnits > 0) {
          scheduleSubject(
            subject,
            sectionCode,
            sectionTimeSlots,
            preferredVacantDay,
            true,
          );
        }
      }
    }

    // Phase 3: SHS Discussion/Lecture schedules (subjects without lab units)
    for (const assignment of shsAssignments) {
      const { sectionCode, subjects } = assignment;
      const preferredVacantDay =
        sectionPreferredVacantDay.get(sectionCode) || "Saturday";
      const sectionTimeSlots = shsTimeSlots;

      for (const subject of subjects) {
        const labUnits = subject.lab_units || 0;
        const lectureUnits = subject.lecture_units || 0;
        if (labUnits === 0 && lectureUnits > 0) {
          scheduleSubject(
            subject,
            sectionCode,
            sectionTimeSlots,
            preferredVacantDay,
            false,
          );
        }
      }
    }

    // Phase 4: Tertiary Discussion/Lecture schedules (subjects without lab units)
    for (const assignment of tertiaryAssignments) {
      const { sectionCode, subjects } = assignment;
      const preferredVacantDay =
        sectionPreferredVacantDay.get(sectionCode) || "Saturday";
      const sectionTimeSlots = timeSlots;

      for (const subject of subjects) {
        const labUnits = subject.lab_units || 0;
        const lectureUnits = subject.lecture_units || 0;
        if (labUnits === 0 && lectureUnits > 0) {
          scheduleSubject(
            subject,
            sectionCode,
            sectionTimeSlots,
            preferredVacantDay,
            true,
          );
        }
      }
    }

    const subjectsById = new Map(
      sectionAssignments.flatMap((assignment) =>
        assignment.subjects.map((subject) => [subject.subject_id, subject]),
      ),
    );
    const requiredEntries: ScheduleEntry[] = sectionAssignments.flatMap(
      ({ sectionCode, subjects }) =>
        subjects.flatMap((subject) =>
          ([
            ["LECTURE", subject.lecture_units],
            ["LABORATORY", subject.lab_units],
          ] as const)
            .filter(([, units]) => units > 0)
            .map(([componentType, units]) => {
              const duration = Math.ceil((units * 60) / 30) * 30;
              return {
                sectionCode,
                subjectId: subject.subject_id,
                courseCode: subject.course_code,
                courseName: subject.course_name,
                componentType,
                units,
                roomId: null,
                roomName:
                  componentType === "LABORATORY" &&
                  isOjtLabType(subject.lab_type, ojtRoomTypeIds)
                    ? "No Room Required"
                    : "Unassigned Room",
                day: "Monday",
                startTime: "07:00",
                endTime: `${String(Math.floor((7 * 60 + duration) / 60)).padStart(2, "0")}:${String((7 * 60 + duration) % 60).padStart(2, "0")}`,
                type: componentType.toLowerCase(),
                teacherId: null,
                teacherName: null,
              };
            }),
        ),
    );
    const baseRepair = repairGeneratedSchedule(
      scheduleEntries,
      requiredEntries,
      {
        days,
        dayStartMinutes: 7 * 60,
        dayEndMinutes: 22 * 60,
        localSearchIterations: 60,
        isTimeAllowed: (entry, day, _startTime, endTime) => {
          if (!/^([A-Z]+)([12])(\d{2})$/.test(entry.sectionCode)) {
            return true;
          }
          return (
            shsDays.includes(day) && timeToMinutes(endTime) <= 18 * 60
          );
        },
        isBreakTime: (day, startTime, endTime) => {
          const start = timeToMinutes(startTime);
          const end = timeToMinutes(endTime);
          for (let slotStart = start; slotStart < end; slotStart += 30) {
            const slotEnd = Math.min(slotStart + 30, end);
            if (
              isBreakTime(
                day,
                `${String(Math.floor(slotStart / 60)).padStart(2, "0")}:${String(slotStart % 60).padStart(2, "0")} - ${String(Math.floor(slotEnd / 60)).padStart(2, "0")}:${String(slotEnd % 60).padStart(2, "0")}`,
                breakPeriods,
              )
            ) {
              return true;
            }
          }
          return false;
        },
        hasAdditionalConflict: (first, second) =>
          !!first.courseCode && first.courseCode === second.courseCode,
        getRooms: (entry) => {
          const subject = subjectsById.get(entry.subjectId);
          if (
            entry.componentType === "LABORATORY" &&
            isOjtLabType(subject?.lab_type, ojtRoomTypeIds)
          ) {
            return [{ roomId: null, roomName: "No Room Required" }];
          }
          return getFilteredRooms(
            entry.componentType,
            rooms,
            subject?.lab_type,
            lectureRoomTypeId,
          ).map((room) => ({
            roomId: room.room_id,
            roomName: room.room_name || "Unassigned Room",
          }));
        },
      },
    );
    const repairedValidation = validateGeneratedSchedule(
      baseRepair.entries,
      sectionAssignments,
    );

    return {
      success: baseRepair.complete,
      scheduleEntries: baseRepair.entries,
      error: baseRepair.complete
        ? undefined
        : formatGeneratedScheduleValidationError(repairedValidation),
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

/**
 * Teacher-aware schedule generation for full auto mode.
 * Integrates teacher assignment during scheduling with employment type constraints:
 * - Full-Time: weekdays only (M-F), 7AM-6PM
 * - Part-Time Full Load: follows availability and can handle evening classes
 * - Part-Time: follows availability, including Saturdays when available
 * - Part-time availability defaults to Monday-Saturday, 7AM-10PM when unset
 */
export async function generateRoomAndClassSchedulesWithTeachers(
  _name: string,
  _curricula: string[],
  tertiaryTerm: string,
  teachersForGeneration: TeacherRecord[],
  precomputedSections?: string[],
  precomputedSubjects?: SubjectRequirementRecord[],
  shsTerm: string = "Term 1",
  testMode: boolean = false,
): Promise<ScheduleAssignmentResult> {
  try {
    const needsAvailabilityLookup = teachersForGeneration.some(
      (teacher) =>
        (teacher.employment_type || "").toLowerCase().includes("part") &&
        teacher.availability === undefined,
    );
    const availabilityByTeacherId = new Map<string, unknown>();
    if (needsAvailabilityLookup) {
      const availabilityResult = await fetchTeachers(
        null,
        "All Statuses",
        "All Departments",
        "surname",
        "ASC",
        -1,
        1,
      );
      if (!availabilityResult.success) {
        throw new Error(
          availabilityResult.error || "Failed to fetch teacher availability.",
        );
      }
      for (const teacher of availabilityResult.data || []) {
        availabilityByTeacherId.set(teacher.teacher_id, teacher.availability);
      }
    }

    if (testMode) {
      const teacherDebugData = teachersForGeneration.map(
        ({
          teacher_id,
          full_name,
          teacher_code,
          department,
          employment_type,
          status,
          aqs,
          fcces,
          preferences,
        }) => ({
          teacher_id,
          full_name,
          teacher_code,
          department,
          employment_type,
          status,
          aqs,
          fcces,
          preferences,
        }),
      );

      console.log(
        `[AutoScheduleGeneration] Received ${teacherDebugData.length} teachers with preferences:\n${JSON.stringify(teacherDebugData, null, 2)}`,
      );
    }

    // Filter active teachers
    const activeTeachers = teachersForGeneration.filter(
      (t) => !t.status || t.status.toLowerCase() !== "inactive",
    );

    // Categorize teachers by employment type
    const fullTimeTeachers: TeacherRecord[] = [];
    const partTimeFullLoadTeachers: TeacherRecord[] = [];
    const partTimeTeachers: TeacherRecord[] = [];

    for (const teacher of activeTeachers) {
      const normalized = (teacher.employment_type || "full_time").toLowerCase();
      if (
        normalized.includes("part-time full load") ||
        normalized.includes("part_time_full_load")
      ) {
        partTimeFullLoadTeachers.push(teacher);
      } else if (normalized.includes("part")) {
        partTimeTeachers.push(teacher);
      } else {
        fullTimeTeachers.push(teacher);
      }
    }

    // 2. Fetch faculty load config
    const configResult = await fetchFacultyLoadConfig();
    const config =
      configResult &&
      configResult.success &&
      Array.isArray(configResult.data) &&
      configResult.data.length > 0
        ? (configResult.data[0] as Configuration)
        : null;

    const facultyLoad = config?.faculty_load ?? {
      full_time: 21,
      part_time: 12,
      part_time_full_load: 18,
    };
    const overloadMax = Number(config?.overload_max ?? 3);

    // 3. Build subject-to-teacher mapping BEFORE scheduling
    // This ensures we know which teacher teaches which subject before placing time slots
    const subjectTeacherMap = new Map<string, string>();
    const subjectTeacherNameMap = new Map<string, string>();
    const teacherLoad = new Map<string, number>();
    const teacherSubjects = new Map<string, Set<string>>();

    // Fetch subjects for mapping
    let subjectsForMapping = precomputedSubjects;
    if (!subjectsForMapping || subjectsForMapping.length === 0) {
      const fetchedSubjects = await fetchSubjectsForGeneration(
        _curricula,
        tertiaryTerm,
        shsTerm,
      );
      if (fetchedSubjects.success) {
        subjectsForMapping = fetchedSubjects.data;
      }
    }

    const requirementsResult = await assignSubjectsToSections(
      _name,
      tertiaryTerm,
      precomputedSections,
      subjectsForMapping,
      shsTerm,
    );
    if (!requirementsResult.success || !requirementsResult.assignments) {
      throw new Error(
        requirementsResult.error ||
          "Failed to resolve required section subject components.",
      );
    }

    const roomTypesResult = await fetchRoomTypeList(null, "ASC", -1, 1);
    const ojtRoomTypeIds = new Set(
      (roomTypesResult.success ? roomTypesResult.data || [] : [])
        .filter((roomType) => roomType.value.trim().toLowerCase() === "ojt")
        .map((roomType) => roomType.room_type_id.trim().toLowerCase()),
    );

    if (testMode) {
      const sectionRequirements = requirementsResult.assignments.map(
        ({ sectionCode, subjects }) => ({
          sectionCode,
          subjectCount: subjects.length,
          requiredComponents: subjects.reduce(
            (count, subject) =>
              count +
              Number(subject.lecture_units > 0) +
              Number(subject.lab_units > 0),
            0,
          ),
          subjects: subjects.map(
            ({ course_code, year_term, lecture_units, lab_units }) => ({
              course_code,
              year_term,
              lecture_units,
              lab_units,
            }),
          ),
        }),
      );

      console.log(
        `[AutoScheduleGeneration] Resolved requirements for ${sectionRequirements.length} sections:\n${JSON.stringify(sectionRequirements, null, 2)}`,
      );
    }

    if (subjectsForMapping) {
      // Helper functions for teacher matching
      function getFacultyLoadLimit(employmentType?: string): number {
        const normalized = (employmentType || "full_time").toLowerCase();
        if (
          normalized.includes("part-time full load") ||
          normalized.includes("part_time_full_load")
        ) {
          return Number(facultyLoad.part_time_full_load ?? 18);
        } else if (normalized.includes("part")) {
          return Number(facultyLoad.part_time ?? 12);
        } else {
          return Number(facultyLoad.full_time ?? 21);
        }
      }

      function teacherAqMatches(
        teacher: TeacherRecord,
        requiredAqs: string[],
      ): boolean {
        if (!requiredAqs || requiredAqs.length === 0) return true;
        if (
          requiredAqs.length === 1 &&
          (requiredAqs[0] === "NULL" || requiredAqs[0] === "")
        ) {
          return true;
        }
        const teacherAqs: string[] = Array.isArray(teacher.aqs)
          ? (teacher.aqs as Array<Record<string, unknown>>)
              .map((item) =>
                item && typeof item === "object" && "aq" in item
                  ? String(item.aq ?? "")
                  : "",
              )
              .filter(Boolean)
          : [];
        return requiredAqs.every((req) =>
          teacherAqs.some((tAq) => tAq.toLowerCase() === req.toLowerCase()),
        );
      }

      function teacherFcceMatches(
        teacher: TeacherRecord,
        courseName: string,
      ): boolean {
        const courseNameLower = courseName.trim().toLowerCase();
        if (!courseNameLower) return true;
        const teacherFcces = Array.isArray(teacher.fcces)
          ? (teacher.fcces as Array<Record<string, unknown>>)
          : [];
        return teacherFcces.some((f) => {
          const fCourse = String(f.course_name ?? "")
            .trim()
            .toLowerCase();
          return fCourse === courseNameLower && f.pass === true;
        });
      }

      function teacherPrefersSubject(
        teacher: TeacherRecord,
        courseName: string,
        courseCode: string,
      ): boolean {
        const normalized = (teacher.employment_type || "").toLowerCase();
        const isPartTime = normalized.includes("part");
        if (!isPartTime) return true;
        const prefSubjects = teacher.preferences?.preferred_subjects;
        if (!prefSubjects || prefSubjects.length === 0) return true;
        const courseNameLower = courseName.trim().toLowerCase();
        const courseCodeLower = courseCode.trim().toLowerCase();
        return prefSubjects.some((pref) => {
          const prefLower = pref.trim().toLowerCase();
          return prefLower === courseNameLower || prefLower === courseCodeLower;
        });
      }

      // Assign teachers to subjects
      for (const subject of subjectsForMapping) {
        const lectureUnits = subject.lecture_units || 0;
        const labUnits = subject.lab_units || 0;
        const totalUnits = lectureUnits + labUnits;
        const courseName = subject.course_name || "";
        const courseCode = subject.course_code || "";
        const requiredAqs = subject.required_aqs || [];
        const preferenceRankedTeachers = [...activeTeachers].sort(
          (a, b) =>
            getTeacherPreferenceMatchScore(
              b.preferences,
              courseName,
              courseCode,
              subject.year_term,
            ) -
            getTeacherPreferenceMatchScore(
              a.preferences,
              courseName,
              courseCode,
              subject.year_term,
            ),
        );

        let bestTeacher: TeacherRecord | null = null;

        // First pass: AQ + FCCE + preference match
        for (const teacher of preferenceRankedTeachers) {
          const loadLimit = getFacultyLoadLimit(teacher.employment_type);
          const absoluteMax = loadLimit + overloadMax;
          const currentLoad = teacherLoad.get(teacher.teacher_id) || 0;
          if (currentLoad + totalUnits > absoluteMax) continue;
          if (!teacherPrefersSubject(teacher, courseName, courseCode)) continue;
          if (!teacherAqMatches(teacher, requiredAqs)) continue;
          if (!teacherFcceMatches(teacher, courseName)) continue;
          if (teacherSubjects.get(teacher.teacher_id)?.has(subject.subject_id))
            continue;
          bestTeacher = teacher;
          break;
        }

        // Second pass: AQ + preference match only
        if (!bestTeacher) {
          for (const teacher of preferenceRankedTeachers) {
            const loadLimit = getFacultyLoadLimit(teacher.employment_type);
            const absoluteMax = loadLimit + overloadMax;
            const currentLoad = teacherLoad.get(teacher.teacher_id) || 0;
            if (currentLoad + totalUnits > absoluteMax) continue;
            if (!teacherPrefersSubject(teacher, courseName, courseCode))
              continue;
            if (!teacherAqMatches(teacher, requiredAqs)) continue;
            if (
              teacherSubjects.get(teacher.teacher_id)?.has(subject.subject_id)
            )
              continue;
            bestTeacher = teacher;
            break;
          }
        }

        // Third pass: preference match only
        if (!bestTeacher) {
          for (const teacher of preferenceRankedTeachers) {
            const loadLimit = getFacultyLoadLimit(teacher.employment_type);
            const absoluteMax = loadLimit + overloadMax;
            const currentLoad = teacherLoad.get(teacher.teacher_id) || 0;
            if (currentLoad + totalUnits > absoluteMax) continue;
            if (!teacherPrefersSubject(teacher, courseName, courseCode))
              continue;
            if (
              teacherSubjects.get(teacher.teacher_id)?.has(subject.subject_id)
            )
              continue;
            bestTeacher = teacher;
            break;
          }
        }

        if (bestTeacher) {
          subjectTeacherMap.set(subject.subject_id, bestTeacher.teacher_id);
          subjectTeacherNameMap.set(subject.subject_id, bestTeacher.full_name);
          teacherLoad.set(
            bestTeacher.teacher_id,
            (teacherLoad.get(bestTeacher.teacher_id) || 0) + totalUnits,
          );
          if (!teacherSubjects.has(bestTeacher.teacher_id)) {
            teacherSubjects.set(bestTeacher.teacher_id, new Set());
          }
          teacherSubjects.get(bestTeacher.teacher_id)!.add(subject.subject_id);
        }
      }
    }

    // 4. Now call the original generateRoomAndClassSchedules but with teacher-aware time constraints
    // We'll use the original function and then filter/adjust based on teacher constraints
    const baseResult = await generateRoomAndClassSchedules(
      _name,
      _curricula,
      tertiaryTerm,
      precomputedSections,
      precomputedSubjects,
      shsTerm,
    );

    if (!baseResult.scheduleEntries.length) {
      return baseResult;
    }

    // 5. Re-schedule entries that violate teacher employment type constraints
    // Build teacher info map
    const teacherInfoMap = new Map<string, TeacherRecord>();
    for (const t of activeTeachers) {
      teacherInfoMap.set(t.teacher_id, t);
    }

    // Helper: get employment type category
    function getEmploymentCategory(
      teacher: TeacherRecord,
    ): "full_time" | "part_time_full_load" | "part_time" {
      const normalized = (teacher.employment_type || "full_time").toLowerCase();
      if (
        normalized.includes("part-time full load") ||
        normalized.includes("part_time_full_load")
      ) {
        return "part_time_full_load";
      } else if (normalized.includes("part")) {
        return "part_time";
      }
      return "full_time";
    }

    // Helper: check if a time slot is within 7AM-6PM
    function isWithinDaytime(startTime: string, endTime: string): boolean {
      const startMins = timeToMinutes(startTime);
      const endMins = timeToMinutes(endTime);
      return startMins >= 7 * 60 && endMins <= 18 * 60;
    }

    // Helper: check if a time slot is evening (6PM-10PM)
    function isEveningSlot(startTime: string): boolean {
      const startMins = timeToMinutes(startTime);
      return startMins >= 18 * 60;
    }

    // Helper: check if day is weekday (M-F)
    function isWeekday(day: string): boolean {
      return day !== "Saturday";
    }

    function isPartTimeCategory(
      category: ReturnType<typeof getEmploymentCategory>,
    ): boolean {
      return category !== "full_time";
    }

    function isTeacherWithinAvailability(
      teacher: TeacherRecord,
      day: string,
      startTime: string,
      endTime: string,
    ): boolean {
      return isTeacherTimeWithinAvailability(
        teacher.availability ?? availabilityByTeacherId.get(teacher.teacher_id),
        day,
        startTime,
        endTime,
      );
    }

    // Helper: check if teacher prefers this time slot
    function teacherPrefersTime(
      teacher: TeacherRecord,
      day: string,
      startTime: string,
      endTime: string,
    ): boolean {
      const prefTimes = teacher.preferences?.preferred_times;
      if (!prefTimes || prefTimes.length === 0) return true;
      const slotRange = `${startTime}-${endTime}`;
      return prefTimes.some((pref) => {
        if (typeof pref !== "string") {
          return (
            pref.day.toLowerCase() === day.toLowerCase() &&
            timeToMinutes(pref.start_time) <= timeToMinutes(startTime) &&
            timeToMinutes(pref.end_time) >= timeToMinutes(endTime)
          );
        }
        const prefLower = pref.toLowerCase();
        return (
          prefLower.includes(startTime.toLowerCase()) ||
          prefLower.includes(endTime.toLowerCase()) ||
          prefLower.includes(slotRange.toLowerCase())
        );
      });
    }

    // Re-process entries: if assigned teacher's constraints are violated, mark for re-scheduling
    const finalEntries: ScheduleEntry[] = [];
    const needsReschedule = new Set<string>(); // subjectIds that need re-scheduling

    for (const entry of baseResult.scheduleEntries) {
      const assignedTeacherId = subjectTeacherMap.get(entry.subjectId);
      if (!assignedTeacherId) {
        // No teacher assigned, keep original entry
        finalEntries.push({ ...entry, teacherId: null, teacherName: null });
        continue;
      }

      const teacher = teacherInfoMap.get(assignedTeacherId);
      if (!teacher) {
        finalEntries.push({
          ...entry,
          teacherId: assignedTeacherId,
          teacherName: subjectTeacherNameMap.get(entry.subjectId) || null,
        });
        continue;
      }

      const category = getEmploymentCategory(teacher);
      let valid = true;

      // Full-Time: weekdays only, 7AM-6PM
      if (category === "full_time") {
        if (!isWeekday(entry.day)) {
          valid = false;
        }
        if (!isWithinDaytime(entry.startTime, entry.endTime)) {
          valid = false;
        }
      }

      // Part-Time: only preferred days/times, handles Saturdays
      if (category === "part_time") {
        if (
          !isTeacherWithinAvailability(
            teacher,
            entry.day,
            entry.startTime,
            entry.endTime,
          )
        ) {
          valid = false;
        }
        // Check preferred times
        if (
          !teacherPrefersTime(
            teacher,
            entry.day,
            entry.startTime,
            entry.endTime,
          )
        ) {
          valid = false;
        }
      }

      // Part-Time Full Load: can handle evening, but prefer preferred times
      if (category === "part_time_full_load") {
        if (
          !isTeacherWithinAvailability(
            teacher,
            entry.day,
            entry.startTime,
            entry.endTime,
          )
        ) {
          valid = false;
        }
        // Can handle 6PM-10PM, but respect preferred times if set
        if (
          !teacherPrefersTime(
            teacher,
            entry.day,
            entry.startTime,
            entry.endTime,
          )
        ) {
          // For part-time full load, we still allow it but flag for potential re-scheduling
          // Only block if there are preferred times and this doesn't match
          const prefTimes = teacher.preferences?.preferred_times;
          if (prefTimes && prefTimes.length > 0) {
            valid = false;
          }
        }
      }

      const startsLate = timeToMinutes(entry.startTime) >= 19 * 60 + 30;
      if (!valid || (isPartTimeCategory(category) && startsLate)) {
        needsReschedule.add(entry.subjectId);
      }

      finalEntries.push({
        ...entry,
        teacherId: assignedTeacherId,
        teacherName: subjectTeacherNameMap.get(entry.subjectId) || null,
      });
    }

    async function applyPreferredRooms(
      entries: ScheduleEntry[],
    ): Promise<ScheduleEntry[]> {
      if (
        !entries.some((entry) => {
          const teacher = entry.teacherId
            ? teacherInfoMap.get(entry.teacherId)
            : undefined;
          return (teacher?.preferences?.preferred_rooms?.length ?? 0) > 0;
        })
      ) {
        return entries;
      }

      const roomsResult = await getRoomsForGeneration();
      if (!roomsResult.success || !roomsResult.data) {
        entries.forEach((entry) => {
          const teacher = entry.teacherId
            ? teacherInfoMap.get(entry.teacherId)
            : undefined;
          if (
            teacher &&
            getEmploymentCategory(teacher) === "full_time" &&
            (teacher.preferences?.preferred_rooms?.length ?? 0) > 0
          ) {
            needsReschedule.add(entry.subjectId);
          }
        });
        return entries;
      }

      const lecRoomTypeResult = await fetchLecRoomID();
      const lecRoomData =
        lecRoomTypeResult.success && lecRoomTypeResult.data
          ? (lecRoomTypeResult.data as Array<{ room_type_id: string }>)
          : [];
      const lectureRoomTypeId = lecRoomData[0]?.room_type_id ?? null;
      const subjectsById = new Map(
        (subjectsForMapping ?? precomputedSubjects ?? []).map((subject) => [
          subject.subject_id,
          subject,
        ]),
      );
      const result = entries.map((entry) => ({ ...entry }));

      for (let index = 0; index < result.length; index++) {
        const entry = result[index];
        const teacher = entry.teacherId
          ? teacherInfoMap.get(entry.teacherId)
          : undefined;
        const subject = subjectsById.get(entry.subjectId);
        if (
          entry.componentType === "LABORATORY" &&
          isOjtLabType(subject?.lab_type, ojtRoomTypeIds)
        ) {
          result[index] = {
            ...entry,
            roomId: null,
            roomName: "No Room Required",
          };
          continue;
        }
        const preferredRooms = teacher?.preferences?.preferred_rooms;
        if (!preferredRooms?.length) continue;

        const compatibleRooms = getFilteredRooms(
          entry.componentType,
          roomsResult.data,
          subject?.lab_type,
          lectureRoomTypeId,
        );
        const availableRooms = compatibleRooms.filter((room) =>
          result.every((other, otherIndex) => {
            if (
              otherIndex === index ||
              other.roomId !== room.room_id ||
              other.day !== entry.day
            ) {
              return true;
            }

            return (
              timeToMinutes(entry.startTime) >= timeToMinutes(other.endTime) ||
              timeToMinutes(entry.endTime) <= timeToMinutes(other.startTime)
            );
          }),
        );
        const preferredRoom = findPreferredRoom(availableRooms, preferredRooms);

        if (preferredRoom) {
          result[index] = {
            ...entry,
            roomId: preferredRoom.room_id,
            roomName: preferredRoom.room_name || entry.roomName,
          };
        } else if (teacher && getEmploymentCategory(teacher) === "full_time") {
          needsReschedule.add(entry.subjectId);
        }
      }

      return result;
    }

    async function validateAndFinalizeSchedule(
      entries: ScheduleEntry[],
    ): Promise<ScheduleAssignmentResult> {
      const preferredRoomEntries = await applyPreferredRooms(entries);
      const initialValidation = validateGeneratedSchedule(
        preferredRoomEntries,
        requirementsResult.assignments,
      );
      const hasInitialIssues = Object.values(initialValidation).some(
        (issues) => issues.length > 0,
      );
      const hasInitialFatigueRisk =
        getFatigueRiskEntries(preferredRoomEntries).length > 0;

      if (
        !hasInitialIssues &&
        needsReschedule.size === 0 &&
        !hasInitialFatigueRisk &&
        !preferredRoomEntries.some((entry) => {
          const teacher = entry.teacherId
            ? teacherInfoMap.get(entry.teacherId)
            : undefined;
          return (
            (teacher?.preferences?.preferred_rooms?.length ?? 0) > 0 ||
            (teacher?.preferences?.preferred_times?.length ?? 0) > 0
          );
        })
      ) {
        return { success: true, scheduleEntries: preferredRoomEntries };
      }

      const roomsResult = await getRoomsForGeneration();
      if (!roomsResult.success || !roomsResult.data) {
        return {
          success: false,
          scheduleEntries: preferredRoomEntries,
          error:
            roomsResult.error || "Failed to fetch rooms for schedule repair.",
        };
      }

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
      const lectureRoomTypeId =
        lecRoomTypeResult.success && lecRoomTypeResult.data
          ? ((lecRoomTypeResult.data as Array<{ room_type_id: string }>)[0]
              ?.room_type_id ?? null)
          : null;
      const subjectsById = new Map(
        requirementsResult.assignments.flatMap((assignment) =>
          assignment.subjects.map(
            (subject) => [subject.subject_id, subject] as const,
          ),
        ),
      );

      function formatRepairTime(minutes: number): string {
        return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
      }

      function makeRequiredEntry(
        sectionCode: string,
        subject: AssignedSubjectDetail,
        componentType: "LECTURE" | "LABORATORY",
      ): ScheduleEntry {
        const units =
          componentType === "LECTURE"
            ? subject.lecture_units
            : subject.lab_units;
        const durationMinutes = Math.ceil((units * 60) / 30) * 30;
        const startMinutes = 7 * 60;
        const teacherId = subjectTeacherMap.get(subject.subject_id) || null;
        return {
          sectionCode,
          subjectId: subject.subject_id,
          courseCode: subject.course_code,
          courseName: subject.course_name,
          componentType,
          units,
          roomId: null,
          roomName:
            componentType === "LABORATORY" &&
            isOjtLabType(subject.lab_type, ojtRoomTypeIds)
              ? "No Room Required"
              : "Unassigned Room",
          day: "Monday",
          startTime: formatRepairTime(startMinutes),
          endTime: formatRepairTime(startMinutes + durationMinutes),
          type: componentType.toLowerCase(),
          teacherId,
          teacherName: teacherId
            ? subjectTeacherNameMap.get(subject.subject_id) || null
            : null,
        };
      }

      const requiredEntries = requirementsResult.assignments.flatMap(
        ({ sectionCode, subjects }) =>
          subjects.flatMap((subject) => [
            ...(subject.lecture_units > 0
              ? [makeRequiredEntry(sectionCode, subject, "LECTURE")]
              : []),
            ...(subject.lab_units > 0
              ? [makeRequiredEntry(sectionCode, subject, "LABORATORY")]
              : []),
          ]),
      );
      const days = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const isRepairTimeAllowed = (
        entry: ScheduleEntry,
        day: string,
        startTime: string,
        endTime: string,
      ): boolean => {
        const isShs = /^([A-Z]+)([12])(\d{2})$/.test(entry.sectionCode);
        if (
          isShs &&
          (!isWeekday(day) || timeToMinutes(endTime) > 18 * 60)
        ) {
          return false;
        }

        const teacher = entry.teacherId
          ? teacherInfoMap.get(entry.teacherId)
          : undefined;
        if (!teacher) return true;

        const category = getEmploymentCategory(teacher);
        if (
          category === "full_time" &&
          (!isWeekday(day) || !isWithinDaytime(startTime, endTime))
        ) {
          return false;
        }
        if (
          isPartTimeCategory(category) &&
          !isTeacherWithinAvailability(teacher, day, startTime, endTime)
        ) {
          return false;
        }
        if (
          category === "part_time" &&
          !teacherPrefersTime(teacher, day, startTime, endTime)
        ) {
          return false;
        }
        if (
          category === "part_time_full_load" &&
          (teacher.preferences?.preferred_times?.length ?? 0) > 0 &&
          !teacherPrefersTime(teacher, day, startTime, endTime)
        ) {
          return false;
        }
        return true;
      };
      const createRepairOptions = (
        ignoreConfiguredBreaks: boolean,
        ignoreFatigue: boolean,
      ): RepairScheduleOptions<ScheduleEntry> => ({
        days,
        dayStartMinutes: 7 * 60,
        dayEndMinutes: 22 * 60,
        forceMoveSubjectIds: needsReschedule,
        isTimeAllowed: isRepairTimeAllowed,
        hasAdditionalConflict: (first, second) =>
          !!first.courseCode && first.courseCode === second.courseCode,
        hasAdditionalEntryConflict: ignoreFatigue
          ? undefined
          : (candidate, occupied) =>
              getFatigueRiskEntries([...occupied, candidate]).includes(
                candidate,
              ),
        getAdditionalConflictEntries: ignoreFatigue
          ? undefined
          : getFatigueRiskEntries,
        isBreakTime: (day, startTime, endTime) => {
          if (ignoreConfiguredBreaks) return false;

          const start = timeToMinutes(startTime);
          const end = timeToMinutes(endTime);
          for (let slotStart = start; slotStart < end; slotStart += 30) {
            const slotEnd = Math.min(slotStart + 30, end);
            if (
              isBreakTime(
                day,
                `${formatRepairTime(slotStart)} - ${formatRepairTime(slotEnd)}`,
                breakPeriods,
              )
            ) {
              return true;
            }
          }
          return false;
        },
        getRooms: (entry) => {
          const subject = subjectsById.get(entry.subjectId);
          if (
            entry.componentType === "LABORATORY" &&
            isOjtLabType(subject?.lab_type, ojtRoomTypeIds)
          ) {
            return [{ roomId: null, roomName: "No Room Required" }];
          }
          const compatibleRooms = getFilteredRooms(
            entry.componentType,
            roomsResult.data as RoomForGeneration[],
            subject?.lab_type,
            lectureRoomTypeId,
          );
          const teacher = entry.teacherId
            ? teacherInfoMap.get(entry.teacherId)
            : undefined;
          const preferredRooms = teacher?.preferences?.preferred_rooms || [];
          const preferredRoomOptions = findPreferredRooms(
            compatibleRooms,
            preferredRooms,
          );
          const preferredRoomIds = new Set(
            preferredRoomOptions.map((room) => room.room_id),
          );
          const orderedRooms = [
            ...preferredRoomOptions,
            ...compatibleRooms.filter(
              (room) => !preferredRoomIds.has(room.room_id),
            ),
          ];
          return orderedRooms.map((room) => ({
            roomId: room.room_id,
            roomName: room.room_name || "Unassigned Room",
          }));
        },
        getPreferencePenalty: (entry) => {
          const teacher = entry.teacherId
            ? teacherInfoMap.get(entry.teacherId)
            : undefined;
          if (!teacher) return 0;

          const preferences = teacher.preferences;
          let penalty = 0;
          const category = getEmploymentCategory(teacher);
          const subject = subjectsById.get(entry.subjectId);
          const preferredRooms = preferences?.preferred_rooms ?? [];
          if (
            !(
              entry.componentType === "LABORATORY" &&
              isOjtLabType(subject?.lab_type, ojtRoomTypeIds)
            ) &&
            preferredRooms.length > 0 &&
            !preferredRooms.some((preferredRoom) => {
              const normalizedPreference = preferredRoom
                .trim()
                .toLowerCase();
              return [entry.roomId, entry.roomName].some(
                (room) => room?.trim().toLowerCase() === normalizedPreference,
              );
            })
          ) {
            penalty++;
          }

          if (
            (preferences?.preferred_times?.length ?? 0) > 0 &&
            !teacherPrefersTime(
              teacher,
              entry.day,
              entry.startTime,
              entry.endTime,
            )
          ) {
            penalty++;
          }
          if (
            isPartTimeCategory(category) &&
            timeToMinutes(entry.startTime) >= 19 * 60 + 30
          ) {
            penalty++;
          }
          return penalty;
        },
        localSearchIterations: 200,
      });

      const repairStages = [
        {
          description: "while preserving configured breaks and fatigue limits",
          ignoreConfiguredBreaks: false,
          ignoreFatigue: false,
        },
      ];
      let lastRepair: {
        entries: ScheduleEntry[];
        complete: boolean;
        movedEntries: number;
      } | null = null;
      let lastValidation = initialValidation;

      for (const stage of repairStages) {
        const repair = repairGeneratedSchedule(
          preferredRoomEntries,
          requiredEntries,
          createRepairOptions(
            stage.ignoreConfiguredBreaks,
            stage.ignoreFatigue,
          ),
        );
        const validation = validateGeneratedSchedule(
          repair.entries,
          requirementsResult.assignments,
        );
        const hasValidationIssues = Object.values(validation).some(
          (issues) => issues.length > 0,
        );
        lastRepair = repair;
        lastValidation = validation;

        if (repair.complete && !hasValidationIssues) {
          console.info(
            `Schedule repair succeeded ${stage.description}; moved ${repair.movedEntries} entries.`,
          );
          return { success: true, scheduleEntries: repair.entries };
        }
      }

      const swappedEntries = trySwapSectionScheduleDays(
        lastRepair?.entries || preferredRoomEntries,
        days,
        isRepairTimeAllowed,
        (candidate) => {
          const validation = validateGeneratedSchedule(
            candidate,
            requirementsResult.assignments,
          );
          const hasConfiguredBreak = candidate.some((entry) => {
            const start = timeToMinutes(entry.startTime);
            const end = timeToMinutes(entry.endTime);
            for (let slotStart = start; slotStart < end; slotStart += 30) {
              const slotEnd = Math.min(slotStart + 30, end);
              if (
                isBreakTime(
                  entry.day,
                  `${formatRepairTime(slotStart)} - ${formatRepairTime(slotEnd)}`,
                  breakPeriods,
                )
              ) {
                return true;
              }
            }
            return false;
          });
          return (
            Object.values(validation).every((issues) => issues.length === 0) &&
            !hasConfiguredBreak &&
            getFatigueRiskEntries(candidate).length === 0
          );
        },
        (first, second) =>
          !!first.courseCode && first.courseCode === second.courseCode,
      );

      if (swappedEntries) {
        console.info(
          "Schedule repair succeeded after swapping days within a section.",
        );
        return { success: true, scheduleEntries: swappedEntries };
      }

      return {
        success: false,
        scheduleEntries: lastRepair?.entries || preferredRoomEntries,
        error: Object.values(lastValidation).some((issues) => issues.length > 0)
          ? formatGeneratedScheduleValidationError(lastValidation)
          : "Could not place every required class component while preserving teacher availability, configured breaks, fatigue limits, and room constraints.",
      };
    }

    return validateAndFinalizeSchedule(finalEntries);
  } catch (error) {
    console.error(
      "Failed to generate room and class schedules with teachers:",
      error,
    );
    return {
      success: false,
      scheduleEntries: [],
      error:
        (error as Error).message ||
        "Failed to generate room and class schedules with teachers.",
    };
  }
}

/**
 * Assign teachers to schedule entries after room/class schedule generation.
 * Matches one teacher per subject (regardless of section) respecting AQ/FCCE
 * and load limits (faculty_load + overload_max).
 */
export async function assignTeachersToSchedule(
  scheduleEntries: ScheduleEntry[],
): Promise<TeacherAssignmentResult> {
  try {
    // 1. Fetch faculty load configuration
    const configResult = await fetchFacultyLoadConfig();
    const config =
      configResult &&
      configResult.success &&
      Array.isArray(configResult.data) &&
      configResult.data.length > 0
        ? (configResult.data[0] as Configuration)
        : null;

    const facultyLoad = config?.faculty_load ?? {
      full_time: 21,
      part_time: 12,
      part_time_full_load: 18,
    };
    const overloadMax = Number(config?.overload_max ?? 3);

    // 2. Fetch all teachers with AQ and FCCE data
    const teachersResult = await getTeachersWithAqAndFcce({ search: null });
    if (!teachersResult.success || !teachersResult.data) {
      return {
        success: false,
        scheduleEntries: scheduleEntries.map((e) => ({
          ...e,
          teacherId: null,
          teacherName: null,
        })),
        error: teachersResult.error || "Failed to fetch teachers.",
      };
    }
    const teachers: TeacherRecord[] = teachersResult.data as TeacherRecord[];

    // Filter out inactive teachers
    const activeTeachers = teachers.filter(
      (t) => !t.status || t.status.toLowerCase() !== "inactive",
    );

    // 3. Build subject info map: subjectId -> { courseName, requiredAqs, lectureUnits, labUnits }
    // We gather subject info from the schedule entries and deduplicate by subjectId
    const subjectInfoMap = new Map<
      string,
      {
        courseName: string;
        courseCode: string;
        requiredAqs: string[];
        totalUnits: number;
      }
    >();

    for (const entry of scheduleEntries) {
      if (!subjectInfoMap.has(entry.subjectId)) {
        subjectInfoMap.set(entry.subjectId, {
          courseName: entry.courseName,
          courseCode: entry.courseCode,
          requiredAqs: [],
          totalUnits: 0,
        });
      }
      const info = subjectInfoMap.get(entry.subjectId)!;
      // Accumulate units per subject per section (lecture + lab)
      // We need to track per-section to avoid double counting
      info.totalUnits += entry.units;
    }

    // 4. For each unique subject, find the best matching teacher
    // Track teacher load: teacherId -> total units assigned
    const teacherLoad = new Map<string, number>();
    // Track teacher -> assigned subject count (for prep)
    const teacherSubjects = new Map<string, Set<string>>();
    // Map subjectId -> assigned teacherId
    const subjectTeacherMap = new Map<string, string>();
    const subjectTeacherNameMap = new Map<string, string>();

    // Helper: get faculty load limit for a teacher's employment type
    function getFacultyLoadLimit(employmentType?: string): number {
      const normalized = (employmentType || "full_time").toLowerCase();
      if (
        normalized.includes("part-time full load") ||
        normalized.includes("part_time_full_load")
      ) {
        return Number(facultyLoad.part_time_full_load ?? 18);
      } else if (normalized.includes("part")) {
        return Number(facultyLoad.part_time ?? 12);
      } else {
        return Number(facultyLoad.full_time ?? 21);
      }
    }

    // Helper: check if teacher's AQs match required AQs
    function teacherAqMatches(
      teacher: TeacherRecord,
      requiredAqs: string[],
    ): boolean {
      if (!requiredAqs || requiredAqs.length === 0) return true;
      // Skip matching if requiredAqs contains 'NULL' or 'BM' placeholder
      if (
        requiredAqs.length === 1 &&
        (requiredAqs[0] === "NULL" || requiredAqs[0] === "")
      ) {
        return true;
      }

      const teacherAqs: string[] = Array.isArray(teacher.aqs)
        ? (teacher.aqs as Array<Record<string, unknown>>)
            .map((item) =>
              item && typeof item === "object" && "aq" in item
                ? String(item.aq ?? "")
                : "",
            )
            .filter(Boolean)
        : [];

      return requiredAqs.every((req) =>
        teacherAqs.some((tAq) => tAq.toLowerCase() === req.toLowerCase()),
      );
    }

    // Helper: check if teacher has passed FCCE for the course
    function teacherFcceMatches(
      teacher: TeacherRecord,
      courseName: string,
    ): boolean {
      const courseNameLower = courseName.trim().toLowerCase();
      if (!courseNameLower) return true;

      const teacherFcces = Array.isArray(teacher.fcces)
        ? (teacher.fcces as Array<Record<string, unknown>>)
        : [];

      return teacherFcces.some((f) => {
        const fCourse = String(f.course_name ?? "")
          .trim()
          .toLowerCase();
        return fCourse === courseNameLower && f.pass === true;
      });
    }

    // Helper: check if part-time teacher wants to teach this subject
    // For part-time teachers, only assign subjects they explicitly prefer
    function teacherPrefersSubject(
      teacher: TeacherRecord,
      courseName: string,
      courseCode: string,
    ): boolean {
      const normalized = (teacher.employment_type || "").toLowerCase();
      // Only enforce preference constraints on part-time teachers
      const isPartTime = normalized.includes("part");
      if (!isPartTime) return true;

      const prefSubjects = teacher.preferences?.preferred_subjects;
      if (!prefSubjects || prefSubjects.length === 0) return true;

      const courseNameLower = courseName.trim().toLowerCase();
      const courseCodeLower = courseCode.trim().toLowerCase();

      return prefSubjects.some((pref) => {
        const prefLower = pref.trim().toLowerCase();
        return prefLower === courseNameLower || prefLower === courseCodeLower;
      });
    }

    // Process each unique subject
    const subjectIds = Array.from(subjectInfoMap.keys());

    for (const subjectId of subjectIds) {
      const subjectInfo = subjectInfoMap.get(subjectId)!;
      const preferenceRankedTeachers = [...activeTeachers].sort(
        (first, second) => {
          const preferenceDifference =
            getTeacherPreferenceMatchScore(
              second.preferences,
              subjectInfo.courseName,
              subjectInfo.courseCode,
              null,
            ) -
            getTeacherPreferenceMatchScore(
              first.preferences,
              subjectInfo.courseName,
              subjectInfo.courseCode,
              null,
            );
          if (preferenceDifference !== 0) return preferenceDifference;
          return (
            (teacherLoad.get(first.teacher_id) || 0) -
            (teacherLoad.get(second.teacher_id) || 0)
          );
        },
      );

      // Calculate total units for this subject across ALL sections
      // We need the per-subject units (lecture + lab), not multiplied by sections
      const subjectEntries = scheduleEntries.filter(
        (e) => e.subjectId === subjectId,
      );

      // Calculate unique section count for this subject
      const sectionsForSubject = new Set(
        subjectEntries.map((e) => e.sectionCode),
      );
      const sectionCount = sectionsForSubject.size;

      // Calculate per-section units (lecture + lab for one section)
      // Group by component type to get lecture units + lab units per section
      let perSectionUnits = 0;
      const hasLecture = subjectEntries.some(
        (e) => e.componentType === "LECTURE",
      );
      const hasLab = subjectEntries.some(
        (e) => e.componentType === "LABORATORY",
      );

      if (hasLecture) {
        const lecEntry = subjectEntries.find(
          (e) => e.componentType === "LECTURE",
        );
        perSectionUnits += lecEntry?.units || 0;
      }
      if (hasLab) {
        const labEntry = subjectEntries.find(
          (e) => e.componentType === "LABORATORY",
        );
        perSectionUnits += labEntry?.units || 0;
      }

      // Total units = perSectionUnits * sectionCount
      const totalUnitsForSubject = perSectionUnits * sectionCount;

      // Find the best matching teacher
      let bestTeacher: TeacherRecord | null = null;

      // First pass: find teachers with full AQ + FCCE match
      for (const teacher of preferenceRankedTeachers) {
        const loadLimit = getFacultyLoadLimit(teacher.employment_type);
        const absoluteMax = loadLimit + overloadMax;
        const currentLoad = teacherLoad.get(teacher.teacher_id) || 0;

        // Check if adding this subject would exceed absolute max
        if (currentLoad + totalUnitsForSubject > absoluteMax) continue;

        // Part-time teachers only teach subjects they prefer
        if (
          !teacherPrefersSubject(
            teacher,
            subjectInfo.courseName,
            subjectInfo.courseCode,
          )
        )
          continue;

        // Check AQ match
        if (!teacherAqMatches(teacher, subjectInfo.requiredAqs)) continue;

        // Check FCCE match
        if (!teacherFcceMatches(teacher, subjectInfo.courseName)) continue;

        // Teacher is already assigned to this subject – skip (one teacher per subject)
        if (teacherSubjects.get(teacher.teacher_id)?.has(subjectId)) continue;

        bestTeacher = teacher;
        break;
      }

      // Second pass: if no full match, find teachers with AQ match only
      if (!bestTeacher) {
        for (const teacher of preferenceRankedTeachers) {
          const loadLimit = getFacultyLoadLimit(teacher.employment_type);
          const absoluteMax = loadLimit + overloadMax;
          const currentLoad = teacherLoad.get(teacher.teacher_id) || 0;

          if (currentLoad + totalUnitsForSubject > absoluteMax) continue;
          if (
            !teacherPrefersSubject(
              teacher,
              subjectInfo.courseName,
              subjectInfo.courseCode,
            )
          )
            continue;
          if (!teacherAqMatches(teacher, subjectInfo.requiredAqs)) continue;
          if (teacherSubjects.get(teacher.teacher_id)?.has(subjectId)) continue;

          bestTeacher = teacher;
          break;
        }
      }

      // Third pass: if still no match, find any teacher with available load
      if (!bestTeacher) {
        for (const teacher of preferenceRankedTeachers) {
          const loadLimit = getFacultyLoadLimit(teacher.employment_type);
          const absoluteMax = loadLimit + overloadMax;
          const currentLoad = teacherLoad.get(teacher.teacher_id) || 0;

          if (currentLoad + totalUnitsForSubject > absoluteMax) continue;
          if (
            !teacherPrefersSubject(
              teacher,
              subjectInfo.courseName,
              subjectInfo.courseCode,
            )
          )
            continue;
          if (teacherSubjects.get(teacher.teacher_id)?.has(subjectId)) continue;

          bestTeacher = teacher;
          break;
        }
      }

      if (bestTeacher) {
        subjectTeacherMap.set(subjectId, bestTeacher.teacher_id);
        subjectTeacherNameMap.set(subjectId, bestTeacher.full_name);
        teacherLoad.set(
          bestTeacher.teacher_id,
          (teacherLoad.get(bestTeacher.teacher_id) || 0) + totalUnitsForSubject,
        );
        if (!teacherSubjects.has(bestTeacher.teacher_id)) {
          teacherSubjects.set(bestTeacher.teacher_id, new Set());
        }
        teacherSubjects.get(bestTeacher.teacher_id)!.add(subjectId);
      }
    }

    // 5. Assign teacher IDs and names to schedule entries
    // If a teacher was matched, assign them; otherwise leave as null
    const resultEntries = scheduleEntries.map((entry) => ({
      ...entry,
      teacherId: subjectTeacherMap.get(entry.subjectId) || null,
      teacherName: subjectTeacherNameMap.get(entry.subjectId) || null,
    }));

    return { success: true, scheduleEntries: resultEntries };
  } catch (error) {
    console.error("Failed to assign teachers to schedule:", error);
    return {
      success: false,
      scheduleEntries: scheduleEntries.map((e) => ({
        ...e,
        teacherId: null,
        teacherName: null,
      })),
      error: (error as Error).message || "Failed to assign teachers.",
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

/**
 * Find the earliest contiguous block of free time slots on a given day.
 * Scans from the beginning of the day, skipping over occupied slots and break periods.
 * If a potential block would hit a break, it jumps to after the break and continues scanning.
 * This ensures gaps created by breaks or occupied slots can be filled by later subjects.
 *
 * Returns the starting slot index, or -1 if no suitable block is found.
 */
function findEarliestAvailableSlots(
  day: string,
  timeSlots: string[],
  slotsNeeded: number,
  breakPeriods: BreakPeriodRecord[],
  isSlotOccupied: (slotIndex: number) => boolean,
  shouldSkipSlot?: (slotIndex: number) => boolean,
): number {
  for (let i = 0; i <= timeSlots.length - slotsNeeded; i++) {
    // Apply external skip filter (e.g. preferBefore6PM)
    if (shouldSkipSlot && shouldSkipSlot(i)) continue;

    // Check if any slot in this block is already occupied by section/course/subject
    let occupied = false;
    for (let j = 0; j < slotsNeeded; j++) {
      if (isSlotOccupied(i + j)) {
        occupied = true;
        // Skip past this occupied block to find the next candidate
        i = i + j;
        break;
      }
    }
    if (occupied) continue;

    // Check if any slot in this block hits a break period
    const sessionSlots = timeSlots.slice(i, i + slotsNeeded);
    const hitsBreak = sessionSlots.some((slot) =>
      isBreakTime(day, slot, breakPeriods),
    );
    if (hitsBreak) {
      // Jump past the break period to find the next available slot after it
      // Find the first break slot and skip to after it
      for (let j = 0; j < slotsNeeded; j++) {
        if (isBreakTime(day, sessionSlots[j], breakPeriods)) {
          // Skip to the slot after this break slot
          i = i + j;
          break;
        }
      }
      continue;
    }

    // Found a valid contiguous block
    return i;
  }
  return -1;
}

function isOjtLabType(
  labTypeId: string | null | undefined,
  ojtRoomTypeIds: Set<string>,
): boolean {
  return Boolean(
    labTypeId &&
      (labTypeId.trim().toLowerCase() === "ojt" ||
        ojtRoomTypeIds.has(labTypeId.trim().toLowerCase())),
  );
}

function getFilteredRooms(
  componentType: "LECTURE" | "LABORATORY",
  rooms: RoomForGeneration[],
  requiredLabTypeId?: string | null,
  lectureRoomTypeId?: string | null,
): RoomForGeneration[] {
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

  return availableRooms.length > 0
    ? availableRooms
    : rooms.filter((r) => {
        if (componentType === "LECTURE" && requiredLabTypeId) {
          return r.room_type !== requiredLabTypeId;
        }
        return true;
      });
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
  occupiedSubjectTimeSlots: Set<string>,
  sectionActiveDays: Map<string, Set<string>>,
  scheduleEntries: ScheduleEntry[],
  preferredVacantDay: string,
  breakPeriods: BreakPeriodRecord[],
  requiredLabTypeId?: string | null,
  lectureRoomTypeId?: string | null,
  preferBefore6PM: boolean = false,
  sectionDaySubjectCount?: Map<string, Map<string, number>>,
  ojtRoomTypeIds: Set<string> = new Set(),
): {
  day: string;
  endSlotIndex: number;
  roomId: string | null;
  roomName: string;
} | null {
  const slotsNeeded = Math.ceil((durationHours * 60) / 30);
  const activeDays = sectionActiveDays.get(sectionCode)!;
  const isRoomlessOjtLab =
    componentType === "LABORATORY" &&
    isOjtLabType(requiredLabTypeId, ojtRoomTypeIds);
  const fallbackRooms = isRoomlessOjtLab
    ? []
    : getFilteredRooms(
        componentType,
        rooms,
        requiredLabTypeId,
        lectureRoomTypeId,
      );

  // Use balanced day ordering if tracker is available, otherwise fall back to vacant-day ordering
  let prioritizedDays: string[];
  if (sectionDaySubjectCount && sectionDaySubjectCount.has(sectionCode)) {
    const dayCounts = sectionDaySubjectCount.get(sectionCode)!;
    const dayOrder: Record<string, number> = {};
    days.forEach((d, i) => (dayOrder[d] = i));

    // Build candidate days: active days first, then inactive if needed
    const candidateDays: string[] = [];
    for (const day of days) {
      if (activeDays.has(day)) {
        candidateDays.push(day);
      }
    }
    if (activeDays.size < 5) {
      for (const day of days) {
        if (!activeDays.has(day) && day !== preferredVacantDay) {
          candidateDays.push(day);
        }
      }
      candidateDays.push(preferredVacantDay);
    }
    candidateDays.sort((a, b) => {
      const countA = dayCounts.get(a) || 0;
      const countB = dayCounts.get(b) || 0;
      if (countA !== countB) return countA - countB;
      return dayOrder[a] - dayOrder[b];
    });
    prioritizedDays = candidateDays;
  } else {
    prioritizedDays = [
      ...days.filter((d) => d !== preferredVacantDay),
      preferredVacantDay,
    ];
  }

  // Helper to check if a session ending at slot index ends before 18:00
  function sessionEndsBefore6PM(endIndex: number): boolean {
    if (endIndex > timeSlots.length) return false;
    const lastSlot = timeSlots[endIndex - 1];
    const endTime = lastSlot.split(" - ")[1];
    const endMinutes = timeToMinutes(endTime);
    return endMinutes <= 18 * 60; // 18:00 = 6 PM
  }

  // Helper function for room-aware assignment with optional slot filter
  // Uses earliest-available-time strategy: always picks the first free contiguous block on each day,
  // jumping over breaks and occupied slots so gaps can be filled by later subjects.
  function tryRoomAwareAssignment(shouldSkipSlot: (i: number) => boolean): {
    day: string;
    endSlotIndex: number;
    roomId: string | null;
    roomName: string;
  } | null {
    for (const day of prioritizedDays) {
      if (
        day === preferredVacantDay &&
        activeDays.size < 5 &&
        activeDays.size > 0
      )
        continue;
      if (!activeDays.has(day) && activeDays.size >= 5) continue;

      // Find the earliest available contiguous block of slots on this day
      const earliestSlot = findEarliestAvailableSlots(
        day,
        timeSlots,
        slotsNeeded,
        breakPeriods,
        (slotIndex) => {
          const slot = timeSlots[slotIndex];
          return (
            occupiedSectionSlots.has(`${sectionCode}_${day}_${slot}`) ||
            occupiedCourseSlots.has(
              `${subject.course_code}_${componentType}_${day}_${slot}`,
            ) ||
            occupiedSubjectTimeSlots.has(
              `${subject.course_code}_${day}_${slot}`,
            )
          );
        },
        shouldSkipSlot,
      );

      if (earliestSlot === -1) continue;

      const sessionSlots = timeSlots.slice(
        earliestSlot,
        earliestSlot + slotsNeeded,
      );

      for (const room of fallbackRooms) {
        const isRoomFree = sessionSlots.every(
          (slot: string) =>
            !occupiedRoomSlots.has(`${room.room_id}_${day}_${slot}`),
        );

        if (isRoomFree) {
          sessionSlots.forEach((slot: string) => {
            occupiedSectionSlots.add(`${sectionCode}_${day}_${slot}`);
            occupiedRoomSlots.add(`${room.room_id}_${day}_${slot}`);
            occupiedCourseSlots.add(
              `${subject.course_code}_${componentType}_${day}_${slot}`,
            );
            occupiedSubjectTimeSlots.add(
              `${subject.course_code}_${day}_${slot}`,
            );
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
            type: componentType.toLowerCase(),
            teacherId: null,
            teacherName: null,
          });
          return {
            day,
            endSlotIndex: earliestSlot + slotsNeeded,
            roomId: room.room_id,
            roomName: room.room_name || "Unassigned Room",
          };
        }
      }
    }
    return null;
  }

  // Pass 1: Room & Break Period Aware Assignment
  if (preferBefore6PM) {
    // First try: only slots ending before 6 PM
    const result = tryRoomAwareAssignment(
      (i) => !sessionEndsBefore6PM(i + slotsNeeded),
    );
    if (result) return result;

    // Second try: all slots (fallback when before-6-PM slots are exhausted)
    return tryRoomAwareAssignment(() => false);
  } else {
    const result = tryRoomAwareAssignment(() => false);
    if (result) return result;
  }

  // Pass 2: Fallback Pass without room constraint
  // Uses earliest-available-time strategy, same as tryRoomAwareAssignment but without room constraints.
  function tryFallbackAssignment(shouldSkipSlot: (i: number) => boolean): {
    day: string;
    endSlotIndex: number;
    roomId: string | null;
    roomName: string;
  } | null {
    for (const day of prioritizedDays) {
      if (
        day === preferredVacantDay &&
        activeDays.size < 5 &&
        activeDays.size > 0
      )
        continue;
      if (!activeDays.has(day) && activeDays.size >= 5) continue;

      // Find the earliest available contiguous block of slots on this day
      const earliestSlot = findEarliestAvailableSlots(
        day,
        timeSlots,
        slotsNeeded,
        breakPeriods,
        (slotIndex) => {
          const slot = timeSlots[slotIndex];
          return (
            occupiedSectionSlots.has(`${sectionCode}_${day}_${slot}`) ||
            occupiedCourseSlots.has(
              `${subject.course_code}_${componentType}_${day}_${slot}`,
            ) ||
            occupiedSubjectTimeSlots.has(
              `${subject.course_code}_${day}_${slot}`,
            )
          );
        },
        shouldSkipSlot,
      );

      if (earliestSlot === -1) continue;

      const sessionSlots = timeSlots.slice(
        earliestSlot,
        earliestSlot + slotsNeeded,
      );

      sessionSlots.forEach((slot: string) => {
        occupiedSectionSlots.add(`${sectionCode}_${day}_${slot}`);
        occupiedCourseSlots.add(
          `${subject.course_code}_${componentType}_${day}_${slot}`,
        );
        occupiedSubjectTimeSlots.add(`${subject.course_code}_${day}_${slot}`);
      });
      activeDays.add(day);

      const startTime = sessionSlots[0].split(" - ")[0];
      const endTime = sessionSlots[sessionSlots.length - 1].split(" - ")[1];
      const units =
        componentType === "LECTURE" ? subject.lecture_units : subject.lab_units;

      scheduleEntries.push({
        sectionCode,
        subjectId: subject.subject_id,
        courseCode: subject.course_code,
        courseName: subject.course_name,
        componentType,
        units,
        roomId: null,
        roomName: isRoomlessOjtLab ? "No Room Required" : "Unassigned Room",
        day,
        startTime,
        endTime,
        type: componentType.toLowerCase(),
        teacherId: null,
        teacherName: null,
      });
      return {
        day,
        endSlotIndex: earliestSlot + slotsNeeded,
        roomId: null,
        roomName: "Unassigned Room",
      };
    }
    return null;
  }

  if (preferBefore6PM) {
    // First try: only slots ending before 6 PM
    const result = tryFallbackAssignment(
      (i) => !sessionEndsBefore6PM(i + slotsNeeded),
    );
    if (result) return result;

    // Second try: all slots (fallback when before-6-PM slots are exhausted)
    return tryFallbackAssignment(() => false);
  } else {
    return tryFallbackAssignment(() => false);
  }
}

function scheduleSessionStartingAtRoom(
  subject: AssignedSubjectDetail,
  sectionCode: string,
  componentType: "LECTURE" | "LABORATORY",
  durationHours: number,
  rooms: RoomForGeneration[],
  timeSlots: string[],
  day: string,
  startIndex: number,
  targetRoomId: string | null,
  targetRoomName: string,
  occupiedRoomSlots: Set<string>,
  occupiedSectionSlots: Set<string>,
  occupiedCourseSlots: Set<string>,
  occupiedSubjectTimeSlots: Set<string>,
  sectionActiveDays: Map<string, Set<string>>,
  scheduleEntries: ScheduleEntry[],
  breakPeriods: BreakPeriodRecord[],
): boolean {
  const slotsNeeded = Math.ceil((durationHours * 60) / 30);
  const activeDays = sectionActiveDays.get(sectionCode)!;

  if (startIndex + slotsNeeded > timeSlots.length) return false;

  const sessionSlots = timeSlots.slice(startIndex, startIndex + slotsNeeded);

  const hitsBreak = sessionSlots.some((slot) =>
    isBreakTime(day, slot, breakPeriods),
  );
  if (hitsBreak) return false;

  const isSectionFree = sessionSlots.every(
    (slot: string) =>
      !occupiedSectionSlots.has(`${sectionCode}_${day}_${slot}`),
  );
  if (!isSectionFree) return false;

  const isCourseFree = sessionSlots.every(
    (slot: string) =>
      !occupiedCourseSlots.has(
        `${subject.course_code}_${componentType}_${day}_${slot}`,
      ),
  );
  if (!isCourseFree) return false;

  const isSubjectTimeFree = sessionSlots.every(
    (slot: string) =>
      !occupiedSubjectTimeSlots.has(`${subject.course_code}_${day}_${slot}`),
  );
  if (!isSubjectTimeFree) return false;

  // Check if the exact target room is free for these slots
  if (targetRoomId) {
    const isRoomFree = sessionSlots.every(
      (slot: string) =>
        !occupiedRoomSlots.has(`${targetRoomId}_${day}_${slot}`),
    );

    if (isRoomFree) {
      sessionSlots.forEach((slot: string) => {
        occupiedSectionSlots.add(`${sectionCode}_${day}_${slot}`);
        occupiedRoomSlots.add(`${targetRoomId}_${day}_${slot}`);
        occupiedCourseSlots.add(
          `${subject.course_code}_${componentType}_${day}_${slot}`,
        );
        occupiedSubjectTimeSlots.add(`${subject.course_code}_${day}_${slot}`);
      });
      activeDays.add(day);

      const startTime = sessionSlots[0].split(" - ")[0];
      const endTime = sessionSlots[sessionSlots.length - 1].split(" - ")[1];
      const units =
        componentType === "LECTURE" ? subject.lecture_units : subject.lab_units;

      scheduleEntries.push({
        sectionCode,
        subjectId: subject.subject_id,
        courseCode: subject.course_code,
        courseName: subject.course_name,
        componentType,
        units,
        roomId: targetRoomId,
        roomName: targetRoomName,
        day,
        startTime,
        endTime,
        type: componentType.toLowerCase(),
        teacherId: null,
        teacherName: null,
      });
      return true;
    }
  }

  // Fallback if target room is occupied: try to find another suitable room
  const fallbackRooms = getFilteredRooms(
    componentType,
    rooms,
    subject.lab_type || null,
    componentType === "LECTURE" ? null : undefined,
  );

  for (const room of fallbackRooms) {
    const isRoomFree = sessionSlots.every(
      (slot: string) =>
        !occupiedRoomSlots.has(`${room.room_id}_${day}_${slot}`),
    );

    if (isRoomFree) {
      sessionSlots.forEach((slot: string) => {
        occupiedSectionSlots.add(`${sectionCode}_${day}_${slot}`);
        occupiedRoomSlots.add(`${room.room_id}_${day}_${slot}`);
        occupiedCourseSlots.add(
          `${subject.course_code}_${componentType}_${day}_${slot}`,
        );
        occupiedSubjectTimeSlots.add(`${subject.course_code}_${day}_${slot}`);
      });
      activeDays.add(day);

      const startTime = sessionSlots[0].split(" - ")[0];
      const endTime = sessionSlots[sessionSlots.length - 1].split(" - ")[1];
      const units =
        componentType === "LECTURE" ? subject.lecture_units : subject.lab_units;

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
        type: componentType.toLowerCase(),
        teacherId: null,
        teacherName: null,
      });
      return true;
    }
  }

  // Last resort: schedule without any room constraint
  sessionSlots.forEach((slot: string) => {
    occupiedSectionSlots.add(`${sectionCode}_${day}_${slot}`);
    occupiedCourseSlots.add(
      `${subject.course_code}_${componentType}_${day}_${slot}`,
    );
    occupiedSubjectTimeSlots.add(`${subject.course_code}_${day}_${slot}`);
  });
  activeDays.add(day);

  const startTime = sessionSlots[0].split(" - ")[0];
  const endTime = sessionSlots[sessionSlots.length - 1].split(" - ")[1];
  const units =
    componentType === "LECTURE" ? subject.lecture_units : subject.lab_units;

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
    teacherId: null,
    teacherName: null,
  });
  return true;
}
