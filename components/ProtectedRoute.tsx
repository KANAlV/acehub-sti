"use client";

import { useMsal } from "@azure/msal-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/app/providers";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { accounts, inProgress } = useMsal();
  const { sessionEmail, sessionLoaded } = useSession();
  const router = useRouter();
  const [hasCheckedSession, setHasCheckedSession] = useState(false);

  useEffect(() => {
    if (!sessionLoaded || !hasCheckedSession) return;
    setHasCheckedSession(true);

    // If MSAL has an account in memory, user is authenticated
    if (accounts.length > 0) return;

    // If MSAL memory is empty but cookie session exists, user is authenticated via cookie
    if (sessionEmail) return;

    // No MSAL account and no cookie session — redirect to login
    if (inProgress === "none") {
      router.push("/login");
    }
  }, [accounts, inProgress, sessionEmail, sessionLoaded, hasCheckedSession, router]);

  // Show nothing while MSAL is resolving credentials or session is loading
  if (inProgress !== "none" || !sessionLoaded) {
    return null;
  }

  // If no MSAL account but cookie session exists, render children (cookie-based session)
  if (accounts.length === 0 && sessionEmail) {
    return <>{children}</>;
  }

  // If no MSAL account and no cookie session, show nothing (will redirect to login)
  if (accounts.length === 0 && !sessionEmail) {
    return null;
  }

  return <>{children}</>;
}
