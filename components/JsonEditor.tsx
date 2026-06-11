'use client';

import { useEffect, useState } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Recursively walks a parsed JSON value and renames every object key
 * matching `fromKey` to `toKey`. Leaves values untouched.
 */
function remapLocaleKeys(
  node: unknown,
  fromKey: string,
  toKey: string,
): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => remapLocaleKeys(item, fromKey, toKey));
  }
  if (node !== null && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const newKey = k === fromKey ? toKey : k;
      out[newKey] = remapLocaleKeys(v, fromKey, toKey);
    }
    return out;
  }
  return node;
}

export default function JsonEditor({ value, onChange }: Props) {
  const [parseError, setParseError] = useState<string | null>(null);
  const [fromKey, setFromKey] = useState('');
  const [toKey, setToKey] = useState('');
  const [remapError, setRemapError] = useState<string | null>(null);
  const [remapSuccess, setRemapSuccess] = useState<string | null>(null);

  // Validate JSON on every change
  useEffect(() => {
    try {
      JSON.parse(value);
      setParseError(null);
    } catch {
      setParseError('Invalid JSON');
    }
  }, [value]);

  function handleRemap() {
    setRemapError(null);
    setRemapSuccess(null);

    const from = fromKey.trim();
    const to = toKey.trim();

    if (!from || !to) {
      setRemapError('Both fields are required');
      return;
    }
    if (from === to) {
      setRemapError('Source and target keys are the same');
      return;
    }

    try {
      const parsed = JSON.parse(value);
      const remapped = remapLocaleKeys(parsed, from, to);
      onChange(JSON.stringify(remapped, null, 2));
      setRemapSuccess(`Renamed all "${from}" keys → "${to}"`);
      setTimeout(() => setRemapSuccess(null), 3000);
    } catch {
      setRemapError('Cannot remap — fix the JSON errors first');
    }
  }

  function handleFormat() {
    try {
      onChange(JSON.stringify(JSON.parse(value), null, 2));
    } catch {
      // leave as-is if invalid
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Remap toolbar */}
      <div className="flex flex-wrap items-end gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Rename locale key</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={fromKey}
              onChange={(e) => { setFromKey(e.target.value); setRemapError(null); setRemapSuccess(null); }}
              placeholder="from (e.g. en)"
              className="border border-gray-300 rounded px-2 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-400 text-sm">→</span>
            <input
              type="text"
              value={toKey}
              onChange={(e) => { setToKey(e.target.value); setRemapError(null); setRemapSuccess(null); }}
              placeholder="to (e.g. ja)"
              className="border border-gray-300 rounded px-2 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleRemap}
              disabled={!fromKey.trim() || !toKey.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-1.5 rounded transition-colors"
            >
              Remap
            </button>
          </div>
        </div>

        <button
          onClick={handleFormat}
          className="text-xs text-gray-500 hover:text-gray-700 border border-gray-300 px-3 py-1.5 rounded hover:bg-white transition-colors"
        >
          Format JSON
        </button>

        {remapError && (
          <span className="text-xs text-red-600">{remapError}</span>
        )}
        {remapSuccess && (
          <span className="text-xs text-green-700 font-medium">{remapSuccess}</span>
        )}
      </div>

      {/* Editor */}
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className={`w-full h-80 font-mono text-xs p-3 border rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
            parseError ? 'border-red-300 focus:ring-red-400' : 'border-gray-300'
          }`}
        />
        {parseError && (
          <p className="absolute bottom-2 right-2 text-xs text-red-500 bg-white px-1">
            {parseError}
          </p>
        )}
      </div>
    </div>
  );
}
