export interface RequiredScheduleAssignment {
  sectionCode: string;
  subjects: Array<{
    subject_id: string;
    lecture_units: number;
    lab_units: number;
  }>;
}

export interface GeneratedScheduleEntry {
  sectionCode: string;
  subjectId: string;
  courseCode?: string;
  componentType: "LECTURE" | "LABORATORY";
  day: string;
  startTime: string;
  endTime: string;
  teacherId: string | null;
  teacherName: string | null;
  roomId: string | null;
}

export interface GeneratedScheduleValidation {
  missingComponents: string[];
  unassignedTeachers: string[];
  invalidEntries: string[];
  teacherConflicts: string[];
  sectionConflicts: string[];
  roomConflicts: string[];
}

export interface GeneratedScheduleValidationOptions {
  requireTeachers?: boolean;
}

function getTimeInMinutes(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

function overlaps(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
): boolean {
  return firstStart < secondEnd && secondStart < firstEnd;
}

function formatEntry(entry: GeneratedScheduleEntry): string {
  return `${entry.sectionCode} ${entry.courseCode || entry.subjectId} (${entry.day} ${entry.startTime}-${entry.endTime})`;
}

function isCrossTrackSection(sectionCode: string): boolean {
  return /^.+-CT\d{3,}$/i.test(sectionCode.trim());
}

export function validateGeneratedSchedule(
  entries: GeneratedScheduleEntry[],
  assignments: RequiredScheduleAssignment[],
  options: GeneratedScheduleValidationOptions = {},
): GeneratedScheduleValidation {
  const requiredComponents = new Set<string>();
  for (const assignment of assignments) {
    if (isCrossTrackSection(assignment.sectionCode)) continue;

    for (const subject of assignment.subjects) {
      if (subject.lecture_units > 0) {
        requiredComponents.add(
          `${assignment.sectionCode}|${subject.subject_id}|LECTURE`,
        );
      }
      if (subject.lab_units > 0) {
        requiredComponents.add(
          `${assignment.sectionCode}|${subject.subject_id}|LABORATORY`,
        );
      }
    }
  }

  const primaryEntries = entries.filter(
    (entry) => !isCrossTrackSection(entry.sectionCode),
  );
  const scheduledComponents = new Set(
    primaryEntries.map(
      (entry) =>
        `${entry.sectionCode}|${entry.subjectId}|${entry.componentType}`,
    ),
  );
  const missingComponents = [...requiredComponents]
    .filter((component) => !scheduledComponents.has(component))
    .map((component) => {
      const [sectionCode, subjectId, componentType] = component.split("|");
      return `${sectionCode} ${subjectId} ${componentType.toLowerCase()}`;
    });

  const unassignedTeachers: string[] = [];
  const invalidEntries: string[] = [];
  const teacherConflicts: string[] = [];
  const sectionConflicts: string[] = [];
  const roomConflicts: string[] = [];

  const timedEntries = primaryEntries.flatMap((entry) => {
    if (options.requireTeachers !== false && !entry.teacherId) {
      unassignedTeachers.push(formatEntry(entry));
    }

    const start = getTimeInMinutes(entry.startTime);
    const end = getTimeInMinutes(entry.endTime);
    if (start === null || end === null || end <= start || !entry.day.trim()) {
      invalidEntries.push(formatEntry(entry));
      return [];
    }

    return [{ entry, start, end }];
  });

  for (let firstIndex = 0; firstIndex < timedEntries.length; firstIndex++) {
    const first = timedEntries[firstIndex];
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < timedEntries.length;
      secondIndex++
    ) {
      const second = timedEntries[secondIndex];
      if (
        first.entry.day.trim().toLowerCase() !==
          second.entry.day.trim().toLowerCase() ||
        !overlaps(first.start, first.end, second.start, second.end)
      ) {
        continue;
      }

      const description = `${formatEntry(first.entry)} overlaps ${formatEntry(second.entry)}`;
      if (
        first.entry.teacherId &&
        first.entry.teacherId === second.entry.teacherId
      ) {
        teacherConflicts.push(description);
      }
      if (first.entry.sectionCode === second.entry.sectionCode) {
        sectionConflicts.push(description);
      }
      if (first.entry.roomId && first.entry.roomId === second.entry.roomId) {
        roomConflicts.push(description);
      }
    }
  }

  return {
    missingComponents,
    unassignedTeachers,
    invalidEntries,
    teacherConflicts,
    sectionConflicts,
    roomConflicts,
  };
}

export function formatGeneratedScheduleValidationError(
  validation: GeneratedScheduleValidation,
): string {
  const issueSummaries: string[] = [];
  const addSummary = (
    singularLabel: string,
    pluralLabel: string,
    issues: string[],
  ) => {
    if (issues.length === 0) return;
    const examples = issues.slice(0, 2).join("; ");
    issueSummaries.push(
      `${issues.length} ${issues.length === 1 ? singularLabel : pluralLabel}${examples ? ` (e.g. ${examples})` : ""}`,
    );
  };

  addSummary(
    "required class component is missing",
    "required class components are missing",
    validation.missingComponents,
  );
  addSummary(
    "class has no assigned teacher",
    "classes have no assigned teacher",
    validation.unassignedTeachers,
  );
  addSummary(
    "class has an invalid time",
    "classes have invalid times",
    validation.invalidEntries,
  );
  addSummary(
    "teacher time conflict",
    "teacher time conflicts",
    validation.teacherConflicts,
  );
  addSummary(
    "section time conflict",
    "section time conflicts",
    validation.sectionConflicts,
  );
  addSummary(
    "room time conflict",
    "room time conflicts",
    validation.roomConflicts,
  );

  return `Schedule validation failed: ${issueSummaries.join("; ")}.`;
}
