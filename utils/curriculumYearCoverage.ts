export type CurriculumYearCoverageStatus =
  | "missing"
  | "duplicate"
  | "incomplete"
  | "complete";

export function getCurriculumYearCoverageStatus(
  expectedYearLevels: string[],
  selectedYearLevelsByCurriculum: string[][],
): CurriculumYearCoverageStatus {
  if (selectedYearLevelsByCurriculum.length === 0) return "missing";

  const yearLevelCounts = new Map(
    expectedYearLevels.map((yearLevel) => [yearLevel, 0]),
  );
  for (const selectedYearLevels of selectedYearLevelsByCurriculum) {
    for (const yearLevel of selectedYearLevels) {
      if (yearLevelCounts.has(yearLevel)) {
        yearLevelCounts.set(yearLevel, yearLevelCounts.get(yearLevel)! + 1);
      }
    }
  }

  const counts = Array.from(yearLevelCounts.values());
  if (counts.some((count) => count > 1)) return "duplicate";
  if (counts.some((count) => count === 0)) return "incomplete";
  return "complete";
}