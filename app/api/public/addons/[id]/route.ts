import { NextRequest, NextResponse } from 'next/server';
import { getOne, getAll } from '@/lib/db';

// GET - Get addon with options (public endpoint)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get addon details
    const addon = await getOne(
      'SELECT * FROM addons WHERE id = $1',
      [id]
    );

    if (!addon) {
      return NextResponse.json(
        { error: 'Add-on not found' },
        { status: 404 }
      );
    }

    // Get addon options
    const options = await getAll(
      'SELECT * FROM addon_options WHERE addon_id = $1 ORDER BY display_order, created_at',
      [id]
    );

    return NextResponse.json({
      success: true,
      ...addon,
      options: options || [],
    });
  } catch (error) {
    console.error('[v0] Get public addon error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch add-on' },
      { status: 500 }
    );
  }
}
