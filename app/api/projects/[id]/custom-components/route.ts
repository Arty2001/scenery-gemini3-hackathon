'use server';

import { NextRequest, NextResponse } from 'next/server';
import { listCustomComponents } from '@/lib/actions/custom-components';

/**
 * GET /api/projects/[id]/custom-components
 * Returns all custom HTML components for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
  }

  try {
    const components = await listCustomComponents(id);
    return NextResponse.json(components);
  } catch (error) {
    console.error('Failed to fetch custom components:', error);
    return NextResponse.json(
      { error: 'Failed to fetch custom components' },
      { status: 500 }
    );
  }
}
