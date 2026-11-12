import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body.email;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Invalid email" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    cookieStore.set("user_email", email, {
      path: "/",
      maxAge: 60 * 60 * 24, // 1 day
      httpOnly: false,
      sameSite: "lax",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to set user cookie:", error);
    return NextResponse.json(
      { error: "Failed to set cookie" },
      { status: 500 }
    );
  }
}
