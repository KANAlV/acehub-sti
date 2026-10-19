import SummaryDisplay from "@/components/SummaryDisplay";

interface PageProps {
  params: Promise<{
    schedule_name: string;
  }>;
}

export default async function ScheduleSummaryWrapper({ params }: PageProps) {
  const resolvedParams = await params;
  // Decode the URL-encoded parameter if necessary (e.g. spaces or special chars)
  const scheduleName = decodeURIComponent(resolvedParams.schedule_name);

  return (
    <main className="p-6">
      <SummaryDisplay scheduleName={scheduleName} />
    </main>
  );
}
