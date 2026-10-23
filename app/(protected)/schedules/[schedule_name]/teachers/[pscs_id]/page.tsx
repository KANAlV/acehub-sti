import SchedulesTeacherPage from "@/components/SchedulesTeacherPage";

export interface TeacherPageProps {
  params: Promise<{
    schedule_name: string;
    pscs_id: string;
  }>;
}

export default async function ScheduleTeacherPageWrapper({ params }: TeacherPageProps) {
  const resolvedParams = await params;
  // Decode the URL-encoded parameter if necessary (e.g. spaces or special chars)
  const scheduleName = decodeURIComponent(resolvedParams.schedule_name);
  const pscsID = decodeURIComponent(resolvedParams.pscs_id);

  return (
    <main className="p-6">
      <SchedulesTeacherPage schedule_name={scheduleName} pscs_id={pscsID} />
    </main>
  );
}
