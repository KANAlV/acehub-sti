"use client"

import { useEffect } from "react";

interface ScheduleTeacherProps {
  pscs_id: string;
};

export default function SchedulesTeacherPage({ pscs_id }: ScheduleTeacherProps) {
  // Run Functions After pscs Loads
  useEffect(() => {}, [pscs_id]);

  return <></>;
}