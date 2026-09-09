"use client";

import { useState } from "react";
import { TabItem, Tabs } from "flowbite-react";
import MaqClusterPage from "@/components/maq/MaqClusterPage";
import { FaCubes } from "react-icons/fa6";
import { HiClipboardList } from "react-icons/hi";
import MatrixOfAcademicQualificationPage from "@/components/maq/MatrixOfAcademicQulification";

// Define tab names outside the component so they don't reset on re-render
const AVAILABLE_MAIN_TABS = [
  "MAQ Clusters",
  "Matrix of Academic Qualifications",
];

export default function MaqPage() {
  const [activeTabKey, setActiveTabKey] = useState("MAQ Clusters");

  return (
    <div className="m-8">
      <h1 className="text-xl font-bold mb-4">Teachers</h1>

      <Tabs
        variant="underline"
        onActiveTabChange={(index) => {
          const selectedTab = AVAILABLE_MAIN_TABS[index];
          if (selectedTab) {
            setActiveTabKey(selectedTab);
          }
        }}
      >
        <TabItem
          title="MAQ Clusters"
          active={activeTabKey === "MAQ Clusters"}
          icon={FaCubes}
        >
          {activeTabKey === "MAQ Clusters" && <MaqClusterPage />}
        </TabItem>

        <TabItem
          title="Matrix of Academic Qualifications"
          active={activeTabKey === "Matrix of Academic Qualifications"}
          icon={HiClipboardList}
        >
          {activeTabKey === "Matrix of Academic Qualifications" && (
            <MatrixOfAcademicQualificationPage />
          )}
        </TabItem>
      </Tabs>
    </div>
  );
}