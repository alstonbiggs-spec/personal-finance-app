import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncAllPlaidItems } from '@/lib/plaid/sync';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
  try {
    const results = await syncAllPlaidItems();
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error('Manual Plaid transaction sync failed', error);
    return NextResponse.json({ error: 'Transactions are not ready to sync yet. Try again shortly.' }, { status: 502 });
  }
}
