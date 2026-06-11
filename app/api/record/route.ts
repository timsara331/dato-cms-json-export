import { NextRequest, NextResponse } from 'next/server';
import { client } from '@/lib/datocms';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    const record = await client.items.find(id, { nested: true } as Parameters<typeof client.items.find>[1]);
    return NextResponse.json({ record });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
