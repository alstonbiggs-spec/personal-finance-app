import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncAllPlaidItems } from '@/lib/plaid/sync';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
  try {
    const results = await syncAllPlaidItems();
    const failures = results.filter((result) => !result.ok);
    if (failures.length) console.error('Plaid transaction sync had failures', failures);
    return NextResponse.json({ ok: failures.length === 0, results });
  } catch (error) {
    console.error('Manual Plaid transaction sync failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Transaction sync failed.' }, { status: 502 });
  }
}
