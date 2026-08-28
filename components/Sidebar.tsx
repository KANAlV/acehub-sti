import {
  Button,
  DarkThemeToggle,
  Sidebar,
  SidebarItem,
  SidebarItemGroup,
  SidebarItems,
} from "flowbite-react";
import { useRouter } from "next/navigation";
import { useMsal } from "@azure/msal-react";
import { useEffect, useState } from "react";
import { HiLogout } from "react-icons/hi";
import { HiCalendar, HiChartPie } from "react-icons/hi2";
import { TbLayoutSidebarLeftCollapse } from "react-icons/tb";
import Image from "next/image";

export default function SidebarFunction(){
  const router = useRouter();
  const { instance, accounts } = useMsal();
  const [ collapsed, setCollapsed ] = useState(false);

  useEffect(() => {}, [accounts]);

  return (
    <Sidebar
      className={`h-screen ${collapsed ? "w-16" : "w-64"} border-r border-gray-200 bg-gray-200 shadow-lg shadow-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white [&>div]:flex [&>div]:h-full [&>div]:flex-col`}
      aria-label="Sidebar"
    >
      {/* Header Section */}
      <div
        className={`${collapsed ? "justify-center" : "flex"} mb-2 items-center justify-between border-b-1 border-gray-200 pb-2 dark:border-gray-700`}
      >
        <div className="flex items-center">
          <Image
            src="/acehub-logo.png"
            alt="Acehub Logo"
            width={32}
            height={32}
            className={`${collapsed ? "mb-4 ml-1" : ""}`}
          />
          <h1 className={`${collapsed ? "hidden" : ""} ml-2 text-lg font-bold`}>
            Acehub
          </h1>
        </div>
        <DarkThemeToggle />
      </div>

      {/* Navigation Items (Stretches to fill remaining vertical space) */}
      <SidebarItems className="flex flex-1 flex-col justify-between">
        {/* Main Top Navigation */}
        <SidebarItemGroup>
          <Button
            outline
            color="alternative"
            onClick={() => router.push("/dashboard")}
            className={`w-full cursor-pointer text-gray-500 hover:bg-gray-500/20 ${
              collapsed ? "justify-center p-2" : "justify-start"
            }`}
          >
            <HiChartPie className="h-6 w-6 shrink-0" />
            {!collapsed && <span className="ml-2">Dashboard</span>}
          </Button>

          <Button
            outline
            color="alternative"
            onClick={() => router.push("/booking")}
            className={`w-full cursor-pointer text-gray-500 hover:bg-gray-500/20 ${
              collapsed ? "justify-center p-2" : "justify-start"
            }`}
          >
            <HiCalendar className="h-6 w-6 shrink-0" />
            {!collapsed && <span className="ml-2">Booking</span>}
          </Button>

          <Button
            outline
            color="alternative"
            onClick={() => router.push("/logout")}
            className={`w-full cursor-pointer text-gray-500 hover:bg-gray-500/20 ${
              collapsed ? "justify-center p-2" : "justify-start"
            }`}
          >
            <HiLogout className="h-6 w-6 shrink-0" />
            {!collapsed && <span className="ml-2">Logout</span>}
          </Button>
        </SidebarItemGroup>

        {/* Bottom Group */}
        <SidebarItemGroup>
          <Button
            outline
            color="alternative"
            onClick={() => setCollapsed(!collapsed)}
            className={`w-full cursor-pointer text-gray-500 hover:bg-gray-500/20 justify-center`}
          >
            <TbLayoutSidebarLeftCollapse className="h-6 w-6 shrink-0" />
            {!collapsed && <span className="ml-2">Collapse Sidebar</span>}
          </Button>
        </SidebarItemGroup>
      </SidebarItems>
    </Sidebar>
  );
}