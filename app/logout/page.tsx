"use client";

import { useEffect } from "react";
import { useMsal } from "@azure/msal-react";

export default function AutoLogoutPage() {
  const { instance, accounts } = useMsal();

  useEffect(() => {
    const handleLogout = async () => {
      try {
        if (accounts.length > 0) {
          await instance.logoutRedirect({
            account: accounts[0],
            postLogoutRedirectUri: window.location.origin, // Returns directly to your site root
          });
        }
      } catch (error) {
        console.error("Local logout failed:", error);
      } finally {
        sessionStorage.clear();
        localStorage.clear();
        window.location.href = "/";
      }
    };

    handleLogout();
  }, [instance, accounts]);

  return null; // Render nothing since logout handles immediate redirection
}