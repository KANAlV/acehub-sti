"use client";

import {
  Configuration,
  fetchBreakPeriods,
  fetchFacultyLoadConfig,
  fetchLecRoomID,
  fetchPrograms,
  fetchRoomTypeList,
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
  tertiaryTerm: string,
  shsTerm: string = "Term 1",
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
    const tertiaryTermDigit = tertiaryTermNum > 2 ? 2 : tertiaryTermNum < 1 ? 1 : tertiaryTermNum;

    // Parse SHS term digit (1-4)
    const shsTermNum = parseInt(shsTerm.replace(/[^0-9]/g, "")) || 1;
    const shsTermDigit = shsTermNum > 4 ? 4 : shsTermNum < 1 ? 1 : shsTermNum;

    // Filter subjects by term/semester: both tertiary and SHS subjects must match
    const filteredSubjects = allSubjects.filter((subject) => {
      const yt = (subject.year_term || "").toLowerCase().trim();
      
      // Subjects without term/semester info are removed
      const hasTermInfo = yt.includes("term") || yt.includes("semester");
      if (!hasTermInfo) {
        return false;
      }

      const isSubjectSHS = yt.includes("shs") || yt.includes("grade");

      if (isSubjectSHS) {
        // SHS subjects: filter by selected SHS term
        return yt.includes(`term ${shsTermDigit}`) || yt.includes(`semester ${shsTermDigit}`);
      }

      // Tertiary subjects: filter by selected semester
      return yt.includes(`semester ${tertiaryTermDigit}`) || yt.includes(`term ${tertiaryTermDigit}`);
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

    // Parse tertiary term
    const tertiaryTermLower = tertiaryTerm.toLowerCase();
    const isTertiaryFirstTerm = tertiaryTermLower.includes("1") || tertiaryTermLower.includes("1st");
    const tertiaryTermOffset = isTertiaryFirstTerm ? 1 : 2;

    // Parse SHS term (supports Term 1-4)
    const shsTermNum = parseInt(shsTerm.replace(/[^0-9]/g, "")) || 1;
    const shsTermDigit = shsTermNum > 4 ? 4 : shsTermNum < 1 ? 1 : shsTermNum;

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
    let sections = precomputedSections;

    if (!sections || sections.length === 0) {
      const sectionResult = await generateProgramSections(_name, [], tertiaryTerm, shsTerm);
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

    for (const sectionCode of sections) {
      const shsMatch = sectionCode.match(/^([A-Z]+)([12])(\d{2})$/);

      const matchedSubjects = allSubjects.filter((subject) => {
        const subProg = (subject.program_code || "").trim().toUpperCase();
        const yt = (subject.year_term || "").toLowerCase().trim();
        const isSubjectSHS = yt.includes("shs") || yt.includes("grade");

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
          const yearMatched = yearRegex.test(yt);

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
            const gradeMatches = gradeRegex.test(yt);

            return gradeMatches;
          }
          // Section looks like SHS but subject is tertiary — try tertiary matching
          return tryTertiaryMatch();
        } else {
          return tryTertiaryMatch();
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
    if (roomTypesResult.success && roomTypesResult.data) {
      for (const rt of roomTypesResult.data) {
        if (rt.value && rt.value.toLowerCase().includes("kitchen")) {
          kitchenRoomTypeIds.add(rt.room_type_id);
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

    // Track scheduled components for same-day pairing: key = "sectionCode_subjectId_componentType"
    const scheduledComponents = new Map<string, { day: string; startIndex: number; endIndex: number }>();

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
      const isKitchenLab = subject.lab_type && kitchenRoomTypeIds.has(subject.lab_type);

      if (hasLecture && hasLab && !isKitchenLab) {
        // New pairing logic: try to schedule both components on the same day in adjacent slots
        const paired = trySchedulePaired(
          subject,
          sectionCode,
          sectionTimeSlots,
          preferredVacantDay,
          preferBefore6PM,
          lecHours,
          labHours,
        );
        if (paired) return;
      }

      // Fallback: independent scheduling if pairing failed or not applicable
      if (hasLecture) {
        scheduleSession(
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
        );
      }

      if (hasLab) {
        scheduleSession(
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
        );
      }
    }

    // Try to schedule lecture and lab on the same day in adjacent time slots
    function trySchedulePaired(
      subject: AssignedSubjectDetail,
      sectionCode: string,
      sectionTimeSlots: string[],
      preferredVacantDay: string,
      preferBefore6PM: boolean,
      lecHours: number,
      labHours: number,
    ): boolean {
      const lecSlotsNeeded = Math.ceil((lecHours * 60) / 30);
      const labSlotsNeeded = Math.ceil((labHours * 60) / 30);
      const activeDays = sectionActiveDays.get(sectionCode)!;
      const prioritizedDays = [
        ...days.filter((d) => d !== preferredVacantDay),
        preferredVacantDay,
      ];

      const labRooms = getFilteredRooms("LABORATORY", rooms, subject.lab_type, null);
      const lecRooms = getFilteredRooms("LECTURE", rooms, subject.lab_type, lectureRoomTypeId);

      // Helper to check if a session ending at slot index ends before 18:00
      function sessionEndsBefore6PM(endIndex: number): boolean {
        if (endIndex > sectionTimeSlots.length) return false;
        const lastSlot = sectionTimeSlots[endIndex - 1];
        const endTime = lastSlot.split(" - ")[1];
        const endMinutes = timeToMinutes(endTime);
        return endMinutes <= 18 * 60;
      }

      // Try each day, then each position, trying both lec-first and lab-first ordering
      // Uses earliest-available-time strategy: scans from the beginning, jumping over
      // occupied blocks and break periods so gaps can be filled by later subjects.
      const totalSlotsNeeded = lecSlotsNeeded + labSlotsNeeded;
      for (const day of prioritizedDays) {
        if (day === preferredVacantDay && activeDays.size < 5 && activeDays.size > 0) continue;
        if (!activeDays.has(day) && activeDays.size >= 5) continue;

        for (let i = 0; i <= sectionTimeSlots.length - totalSlotsNeeded; i++) {
          // Check if this position is valid for before-6-PM preference
          if (preferBefore6PM && !sessionEndsBefore6PM(i + totalSlotsNeeded)) {
            continue;
          }

          // Check if any slot in this block is occupied — skip past occupied blocks
          let occupied = false;
          for (let j = 0; j < totalSlotsNeeded; j++) {
            const slot = sectionTimeSlots[i + j];
            if (
              occupiedSectionSlots.has(`${sectionCode}_${day}_${slot}`) ||
              occupiedSubjectTimeSlots.has(`${subject.course_code}_${day}_${slot}`)
            ) {
              occupied = true;
              i = i + j; // Skip past this occupied block
              break;
            }
          }
          if (occupied) continue;

          const lecSlots = sectionTimeSlots.slice(i, i + lecSlotsNeeded);
          const labSlotsAfter = sectionTimeSlots.slice(i + lecSlotsNeeded, i + totalSlotsNeeded);
          const labSlotsBefore = sectionTimeSlots.slice(i, i + labSlotsNeeded);
          const lecSlotsAfter = sectionTimeSlots.slice(i + labSlotsNeeded, i + totalSlotsNeeded);

          // Check break periods for both orderings
          const lecHitsBreak = lecSlots.some((slot) => isBreakTime(day, slot, breakPeriods));
          const labHitsBreakAfter = labSlotsAfter.some((slot) => isBreakTime(day, slot, breakPeriods));
          const labHitsBreakBefore = labSlotsBefore.some((slot) => isBreakTime(day, slot, breakPeriods));
          const lecHitsBreakAfter = lecSlotsAfter.some((slot) => isBreakTime(day, slot, breakPeriods));

          // If both orderings hit breaks, jump past the break
          if (lecHitsBreak || labHitsBreakAfter || labHitsBreakBefore || lecHitsBreakAfter) {
            // Find the first break slot and skip past it
            const blockSlots = sectionTimeSlots.slice(i, i + totalSlotsNeeded);
            let jumped = false;
            for (let j = 0; j < totalSlotsNeeded; j++) {
              if (isBreakTime(day, blockSlots[j], breakPeriods)) {
                i = i + j;
                jumped = true;
                break;
              }
            }
            if (jumped) continue;
          }

          // Try ordering: Lecture first, then Lab
          if (!lecHitsBreak && !labHitsBreakAfter) {
            const lecFree = lecSlots.every((slot) =>
              !occupiedSectionSlots.has(`${sectionCode}_${day}_${slot}`) &&
              !occupiedCourseSlots.has(`${subject.course_code}_LECTURE_${day}_${slot}`) &&
              !occupiedSubjectTimeSlots.has(`${subject.course_code}_${day}_${slot}`)
            );
            const labFree = labSlotsAfter.every((slot) =>
              !occupiedSectionSlots.has(`${sectionCode}_${day}_${slot}`) &&
              !occupiedCourseSlots.has(`${subject.course_code}_LABORATORY_${day}_${slot}`) &&
              !occupiedSubjectTimeSlots.has(`${subject.course_code}_${day}_${slot}`)
            );

            if (lecFree && labFree) {
              // Try to find rooms
              let lecRoom: RoomForGeneration | null = null;
              let labRoom: RoomForGeneration | null = null;

              for (const room of lecRooms) {
                if (lecSlots.every((slot) => !occupiedRoomSlots.has(`${room.room_id}_${day}_${slot}`))) {
                  lecRoom = room;
                  break;
                }
              }
              for (const room of labRooms) {
                if (labSlotsAfter.every((slot) => !occupiedRoomSlots.has(`${room.room_id}_${day}_${slot}`))) {
                  labRoom = room;
                  break;
                }
              }

              if (lecRoom && labRoom) {
                // Schedule Lecture
                lecSlots.forEach((slot) => {
                  occupiedSectionSlots.add(`${sectionCode}_${day}_${slot}`);
                  occupiedRoomSlots.add(`${lecRoom.room_id}_${day}_${slot}`);
                  occupiedCourseSlots.add(`${subject.course_code}_LECTURE_${day}_${slot}`);
                  occupiedSubjectTimeSlots.add(`${subject.course_code}_${day}_${slot}`);
                });
                activeDays.add(day);

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
                });
                scheduledComponents.set(`${sectionCode}_${subject.subject_id}_LECTURE`, {
                  day, startIndex: i, endIndex: i + lecSlotsNeeded
                });

                // Schedule Lab immediately after
                labSlotsAfter.forEach((slot) => {
                  occupiedSectionSlots.add(`${sectionCode}_${day}_${slot}`);
                  occupiedRoomSlots.add(`${labRoom.room_id}_${day}_${slot}`);
                  occupiedCourseSlots.add(`${subject.course_code}_LABORATORY_${day}_${slot}`);
                  occupiedSubjectTimeSlots.add(`${subject.course_code}_${day}_${slot}`);
                });

                const labStartTime = labSlotsAfter[0].split(" - ")[0];
                const labEndTime = labSlotsAfter[labSlotsAfter.length - 1].split(" - ")[1];
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
                });
                scheduledComponents.set(`${sectionCode}_${subject.subject_id}_LABORATORY`, {
                  day, startIndex: i + lecSlotsNeeded, endIndex: i + lecSlotsNeeded + labSlotsNeeded
                });

                return true;
              }
            }
          }

          // Try ordering: Lab first, then Lecture
          if (!labHitsBreakBefore && !lecHitsBreakAfter) {
            const labFree = labSlotsBefore.every((slot) =>
              !occupiedSectionSlots.has(`${sectionCode}_${day}_${slot}`) &&
              !occupiedCourseSlots.has(`${subject.course_code}_LABORATORY_${day}_${slot}`) &&
              !occupiedSubjectTimeSlots.has(`${subject.course_code}_${day}_${slot}`)
            );
            const lecFree = lecSlotsAfter.every((slot) =>
              !occupiedSectionSlots.has(`${sectionCode}_${day}_${slot}`) &&
              !occupiedCourseSlots.has(`${subject.course_code}_LECTURE_${day}_${slot}`) &&
              !occupiedSubjectTimeSlots.has(`${subject.course_code}_${day}_${slot}`)
            );

            if (labFree && lecFree) {
              let labRoom: RoomForGeneration | null = null;
              let lecRoom: RoomForGeneration | null = null;

              for (const room of labRooms) {
                if (labSlotsBefore.every((slot) => !occupiedRoomSlots.has(`${room.room_id}_${day}_${slot}`))) {
                  labRoom = room;
                  break;
                }
              }
              for (const room of lecRooms) {
                if (lecSlotsAfter.every((slot) => !occupiedRoomSlots.has(`${room.room_id}_${day}_${slot}`))) {
                  lecRoom = room;
                  break;
                }
              }

              if (labRoom && lecRoom) {
                // Schedule Lab first
                labSlotsBefore.forEach((slot) => {
                  occupiedSectionSlots.add(`${sectionCode}_${day}_${slot}`);
                  occupiedRoomSlots.add(`${labRoom.room_id}_${day}_${slot}`);
                  occupiedCourseSlots.add(`${subject.course_code}_LABORATORY_${day}_${slot}`);
                  occupiedSubjectTimeSlots.add(`${subject.course_code}_${day}_${slot}`);
                });
                activeDays.add(day);

                const labStartTime = labSlotsBefore[0].split(" - ")[0];
                const labEndTime = labSlotsBefore[labSlotsBefore.length - 1].split(" - ")[1];
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
                });
                scheduledComponents.set(`${sectionCode}_${subject.subject_id}_LABORATORY`, {
                  day, startIndex: i, endIndex: i + labSlotsNeeded
                });

                // Schedule Lecture immediately after
                lecSlotsAfter.forEach((slot) => {
                  occupiedSectionSlots.add(`${sectionCode}_${day}_${slot}`);
                  occupiedRoomSlots.add(`${lecRoom.room_id}_${day}_${slot}`);
                  occupiedCourseSlots.add(`${subject.course_code}_LECTURE_${day}_${slot}`);
                  occupiedSubjectTimeSlots.add(`${subject.course_code}_${day}_${slot}`);
                });

                const lecStartTime = lecSlotsAfter[0].split(" - ")[0];
                const lecEndTime = lecSlotsAfter[lecSlotsAfter.length - 1].split(" - ")[1];
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
                });
                scheduledComponents.set(`${sectionCode}_${subject.subject_id}_LECTURE`, {
                  day, startIndex: i + labSlotsNeeded, endIndex: i + labSlotsNeeded + lecSlotsNeeded
                });

                return true;
              }
            }
          }
        }
      }

      // If preferBefore6PM failed, retry without the constraint
      // Uses earliest-available-time strategy with break-aware jumping.
      if (preferBefore6PM) {
        for (const day of prioritizedDays) {
          if (day === preferredVacantDay && activeDays.size < 5 && activeDays.size > 0) continue;
          if (!activeDays.has(day) && activeDays.size >= 5) continue;

          for (let i = 0; i <= sectionTimeSlots.length - totalSlotsNeeded; i++) {
            // Check if any slot in this block is occupied — skip past occupied blocks
            let occupied = false;
            for (let j = 0; j < totalSlotsNeeded; j++) {
              const slot = sectionTimeSlots[i + j];
              if (
                occupiedSectionSlots.has(`${sectionCode}_${day}_${slot}`) ||
                occupiedSubjectTimeSlots.has(`${subject.course_code}_${day}_${slot}`)
              ) {
                occupied = true;
                i = i + j;
                break;
              }
            }
            if (occupied) continue;

            const lecSlots = sectionTimeSlots.slice(i, i + lecSlotsNeeded);
            const labSlotsAfter = sectionTimeSlots.slice(i + lecSlotsNeeded, i + totalSlotsNeeded);
            const labSlotsBefore = sectionTimeSlots.slice(i, i + labSlotsNeeded);
            const lecSlotsAfter = sectionTimeSlots.slice(i + labSlotsNeeded, i + totalSlotsNeeded);

            const lecHitsBreak = lecSlots.some((slot) => isBreakTime(day, slot, breakPeriods));
            const labHitsBreakAfter = labSlotsAfter.some((slot) => isBreakTime(day, slot, breakPeriods));
            const labHitsBreakBefore = labSlotsBefore.some((slot) => isBreakTime(day, slot, breakPeriods));
            const lecHitsBreakAfter = lecSlotsAfter.some((slot) => isBreakTime(day, slot, breakPeriods));

            // If both orderings hit breaks, jump past the break
            if (lecHitsBreak || labHitsBreakAfter || labHitsBreakBefore || lecHitsBreakAfter) {
              const blockSlots = sectionTimeSlots.slice(i, i + totalSlotsNeeded);
              let jumped = false;
              for (let j = 0; j < totalSlotsNeeded; j++) {
                if (isBreakTime(day, blockSlots[j], breakPeriods)) {
                  i = i + j;
                  jumped = true;
                  break;
                }
              }
              if (jumped) continue;
            }

            // Try ordering: Lecture first, then Lab
            if (!lecHitsBreak && !labHitsBreakAfter) {
              const lecFree = lecSlots.every((slot) =>
                !occupiedSectionSlots.has(`${sectionCode}_${day}_${slot}`) &&
                !occupiedCourseSlots.has(`${subject.course_code}_LECTURE_${day}_${slot}`) &&
                !occupiedSubjectTimeSlots.has(`${subject.course_code}_${day}_${slot}`)
              );
              const labFree = labSlotsAfter.every((slot) =>
                !occupiedSectionSlots.has(`${sectionCode}_${day}_${slot}`) &&
                !occupiedCourseSlots.has(`${subject.course_code}_LABORATORY_${day}_${slot}`) &&
                !occupiedSubjectTimeSlots.has(`${subject.course_code}_${day}_${slot}`)
              );

              if (lecFree && labFree) {
                let lecRoom: RoomForGeneration | null = null;
                let labRoom: RoomForGeneration | null = null;

                for (const room of lecRooms) {
                  if (lecSlots.every((slot) => !occupiedRoomSlots.has(`${room.room_id}_${day}_${slot}`))) {
                    lecRoom = room;
                    break;
                  }
                }
                for (const room of labRooms) {
                  if (labSlotsAfter.every((slot) => !occupiedRoomSlots.has(`${room.room_id}_${day}_${slot}`))) {
                    labRoom = room;
                    break;
                  }
                }

                if (lecRoom && labRoom) {
                  lecSlots.forEach((slot) => {
                    occupiedSectionSlots.add(`${sectionCode}_${day}_${slot}`);
                    occupiedRoomSlots.add(`${lecRoom.room_id}_${day}_${slot}`);
                    occupiedCourseSlots.add(`${subject.course_code}_LECTURE_${day}_${slot}`);
                    occupiedSubjectTimeSlots.add(`${subject.course_code}_${day}_${slot}`);
                  });
                  activeDays.add(day);

                  scheduleEntries.push({
                    sectionCode, subjectId: subject.subject_id, courseCode: subject.course_code,
                    courseName: subject.course_name, componentType: "LECTURE", units: subject.lecture_units,
                    roomId: lecRoom.room_id, roomName: lecRoom.room_name || "Unassigned Room",
                    day, startTime: lecSlots[0].split(" - ")[0], endTime: lecSlots[lecSlots.length - 1].split(" - ")[1],
                    type: "lecture",
                  });
                  scheduledComponents.set(`${sectionCode}_${subject.subject_id}_LECTURE`, {
                    day, startIndex: i, endIndex: i + lecSlotsNeeded
                  });

                  labSlotsAfter.forEach((slot) => {
                    occupiedSectionSlots.add(`${sectionCode}_${day}_${slot}`);
                    occupiedRoomSlots.add(`${labRoom.room_id}_${day}_${slot}`);
                    occupiedCourseSlots.add(`${subject.course_code}_LABORATORY_${day}_${slot}`);
                    occupiedSubjectTimeSlots.add(`${subject.course_code}_${day}_${slot}`);
                  });

                  scheduleEntries.push({
                    sectionCode, subjectId: subject.subject_id, courseCode: subject.course_code,
                    courseName: subject.course_name, componentType: "LABORATORY", units: subject.lab_units,
                    roomId: labRoom.room_id, roomName: labRoom.room_name || "Unassigned Room",
                    day, startTime: labSlotsAfter[0].split(" - ")[0], endTime: labSlotsAfter[labSlotsAfter.length - 1].split(" - ")[1],
                    type: "laboratory",
                  });
                  scheduledComponents.set(`${sectionCode}_${subject.subject_id}_LABORATORY`, {
                    day, startIndex: i + lecSlotsNeeded, endIndex: i + lecSlotsNeeded + labSlotsNeeded
                  });

                  return true;
                }
              }
            }

            // Try ordering: Lab first, then Lecture
            if (!labHitsBreakBefore && !lecHitsBreakAfter) {
              const labFree = labSlotsBefore.every((slot) =>
                !occupiedSectionSlots.has(`${sectionCode}_${day}_${slot}`) &&
                !occupiedCourseSlots.has(`${subject.course_code}_LABORATORY_${day}_${slot}`) &&
                !occupiedSubjectTimeSlots.has(`${subject.course_code}_${day}_${slot}`)
              );
              const lecFree = lecSlotsAfter.every((slot) =>
                !occupiedSectionSlots.has(`${sectionCode}_${day}_${slot}`) &&
                !occupiedCourseSlots.has(`${subject.course_code}_LECTURE_${day}_${slot}`) &&
                !occupiedSubjectTimeSlots.has(`${subject.course_code}_${day}_${slot}`)
              );

              if (labFree && lecFree) {
                let labRoom: RoomForGeneration | null = null;
                let lecRoom: RoomForGeneration | null = null;

                for (const room of labRooms) {
                  if (labSlotsBefore.every((slot) => !occupiedRoomSlots.has(`${room.room_id}_${day}_${slot}`))) {
                    labRoom = room;
                    break;
                  }
                }
                for (const room of lecRooms) {
                  if (lecSlotsAfter.every((slot) => !occupiedRoomSlots.has(`${room.room_id}_${day}_${slot}`))) {
                    lecRoom = room;
                    break;
                  }
                }

                if (labRoom && lecRoom) {
                  labSlotsBefore.forEach((slot) => {
                    occupiedSectionSlots.add(`${sectionCode}_${day}_${slot}`);
                    occupiedRoomSlots.add(`${labRoom.room_id}_${day}_${slot}`);
                    occupiedCourseSlots.add(`${subject.course_code}_LABORATORY_${day}_${slot}`);
                    occupiedSubjectTimeSlots.add(`${subject.course_code}_${day}_${slot}`);
                  });
                  activeDays.add(day);

                  scheduleEntries.push({
                    sectionCode, subjectId: subject.subject_id, courseCode: subject.course_code,
                    courseName: subject.course_name, componentType: "LABORATORY", units: subject.lab_units,
                    roomId: labRoom.room_id, roomName: labRoom.room_name || "Unassigned Room",
                    day, startTime: labSlotsBefore[0].split(" - ")[0], endTime: labSlotsBefore[labSlotsBefore.length - 1].split(" - ")[1],
                    type: "laboratory",
                  });
                  scheduledComponents.set(`${sectionCode}_${subject.subject_id}_LABORATORY`, {
                    day, startIndex: i, endIndex: i + labSlotsNeeded
                  });

                  lecSlotsAfter.forEach((slot) => {
                    occupiedSectionSlots.add(`${sectionCode}_${day}_${slot}`);
                    occupiedRoomSlots.add(`${lecRoom.room_id}_${day}_${slot}`);
                    occupiedCourseSlots.add(`${subject.course_code}_LECTURE_${day}_${slot}`);
                    occupiedSubjectTimeSlots.add(`${subject.course_code}_${day}_${slot}`);
                  });

                  scheduleEntries.push({
                    sectionCode, subjectId: subject.subject_id, courseCode: subject.course_code,
                    courseName: subject.course_name, componentType: "LECTURE", units: subject.lecture_units,
                    roomId: lecRoom.room_id, roomName: lecRoom.room_name || "Unassigned Room",
                    day, startTime: lecSlotsAfter[0].split(" - ")[0], endTime: lecSlotsAfter[lecSlotsAfter.length - 1].split(" - ")[1],
                    type: "lecture",
                  });
                  scheduledComponents.set(`${sectionCode}_${subject.subject_id}_LECTURE`, {
                    day, startIndex: i + labSlotsNeeded, endIndex: i + labSlotsNeeded + lecSlotsNeeded
                  });

                  return true;
                }
              }
            }
          }
        }
      }

      return false;
    }

    // Categorize sections into SHS and Tertiary
    const shsAssignments: SectionSubjectAssignment[] = [];
    const tertiaryAssignments: SectionSubjectAssignment[] = [];

    for (const assignment of sectionAssignments) {
      const isShsSection = /^([A-Z]+)([12])(\d{2})$/.test(assignment.sectionCode);
      if (isShsSection) {
        shsAssignments.push(assignment);
      } else {
        tertiaryAssignments.push(assignment);
      }
      if (!sectionActiveDays.has(assignment.sectionCode)) {
        sectionActiveDays.set(assignment.sectionCode, new Set<string>());
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
          scheduleSubject(subject, sectionCode, sectionTimeSlots, preferredVacantDay, false);
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
          scheduleSubject(subject, sectionCode, sectionTimeSlots, preferredVacantDay, true);
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
          scheduleSubject(subject, sectionCode, sectionTimeSlots, preferredVacantDay, false);
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
          scheduleSubject(subject, sectionCode, sectionTimeSlots, preferredVacantDay, true);
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
): {
  day: string;
  endSlotIndex: number;
  roomId: string | null;
  roomName: string;
} | null {
  const slotsNeeded = Math.ceil((durationHours * 60) / 30);
  const activeDays = sectionActiveDays.get(sectionCode)!;
  const fallbackRooms = getFilteredRooms(
    componentType,
    rooms,
    requiredLabTypeId,
    lectureRoomTypeId,
  );

  const prioritizedDays = [
    ...days.filter((d) => d !== preferredVacantDay),
    preferredVacantDay,
  ];

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
  function tryRoomAwareAssignment(
    shouldSkipSlot: (i: number) => boolean,
  ): {
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
            occupiedCourseSlots.has(`${subject.course_code}_${componentType}_${day}_${slot}`) ||
            occupiedSubjectTimeSlots.has(`${subject.course_code}_${day}_${slot}`)
          );
        },
        shouldSkipSlot,
      );

      if (earliestSlot === -1) continue;

      const sessionSlots = timeSlots.slice(earliestSlot, earliestSlot + slotsNeeded);

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
    const result = tryRoomAwareAssignment((i) => !sessionEndsBefore6PM(i + slotsNeeded));
    if (result) return result;

    // Second try: all slots (fallback when before-6-PM slots are exhausted)
    return tryRoomAwareAssignment(() => false);
  } else {
    const result = tryRoomAwareAssignment(() => false);
    if (result) return result;
  }

  // Pass 2: Fallback Pass without room constraint
  // Uses earliest-available-time strategy, same as tryRoomAwareAssignment but without room constraints.
  function tryFallbackAssignment(
    shouldSkipSlot: (i: number) => boolean,
  ): {
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
            occupiedCourseSlots.has(`${subject.course_code}_${componentType}_${day}_${slot}`) ||
            occupiedSubjectTimeSlots.has(`${subject.course_code}_${day}_${slot}`)
          );
        },
        shouldSkipSlot,
      );

      if (earliestSlot === -1) continue;

      const sessionSlots = timeSlots.slice(earliestSlot, earliestSlot + slotsNeeded);

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
    const result = tryFallbackAssignment((i) => !sessionEndsBefore6PM(i + slotsNeeded));
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
  });
  return true;
}