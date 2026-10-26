"use client";

import { useEffect, useState } from "react";
import { fetchUserRole } from "@/app/actions/user";
import ScheduleDashboard from "@/components/dashboard/ScheduleDashboard";
import TeacherSchedule from "@/components/TeacherSchedule";
import { Spinner } from "flowbite-react";

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

export default function Dashboard() {

  const [isLoading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);

  async function fetchRole() {
    const res = await fetchUserRole("");

    if (res.success && res.data) {
      setPermissions({
        booking: Boolean(res.data.booking),
        personal_schedule: Boolean(res.data.personal_schedule),
        academic_qualification: Boolean(res.data.academic_qualification),
        schedules: Boolean(res.data.schedules),
        courses: Boolean(res.data.courses),
        rooms: Boolean(res.data.rooms),
        subjects: Boolean(res.data.subjects),
        teachers: Boolean(res.data.teachers),
        maq: Boolean(res.data.maq),
        fcce: Boolean(res.data.fcce),
        help: Boolean(res.data.help),
        config: Boolean(res.data.config),
        superuser: Boolean(res.data.superuser),
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    void fetchRole()
  }, []);

  if (isLoading) {
    return(
      <div className={"flex h-full items-center justify-center"}>
        <div className={"text-center space-y-6"}>
          <Spinner />
          <div>Loading Dashboard...</div>
        </div>
      </div>
    );
  } else if (!permissions?.schedules && permissions?.personal_schedule) {
    return <TeacherSchedule />;
  } else {
    return <ScheduleDashboard />;
  }
}