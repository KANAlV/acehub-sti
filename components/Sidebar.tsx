"use client";

import {
  Button,
  Sidebar,
  SidebarItemGroup,
  SidebarItems,
  Spinner,
  Toast,
  ToastToggle,
  Tooltip,
} from "flowbite-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { HiExclamation } from "react-icons/hi";
import {
  HiBookOpen,
  HiCalendar,
  HiChartPie,
  HiChevronDown,
  HiChevronUp,
  HiClipboardDocument,
  HiDocumentCheck,
  HiMiniAcademicCap,
  HiMiniBuildingLibrary,
  HiMiniBuildingOffice,
  HiMiniCog6Tooth,
  HiQuestionMarkCircle,
  HiUser,
  HiUsers,
} from "react-icons/hi2";
import {
  TbLayoutSidebarLeftCollapse,
  TbLayoutSidebarLeftExpand,
} from "react-icons/tb";
import Image from "next/image";
import { FaCubes } from "react-icons/fa6";
import { AccountInfo } from "@azure/msal-common";
import { fetchUserRole } from "@/app/actions/user";
import { VerifyBlacklistStatus } from "@/utils/verifyBlacklistStatus";
import { MdOutlineEditCalendar } from "react-icons/md";

interface SidebarFunctionProps {
  account: AccountInfo | null;
}

interface UserPermissions {
  booking: boolean;
  personal_schedule: boolean;
  academic_qualification: boolean;
  schedules: boolean;
  courses: boolean;
  rooms: boolean;
  subjects: boolean;
  teachers: boolean;
  maq: boolean;
  fcce: boolean;
  help: boolean;
  config: boolean;
  superuser: boolean;
}

export default function SidebarFunction({ account }: SidebarFunctionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const hasFetchedPermissions = useRef(false);

  const [collapsed, setCollapsed] = useState(false);
  const [dropdownCourses, setDropdownCourses] = useState(false);

  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Fetch permissions safely ONCE when username changes
  useEffect(() => {
    if (!account?.username) {
      setLoading(false);
      return;
    }

    if (hasFetchedPermissions.current) return;
    hasFetchedPermissions.current = true;

    const username = account.username;

    async function loadPermissions() {
      try {
        const result = await fetchUserRole(username);
        if (result.success && result.data) {
          setPermissions({
            booking: Boolean(result.data.booking),
            personal_schedule: Boolean(result.data.personal_schedule),
            academic_qualification: Boolean(result.data.academic_qualification),
            schedules: Boolean(result.data.schedules),
            courses: Boolean(result.data.courses),
            rooms: Boolean(result.data.rooms),
            subjects: Boolean(result.data.subjects),
            teachers: Boolean(result.data.teachers),
            maq: Boolean(result.data.maq),
            fcce: Boolean(result.data.fcce),
            help: Boolean(result.data.help),
            config: Boolean(result.data.config),
            superuser: Boolean(result.data.superuser),
          });
        } else {
          setToastMessage(result?.error ?? "Failed to fetch permissions");
          setShowToast(true);
        }
      } catch (error) {
        console.error("Permission fetch error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadPermissions();
  }, [account?.username]);

  /** --- Blacklist Checker --- **/
  useEffect(() => {
    if (account?.username) {
      VerifyBlacklistStatus(account.username);
    }
  }, [account?.username, pathname]);

  function closeToast() {
    setShowToast(false);
    setToastMessage("");
  }

  return (
    <>
      {/* --- Loading Spinner --- */}
      <div
        className={`${loading ? "" : "hidden"} absolute z-50 flex h-[calc(100vh-64px)] w-full columns-1 flex-col items-center justify-center bg-white dark:bg-gray-900`}
      >
        <Spinner className={"mb-2"} /> <span>Loading sidebar items...</span>
      </div>

      {/* --- Toast --- */}
      {showToast && (
        <div className="fixed right-5 bottom-5 z-50 rounded-lg border border-gray-500/30">
          <Toast>
            <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-500 dark:bg-red-800 dark:text-red-200">
              <HiExclamation className="h-5 w-5" />
            </div>
            <div className="ml-3 text-sm font-normal">{toastMessage}</div>
            <ToastToggle onDismiss={() => closeToast()} />
          </Toast>
        </div>
      )}

      <Sidebar
        className={`fixed top-17 bottom-0 left-0 z-20 h-[calc(100vh-64px)] scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent border-r border-gray-200 bg-gray-200 shadow-lg shadow-gray-400/60 transition-[width] duration-300 ease-in-out md:static md:z-0 md:h-full dark:scrollbar-thumb-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-white [&>div]:flex [&>div]:h-full [&>div]:flex-col ${collapsed ? "w-16" : "w-64"}`}
        aria-label="Sidebar"
      >
        <SidebarItems className="flex flex-1 flex-col justify-between">
          <SidebarItemGroup>
            <div className="w-full md:hidden">
              {!collapsed ? (
                <Button
                  outline
                  color="alternative"
                  onClick={() => setCollapsed(!collapsed)}
                  className="w-full cursor-pointer justify-center p-2 text-gray-500 hover:bg-gray-500/20"
                >
                  <TbLayoutSidebarLeftCollapse className="h-6 w-6 shrink-0" />
                  <span className="ml-2">Collapse Sidebar</span>
                </Button>
              ) : (
                <Tooltip
                  content="Expand Sidebar"
                  placement="right"
                  className="w-full px-2"
                >
                  <Button
                    outline
                    color="alternative"
                    onClick={() => setCollapsed(!collapsed)}
                    className="w-full cursor-pointer justify-center p-2 hover:bg-gray-500/20"
                  >
                    <TbLayoutSidebarLeftExpand className="h-6 w-6 shrink-0" />
                  </Button>
                </Tooltip>
              )}
            </div>

            {/* Sidebar navigation items rendered based on permissions */}
            {!collapsed ? (
              <>
                <Button
                  outline
                  color="alternative"
                  onClick={() => router.push("/dashboard")}
                  className="w-full cursor-pointer justify-start hover:bg-gray-500/20"
                >
                  <HiChartPie className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                  <span className="ml-2">Dashboard</span>
                </Button>

                <Button
                  outline
                  color="alternative"
                  onClick={() => router.push(`/user`)}
                  className={`w-full cursor-pointer justify-start hover:bg-gray-500/20 ${permissions?.personal_schedule ? "" : "hidden"}`}
                >
                  <HiUser className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                  <span className="ml-2">Personal Info</span>
                </Button>

                <Button
                  outline
                  color="alternative"
                  onClick={() => router.push(`/booking`)}
                  className={`w-full cursor-pointer justify-start hover:bg-gray-500/20 ${permissions?.booking ? "" : "hidden"}`}
                >
                  <MdOutlineEditCalendar className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                  <span className="ml-2">Booking</span>
                </Button>

                <Button
                  outline
                  color="alternative"
                  onClick={() => router.push("/schedules")}
                  className={`w-full cursor-pointer justify-start hover:bg-gray-500/20 ${permissions?.schedules ? "" : "hidden"}`}
                >
                  <HiCalendar className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                  <span className="ml-2">Schedules</span>
                </Button>

                <Button
                  outline
                  color="alternative"
                  onClick={() => setDropdownCourses(!dropdownCourses)}
                  className={`w-full cursor-pointer justify-start hover:bg-gray-500/20 ${permissions?.courses ? "" : "hidden"}`}
                >
                  <FaCubes className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                  <div className="ml-2 flex w-full items-center justify-between">
                    <span>Courses</span>
                    {dropdownCourses ? <HiChevronUp className="h-4 w-4" /> : <HiChevronDown className="h-4 w-4" />}
                  </div>
                </Button>

                <div className={`flex flex-col ${dropdownCourses ? "block" : "hidden"} ml-4 justify-start`}>
                  <Button
                    outline
                    color="alternative"
                    onClick={() => router.push("/courses/shs")}
                    className="w-full cursor-pointer justify-start hover:bg-gray-500/20"
                  >
                    <HiMiniAcademicCap className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                    <span className="ml-2">SHS</span>
                  </Button>
                  <Button
                    outline
                    color="alternative"
                    onClick={() => router.push("/courses/tertiary")}
                    className="w-full cursor-pointer justify-start hover:bg-gray-500/20"
                  >
                    <HiMiniBuildingLibrary className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                    <span className="ml-2">Tertiary</span>
                  </Button>
                </div>

                <Button
                  outline
                  color="alternative"
                  onClick={() => router.push("/rooms")}
                  className={`w-full cursor-pointer justify-start hover:bg-gray-500/20 ${permissions?.rooms ? "" : "hidden"}`}
                >
                  <HiMiniBuildingOffice className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                  <span className="ml-2">Rooms</span>
                </Button>

                <Button
                  outline
                  color="alternative"
                  onClick={() => router.push("/subjects")}
                  className={`w-full cursor-pointer justify-start hover:bg-gray-500/20 ${permissions?.subjects ? "" : "hidden"}`}
                >
                  <HiBookOpen className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                  <span className="ml-2">Subjects</span>
                </Button>

                <Button
                  outline
                  color="alternative"
                  onClick={() => router.push("/teachers")}
                  className={`w-full cursor-pointer justify-start hover:bg-gray-500/20 ${permissions?.teachers ? "" : "hidden"}`}
                >
                  <HiUsers className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                  <span className="ml-2">Teachers</span>
                </Button>

                <Button
                  outline
                  color="alternative"
                  onClick={() => router.push("/maq")}
                  className={`w-full cursor-pointer justify-start hover:bg-gray-500/20 ${permissions?.maq ? "" : "hidden"}`}
                >
                  <HiDocumentCheck className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                  <span className="ml-2">MAQ</span>
                </Button>

                <Button
                  outline
                  color="alternative"
                  onClick={() => router.push("/fcce")}
                  className={`w-full cursor-pointer justify-start hover:bg-gray-500/20 ${permissions?.fcce ? "" : "hidden"}`}
                >
                  <HiClipboardDocument className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                  <span className="ml-2">FCCE</span>
                </Button>
              </>
            ) : (
              /* Collapsed View Shortcuts */
              <>
                <Tooltip content={"Dashboard"} placement={"right"}>
                  <Button outline color="alternative" onClick={() => router.push("/dashboard")} className="w-full cursor-pointer justify-center p-2 hover:bg-gray-500/20">
                    <HiChartPie className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                  </Button>
                </Tooltip>
              </>
            )}
          </SidebarItemGroup>

          <SidebarItemGroup>
            <Button
              outline
              color="alternative"
              onClick={() => router.push("/help")}
              className={`w-full cursor-pointer justify-start hover:bg-gray-500/20 ${permissions?.help ? "" : "hidden"}`}
            >
              <HiQuestionMarkCircle className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
              {!collapsed && <span className="ml-2">Help</span>}
            </Button>
            <Button
              outline
              color="alternative"
              onClick={() => router.push("/configurations")}
              className={`w-full cursor-pointer justify-start hover:bg-gray-500/20 ${permissions?.config || permissions?.superuser ? "" : "hidden"}`}
            >
              <HiMiniCog6Tooth className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
              {!collapsed && <span className="ml-2">Configurations</span>}
            </Button>
          </SidebarItemGroup>

          <SidebarItemGroup>
            <div className="flex w-full justify-center border-b border-gray-200 pb-4 dark:border-gray-700">
              <Image src={"/sti_logo.png"} alt={"STI Alabang Logo"} width={collapsed ? 40 : 60} height={collapsed ? 40 : 60} />
            </div>
            <Button
              outline
              color="alternative"
              onClick={() => setCollapsed(!collapsed)}
              className="hidden w-full cursor-pointer justify-center text-gray-500 hover:bg-gray-500/20 md:flex"
            >
              {!collapsed ? (
                <>
                  <TbLayoutSidebarLeftCollapse className="h-6 w-6 shrink-0" />
                  <span className="ml-2">Collapse Sidebar</span>
                </>
              ) : (
                <TbLayoutSidebarLeftExpand className="h-6 w-6 shrink-0" />
              )}
            </Button>
          </SidebarItemGroup>
        </SidebarItems>
      </Sidebar>
    </>
  );
}