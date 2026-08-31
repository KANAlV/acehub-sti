"use server";
import sql from "@/lib/database";

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
    const [userRole] = await sql`
      SELECT * FROM user_get_role(${email});
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