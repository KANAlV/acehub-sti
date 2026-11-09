"use client";

import ExcelJS from "exceljs";
import { LocalTimetableEntry } from "@/components/schedules/ScheduleTimetable";
import { RoomForGeneration } from "@/app/actions/system";
import {generateSubjectAbv} from "@/utils/NameAbbreviator";

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

export interface FloorExportOptions {
  selectedFloors: number[];
}

export interface ProgramExportOptions {
  selectedPrograms: string[];
}

export interface YearExportOptions {
  selectedYears: string[];
}

export interface SectionExportOptions {
  selectedSections: string[];
}

// ---------------------------------------------------------------------------
// Day / time helpers
// ---------------------------------------------------------------------------

const DAYS_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface TimeSlot {
  startMins: number;
  endMins: number;
  label: string;
}

const TIME_SLOTS: TimeSlot[] = [];
for (let h = 7; h <= 20.5; h++) {
  for (let m = 0; m < 60; m += 30) {
    const startMins = h * 60 + m;
    const endMins = startMins + 30;
    const endH = Math.floor(endMins / 60);
    const endM = endMins % 60;
    const startLabel = formatTimeSimple(h, m);
    const endLabel = formatTimeSimple(endH, endM);
    TIME_SLOTS.push({
      startMins,
      endMins,
      label: `${startLabel}-${endLabel}`,
    });
  }
}

function formatTimeSimple(hours: number, mins: number): string {
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${String(mins).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Section → year / program helpers
// ---------------------------------------------------------------------------

/**
 * Try to infer a year label from a section name.
 * Examples:
 *   "SHS111" → "Grade 11"
 *   "SHS121" → "Grade 12"
 *   "BSIT111" → "1st Year"
 *   "BSIT211" → "2nd Year"
 *   "BSIT311" → "3rd Year"
 *   "BSIT411" → "4th Year"
 *   "BSBA511" → "5th Year"
 */
function inferYearFromSection(section: string): string | null {
  const s = section.toUpperCase();

  // SHS
  if (s.startsWith("SHS11")) return "Grade 11";
  if (s.startsWith("SHS12")) return "Grade 12";

  // Tertiary – look for pattern like BSIT1xx, BSBA2xx etc.
  const match = s.match(/(\d)(\d{2})$/);
  if (match) {
    const yearNum = parseInt(match[1], 10);
    if (yearNum >= 1 && yearNum <= 5) {
      const ordinals = [
        "",
        "1st Year",
        "2nd Year",
        "3rd Year",
        "4th Year",
        "5th Year",
      ];
      return ordinals[yearNum] || `${yearNum}th Year`;
    }
  }
  return null;
}

/**
 * Try to infer a program/strand from a section name.
 * Examples:
 *   "SHS111" → "SHS"
 *   "ABM111" → "ABM"
 *   "BSIT111" → "BSIT"
 *   "HUMSS121" → "HUMSS"
 */
function inferProgramFromSection(section: string): string {
  const s = section.toUpperCase();

  // SHS strands first
  const strandMatch = s.match(/^(ABM|HUMSS|STEM|TVL|GAS)(\d)/);
  if (strandMatch) return strandMatch[1];

  // Tertiary programs
  const progMatch = s.match(
    /^(BSIT|BSBA|BSCS|BSCpE|BSA|BSN|BSNM|BSHM|BSTM|BSA|BSMA|BSAIS|BSMAE)(\d)/,
  );
  if (progMatch) return progMatch[1];

  // Fallback: take leading letters
  const fallback = s.match(/^([A-Z]+)/);
  return fallback ? fallback[1] : section;
}

// ---------------------------------------------------------------------------
// Build a single timetable grid sheet (matching the Excel reference format)
// ---------------------------------------------------------------------------

interface GridSheetConfig {
  title: string; // e.g. "TERTIARY" or "SENIOR HIGH SCHOOL"
  sy: string; // e.g. "2025-2026"
  program: string;
  section: string;
  room?: string;
  adviser?: string;
  track?: string;
  entries: LocalTimetableEntry[];
}

/**
 * Build one worksheet that looks like the reference Excel timetable grid.
 * Returns an object with rows used and columns used.
 * Each day uses exactly 1 column.
 * @param startRow - The starting row for this table
 * @param startCol - The starting column for this table (default 1)
 */
function buildTimetableGridSheet(
  worksheet: ExcelJS.Worksheet,
  config: GridSheetConfig,
  startRow: number = 1,
  startCol: number = 1,
): { rowsUsed: number; colsUsed: number } {
  const { title, sy, program, section, room, adviser, track, entries } = config;

  // Layout: 1 time column + 6 days with 19px gap columns between each day
  // Total: 1 time + 6 day cols + 5 gap cols between days = 12 columns
  const gapColsBetweenDays = DAYS_ORDER.length - 1;
  const totalCols = 1 + DAYS_ORDER.length + gapColsBetweenDays;
  // Column offset for each day: time col, then day, gap, day, gap, ...
  // Monday=startCol+1, gap=startCol+2, Tuesday=startCol+3, gap=startCol+4, etc.
  const dayColOffsets = DAYS_ORDER.map((_, idx) => startCol + idx * 2 + 1);

  let row = startRow;

  // Row 1: CLASS SCHEDULE
  for (let c = startCol; c < startCol + totalCols; c++) {
    worksheet.getCell(row, c).value = null;
  }
  worksheet.getCell(row, startCol).value = "CLASS SCHEDULE";
  worksheet.getRow(row).font = { bold: true, size: 14 };
  worksheet.mergeCells(row, startCol, row, startCol + totalCols - 1);
  row++;

  // Row 2: title (TERTIARY / SENIOR HIGH SCHOOL)
  for (let c = startCol; c < startCol + totalCols; c++) {
    worksheet.getCell(row, c).value = null;
  }
  worksheet.getCell(row, startCol).value = title;
  worksheet.getRow(row).font = { bold: true, size: 12 };
  worksheet.mergeCells(row, startCol, row, startCol + totalCols - 1);
  row++;

  // Row 3: SY | value   ROOM | value
  for (let c = startCol; c < startCol + totalCols; c++) {
    worksheet.getCell(row, c).value = null;
  }
  worksheet.getCell(row, startCol).value = "SY";
  worksheet.getCell(row, startCol + 1).value = sy;
  worksheet.getCell(row, startCol + 3).value = "ROOM";
  worksheet.getCell(row, startCol + 4).value = room || "";
  worksheet.mergeCells(row, startCol, row, startCol);
  worksheet.mergeCells(row, startCol + 1, row, startCol + totalCols - 1);
  row++;

  // Row 4: PROGRAM | value   ADVISER | value
  for (let c = startCol; c < startCol + totalCols; c++) {
    worksheet.getCell(row, c).value = null;
  }
  if (track) {
    worksheet.getCell(row, startCol).value = "TRACK";
    worksheet.getCell(row, startCol + 1).value = track;
    worksheet.getCell(row, startCol + 3).value = "ADVISER";
    worksheet.getCell(row, startCol + 4).value = adviser || "";
  } else {
    worksheet.getCell(row, startCol).value = "PROGRAM";
    worksheet.getCell(row, startCol + 1).value = program;
    worksheet.getCell(row, startCol + 3).value = "ADVISER";
    worksheet.getCell(row, startCol + 4).value = adviser || "";
  }
  worksheet.mergeCells(row, startCol, row, startCol);
  worksheet.mergeCells(row, startCol + 1, row, startCol + totalCols - 1);
  row++;

  // Row 5: SECTION | value
  for (let c = startCol; c < startCol + totalCols; c++) {
    worksheet.getCell(row, c).value = null;
  }
  worksheet.getCell(row, startCol).value = "SECTION";
  worksheet.getCell(row, startCol + 1).value = section;
  worksheet.mergeCells(row, startCol, row, startCol);
  worksheet.mergeCells(row, startCol + 1, row, startCol + totalCols - 1);
  row++;

  // Row 6: header – time column + day columns
  const headerRow = worksheet.getRow(row);
  headerRow.getCell(startCol).value = null;
  DAYS_ORDER.forEach((day, idx) => {
    const col = dayColOffsets[idx];
    headerRow.getCell(col).value = day;
  });
  headerRow.font = { bold: true };
  for (let c = startCol; c < startCol + totalCols; c++) {
    const cell = headerRow.getCell(c);
    cell.alignment = {
      horizontal: "center" as const,
      vertical: "middle" as const,
    };
  }
  row++;

  // Time slot rows
  for (const slot of TIME_SLOTS) {
    const r = worksheet.getRow(row);
    r.getCell(startCol).value = slot.label;
    r.getCell(startCol).font = { bold: true, size: 9 };
    r.getCell(startCol).alignment = { vertical: "middle" as const };

    DAYS_ORDER.forEach((day) => {
      const idx = DAYS_ORDER.indexOf(day);
      const col = dayColOffsets[idx];

      const cell = r.getCell(col);
      cell.alignment = {
        horizontal: "center" as const,
        vertical: "middle" as const,
      };

      // Find entries that cover this time slot for this day
      const matched: LocalTimetableEntry[] = [];
      entries.forEach((e) => {
        if (e.day !== day) return;
        if (!e.start_time || !e.end_time) return;
        if (e.start_time <= slot.startMins && e.end_time >= slot.endMins) {
          matched.push(e);
        }
      });

      if (matched.length > 0) {
        // Only fill on the first slot of the entry
        const isStartSlot = matched.some(
          (e) => e.start_time === slot.startMins,
        );

        if (isStartSlot) {
          // Fill each entry that starts at this slot
          const entriesStartingHere = matched.filter(
            (e) => e.start_time === slot.startMins,
          );

          // If multiple entries start at the same time, combine them into one cell
          entriesStartingHere.forEach((entry, entryIndex) => {
            // Calculate span rows
            const spanEntries = matched.filter(
              (e) =>
                e.start_time === entry.start_time &&
                e.course_code === entry.course_code,
            );
            const maxEnd = Math.max(...spanEntries.map((e) => e.end_time || 0));
            const spanSlots = TIME_SLOTS.filter(
              (s) => s.startMins >= entry.start_time && s.startMins < maxEnd,
            ).length;

            // Build cell content parts
            const subject = entry.course_name;
            const teacher = entry.teacher_code || '"TBD"';
            const line1 = `${generateSubjectAbv(subject)} / ${teacher}`;
            const line2 = entry.section || "";
            const line3 = entry.room_name || "";

            // Set cell value, border, and font before merging
            const cell = worksheet.getCell(row, col);

            // Use plain string with \n for newlines
            cell.value = `${line1}\n${line2}\n${line3}`;

            // Apply thick border (width 2)
            cell.border = {
              top: { style: "medium" },
              bottom: { style: "medium" },
              left: { style: "medium" },
              right: { style: "medium" },
            };

            // Apply font styling
            cell.font = {
              size: 9,
              bold: true,
              color: { argb: !entry.teacher_code ? "FFFF0000" : "FF000000" },
            };

            // Merge the cell if spanning multiple rows
            if (spanSlots > 1) {
              worksheet.mergeCells(row, col, row + spanSlots - 1, col);
            }

            // Apply wrapText after merging
            const mergedCell = worksheet.getCell(row, col);
            mergedCell.alignment = {
              horizontal: "center" as const,
              vertical: "top" as const,
              wrapText: true,
            };
          });
        }
      }
    });

    row++;
  }

  // Set column widths in character units (width of "0" in default font)
  worksheet.getColumn(startCol).width = 16;
  for (let idx = 0; idx < DAYS_ORDER.length; idx++) {
    const dayCol = dayColOffsets[idx];
    worksheet.getColumn(dayCol).width = 16;
    // Set gap column width (between days, except after the last day)
    if (idx < DAYS_ORDER.length - 1) {
      const gapCol = dayCol + 1;
      worksheet.getColumn(gapCol).width = 2;
    }
  }

  // Set row height to 15pt for all time slot rows and apply wrapText
  const firstTimeSlotRow = startRow + 6; // After header rows (1-5) + day header row (6)
  const rows = worksheet.getRows(firstTimeSlotRow, TIME_SLOTS.length);
  if (rows) {
    rows.forEach((rowObj) => {
      if (rowObj) {
        rowObj.height = 15;
        for (let c = startCol; c < startCol + totalCols; c++) {
          const cell = rowObj.getCell(c);
          cell.alignment = {
            horizontal: "center" as const,
            wrapText: true,
            vertical: "top" as const,
          };
        }
      }
    });
  }

  const rowsUsed = row - startRow;
  return { rowsUsed, colsUsed: totalCols };
}

// ---------------------------------------------------------------------------
// Download helper
// ---------------------------------------------------------------------------

export function downloadWorkbook(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Export: By Floor
// ---------------------------------------------------------------------------

export async function exportByFloor(
  entries: LocalTimetableEntry[],
  allRooms: RoomForGeneration[],
  selectedFloors: number[],
  scheduleName: string,
): Promise<void> {
  if (selectedFloors.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AceHub";
  workbook.created = new Date();

  // Build room name → floor map
  const roomFloorMap = new Map<string, number>();
  allRooms.forEach((r) => {
    if (r.room_name && r.floor_level) {
      roomFloorMap.set(r.room_name, r.floor_level);
    }
  });

  for (const floor of selectedFloors) {
    // Filter entries for rooms on this floor
    const floorEntries = entries.filter((e) => {
      if (!e.room_name) return false;
      return roomFloorMap.get(e.room_name) === floor;
    });

    if (floorEntries.length === 0) continue;

    const ws = workbook.addWorksheet(`Floor ${floor}`, {
      properties: { tabColor: { argb: "FF4CAF50" } },
    });

    // Group entries by section for this floor
    const sections = Array.from(
      new Set(floorEntries.map((e) => e.section).filter(Boolean)),
    );

    const currentRow = 1;
    let currentCol = 1;

    // For each section on this floor, write a mini timetable side by side
    for (const section of sections) {
      const sectionEntries = floorEntries.filter((e) => e.section === section);
      const program = inferProgramFromSection(section);

      const result = buildTimetableGridSheet(
        ws,
        {
          title: program.startsWith("BS") ? "TERTIARY" : "SENIOR HIGH SCHOOL",
          sy: "2025-2026",
          program,
          section,
          entries: sectionEntries,
        },
        currentRow,
        currentCol,
      );

      // Move to the right with 1 column gap
      currentCol = currentCol + result.colsUsed + 1;
    }

  }

  const buffer = await workbook.xlsx.writeBuffer();
  downloadWorkbook(
    buffer,
    `Timetable_ByFloor_${scheduleName}_${new Date().toISOString().split("T")[0]}.xlsx`,
  );
}

// ---------------------------------------------------------------------------
// Export: By Program / Strand
// ---------------------------------------------------------------------------

export async function exportByProgram(
  entries: LocalTimetableEntry[],
  selectedPrograms: string[],
  scheduleName: string,
): Promise<void> {
  if (selectedPrograms.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AceHub";
  workbook.created = new Date();

  // Group entries by program
  const programEntries = new Map<string, LocalTimetableEntry[]>();
  entries.forEach((e) => {
    if (!e.section) return;
    const prog = inferProgramFromSection(e.section);
    if (selectedPrograms.includes(prog)) {
      const arr = programEntries.get(prog) || [];
      arr.push(e);
      programEntries.set(prog, arr);
    }
  });

  for (const [program, progEntries] of programEntries) {
    if (progEntries.length === 0) continue;

    const ws = workbook.addWorksheet(program, {
      properties: { tabColor: { argb: "FF2196F3" } },
    });

    const sections = Array.from(
      new Set(progEntries.map((e) => e.section).filter(Boolean)),
    );

    const currentRow = 1;
    let currentCol = 1;

    for (const section of sections) {
      const sectionEntries = progEntries.filter((e) => e.section === section);
      const isShs = !program.startsWith("BS");

      const result = buildTimetableGridSheet(
        ws,
        {
          title: isShs ? "SENIOR HIGH SCHOOL" : "TERTIARY",
          sy: "2025-2026",
          program,
          section,
          entries: sectionEntries,
        },
        currentRow,
        currentCol,
      );

      // Move to the right with 1 column gap
      currentCol = currentCol + result.colsUsed + 1;
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  downloadWorkbook(
    buffer,
    `Timetable_ByProgram_${scheduleName}_${new Date().toISOString().split("T")[0]}.xlsx`,
  );
}

// ---------------------------------------------------------------------------
// Export: By Year
// ---------------------------------------------------------------------------

export async function exportByYear(
  entries: LocalTimetableEntry[],
  selectedYears: string[],
  scheduleName: string,
): Promise<void> {
  if (selectedYears.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AceHub";
  workbook.created = new Date();

  // Group entries by year
  const yearEntries = new Map<string, LocalTimetableEntry[]>();
  entries.forEach((e) => {
    if (!e.section) return;
    const year = inferYearFromSection(e.section);
    if (year && selectedYears.includes(year)) {
      const arr = yearEntries.get(year) || [];
      arr.push(e);
      yearEntries.set(year, arr);
    }
  });

  const yearOrder = [
    "Grade 11",
    "Grade 12",
    "1st Year",
    "2nd Year",
    "3rd Year",
    "4th Year",
    "5th Year",
  ];

  const sortedYears = Array.from(yearEntries.keys()).sort(
    (a, b) => yearOrder.indexOf(a) - yearOrder.indexOf(b),
  );

  for (const year of sortedYears) {
    const yearProgEntries = yearEntries.get(year) || [];
    if (yearProgEntries.length === 0) continue;

    const safeName = year.replace(/\s+/g, "_");
    const ws = workbook.addWorksheet(safeName, {
      properties: { tabColor: { argb: "FF9C27B0" } },
    });

    const sections = Array.from(
      new Set(yearProgEntries.map((e) => e.section).filter(Boolean)),
    );

    const currentRow = 1;
    let currentCol = 1;

    for (const section of sections) {
      const sectionEntries = yearProgEntries.filter(
        (e) => e.section === section,
      );
      const program = inferProgramFromSection(section);
      const isShs = year.startsWith("Grade");

      const result = buildTimetableGridSheet(
        ws,
        {
          title: isShs ? "SENIOR HIGH SCHOOL" : "TERTIARY",
          sy: "2025-2026",
          program,
          section,
          entries: sectionEntries,
        },
        currentRow,
        currentCol,
      );

      // Move to the right with 1 column gap
      currentCol = currentCol + result.colsUsed + 1;
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  downloadWorkbook(
    buffer,
    `Timetable_ByYear_${scheduleName}_${new Date().toISOString().split("T")[0]}.xlsx`,
  );
}

// ---------------------------------------------------------------------------
// Export: By Section
// ---------------------------------------------------------------------------

export async function exportBySection(
  entries: LocalTimetableEntry[],
  selectedSections: string[],
  scheduleName: string,
): Promise<void> {
  if (selectedSections.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AceHub";
  workbook.created = new Date();

  for (const section of selectedSections) {
    const sectionEntries = entries.filter((e) => e.section === section);
    if (sectionEntries.length === 0) continue;

    const program = inferProgramFromSection(section);
    const isShs = !program.startsWith("BS");

    const ws = workbook.addWorksheet(section, {
      properties: { tabColor: { argb: "FF00BCD4" } },
    });

    buildTimetableGridSheet(ws, {
      title: isShs ? "SENIOR HIGH SCHOOL" : "TERTIARY",
      sy: "2025-2026",
      program,
      section,
      entries: sectionEntries,
    }, 1, 1);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  downloadWorkbook(
    buffer,
    `Timetable_BySection_${scheduleName}_${new Date().toISOString().split("T")[0]}.xlsx`,
  );
}

// ---------------------------------------------------------------------------
// Collect unique values for filter options
// ---------------------------------------------------------------------------

export function getUniqueFloors(allRooms: RoomForGeneration[]): number[] {
  const floors = new Set<number>();
  allRooms.forEach((r) => {
    if (r.floor_level && r.floor_level > 0) floors.add(r.floor_level);
  });
  return Array.from(floors).sort((a, b) => a - b);
}

export function getUniquePrograms(entries: LocalTimetableEntry[]): string[] {
  const programs = new Set<string>();
  entries.forEach((e) => {
    if (e.section) programs.add(inferProgramFromSection(e.section));
  });
  return Array.from(programs).sort();
}

export function getUniqueYears(entries: LocalTimetableEntry[]): string[] {
  const years = new Set<string>();
  entries.forEach((e) => {
    if (e.section) {
      const year = inferYearFromSection(e.section);
      if (year) years.add(year);
    }
  });
  const yearOrder = [
    "Grade 11",
    "Grade 12",
    "1st Year",
    "2nd Year",
    "3rd Year",
    "4th Year",
    "5th Year",
  ];
  return Array.from(years).sort(
    (a, b) => yearOrder.indexOf(a) - yearOrder.indexOf(b),
  );
}

export function getUniqueSections(entries: LocalTimetableEntry[]): string[] {
  const sections = new Set<string>();
  entries.forEach((e) => {
    if (e.section) sections.add(e.section);
  });
  return Array.from(sections).sort((a, b) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    if (!isNaN(numA)) return -1;
    if (!isNaN(numB)) return 1;
    return a.localeCompare(b);
  });
}
