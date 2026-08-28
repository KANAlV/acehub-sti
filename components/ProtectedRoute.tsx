"use client";

import { useMsal } from "@azure/msal-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { accounts, inProgress } = useMsal();
  const router = useRouter();

  useEffect(() => {
    // ONLY redirect to /login if MSAL has finished processing everything AND accounts are empty
    if (inProgress === "none" && accounts.length === 0) {
      router.push("/login");
    }
  }, [accounts, inProgress, router]);

  // Show nothing while MSAL is resolving credentials
  if (inProgress !== "none" || accounts.length === 0) {
    return null;
  }

  return <>{children}</>;
}
