import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/actions/projects';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log(`[API /projects/${id}] Fetching project...`);

  const result = await getProject(id);

  if (!result.success) {
    console.log(`[API /projects/${id}] Failed:`, result.error);
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  console.log(`[API /projects/${id}] Success - ai_model:`, result.data.ai_model);
  return NextResponse.json(result.data);
}
