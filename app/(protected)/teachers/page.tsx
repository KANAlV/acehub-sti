"use client";
import TeachersManagement from "@/components/teachers/TeachersManagement";
import { TabItem, Tabs } from "flowbite-react";
import { useState } from "react";
import {
  HiArrowDownOnSquareStack,
  HiDocumentCheck,
  HiUsers,
} from "react-icons/hi2";
import PreassignmentTemplatesManagement from "@/components/teachers/Preassignments";

export default function TeachersPage() {
  const [activeTabKey, setActiveTabKey] = useState("teachers management");

  const availableMainTabs = [
    "teachers management",
    "pre-assign subjects",
    "academic qualifications",
  ];

  return (
    <div className={"m-8"}>
      <h1 className={"text-xl font-bold"}>Teachers</h1>

      <Tabs
        variant={"underline"}
        onActiveTabChange={(index) => {
          if (availableMainTabs[index]) {
            setActiveTabKey(availableMainTabs[index]);
          }
        }}
      >
        <TabItem
          title={"Teachers Management"}
          active={activeTabKey === "teachers management"}
          icon={HiUsers}
        >
          {activeTabKey === "teachers management" && <TeachersManagement />}
        </TabItem>

        <TabItem
          title={"Pre-assign Subjects"}
          active={activeTabKey === "pre-assign subjects"}
          icon={HiArrowDownOnSquareStack}
        >
          {activeTabKey === "pre-assign subjects" && <PreassignmentTemplatesManagement />}
        </TabItem>

        <TabItem
          title={"Teacher AQ"}
          active={activeTabKey === "academic qualifications"}
          icon={HiDocumentCheck}
        >
          {/* Add your Teacher AQ component here */}
        </TabItem>
      </Tabs>
    </div>
  );
}
