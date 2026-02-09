import { redirect } from 'next/navigation';
import { getProject } from '@/lib/actions/projects';
import { getOrCreateComposition } from '@/lib/actions/compositions';
import { isDemoProject } from '@/lib/demo-projects';
import { EditorClient } from './editor-client';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

// Force dynamic rendering to always fetch fresh composition data
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditorPage({ params }: PageProps) {
  const { id: projectId } = await params;

  const projectResult = await getProject(projectId);
  if (!projectResult.success || !projectResult.data) {
    redirect('/protected');
  }

  const project = projectResult.data;

  // Get or create composition
  const composition = await getOrCreateComposition(projectId);
  if (!composition) {
    redirect('/protected');
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href={`/protected/projects/${projectId}`}>
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back to project</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Video Editor</h1>
            <p className="text-xs text-muted-foreground">{project.name}</p>
          </div>
        </div>
      </header>
      <EditorClient composition={composition} isDemo={isDemoProject(projectId)} />
    </div>
  );
}
