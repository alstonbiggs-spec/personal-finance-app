import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getPlaidClient } from '@/lib/plaid/client';
import { hydratePlaidItemAccounts, syncPlaidItem } from '@/lib/plaid/sync';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'You must be signed in to connect an account.' }, { status: 401 });
  const { public_token, metadata } = await request.json();
  if (!public_token) return NextResponse.json({ error: 'Missing public token.' }, { status: 400 });
  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Server integration is not configured.' }, { status: 500 });

  try {
    const exchanged = await getPlaidClient().itemPublicTokenExchange({ public_token });
    const admin = createAdminClient();
    const institutionName = metadata?.institution?.name ?? 'Connected institution';
    const { error: itemError } = await admin.from('plaid_items').upsert({ item_id: exchanged.data.item_id, access_token: exchanged.data.access_token, institution_name: institutionName }, { onConflict: 'item_id' });
    if (itemError) throw itemError;
    await hydratePlaidItemAccounts(exchanged.data.item_id, institutionName);
    let sync = null;
    try { sync = await syncPlaidItem(exchanged.data.item_id); } catch (syncError) { console.error('Initial Plaid transaction sync failed', syncError); }
    return NextResponse.json({ ok: true, message: `${institutionName} connected.`, sync });
  } catch (error) {
    console.error('Plaid connection failed', error);
    return NextResponse.json({ error: 'Plaid could not finish connecting this institution.' }, { status: 502 });
  }
}
