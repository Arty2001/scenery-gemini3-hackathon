import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const supabase = await createClient()

  // Demo projects have no DB-backed discovery status
  if (projectId.startsWith('demo-')) {
    return NextResponse.json({ status: 'complete', total: 0, categorized: 0, withPreview: 0 })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ status: 'error' }, { status: 401 })
  }

  const { data: repo } = await supabase
    .from('repository_connections')
    .select('id')
    .eq('project_id', projectId)
    .single()

  if (!repo) {
    return NextResponse.json({ status: 'no_repo' })
  }

  // Count total components (shell records exist as soon as scan completes)
  const { count } = await supabase
    .from('discovered_components')
    .select('*', { count: 'exact', head: true })
    .eq('repository_id', repo.id)

  // Count components with category set (categorize + demo props done)
  const { count: categorizedCount } = await supabase
    .from('discovered_components')
    .select('*', { count: 'exact', head: true })
    .eq('repository_id', repo.id)
    .not('category', 'is', null)

  // Count components with preview_html (preview generation done)
  const { count: previewCount } = await supabase
    .from('discovered_components')
    .select('*', { count: 'exact', head: true })
    .eq('repository_id', repo.id)
    .not('preview_html', 'is', null)

  const total = count ?? 0
  const categorized = categorizedCount ?? 0
  const withPreview = previewCount ?? 0

  if (total === 0) {
    return NextResponse.json({ status: 'pending', total: 0, categorized: 0, withPreview: 0 })
  }

  if (withPreview < total) {
    return NextResponse.json({ status: 'in_progress', total, categorized, withPreview })
  }

  return NextResponse.json({ status: 'complete', total, categorized, withPreview })
}
