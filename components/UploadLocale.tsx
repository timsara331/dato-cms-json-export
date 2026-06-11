'use client';

import { useRef, useState } from 'react';
import { DatoField } from '@/lib/types';

interface Props {
  fields: DatoField[];
  availableLocales: string[];
}

type UploadResult = { id: string; status: 'updated' | 'skipped' | 'error'; error?: string };

export default function UploadLocale({ fields, availableLocales }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [targetLocale, setTargetLocale] = useState('');
  const [customLocale, setCustomLocale] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRecords, setParsedRecords] = useState<unknown[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[] | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const locale = targetLocale === '__custom__' ? customLocale.trim() : targetLocale;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParsedRecords(null);
    setParseError(null);
    setResults(null);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        // Accept either a single record, an array, or { records: [...] }
        let records: unknown[];
        if (Array.isArray(json)) {
          records = json;
        } else if (json && typeof json === 'object' && Array.isArray((json as Record<string, unknown>).records)) {
          records = (json as Record<string, unknown>).records as unknown[];
        } else if (json && typeof json === 'object' && (json as Record<string, unknown>).id) {
          records = [json];
        } else {
          throw new Error('Could not find records in JSON. Expected an array, a single record object, or { records: [...] }.');
        }
        setParsedRecords(records);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Invalid JSON');
      }
    };
    reader.readAsText(file);
  }

  async function handleUpload() {
    if (!parsedRecords || !locale) return;
    setUploading(true);
    setResults(null);
    setUploadError(null);

    try {
      const res = await fetch('/api/upload-locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: parsedRecords, targetLocale: locale, fields }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults(data.results);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  const updated = results?.filter((r) => r.status === 'updated').length ?? 0;
  const skipped = results?.filter((r) => r.status === 'skipped').length ?? 0;
  const errors = results?.filter((r) => r.status === 'error') ?? [];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Upload Translated JSON</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Upload a translated JSON file to write its content back as a localized version in DatoCMS
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        {/* File picker */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Translated JSON file</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50 transition-colors"
            >
              {fileName ? 'Change file' : 'Choose file'}
            </button>
            {fileName && (
              <span className="text-sm text-gray-600 truncate max-w-48">{fileName}</span>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Target locale */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Target locale</label>
          <select
            value={targetLocale}
            onChange={(e) => setTargetLocale(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Select locale —</option>
            {availableLocales.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
            <option value="__custom__">Other (type below)</option>
          </select>
        </div>

        {targetLocale === '__custom__' && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Locale code</label>
            <input
              type="text"
              value={customLocale}
              onChange={(e) => setCustomLocale(e.target.value)}
              placeholder="e.g. fr, de, ja"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
            />
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!parsedRecords || !locale || uploading}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
        >
          {uploading ? 'Uploading…' : `Upload to DatoCMS`}
        </button>
      </div>

      {/* Parse state */}
      {parsedRecords && !parseError && (
        <p className="text-sm text-gray-600">
          {parsedRecords.length} record{parsedRecords.length !== 1 ? 's' : ''} ready to upload
        </p>
      )}
      {parseError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {parseError}
        </p>
      )}

      {/* Upload error */}
      {uploadError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {uploadError}
        </p>
      )}

      {/* Results summary */}
      {results && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-4 text-sm">
            <span className="text-green-700 font-medium">{updated} updated</span>
            {skipped > 0 && <span className="text-gray-500">{skipped} skipped</span>}
            {errors.length > 0 && (
              <span className="text-red-600 font-medium">{errors.length} failed</span>
            )}
          </div>

          {errors.length > 0 && (
            <div className="border border-red-200 rounded-lg divide-y divide-red-100 text-sm">
              {errors.map((r) => (
                <div key={r.id} className="px-3 py-2 text-red-700">
                  <span className="font-mono text-xs">{r.id}</span>: {r.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
