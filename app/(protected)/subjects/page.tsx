"use client";
import SubjectManagement from "@/components/subjects/SubjectManagement";
import SubjectCurriculumManagement from "@/components/subjects/SubjectCurriculumManagement";
import SubjectAqManagement from "@/components/subjects/SubjectAqManagement";
import { TabItem, Tabs } from "flowbite-react";
import { useEffect, useState } from "react";
import {
    HiDocumentCheck,
    HiUsers,
} from "react-icons/hi2";

export default function SubjectsPage() {
    const [activeTabKey, setActiveTabKey] = useState("subject curriculum");

    // Define statically so it's available on the first render, matching all 3 tabs in order
    const availableMainTabs = [
        "subject curriculum",
        "subject management",
        "subject aq",
    ];

    useEffect(() => {
        document.title = "AceHub | Subjects";
    }, []);

    return (
        <div className={"m-8"}>
            <h1 className={"text-xl font-bold mb-4"}>Subject</h1>

            <Tabs
                variant={"underline"}
                onActiveTabChange={(index) => {
                    if (availableMainTabs[index]) {
                        setActiveTabKey(availableMainTabs[index]);
                    }
                }}
            >
                <TabItem
                    title={"Subject Curriculum"}
                    active={activeTabKey === "subject curriculum"}
                    icon={HiUsers}
                >
                    {activeTabKey === "subject curriculum" && <SubjectCurriculumManagement />}
                </TabItem>

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