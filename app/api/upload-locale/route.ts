import { NextRequest, NextResponse } from 'next/server';
import { client } from '@/lib/datocms';

export const dynamic = 'force-dynamic';

interface UploadPayload {
  // Array of raw DatoCMS record objects from the downloaded JSON
  records: RawRecord[];
  // The locale code to write translated values into (e.g. "fr", "de")
  targetLocale: string;
  // Field schemas for the model so we know which fields are localized
  fields: FieldSchema[];
}

interface RawRecord {
  id: string;
  [key: string]: unknown;
}

interface FieldSchema {
  api_key: string;
  field_type: string;
  localized: boolean;
}

const TRANSLATABLE_FIELD_TYPES = new Set(['string', 'text', 'structured_text', 'seo']);

export async function POST(req: NextRequest) {
  try {
    const body: UploadPayload = await req.json();
    const { records, targetLocale, fields } = body;

    if (!targetLocale) {
      return NextResponse.json({ error: 'Missing targetLocale' }, { status: 400 });
    }
    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'No records provided' }, { status: 400 });
    }

    const localizedFields = fields.filter(
      (f) => f.localized && TRANSLATABLE_FIELD_TYPES.has(f.field_type)
    );

    const results: { id: string; status: 'updated' | 'skipped' | 'error'; error?: string }[] = [];

    for (const incomingRecord of records) {
      const recordId = incomingRecord.id;
      if (!recordId) {
        results.push({ id: '(unknown)', status: 'skipped', error: 'No id on record' });
        continue;
      }

      try {
        // Fetch the current record so we can merge into existing locales
        const existing = await client.items.find(recordId);

        // Build the attributes patch: for each localized field, merge the
        // incoming value for targetLocale into the existing locale map.
        const patch: Record<string, unknown> = {};

        for (const field of localizedFields) {
          const incomingValue = incomingRecord[field.api_key];
          if (incomingValue === undefined || incomingValue === null) continue;

          // The existing value is a locale map: { en: "...", fr: "..." }
          // Cast through unknown since the CMA client types attributes loosely
          const existingLocaleMap =
            (existing as unknown as Record<string, unknown>)[field.api_key] as
              | Record<string, unknown>
              | null
              | undefined;

          const merged: Record<string, unknown> = {
            ...(existingLocaleMap ?? {}),
          };

          // The incoming value may already be a locale map (if the file was
          // downloaded as-is) or a plain string (if translated externally).
          if (typeof incomingValue === 'object' && incomingValue !== null) {
            const localeMap = incomingValue as Record<string, unknown>;
            // If the incoming JSON has the target locale key, use that value.
            // Otherwise treat the whole object as the translated value.
            if (targetLocale in localeMap) {
              merged[targetLocale] = localeMap[targetLocale];
            } else {
              merged[targetLocale] = incomingValue;
            }
          } else {
            merged[targetLocale] = incomingValue;
          }

          patch[field.api_key] = merged;
        }

        if (Object.keys(patch).length === 0) {
          results.push({ id: recordId, status: 'skipped' });
          continue;
        }

        await client.items.update(recordId, patch as Parameters<typeof client.items.update>[1]);
        results.push({ id: recordId, status: 'updated' });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ id: recordId, status: 'error', error: message });
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
