"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "@/lib/msal";

interface SessionContextType {
  sessionEmail: string | null;
  sessionName: string | null;
  sessionLoaded: boolean;
}

export const SessionContext = createContext<SessionContextType>({
  sessionEmail: null,
  sessionName: null,
  sessionLoaded: false,
});

export function useSession() {
  return useContext(SessionContext);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  useEffect(() => {
    const init = async () => {
      // 1. Initialize MSAL instance
      await msalInstance.initialize();

      // 2. Check httpOnly cookie session for page reload persistence (needed before MSAL account selection)
      let cookieEmail: string | null = null;
      let cookieUsername: string | null = null;
      try {
        const res = await fetch("/api/check-session");
        const data = await res.json();
        if (data.authenticated && data.email) {
          cookieEmail = data.email;
          cookieUsername = data.username || data.email.split("@")[0];
        }
      } catch (error) {
        console.error("Error checking cookie session:", error);
      }

      // 3. Check for accounts in memory (popup auth stores tokens in memory)
      // Match the cached account to the cookie email so we pick the correct user after reload
      const currentAccounts = msalInstance.getAllAccounts();
      if (currentAccounts.length > 0) {
        if (cookieEmail) {
          const matchingAccount = currentAccounts.find(
            (acc) => acc.username.toLowerCase() === cookieEmail.toLowerCase()
          );
          if (matchingAccount) {
            msalInstance.setActiveAccount(matchingAccount);
          } else {
            // Fallback to first account if no match found
            msalInstance.setActiveAccount(currentAccounts[0]);
          }
        } else {
          msalInstance.setActiveAccount(currentAccounts[0]);
        }
      }

      // 4. Set session context from cookie
      if (cookieEmail) {
        setSessionEmail(cookieEmail);
        setSessionName(cookieUsername || cookieEmail.split("@")[0]);
      }

      setSessionLoaded(true);
      setIsInitialized(true);
    };

    init();
  }, []);

  if (!isInitialized) {
    return null; // Don't render pages until auth state is completely resolved
  }

  return (
    <SessionContext.Provider value={{ sessionEmail, sessionName, sessionLoaded }}>
      <MsalProvider instance={msalInstance}>{children}</MsalProvider>
    </SessionContext.Provider>
  );
}
