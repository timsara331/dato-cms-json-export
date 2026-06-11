'use client';

import { DatoField, DatoRecord } from '@/lib/types';

interface Props {
  rawResult: unknown;
  records: DatoRecord[];
  fields: DatoField[];
  modelApiKey: string;
}

export default function DownloadButton({ rawResult, records, fields, modelApiKey }: Props) {
  if (records.length === 0) return null;

  function getFilename(): string {
    if (records.length === 1) {
      const titleField =
        fields.find((f) => f.api_key === 'title' && f.field_type === 'string') ??
        fields.find((f) => f.field_type === 'string');

      if (titleField) {
        const raw = records[0][titleField.api_key];
        const titleStr =
          titleField.localized && raw && typeof raw === 'object'
            ? (Object.values(raw as Record<string, unknown>)[0] as string | undefined)
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
          return `${slug}.json`;
        }
      }
    }

    return `${modelApiKey}.json`;
  }

  function handleDownload() {
    const blob = new Blob([JSON.stringify(rawResult, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getFilename();
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
      <button
        onClick={handleDownload}
        className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        Download JSON
      </button>
      <span className="text-xs text-gray-500">
        Downloads the full raw JSON exactly as shown in the viewer
      </span>
    </div>
  );
}
