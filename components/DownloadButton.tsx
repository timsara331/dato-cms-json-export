'use client';

import { useState } from 'react';
import { DatoField, DatoRecord } from '@/lib/types';
import { transformToPhrase, toNestedJson, getAllLocales } from '@/lib/phraseTransformer';

interface Props {
  records: DatoRecord[];
  fields: DatoField[];
  modelApiKey: string;
}

export default function DownloadButton({ records, fields, modelApiKey }: Props) {
  const locales = getAllLocales(records, fields);
  const [locale, setLocale] = useState(locales[0] ?? 'en');
  const [format, setFormat] = useState<'flat' | 'nested'>('flat');
  const [onlyLocalized, setOnlyLocalized] = useState(true);

  function getFilename(): string {
    // For a single record, try to derive the filename from its title field
    if (records.length === 1) {
      const titleField = fields.find(
        (f) => f.api_key === 'title' && f.field_type === 'string'
      ) ?? fields.find((f) => f.field_type === 'string');

      if (titleField) {
        const raw = records[0][titleField.api_key];
        const titleStr =
          titleField.localized && raw && typeof raw === 'object'
            ? ((raw as Record<string, unknown>)[locale] as string | undefined) ??
              Object.values(raw as Record<string, unknown>)[0]
            : typeof raw === 'string'
            ? raw
            : null;

        if (titleStr && typeof titleStr === 'string') {
          const slug = titleStr
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
          return `${slug}_${locale}.json`;
        }
      }
    }

    // For multiple records fall back to model + locale
    return `${modelApiKey}_${locale}.json`;
  }

  function handleDownload() {
    const flat = transformToPhrase(records, fields, locale, modelApiKey, { onlyLocalized });
    const data = format === 'nested' ? toNestedJson(flat) : flat;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getFilename();
    a.click();
    URL.revokeObjectURL(url);
  }

  if (records.length === 0) return null;

  return (
    <div className="flex flex-wrap items-end gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">Locale</label>
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
        >
          {locales.length > 0 ? (
            locales.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))
          ) : (
            <option value="en">en (no locales found)</option>
          )}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">Format</label>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as 'flat' | 'nested')}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
        >
          <option value="flat">Flat (dot-path keys)</option>
          <option value="nested">Nested JSON</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">Fields</label>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer py-1.5">
          <input
            type="checkbox"
            checked={onlyLocalized}
            onChange={(e) => setOnlyLocalized(e.target.checked)}
            className="rounded"
          />
          Localized only
        </label>
      </div>

      <button
        onClick={handleDownload}
        className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        Download for Phrase
      </button>
    </div>
  );
}
