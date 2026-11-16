import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/database";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get("user_email");

    if (!cookie?.value) {
      return NextResponse.json({ authenticated: false });
    }

    const email = cookie.value.trim().toLowerCase();

    // Check if user exists and is not blacklisted
    const [userResult] = await sql`
      SELECT * FROM user_get_role(${email});
    `;

    if (!userResult) {
      return NextResponse.json({ authenticated: false });
    }

    // Check blacklist status
    const [blacklistResult] = await sql`
      SELECT get_user_logoff_status(${email}) AS is_blacklisted;
    `;

    const isBlacklisted = blacklistResult?.is_blacklisted ?? false;

    return NextResponse.json({
      authenticated: true,
      email: email,
      blacklisted: isBlacklisted,
    });
  } catch (error) {
    console.error("Failed to check session:", error);
    return NextResponse.json(
      { error: "Failed to check session" },
      { status: 500 }
    );
  }
}
