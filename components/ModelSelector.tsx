'use client';

import { DatoModel } from '@/lib/types';

interface Props {
  models: DatoModel[];
  selectedModelId: string;
  onSelect: (model: DatoModel | null) => void;
}

export default function ModelSelector({ models, selectedModelId, onSelect }: Props) {
  if (models.length === 0) {
    return <div className="h-10 bg-gray-100 rounded-lg animate-pulse w-64" />;
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">Content Model</label>
      <select
        value={selectedModelId}
        onChange={(e) => {
          const model = models.find((m) => m.id === e.target.value) ?? null;
          onSelect(model);
        }}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-64"
      >
        <option value="">— Select a model —</option>
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} ({m.api_key})
          </option>
        ))}
      </select>
    </div>
  );
}
