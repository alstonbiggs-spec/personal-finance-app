import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('accounts')
    .select('id,name,institution,account_type,plaid_items(last_synced_at,last_sync_error,needs_reauth)')
    .not('plaid_item_id', 'is', null)
    .order('institution')
    .order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const accounts = (data ?? []).map((account) => {
    const status = Array.isArray(account.plaid_items) ? account.plaid_items[0] : account.plaid_items;
    return {
      id: account.id,
      name: account.name,
      institution: account.institution,
      account_type: account.account_type,
      lastSyncedAt: status?.last_synced_at ?? null,
      syncError: status?.last_sync_error ?? null,
      needsReauth: status?.needs_reauth ?? false,
    };
  });
  return NextResponse.json({ accounts });
}
