"use server";
import sql from "@/lib/database";

export async function syncUserToDatabase(userData: {
  email: string;
  name: string;
  tenantId?: string;
}) {
  try {
    const { email, name, tenantId } = userData;

    // TODO: Replace this with your actual database call
    // Example (Prisma/PostgreSQL):
    // const user = await db.user.upsert({
    //   where: { email },
    //   update: { name, tenantId },
    //   create: { email, name, tenantId },
    // });

    console.log("Synced user to DB successfully:", email);
    return { success: true };
  } catch (error) {
    console.error("Database sync error:", error);
    return { success: false, error };
  }
}
