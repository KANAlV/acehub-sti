"use client"

import { useEffect } from "react";
import TeacherSchedule from "@/components/dashboard/TeacherSchedule";

export default function UserPage() {

  useEffect(() => {
    document.title = "AceHub | Personal Schedule"
  }, []);

  return(
    <TeacherSchedule />
  );
}