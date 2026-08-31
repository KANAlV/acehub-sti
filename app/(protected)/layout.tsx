"use client"
import ProtectedRoute from "@/components/ProtectedRoute";
import "@/app/globals.css";
import SidebarFunction from "@/components/Sidebar";
import { useMsal } from "@azure/msal-react";
import { NavigationBar } from "@/components/NavigationBar";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];

  return (
    <div className="flex h-dvh w-dvw flex-col overflow-hidden dark:bg-gray-900 dark:text-white">
      <NavigationBar account={activeAccount} />

      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        <SidebarFunction account={activeAccount} />

        <ProtectedRoute>
          <main className="flex-1 overflow-auto h-full">
            {children}
          </main>
        </ProtectedRoute>
      </div>
    </div>
  );
}