'use client';

import { useState } from 'react';
import { JsonView, allExpanded, defaultStyles } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';

interface Props {
  data: unknown;
}

export default function JsonViewer({ data }: Props) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'tree' | 'raw'>('tree');

  function handleCopy() {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('tree')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              viewMode === 'tree'
                ? 'bg-white shadow text-gray-900 font-medium'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Tree
          </button>
          <button
            onClick={() => setViewMode('raw')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              viewMode === 'raw'
                ? 'bg-white shadow text-gray-900 font-medium'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Raw JSON
          </button>
        </div>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy JSON'}
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-auto max-h-[600px] bg-white">
        {viewMode === 'tree' ? (
          <div className="p-3 text-sm">
            <JsonView
              data={data as object}
              shouldExpandNode={allExpanded}
              style={defaultStyles}
            />
          </div>
        ) : (
          <pre className="p-4 text-xs text-gray-800 whitespace-pre-wrap break-all">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
