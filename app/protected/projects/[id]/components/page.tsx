import { getProject } from '@/lib/actions/projects';
import { getProjectComponents } from '@/lib/actions/components';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, PackageOpen } from 'lucide-react';
import { ComponentsClient } from './components-client';

interface ComponentsPageProps {
  params: Promise<{ id: string }>;
}

export default async function ComponentsPage({ params }: ComponentsPageProps) {
  const { id } = await params;

  const [projectResult, components] = await Promise.all([
    getProject(id),
    getProjectComponents(id),
  ]);

  if (!projectResult.success || !projectResult.data) {
    notFound();
  }

  const project = projectResult.data;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-6 py-3 shrink-0">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href={`/protected/projects/${id}`}>
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back to project</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Component Library</h1>
            <p className="text-xs text-muted-foreground">{project.name}</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {components.length > 0 ? (
          <ComponentsClient components={components} projectId={id} />
        ) : (
          <EmptyState projectId={id} />
        )}
      </main>
    </div>
  );
}

/**
 * Empty state when no components have been discovered
 */
function EmptyState({ projectId }: { projectId: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <PackageOpen className="h-16 w-16 text-muted-foreground/50" />
      <h2 className="mt-6 text-xl font-semibold">No components discovered yet</h2>
      <p className="mt-2 max-w-md text-muted-foreground">
        Connect a repository and sync to discover React components in your codebase.
        Components will appear here once the discovery process completes.
      </p>
      <Button asChild className="mt-6">
        <Link href={`/protected/projects/${projectId}`}>
          Go to Project
        </Link>
      </Button>
    </div>
  );
}
