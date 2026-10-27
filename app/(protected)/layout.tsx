"use client";

import "@/app/globals.css";
import { msalInstance } from "@/lib/msal";
import {
  Avatar,
  Button,
  Dropdown,
  DropdownHeader,
  DropdownItem,
  Navbar,
  NavbarBrand,
  Sidebar,
  SidebarItemGroup,
  SidebarItems,
  Spinner,
  Toast,
  ToastToggle,
  Tooltip,
  useThemeMode,
} from "flowbite-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { HiExclamation, HiLogout } from "react-icons/hi";
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
  HiMoon,
  HiQuestionMarkCircle,
  HiSun,
  HiUser,
  HiUsers,
} from "react-icons/hi2";
import {
  TbLayoutSidebarLeftCollapse,
  TbLayoutSidebarLeftExpand,
} from "react-icons/tb";
import Image from "next/image";
import { FaCubes } from "react-icons/fa6";
import { fetchUserRole } from "@/app/actions/user";
import { VerifyBlacklistStatus } from "@/utils/verifyBlacklistStatus";
import { MdOutlineEditCalendar } from "react-icons/md";
import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import ProtectedRoute from "@/components/ProtectedRoute";
import PermissionRedirect from "@/utils/PermissionRedirect";

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

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { instance, accounts } = useMsal();
  const account = instance.getActiveAccount() || accounts[0];

  const router = useRouter();
  const pathname = usePathname();
  const hasFetchedPermissions = useRef(false);

  const { mode, toggleMode } = useThemeMode();
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileCollapsed, setMobileCollapsed] = useState(true);
  const [dropdownCourses, setDropdownCourses] = useState(false);

  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [checkingPermission, setCheckingPermission] = useState(true);

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

    void loadPermissions();
  }, [account?.username]);

  /* --- Permission Check ---*/
  useEffect(() => {
    async function checkPerm() {
      if (permissions !== null) {
        PermissionRedirect(permissions);
        setCheckingPermission(false);
      }
    }

    void checkPerm();
  }, [permissions]);

  /** --- Blacklist Checker --- **/
  useEffect(() => {
    if (account?.username) {
      void VerifyBlacklistStatus(account.username);
    }
  }, [account?.username, pathname]);

  function closeToast() {
    setShowToast(false);
    setToastMessage("");
  }

  /* --- Navigation Bar Funcs --- */
  useEffect(() => {
    async function fetchProfilePicture() {
      if (!account) return;

      const request = {
        scopes: ["User.Read"],
        account: account,
      };

      try {
        const response = await instance.acquireTokenSilent(request);
        const graphResponse = await fetch(
          "https://graph.microsoft.com/v1.0/me/photo/$value",
          {
            headers: {
              Authorization: `Bearer ${response.accessToken}`,
            },
          },
        );

        if (graphResponse.ok) {
          const blob = await graphResponse.blob();
          const imageUrl = URL.createObjectURL(blob);
          setProfilePhoto(imageUrl);
        }
      } catch (error) {
        if (error instanceof InteractionRequiredAuthError) {
          instance.acquireTokenRedirect(request);
        } else {
          console.warn("User profile photo not found or unavailable:", error);
        }
      }
    }

    void fetchProfilePicture();
  }, [account, instance]);

  const userInitials = account?.name
    ? account.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
    : "U";

  useEffect(() => {
    const account = msalInstance.getActiveAccount();
    if (account && !document.cookie.includes("user_email=")) {
      const maxAge = 60 * 60 * 24;
      document.cookie = `user_email=${encodeURIComponent(account.username)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    }
  }, []);

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden dark:bg-gray-900 dark:text-white">
      <Navbar fluid className={"shrink-0 dark:bg-gray-800"}>
        {/* Mobile Sidebar Toggle */}
        <div className="md:hidden">
          {mobileCollapsed ? (
            <Button
              outline
              color="alternative"
              onClick={() => setMobileCollapsed(false)}
              className="cursor-pointer justify-center p-2 text-gray-500 hover:bg-gray-500/20"
            >
              <TbLayoutSidebarLeftExpand className="h-6 w-6 shrink-0" />
            </Button>
          ) : (
            <Button
              outline
              color="alternative"
              onClick={() => setMobileCollapsed(true)}
              className="cursor-pointer justify-center p-2 text-gray-500 hover:bg-gray-500/20"
            >
              <TbLayoutSidebarLeftCollapse className="h-6 w-6 shrink-0" />
            </Button>
          )}
        </div>

        <NavbarBrand
          onClick={() => {
            router.push("/");
          }}
          className="cursor-pointer"
        >
          <Image
            src="/acehub-logo.png"
            alt="Acehub Logo"
            width={32}
            height={32}
            className="mr-3 ml-1"
          />
          <span className="self-center text-xl font-semibold whitespace-nowrap dark:text-white">
            AceHub
          </span>
        </NavbarBrand>
        <div className="flex md:order-2">
          <Dropdown
            dismissOnClick={false}
            renderTrigger={() => (
              <button className="flex items-center gap-2 rounded-full bg-gray-500/20 p-1.5 pr-3 text-sm font-medium text-gray-900 hover:bg-gray-500/30 dark:text-white">
                <Avatar
                  img={profilePhoto || undefined}
                  placeholderInitials={!profilePhoto ? userInitials : undefined}
                  rounded
                  size="sm"
                />
                <HiChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>
            )}
          >
            <DropdownHeader>
              <span className="block text-sm font-semibold">
                {account?.name || "User"}
              </span>
              <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                {account?.username || "No email"}
              </span>
            </DropdownHeader>
            <DropdownItem onClick={toggleMode}>
              {mode === "light" ? (
                <HiSun className="mr-2 h-5 w-5 text-gray-500 dark:text-gray-400" />
              ) : (
                <HiMoon className="mr-2 h-5 w-5 text-gray-500 dark:text-gray-400" />
              )}
              Toggle Dark Mode
            </DropdownItem>
            <DropdownItem onClick={() => router.push("/logout")}>
              <HiLogout className="mr-2 h-5 w-5 shrink-0 text-gray-500 dark:text-gray-400" />
              Sign out
            </DropdownItem>
          </Dropdown>
        </div>
      </Navbar>

      <div className="relative flex min-h-0 w-full flex-1 overflow-hidden">
        {/* --- Loading Spinner --- */}
        <div
          className={`${loading ? "" : "hidden"} absolute inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-gray-900`}
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

        {/* Mobile Backdrop Overlay */}
        {!mobileCollapsed && (
          <div
            className="fixed inset-0 z-20 bg-transparent md:hidden"
            onClick={() => setMobileCollapsed(true)}
          />
        )}

        <Sidebar
          className={`absolute inset-y-0 left-0 z-30 h-full scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent transition-[width] duration-300 ease-in-out md:relative md:translate-x-0 dark:scrollbar-thumb-gray-600 dark:bg-gray-800 dark:text-white [&>div]:flex [&>div]:h-full [&>div]:flex-col ${
            collapsed ? "md:w-16" : "md:w-64"
          } ${mobileCollapsed ? "-translate-x-full md:translate-x-0" : "w-64 translate-x-0 shadow-2xl"}`}
          aria-label="Sidebar"
        >
          {/* Navigation Items (Stretches to fill remaining vertical space) */}
          <SidebarItems className="flex flex-1 flex-col justify-between">
            {/* Main Top Navigation */}
            <SidebarItemGroup>
              {
                /** Extended **/
                !collapsed ? (
                  <div>
                    <Button
                      outline
                      color="alternative"
                      onClick={() => router.push("/dashboard")}
                      className={`w-full cursor-pointer justify-start hover:bg-gray-500/20`}
                    >
                      <HiChartPie className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                      {!collapsed && <span className="ml-2">Dashboard</span>}
                    </Button>

                    <Button
                      outline
                      color="alternative"
                      onClick={() => router.push(`/user`)}
                      className={`w-full cursor-pointer justify-start hover:bg-gray-500/20 ${permissions?.personal_schedule && permissions.schedules ? "" : "hidden"}`}
                    >
                      <HiUser className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                      {!collapsed && (
                        <span className="ml-2">Personal Info</span>
                      )}
                    </Button>

                    <Button
                      outline
                      color="alternative"
                      onClick={() => router.push(`/room_reservation`)}
                      className={`w-full cursor-pointer justify-start hover:bg-gray-500/20 ${permissions?.booking ? "" : "hidden"}`}
                    >
                      <MdOutlineEditCalendar className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                      {!collapsed && (
                        <span className="ml-2">Room Reservation</span>
                      )}
                    </Button>

                    <Button
                      outline
                      color="alternative"
                      onClick={() => router.push("/schedules")}
                      className={`w-full cursor-pointer justify-start hover:bg-gray-500/20 ${permissions?.schedules ? "" : "hidden"}`}
                    >
                      <HiCalendar className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                      {!collapsed && <span className="ml-2">Schedules</span>}
                    </Button>

                    <Button //Dropdown Courses
                      outline
                      color="alternative"
                      onClick={() => setDropdownCourses(!dropdownCourses)}
                      className={`w-full cursor-pointer justify-start hover:bg-gray-500/20 ${collapsed && dropdownCourses ? "bg-gray-500/50" : ""} ${permissions?.courses ? "" : "hidden"}`}
                    >
                      <FaCubes className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                      {!collapsed && (
                        <div className="ml-2 flex w-full items-center justify-between">
                          <span>Courses</span>
                          {dropdownCourses ? (
                            <HiChevronUp className="h-4 w-4" />
                          ) : (
                            <HiChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      )}
                    </Button>

                    <div // Dropdown Courses Container
                      className={`flex flex-col ${dropdownCourses ? "block" : "hidden"} ${
                        collapsed
                          ? "justify-center border-y border-gray-200 dark:border-gray-700"
                          : "ml-4 justify-start"
                      } `}
                    >
                      <Button
                        outline
                        color="alternative"
                        onClick={() => router.push("/courses/shs")}
                        className={`w-full cursor-pointer hover:bg-gray-500/20 ${
                          collapsed ? "justify-center p-2" : "justify-start"
                        }`}
                      >
                        <HiMiniAcademicCap className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                        {!collapsed && <span className="ml-2">SHS</span>}
                      </Button>

                      <Button
                        outline
                        color="alternative"
                        onClick={() => router.push("/courses/tertiary")}
                        className={`w-full cursor-pointer hover:bg-gray-500/20 ${
                          collapsed ? "justify-center p-2" : "justify-start"
                        }`}
                      >
                        <HiMiniBuildingLibrary className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                        {!collapsed && <span className="ml-2">Tertiary</span>}
                      </Button>
                    </div>

                    <Button
                      outline
                      color="alternative"
                      onClick={() => router.push("/rooms")}
                      className={`w-full cursor-pointer justify-start hover:bg-gray-500/20 ${permissions?.rooms ? "" : "hidden"}`}
                    >
                      <HiMiniBuildingOffice className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                      {!collapsed && <span className="ml-2">Rooms</span>}
                    </Button>

                    <Button
                      outline
                      color="alternative"
                      onClick={() => router.push("/subjects")}
                      className={`w-full cursor-pointer justify-start hover:bg-gray-500/20 ${permissions?.subjects ? "" : "hidden"}`}
                    >
                      <HiBookOpen className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                      {!collapsed && <span className="ml-2">Subjects</span>}
                    </Button>

                    <Button
                      outline
                      color="alternative"
                      onClick={() => router.push("/teachers")}
                      className={`w-full cursor-pointer justify-start hover:bg-gray-500/20 ${permissions?.teachers ? "" : "hidden"}`}
                    >
                      <HiUsers className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                      {!collapsed && <span className="ml-2">Teachers</span>}
                    </Button>

                    <Button
                      outline
                      color="alternative"
                      onClick={() => router.push("/maq")}
                      className={`w-full cursor-pointer justify-start hover:bg-gray-500/20 ${permissions?.maq ? "" : "hidden"}`}
                    >
                      <HiDocumentCheck className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                      {!collapsed && <span className="ml-2">MAQ</span>}
                    </Button>

                    <Button
                      outline
                      color="alternative"
                      onClick={() => router.push("/fcce")}
                      className={`w-full cursor-pointer justify-start hover:bg-gray-500/20 ${permissions?.fcce ? "" : "hidden"}`}
                    >
                      <HiClipboardDocument className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                      {!collapsed && <span className="ml-2">FCCE</span>}
                    </Button>
                  </div>
                ) : (
                  /** Collapsed **/
                  <div>
                    <Tooltip content={"Dashboard"} placement={"right"}>
                      <Button
                        outline
                        color="alternative"
                        onClick={() => router.push("/dashboard")}
                        className={`w-full cursor-pointer justify-center p-2 hover:bg-gray-500/20`}
                      >
                        <HiChartPie className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                      </Button>
                    </Tooltip>

                    <Tooltip content={"Personal Info"} placement={"right"}>
                      <Button
                        outline
                        color="alternative"
                        onClick={() => router.push(`/user`)}
                        className={`w-full cursor-pointer justify-center p-2 hover:bg-gray-500/20 ${permissions?.personal_schedule && permissions.schedules ? "" : "hidden"}`}
                      >
                        <HiUser className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                      </Button>
                    </Tooltip>

                    <Tooltip content={"Room Reservation"} placement={"right"}>
                      <Button
                        outline
                        color="alternative"
                        onClick={() => router.push(`/room_reservation`)}
                        className={`w-full cursor-pointer justify-center p-2 hover:bg-gray-500/20 ${permissions?.booking ? "" : "hidden"}`}
                      >
                        <MdOutlineEditCalendar className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                      </Button>
                    </Tooltip>

                    <Tooltip content={"Schedules"} placement={"right"}>
                      <Button
                        outline
                        color="alternative"
                        onClick={() => router.push("/schedules")}
                        className={`w-full cursor-pointer justify-center p-2 hover:bg-gray-500/20 ${permissions?.schedules ? "" : "hidden"}`}
                      >
                        <HiCalendar className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                      </Button>
                    </Tooltip>

                    <Tooltip content={"Courses"} placement={"right"}>
                      <div
                        className={`${!dropdownCourses && "border-b"} border-t border-gray-200 dark:border-gray-700`}
                      >
                        <Button
                          outline
                          color="alternative"
                          onClick={() => setDropdownCourses(!dropdownCourses)}
                          className={`w-full cursor-pointer justify-center p-2 hover:bg-gray-500/20 ${permissions?.courses ? "" : "hidden"} `}
                        >
                          <FaCubes className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                          {!collapsed && (
                            <div className="ml-2 flex w-full items-center justify-between">
                              <span>Courses</span>
                              {dropdownCourses ? (
                                <HiChevronUp className="h-4 w-4" />
                              ) : (
                                <HiChevronDown className="h-4 w-4" />
                              )}
                            </div>
                          )}
                        </Button>
                      </div>
                    </Tooltip>

                    <div // Dropdown Courses Container
                      className={`flex flex-col ${dropdownCourses ? "block" : "hidden"} ${
                        collapsed
                          ? "justify-center border-b border-gray-200 dark:border-gray-700"
                          : "ml-4 justify-start"
                      } `}
                    >
                      <Tooltip content={"SHS"} placement={"right"}>
                        <Button
                          outline
                          color="alternative"
                          onClick={() => router.push("/courses/shs")}
                          className={`w-full cursor-pointer justify-center p-2 hover:bg-gray-500/20`}
                        >
                          <HiMiniAcademicCap className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                          {!collapsed && <span className="ml-2">SHS</span>}
                        </Button>
                      </Tooltip>

                      <Tooltip content={"Tertiary"} placement={"right"}>
                        <Button
                          outline
                          color="alternative"
                          onClick={() => router.push("/courses/tertiary")}
                          className={`w-full cursor-pointer justify-center p-2 hover:bg-gray-500/20`}
                        >
                          <HiMiniBuildingLibrary className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                        </Button>
                      </Tooltip>
                    </div>

                    <Tooltip content={"Rooms"} placement={"right"}>
                      <Button
                        outline
                        color="alternative"
                        onClick={() => router.push("/rooms")}
                        className={`w-full cursor-pointer justify-center p-2 hover:bg-gray-500/20 ${permissions?.rooms ? "" : "hidden"}`}
                      >
                        <HiMiniBuildingOffice className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                      </Button>
                    </Tooltip>

                    <Tooltip content={"Subjects"} placement={"right"}>
                      <Button
                        outline
                        color="alternative"
                        onClick={() => router.push("/subjects")}
                        className={`w-full cursor-pointer justify-center p-2 hover:bg-gray-500/20 ${permissions?.subjects ? "" : "hidden"}`}
                      >
                        <HiBookOpen className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                      </Button>
                    </Tooltip>

                    <Tooltip content={"Teachers"} placement={"right"}>
                      <Button
                        outline
                        color="alternative"
                        onClick={() => router.push("/teachers")}
                        className={`w-full cursor-pointer justify-center p-2 hover:bg-gray-500/20 ${permissions?.teachers ? "" : "hidden"}`}
                      >
                        <HiUsers className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                      </Button>
                    </Tooltip>

                    <Tooltip content={"MAQ"} placement={"right"}>
                      <Button
                        outline
                        color="alternative"
                        onClick={() => router.push("/maq")}
                        className={`w-full cursor-pointer justify-center p-2 hover:bg-gray-500/20 ${permissions?.maq ? "" : "hidden"}`}
                      >
                        <HiDocumentCheck className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                      </Button>
                    </Tooltip>

                    <Tooltip content={"FCCE"} placement={"right"}>
                      <Button
                        outline
                        color="alternative"
                        onClick={() => router.push("/fcce")}
                        className={`w-full cursor-pointer justify-center p-2 hover:bg-gray-500/20 ${permissions?.fcce ? "" : "hidden"}`}
                      >
                        <HiClipboardDocument className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                      </Button>
                    </Tooltip>
                  </div>
                )
              }
            </SidebarItemGroup>

            {/* Middle Group */}
            <SidebarItemGroup>
              {!collapsed ? (
                <>
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
                </>
              ) : (
                /** Collapsed View */
                <>
                  <Tooltip content={"Help"} placement={"right"}>
                    <Button
                      outline
                      color="alternative"
                      onClick={() => router.push("/help")}
                      className={`w-full cursor-pointer justify-center p-2 hover:bg-gray-500/20 ${permissions?.help ? "" : "hidden"}`}
                    >
                      <HiQuestionMarkCircle className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                    </Button>
                  </Tooltip>

                  <Tooltip content={"Configurations"} placement={"right"}>
                    <Button
                      outline
                      color="alternative"
                      onClick={() => router.push("/configurations")}
                      className={`w-full cursor-pointer justify-center p-2 hover:bg-gray-500/20 ${permissions?.config || permissions?.superuser ? "" : "hidden"}`}
                    >
                      <HiMiniCog6Tooth className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
                    </Button>
                  </Tooltip>
                </>
              )}
            </SidebarItemGroup>

            {/* Bottom Group */}
            <SidebarItemGroup>
              {!collapsed ? (
                <div
                  className={`flex w-full justify-center border-b border-gray-200 pb-4 dark:border-gray-700`}
                >
                  <Image
                    src={"/sti_logo.png"}
                    alt={"STI Alabang Logo"}
                    width={60}
                    height={60}
                  />
                </div>
              ) : (
                <div
                  className={`mb-8 w-full border-b border-gray-200 pb-4 sm:mb-0 dark:border-gray-700`}
                >
                  <Image
                    src={"/sti_logo.png"}
                    alt={"STI Alabang Logo"}
                    width={40}
                    height={40}
                  />
                </div>
              )}

              {/* PC Sidebar Toggle */}
              {!collapsed ? (
                <>
                  <Button
                    outline
                    color="alternative"
                    onClick={() => setCollapsed(!collapsed)}
                    className={`hidden w-full cursor-pointer justify-center text-gray-500 hover:bg-gray-500/20 md:flex`}
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
                </>
              ) : (
                <>
                  <Tooltip content={"Expand Sidebar"} placement={"right"}>
                    <Button
                      outline
                      color="alternative"
                      onClick={() => setCollapsed(!collapsed)}
                      className={`hidden w-full cursor-pointer justify-center p-2 hover:bg-gray-500/20 md:block`}
                    >
                      <TbLayoutSidebarLeftExpand className="h-6 w-6 shrink-0" />
                    </Button>
                  </Tooltip>
                </>
              )}
            </SidebarItemGroup>
          </SidebarItems>
        </Sidebar>

        <ProtectedRoute>
          <main className="relative flex h-full flex-1 flex-col overflow-auto border-t border-l border-gray-200 shadow-md shadow-gray-400/30 dark:border-gray-700">
            {checkingPermission ? (
              <div className="flex h-full w-full flex-col items-center justify-center bg-white/85 backdrop-blur-xs dark:bg-gray-900/85">
                <Spinner size="xl" />
                <div className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Checking user permission...
                </div>
              </div>
            ) : (
              children
            )}
          </main>
        </ProtectedRoute>
      </div>
    </div>
  );
}