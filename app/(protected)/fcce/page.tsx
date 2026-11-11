"use client";
import FcceManagement from "@/components/fcce/FcceManagement";
import FCCETermManagement from "@/components/fcce/FCCETermManagement";
import { TabItem, Tabs } from "flowbite-react";
import { useEffect, useState } from "react";
import { HiDocumentCheck, HiUsers } from "react-icons/hi2";

export default function FccePage() {
  const [activeTabKey, setActiveTabKey] = useState("fcce term management");

  const availableMainTabs = ["fcce term management", "fcce management"];

  useEffect(() => {
    document.title = "AceHub | FCCE";
  }, []);

  return (
    <div className={"m-8"}>
      <h1 className={"mb-4 text-xl font-bold"}>FCCE</h1>

      <Tabs
        variant={"underline"}
        onActiveTabChange={(index) => {
          if (availableMainTabs[index]) {
            setActiveTabKey(availableMainTabs[index]);
          }
        }}
      >
        <TabItem
          title={"FCCE Term Management"}
          active={activeTabKey === "fcce term management"}
          icon={HiUsers}
        >
          {activeTabKey === "fcce term management" && <FCCETermManagement />}
        </TabItem>

        <TabItem
          title={"FCCE Management"}
          active={activeTabKey === "fcce management"}
          icon={HiDocumentCheck}
        >
          {activeTabKey === "fcce management" && <FcceManagement />}
        </TabItem>
      </Tabs>
    </div>
  );
}
