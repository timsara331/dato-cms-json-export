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

        // Check whether the target locale already exists on this record.
        // We detect this by inspecting the first localized field that has data.
        const existingRecord = existing as unknown as Record<string, unknown>;
        const isNewLocale = localizedFields.every((f) => {
          const val = existingRecord[f.api_key];
          if (!val || typeof val !== 'object') return true;
          return !(targetLocale in (val as Record<string, unknown>));
        });

        // Build the patch. When adding a brand-new locale, DatoCMS requires
        // ALL localized fields to be present in the same update — even fields
        // we have no translation for — with the new locale key explicitly set
        // (null is acceptable). For existing locales a partial patch is fine.
        const patch: Record<string, unknown> = {};
        let hasTranslatedValue = false;

        for (const field of localizedFields) {
          const incomingValue = incomingRecord[field.api_key];

          // The existing value is a locale map: { en: "...", fr: "..." }
          const existingLocaleMap =
            existingRecord[field.api_key] as Record<string, unknown> | null | undefined;

          const merged: Record<string, unknown> = { ...(existingLocaleMap ?? {}) };

          if (incomingValue !== undefined && incomingValue !== null) {
            // The incoming value may already be a locale map (downloaded as-is)
            // or a plain translated value.
            if (typeof incomingValue === 'object') {
              const localeMap = incomingValue as Record<string, unknown>;
              merged[targetLocale] = targetLocale in localeMap
                ? localeMap[targetLocale]
                : incomingValue;
            } else {
              merged[targetLocale] = incomingValue;
            }
            hasTranslatedValue = true;
          } else if (isNewLocale) {
            // No translation provided for this field, but we must include it
            // with a null value when introducing the locale for the first time.
            merged[targetLocale] = null;
          } else {
            // Existing locale, no new value — skip this field entirely.
            continue;
          }

          patch[field.api_key] = merged;
        }

        if (!hasTranslatedValue && !isNewLocale) {
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
