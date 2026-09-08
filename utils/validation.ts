// --- GENERAL FORMAT VALIDATORS ---

export function filterEmail(value: string): string {
  return value
    // 1. Remove all spaces instantly
    .replace(/\s+/g, "")
    // 2. Collapse any consecutive mix of hyphens, underscores, or dots (e.g., "--__--" -> "-")
    .replace(/[-_.]{2,}/g, (match) => match[0])
    // 3. Remove any disallowed characters for email fields
    .replace(/[^a-zA-Z0-9@._+-]/g, "");
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
    .replace(/[_-]{2,}/g, (match) => match[0])
    .replace(/\s+/g, " ");

/**
 * Allows alphanumeric characters, spaces, hyphens, commas, and underscores.
 * Collapses consecutive or mixed special characters (e.g., "--", "__", "-_") into a single character.
 */
export const filterAlphanumericDashUnderscoreComma = (str: string): string =>
  str
    .replace(/[^a-zA-Z0-9_,\- ]/g, "")
    .replace(/[,_-]{2,}/g, (match) => match[0])
    .replace(/\s+/g, " ");

/**
 * Strips all non-digit characters (0-9).
 * Useful for numeric inputs, system codes, or integer-only fields.
 */
export const filterNumeric = (str: string): string =>
  str.replace(/[^0-9]/g, "");

/**
 * Strips characters except digits, plus signs, hyphens, and spaces.
 * Collapses consecutive hyphens into one.
 */
export const filterPhone = (str: string): string =>
  str
    .replace(/[^0-9+\- ]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/\s+/g, " ");

/**
 * Strips characters except digits and a single decimal point.
 * Useful for unit loads, GPA, or cost entries.
 */
export const filterDecimal = (str: string): string => {
  const sanitized = str.replace(/[^0-9.]/g, "");
  const parts = sanitized.split(".");
  return parts.length > 2
    ? `${parts[0]}.${parts.slice(1).join("")}`
    : sanitized;
};

/**
 * Trims leading spaces while preserving trailing/middle spaces during typing,
 * and collapses multiple consecutive interior spaces into one.
 */
export const cleanSpaces = (str: string): string =>
  str.replace(/^\s+/, "").replace(/\s+/g, " ");