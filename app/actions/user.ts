"use server";
import sql from "@/lib/database";
import { cookies } from "next/headers";

export interface AuthSyncResponse {
  authorized: boolean;
  roleName?: string;
  error?: string;
}

export async function authorizeAndSyncUser(
  email: string,
  fullName: string,
): Promise<AuthSyncResponse> {
  try {
    const trimmedEmail = email.trim().toLowerCase();

    // Wrap the composite function call in parentheses to pull the role_name attribute
    const [roleResult] = await sql<{ role_name: string }[]>`
      SELECT (user_get_role(${trimmedEmail})).role_name;
    `;

    const rawRoleName = roleResult?.role_name ?? "";
    const normalizedRoleName = rawRoleName.trim().toLowerCase();

    console.log(
      `[AUTH CHECK] Email: ${trimmedEmail} | Extracted Role: "${rawRoleName}"`,
    );

    // 1. Superuser Check (Bypasses Domain & "Student" Name Checks)
    const isSuperuser = normalizedRoleName === "superuser" || normalizedRoleName === "superadmin";

    if (!isSuperuser) {
      const isAllowedDomain = trimmedEmail.endsWith("@alabang.sti.edu.ph");
      const isStudent = fullName.toLowerCase().includes("student");

      // Reject non-superusers if wrong domain OR name contains "Student"
      if (!isAllowedDomain || isStudent) {
        return {
          authorized: false,
          roleName: rawRoleName || undefined,
        };
      }
    }

    // 2. Sync user to database
    await syncUserToDatabase(trimmedEmail, fullName);

    return {
      authorized: true,
      roleName: rawRoleName || undefined,
    };
  } catch (error) {
    console.error("Error during authorizeAndSyncUser:", error);
    return {
      authorized: false,
      error: (error as Error).message || "Authentication sync failed.",
    };
  }
}

export async function syncUserToDatabase(email: string, username: string) {
  try {
    await sql`
      CALL sp_add_or_update_user(${email}, ${username});
    `;

    console.log(
      "Synced user and verified role assignment successfully:",
      email,
    );
    return { success: true };
  } catch (error) {
    console.error("Database sync error:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function fetchUserRole(email: string) {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get("user_email");

    const Email = (email === ""? cookie!.value :email);

    const [userRole] = await sql`
      SELECT * FROM user_get_role(${Email});
    `;

    return {
      success: true,
      data: userRole ?? null,
    };
  } catch (error) {
    console.error("Database fetch error:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function fetchUserLogoffStatus(
  email: string
): Promise<{ success: boolean; logoff?: boolean; error?: string }> {
  try {
    if (!email || !email.trim()) {
      return { success: false, error: "Email parameter is required." };
    }

    const [result] = await sql<{ get_user_logoff_status: boolean }[]>`
      SELECT get_user_logoff_status(${email.trim()});
    `;

    return {
      success: true,
      logoff: result?.get_user_logoff_status ?? false,
    };
  } catch (error) {
    console.error("Failed to fetch logoff status:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to fetch logoff status.",
    };
  }
}

export async function fetchPscsIdByEmail(): Promise<{ success: boolean; pscs_id?: string; error?: string }> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get("user_email");

    const Email = cookie!.value;

    const result = await sql`
      SELECT get_pscs_id_by_email(${Email}) AS pscs_id;
    `;

    const row = (result as unknown as Record<string, unknown>[])[0];
    const pscsId = row?.pscs_id ? String(row.pscs_id) : undefined;

    if (!pscsId) {
      return { success: false, error: "No associated teacher record found for this email." };
    }

    return { success: true, pscs_id: pscsId };
  } catch (error) {
    console.error("Failed to fetch pscs_id by email:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to fetch pscs_id by email.",
    };
  }
}