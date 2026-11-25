export interface AutoScheduleTeacherPreferences {
  preferred_rooms?: string[];
  preferred_year?: string[];
  preferred_subjects?: string[];
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeTeachingYear(value: string): string {
  const normalized = normalizeText(value);
  const gradeMatch =
    normalized.match(/\b(?:grade|gr)\s*(\d{1,2})\b/) ||
    normalized.match(/\b(1[12])(?:st|nd|rd|th)?\s*(?:grade)?\b/);
  if (gradeMatch) return `grade:${gradeMatch[1]}`;

  const yearMatch =
    normalized.match(/\b(\d+)(?:st|nd|rd|th)?\s*(?:year|yr)\b/) ||
    normalized.match(/\byear\s*(\d+)\b/) ||
    normalized.match(/\b(\d+)(?:st|nd|rd|th)\b/);
  if (yearMatch) return `year:${yearMatch[1]}`;

  if (/^\d+$/.test(normalized)) {
    const number = Number(normalized);
    return number >= 11 ? `grade:${number}` : `year:${number}`;
  }

  return normalized;
}

export function getTeacherPreferenceMatchScore(
  preferences: AutoScheduleTeacherPreferences | undefined,
  courseName: string,
  courseCode: string,
  yearTerm: string | null | undefined,
): number {
  const subjectPreferences = preferences?.preferred_subjects ?? [];
  const yearPreferences = preferences?.preferred_year ?? [];
  const normalizedCourseName = normalizeText(courseName);
  const normalizedCourseCode = normalizeText(courseCode);
  let score = 0;

  if (subjectPreferences.length > 0) {
    const matchesSubject = subjectPreferences.some((preference) => {
      const normalizedPreference = normalizeText(preference);
      return (
        normalizedPreference === normalizedCourseName ||
        normalizedPreference === normalizedCourseCode
      );
    });
    score += matchesSubject ? 1 : -1;
  }

  if (yearTerm && yearPreferences.length > 0) {
    const matchesYear = yearPreferences.some(
      (preference) =>
        normalizeTeachingYear(preference) === normalizeTeachingYear(yearTerm),
    );
    score += matchesYear ? 1 : -1;
  }

  return score;
}

export function findPreferredRoom<
  Room extends { room_id: string; room_name: string | null },
>(rooms: Room[], preferredRooms: string[] | undefined): Room | undefined {
  for (const preferredRoom of preferredRooms ?? []) {
    const normalizedPreference = normalizeText(preferredRoom);
    const room = rooms.find(
      (candidate) =>
        normalizeText(candidate.room_id) === normalizedPreference ||
        (candidate.room_name !== null &&
          normalizeText(candidate.room_name) === normalizedPreference),
    );
    if (room) return room;
  }

  return undefined;
}
