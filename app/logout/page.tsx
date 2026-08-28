"use client";

import { useEffect } from "react";
import { useMsal } from "@azure/msal-react";

export default function AutoLogoutPage() {
  const { instance, accounts } = useMsal();

  useEffect(() => {
    const performAutoLogout = async () => {
      try {
        if (accounts.length > 0) {
          await instance.logoutRedirect({
            account: accounts[0],
            onRedirectNavigate: () => false, // Prevents MSAL from redirecting to Microsoft's sign-out portal
          });
        }
      } catch (error) {
        console.error("Local logout failed:", error);
      } finally {
        // Clear all storage and force state reset
        sessionStorage.clear();
        localStorage.clear();
        window.location.href = "/";
      }
    };

    performAutoLogout();
  }, [instance, accounts]);

  return null; // Render nothing since logout handles immediate redirection
}