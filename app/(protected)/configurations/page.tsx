"use client";

import { HiClipboardDocumentList, HiMiniCog6Tooth } from "react-icons/hi2";
import { Spinner, TabItem, Tabs, Toast, ToastToggle } from "flowbite-react";
import { FaCoffee, FaUsersCog, FaWeight } from "react-icons/fa";
import BreakPeriods from "@/components/configurations/BreakPeriods";
import { useEffect, useState } from "react";
import { FaAddressBook, FaBarsStaggered } from "react-icons/fa6";
import { useMsal } from "@azure/msal-react";
import { fetchUserRole } from "@/app/actions/user";
import { HiExclamation } from "react-icons/hi";
import FacultyLoad from "@/components/configurations/FacultyLoad";
import ClassSettings from "@/components/configurations/ClassSettings";
import { useRouter } from "next/navigation";
import RoomTypes from "@/components/configurations/RoomTypes";
import AuditLogs from "@/components/configurations/Logs";
import UsersManagement from "@/components/configurations/Users";
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
  const [activeTab, setActiveTab] = useState(0);
  const [usersActiveTab, setUsersActiveTab] = useState(0);

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

  useEffect(() => {
    // Evaluate initial tab selection and route guards based on permissions
    if (permissions !== null) {
      if (!permissions.config && !permissions.superuser) {
        console.log(
          `[Access Denied]: User '${username}' requested access to protected route, but lacks required permissions.`,
        );
        router.push("/unauthorized_access");
      } else if (!permissions.config && permissions.superuser) {
        setActiveTab(4); // Default to first available tab for super users
      }
    }
  }, [permissions, router, username]);

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
          onActiveTabChange={(tabIndex) => setActiveTab(tabIndex)}
        >
          {/* Tabs 0 - 3: Visible when permissions.config is true */}
          {permissions.config && (
            <TabItem
              active={activeTab === 0}
              title="Break Periods"
              icon={FaCoffee}
            >
              {activeTab === 0 && <BreakPeriods />}
            </TabItem>
          )}

          {permissions.config && (
            <TabItem
              active={activeTab === 1}
              title="Faculty Load"
              icon={FaWeight}
            >
              {activeTab === 1 && <FacultyLoad />}
            </TabItem>
          )}

          {permissions.config && (
            <TabItem
              active={activeTab === 2}
              title="Class Settings"
              icon={FaAddressBook}
            >
              {activeTab === 2 && (
                <div>
                  <ClassSettings />
                </div>
              )}
            </TabItem>
          )}

          {permissions.config && (
            <TabItem
              active={activeTab === 3}
              title="Room Types"
              icon={FaBarsStaggered}
            >
              {activeTab === 3 && <RoomTypes />}
            </TabItem>
          )}

          {/* Tabs 4 - 5: Visible when permissions.super is true */}
          {permissions.superuser && (
            <TabItem
              active={activeTab === 4}
              title="User Management"
              icon={FaUsersCog}
            >
              {activeTab === 4 && (
                <Tabs
                  aria-label="User Management Subtabs"
                  onActiveTabChange={(usersTabIndex) =>
                    setUsersActiveTab(usersTabIndex)
                  }
                >
                  <TabItem title="Users" icon={FaUsersCog}>
                    {usersActiveTab === 0 && <UsersManagementPage />}
                  </TabItem>
                  <TabItem title="Roles" icon={FaBarsStaggered}>
                    {usersActiveTab === 1 && <RolesManagement />}
                  </TabItem>
                  <TabItem title="Blacklist" icon={FaBarsStaggered}>
                    {usersActiveTab === 2 && <BlacklistManagement />}
                  </TabItem>
                </Tabs>
              )}
            </TabItem>
          )}

          {permissions.superuser && (
            <TabItem
              active={activeTab === 5}
              title="Logs"
              icon={HiClipboardDocumentList}
            >
              {activeTab === 5 && <AuditLogs />}
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