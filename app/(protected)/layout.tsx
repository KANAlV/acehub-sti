"use client"
import ProtectedRoute from "@/components/ProtectedRoute";
import "@/app/globals.css";
import SidebarFunction from "@/components/Sidebar";
import { useMsal } from "@azure/msal-react";
import { NavigationBar } from "@/components/NavigationBar";
import { msalInstance } from "@/lib/msal";
import { useEffect } from "react";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];

  useEffect(() => {
    // Check for an active MSAL account on client mount
    const account = msalInstance.getActiveAccount();
    if (account && !document.cookie.includes("user_email=")) {
      const maxAge = 60 * 60 * 24; // 1 day in seconds
      document.cookie = `user_email=${encodeURIComponent(account.username)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    }
  }, []);

  return (
    <div className="flex h-dvh w-dvw flex-col overflow-hidden dark:bg-gray-900 dark:text-white">
      <NavigationBar account={activeAccount} />

      <div className="flex min-h-0 w-full flex-1 overflow-hidden">
        <SidebarFunction account={activeAccount} />

        <ProtectedRoute>
          <main className="h-full flex-1 overflow-auto border-l border-t dark:border-gray-700 shadow-md border-gray-200 shadow-gray-400/30">{children}</main>
        </ProtectedRoute>
      </div>
    </div>
  );
}