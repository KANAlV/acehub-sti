// --- GENERAL FORMAT VALIDATORS ---

export const filterEmail = (str: string): string =>
  str.replace(/[^a-zA-Z0-9._%+-@]/g, "");

/**
 * Strips all non-alphabetic characters (a-zA-Z).
 */
export const filterAlpha = (str: string): string =>
  str.replace(/[^a-zA-Z ]/g, "");

/**
 * Strips all non-alphanumeric characters (a-zA-Z0-9).
 */
export const filterAlphanumeric = (str: string): string =>
  str.replace(/[^a-zA-Z0-9 ]/g, "");

/**
 * Strips all characters except letters and underscores (a-zA-Z_).
 */
export const filterAlphaUnderscore = (str: string): string =>
  str.replace(/[^a-zA-Z_ ]/g, "");

/**
 * Strips all non-alphanumeric characters (a-zA-Z0-9) and underscore.
 */
export const filterAlphanumericUnderscore = (str: string): string =>
  str.replace(/[^a-zA-Z0-9_ ]/g, "");