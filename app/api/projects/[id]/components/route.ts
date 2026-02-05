import { NextRequest, NextResponse } from 'next/server'
import { getProjectComponents } from '@/lib/actions/components'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const components = await getProjectComponents(projectId)

  // Debug: Log components with interactive elements
  const withInteractive = components.filter(c => c.interactiveElements && c.interactiveElements.length > 0)
  console.log(`[API /components] Returning ${components.length} components, ${withInteractive.length} have interactive elements`)
  if (withInteractive.length > 0) {
    withInteractive.forEach(c => {
      console.log(`[API /components] - ${c.componentName}: ${c.interactiveElements?.length} elements`)
    })
  }

  return NextResponse.json(components)
}
