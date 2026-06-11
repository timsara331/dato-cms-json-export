import { NextRequest, NextResponse } from 'next/server';
import { client } from '@/lib/datocms';

export const dynamic = 'force-dynamic';

interface UploadPayload {
  records: IncomingRecord[];
  targetLocale: string;
}

interface IncomingRecord {
  id: string;
  [key: string]: unknown;
}

// Field types whose values we know how to extract translated text from
const TRANSLATABLE_FIELD_TYPES = new Set([
  'string',
  'text',
  'structured_text',
  'seo',
]);

/**
 * Given a raw field value from the uploaded JSON, extract the scalar
 * content value regardless of what locale key it was stored under.
 *
 * The uploaded file may have:
 *   { "en": "Hello" }  — locale map, source locale differs from target
 *   { "ja": "こんにちは" } — locale map, already keyed to target locale
 *   "Hello"            — plain string (e.g. from an external tool)
 */
function extractValue(raw: unknown, targetLocale: string): unknown {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return raw;

  const map = raw as Record<string, unknown>;

  // If the target locale key is already present, use it directly
  if (targetLocale in map) return map[targetLocale];

  // Otherwise take the first non-null value — this is the translated content
  // stored under the source locale key
  return Object.values(map).find((v) => v !== null && v !== undefined) ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const body: UploadPayload = await req.json();
    const { records: incomingRecords, targetLocale } = body;

    if (!targetLocale) {
      return NextResponse.json({ error: 'Missing targetLocale' }, { status: 400 });
    }
    if (!Array.isArray(incomingRecords) || incomingRecords.length === 0) {
      return NextResponse.json({ error: 'No records provided' }, { status: 400 });
    }

    // Cache field schemas per item_type so we only fetch once per model
    const fieldSchemaCache = new Map<string, Awaited<ReturnType<typeof client.fields.list>>>();

    async function getFields(itemTypeId: string) {
      if (!fieldSchemaCache.has(itemTypeId)) {
        fieldSchemaCache.set(itemTypeId, await client.fields.list(itemTypeId));
      }
      return fieldSchemaCache.get(itemTypeId)!;
    }

    const results: { id: string; status: 'updated' | 'skipped' | 'error'; error?: string }[] = [];

    for (const incoming of incomingRecords) {
      const recordId = incoming.id;
      if (!recordId) {
        results.push({ id: '(unknown)', status: 'skipped', error: 'Missing id' });
        continue;
      }

      try {
        // Fetch the live record via the CMA client to get current field values
        // and resolve the item_type for the field schema lookup
        const existing = await client.items.find(recordId);
        const existingAttrs = existing as unknown as Record<string, unknown>;

        // Pull the item_type id from the CMA response relationships
        const itemTypeId = (
          existing as unknown as {
            relationships?: { item_type?: { data?: { id?: string } } };
          }
        ).relationships?.item_type?.data?.id;

        if (!itemTypeId) {
          results.push({ id: recordId, status: 'error', error: 'Could not resolve item_type' });
          continue;
        }

        // Get authoritative field schemas from the CMA — not from the client payload
        const fields = await getFields(itemTypeId);
        const localizedFields = fields.filter(
          (f) => f.localized && TRANSLATABLE_FIELD_TYPES.has(f.field_type)
        );

        if (localizedFields.length === 0) {
          results.push({ id: recordId, status: 'skipped' });
          continue;
        }

        // Determine if this is a brand-new locale on this record.
        // DatoCMS requires ALL localized fields to be present in a single
        // update when introducing a new locale — even fields with no
        // translation (null is acceptable).
        const isNewLocale = localizedFields.every((f) => {
          const existing = existingAttrs[f.api_key];
          if (!existing || typeof existing !== 'object') return true;
          return !(targetLocale in (existing as Record<string, unknown>));
        });

        // Build the update payload field by field
        const patch: Record<string, unknown> = {};
        let hasAnyTranslation = false;

        for (const field of localizedFields) {
          const incomingRaw = incoming[field.api_key];
          const existingLocaleMap =
            (existingAttrs[field.api_key] as Record<string, unknown> | null | undefined) ?? {};

          // Start from the existing locale map so we never overwrite other locales
          const merged: Record<string, unknown> = { ...existingLocaleMap };

          if (incomingRaw !== undefined && incomingRaw !== null) {
            merged[targetLocale] = extractValue(incomingRaw, targetLocale);
            hasAnyTranslation = true;
          } else if (isNewLocale) {
            // Must explicitly include the new locale key (null) on every
            // localized field when introducing the locale for the first time
            merged[targetLocale] = null;
          } else {
            // Existing locale, no new value for this field — omit it
            continue;
          }

          patch[field.api_key] = merged;
        }

        if (!hasAnyTranslation && !isNewLocale) {
          results.push({ id: recordId, status: 'skipped' });
          continue;
        }

        // Use the CMA client to write the update
        await client.items.update(
          recordId,
          patch as Parameters<typeof client.items.update>[1],
        );

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
