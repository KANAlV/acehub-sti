"use client";
import SubjectManagement from "@/components/subjects/SubjectManagement";
import { TabItem, Tabs } from "flowbite-react";
import { useState } from "react";
import {
  HiDocumentCheck,
  HiUsers,
} from "react-icons/hi2";
import SubjectAqManagement from "@/components/subjects/SubjectAqManagement";

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
            {activeTabKey === "subject aq" && <SubjectAqManagement />}
          </TabItem>
        </Tabs>
      </div>
  );
}