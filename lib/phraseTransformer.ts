import { DatoField, DatoRecord } from './types';

const TRANSLATABLE_FIELD_TYPES = new Set([
  'string',
  'text',
  'structured_text',
  'seo',
]);

function extractText(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return null;

  // Structured text (dast document)
  if (typeof value === 'object' && (value as Record<string, unknown>).schema === 'dast') {
    return extractDastText((value as Record<string, unknown>).document as DastNode);
  }

  // SEO field
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('title' in obj || 'description' in obj) {
      return [obj.title, obj.description].filter(Boolean).join(' | ');
    }
  }

  return null;
}

interface DastNode {
  type: string;
  value?: string;
  children?: DastNode[];
}

function extractDastText(node: DastNode | null | undefined): string {
  if (!node) return '';
  if (node.type === 'span' && typeof node.value === 'string') return node.value;
  if (!node.children) return '';
  return node.children.map(extractDastText).filter(Boolean).join(' ');
}

function extractSeoFields(
  value: unknown,
  prefix: string,
  out: Record<string, string>
) {
  if (!value || typeof value !== 'object') return;
  const obj = value as Record<string, unknown>;
  if (typeof obj.title === 'string' && obj.title) out[`${prefix}.title`] = obj.title;
  if (typeof obj.description === 'string' && obj.description)
    out[`${prefix}.description`] = obj.description;
}

export function getAllLocales(records: DatoRecord[], fields: DatoField[]): string[] {
  const locales = new Set<string>();
  const localizedFields = fields.filter((f) => f.localized);

  for (const record of records) {
    for (const field of localizedFields) {
      const value = record[field.api_key];
      if (value && typeof value === 'object') {
        Object.keys(value as Record<string, unknown>).forEach((k) => locales.add(k));
      }
    }
  }

  return Array.from(locales).sort();
}

export function transformToPhrase(
  records: DatoRecord[],
  fields: DatoField[],
  locale: string,
  modelApiKey: string,
  options: { onlyLocalized?: boolean } = {}
): Record<string, string> {
  const out: Record<string, string> = {};
  const { onlyLocalized = true } = options;

  const applicableFields = fields.filter((f) => {
    if (!TRANSLATABLE_FIELD_TYPES.has(f.field_type)) return false;
    if (onlyLocalized && !f.localized) return false;
    return true;
  });

  for (const record of records) {
    const recordId = record.id;

    for (const field of applicableFields) {
      const raw = record[field.api_key];
      const keyPrefix = `${modelApiKey}.${recordId}.${field.api_key}`;

      if (field.localized) {
        const localeMap = raw as Record<string, unknown> | null;
        if (!localeMap) continue;
        const localizedValue = localeMap[locale];
        if (localizedValue === null || localizedValue === undefined) continue;

        if (field.field_type === 'seo') {
          extractSeoFields(localizedValue, keyPrefix, out);
        } else {
          const text = extractText(localizedValue);
          if (text) out[keyPrefix] = text;
        }
      } else {
        if (field.field_type === 'seo') {
          extractSeoFields(raw, keyPrefix, out);
        } else {
          const text = extractText(raw);
          if (text) out[keyPrefix] = text;
        }
      }
    }
  }

  return out;
}

export function toNestedJson(flat: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let cursor: Record<string, unknown> = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cursor[parts[i]] || typeof cursor[parts[i]] !== 'object') {
        cursor[parts[i]] = {};
      }
      cursor = cursor[parts[i]] as Record<string, unknown>;
    }
    cursor[parts[parts.length - 1]] = value;
  }

  return result;
}
