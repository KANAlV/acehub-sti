import SchedulesTeacherPage from "@/components/SchedulesTeacherPage";

export interface TeacherPageProps {
  params: Promise<{
    pscs_id: string;
  }>;
}

export default async function ScheduleTeacherPageWrapper({ params }: TeacherPageProps) {
  const resolvedParams = await params;
  // Decode the URL-encoded parameter if necessary (e.g. spaces or special chars)
  const pscsID = decodeURIComponent(resolvedParams.pscs_id);

  return (
    <main className="p-6">
      <SchedulesTeacherPage pscs_id={pscsID} />
    </main>
  );
}
