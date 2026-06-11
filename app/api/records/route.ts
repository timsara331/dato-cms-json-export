import { NextRequest, NextResponse } from 'next/server';
import { client } from '@/lib/datocms';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const modelId = searchParams.get('modelId');
  const page = parseInt(searchParams.get('page') ?? '0', 10);
  const limit = 30; // Keep low when using nested:true

  if (!modelId) {
    return NextResponse.json({ error: 'Missing modelId' }, { status: 400 });
  }

  try {
    const response = await client.items.rawList({
      filter: { type: modelId },
      page: { limit, offset: page * limit },
      nested: true,
      version: 'current',
    });

    return NextResponse.json({
      records: response.data,
      meta: response.meta,
      page,
      limit,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
