"use client";

import { useEffect } from "react";
import { useMsal } from "@azure/msal-react";

export default function AutoLogoutPage() {
  const { instance, accounts } = useMsal();

  useEffect(() => {
    const handleLogout = async () => {
      try {
        // Clear httpOnly session cookie
        await fetch("/api/logout", { method: "POST" });

        // Logout from MSAL
        if (accounts.length > 0) {
          await instance.logoutPopup({
            account: accounts[0],
            postLogoutRedirectUri: "/",
          });
        }
      } catch (error) {
        console.error("Logout failed:", error);
      } finally {
        window.location.href = "/";
      }
    };

    handleLogout();
  }, [instance, accounts]);

  return null; // Render nothing since logout handles immediate redirection
}