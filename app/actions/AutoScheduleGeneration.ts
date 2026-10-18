"use client";

import {
  Configuration,
  fetchFacultyLoadConfig,
  fetchPrograms,
  fetchSubjectRequirements,
} from "@/app/actions/system";

// For Debugging Only
const testMode = true;

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
}> {
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

    if(testMode) {
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
      const sectionNum = digits.slice(1);     // e.g., "11"

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

          const yearMatched = yearSubstrings.some((sub) => yt.includes(sub)) ||
              yt.startsWith(`${targetYearNum} `) ||
              yt.includes(` ${targetYearNum} `);

          const termMatched = termSubstrings.some((sub) => yt.includes(sub)) ||
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