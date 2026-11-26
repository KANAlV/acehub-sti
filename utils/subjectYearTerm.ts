export interface ParsedSubjectYearTerm {
  yearLevel: string;
  term: string | null;
  isShs: boolean;
}

export function parseSubjectYearTerm(
  value: string | null | undefined,
): ParsedSubjectYearTerm | null {
  if (!value?.trim()) return null;

  const normalized = value.trim().toLowerCase();
  const [yearPart, termPart] = normalized.split(/\s*-\s*/, 2);
  const yearMatch = yearPart.match(/\b(11|12|[1-4])(?:st|nd|rd|th)?\b/);
  const hasYearMarker =
    /\b(?:shs|grade|year)\b/.test(yearPart) ||
    /^\s*(?:11|12|[1-4])\s*$/.test(yearPart);
  if (!yearMatch || !hasYearMarker) return null;

  const yearLevel = yearMatch[1];
  const termMatch = (termPart || normalized).match(
    /\b(?:term|semester)\s*(\d+)\b/,
  );
  const numericTermMatch = termPart?.match(/^\s*(\d+)\s*$/);
  const term = termMatch?.[1] || numericTermMatch?.[1] || null;

  return {
    yearLevel,
    term,
    isShs: yearLevel === "11" || yearLevel === "12",
  };
}