"use client";

import { HiMiniCog6Tooth } from "react-icons/hi2";
import {
  TabItem,
  Tabs,
  Toast,
  ToastToggle,
} from "flowbite-react";
import { FaCoffee, FaUsersCog, FaWeight } from "react-icons/fa";
import BreakPeriods from "@/components/configuration/BreakPeriods";
import { useEffect, useState } from "react";
import { FaAddressBook, FaBarsStaggered } from "react-icons/fa6";
import { useMsal } from "@azure/msal-react";
import { fetchUserRole } from "@/app/actions/user";
import { HiExclamation } from "react-icons/hi";
import FacultyLoad from "@/components/configuration/FacultyLoad";
import ClassSettings from "@/components/configuration/ClassSettings";

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
  super: boolean;
}

export default function Configuration() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];

  /** --- Fetch Roles --- **/
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  useEffect(() => {
    async function fetchPermissions() {
      if (!activeAccount?.username) return;

      const result = await fetchUserRole(activeAccount.username);

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
          super: Boolean(result.data.super),
        });
      } else {
        console.error("Failed to fetch permissions:", result.error);
        setToastMessage(result?.error ?? "An unexpected error occurred");
        setShowToast(true);
        setPermissions(null);
      }

      setLoading(false);
    }

    fetchPermissions();
  }, [activeAccount]);

  function closeToast() {
    setShowToast(false);
    setToastMessage("");
  }

  return (
    <>
      <div className={`w-full overflow-auto p-8`}>
        <h1 className={`mb-4 flex items-center text-2xl font-bold`}>
          <HiMiniCog6Tooth className={`mr-2`} />
          Configuration
        </h1>

        <Tabs
          aria-label="Default tabs"
          variant="underline"
          onActiveTabChange={(tabIndex) => setActiveTab(tabIndex)}
        >
          <TabItem active title="Break Periods" icon={FaCoffee}>
            {activeTab === 0 && <BreakPeriods />}
          </TabItem>

          <TabItem title="Faculty Load" icon={FaWeight}>
            {activeTab === 1 && <FacultyLoad />}
          </TabItem>

          <TabItem title="Class Settings" icon={FaAddressBook}>
            {activeTab === 2 && <div><ClassSettings /></div>}
          </TabItem>

          <TabItem title="Dropdown Values" icon={FaBarsStaggered}>
            {activeTab === 3 && <div>{/* DropdownValues component here */}</div>}
          </TabItem>

          <TabItem title="Users" icon={FaUsersCog}>
            {activeTab === 4 && <div>{/* Users component here */}</div>}
          </TabItem>
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