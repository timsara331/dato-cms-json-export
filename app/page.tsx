'use client';

import { useState, useEffect } from 'react';
import ModelSelector from '@/components/ModelSelector';
import JsonViewer from '@/components/JsonViewer';
import DownloadButton from '@/components/DownloadButton';
import { DatoModel, DatoRecord } from '@/lib/types';

type QueryMode = 'all' | 'byId';

interface RecordsResult {
  records: DatoRecord[];
  meta: { total_count: number };
  page: number;
  limit: number;
}

export default function Home() {
  const [models, setModels] = useState<DatoModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<DatoModel | null>(null);
  const [activeModel, setActiveModel] = useState<DatoModel | null>(null); // model for current result
  const [queryMode, setQueryMode] = useState<QueryMode>('all');
  const [recordId, setRecordId] = useState('');
  const [result, setResult] = useState<RecordsResult | DatoRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // Load models once so byId queries can resolve the model for the download button
  useEffect(() => {
    fetch('/api/models')
      .then((r) => r.json())
      .then((data) => { if (!data.error) setModels(data); })
      .catch(() => {});
  }, []);

  async function handleQuery(page = 0) {
    setError(null);
    setLoading(true);
    setCurrentPage(page);

    try {
      if (queryMode === 'byId') {
        if (!recordId.trim()) throw new Error('Please enter a record ID');
        const r = await fetch(`/api/record?id=${encodeURIComponent(recordId.trim())}`);
        const data = await r.json();
        if (data.error) throw new Error(data.error);
        setResult(data.record);
        // Resolve which model this record belongs to
        const itemTypeId = data.record?.relationships?.item_type?.data?.id ?? data.record?.item_type?.id;
        const model = models.find((m) => m.id === itemTypeId) ?? null;
        setActiveModel(model);
      } else {
        if (!selectedModel) throw new Error('Please select a model');
        const r = await fetch(
          `/api/records?modelId=${encodeURIComponent(selectedModel.id)}&page=${page}`
        );
        const data = await r.json();
        if (data.error) throw new Error(data.error);
        setResult(data);
        setActiveModel(selectedModel);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setResult(null);
      setActiveModel(null);
    } finally {
      setLoading(false);
    }
  }

  const recordsResult = result && 'records' in (result as object) ? (result as RecordsResult) : null;
  const singleRecord = result && !('records' in (result as object)) ? (result as DatoRecord) : null;

  const displayRecords: DatoRecord[] = recordsResult
    ? recordsResult.records
    : singleRecord
    ? [singleRecord]
    : [];

  const totalCount = recordsResult?.meta?.total_count ?? (singleRecord ? 1 : 0);
  const totalPages = recordsResult
    ? Math.ceil(totalCount / (recordsResult.limit || 30))
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-semibold text-gray-900">DatoCMS → Phrase Export</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Query content records and download them as Phrase-compatible JSON
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Query panel */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-5">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Query mode</p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input
                  type="radio"
                  name="mode"
                  value="all"
                  checked={queryMode === 'all'}
                  onChange={() => {
                    setQueryMode('all');
                    setResult(null);
                    setActiveModel(null);
                  }}
                />
                All records for model
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input
                  type="radio"
                  name="mode"
                  value="byId"
                  checked={queryMode === 'byId'}
                  onChange={() => {
                    setQueryMode('byId');
                    setResult(null);
                    setActiveModel(null);
                  }}
                />
                Specific record by ID
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            {queryMode === 'all' ? (
              <ModelSelector
                models={models}
                selectedModelId={selectedModel?.id ?? ''}
                onSelect={(model) => {
                  setSelectedModel(model);
                  setResult(null);
                  setActiveModel(null);
                }}
              />
            ) : (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Record ID</label>
                <input
                  type="text"
                  value={recordId}
                  onChange={(e) => setRecordId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuery(0)}
                  placeholder="e.g. 123456789"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                />
              </div>
            )}

            <button
              onClick={() => handleQuery(0)}
              disabled={
                loading ||
                (queryMode === 'all' && !selectedModel) ||
                (queryMode === 'byId' && !recordId.trim())
              }
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              {loading ? 'Loading…' : 'Query'}
            </button>
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Results */}
        {result !== null && !loading && (
          <div className="flex flex-col gap-4">
            {/* Stats + pagination */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {queryMode === 'byId'
                  ? 'Showing 1 record'
                  : `Showing ${displayRecords.length} of ${totalCount} records`}
              </p>

              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleQuery(currentPage - 1)}
                    disabled={currentPage === 0 || loading}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-500">
                    Page {currentPage + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => handleQuery(currentPage + 1)}
                    disabled={currentPage >= totalPages - 1 || loading}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            {/* Download panel */}
            {displayRecords.length > 0 && activeModel && (
              <DownloadButton
                records={displayRecords}
                fields={activeModel.fields}
                modelApiKey={activeModel.api_key}
              />
            )}

            {/* JSON viewer */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <JsonViewer data={result} />
            </div>
          </div>
        )}

        {loading && (
          <div className="bg-white border border-gray-200 rounded-xl p-12 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Fetching records…</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
