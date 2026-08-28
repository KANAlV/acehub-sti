"use client"
import ProtectedRoute from "@/components/ProtectedRoute";
import "@/app/globals.css";
import SidebarFunction from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={"h-dvh w-dvw overflow-auto dark:bg-gray-900 dark:text-white"}
    >
      <SidebarFunction />
      <ProtectedRoute>{children}</ProtectedRoute>
    </div>
  );
}