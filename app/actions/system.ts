"use server";
import sql from "@/lib/database";

/******************
 * CONFIGURATIONS *
 ******************/

/** --- Generate Default Settings --- **/

export async function seedConfiguration(): Promise<boolean> {
  try {
    const [result] = await sql<{ configuration_seed_default: boolean }[]>`
      SELECT configuration_seed_default();
    `;

    return result?.configuration_seed_default ?? false;
  } catch (error) {
    console.error("Failed to seed default configurations:", error);
    return false;
  }
}
export async function seedRoomTypes(): Promise<boolean> {
  try {
    const [result] = await sql<{ seed_room_types: boolean }[]>`
      SELECT seed_room_types();
    `;

    return result?.seed_room_types ?? false;
  } catch (error) {
    console.error("Failed to seed room types:", error);
    return false;
  }
}

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

    await createLog(
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

    await createLog(
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

    await createLog(
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

/** --- Faculty Load --- **/

export interface Configuration {
  configuration_id: string;
  active_schedule: string | null;
  faculty_load: {
    full_time: number;
    part_time_full_load: number;
    part_time: number;
  };
  max_students: number;
  overload_max: number;
  prep_limits: {
    full_time: number;
    part_time_full_load: number;
    part_time: number;
  };
}

interface FetchFacultyLoadConfigParams {
  search?: string | null;
  sortBy?: string;
  sortDir?: "ASC" | "DESC";
  limit?: number;
  page?: number;
}

interface UpdateFacultyLoadParams {
  userEmail: string;
  fullTime: number;
  partTimeFullLoad: number;
  partTime: number;
  configurationId?: string;
}

interface UpdatePrepLimitsParams {
  userEmail: string;
  fullTime: number;
  partTimeFullLoad: number;
  partTime: number;
  configurationId?: string;
}

interface UpdateOverloadMaxParams {
  userEmail: string;
  overloadMax: number;
  configurationId?: string;
}

// Read
export async function fetchFacultyLoadConfig({
  search = null,
  sortBy = "configuration_id",
  sortDir = "ASC",
  limit = 10,
  page = 1,
}: FetchFacultyLoadConfigParams = {}) {
  try {
    const offset = Math.max(0, (page - 1) * limit);

    const configs = await sql<Configuration[]>`
      SELECT * FROM configuration_read(
        ${search},
        ${sortBy},
        ${sortDir},
        ${limit},
        ${offset}
      );
    `;

    return {
      success: true,
      data: configs,
    };
  } catch (error) {
    console.error("Failed to fetch faculty load configurations:", error);
    return {
      success: false,
      error: (error as Error).message,
      data: [],
    };
  }
}

// --- Updates --- //
export async function updateFacultyLoad({
                                          userEmail,
                                          fullTime,
                                          partTimeFullLoad,
                                          partTime,
                                          configurationId,
                                        }: UpdateFacultyLoadParams): Promise<{ success: boolean; error?: string }> {
  // Client/Server Action Validation Check
  if (fullTime > 30 || partTimeFullLoad > 30 || partTime > 30) {
    return {
      success: false,
      error: "Faculty load parameters cannot exceed 30 hours.",
    };
  }

  try {
    await sql`
      CALL configuration_update_faculty_load(
        ${fullTime},
        ${partTimeFullLoad},
        ${partTime},
        ${configurationId ?? null}::UUID
      );
    `;

    const logDetails = `full_time: ${fullTime} | part_time_full_load: ${partTimeFullLoad} | part_time: ${partTime}`;
    await createLog(userEmail, "update_faculty_load", logDetails);

    return { success: true };
  } catch (error) {
    console.error("Failed to update faculty load configurations:", error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

export async function updatePrepLimits({
  userEmail,
  fullTime,
  partTimeFullLoad,
  partTime,
  configurationId,
}: UpdatePrepLimitsParams): Promise<{ success: boolean; error?: string }> {
  if (fullTime > 10 || partTimeFullLoad > 10 || partTime > 10) {
    return {
      success: false,
      error: "Preparation limits cannot exceed 10.",
    };
  }

  try {
    await sql`
      CALL configuration_update_prep_limits(
        ${fullTime},
        ${partTimeFullLoad},
        ${partTime},
        ${configurationId ?? null}::UUID
      );
    `;

    const logDetails = `full_time: ${fullTime} | part_time_full_load: ${partTimeFullLoad} | part_time: ${partTime}`;
    await createLog(userEmail, "update_prep_limits", logDetails);

    return { success: true };
  } catch (error) {
    console.error("Failed to update prep limits configurations:", error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

export async function updateOverloadMax({
  userEmail,
  overloadMax,
  configurationId,
}: UpdateOverloadMaxParams): Promise<{ success: boolean; error?: string }> {
  if (overloadMax > 10) {
    return {
      success: false,
      error: "Overload max cannot exceed 10.",
    };
  }

  try {
    await sql`
      CALL configuration_update_overload_max(
        ${overloadMax},
        ${configurationId ?? null}::UUID
      );
    `;

    const logDetails = `overload_max: ${overloadMax}`;
    await createLog(userEmail, "update_overload_max", logDetails);

    return { success: true };
  } catch (error) {
    console.error("Failed to update overload max configurations:", error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/** --- Class Settings --- **/

interface UpdateEnrollmentConstraintsParams {
  userEmail: string;
  maxStudentsPerSection: number;
}

export async function updateEnrollmentConstraints({
  userEmail,
  maxStudentsPerSection,
}: UpdateEnrollmentConstraintsParams) {
  try {
    const [result] = await sql<
      { configuration_update_max_students: boolean }[]
    >`
      SELECT configuration_update_max_students(
        ${maxStudentsPerSection}
      );
    `;

    await createLog(
      userEmail,
      "update_enrollment_constraints",
      `max_students_per_section: '${maxStudentsPerSection}'`,
    );

    return {
      success: result?.configuration_update_max_students ?? true,
    };
  } catch (error) {
    console.error("Failed to update enrollment constraints:", error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/** --- Room Types --- **/

export interface RoomType {
  room_type_id: string;
  value: string;
}

// Count
export async function fetchRoomTypeCount(search?: string | null) {
  try {
    const pSearch = search ?? null;

    const [result] = await sql<{ room_types_count: number }[]>`
      SELECT room_types_count(${pSearch});
    `;

    return { success: true, count: result?.room_types_count ?? 0 };
  } catch (error) {
    console.error("Failed to fetch room types count:", error);
    return { success: false, error: (error as Error).message, count: 0 };
  }
}

// Create
/** Create Room Type */
export async function createRoomType(user: string, value: string) {
  try {
    await sql`
      SELECT room_type_create(${value});
    `;

    await createLog(user, "create_room_type", `value: '${value}'`);

    return { success: true };
  } catch (error) {
    console.error("Failed to create room type:", error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

// Read
export async function fetchRoomTypeList(
  search?: string | null,
  sortdir?: string,
  limit?: number,
  page?: number
) {
  try {
    const pSearch = search ? `%${search}%` : null;
    const pSortDir = sortdir?.toUpperCase() === "DESC" ? "DESC" : "ASC";
    const pLimit = limit ?? 10;
    const pPage = page ?? 1;
    const offset = Math.max(0, (pPage - 1) * pLimit);

    const data = await sql<RoomType[]>`
      SELECT room_type_id, value 
      FROM room_types
      WHERE (${pSearch}::TEXT IS NULL OR value ILIKE ${pSearch})
      ORDER BY 
        CASE WHEN ${pSortDir} = 'ASC' THEN value END ASC,
        CASE WHEN ${pSortDir} = 'DESC' THEN value END DESC
      LIMIT ${pLimit} 
      OFFSET ${offset};
    `;

    return { success: true, data };
  } catch (error) {
    console.error("Failed to fetch room types list:", error);
    return { success: false, error: (error as Error).message };
  }
}

// Update
export async function updateRoomType(
  user: string,
  roomTypeId: string,
  value: string,
) {
  try {
    const [result] = await sql<{ room_type_update: boolean }[]>`
      SELECT room_type_update(${roomTypeId}::UUID, ${value});
    `;

    createLog(
      user,
      "update_room_type",
      `room_type_id: '${roomTypeId}' | value: '${value}'`,
    );

    return {
      success: result?.room_type_update ?? false,
    };
  } catch (error) {
    console.error("Failed to update room type:", error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

// Delete
export async function deleteRoomType(user: string, roomTypeId: string) {
  try {
    const [result] = await sql<{ room_type_delete: boolean }[]>`
      SELECT room_type_delete(${roomTypeId}::UUID);
    `;

    createLog(user, "delete_room_type", `room_type_id: '${roomTypeId}'`);

    return {
      success: result?.room_type_delete ?? false,
    };
  } catch (error) {
    console.error("Failed to delete room type:", error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/** --- Logs --- **/

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