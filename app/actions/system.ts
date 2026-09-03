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

// Count Break Period
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

// Create Break Period
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

// Read Break Period
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

// Update Break Period
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

// Delete Break Period
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

// Read Faculty Load
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

// Count Room
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

// Create Room
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

// Read Room
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

// Update Room
export async function updateRoomType(
  user: string,
  roomTypeId: string,
  value: string,
) {
  try {
    const [result] = await sql<{ room_type_update: boolean }[]>`
      SELECT room_type_update(${roomTypeId}::UUID, ${value});
    `;

    await createLog(
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

// Delete Room
export async function deleteRoomType(user: string, roomTypeId: string) {
  try {
    const [result] = await sql<{ room_type_delete: boolean }[]>`
      SELECT room_type_delete(${roomTypeId}::UUID);
    `;

    await createLog(user, "delete_room_type", `room_type_id: '${roomTypeId}'`);

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

/** --- User Management --- **/

export interface ManagedUser {
  user_id: string;
  email: string;
  username: string;
  role_name: string;
  is_blacklisted: boolean;
  created_at: string;
  updated_at: string;
}

export interface FetchUsersListResponse {
  success: boolean;
  data?: ManagedUser[];
  error?: string;
}

// Read User
export async function fetchUsers(
  search?: string | null,
  sortBy: string = "email",
  sortDir: string = "ASC",
  limit: number = 10,
  page: number = 1
): Promise<FetchUsersListResponse> {
  try {
    const offset = Math.max(0, (page - 1) * limit);
    const searchParam = search?.trim() ? search.trim() : null;

    const users = await sql<ManagedUser[]>`
      SELECT 
        user_id, 
        email, 
        username, 
        role_name,
        is_blacklisted,
        created_at, 
        updated_at
      FROM manage_users_read(
        ${searchParam}, 
        ${sortBy}, 
        ${sortDir}, 
        ${limit}, 
        ${offset}
      );
    `;

    return {
      success: true,
      data: users ? [...users] : [],
    };
  } catch (error) {
    console.error("Error executing fetchUsers:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to fetch users. Please try again later.",
    };
  }
}

// Create User
export async function createUser(
  actor: string,
  email: string,
  username?: string,
  roleName: string = "viewer"
) {
  try {
    const [result] = await sql<{ manage_users_create: string }[]>`
      SELECT manage_users_create(${email}, ${username ?? null}, ${roleName});
    `;

    await createLog(
      actor,
      "create_user",
      `email: '${email}' | role: '${roleName}'`
    );

    return {
      success: true,
      userId: result?.manage_users_create
    };
  } catch (error) {
    console.error("Failed to create user:", error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

// Update User
export async function updateUser(
  actor: string,
  userId: string,
  username: string,
  roleName: string
) {
  try {
    await sql`
      SELECT manage_users_update(
        ${userId}::UUID,
        ${username},
        ${roleName}
      );
    `;

    await createLog(
      actor,
      "update_user",
      `user_id: '${userId}' | username: '${username}' | role: '${roleName}'`,
    );

    return { success: true };
  } catch (error) {
    console.error("Failed to update user:", error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

// Count User
export async function fetchUsersCount(search?: string | null) {
  try {
    const pSearch = search?.trim() ? search.trim() : null;

    const [result] = await sql<{ manage_users_count: number }[]>`
      SELECT manage_users_count(${pSearch});
    `;

    return {
      success: true,
      count: result?.manage_users_count ?? 0,
    };
  } catch (error) {
    console.error("Failed to fetch user count:", error);
    return {
      success: false,
      error: (error as Error).message,
      count: 0,
    };
  }
}

/** --- Roles --- **/

export interface Role {
  role_id: string;
  role_name: string;
  booking: boolean;
  personal_schedule: boolean;
  academic_qualification: boolean;
  schedules: boolean;
  courses: boolean;
  rooms: boolean;
  subjects: boolean;
  teachers: boolean;
  maq: boolean;
  fcce: boolean;
  help: boolean;
  config: boolean;
  superuser: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoleInput {
  role_name: string;
  booking?: boolean;
  personal_schedule?: boolean;
  academic_qualification?: boolean;
  schedules?: boolean;
  courses?: boolean;
  rooms?: boolean;
  subjects?: boolean;
  teachers?: boolean;
  maq?: boolean;
  fcce?: boolean;
  help?: boolean;
  config?: boolean;
  superuser?: boolean;
}

export interface FetchRolesResponse {
  success: boolean;
  data?: Role[];
  error?: string;
}

/**
 * Read Roles
 * Note: Setting limit to 0 (or a negative number) will fetch ALL records without limit.
 */
export async function fetchRoles(
    search?: string | null,
    sortBy: string = "role_name",
    sortDir: string = "ASC",
    limit: number = 10,
    page: number = 1
): Promise<FetchRolesResponse> {
  try {
    const offset = limit > 0 ? Math.max(0, (page - 1) * limit) : 0;
    const searchParam = search?.trim() ? search.trim() : null;

    const roles = await sql<Role[]>`
      SELECT 
        role_id,
        role_name,
        booking,
        personal_schedule,
        academic_qualification,
        schedules,
        courses,
        rooms,
        subjects,
        teachers,
        maq,
        fcce,
        help,
        config,
        superuser,
        created_at,
        updated_at
      FROM roles_read(
        ${searchParam},
        ${sortBy},
        ${sortDir},
        ${limit},
        ${offset}
      );
    `;

    return {
      success: true,
      data: roles ? [...roles] : [],
    };
  } catch (error) {
    console.error("Error executing fetchRoles:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to fetch roles.",
    };
  }
}

// Create Role
export async function createRole(actor: string, input: RoleInput) {
  try {
    const [result] = await sql<{ roles_create: string }[]>`
      SELECT roles_create(
        ${input.role_name},
        ${input.booking ?? false},
        ${input.personal_schedule ?? false},
        ${input.academic_qualification ?? false},
        ${input.schedules ?? false},
        ${input.courses ?? false},
        ${input.rooms ?? false},
        ${input.subjects ?? false},
        ${input.teachers ?? false},
        ${input.maq ?? false},
        ${input.fcce ?? false},
        ${input.help ?? false},
        ${input.config ?? false},
        ${input.superuser ?? false}
      );
    `;

    await createLog(actor, "create_role", `role_name: '${input.role_name}'`);

    return {
      success: true,
      roleId: result?.roles_create,
    };
  } catch (error) {
    console.error("Failed to create role:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to create role.",
    };
  }
}

// Update Role
export async function updateRole(
  actor: string,
  roleId: string,
  input: Partial<RoleInput>,
) {
  try {
    await sql`
      SELECT roles_update(
        ${roleId}::UUID,
        ${input.role_name ?? null},
        ${input.booking ?? null},
        ${input.personal_schedule ?? null},
        ${input.academic_qualification ?? null},
        ${input.schedules ?? null},
        ${input.courses ?? null},
        ${input.rooms ?? null},
        ${input.subjects ?? null},
        ${input.teachers ?? null},
        ${input.maq ?? null},
        ${input.fcce ?? null},
        ${input.help ?? null},
        ${input.config ?? null},
        ${input.superuser ?? null}
      );
    `;

    await createLog(actor, "update_role", `role_id: '${roleId}'`);

    return { success: true };
  } catch (error) {
    console.error("Failed to update role:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to update role.",
    };
  }
}

// Delete Role
export async function deleteRole(actor: string, roleId: string) {
  try {
    await sql`
      SELECT roles_delete(${roleId}::UUID);
    `;

    await createLog(actor, "delete_role", `role_id: '${roleId}'`);

    return { success: true };
  } catch (error) {
    console.error("Failed to delete role:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to delete role.",
    };
  }
}

/** --- Blacklist --- **/

export interface BlacklistedUser {
  blacklist_id: string;
  user_id: string;
  email: string;
  username: string;
  created_at: string;
}

export interface FetchBlacklistResponse {
  success: boolean;
  data?: BlacklistedUser[];
  error?: string;
}

// Validation

export async function checkIsUserBlacklistedByEmail(email: string) {
  try {
    const cleanEmail = email.trim().toLowerCase();

    const [result] = await sql<{ is_user_blacklisted_by_email: boolean }[]>`
      SELECT is_user_blacklisted_by_email(${cleanEmail});
    `;

    return {
      success: true,
      isBlacklisted: result?.is_user_blacklisted_by_email ?? false,
    };
  } catch (error) {
    console.error("Failed to check blacklist status:", error);
    return {
      success: false,
      error: (error as Error).message,
      isBlacklisted: false,
    };
  }
}

// Read Blacklist
export async function fetchBlacklist(
    search?: string | null,
    sortBy: string = "created_at",
    sortDir: string = "DESC",
    limit: number = 10,
    page: number = 1
): Promise<FetchBlacklistResponse> {
  try {
    const offset = Math.max(0, (page - 1) * limit);
    const searchParam = search?.trim() ? search.trim() : null;

    const items = await sql<BlacklistedUser[]>`
      SELECT 
        blacklist_id, 
        user_id, 
        email, 
        username, 
        created_at
      FROM manage_blacklist_read(
        ${searchParam}, 
        ${sortBy}, 
        ${sortDir}, 
        ${limit}, 
        ${offset}
      );
    `;

    return {
      success: true,
      data: items ? [...items] : [],
    };
  } catch (error) {
    console.error("Error executing fetchBlacklist:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to fetch blacklist entries.",
    };
  }
}

// Count Blacklist
export async function fetchBlacklistCount(search?: string | null) {
  try {
    const searchParam = search?.trim() ? search.trim() : null;

    const [result] = await sql<{ manage_blacklist_count: number }[]>`
      SELECT manage_blacklist_count(${searchParam});
    `;

    return {
      success: true,
      count: result?.manage_blacklist_count ?? 0,
    };
  } catch (error) {
    console.error("Failed to fetch blacklist count:", error);
    return {
      success: false,
      error: (error as Error).message,
      count: 0,
    };
  }
}

// Create Blacklist
export async function addToBlacklist(actor: string, userId: string) {
  try {
    const [result] = await sql<{ manage_blacklist_create: string }[]>`
      SELECT manage_blacklist_create(${userId}::UUID);
    `;

    await createLog(actor, "add_blacklist", `user_id: '${userId}'`);

    return {
      success: true,
      blacklistId: result?.manage_blacklist_create
    };
  } catch (error) {
    console.error("Failed to blacklist user:", error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

// Delete Blacklist
export async function removeFromBlacklist(actor: string, blacklistId: string) {
  try {
    await sql`
      SELECT manage_blacklist_delete(${blacklistId}::UUID);
    `;

    await createLog(
      actor,
      "remove_blacklist",
      `blacklist_id: '${blacklistId}'`,
    );

    return { success: true };
  } catch (error) {
    console.error("Failed to remove from blacklist:", error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/** --- Logs --- **/

export interface SystemLog {
  log_id: string;
  user_id: string;
  username: string;
  action: string;
  details: string;
  created_at: string;
}

export interface FetchLogListResponse {
  success: boolean;
  data?: SystemLog[];
  count?: number;
  error?: string;
}

// Read Logs
export async function fetchLogList(
  search?: string | null,
  sortBy: string = "created_at",
  sortDir: string = "DESC",
  limit: number = 10,
  page: number = 1,
): Promise<FetchLogListResponse> {
  try {
    const offset = Math.max(0, (page - 1) * limit);
    const searchParam = search?.trim() ? search.trim() : null;

    const logs = await sql<SystemLog[]>`
      SELECT
        log_id,
        user_id,
        username,
        action,
        details,
        created_at
      FROM logs_read(
        ${searchParam},
        ${sortBy},
        ${sortDir},
        ${limit},
        ${offset}
        );
    `;

    return {
      success: true,
      data: logs ? [...logs] : [],
    };
  } catch (error) {
    console.error("Error executing fetchLogList:", error);
    return {
      success: false,
      error:
        (error as Error).message ||
        "Failed to fetch logs. Please try again later.",
    };
  }
}

// Create Logs
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