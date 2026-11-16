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

      // 2. Check for accounts in memory (popup auth stores tokens in memory)
      const currentAccounts = msalInstance.getAllAccounts();
      if (currentAccounts.length > 0) {
        msalInstance.setActiveAccount(currentAccounts[0]);
      }

      // 3. Check httpOnly cookie session for page reload persistence
      try {
        const res = await fetch("/api/check-session");
        const data = await res.json();
        if (data.authenticated && data.email) {
          setSessionEmail(data.email);
          setSessionName(data.username || data.email.split("@")[0]);
        }
      } catch (error) {
        console.error("Error checking cookie session:", error);
      } finally {
        setSessionLoaded(true);
        setIsInitialized(true);
      }
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
