import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.set("user_email", "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to clear session cookie:", error);
    return NextResponse.json(
      { error: "Failed to clear session" },
      { status: 500 }
    );
  }
}
