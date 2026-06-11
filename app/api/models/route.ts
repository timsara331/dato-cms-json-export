import { NextResponse } from 'next/server';
import { client } from '@/lib/datocms';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const itemTypes = await client.itemTypes.list();

    const models = await Promise.all(
      itemTypes.map(async (itemType) => {
        const fields = await client.fields.list(itemType.id);
        return {
          id: itemType.id,
          name: itemType.name,
          api_key: itemType.api_key,
          fields: fields.map((f) => ({
            id: f.id,
            api_key: f.api_key,
            label: f.label,
            field_type: f.field_type,
            localized: f.localized,
            validators: f.validators,
          })),
        };
      })
    );

    return NextResponse.json(models);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
