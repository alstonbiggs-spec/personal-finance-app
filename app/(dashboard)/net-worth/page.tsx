import { createClient } from '@/lib/supabase/server';
import { NetWorthView, type LinkedAccount, type ManualItem } from '@/components/net-worth/net-worth-view';

type Account = LinkedAccount & { account_type: string; owner: string };

export default async function NetWorthPage() {
  const supabase = await createClient();
  const [{ data }, { data: items, error: itemsError }] = await Promise.all([
    supabase.from('accounts').select('id,name,institution,account_type,bucket,owner,current_balance').order('institution').order('name'),
    supabase.from('net_worth_items').select('id,name,category,value,is_liability'),
  ]);
  // Credit cards are liabilities on a statement cycle, not assets, so they're left out.
  // USAA accounts are the household's everyday checking: they count toward net worth but
  // are shown separately as "working capital" below the long-term holdings.
  const assets = ((data ?? []) as Account[]).filter((account) => account.account_type !== 'credit');
  const isUsaa = (account: Account) => account.institution.toLowerCase().includes('usaa');
  const accounts = assets.filter(account => !isUsaa(account));
  const workingCapital = assets.filter(isUsaa);
  const manualItems = ((items ?? []) as ManualItem[]).map(item => ({ ...item, value: Number(item.value) }));

  return <NetWorthView accounts={accounts} workingCapital={workingCapital} initialItems={manualItems} loadError={itemsError ? `Couldn't load manual items: ${itemsError.message}` : undefined} />;
}
