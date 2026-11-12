import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getActiveBusiness } from '@/lib/active-business';
import { generateAlphanumericId } from '@/lib/utils';
import {
  getSchemaSupport,
  loadTableLabels,
  normaliseLabelRow,
} from '@/lib/delivery/storage';

/**
 * GET   /api/business/table-labels            Every label, in order.
 * POST  /api/business/table-labels            Create labels (bulk or single).
 * PATCH /api/business/table-labels            Reorder, using an explicit id list.
 *
 * Labels are the table numbers a dine-in customer picks at checkout. They are
 * strings, not integers, because "Bar", "Patio 2" and "VIP" are real tables in
 * real restaurants.
 */

export const runtime = 'nodejs';

export const MAX_LABELS = 200;
const MAX_LABEL_LENGTH = 24;

function cleanLabel(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL_LENGTH);
}

export async function GET() {
  try {
    const business = await getActiveBusiness();
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const support = await getSchemaSupport();
    const labels = await loadTableLabels(business.id);

    return NextResponse.json({
      success: true,
      configured: support.tableLabels,
      labels,
      business: { id: business.id, name: business.name, slug: business.slug },
    });
  } catch (error) {
    console.error('[table-labels] read failed', error);
    return NextResponse.json({ error: 'Could not load table labels.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const business = await getActiveBusiness();
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const support = await getSchemaSupport();
    if (!support.tableLabels) {
      return NextResponse.json(
        {
          error: 'Table labels need a one-time database update before they can be saved.',
          code: 'SCHEMA_MISSING',
        },
        { status: 503 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const existing = await loadTableLabels(business.id);
    const taken = new Set(existing.map((label) => label.label.trim().toLowerCase()));

    const requested: string[] = [];

    if (body?.mode === 'sequence') {
      const prefix = cleanLabel(body?.prefix) || 'Table';
      const start = Math.max(1, Math.min(999, Math.round(Number(body?.start) || 1)));
      const count = Math.max(1, Math.min(MAX_LABELS, Math.round(Number(body?.count) || 0)));
      if (!Number.isFinite(count) || count < 1) {
        return NextResponse.json({ error: 'Choose how many labels to create.' }, { status: 400 });
      }
      for (let i = 0; i < count; i++) requested.push(`${prefix} ${start + i}`);
    } else if (Array.isArray(body?.labels)) {
      for (const raw of body.labels) {
        const label = cleanLabel(raw);
        if (label) requested.push(label);
      }
    } else {
      const single = cleanLabel(body?.label);
      if (single) requested.push(single);
    }

    if (requested.length === 0) {
      return NextResponse.json({ error: 'Enter at least one table name.' }, { status: 400 });
    }

    if (existing.length + requested.length > MAX_LABELS) {
      return NextResponse.json(
        { error: `You can keep up to ${MAX_LABELS} labels.` },
        { status: 400 },
      );
    }

    const toCreate: string[] = [];
    const skipped: string[] = [];
    for (const label of requested) {
      const key = label.toLowerCase();
      if (taken.has(key)) {
        skipped.push(label);
        continue;
      }
      taken.add(key);
      toCreate.push(label);
    }

    if (toCreate.length === 0) {
      return NextResponse.json({
        success: true,
        created: [],
        skipped,
        labels: existing,
        message: 'Those labels already exist.',
      });
    }

    let nextSort = existing.reduce((max, label) => Math.max(max, Number(label.sort_order) || 0), 0) + 1;

    const values: any[] = [];
    const rows: string[] = [];
    for (const label of toCreate) {
      const offset = values.length;
      values.push(generateAlphanumericId(), business.id, label, nextSort++, true);
      rows.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, NOW(), NOW())`);
    }

    const inserted = await query(
      `INSERT INTO table_labels (id, business_id, label, sort_order, is_active, created_at, updated_at)
       VALUES ${rows.join(', ')}
       RETURNING *`,
      values,
    );

    const labels = await loadTableLabels(business.id);

    return NextResponse.json({
      success: true,
      created: (Array.isArray(inserted) ? inserted : []).map(normaliseLabelRow),
      skipped,
      labels,
    });
  } catch (error) {
    console.error('[table-labels] create failed', error);
    return NextResponse.json({ error: 'Could not create those labels.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}));
    const order: string[] = Array.isArray(body?.order)
      ? body.order.filter((id: unknown) => typeof id === 'string')
      : [];

    if (order.length === 0) {
      return NextResponse.json({ error: 'Send the labels in their new order.' }, { status: 400 });
    }

    // One statement, so a reorder is never half applied.
    const values: any[] = [business.id];
    const cases: string[] = [];
    for (let i = 0; i < order.length; i++) {
      values.push(order[i], i + 1);
      cases.push(`WHEN $${values.length - 1} THEN $${values.length}`);
    }

    await query(
      `UPDATE table_labels
          SET sort_order = CASE id ${cases.join(' ')} ELSE sort_order END,
              updated_at = NOW()
        WHERE business_id = $1 AND id IN (${order.map((_, i) => `$${i + 2}`).join(', ')})`,
      values,
    );

    const labels = await loadTableLabels(business.id);
    return NextResponse.json({ success: true, labels });
  } catch (error) {
    console.error('[table-labels] reorder failed', error);
    return NextResponse.json({ error: 'Could not save the new order.' }, { status: 500 });
  }
}
