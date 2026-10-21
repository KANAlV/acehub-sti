import SchedulesTeachersTable from "@/components/SchedulesTeachersTable";

interface PageProps {
  params: Promise<{
    schedule_name: string;
  }>;
}

export default async function ScheduleTeachersTableWrapper({ params }: PageProps) {
  const resolvedParams = await params;
  // Decode the URL-encoded parameter if necessary (e.g. spaces or special chars)
  const scheduleName = decodeURIComponent(resolvedParams.schedule_name);

  return (
    <main className="p-6">
      <SchedulesTeachersTable scheduleName={scheduleName} />
    </main>
  );
}
