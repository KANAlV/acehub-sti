// --- GENERAL FORMAT VALIDATORS ---

export function filterEmail(value: string): string {
  return value
      // Remove all spaces instantly
      .replace(/\s+/g, "")
      // Collapse any consecutive mix of hyphens, underscores, or dots (e.g., "--__--" -> "-")
      .replace(/[-_.]{2,}/g, (match: string): string => match[0])
      // Remove any disallowed characters for email fields
      .replace(/[^a-zA-Z0-9@._+-]/g, "")
      // Remove consecutive spaces into one
      .replace(/\s+/g, " ");
}

/**
 * Strips all non-alphabetic characters (a-zA-Z) and collapse consecutive spaces into one.
 */
export const filterAlpha = (str: string): string =>
    str.replace(/[^a-zA-Z ]/g, "").replace(/\s+/g, " ");

/**
 * Strips all non-alphabetic characters (a-zA-Z) and no spaces.
 */
export const filterAlphaNoSpace = (str: string): string =>
    str.replace(/[^a-zA-Z]/g, "");

/**
 * Strips all non-alphanumeric characters (a-zA-Z0-9).
 */
export const filterAlphanumericNoSpace = (str: string): string =>
    str.replace(/[^a-zA-Z0-9]/g, "").replace(/\s+/g, "");

/**
 * Strips all non-alphanumeric characters (a-zA-Z0-9) and collapse consecutive spaces into one.
 */
export const filterAlphanumeric = (str: string): string =>
    str.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ");

/**
 * Strips all characters except letters and underscores (a-zA-Z_) and collapse consecutive spaces into one.
 */
export const filterAlphaUnderscore = (str: string): string =>
    str.replace(/[^a-zA-Z_ ]/g, "").replace(/\s+/g, " ");

/**
 * Strips all non-alphanumeric characters (a-zA-Z0-9) and underscore, and collapse consecutive spaces into one.
 */
export const filterAlphanumericUnderscore = (str: string): string =>
    str.replace(/[^a-zA-Z0-9_ ]/g, "").replace(/\s+/g, " ");

/**
 * Strips characters except letters, hyphens, and spaces, collapses consecutive hyphens into one,
 * and collapses consecutive spaces into one.
 * Ideal for hyphenated names (e.g., "Dela-Cruz").
 */
export const filterAlphaDashSpace = (str: string): string =>
    str
        .replace(/[^a-zA-Z\- ]/g, "")
        .replace(/-{2,}/g, "-")
        .replace(/\s+/g, " ");

/**
 * Allows alphanumeric characters, spaces, hyphens, and underscores.
 * Collapses consecutive or mixed special characters (e.g., "--", "__", "-_") into a single character.
 */
export const filterAlphanumericDashUnderscore = (str: string): string =>
    str
        .replace(/[^a-zA-Z0-9_\- ]/g, "")
        .replace(/[_-]{2,}/g, (match: string): string => match[0])
        .replace(/\s+/g, " ");

/**
 * Allows alphanumeric characters, spaces, hyphens, commas, and underscores.
 * Collapses consecutive or mixed special characters (e.g., "--", "__", "-_") into a single character.
 */
export const filterAlphanumericDashUnderscoreComma = (str: string): string =>
    str
        .replace(/[^a-zA-Z0-9_,\- ]/g, "")
        .replace(/[,_-]{2,}/g, (match: string): string => match[0])
        .replace(/\s+/g, " ");

/**
 * Allows alphanumeric characters, spaces, hyphens, commas, and underscores.
 * Collapses consecutive or mixed special characters (e.g., "--", "__", "-_") into a single character.
 */
export const filterMAQCluster = (str: string): string =>
    str
        .replace(/[^a-zA-Z0-9_,\-()\[\]# ]/g, "")
        .replace(/[()\[\],#_-]{2,}/g, (match: string): string => match[0])
        .replace(/\s+/g, " ");

/**
 * Allows alphanumeric characters, and hyphens.
 * Collapses consecutive hyphens (e.g., "--") into a single character.
 */
export const filterCurricula = (str: string): string =>
    str
        .replace(/[^a-zA-Z0-9\- ]/g, "")
        .replace(/[-]{2,}/g, (match: string): string => match[0])
        .replace(/\s+/g, "");

/**
 * Strips all non-digit characters (0-9).
 * Useful for numeric inputs, system codes, or integer-only fields.
 */
export const filterNumeric = (str: string): string =>
    str.replace(/[^0-9]/g, "");

/**
 * Strips all characters except letters and digits (a-zA-Z0-9), no spaces allowed.
 * Ideal for course codes (e.g. "CS101", "MATH201").
 */
export const filterCourseCode = (str: string): string =>
    str.replace(/[^a-zA-Z0-9]/g, "");

/**
 * Strips all characters except letters, digits, and spaces (a-zA-Z0-9 ), no symbols.
 * Collapses consecutive spaces into one and trims leading/trailing spaces.
 * Ideal for course names (e.g. "Introduction to Computing").
 */
export const filterCourseName = (str: string): string =>
    str.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();

/**
 * Validates a Year/Semester short code format (e.g. "11-1", "1-2", "12-3", "4-2").
 * SHS: year must be 11 or 12, term must be 1, 2, or 3.
 * Tertiary: year must be 1, 2, 3, or 4, term must be 1 or 2.
 * Returns an object with isValid flag and optional error message.
 */
export const validateYearSemester = (value: string): { isValid: boolean; error?: string } => {
    if (!value || !value.trim()) {
        return { isValid: false, error: "Year/Semester is required." };
    }

    // Normalize: remove spaces around the hyphen to handle both "11-1" and "11 - 1" formats
    const normalized = value.trim().replace(/\s*-\s*/g, "-");
    const parts = normalized.split("-");
    if (parts.length !== 2) {
        return { isValid: false, error: `Year/Semester must be in format "year - term" (e.g. 11 - 1, 1 - 2). Got "${value}".` };
    }

    const [yearPart, termPart] = parts;
    const isSHS = ["11", "12"].includes(yearPart);

    // Validate year part
    const validYears = isSHS ? ["11", "12"] : ["1", "2", "3", "4"];
    if (!validYears.includes(yearPart)) {
        return { isValid: false, error: `Invalid year part "${yearPart}". SHS: 11, 12. Tertiary: 1-4.` };
    }

    // Validate term/semester part
    if (isSHS) {
        if (!["1", "2", "3"].includes(termPart)) {
            return { isValid: false, error: `SHS year level requires Term 1-3, but got "${value}".` };
        }
    } else {
        if (!["1", "2"].includes(termPart)) {
            return { isValid: false, error: `Tertiary year level requires Semester 1-2, but got "${value}".` };
        }
    }

    return { isValid: true };
};

/**
 * Converts a Year/Semester short code (e.g. "11-1", "1-2") to a full display string (e.g. "SHS 11 - Term 1", "1st Year - Semester 2").
 */
export const formatYearSemester = (value: string): string => {
    if (!value) return "";
    // Normalize: remove spaces around the hyphen for parsing
    const normalized = value.trim().replace(/\s*-\s*/g, "-");
    const parts = normalized.split("-");
    if (parts.length !== 2) return value;

    const [yearPart, termPart] = parts;
    const isSHS = ["11", "12"].includes(yearPart);
    const yearLabel = isSHS ? `SHS ${yearPart}` : `${yearPart === "1" ? "1st" : yearPart === "2" ? "2nd" : yearPart === "3" ? "3rd" : "4th"} Year`;
    const termLabel = isSHS ? `Term ${termPart}` : `Semester ${termPart}`;
    return `${yearLabel} - ${termLabel}`;
};

/**
 * Parses a full Year/Term string (e.g. "SHS 11 - Term 1", "1st Year - Semester 2") back to a short code (e.g. "11-1", "1-2").
 */
export const parseYearSemester = (value: string): string => {
    if (!value) return "";
    // If already in short code format (e.g. "11 - 1" or "11-1"), normalize and return with spaces
    const shortTest = value.trim().replace(/\s*-\s*/g, "-");
    const shortParts = shortTest.split("-");
    if (shortParts.length === 2 && /^\d+$/.test(shortParts[0]) && /^\d+$/.test(shortParts[1])) {
        return `${shortParts[0]} - ${shortParts[1]}`;
    }
    // Full format: "SHS 11 - Term 1", "1st Year - Semester 2", etc.
    const [rawYearPart, rawTermPart] = value.split(" - ");
    let yearNum = (rawYearPart || "").startsWith("SHS ")
        ? (rawYearPart || "").replace("SHS ", "")
        : rawYearPart || "";
    if (yearNum === "Grade 11") yearNum = "11";
    if (yearNum === "Grade 12") yearNum = "12";
    if (yearNum === "1st Year") yearNum = "1";
    if (yearNum === "2nd Year") yearNum = "2";
    if (yearNum === "3rd Year") yearNum = "3";
    if (yearNum === "4th Year") yearNum = "4";
    const termNum = rawTermPart?.startsWith("Term ") ? rawTermPart.replace("Term ", "") : rawTermPart?.startsWith("Semester ") ? rawTermPart.replace("Semester ", "") : rawTermPart || "";
    return `${yearNum} - ${termNum}`;
};