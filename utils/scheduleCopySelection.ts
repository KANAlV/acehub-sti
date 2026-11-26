export interface ScheduleCopyEntry {
  schedule_entry_id: string;
  section: string;
  subject_id: string;
  course_code: string;
  course_name: string;
}

export interface ScheduleCopyProgram {
  program_code: string;
  program_name: string;
  year_level: string;
}

export interface ScheduleCopySubject {
  key: string;
  subjectId: string;
  courseCode: string;
  courseName: string;
  entries: ScheduleCopyEntry[];
}

export interface ScheduleCopySection {
  sectionCode: string;
  subjects: ScheduleCopySubject[];
}

export interface ScheduleCopyProgramNode {
  programCode: string;
  programName: string;
  sections: ScheduleCopySection[];
}

export type ScheduleCopyTree = Record<"SHS" | "TERTIARY", ScheduleCopyProgramNode[]>;
export type CopySelectionState = "unchecked" | "partial" | "checked";

export function getScheduleCopySubjectKey(
  sectionCode: string,
  subjectId: string,
  courseCode: string,
): string {
  const identity = subjectId.trim() || courseCode.trim();
  return `${sectionCode.trim().toUpperCase()}::${identity.toUpperCase()}`;
}

export function buildScheduleCopyTree(
  entries: ScheduleCopyEntry[],
  programs: ScheduleCopyProgram[],
): ScheduleCopyTree {
  const tree: ScheduleCopyTree = { SHS: [], TERTIARY: [] };
  const sortedPrograms = [...programs].sort(
    (first, second) => second.program_code.length - first.program_code.length,
  );
  const programGroups = new Map<string, ScheduleCopyProgramNode & { kind: "SHS" | "TERTIARY" }>();

  for (const entry of entries) {
    const sectionCode = entry.section.trim();
    if (!sectionCode) continue;

    const normalizedSection = sectionCode.toUpperCase();
    const matchedProgram = sortedPrograms.find((program) =>
      normalizedSection.startsWith(program.program_code.trim().toUpperCase()),
    );
    const inferredProgramCode = matchedProgram?.program_code.trim() ||
      normalizedSection.match(/^[A-Z]+/)?.[0] || "UNKNOWN";
    const kind = matchedProgram
      ? matchedProgram.year_level.toLowerCase() !== "tertiary"
        ? "SHS"
        : "TERTIARY"
      : /^([A-Z]+)([12])(\d{2})$/.test(normalizedSection)
        ? "SHS"
        : "TERTIARY";
    const groupKey = `${kind}:${inferredProgramCode.toUpperCase()}`;

    let programGroup = programGroups.get(groupKey);
    if (!programGroup) {
      programGroup = {
        programCode: inferredProgramCode,
        programName:
          matchedProgram?.program_name || inferredProgramCode,
        sections: [],
        kind,
      };
      programGroups.set(groupKey, programGroup);
      tree[kind].push(programGroup);
    }

    let sectionGroup = programGroup.sections.find(
      (section) => section.sectionCode.toUpperCase() === normalizedSection,
    );
    if (!sectionGroup) {
      sectionGroup = { sectionCode, subjects: [] };
      programGroup.sections.push(sectionGroup);
    }

    const subjectKey = getScheduleCopySubjectKey(
      sectionCode,
      entry.subject_id,
      entry.course_code,
    );
    let subjectGroup = sectionGroup.subjects.find(
      (subject) => subject.key === subjectKey,
    );
    if (!subjectGroup) {
      subjectGroup = {
        key: subjectKey,
        subjectId: entry.subject_id,
        courseCode: entry.course_code,
        courseName: entry.course_name,
        entries: [],
      };
      sectionGroup.subjects.push(subjectGroup);
    }
    subjectGroup.entries.push(entry);
  }

  for (const kind of ["SHS", "TERTIARY"] as const) {
    tree[kind].sort((first, second) =>
      first.programCode.localeCompare(second.programCode),
    );
    for (const program of tree[kind]) {
      program.sections.sort((first, second) =>
        first.sectionCode.localeCompare(second.sectionCode),
      );
      for (const section of program.sections) {
        section.subjects.sort((first, second) =>
          first.courseCode.localeCompare(second.courseCode),
        );
      }
    }
  }

  return tree;
}

export function getCopySelectionState(
  descendantKeys: string[],
  selectedKeys: Set<string>,
): CopySelectionState {
  if (descendantKeys.length === 0) return "unchecked";
  const selectedCount = descendantKeys.filter((key) =>
    selectedKeys.has(key),
  ).length;
  if (selectedCount === 0) return "unchecked";
  return selectedCount === descendantKeys.length ? "checked" : "partial";
}

export function toggleScheduleCopySelection(
  descendantKeys: string[],
  selectedKeys: Set<string>,
): Set<string> {
  const nextSelection = new Set(selectedKeys);
  const allSelected = descendantKeys.every((key) => nextSelection.has(key));

  for (const key of descendantKeys) {
    if (allSelected) nextSelection.delete(key);
    else nextSelection.add(key);
  }

  return nextSelection;
}