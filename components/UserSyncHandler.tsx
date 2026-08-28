"use client";

import { useEffect, useRef } from "react";
import { useMsal } from "@azure/msal-react";
import { syncUserToDatabase } from "@/app/actions/user";

export default function UserSyncHandler() {
  const { instance, accounts } = useMsal();
  const hasSynced = useRef(false); // Prevents duplicate calls

  const activeAccount = instance.getActiveAccount() || accounts[0];

  useEffect(() => {
    if (activeAccount && !hasSynced.current) {
      hasSynced.current = true; // Mark as synced for current session

      const userData = {
        email: activeAccount.username,
        name: activeAccount.name || "",
        tenantId: activeAccount.tenantId,
      };

      // Send Microsoft account data to your server/DB
      syncUserToDatabase(userData);
    }
  }, [activeAccount]);

  return null; // Silent worker component
}
