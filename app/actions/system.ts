"use server";
import sql from "@/lib/database";

/*****************
 * ACADEMIC YEAR *
 *****************/

export interface AcademicYearRecord {
  ay_sem: string;
}

/* FETCH ACADEMIC YEARS (READ) */
export async function fetchAcademicYears(
  search: string | null = null,
  sortBy: string = "ay_sem",
  sortDir: string = "DESC",
  limit: number = 10,
  page: number = 1,
) {
  try {
    const offset = limit > 0 ? (page - 1) * limit : 0;

    const data = await sql<AcademicYearRecord[]>`
      SELECT * FROM academic_year_read(
        ${search || null},
        ${sortBy},
        ${sortDir},
        ${limit},
        ${offset}
      );
    `;

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("Failed to fetch academic years:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to fetch academic years.",
      data: [],
    };
  }
}

/* COUNT ACADEMIC YEARS */
export async function fetchAcademicYearsCount(search: string | null = null) {
  try {
    const [result] = await sql<{ academic_year_count: number }[]>`
      SELECT academic_year_count(${search || null});
    `;

    return {
      success: true,
      count: result?.academic_year_count ?? 0,
    };
  } catch (error) {
    console.error("Failed to fetch academic years count:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to count academic years.",
      count: 0,
    };
  }
}

/* CREATE ACADEMIC YEAR */
export async function createAcademicYear(actor: string, aySem: string) {
  try {
    const [result] = await sql<{ academic_year_create: string }[]>`
      SELECT academic_year_create(${aySem});
    `;

    await createLog(actor, "create_academic_year", `ay_sem: '${aySem}'`);

    return {
      success: true,
      aySem: result?.academic_year_create,
    };
  } catch (error) {
    console.error("Failed to create academic year:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to create academic year.",
    };
  }
}

/* UPDATE ACADEMIC YEAR */
export async function updateAcademicYear(
  actor: string,
  oldAySem: string,
  newAySem: string,
) {
  try {
    const [result] = await sql<{ academic_year_update: string }[]>`
      SELECT academic_year_update(${oldAySem}, ${newAySem});
    `;

    await createLog(
      actor,
      "update_academic_year",
      `old: '${oldAySem}', new: '${newAySem}'`,
    );

    return {
      success: true,
      aySem: result?.academic_year_update,
    };
  } catch (error) {
    console.error("Failed to update academic year:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to update academic year.",
    };
  }
}

/* DELETE ACADEMIC YEAR */
export async function deleteAcademicYear(actor: string, aySem: string) {
  try {
    await sql`
      SELECT academic_year_delete(${aySem});
    `;

    await createLog(actor, "delete_academic_year", `ay_sem: '${aySem}'`);

    return { success: true };
  } catch (error) {
    console.error("Failed to delete academic year:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to delete academic year.",
    };
  }
}

/*********
 * ROOMS *
 **********/

export interface RoomInput {
  room_name: string;
  room_type?: string | null;
  floor_level?: number | null;
}
export interface RoomRecord {
  room_id: string;
  room_name: string;
  room_type: string | null;
  room_type_name: string | null;
  floor_level: number | null;
  created_at: string;
  updated_at: string;
}

/* FETCH ROOMS (READ) */
export async function fetchRooms(
  search: string | null = null,
  sortBy: string = "room_name",
  sortDir: string = "ASC",
  limit: number = 10,
  page: number = 1,
) {
  try {
    const offset = limit > 0 ? (page - 1) * limit : 0;

    const data = await sql<RoomRecord[]>`
      SELECT * FROM rooms_read(
        ${search || null},
        ${sortBy},
        ${sortDir},
        ${limit},
        ${offset}
      );
    `;

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("Failed to fetch rooms:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to fetch rooms.",
      data: [],
    };
  }
}

/* FETCH ROOMS COUNT */
export async function fetchRoomsCount(search: string | null = null) {
  try {
    const [result] = await sql<{ rooms_count: number }[]>`
      SELECT rooms_count(${search || null});
    `;

    return {
      success: true,
      count: result?.rooms_count ?? 0,
    };
  } catch (error) {
    console.error("Failed to fetch rooms count:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to count rooms.",
      count: 0,
    };
  }
}

/* CREATE ROOM */
export async function createRoom(actor: string, input: RoomInput) {
  try {
    const [result] = await sql<{ rooms_create: string }[]>`
      SELECT rooms_create(
        ${input.room_name},
        ${input.room_type ? input.room_type : null}::UUID,
        ${input.floor_level ?? null}
      );
    `;

    await createLog(actor, "create_room", `room_name: '${input.room_name}'`);

    return {
      success: true,
      roomId: result?.rooms_create,
    };
  } catch (error) {
    console.error("Failed to create room:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to create room.",
    };
  }
}

/* UPDATE ROOM */
export async function updateRoom(
  actor: string,
  roomId: string,
  input: Partial<RoomInput>,
) {
  try {
    await sql`
      SELECT rooms_update(
        ${roomId}::UUID,
        ${input.room_name ?? null},
        ${input.room_type ? input.room_type : null}::UUID,
        ${input.floor_level ?? null}
      );
    `;

    await createLog(actor, "update_room", `room_id: '${roomId}'`);

    return { success: true };
  } catch (error) {
    console.error("Failed to update room:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to update room.",
    };
  }
}

/* DELETE ROOM */
export async function deleteRoom(actor: string, roomId: string) {
  try {
    await sql`
      SELECT rooms_delete(${roomId}::UUID);
    `;

    await createLog(actor, "delete_room", `room_id: '${roomId}'`);

    return { success: true };
  } catch (error) {
    console.error("Failed to delete room:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to delete room.",
    };
  }
}

/************
 * PROGRAMS *
 ************/

export interface ProgramRecord {
  program_code: string;
  program_name: string;
  year_level: string;
  students: Record<string, unknown> | Array<unknown>;
  created_at: string;
  updated_at: string;
}
export interface ProgramInput {
  program_code: string;
  program_name?: string;
  year_level?: string;
  students?: Record<string, unknown> | Array<unknown>;
}

/* FETCH PROGRAMS (READ) */
export async function fetchPrograms(
  search: string | null = null,
  yearLevel: string = "all",
  sortBy: string = "program_code",
  sortDir: string = "ASC",
  limit: number = 10,
  page: number = 1,
) {
  try {
    // If limit is 0, we set offset to 0 to fetch all records without pagination
    const offset = limit > 0 ? (page - 1) * limit : 0;

    const data = await sql<ProgramRecord[]>`
      SELECT * FROM programs_read(
        ${search || null},
        ${yearLevel},
        ${sortBy},
        ${sortDir},
        ${limit},
        ${offset}
                    );
    `;

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("Failed to fetch programs:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to fetch programs.",
      data: [],
    };
  }
}

/* FETCH PROGRAMS COUNT */
export async function fetchProgramsCount(
  search: string | null = null,
  yearLevel: string = "all",
) {
  try {
    const [result] = await sql<{ programs_count: number }[]>`
      SELECT programs_count(
               ${search || null},
               ${yearLevel}
             );
    `;

    return {
      success: true,
      count: result?.programs_count ?? 0,
    };
  } catch (error) {
    console.error("Failed to fetch programs count:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to count programs.",
      count: 0,
    };
  }
}

/* CREATE PROGRAM */
export async function createProgram(actor: string, input: ProgramInput) {
  try {
    const [result] = await sql<{ programs_create: string }[]>`
      SELECT programs_create(
               ${input.program_code},
               ${input.program_name ?? null},
               ${input.year_level ?? null},
               ${input.students ? JSON.stringify(input.students) : "[]"}::json
             );
    `;

    await createLog(
      actor,
      "create_program",
      `program_code: '${input.program_code}'`,
    );

    return {
      success: true,
      programCode: result?.programs_create,
    };
  } catch (error) {
    console.error("Failed to create program:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to create program record.",
    };
  }
}

/* UPDATE PROGRAM */
export async function updateProgram(
  actor: string,
  programCode: string,
  input: Partial<Omit<ProgramInput, "program_code">>,
) {
  try {
    await sql`
      SELECT programs_update(
               ${programCode},
               ${input.program_name ?? null},
               ${input.year_level ?? null},
               ${input.students ? JSON.stringify(input.students) : null}::json
             );
    `;

    await createLog(actor, "update_program", `program_code: '${programCode}'`);

    return { success: true };
  } catch (error) {
    console.error("Failed to update program:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to update program record.",
    };
  }
}

/* DELETE PROGRAM */
export async function deleteProgram(actor: string, programCode: string) {
  try {
    await sql`
      SELECT programs_delete(${programCode});
    `;

    await createLog(actor, "delete_program", `program_code: '${programCode}'`);

    return { success: true };
  } catch (error) {
    console.error("Failed to delete program:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to delete program record.",
    };
  }
}

/************
 * SUBJECTS *
 ************/

export interface SubjectInput {
  curriculum_id?: string | null;
  program_code?: string | null;
  course_code: string;
  course_name: string;
  specialization?: string | null;
  lecture_units?: number;
  lab_units?: number;
  lab_type?: string | null;
  year_term?: string | null;
}
export interface SubjectRecord {
  subject_id: string;
  curriculum_id: string | null;
  program_code: string | null;
  course_code: string;
  course_name: string;
  specialization: string | null;
  lecture_units: number;
  lab_units: number;
  lab_type: string | null;
  lab_type_name: string | null;
  year_term: string | null;
}

/* FETCH SUBJECTS (READ) */
export async function fetchSubjects(
  search: string | null = null,
  sortBy: string = "course_code",
  sortDir: string = "ASC",
  limit: number = 10,
  page: number = 1,
) {
  try {
    const offset = limit > 0 ? (page - 1) * limit : 0;

    const data = await sql<SubjectRecord[]>`
      SELECT * FROM subjects_read(
        ${search || null},
        ${sortBy},
        ${sortDir},
        ${limit},
        ${offset}
      );
    `;

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("Failed to fetch subjects:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to fetch subjects.",
      data: [],
    };
  }
}

/* FETCH SUBJECTS COUNT */
export async function fetchSubjectsCount(search: string | null = null) {
  try {
    const [result] = await sql<{ subjects_count: number }[]>`
      SELECT subjects_count(${search || null});
    `;

    return {
      success: true,
      count: result?.subjects_count ?? 0,
    };
  } catch (error) {
    console.error("Failed to fetch subjects count:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to count subjects.",
      count: 0,
    };
  }
}

/* CREATE SUBJECT */
export async function createSubject(actor: string, input: SubjectInput) {
  try {
    const [result] = await sql<{ subjects_create: string }[]>`
      SELECT subjects_create(
        ${input.curriculum_id ? input.curriculum_id : null}::UUID,
        ${input.program_code ?? null},
        ${input.course_code},
        ${input.course_name},
        ${input.specialization ?? null},
        ${input.lecture_units ?? 0.0},
        ${input.lab_units ?? 0.0},
        ${input.lab_type ? input.lab_type : null}::UUID,
        ${input.year_term ?? null}
      );
    `;

    await createLog(
      actor,
      "create_subject",
      `course_code: '${input.course_code}', course_name: '${input.course_name}'`,
    );

    return {
      success: true,
      subjectId: result?.subjects_create,
    };
  } catch (error) {
    console.error("Failed to create subject:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to create subject.",
    };
  }
}

/* UPDATE SUBJECT */
export async function updateSubject(
  actor: string,
  subjectId: string,
  input: Partial<SubjectInput>,
) {
  try {
    await sql`
      SELECT subjects_update(
        ${subjectId}::UUID,
        ${input.curriculum_id ? input.curriculum_id : null}::UUID,
        ${input.program_code ?? null},
        ${input.course_code ?? null},
        ${input.course_name ?? null},
        ${input.specialization ?? null},
        ${input.lecture_units ?? null},
        ${input.lab_units ?? null},
        ${input.lab_type ? input.lab_type : null}::UUID,
        ${input.year_term ?? null}
      );
    `;

    await createLog(actor, "update_subject", `subject_id: '${subjectId}'`);

    return { success: true };
  } catch (error) {
    console.error("Failed to update subject:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to update subject.",
    };
  }
}

/* DELETE SUBJECT */
export async function deleteSubject(actor: string, subjectId: string) {
  try {
    await sql`
      SELECT subjects_delete(${subjectId}::UUID);
    `;

    await createLog(actor, "delete_subject", `subject_id: '${subjectId}'`);

    return { success: true };
  } catch (error) {
    console.error("Failed to delete subject:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to delete subject.",
    };
  }
}

/************
 * TEACHERS *
 ************/

export type TeacherStatusFilter =
  | "All Active & On Leave"
  | "Active"
  | "On Leave"
  | "Inactive"
  | "Archived (Soft-Deleted)"
  | "Archived";

export interface TeacherInput {
  pscs_id?: string | null;
  email?: string | null;
  f_name?: string | null;
  m_name?: string | null;
  surname?: string | null;
  suffix?: string | null;
  teacher_code?: string | null;
  department?: string | null;
  requirement_type?: string | null;
  employment_type?: string | null;
  status?: string | null;
  availability?: Record<string, unknown> | Array<unknown> | null;
  preferences?: Record<string, unknown> | Array<unknown> | null;
}
export interface TeacherRecord {
  teacher_id: string;
  pscs_id: string | null;
  email: string | null;
  f_name: string | null;
  m_name: string | null;
  surname: string | null;
  suffix: string | null;
  full_name: string;
  teacher_code: string | null;
  department: string | null;
  requirement_type: string | null;
  employment_type: string | null;
  status: string;
  availability: Record<string, unknown> | Array<unknown>;
  preferences: Record<string, unknown> | Array<unknown>;
  created_at: string;
  updated_at: string;
}

// Read Teachers
export async function fetchTeachers(
  search: string | null = null,
  status: TeacherStatusFilter = "All Active & On Leave",
  department: string = "All Departments",
  sortBy: string = "surname",
  sortDir: string = "ASC",
  limit: number = 10,
  page: number | string = 1,
) {
  try {
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const offset = limit > 0 ? (pageNum - 1) * limit : 0;

    const data = await sql<TeacherRecord[]>`
      SELECT * FROM teachers_read(
          ${search || null},
          ${status},
          ${department},
          ${sortBy},
          ${sortDir},
          ${limit},
          ${offset}
                    );
    `;

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("Failed to fetch teachers:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to fetch teachers.",
      data: [],
    };
  }
}

// Count Teachers
export async function fetchTeachersCount(
  search: string | null = null,
  status: TeacherStatusFilter = "All Active & On Leave",
  department: string = "All Departments",
) {
  try {
    const [result] = await sql<{ teachers_count: number }[]>`
      SELECT teachers_count(
                 ${search || null},
                 ${status},
                 ${department}
             );
    `;

    return {
      success: true,
      count: result?.teachers_count ?? 0,
    };
  } catch (error) {
    console.error("Failed to fetch teachers count:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to count teachers.",
      count: 0,
    };
  }
}

// Create Teacher
export async function createTeacher(actor: string, input: TeacherInput) {
  try {
    const [result] = await sql<{ teachers_create: string }[]>`
      SELECT teachers_create(
                 ${input.pscs_id ?? null},
                 ${input.email ?? null},
                 ${input.f_name ?? null},
                 ${input.m_name ?? null},
                 ${input.surname ?? null},
                 ${input.suffix ?? null},
                 ${input.teacher_code ?? null},
                 ${input.department ?? null},
                 ${input.requirement_type ?? null},
                 ${input.employment_type ?? null},
                 ${input.status ?? "Active"},
                 ${input.availability ? JSON.stringify(input.availability) : "{}"}::jsonb,
                 ${input.preferences ? JSON.stringify(input.preferences) : "{}"}::jsonb
             );
    `;

    await createLog(
      actor,
      "create_teacher",
      `email: '${input.email ?? "N/A"}', surname: '${input.surname ?? "N/A"}'`,
    );

    return {
      success: true,
      teacherId: result?.teachers_create,
    };
  } catch (error) {
    console.error("Failed to create teacher:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to create teacher record.",
    };
  }
}

// Update Teacher
export async function updateTeacher(
  actor: string,
  teacherId: string,
  input: Partial<TeacherInput>,
) {
  try {
    await sql`
      SELECT teachers_update(
                 ${teacherId}::UUID,
                 ${input.pscs_id ?? null},
                 ${input.email ?? null},
                 ${input.f_name ?? null},
                 ${input.m_name ?? null},
                 ${input.surname ?? null},
                 ${input.suffix ?? null},
                 ${input.teacher_code ?? null},
                 ${input.department ?? null},
                 ${input.requirement_type ?? null},
                 ${input.employment_type ?? null},
                 ${input.status ?? null},
                 ${input.availability ? JSON.stringify(input.availability) : null}::jsonb,
                 ${input.preferences ? JSON.stringify(input.preferences) : null}::jsonb
             );
    `;

    await createLog(actor, "update_teacher", `teacher_id: '${teacherId}'`);

    return { success: true };
  } catch (error) {
    console.error("Failed to update teacher:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to update teacher record.",
    };
  }
}

// Archive Teacher
export async function archiveTeacher(actor: string, teacherId: string) {
  try {
    await sql`
      SELECT teachers_archive(${teacherId}::UUID);
    `;

    await createLog(actor, "archive_teacher", `teacher_id: '${teacherId}'`);

    return { success: true };
  } catch (error) {
    console.error("Failed to archive teacher:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to archive teacher record.",
    };
  }
}

/*******
 * MAQ *
 *******/

export interface MaqClusterRecord {
  cluster_name: string;
}
export interface MaqRecord {
  aq: string;
}
export interface MaqClusterEntryItem {
  mce_id: string;
  aq: string;
}
export interface MaqClusterWithEntriesRecord {
  cluster_name: string;
  entries: MaqClusterEntryItem[];
}

/** MAQ **/

/* FETCH MAQ (READ) */
export async function fetchMaq(
  search: string | null = null,
  sortBy: string = "aq",
  sortDir: string = "ASC",
  limit: number = 10,
  page: number = 1,
) {
  try {
    const offset = limit > 0 ? (page - 1) * limit : 0;

    const data = await sql<MaqRecord[]>`
      SELECT * FROM maq_read(
        ${search || null},
        ${sortBy},
        ${sortDir},
        ${limit},
        ${offset}
                    );
    `;

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("Failed to fetch MAQ records:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to fetch MAQ records.",
      data: [],
    };
  }
}

/* FETCH MAQ COUNT */
export async function fetchMaqCount(search: string | null = null) {
  try {
    const [result] = await sql<{ maq_count: number }[]>`
      SELECT maq_count(${search || null});
    `;

    return {
      success: true,
      count: result?.maq_count ?? 0,
    };
  } catch (error) {
    console.error("Failed to fetch MAQ count:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to count MAQ records.",
      count: 0,
    };
  }
}

/* CREATE MAQ */
export async function createMaq(actor: string, aq: string) {
  try {
    const [result] = await sql<{ maq_create: string }[]>`
      SELECT maq_create(${aq});
    `;

    await createLog(actor, "create_maq", `aq: '${aq}'`);

    return {
      success: true,
      aq: result?.maq_create,
    };
  } catch (error) {
    console.error("Failed to create MAQ record:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to create MAQ record.",
    };
  }
}

/* DELETE MAQ */
export async function deleteMaq(actor: string, aq: string) {
  try {
    await sql`
      SELECT maq_delete(${aq});
    `;

    await createLog(actor, "delete_maq", `aq: '${aq}'`);

    return { success: true };
  } catch (error) {
    console.error("Failed to delete MAQ record:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to delete MAQ record.",
    };
  }
}

/** --- MAQ Cluster ---  **/

/* CREATE MAQ CLUSTER */
export async function createMaqCluster(actor: string, clusterName: string) {
  try {
    const [result] = await sql<{ maq_cluster_create: string }[]>`
      SELECT maq_cluster_create(${clusterName});
    `;

    await createLog(
      actor,
      "create_maq_cluster",
      `cluster_name: '${clusterName}'`,
    );

    return {
      success: true,
      clusterName: result?.maq_cluster_create,
    };
  } catch (error) {
    console.error("Failed to create MAQ cluster:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to create MAQ cluster.",
    };
  }
}

/* FETCH MAQ CLUSTERS (READ) */
export async function fetchMaqClusters(
  search: string | null = null,
  limit: number = 10,
  page: number = 1,
) {
  try {
    const offset = limit > 0 ? (page - 1) * limit : 0;

    const data = await sql<MaqClusterRecord[]>`
      SELECT * FROM maq_cluster_read(
        ${search || null},
        ${limit},
        ${offset}
                    );
    `;

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("Failed to fetch MAQ clusters:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to fetch MAQ clusters.",
      data: [],
    };
  }
}

/* FETCH MAQ CLUSTERS COUNT */
export async function fetchMaqClustersCount(search: string | null = null) {
  try {
    const [result] = await sql<{ maq_cluster_count: number }[]>`
      SELECT maq_cluster_count(${search || null});
    `;

    return {
      success: true,
      count: result?.maq_cluster_count ?? 0,
    };
  } catch (error) {
    console.error("Failed to fetch MAQ clusters count:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to count MAQ clusters.",
      count: 0,
    };
  }
}

/* FETCH MAQ CLUSTERS WITH ENTRIES (READ) */
export async function fetchMaqClustersWithEntries(
  search: string | null = null,
  sortBy: string = "cluster_name",
  sortDir: string = "ASC",
  limit: number = 10,
  page: number = 1,
) {
  try {
    const offset = limit > 0 ? (page - 1) * limit : 0;

    const data = await sql<MaqClusterWithEntriesRecord[]>`
      SELECT * FROM maq_cluster_with_entries_read(
        ${search || null},
        ${sortBy},
        ${sortDir},
        ${limit},
        ${offset}
                    );
    `;

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("Failed to fetch MAQ clusters with entries:", error);
    return {
      success: false,
      error:
        (error as Error).message ||
        "Failed to fetch MAQ clusters with entries.",
      data: [],
    };
  }
}

export async function deleteMaqCluster(actor: string, clusterName: string) {
  try {
    await sql`
      SELECT maq_cluster_delete(${clusterName});
    `;

    await createLog(
      actor,
      "delete_maq_cluster",
      `cluster_name: '${clusterName}'`,
    );

    return { success: true };
  } catch (error) {
    console.error("Failed to delete MAQ cluster:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to delete MAQ cluster.",
    };
  }
}

/** Cluster Entries **/

export async function syncMaqClusterEntries(
  actor: string,
  clusterName: string,
  aqs: string[],
) {
  try {
    await sql`
      SELECT maq_cluster_entries_sync(
               ${clusterName},
               ${aqs}::text[]
             );
    `;

    await createLog(
      actor,
      "sync_maq_cluster_entries",
      `cluster_name: '${clusterName}', count: ${aqs.length}`,
    );

    return { success: true };
  } catch (error) {
    console.error("Failed to sync MAQ cluster entries:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to sync cluster entries.",
    };
  }
}

/********
 * FCCE *
 ********/

export type ArchivedMode = "ACTIVE" | "ARCHIVED" | "BOTH";

export interface FcceInput {
  pscs_id: string;
  course_name: string;
  ay_sem?: string | null;
  pass?: boolean;
  archived?: boolean;
}

export interface FcceRecord {
  fcce_id: string;
  pscs_id: string;
  teacher_name: string;
  course_name: string;
  pass: boolean;
  ay_sem: string | null;
  created_at: string;
  archived: boolean;
}

/* FETCH FCCE RECORDS (READ) */
export async function fetchFcce(
  search: string | null = null,
  aySem: string = "ALL",
  archivedMode: ArchivedMode = "ACTIVE",
  sortBy: string = "created_at",
  sortDir: string = "DESC",
  limit: number = 10,
  page: number | string = 1,
) {
  try {
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const offset = limit > 0 ? (pageNum - 1) * limit : 0;

    const data = await sql<FcceRecord[]>`
      SELECT * FROM fcce_read(
        ${search || null},
        ${aySem},
        ${archivedMode},
        ${sortBy},
        ${sortDir},
        ${limit},
        ${offset}
      );
    `;

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("Failed to fetch FCCE records:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to fetch FCCE records.",
      data: [],
    };
  }
}

/* COUNT FCCE RECORDS */
export async function fetchFcceCount(
  search: string | null = null,
  aySem: string = "ALL",
  archivedMode: ArchivedMode = "ACTIVE",
) {
  try {
    const [result] = await sql<{ fcce_count: number }[]>`
      SELECT fcce_count(
                 ${search || null},
                 ${aySem},
                 ${archivedMode}
             );
    `;

    return {
      success: true,
      count: result?.fcce_count ?? 0,
    };
  } catch (error) {
    console.error("Failed to fetch FCCE count:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to count FCCE records.",
      count: 0,
    };
  }
}

/* CREATE FCCE RECORD */
export async function createFcce(actor: string, input: FcceInput) {
  try {
    const [result] = await sql<{ fcce_create: string }[]>`
      SELECT fcce_create(
                 ${input.pscs_id},
                 ${input.course_name},
                 ${input.ay_sem ?? null},
                 ${input.pass ?? false},
                 ${input.archived ?? false}
             );
    `;

    await createLog(
      actor,
      "create_fcce",
      `pscs_id: '${input.pscs_id}', course_name: '${input.course_name}', ay_sem: '${input.ay_sem ?? "N/A"}'`,
    );

    return {
      success: true,
      fcceId: result?.fcce_create,
    };
  } catch (error) {
    console.error("Failed to create FCCE record:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to create FCCE record.",
    };
  }
}

/* UPDATE FCCE RECORD */
export async function updateFcce(
  actor: string,
  fcceId: string,
  input: Partial<FcceInput>,
) {
  try {
    await sql`
      SELECT fcce_update(
                 ${fcceId}::UUID,
                 ${input.pscs_id ?? null},
                 ${input.course_name ?? null},
                 ${input.ay_sem ?? null},
                 ${input.pass ?? null},
                 ${input.archived ?? null}
             );
    `;

    await createLog(actor, "update_fcce", `fcce_id: '${fcceId}'`);

    return { success: true };
  } catch (error) {
    console.error("Failed to update FCCE record:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to update FCCE record.",
    };
  }
}

/* DELETE FCCE RECORD */
export async function deleteFcce(actor: string, fcceId: string) {
  try {
    await sql`
      SELECT fcce_delete(${fcceId}::UUID);
    `;

    await createLog(actor, "delete_fcce", `fcce_id: '${fcceId}'`);

    return { success: true };
  } catch (error) {
    console.error("Failed to delete FCCE record:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to delete FCCE record.",
    };
  }
}

/* ARCHIVE ALL ACTIVE FCCE RECORDS */
export async function archiveAllActiveFcce(actor: string) {
  try {
    const [result] = await sql<{ fcce_archive_all_active: number }[]>`
      SELECT fcce_archive_all_active();
    `;

    const count = result?.fcce_archive_all_active ?? 0;

    await createLog(
      actor,
      "archive_all_active_fcce",
      `archived ${count} record(s)`,
    );

    return {
      success: true,
      archivedCount: count,
    };
  } catch (error) {
    console.error("Failed to archive active FCCE records:", error);
    return {
      success: false,
      error:
        (error as Error).message || "Failed to archive active FCCE records.",
      archivedCount: 0,
    };
  }
}

/* FETCH UNMATCHED FCCE RECORDS (READ) */
export async function fetchFcceUnmatched(
  search: string | null = null,
  aySem: string = "ALL",
  archivedMode: ArchivedMode = "ACTIVE",
  sortBy: string = "created_at",
  sortDir: string = "DESC",
  limit: number = 10,
  page: number | string = 1,
) {
  try {
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const offset = limit > 0 ? (pageNum - 1) * limit : 0;

    const data = await sql<FcceRecord[]>`
      SELECT * FROM fcce_read_unmatched(
        ${search || null},
        ${aySem},
        ${archivedMode},
        ${sortBy},
        ${sortDir},
        ${limit},
        ${offset}
      );
    `;

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("Failed to fetch unmatched FCCE records:", error);
    return {
      success: false,
      error:
        (error as Error).message || "Failed to fetch unmatched FCCE records.",
      data: [],
    };
  }
}

/* COUNT UNMATCHED FCCE RECORDS */
export async function fetchFcceUnmatchedCount(
  search: string | null = null,
  aySem: string = "ALL",
  archivedMode: ArchivedMode = "ACTIVE",
) {
  try {
    const [result] = await sql<{ fcce_count_unmatched: number }[]>`
      SELECT fcce_count_unmatched(
                 ${search || null},
                 ${aySem},
                 ${archivedMode}
             );
    `;

    return {
      success: true,
      count: result?.fcce_count_unmatched ?? 0,
    };
  } catch (error) {
    console.error("Failed to count unmatched FCCE records:", error);
    return {
      success: false,
      error:
        (error as Error).message || "Failed to count unmatched FCCE records.",
      count: 0,
    };
  }
}

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
export async function seedDepartments(): Promise<boolean> {
  try {
    const [result] = await sql<{ seed_departments: boolean }[]>`
      SELECT seed_departments();
    `;

    return result?.seed_departments ?? false;
  } catch (error) {
    console.error("Failed to seed departments:", error);
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
      `description: '${description}' | day: '${dayOfWeek}' | start: '${startTime}' | end: '${endTime}'`,
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
      error: (error as Error).message,
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
  page?: number,
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

/** --- Departments Management --- **/

export interface DepartmentRecord {
  dept_name: string;
}

/* FETCH DEPARTMENTS (READ) */
export async function fetchDepartments(
  search: string | null = null,
  sortBy: string = "dept_name",
  sortDir: string = "ASC",
  limit: number = 10,
  page: number = 1,
) {
  try {
    const offset = limit > 0 ? (page - 1) * limit : 0;

    const data = await sql<DepartmentRecord[]>`
      SELECT * FROM departments_read(
        ${search || null},
        ${sortBy},
        ${sortDir},
        ${limit},
        ${offset}
      );
    `;

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("Failed to fetch departments:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to fetch departments.",
      data: [],
    };
  }
}

/* FETCH DEPARTMENTS COUNT */
export async function fetchDepartmentsCount(search: string | null = null) {
  try {
    const [result] = await sql<{ departments_count: number }[]>`
      SELECT departments_count(${search || null});
    `;

    return {
      success: true,
      count: result?.departments_count ?? 0,
    };
  } catch (error) {
    console.error("Failed to fetch departments count:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to count departments.",
      count: 0,
    };
  }
}

/* CREATE DEPARTMENT */
export async function createDepartment(actor: string, deptName: string) {
  try {
    const [result] = await sql<{ departments_create: string }[]>`
      SELECT departments_create(${deptName});
    `;

    await createLog(actor, "create_department", `dept_name: '${deptName}'`);

    return {
      success: true,
      deptName: result?.departments_create,
    };
  } catch (error) {
    console.error("Failed to create department:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to create department.",
    };
  }
}

/* UPDATE DEPARTMENT */
export async function updateDepartment(
  actor: string,
  oldDeptName: string,
  newDeptName: string,
) {
  try {
    const [result] = await sql<{ departments_update: string }[]>`
      SELECT departments_update(${oldDeptName}, ${newDeptName});
    `;

    await createLog(
      actor,
      "update_department",
      `old_dept_name: '${oldDeptName}' | new_dept_name: '${newDeptName}'`,
    );

    return {
      success: true,
      deptName: result?.departments_update,
    };
  } catch (error) {
    console.error("Failed to update department:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to update department.",
    };
  }
}

/* DELETE DEPARTMENT */
export async function deleteDepartment(actor: string, deptName: string) {
  try {
    await sql`
      SELECT departments_delete(${deptName});
    `;

    await createLog(actor, "delete_department", `dept_name: '${deptName}'`);

    return { success: true };
  } catch (error) {
    console.error("Failed to delete department:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to delete department.",
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
  page: number = 1,
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
      error:
        (error as Error).message ||
        "Failed to fetch users. Please try again later.",
    };
  }
}

// Create User
export async function createUser(
  actor: string,
  email: string,
  username?: string,
  roleName: string = "viewer",
) {
  try {
    const [result] = await sql<{ manage_users_create: string }[]>`
      SELECT manage_users_create(${email}, ${username ?? null}, ${roleName});
    `;

    await createLog(
      actor,
      "create_user",
      `email: '${email}' | role: '${roleName}'`,
    );

    return {
      success: true,
      userId: result?.manage_users_create,
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
  roleName: string,
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

export async function deleteUser(actor: string, userId: string) {
  try {
    await sql`
      SELECT manage_users_delete(${userId}::UUID);
    `;

    createLog(actor, "delete_user", `user_id: '${userId}'`);

    return { success: true };
  } catch (error) {
    console.error("Failed to delete user:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to delete user record.",
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
  page: number = 1,
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
  page: number = 1,
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
      blacklistId: result?.manage_blacklist_create,
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

/* FETCH LOGS COUNT */
export async function fetchLogsCount(search: string | null = null) {
  try {
    const [result] = await sql<{ logs_count: number }[]>`
      SELECT logs_count(${search || null});
    `;

    return {
      success: true,
      count: Number(result?.logs_count ?? 0),
    };
  } catch (error) {
    console.error("Failed to fetch logs count:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to count log records.",
      count: 0,
    };
  }
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
  details?: string | null,
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
