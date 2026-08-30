"use server";
import sql from "@/lib/database";

/** --- Break Period --- **/
interface BreakPeriod {
  break_id: string;
  break_description: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export async function fetchBreakPeriodsCount(search?: string | null) {
  try {
    const pSearch = search ?? null;

    const [result] = await sql<{ count: number }[]>`
      SELECT break_periods_count(${pSearch}) AS count;
    `;

    return {
      success: true,
      count: Number(result?.count ?? 0)
    };
  } catch (error) {
    console.error("Database fetch error:", error);
    return {
      success: false,
      error: (error as Error).message,
      count: 0
    };
  }
}

export async function createBreakPeriod(
  description: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
) {
  try {
    const [result] = await sql<{ break_id: string }[]>`
      SELECT break_periods_create(
        ${description},
        ${dayOfWeek},
        ${startTime}::TIME,
        ${endTime}::TIME
      ) AS break_id;
    `;

    return { success: true, data: result };
  } catch (error) {
    console.error("Failed to insert break period:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function fetchBreakPeriods(
  search?: string | null,
  sortby?: string,
  sortdir?: string,
  limit?: number,
  page?: number,
) {
  try {
    const pSearch = search ?? null;
    const pSortBy = sortby ?? "break_description";
    const pSortDir = sortdir ?? "ASC";
    const pLimit = limit ?? 10;
    const pPage = page ?? 1;

    const offset = Math.max(0, (pPage - 1) * pLimit);

    // Pass { prepare: false } to bypass the cached query plan error
    const breakPeriods = await sql<BreakPeriod[]>`
      SELECT * FROM break_periods_read(
        ${pSearch}, 
        ${pSortBy}, 
        ${pSortDir}, 
        ${pLimit}, 
        ${offset}
      );
    `;// or pass { prepare: false } depending on your client syntax

    return { success: true, data: breakPeriods };
  } catch (error) {
    console.error("Database sync error:", error);
    return { success: false, error: (error as Error).message };
  }
}