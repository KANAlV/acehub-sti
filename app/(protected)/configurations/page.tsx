"use client";

import { HiClipboardDocumentList, HiMiniCog6Tooth } from "react-icons/hi2";
import { Spinner, TabItem, Tabs, Toast, ToastToggle } from "flowbite-react";
import { FaCoffee, FaUsersCog, FaWeight } from "react-icons/fa";
import BreakPeriods from "@/components/configurations/BreakPeriods";
import { useEffect, useState } from "react";
import { FaAddressBook, FaBarsStaggered, FaUserSlash } from "react-icons/fa6";
import { useMsal } from "@azure/msal-react";
import { fetchUserRole } from "@/app/actions/user";
import { HiExclamation } from "react-icons/hi";
import FacultyLoad from "@/components/configurations/FacultyLoad";
import ClassSettings from "@/components/configurations/ClassSettings";
import { useRouter } from "next/navigation";
import RoomTypes from "@/components/configurations/RoomTypes";
import AuditLogs from "@/components/configurations/Logs";
import RolesManagement from "@/components/configurations/Roles";
import UsersManagementPage from "@/components/configurations/Users";
import BlacklistManagement from "@/components/configurations/Blacklist";

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

export default function Configuration() {
  const router = useRouter();
  const [pageLoading, setPageLoading] = useState(true);

  // Use explicit tab key string state instead of hardcoded numbers
  const [activeTabKey, setActiveTabKey] = useState<string>("");
  const [usersActiveTabKey, setUsersActiveTabKey] = useState<string>("users");

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];
  const username = activeAccount?.username;

  /** --- Fetch Roles --- **/
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  useEffect(() => {
    async function fetchPermissions() {
      if (!username) return;

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
        console.error("Failed to fetch permissions:", result.error);
        setToastMessage(result?.error ?? "An unexpected error occurred");
        setShowToast(true);
        setPermissions(null);
      }
      setPageLoading(false);
    }

    fetchPermissions();
  }, [username]);

  function closeToast() {
    setShowToast(false);
    setToastMessage("");
  }

  // Define tab keys dynamically based on active permissions
  const availableMainTabs: string[] = [];

  if (permissions?.config) {
    availableMainTabs.push(
      "break-periods",
      "faculty-load",
      "class-settings",
      "room-types",
    );
  }
  if (permissions?.superuser) {
    availableMainTabs.push("user-management", "logs");
  }

  useEffect(() => {
    if (permissions !== null) {
      if (!permissions.config && !permissions.superuser) {
        console.log(
          `[Access Denied]: User '${username}' requested access to protected route, but lacks required permissions.`,
        );
        router.push("/unauthorized_access");
      } else if (!activeTabKey && availableMainTabs.length > 0) {
        // Automatically default to the first available tab key
        setActiveTabKey(availableMainTabs[0]);
      }
    }
  }, [permissions, router, username, activeTabKey, availableMainTabs]);

  if (pageLoading || permissions === null) {
    return (
      <div className="flex h-full w-full columns-1 flex-col items-center justify-center bg-white dark:bg-gray-900">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <div className="w-full overflow-auto p-8">
        <h1 className="mb-4 flex items-center text-2xl font-bold">
          <HiMiniCog6Tooth className="mr-2" />
          Configuration
        </h1>

        <Tabs
          aria-label="Configuration Tabs"
          variant="underline"
          onActiveTabChange={(index) => {
            if (availableMainTabs[index]) {
              setActiveTabKey(availableMainTabs[index]);
            }
          }}
        >
          {/* Tabs: Visible when permissions.config is true */}
          {permissions.config && (
            <TabItem
              active={activeTabKey === "break-periods"}
              title="Break Periods"
              icon={FaCoffee}
            >
              {activeTabKey === "break-periods" && <BreakPeriods />}
            </TabItem>
          )}

          {permissions.config && (
            <TabItem
              active={activeTabKey === "faculty-load"}
              title="Faculty Load"
              icon={FaWeight}
            >
              {activeTabKey === "faculty-load" && <FacultyLoad />}
            </TabItem>
          )}

          {permissions.config && (
            <TabItem
              active={activeTabKey === "class-settings"}
              title="Class Settings"
              icon={FaAddressBook}
            >
              {activeTabKey === "class-settings" && (
                <div>
                  <ClassSettings />
                </div>
              )}
            </TabItem>
          )}

          {permissions.config && (
            <TabItem
              active={activeTabKey === "room-types"}
              title="Room Types"
              icon={FaBarsStaggered}
            >
              {activeTabKey === "room-types" && <RoomTypes />}
            </TabItem>
          )}

          {/* Tabs: Visible when permissions.superuser is true */}
          {permissions.superuser && (
            <TabItem
              active={activeTabKey === "user-management"}
              title="User Management"
              icon={FaUsersCog}
            >
              {activeTabKey === "user-management" && (
                <Tabs
                  aria-label="User Management Subtabs"
                  onActiveTabChange={(subIndex) => {
                    const subKeys = ["users", "roles", "blacklist"];
                    if (subKeys[subIndex])
                      setUsersActiveTabKey(subKeys[subIndex]);
                  }}
                >
                  <TabItem
                    active={usersActiveTabKey === "users"}
                    title="Users"
                    icon={FaUsersCog}
                  >
                    {usersActiveTabKey === "users" && <UsersManagementPage />}
                  </TabItem>
                  <TabItem
                    active={usersActiveTabKey === "roles"}
                    title="Roles"
                    icon={FaBarsStaggered}
                  >
                    {usersActiveTabKey === "roles" && <RolesManagement />}
                  </TabItem>
                  <TabItem
                    active={usersActiveTabKey === "blacklist"}
                    title="Blacklist"
                    icon={FaUserSlash}
                  >
                    {usersActiveTabKey === "blacklist" && (
                      <BlacklistManagement />
                    )}
                  </TabItem>
                </Tabs>
              )}
            </TabItem>
          )}

          {permissions.superuser && (
            <TabItem
              active={activeTabKey === "logs"}
              title="Logs"
              icon={HiClipboardDocumentList}
            >
              {activeTabKey === "logs" && <AuditLogs />}
            </TabItem>
          )}
        </Tabs>
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
    </>
  );
}