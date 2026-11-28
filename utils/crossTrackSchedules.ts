export interface CrossTrackSubject {
  subject_id: string;
  course_code: string;
}

export interface CrossTrackAssignment<TSubject extends CrossTrackSubject> {
  sectionCode: string;
  subjects: TSubject[];
}

export function getParentSectionCode(sectionCode: string): string | null {
  const match = sectionCode.trim().match(/^(.+)-CT(\d{3,})$/i);
  return match ? `${match[1]}${match[2]}` : null;
}

export function isCrossTrackSectionCode(sectionCode: string): boolean {
  return getParentSectionCode(sectionCode) !== null;
}

export function getPrimarySectionAssignments<T extends CrossTrackAssignment<CrossTrackSubject>>(
  assignments: T[],
): T[] {
  return assignments.filter(
    (assignment) => !isCrossTrackSectionCode(assignment.sectionCode),
  );
}

export function getAssignmentsWithSharedCrossTrackSubjects<
  T extends CrossTrackAssignment<CrossTrackSubject>,
>(assignments: T[]): T[] {
  const primaryAssignments = getPrimarySectionAssignments(assignments);
  const primaryAssignmentsBySection = new Map(
    primaryAssignments.map((assignment) => [assignment.sectionCode, assignment]),
  );
  const crossTrackAssignments = assignments
    .filter((assignment) => isCrossTrackSectionCode(assignment.sectionCode))
    .map((assignment) => {
      const parentSectionCode = getParentSectionCode(assignment.sectionCode);
      const parentAssignment = parentSectionCode
        ? primaryAssignmentsBySection.get(parentSectionCode)
        : undefined;
      const parentCourseCodes = new Set(
        (parentAssignment?.subjects ?? []).map((subject) =>
          subject.course_code.trim().toUpperCase(),
        ),
      );

      return {
        ...assignment,
        subjects: assignment.subjects.filter((subject) =>
          parentCourseCodes.has(subject.course_code.trim().toUpperCase()),
        ),
      };
    });

  return [...primaryAssignments, ...crossTrackAssignments];
}

export function inheritCrossTrackScheduleEntries<
  TEntry extends {
    sectionCode: string;
    subjectId: string;
    courseCode: string;
    componentType: string;
  },
  TSubject extends CrossTrackSubject,
>(
  entries: TEntry[],
  assignments: CrossTrackAssignment<TSubject>[],
): TEntry[] {
  const entriesBySection = new Map<string, TEntry[]>();
  for (const entry of entries) {
    const sectionEntries = entriesBySection.get(entry.sectionCode) ?? [];
    sectionEntries.push(entry);
    entriesBySection.set(entry.sectionCode, sectionEntries);
  }

  const inheritedEntries: TEntry[] = [];
  for (const assignment of assignments) {
    const parentSectionCode = getParentSectionCode(assignment.sectionCode);
    if (!parentSectionCode) continue;

    const crossTrackSubjectsByCourseCode = new Map(
      assignment.subjects.map((subject) => [
        subject.course_code.trim().toUpperCase(),
        subject,
      ]),
    );
    for (const entry of entriesBySection.get(parentSectionCode) ?? []) {
      const crossTrackSubject = crossTrackSubjectsByCourseCode.get(
        entry.courseCode.trim().toUpperCase(),
      );
      if (!crossTrackSubject) continue;

      inheritedEntries.push({
        ...entry,
        sectionCode: assignment.sectionCode,
        subjectId: crossTrackSubject.subject_id,
      });
    }
  }

  return inheritedEntries;
}