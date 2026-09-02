// --- GENERAL FORMAT VALIDATORS ---

export const filterEmail = (str: string): string =>
  str.replace(/[^a-zA-Z0-9._%+-@]/g, "");

/**
 * Strips all non-alphabetic characters (a-zA-Z) and collapse consecutive spaces into one.
 */
export const filterAlpha = (str: string): string =>
  str.replace(/[^a-zA-Z ]/g, "").replace(/\s+/g, " ");

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