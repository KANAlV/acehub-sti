import ScheduleTimetableClient from "@/components/ScheduleTimetable";

interface PageProps {
  params: Promise<{
    schedule_name: string;
  }>;
}

export default async function ScheduleTimetable({ params }: PageProps) {
  const resolvedParams = await params;
  // Decode the URL-encoded parameter if necessary (e.g. spaces or special chars)
  const scheduleName = decodeURIComponent(resolvedParams.schedule_name);

  return (
    <main className="p-6">
      <ScheduleTimetableClient scheduleName={scheduleName} />
    </main>
  );
}
