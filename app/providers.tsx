"use client";

import { useEffect, useState } from "react";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "@/lib/msal";
import { AuthenticationResult } from "@azure/msal-browser";

export function Providers({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      // 1. Initialize MSAL instance
      await msalInstance.initialize();

      // 2. Process incoming authentication response from Microsoft redirect
      try {
        const response: AuthenticationResult | null =
          await msalInstance.handleRedirectPromise();

        if (response && response.account) {
          msalInstance.setActiveAccount(response.account);

          // 3. Sync newly logged-in user to database via API or Server Action
          await fetch("/api/users/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: response.account.username,
              name: response.account.name || "",
              tenantId: response.account.tenantId,
            }),
          });
        } else {
          // Fallback to active/first account if already logged in
          const currentAccounts = msalInstance.getAllAccounts();
          if (currentAccounts.length > 0) {
            msalInstance.setActiveAccount(currentAccounts[0]);
          }
        }
      } catch (error) {
        console.error("Error processing MSAL redirect promise:", error);
      } finally {
        setIsInitialized(true);
      }
    };

    init();
  }, []);

  if (!isInitialized) {
    return null; // Don't render pages until auth state is completely resolved
  }

  return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
}
