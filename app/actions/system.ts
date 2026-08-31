"use server";
import sql from "@/lib/database";
import { AccountInfo } from "@azure/msal-common";

/** --- Break Period --- **/
interface BreakPeriod {
  break_id: string;
  break_description: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

// Count
export async function fetchBreakPeriodsCount(search?: string | null) {
  try {
    const pSearch = search ?? null;

    const [result] = await sql<{ count: number }[]>`
      SELECT break_periods_count(${pSearch}) AS count;
    `;

    return {
      success: true,
      count: Number(result?.count ?? 0),
    };
  } catch (error) {
    console.error("Database fetch error:", error);
    return {
      success: false,
      error: (error as Error).message,
      count: 0,
    };
  }
}

// Create
export async function createBreakPeriod(
  user: string,
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

    createLog(
      user,
      "create_break_period",
      `description: '${description}' | day: '${dayOfWeek}' | start: '${startTime}' | end: '${endTime}'`
    );
    return { success: true, data: result };
  } catch (error) {
    console.error("Failed to insert break period:", error);
    return { success: false, error: (error as Error).message };
  }
}

// Read
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
    `; // or pass { prepare: false } depending on your client syntax

    return { success: true, data: breakPeriods };
  } catch (error) {
    console.error("Database sync error:", error);
    return { success: false, error: (error as Error).message };
  }
}

// Update
export async function updateBreakPeriod(
  user: string,
  breakId: string,
  description: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
) {
  try {
    const [result] = await sql<{ break_periods_update: boolean }[]>`
      SELECT break_periods_update(
        ${breakId}::UUID,
        ${description},
        ${dayOfWeek},
        ${startTime}::TIME,
        ${endTime}::TIME
      );
    `;

    createLog(
      user,
      "update_break_period",
      `break_period_id: '${breakId}' | description: '${description}' | day: '${dayOfWeek}' | start: '${startTime}' | end: '${endTime}'`,
    );
    return {
      success: result?.break_periods_update ?? false,
    };
  } catch (error) {
    console.error("Failed to update break period:", error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

// Delete
export async function deleteBreakPeriod(user: string, breakId: string) {
  try {
    const [result] = await sql<{ break_periods_delete: boolean }[]>`
      SELECT break_periods_delete(${breakId}::UUID);
    `;

    createLog(
      user,
      "delete_break_period",
      `break_period_id: '${breakId}'`,
    );
    return {
      success: result?.break_periods_delete ?? false,
    };
  } catch (error) {
    console.error("Failed to delete break period:", error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/** --- Logs --- **/
interface SidebarFunctionProps {
  account: AccountInfo | null;
}

export async function createLog(
  activeAccount: string,
  action: string,
  details?: string | null
): Promise<void> {
  try {
    await sql`
      SELECT logs_create(
        get_user_id_by_email(${activeAccount}),
        ${action},
        ${details ?? null}
      );
    `;
  } catch (error) {
    console.error("Failed to insert log entry:", error);
  }
}