import { createClient } from '@/lib/supabase/server';
import { NetWorthView, type LinkedAccount, type ManualItem } from '@/components/net-worth/net-worth-view';

type Account = LinkedAccount & { account_type: string; owner: string };

export default async function NetWorthPage() {
  const supabase = await createClient();
  const [{ data }, { data: items, error: itemsError }] = await Promise.all([
    supabase.from('accounts').select('id,name,institution,account_type,bucket,owner,current_balance').order('institution').order('name'),
    supabase.from('net_worth_items').select('id,name,category,value,is_liability'),
  ]);
  // USAA accounts are the household's everyday checking, not something we're tracking
  // net worth against here; credit cards are liabilities on a statement cycle, not assets.
  const accounts = ((data ?? []) as Account[]).filter((account) => account.account_type !== 'credit' && !account.institution.toLowerCase().includes('usaa'));
  const manualItems = ((items ?? []) as ManualItem[]).map(item => ({ ...item, value: Number(item.value) }));

  return <NetWorthView accounts={accounts} initialItems={manualItems} loadError={itemsError ? `Couldn't load manual items: ${itemsError.message}` : undefined} />;
}
