import { NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'You must be signed in to connect an account.' }, { status: 401 });
  const { public_token, metadata } = await request.json();
  if (!public_token) return NextResponse.json({ error: 'Missing public token.' }, { status: 400 });
  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Server integration is not configured.' }, { status: 500 });

  try {
    const environment = process.env.PLAID_ENV === 'production' ? PlaidEnvironments.production : process.env.PLAID_ENV === 'development' ? PlaidEnvironments.development : PlaidEnvironments.sandbox;
    const config = new Configuration({ basePath: environment, baseOptions: { headers: { 'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID, 'PLAID-SECRET': process.env.PLAID_SECRET } } });
    const plaid = new PlaidApi(config);
    const exchanged = await plaid.itemPublicTokenExchange({ public_token });
    const admin = createAdminClient();
    const institutionName = metadata?.institution?.name ?? 'Connected institution';
    const { error: itemError } = await admin.from('plaid_items').upsert({ item_id: exchanged.data.item_id, access_token: exchanged.data.access_token, institution_name: institutionName }, { onConflict: 'item_id' });
    if (itemError) throw itemError;
    for (const account of metadata?.accounts ?? []) {
      const accountType = account.type === 'credit' ? 'credit' : account.type === 'depository' ? 'checking' : 'debit';
      const { error: accountError } = await admin.from('accounts').upsert({ name: account.name, institution: institutionName, owner: 'joint', account_type: accountType, bucket: 'joint', plaid_account_id: account.id, plaid_item_id: exchanged.data.item_id }, { onConflict: 'plaid_account_id' });
      if (accountError) throw accountError;
    }
    return NextResponse.json({ ok: true, message: `${institutionName} connected.` });
  } catch (error) {
    console.error('Plaid connection failed', error);
    return NextResponse.json({ error: 'Plaid could not finish connecting this institution.' }, { status: 502 });
  }
}
