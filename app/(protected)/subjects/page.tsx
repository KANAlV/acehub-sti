"use client";
import SubjectManagement from "@/components/subjects/SubjectManagement";
import { TabItem, Tabs } from "flowbite-react";
import { useState } from "react";
import {
  HiDocumentCheck,
  HiUsers,
} from "react-icons/hi2";

export default function SubjectsPage() {
  const [activeTabKey, setActiveTabKey] = useState("subject management");

  // Define statically so it's available on the first render
  const availableMainTabs = [
    "subject management",
    "subject aq",
  ];

  return (
      <div className={"m-8"}>
        <h1 className={"text-xl font-bold"}>Subject</h1>

        <Tabs
            variant={"underline"}
            onActiveTabChange={(index) => {
              if (availableMainTabs[index]) {
                setActiveTabKey(availableMainTabs[index]);
              }
            }}
        >
          <TabItem
              title={"Subject Management"}
              active={activeTabKey === "subject management"}
              icon={HiUsers}
          >
            {activeTabKey === "subject management" && <SubjectManagement />}
          </TabItem>

          <TabItem
              title={"Subject AQ"}
              active={activeTabKey === "subject aq"}
              icon={HiDocumentCheck}
          >
            {/* Replace with your Subject AQ component or content */}
            <div className="py-4">
              <p className="text-gray-500">Subject AQ content goes here.</p>
            </div>
          </TabItem>
        </Tabs>
      </div>
  );
}