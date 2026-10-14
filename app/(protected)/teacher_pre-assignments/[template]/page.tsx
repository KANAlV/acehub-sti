import TeacherPreassignmentManagement from "@/components/TeacherPreassignmentManagement";

interface PageProps {
  params: Promise<{
    template: string;
  }>;
}

export default async function TeacherTemplatePage({ params }: PageProps) {
  const resolvedParams = await params;
  // Decode the URL-encoded template name if necessary
  const preassignmentName = decodeURIComponent(resolvedParams.template);

  return (
    <main className="p-6">
      <TeacherPreassignmentManagement preassignmentName={preassignmentName} />
    </main>
  );
}
