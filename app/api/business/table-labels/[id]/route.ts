import { NextRequest, NextResponse } from 'next/server';
import { query, getOne } from '@/lib/db';
import { getActiveBusiness } from '@/lib/active-business';
import { getSchemaSupport, loadTableLabels } from '@/lib/delivery/storage';

/**
 * PATCH  /api/business/table-labels/[id]   Rename, enable or disable one label.
 * DELETE /api/business/table-labels/[id]   Remove one label.
 *
 * A rename is refused when it would collide with another label, because two
 * tables called "5" make a receipt meaningless. Disabling is the softer option
 * and keeps the label in the list for next weekend.
 */

export const runtime = 'nodejs';

const MAX_LABEL_LENGTH = 24;

function cleanLabel(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL_LENGTH);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const business = await getActiveBusiness();
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const support = await getSchemaSupport();
    if (!support.tableLabels) {
      return NextResponse.json(
        { error: 'Table labels need a one-time database update.', code: 'SCHEMA_MISSING' },
        { status: 503 },
      );
    }

    const { id } = await params;
    const existing = await getOne(
      'SELECT * FROM table_labels WHERE id = $1 AND business_id = $2',
      [id, business.id],
    );
    if (!existing) return NextResponse.json({ error: 'Label not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const updates: string[] = [];
    const values: any[] = [];

    if (body?.label !== undefined) {
      const label = cleanLabel(body.label);
      if (!label) {
        return NextResponse.json({ error: 'Enter a table name.' }, { status: 400 });
      }
      const labels = await loadTableLabels(business.id);
      const clash = labels.find(
        (row) => row.id !== id && row.label.trim().toLowerCase() === label.toLowerCase(),
      );
      if (clash) {
        return NextResponse.json(
          { error: `"${clash.label}" already exists. Choose a different name.` },
          { status: 400 },
        );
      }
      values.push(label);
      updates.push(`label = $${values.length}`);
    }

    if (body?.is_active !== undefined) {
      values.push(Boolean(body.is_active));
      updates.push(`is_active = $${values.length}`);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
    }

    values.push(id, business.id);
    const rows = await query(
      `UPDATE table_labels SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $${values.length - 1} AND business_id = $${values.length}
        RETURNING *`,
      values,
    );

    return NextResponse.json({
      success: true,
      label: Array.isArray(rows) && rows[0] ? rows[0] : null,
    });
  } catch (error) {
    console.error('[table-labels] update failed', error);
    return NextResponse.json({ error: 'Could not save this label.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const business = await getActiveBusiness();
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const support = await getSchemaSupport();
    if (!support.tableLabels) {
      return NextResponse.json(
        { error: 'Table labels need a one-time database update.', code: 'SCHEMA_MISSING' },
        { status: 503 },
      );
    }

    const { id } = await params;
    await query('DELETE FROM table_labels WHERE id = $1 AND business_id = $2', [id, business.id]);
    return NextResponse.json({ success: true, removed: id });
  } catch (error) {
    console.error('[table-labels] delete failed', error);
    return NextResponse.json({ error: 'Could not remove this label.' }, { status: 500 });
  }
}
