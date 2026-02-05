import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Video } from 'lucide-react'

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Video className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">No projects yet</h3>
      <p className="text-muted-foreground mt-1 mb-4 max-w-sm">
        Create your first video project to start turning your React components into demos.
      </p>
      <Button asChild>
        <Link href="/protected/projects/new">Create project</Link>
      </Button>
    </div>
  )
}
